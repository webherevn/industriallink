import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { MfaMethod, UserStatus } from '@industriallink/contracts';
import { authenticator } from 'otplib';
import { IdentityService } from './identity.service';

describe('IdentityService', () => {
  const events = { publish: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const codeGen = { next: jest.fn().mockResolvedValue('USR-2026-000001') };
  const password = {
    hash: jest.fn().mockResolvedValue('hashed-pw'),
    verify: jest.fn().mockResolvedValue(true),
  };
  const jwtCfg = {
    accessSecret: 'access-secret',
    refreshSecret: 'refresh-secret',
    accessTtl: 900,
    refreshTtl: 1209600,
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'jwt') return jwtCfg;
      if (key === 'nodeEnv') return 'test';
      return undefined;
    }),
  };
  const jwt = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    password.hash.mockClear();
    password.verify.mockClear().mockResolvedValue(true);
    jwt.signAsync.mockClear().mockImplementation(async (payload: Record<string, unknown>) => {
      if ('jti' in payload) return `refresh-token-${String(payload.jti)}`;
      if (payload.purpose === 'mfa_login') return 'mfa-token-abc';
      return 'access-token-abc';
    });
    jwt.verifyAsync.mockClear();
    return new IdentityService(
      prisma as never,
      password as never,
      jwt as never,
      config as never,
      codeGen as never,
      events as never,
      audit as never,
    );
  }

  const meta = { correlationId: 'corr-1', ip: '127.0.0.1', userAgent: 'jest' };

  const baseUser = {
    id: 'user-1',
    email: 'a@abc.com',
    displayName: 'Nguyễn A',
    role: 'candidate',
    status: UserStatus.Active,
    tenantId: 'default',
    passwordHash: 'hashed-pw',
    isVerified: true,
    isDeleted: false,
    mfaEnabled: false,
    mfaMethod: null as string | null,
    totpSecret: null as string | null,
    totpPendingSecret: null as string | null,
  };

  describe('register', () => {
    it('tạo user mới, phát OtpIssued + UserRegistered, trả devOtp ở non-prod', async () => {
      const create = jest.fn().mockResolvedValue({ ...baseUser, isVerified: false, status: UserStatus.Created });
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(null), create },
        otpCode: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({}) },
      };
      const service = buildService(prisma);

      const result = await service.register(
        { email: 'a@abc.com', password: 'Secret123!', displayName: 'Nguyễn A', role: 'candidate' as never },
        meta,
      );

      expect(result.devOtp).toMatch(/^\d{6}$/);
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).toContain('identity.UserRegistered.v1');
      expect(eventNames).toContain('identity.OtpIssued.v1');
    });

    it('ném ConflictException nếu email đã tồn tại', async () => {
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(baseUser) } };
      const service = buildService(prisma);

      await expect(
        service.register(
          { email: 'a@abc.com', password: 'Secret123!', displayName: 'A', role: 'candidate' as never },
          meta,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('ném UnauthorizedException nếu tài khoản không tồn tại', async () => {
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(service.login('missing@abc.com', 'pw', meta)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('ném UnauthorizedException nếu sai mật khẩu', async () => {
      password.verify.mockResolvedValueOnce(false);
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(baseUser) } };
      const service = buildService(prisma);
      password.verify.mockResolvedValue(false);

      await expect(service.login('a@abc.com', 'wrong', meta)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('ném UnauthorizedException nếu chưa xác thực OTP', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ ...baseUser, isVerified: false }) },
      };
      const service = buildService(prisma);

      await expect(service.login('a@abc.com', 'Secret123!', meta)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('ném UnauthorizedException nếu tài khoản bị khoá', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ ...baseUser, status: UserStatus.Locked }) },
      };
      const service = buildService(prisma);

      await expect(service.login('a@abc.com', 'Secret123!', meta)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('đăng nhập thành công khi MFA tắt → trả token, phát UserLoggedIn', async () => {
      const refreshCreate = jest.fn().mockResolvedValue({});
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(baseUser) },
        refreshToken: { create: refreshCreate },
      };
      const service = buildService(prisma);

      const result = await service.login('a@abc.com', 'Secret123!', meta);

      expect(result.kind).toBe('tokens');
      if (result.kind === 'tokens') {
        expect(result.response.mfaRequired).toBe(false);
        expect(result.response.accessToken).toBe('access-token-abc');
      }
      expect(refreshCreate).toHaveBeenCalledTimes(1);
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).toContain('identity.UserLoggedIn.v1');
    });

    it('đăng nhập với MFA bật → trả challenge OTP, không phát UserLoggedIn', async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ ...baseUser, mfaEnabled: true }) },
        otpCode: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({}) },
      };
      const service = buildService(prisma);

      const result = await service.login('a@abc.com', 'Secret123!', meta);

      expect(result.kind).toBe('mfa');
      if (result.kind === 'mfa') {
        expect(result.response.mfaRequired).toBe(true);
        expect(result.response.mfaToken).toBe('mfa-token-abc');
        expect(result.response.devOtp).toMatch(/^\d{6}$/);
      }
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).not.toContain('identity.UserLoggedIn.v1');
    });
  });

  describe('verifyLoginOtp', () => {
    it('hoàn tất đăng nhập khi OTP hợp lệ', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'mfa_login' });
      const consumeUpdate = jest.fn().mockResolvedValue({});
      const refreshCreate = jest.fn().mockResolvedValue({});
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ ...baseUser, mfaEnabled: true }) },
        otpCode: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'otp-1',
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: consumeUpdate,
        },
        refreshToken: { create: refreshCreate },
      };
      const service = buildService(prisma);

      const result = await service.verifyLoginOtp('mfa-token-abc', '123456', meta);

      expect(result.response.mfaRequired).toBe(false);
      expect(consumeUpdate).toHaveBeenCalledTimes(1);
    });

    it('ném BadRequestException nếu OTP không hợp lệ/hết hạn', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'mfa_login' });
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ ...baseUser, mfaEnabled: true }) },
        otpCode: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const service = buildService(prisma);

      await expect(service.verifyLoginOtp('mfa-token-abc', '000000', meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('ném UnauthorizedException nếu phiên MFA đã hết hạn/không hợp lệ', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('expired'));
      const prisma = { user: { findUnique: jest.fn() } };
      const service = buildService(prisma);

      await expect(service.verifyLoginOtp('bad-token', '123456', meta)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('setMfaEnabled', () => {
    it('bật MFA cho user và ghi audit', async () => {
      const update = jest.fn().mockResolvedValue({ ...baseUser, mfaEnabled: true });
      const prisma = { user: { update } };
      const service = buildService(prisma);

      const result = await service.setMfaEnabled(
        { id: 'user-1', email: 'a@abc.com', role: 'candidate' as never, tenantId: 'default', displayName: 'A', status: 'active' },
        true,
        meta,
      );

      expect(result.mfaEnabled).toBe(true);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.mfa_enable' }));
    });
  });

  describe('refresh', () => {
    it('xoay vòng refresh token thành công', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      const revoke = jest.fn().mockResolvedValue({});
      const create = jest.fn().mockResolvedValue({});
      const prisma = {
        refreshToken: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'rt-1',
            expiresAt: new Date(Date.now() + 60_000),
            createdByIp: '127.0.0.1',
          }),
          update: revoke,
          create,
        },
        user: { findUnique: jest.fn().mockResolvedValue(baseUser) },
      };
      const service = buildService(prisma);

      const result = await service.refresh('old-refresh-token');

      expect(result.accessToken).toBe('access-token-abc');
      expect(revoke).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' } }),
      );
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('ném UnauthorizedException nếu refresh token đã hết hạn/thu hồi', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
      const prisma = {
        refreshToken: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const service = buildService(prisma);

      await expect(service.refresh('old-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('ném UnauthorizedException nếu token không hợp lệ (verify lỗi)', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));
      const service = buildService({});

      await expect(service.refresh('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('setupTotp / confirmTotp / disableTotp', () => {
    it('setupTotp sinh secret + QR, lưu vào totpPendingSecret', async () => {
      const update = jest.fn().mockResolvedValue({});
      const prisma = { user: { update } };
      const service = buildService(prisma);
      const actor = {
        id: 'user-1',
        email: 'a@abc.com',
        role: 'candidate' as never,
        tenantId: 'default',
        displayName: 'A',
        status: 'active',
      };

      const result = await service.setupTotp(actor);

      expect(result.secret).toBeTruthy();
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { totpPendingSecret: result.secret },
      });
    });

    it('confirmTotp bật MFA TOTP khi mã đúng', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const update = jest
        .fn()
        .mockResolvedValue({ ...baseUser, mfaEnabled: true, mfaMethod: MfaMethod.Totp });
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ ...baseUser, totpPendingSecret: secret }),
          update,
        },
      };
      const service = buildService(prisma);
      const actor = {
        id: 'user-1',
        email: 'a@abc.com',
        role: 'candidate' as never,
        tenantId: 'default',
        displayName: 'A',
        status: 'active',
      };

      const result = await service.confirmTotp(actor, validCode, meta);

      expect(result.mfaMethod).toBe(MfaMethod.Totp);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mfaEnabled: true,
            mfaMethod: MfaMethod.Totp,
            totpSecret: secret,
            totpPendingSecret: null,
          }),
        }),
      );
    });

    it('confirmTotp ném BadRequestException nếu chưa setup', async () => {
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(baseUser) } };
      const service = buildService(prisma);
      const actor = {
        id: 'user-1',
        email: 'a@abc.com',
        role: 'candidate' as never,
        tenantId: 'default',
        displayName: 'A',
        status: 'active',
      };

      await expect(service.confirmTotp(actor, '123456', meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('confirmTotp ném BadRequestException nếu mã sai', async () => {
      const secret = authenticator.generateSecret();
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ ...baseUser, totpPendingSecret: secret }) },
      };
      const service = buildService(prisma);
      const actor = {
        id: 'user-1',
        email: 'a@abc.com',
        role: 'candidate' as never,
        tenantId: 'default',
        displayName: 'A',
        status: 'active',
      };

      await expect(service.confirmTotp(actor, '000000', meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('disableTotp tắt hoàn toàn MFA', async () => {
      const update = jest
        .fn()
        .mockResolvedValue({ ...baseUser, mfaEnabled: false, mfaMethod: null });
      const prisma = { user: { update } };
      const service = buildService(prisma);
      const actor = {
        id: 'user-1',
        email: 'a@abc.com',
        role: 'candidate' as never,
        tenantId: 'default',
        displayName: 'A',
        status: 'active',
      };

      const result = await service.disableTotp(actor, meta);

      expect(result.mfaEnabled).toBe(false);
      expect(result.mfaMethod).toBeNull();
    });
  });

  describe('login / verifyLoginOtp với phương thức TOTP', () => {
    it('login trả challenge mfaMethod=totp, không gửi email OTP', async () => {
      const prisma = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ ...baseUser, mfaEnabled: true, mfaMethod: MfaMethod.Totp, totpSecret: 'ABC' }),
        },
      };
      const service = buildService(prisma);

      const result = await service.login('a@abc.com', 'Secret123!', meta);

      expect(result.kind).toBe('mfa');
      if (result.kind === 'mfa') {
        expect(result.response.mfaMethod).toBe(MfaMethod.Totp);
        expect(result.response.devOtp).toBeUndefined();
      }
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).not.toContain('identity.OtpIssued.v1');
    });

    it('verifyLoginOtp xác thực bằng mã TOTP thật', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'mfa_login' });
      const refreshCreate = jest.fn().mockResolvedValue({});
      const prisma = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ ...baseUser, mfaEnabled: true, mfaMethod: MfaMethod.Totp, totpSecret: secret }),
        },
        refreshToken: { create: refreshCreate },
      };
      const service = buildService(prisma);

      const result = await service.verifyLoginOtp('mfa-token-abc', validCode, meta);

      expect(result.response.mfaRequired).toBe(false);
      expect(refreshCreate).toHaveBeenCalledTimes(1);
    });

    it('verifyLoginOtp ném BadRequestException nếu mã TOTP sai', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'mfa_login' });
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            ...baseUser,
            mfaEnabled: true,
            mfaMethod: MfaMethod.Totp,
            totpSecret: authenticator.generateSecret(),
          }),
        },
      };
      const service = buildService(prisma);

      await expect(service.verifyLoginOtp('mfa-token-abc', '000000', meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('resendLoginOtp ném BadRequestException khi phương thức là TOTP', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'mfa_login' });
      const prisma = {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ ...baseUser, mfaEnabled: true, mfaMethod: MfaMethod.Totp }),
        },
      };
      const service = buildService(prisma);

      await expect(service.resendLoginOtp('mfa-token-abc', meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('logout', () => {
    it('thu hồi refresh token khi hợp lệ', async () => {
      jwt.verifyAsync.mockResolvedValue({ jti: 'jti-1' });
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { refreshToken: { updateMany } };
      const service = buildService(prisma);

      await service.logout('some-refresh-token');

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: 'jti-1', revokedAt: null } }),
      );
    });

    it('không làm gì nếu thiếu refresh token', async () => {
      const service = buildService({});
      await expect(service.logout(undefined)).resolves.toBeUndefined();
    });
  });
});
