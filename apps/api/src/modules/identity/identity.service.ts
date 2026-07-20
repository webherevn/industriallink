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
  type AuthUserView,
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
import type { AuthenticatedUser, JwtPayload } from '../../shared/security/security.types';

interface RequestMeta {
  correlationId: string;
  ip?: string;
  userAgent?: string;
}

type LoginResult =
  | { kind: 'tokens'; response: LoginSuccessResponse; refreshToken: string }
  | { kind: 'mfa'; response: LoginMfaChallengeResponse };

const MFA_PURPOSE = 'login';
const MFA_TOKEN_TTL_SEC = 10 * 60;
const TOTP_ISSUER = 'IndustrialLink';

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
    if (!user) {
      throw new BadRequestException('Tài khoản không tồn tại');
    }

    const record = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, code: otp, purpose: 'register', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    await this.prisma.$transaction([
      this.prisma.otpCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, status: UserStatus.Active },
      }),
    ]);

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

      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
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

    // Xoay vòng: thu hồi token cũ, cấp cặp mới.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

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
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private devOtpOrUndefined(otp: string): string | undefined {
    const isProd = this.config.get('nodeEnv', { infer: true }) === 'production';
    return isProd ? undefined : otp;
  }
}
