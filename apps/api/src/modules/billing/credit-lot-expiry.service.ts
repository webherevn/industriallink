import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VN_TIME_ZONE } from '../../shared/domain/vn-date.util';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/**
 * Thu hồi lô Credit đã HẾT HẠN + đồng bộ `billing_credit_account.balance`.
 *
 * Nguồn sự thật của số dư = TỔNG LÔ còn khả dụng (`granted - consumed`, lô còn hạn).
 * `balance` chỉ là bản cache → cron này đảm bảo 2 nguồn luôn khớp tuyệt đối
 * (tránh hiển thị "còn 20 Credit" trong khi thực tế không dùng được).
 *
 * ⚠ Credit từ `package_grant` / `topup` / `manual_grant` có `expiresAt = NULL`
 * → không bao giờ bị thu hồi. Chỉ lô của gói Khám phá (`source_type = 'plan'`) mới có hạn.
 */
@Injectable()
export class CreditLotExpiryService {
    private readonly logger = new Logger(CreditLotExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Chạy lúc 01:05 hằng ngày (giờ VN) — sau khi job-expiry đã đóng tin hết hạn. */
  @Cron('5 1 * * *', { timeZone: VN_TIME_ZONE })
  async expireLotsAndSyncBalances(): Promise<{ expiredLots: number; syncedCompanies: number }> {
    const now = new Date();

    // 1) Đánh dấu lô hết hạn là đã tiêu hết (consumed = granted) → không còn khả dụng.
    const expired = await this.prisma.billingCreditLot.findMany({
      where: { expiresAt: { not: null, lt: now } },
      select: { id: true, granted: true, consumed: true, companyId: true, accountId: true },
      take: 1000,
    });

    let expiredLots = 0;
    for (const lot of expired) {
      const available = Math.max(0, lot.granted - lot.consumed);
      if (available <= 0) continue;
      await this.prisma.billingCreditLot.update({
        where: { id: lot.id },
        data: { consumed: lot.granted },
      });
      expiredLots += 1;
    }

    // 2) Đồng bộ balance của các công ty bị ảnh hưởng.
    const companyIds = Array.from(new Set(expired.map((l) => l.companyId)));
    let syncedCompanies = 0;
    for (const companyId of companyIds) {
      const changed = await this.syncBalance(companyId, now);
      if (changed) syncedCompanies += 1;
    }

    if (expiredLots > 0 || syncedCompanies > 0) {
      this.logger.log(
        `Thu hồi lô Credit hết hạn: ${expiredLots} lô, đồng bộ balance ${syncedCompanies} công ty.`,
      );
    }
    return { expiredLots, syncedCompanies };
  }

  /**
   * Đặt `balance` = tổng lô còn khả dụng (lô chưa hết hạn).
   * Trả về true nếu có thay đổi.
   */
  private async syncBalance(companyId: string, now: Date): Promise<boolean> {
    const account = await this.prisma.billingCreditAccount.findUnique({
      where: { companyId },
      select: { id: true, balance: true },
    });
    if (!account) return false;

    const totalLotsCount = await this.prisma.billingCreditLot.count({ where: { companyId } });
    if (totalLotsCount === 0) return false;

    const agg = await this.prisma.billingCreditLot.aggregate({
      where: { companyId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      _sum: { granted: true, consumed: true },
    });
    const grantedTotal = Number(agg._sum.granted ?? 0);
    const available = Math.max(0, grantedTotal - Number(agg._sum.consumed ?? 0));
    if (available === account.balance) return false;

    await this.prisma.billingCreditAccount.update({
      where: { id: account.id },
      data: { balance: available, lastActivityAt: now },
    });
    this.logger.warn(
      `Đồng bộ Credit công ty ${companyId}: balance ${account.balance} → ${available} (khớp tổng lô còn hạn).`,
    );
    return true;
  }
}
