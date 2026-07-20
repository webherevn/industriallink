import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/**
 * Dọn dữ liệu auth hết hạn: refresh token đã revoke/hết hạn quá lâu,
 * OTP đã dùng/hết hạn quá lâu. Chạy hằng ngày, không ảnh hưởng luồng chính.
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredAuthData(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [refreshTokens, otpCodes] = await Promise.all([
      this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
        },
      }),
      this.prisma.otpCode.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: cutoff } }, { consumedAt: { lt: cutoff } }],
        },
      }),
    ]);

    if (refreshTokens.count > 0 || otpCodes.count > 0) {
      this.logger.log(
        `Đã dọn refreshToken=${refreshTokens.count}, otpCode=${otpCodes.count} (cutoff=${cutoff.toISOString()})`,
      );
    }
  }
}
