import { randomBytes, randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  DomainEvents,
  MfaMethod,
  UserRole,
  UserStatus,
  type AccountDeletionBlocker,
  type AccountDeletionStatusResponse,
  type AuthUserView,
  type DeleteAccountRequest,
  type GoogleAuthConfigResponse,
  type LoginMfaChallengeResponse,
  type LoginSuccessResponse,
  type TotpSetupResponse,
} from '@industriallink/contracts';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { v7 as uuidv7 } from 'uuid';
import type { AppConfig } from '../../config/configuration';
import { DEFAULT_TENANT_ID } from '../../shared/common/constants';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { PasswordService } from '../../shared/security/password.service';
import { CrmService } from '../crm/crm.service';
import type { AuthenticatedUser, JwtPayload } from '../../shared/security/security.types';

interface RequestMeta {
  correlationId: string;
  ip?: string;
  userAgent?: string;
  referralCookie?: string | null;
}

type LoginResult =
  | { kind: 'tokens'; response: LoginSuccessResponse; refreshToken: string }
  | { kind: 'mfa'; response: LoginMfaChallengeResponse };

const MFA_PURPOSE = 'login';
const MFA_TOKEN_TTL_SEC = 10 * 60;
const TOTP_ISSUER = 'inlink';

interface MfaTokenPayload {
  sub: string;
  purpose: 'mfa_login';
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly crm: CrmService,
  ) {}

  async register(
    input: { email: string; password: string; displayName: string; role: UserRole },
    meta: RequestMeta,
  ): Promise<{ message: string; devOtp?: string }> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const code = await this.codeGen.next('USR');
    const passwordHash = await this.password.hash(input.password);

    const user = await this.prisma.user.create({
      data: {
        code,
        tenantId: DEFAULT_TENANT_ID,
        email,
        passwordHash,
        displayName: input.displayName,
        role: input.role,
        status: UserStatus.Created,
      },
    });

    if (input.role === UserRole.Recruiter) {
      try {
        await this.crm.recordReferralSignup({
          cookie: meta.referralCookie,
          userId: user.id,
          role: user.role,
          displayName: user.displayName,
          registeredAt: user.createdAt,
        });
      } catch (err) {
        this.logger.error(`Không ghi được đăng ký giới thiệu cho ${user.id}: ${String(err)}`);
      }
    }

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'user.register',
      entityType: 'identity.user',
      entityId: user.id,
      after: { email, role: input.role },
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.UserRegistered,
        tenantId: user.tenantId,
        correlationId: meta.correlationId,
        payload: {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      }),
    );

    const otp = await this.issueOtp(user.id, user.email, user.tenantId, 'register', meta.correlationId);
    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP.',
      devOtp: this.devOtpOrUndefined(otp),
    };
  }

  /**
   * Gửi lại OTP đăng ký. Thu hồi mã cũ, phát hành mã mới → event OtpIssued.
   */
  async resendOtp(
    emailRaw: string,
    meta: RequestMeta,
  ): Promise<{ message: string; devOtp?: string }> {
    const email = emailRaw.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isDeleted) {
      throw new BadRequestException('Tài khoản không tồn tại');
    }
    if (user.isVerified) {
      throw new BadRequestException('Tài khoản đã xác thực. Hãy đăng nhập.');
    }

    const otp = await this.issueOtp(user.id, user.email, user.tenantId, 'register', meta.correlationId);
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'user.resend_otp',
      entityType: 'identity.user',
      entityId: user.id,
      after: { email },
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return {
      message: 'Đã gửi lại mã OTP tới email của bạn.',
      devOtp: this.devOtpOrUndefined(otp),
    };
  }

  async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || user.isDeleted || user.status === UserStatus.Deleted) {
      throw new BadRequestException('Tài khoản không tồn tại');
    }
    if (user.status === UserStatus.Locked) {
      throw new BadRequestException('Tài khoản đã bị khoá');
    }

    const record = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, code: otp, purpose: 'register', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.otpCode.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
      }
      await tx.user.update({
        where: { id: user.id },
        data: { isVerified: true, status: UserStatus.Active },
      });
    });

    return { message: 'Xác thực thành công. Bạn có thể đăng nhập.' };
  }

  async login(email: string, plainPassword: string, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const valid = await this.password.verify(user.passwordHash, plainPassword);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Tài khoản chưa xác thực OTP');
    }
    if (user.status === UserStatus.Locked) {
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    }

    if (user.mfaEnabled) {
      const method = this.resolveMfaMethod(user.mfaMethod);
      const mfaToken = await this.signMfaToken(user.id);
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'user.login_mfa_challenge',
        entityType: 'identity.user',
        entityId: user.id,
        after: { email: user.email, mfaMethod: method },
        ip: meta.ip,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
      });

      if (method === MfaMethod.Totp) {
        return {
          kind: 'mfa',
          response: {
            mfaRequired: true,
            mfaToken,
            mfaMethod: MfaMethod.Totp,
            expiresIn: MFA_TOKEN_TTL_SEC,
            message: 'Nhập mã 6 số từ ứng dụng xác thực để hoàn tất đăng nhập.',
          },
        };
      }

      const otp = await this.issueOtp(
        user.id,
        user.email,
        user.tenantId,
        MFA_PURPOSE,
        meta.correlationId,
      );
      return {
        kind: 'mfa',
        response: {
          mfaRequired: true,
          mfaToken,
          mfaMethod: MfaMethod.EmailOtp,
          expiresIn: MFA_TOKEN_TTL_SEC,
          message: 'Đã gửi mã OTP tới email. Nhập mã để hoàn tất đăng nhập.',
          devOtp: this.devOtpOrUndefined(otp),
        },
      };
    }

    const session = await this.issueSession(user, meta);
    return { kind: 'tokens', ...session };
  }

  getGoogleAuthConfig(): GoogleAuthConfigResponse {
    const clientIds = this.config.get('googleAuth', { infer: true }).clientIds;
    return {
      enabled: clientIds.length > 0,
      clientId: clientIds[0] ?? null,
    };
  }

  private async verifyGoogleIdToken(idToken: string): Promise<{
    email: string;
    displayName: string;
    sub: string;
  }> {
    const clientIds = this.config.get('googleAuth', { infer: true }).clientIds;
    if (clientIds.length === 0) {
      throw new BadRequestException('Đăng nhập bằng Google chưa được cấu hình trên hệ thống.');
    }

    let res: globalThis.Response;
    try {
      res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        { signal: AbortSignal.timeout(8000) },
      );
    } catch (err) {
      this.logger.warn(`Không kết nối được Google tokeninfo: ${String(err)}`);
      throw new UnauthorizedException('Không thể xác thực tài khoản Google. Vui lòng thử lại.');
    }

    if (!res.ok) {
      throw new UnauthorizedException('Phiên Google không hợp lệ hoặc đã hết hạn.');
    }

    const payload = (await res.json()) as {
      aud?: string;
      iss?: string;
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      exp?: string | number;
    };

    if (!payload.aud || !clientIds.includes(payload.aud)) {
      throw new UnauthorizedException('Google Client ID không khớp với cấu hình hệ thống.');
    }
    if (
      payload.iss !== 'accounts.google.com' &&
      payload.iss !== 'https://accounts.google.com'
    ) {
      throw new UnauthorizedException('Nguồn xác thực Google không hợp lệ.');
    }
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    const email = (payload.email ?? '').toLowerCase().trim();
    if (!emailVerified || !email || !payload.sub) {
      throw new UnauthorizedException('Tài khoản Google chưa xác minh email.');
    }
    const expSec = Number(payload.exp ?? 0);
    if (!Number.isFinite(expSec) || expSec * 1000 <= Date.now()) {
      throw new UnauthorizedException('Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.');
    }

    const fallbackName = email.split('@')[0] || 'Thành viên inLink';
    const displayName = (payload.name ?? '').trim().slice(0, 120) || fallbackName;
    return { email, displayName, sub: payload.sub };
  }

  /**
   * Đăng nhập hoặc tự động tạo tài khoản (Candidate / Recruiter) qua Google Identity Services.
   * Tài khoản đã bật MFA vẫn phải đi qua bước xác thực MFA như đăng nhập thường.
   */
  async loginWithGoogle(
    input: { idToken: string; role?: UserRole.Candidate | UserRole.Recruiter },
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const profile = await this.verifyGoogleIdToken(input.idToken);
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });
    let isNewUser = false;

    if (user) {
      if (user.isDeleted || user.status === UserStatus.Deleted) {
        throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị xoá.');
      }
      if (user.status === UserStatus.Locked) {
        throw new UnauthorizedException('Tài khoản đã bị khoá.');
      }
      if (!user.isVerified) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true, status: UserStatus.Active },
        });
      }
    } else {
      isNewUser = true;
      const role =
        input.role === UserRole.Recruiter ? UserRole.Recruiter : UserRole.Candidate;
      const code = await this.codeGen.next('USR');
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await this.password.hash(randomPassword);

      user = await this.prisma.user.create({
        data: {
          code,
          tenantId: DEFAULT_TENANT_ID,
          email: profile.email,
          passwordHash,
          displayName: profile.displayName,
          role,
          status: UserStatus.Active,
          isVerified: true,
        },
      });

      if (role === UserRole.Recruiter) {
        try {
          await this.crm.recordReferralSignup({
            cookie: meta.referralCookie,
            userId: user.id,
            role: user.role,
            displayName: user.displayName,
            registeredAt: user.createdAt,
          });
        } catch (err) {
          this.logger.error(`Không ghi được đăng ký giới thiệu cho ${user.id}: ${String(err)}`);
        }
      }

      this.events.publish(
        createDomainEvent({
          name: DomainEvents.UserRegistered,
          tenantId: user.tenantId,
          correlationId: meta.correlationId,
          payload: {
            userId: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
        }),
      );
    }

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: isNewUser ? 'user.google_register' : 'user.google_login',
      entityType: 'identity.user',
      entityId: user.id,
      after: { email: user.email, role: user.role, provider: 'google' },
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    if (user.mfaEnabled) {
      const method = this.resolveMfaMethod(user.mfaMethod);
      const mfaToken = await this.signMfaToken(user.id);
      if (method === MfaMethod.Totp) {
        return {
          kind: 'mfa',
          response: {
            mfaRequired: true,
            mfaToken,
            mfaMethod: MfaMethod.Totp,
            expiresIn: MFA_TOKEN_TTL_SEC,
            message: 'Nhập mã 6 số từ ứng dụng xác thực để hoàn tất đăng nhập.',
          },
        };
      }
      const otp = await this.issueOtp(
        user.id,
        user.email,
        user.tenantId,
        MFA_PURPOSE,
        meta.correlationId,
      );
      return {
        kind: 'mfa',
        response: {
          mfaRequired: true,
          mfaToken,
          mfaMethod: MfaMethod.EmailOtp,
          expiresIn: MFA_TOKEN_TTL_SEC,
          message: 'Đã gửi mã OTP tới email. Nhập mã để hoàn tất đăng nhập.',
          devOtp: this.devOtpOrUndefined(otp),
        },
      };
    }

    const session = await this.issueSession(user, meta);
    return { kind: 'tokens', ...session };
  }

  async verifyLoginOtp(
    mfaToken: string,
    otp: string,
    meta: RequestMeta,
  ): Promise<{ response: LoginSuccessResponse; refreshToken: string }> {
    const userId = await this.verifyMfaToken(mfaToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isDeleted || !user.mfaEnabled) {
      throw new UnauthorizedException('Phiên MFA không hợp lệ');
    }
    if (user.status === UserStatus.Locked) {
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    }

    const method = this.resolveMfaMethod(user.mfaMethod);
    if (method === MfaMethod.Totp) {
      if (!user.totpSecret || !authenticator.verify({ token: otp, secret: user.totpSecret })) {
        throw new BadRequestException('Mã xác thực không đúng');
      }
    } else {
      const record = await this.prisma.otpCode.findFirst({
        where: { userId: user.id, code: otp, purpose: MFA_PURPOSE, consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!record || record.expiresAt < new Date()) {
        throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
      }

      const consumed = await this.prisma.otpCode.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
      }
    }

    return this.issueSession(user, meta);
  }

  async resendLoginOtp(
    mfaToken: string,
    meta: RequestMeta,
  ): Promise<{ message: string; devOtp?: string }> {
    const userId = await this.verifyMfaToken(mfaToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isDeleted || !user.mfaEnabled) {
      throw new UnauthorizedException('Phiên MFA không hợp lệ');
    }
    if (this.resolveMfaMethod(user.mfaMethod) === MfaMethod.Totp) {
      throw new BadRequestException(
        'Tài khoản đang dùng TOTP — hãy nhập mã trên ứng dụng xác thực, không cần gửi lại',
      );
    }

    const otp = await this.issueOtp(
      user.id,
      user.email,
      user.tenantId,
      MFA_PURPOSE,
      meta.correlationId,
    );
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'user.resend_login_otp',
      entityType: 'identity.user',
      entityId: user.id,
      after: { email: user.email },
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return {
      message: 'Đã gửi lại mã OTP tới email của bạn.',
      devOtp: this.devOtpOrUndefined(otp),
    };
  }

  /** Bật/tắt MFA qua email OTP. Bật sẽ ghi đè phương thức TOTP nếu đang dùng. */
  async setMfaEnabled(
    actor: AuthenticatedUser,
    enabled: boolean,
    meta: RequestMeta,
  ): Promise<AuthUserView> {
    const user = await this.prisma.user.update({
      where: { id: actor.id },
      data: {
        mfaEnabled: enabled,
        mfaMethod: enabled ? MfaMethod.EmailOtp : null,
        totpSecret: null,
        totpPendingSecret: null,
      },
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: enabled ? 'user.mfa_enable' : 'user.mfa_disable',
      entityType: 'identity.user',
      entityId: user.id,
      after: { mfaEnabled: enabled, mfaMethod: user.mfaMethod },
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return this.toAuthUserView(user);
  }

  /** Khởi tạo TOTP: sinh secret tạm + QR, chưa bật MFA (cần confirmTotp để xác nhận). */
  async setupTotp(actor: AuthenticatedUser): Promise<TotpSetupResponse> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(actor.email, TOTP_ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await this.prisma.user.update({
      where: { id: actor.id },
      data: { totpPendingSecret: secret },
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** Xác nhận TOTP bằng 1 mã đúng từ app xác thực → bật MFA phương thức TOTP. */
  async confirmTotp(
    actor: AuthenticatedUser,
    code: string,
    meta: RequestMeta,
  ): Promise<AuthUserView> {
    const record = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!record?.totpPendingSecret) {
      throw new BadRequestException('Chưa khởi tạo TOTP. Hãy quét QR trước khi xác nhận.');
    }
    if (!authenticator.verify({ token: code, secret: record.totpPendingSecret })) {
      throw new BadRequestException('Mã xác thực không đúng');
    }

    const user = await this.prisma.user.update({
      where: { id: actor.id },
      data: {
        mfaEnabled: true,
        mfaMethod: MfaMethod.Totp,
        totpSecret: record.totpPendingSecret,
        totpPendingSecret: null,
      },
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'user.totp_enable',
      entityType: 'identity.user',
      entityId: user.id,
      after: { mfaMethod: MfaMethod.Totp },
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return this.toAuthUserView(user);
  }

  /** Tắt hoàn toàn MFA (kể cả TOTP) — dùng nút "Tắt" ở /account. */
  async disableTotp(actor: AuthenticatedUser, meta: RequestMeta): Promise<AuthUserView> {
    const user = await this.prisma.user.update({
      where: { id: actor.id },
      data: { mfaEnabled: false, mfaMethod: null, totpSecret: null, totpPendingSecret: null },
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'user.totp_disable',
      entityType: 'identity.user',
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return this.toAuthUserView(user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: jwtCfg.refreshSecret });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: payload.jti, userId: payload.sub, revokedAt: null },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Tài khoản không hợp lệ');
    }
    if (user.status === UserStatus.Locked || user.status === UserStatus.Deleted) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    }

    // Xoay vòng atomic: chỉ 1 request thu hồi được token cũ để cấp cặp mới.
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) {
      throw new UnauthorizedException('Phiên đăng nhập đã được làm mới hoặc thu hồi');
    }

    const userView = this.toAuthUserView(user);
    const accessToken = await this.signAccessToken(userView, user.tenantId);
    const newRefresh = await this.issueRefreshToken(user.id, stored.createdByIp ?? undefined);

    return { accessToken, expiresIn: jwtCfg.accessTtl, refreshToken: newRefresh };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const jwtCfg = this.config.get('jwt', { infer: true });
    try {
      const payload = await this.jwt.verifyAsync<{ jti: string }>(refreshToken, {
        secret: jwtCfg.refreshSecret,
      });
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Token đã hỏng/hết hạn - coi như đã đăng xuất.
    }
  }

  async getProfile(user: AuthenticatedUser): Promise<AuthUserView> {
    const record = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!record) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }
    return this.toAuthUserView(record);
  }

  private async issueSession(
    user: {
      id: string;
      email: string;
      displayName: string;
      role: string;
      status: string;
      tenantId: string;
      mfaEnabled: boolean;
      mfaMethod: string | null;
    },
    meta: RequestMeta,
  ): Promise<{ response: LoginSuccessResponse; refreshToken: string }> {
    const userView = this.toAuthUserView(user);
    const accessToken = await this.signAccessToken(userView, user.tenantId);
    const refreshToken = await this.issueRefreshToken(user.id, meta.ip);

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.UserLoggedIn,
        tenantId: user.tenantId,
        correlationId: meta.correlationId,
        payload: { userId: user.id },
      }),
    );

    return {
      response: {
        mfaRequired: false,
        accessToken,
        expiresIn: this.config.get('jwt', { infer: true }).accessTtl,
        user: userView,
      },
      refreshToken,
    };
  }

  private toAuthUserView(user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
    mfaEnabled: boolean;
    mfaMethod: string | null;
  }): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as UserRole,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mfaMethod: user.mfaEnabled ? this.resolveMfaMethod(user.mfaMethod) : null,
    };
  }

  /** null (dữ liệu cũ trước khi có TOTP) mặc định coi là email_otp. */
  private resolveMfaMethod(mfaMethod: string | null): MfaMethod {
    return mfaMethod === MfaMethod.Totp ? MfaMethod.Totp : MfaMethod.EmailOtp;
  }

  private async signAccessToken(user: AuthUserView, tenantId: string): Promise<string> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId,
      displayName: user.displayName,
      status: user.status,
    };
    return this.jwt.signAsync(payload, {
      secret: jwtCfg.accessSecret,
      expiresIn: jwtCfg.accessTtl,
    });
  }

  private async signMfaToken(userId: string): Promise<string> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    const payload: MfaTokenPayload = { sub: userId, purpose: 'mfa_login' };
    return this.jwt.signAsync(payload, {
      secret: jwtCfg.accessSecret,
      expiresIn: MFA_TOKEN_TTL_SEC,
    });
  }

  private async verifyMfaToken(mfaToken: string): Promise<string> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    let payload: MfaTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<MfaTokenPayload>(mfaToken, {
        secret: jwtCfg.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Phiên MFA đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (payload.purpose !== 'mfa_login' || !payload.sub) {
      throw new UnauthorizedException('Phiên MFA không hợp lệ');
    }
    return payload.sub;
  }

  private async issueRefreshToken(userId: string, ip?: string): Promise<string> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    const jti = uuidv7();
    const expiresAt = new Date(Date.now() + jwtCfg.refreshTtl * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: jti, expiresAt, createdByIp: ip ?? null },
    });
    return this.jwt.signAsync(
      { sub: userId, jti },
      { secret: jwtCfg.refreshSecret, expiresIn: jwtCfg.refreshTtl },
    );
  }

  /** Thu hồi OTP cùng purpose chưa dùng, tạo mã mới, phát OtpIssued (không đưa OTP vào payload). */
  private async issueOtp(
    userId: string,
    email: string,
    tenantId: string,
    purpose: string,
    correlationId: string,
  ): Promise<string> {
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otp = this.generateOtp();
    await this.prisma.otpCode.create({
      data: {
        userId,
        code: otp,
        purpose,
        expiresAt: new Date(Date.now() + MFA_TOKEN_TTL_SEC * 1000),
      },
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.OtpIssued,
        tenantId,
        correlationId,
        payload: {
          userId,
          email,
          purpose,
        },
      }),
    );

    this.logger.log(`OTP purpose=${purpose} đã phát hành cho ${email}`);
    return otp;
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private devOtpOrUndefined(otp: string): string | undefined {
    const isProd = this.config.get('nodeEnv', { infer: true }) === 'production';
    return isProd ? undefined : otp;
  }

  /**
   * Kiểm tra điều kiện & ràng buộc trước khi đóng/xóa tài khoản (theo vai trò Ứng viên / NTD / CTV).
   */
  async getDeleteAccountStatus(
    user: AuthenticatedUser,
  ): Promise<AccountDeletionStatusResponse> {
    const role = user.role;
    const blockers: AccountDeletionBlocker[] = [];

    const internalRoles = new Set<string>([
      UserRole.SuperAdmin,
      'sales_staff',
      'cms_admin',
      'cms_editor',
    ]);
    if (internalRoles.has(role)) {
      blockers.push({
        code: 'INTERNAL_ROLE',
        message: 'Tài khoản quản trị nội bộ không thể tự xóa. Vui lòng liên hệ Quản trị viên hệ thống.',
      });
      return {
        canDelete: false,
        role,
        blockers,
        note: 'Tài khoản nội bộ do SuperAdmin quản lý.',
      };
    }

    const now = new Date();
    const isRecruiterRole =
      role === UserRole.Recruiter ||
      role === UserRole.HiringManager ||
      role === UserRole.CompanyAdmin;

    // 1. Kiểm tra ràng buộc doanh nghiệp (chỉ áp dụng nếu NTD là thành viên duy nhất của công ty)
    if (isRecruiterRole) {
      const membership = await this.prisma.companyMember.findFirst({
        where: { userId: user.id },
        select: { companyId: true },
      });
      if (membership) {
        const memberCount = await this.prisma.companyMember.count({
          where: { companyId: membership.companyId },
        });
        if (memberCount <= 1) {
          const [activePaidJobPkg, activeHuntPkg, creditAcc, pendingOrder] = await Promise.all([
            this.prisma.billingJobPackage.findFirst({
              where: {
                companyId: membership.companyId,
                packageType: { not: 'FREE' },
                status: { in: ['ACTIVE', 'UNUSED'] },
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
              },
              select: { id: true, packageName: true },
            }),
            this.prisma.billingHuntPackage.findFirst({
              where: {
                companyId: membership.companyId,
                status: { in: ['ACTIVE', 'UNUSED'] },
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
              },
              select: { id: true, packageName: true },
            }),
            this.prisma.billingCreditAccount.findUnique({
              where: { companyId: membership.companyId },
              select: { balance: true },
            }),
            this.prisma.billingOrder.findFirst({
              where: { companyId: membership.companyId, status: 'pending' },
              select: { id: true },
            }),
          ]);

          if (activePaidJobPkg) {
            blockers.push({
              code: 'ACTIVE_JOB_PACKAGE',
              message: `Doanh nghiệp đang có gói tin đăng trả phí (${activePaidJobPkg.packageName}) còn hiệu lực hoặc chờ kích hoạt.`,
            });
          }
          if (activeHuntPkg) {
            blockers.push({
              code: 'ACTIVE_HUNT_PACKAGE',
              message: `Doanh nghiệp đang có gói Săn nhân sự (${activeHuntPkg.packageName}) đang chạy hoặc chờ kích hoạt.`,
            });
          }
          if ((creditAcc?.balance ?? 0) > 0) {
            blockers.push({
              code: 'CREDIT_BALANCE',
              message: `Ví doanh nghiệp vẫn còn ${creditAcc!.balance} Credit khả dụng.`,
            });
          }
          if (pendingOrder) {
            blockers.push({
              code: 'PENDING_ORDER',
              message: 'Doanh nghiệp đang có đơn hàng chờ đối soát thanh toán.',
            });
          }
        }
      }
    }

    // 2. Kiểm tra ràng buộc Cộng tác viên (áp dụng cho mọi tài khoản đã kích hoạt CTV)
    const partner = await this.prisma.crmPartner.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (partner) {
      const pendingStatement = await this.prisma.ctvMonthlyStatement.findFirst({
        where: {
          ctvId: partner.id,
          status: { in: ['OPEN', 'RECONCILED'] },
          finalCommission: { gt: 0n },
        },
        select: { id: true, yearMonth: true },
      });
      if (pendingStatement) {
        blockers.push({
          code: 'PENDING_CTV_COMMISSION',
          message: `Bạn đang có kỳ hoa hồng Cộng tác viên (${pendingStatement.yearMonth}) chờ đối soát / chi trả.`,
        });
      }
    }

    const note =
      role === UserRole.Candidate
        ? 'Tài khoản sẽ bị khóa đăng nhập vĩnh viễn, ẩn danh thông tin cá nhân và gỡ khỏi kết quả tìm kiếm AI. Nếu bạn chỉ muốn tạm ngừng nhận lời mời từ Nhà tuyển dụng, hãy bật nút «Đã nhận việc» trên thanh tiêu đề thay vì xóa tài khoản.'
        : partner
          ? 'Tài khoản đăng nhập sẽ bị khóa mềm và ẩn thông tin cá nhân. Sổ cái hoa hồng CTV, chứng từ KYC/thuế, mã số thuế doanh nghiệp và hóa đơn đã phát sinh vẫn được lưu trữ theo Luật Kế toán & Thuế.'
          : 'Tài khoản cá nhân sẽ bị khóa mềm và ẩn thông tin liên hệ. Lịch sử mã số thuế, gói dịch vụ và hóa đơn doanh nghiệp được lưu trữ theo quy định kế toán và chống gian lận.';

    return {
      canDelete: blockers.length === 0,
      role,
      blockers,
      note,
    };
  }

  /**
   * Đóng / xóa mềm & ẩn danh hóa tài khoản cá nhân (tuân thủ NĐ 13/2023/NĐ-CP).
   * Không xóa cứng dữ liệu kế toán/thuế (hóa đơn, MST công ty, sổ cái hoa hồng CTV).
   */
  async deleteMyAccount(
    user: AuthenticatedUser,
    input: DeleteAccountRequest,
    meta: RequestMeta,
  ): Promise<{ message: string }> {
    const status = await this.getDeleteAccountStatus(user);
    if (!status.canDelete) {
      throw new BadRequestException(
        status.blockers[0]?.message ??
          'Tài khoản hiện còn ràng buộc dịch vụ hoặc tài chính, vui lòng liên hệ hotro@inlink.vn để được hỗ trợ.',
      );
    }

    if (input.confirmText.trim().toUpperCase() !== 'XOA TAI KHOAN') {
      throw new BadRequestException('Vui lòng nhập chính xác cụm từ XOA TAI KHOAN để xác nhận.');
    }

    const now = new Date();
    const anonEmail = `deleted_${user.id.slice(0, 8)}_${now.getTime()}@deleted.inlink.vn`;

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy: user.id,
          status: 'deleted',
          email: anonEmail,
          displayName: 'Tài khoản đã xóa',
          mfaEnabled: false,
          mfaMethod: null,
          totpSecret: null,
          totpPendingSecret: null,
          updatedBy: user.id,
        },
      });

      // Nếu có hồ sơ Ứng viên → khóa mềm, ẩn danh PII & gỡ khỏi chỉ mục tìm kiếm AI
      const candidate = await tx.candidate.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (candidate) {
        await tx.candidate.update({
          where: { id: candidate.id },
          data: {
            isDeleted: true,
            deletedAt: now,
            deletedBy: user.id,
            status: 'deleted',
            displayName: 'Ứng viên đã xóa',
            outreachEmailEnabled: false,
            avatarStorageKey: null,
            avatarMime: null,
            updatedBy: user.id,
          },
        });
        await tx.candidateProfile.updateMany({
          where: { candidateId: candidate.id },
          data: {
            phone: null,
            summary: null,
            careerObjective: null,
            salesHighlights: null,
          },
        });
        await tx.candidateSearchIndex.deleteMany({
          where: { candidateId: candidate.id },
        });
      }

      // Nếu là thành viên trong công ty có nhiều người → chỉ rời khỏi danh sách thành viên, giữ nguyên dữ liệu công ty
      const memberships = await tx.companyMember.findMany({
        where: { userId: user.id },
        select: { id: true, companyId: true },
      });
      for (const m of memberships) {
        const count = await tx.companyMember.count({ where: { companyId: m.companyId } });
        if (count > 1) {
          await tx.companyMember.delete({ where: { id: m.id } });
        }
      }
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'account.self_delete',
      entityType: 'user',
      entityId: user.id,
      after: {
        role: user.role,
        reason: input.reason?.trim() || null,
      },
      correlationId: meta.correlationId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    this.logger.log(`Người dùng ${user.id} (${user.role}) đã tự đóng/ẩn danh tài khoản.`);
    return { message: 'Tài khoản của bạn đã được đóng và ẩn danh hóa thành công.' };
  }
}
