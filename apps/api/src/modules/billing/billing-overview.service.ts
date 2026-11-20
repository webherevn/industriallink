import { Injectable, Logger } from '@nestjs/common';
import type {
  RecruiterActiveHuntPackageView,
  RecruiterBillingOverview,
  RecruiterExpiringCreditLotView,
  RecruiterJobPackageView,
  RecruiterPendingPackageView,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/**
 * TỔNG QUAN GÓI DỊCH VỤ & VÍ CREDIT (recruiter billing hub).
 *
 * ⚠ NGUỒN SỰ THẬT — KHÔNG đọc số cộng dồn legacy:
 *  - Gói tin đăng : bảng `billing.billing_job_package`
 *  - Gói Săn     : bảng `billing.billing_hunt_package`
 *  - Ví Credit   : bảng `billing.billing_credit_account`
 *
 * `BillingCompanySourcingPlan` (bảng `assignment`) là dữ liệu CŨ, KHÔNG dùng ở đây.
 * Mỗi lần mua 1 gói = 1 bản ghi độc lập → mỗi gói Săn ACTIVE là 1 card riêng,
 * mỗi gói có hạn mức riêng, không cộng dồn vào 1 "gói Săn chung".
 */
@Injectable()
export class BillingOverviewService {
  private readonly logger = new Logger(BillingOverviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gom 1 lần đọc toàn bộ dữ liệu cho trang "Gói dịch vụ & Ví Credit".
   *
   * @param companyId công ty của NTD
   */
  async getOverview(companyId: string): Promise<RecruiterBillingOverview> {
    const now = new Date();

    const [jobPackageRows, huntPackageRows, account, expiringLot] = await Promise.all([
      this.prisma.billingJobPackage.findMany({
        where: { companyId },
        orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
        include: { plan: true, order: true },
      }),
      this.prisma.billingHuntPackage.findMany({
        where: { companyId },
        orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
        include: { plan: true, campaign: { select: { id: true, title: true } } },
      }),
      this.prisma.billingCreditAccount.findUnique({
        where: { companyId },
        select: {
          balance: true,
          lifetimeGranted: true,
          lifetimeConsumed: true,
        },
      }),
      // Chỉ lô `plan_grant` (gói Khám phá / Free) mới có hạn.
      // `package_grant` + `topup` GIỮ LẠI vô thời hạn → không hiển thị tag hạn.
      this.prisma.billingCreditLot.findFirst({
        where: {
          companyId,
          sourceType: 'plan',
          expiresAt: { not: null, gt: now },
        },
        orderBy: { expiresAt: 'asc' },
        select: { granted: true, consumed: true, expiresAt: true },
      }),
    ]);

    // ---- Gói tin đăng: ACTIVE (đang chạy) + UNUSED (chờ kích hoạt) ----
    const activeJobPackages: RecruiterJobPackageView[] = [];
    const pendingPackages: RecruiterPendingPackageView[] = [];

    for (const row of jobPackageRows) {
      const expired =
        row.status === 'ACTIVE' && row.expiresAt != null && row.expiresAt.getTime() < now.getTime();
      const activationExpired =
        row.status === 'UNUSED' &&
        row.activationDeadlineAt != null &&
        row.activationDeadlineAt.getTime() < now.getTime();

      if (row.status === 'ACTIVE' && !expired) {
        const totalJobs = row.totalJobs;
        const usedJobs = row.usedJobs;
        activeJobPackages.push({
          id: row.id,
          code: row.code,
          orderId: row.orderId,
          planCode: row.plan?.code ?? null,
          planName: row.packageName,
          packageType: row.packageType as RecruiterJobPackageView['packageType'],
          status: 'active',
          isCurrent: true,
          jobPostQuota: totalJobs,
          creditQuota: row.creditsIncluded > 0 ? row.creditsIncluded : null,
          displayDays: row.durationDays > 0 ? row.durationDays : null,
          jobsUsed: usedJobs,
          jobsRemaining:
            totalJobs == null ? null : Math.max(0, totalJobs - usedJobs),
          priceVnd: row.priceVnd.toString(),
          purchasedAt: row.purchasedAt.toISOString(),
          paidAt: row.order?.paidAt?.toISOString() ?? null,
          endsAt: row.expiresAt?.toISOString() ?? null,
          activationDeadlineAt: row.activationDeadlineAt?.toISOString() ?? null,
          activatedAt: row.activatedAt?.toISOString() ?? null,
          creditsGranted: row.creditsGranted,
          canActivate: false,
          canPostJob: totalJobs == null || usedJobs < totalJobs,
        });
      }

      if (row.status === 'UNUSED' && !activationExpired) {
        pendingPackages.push({
          id: row.id,
          code: row.code,
          packageName: row.packageName,
          kind: 'job',
          creditsIncluded: row.creditsIncluded,
          activationDeadlineAt: row.activationDeadlineAt?.toISOString() ?? null,
          purchasedAt: row.purchasedAt.toISOString(),
          // Gói tin đăng kích hoạt khi gắn vào 1 tin tuyển dụng.
          activateHref: '/recruiter/pricing',
        });
      }
    }

    // ---- Gói Săn: ACTIVE (đang chạy) + UNUSED (chờ kích hoạt) ----
    const activeHuntPackages: RecruiterActiveHuntPackageView[] = [];

    for (const row of huntPackageRows) {
      const expired =
        row.status === 'ACTIVE' && row.expiresAt != null && row.expiresAt.getTime() < now.getTime();
      const activationExpired =
        row.status === 'UNUSED' &&
        row.activationDeadlineAt != null &&
        row.activationDeadlineAt.getTime() < now.getTime();

      if (row.status === 'ACTIVE' && !expired) {
        // 1 gói Săn = 1 chiến dịch = 1 vị trí.
        const campaignId = row.campaign?.id ?? null;
        const positionsUsed = campaignId ? 1 : 0;
        activeHuntPackages.push({
          id: row.id,
          code: row.code,
          packageName: row.packageName,
          packageType: row.packageType as RecruiterActiveHuntPackageView['packageType'],
          positionsUsed,
          positionsTotal: 1,
          creditsIncluded: row.creditsIncluded,
          creditsGranted: row.creditsGranted,
          usedCriteriaEdits: row.usedCriteriaEdits,
          totalCriteriaEdits: row.totalCriteriaEdits,
          usedReports: row.usedReports,
          totalReports: row.totalReports,
          usedHandovers: row.usedHandovers,
          totalHandovers: row.totalHandovers,
          purchasedAt: row.purchasedAt.toISOString(),
          activatedAt: row.activatedAt?.toISOString() ?? null,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          campaignId,
          campaignTitle: row.campaign?.title ?? null,
        });
      }

      if (row.status === 'UNUSED' && !activationExpired) {
        pendingPackages.push({
          id: row.id,
          code: row.code,
          packageName: row.packageName,
          kind: 'hunt',
          creditsIncluded: row.creditsIncluded,
          activationDeadlineAt: row.activationDeadlineAt?.toISOString() ?? null,
          purchasedAt: row.purchasedAt.toISOString(),
          // Gói Săn kích hoạt khi tạo chiến dịch Săn.
          activateHref: '/recruiter/sourcing',
        });
      }
    }

    // ---- Lô Credit miễn phí sắp hết hạn (chỉ `plan_grant`) ----
    let expiring: RecruiterExpiringCreditLotView | null = null;
    if (expiringLot?.expiresAt) {
      const available = Math.max(0, expiringLot.granted - expiringLot.consumed);
      if (available > 0) {
        expiring = {
          available,
          expiresAt: expiringLot.expiresAt.toISOString(),
        };
      }
    }

    return {
      activeJobPackages,
      activeHuntPackages,
      pendingPackages,
      creditBalance: account?.balance ?? 0,
      lifetimeGranted: account?.lifetimeGranted ?? 0,
      lifetimeConsumed: account?.lifetimeConsumed ?? 0,
      expiringLot: expiring,
    };
  }
}
