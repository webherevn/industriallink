import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type BillingJobPackage } from '@prisma/client';
import type {
  RecruiterJobPackageListResponse,
  RecruiterJobPackageStatus,
  RecruiterJobPackageSummary,
  RecruiterJobPackageType,
  RecruiterJobPackageView,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

/** Tiền tố mã gói theo loại: JD-ST (Tin đăng), JD-PL (Plus), JD-DN (Doanh nghiệp), JD-FR (Khám phá). */
const PACKAGE_PREFIX: Record<RecruiterJobPackageType, string> = {
  FREE: 'FR',
  STANDARD: 'ST',
  PLUS: 'PL',
  ENTERPRISE: 'DN',
};

/** Mã gói nền tảng → loại gói tin đăng. */
const PLAN_PACKAGE_TYPE: Record<string, RecruiterJobPackageType> = {
  KHAM_PHA: 'FREE',
  TIN_DANG: 'STANDARD',
  TIN_DANG_PLUS: 'PLUS',
  DOANH_NGHIEP: 'ENTERPRISE',
  ENTERPRISE: 'ENTERPRISE',
};

/** Gói kích hoạt ngay sau khi thanh toán (gói thuê bao + gói khám phá). */
const AUTO_ACTIVATE_PLANS = new Set(['KHAM_PHA', 'DOANH_NGHIEP', 'ENTERPRISE']);

/**
 * Gói lẻ: mỗi lần mua = 1 gói tin đăng độc lập, kích hoạt thủ công.
 * Credit cấp khi bấm "Sử dụng gói này", không cấp lúc thanh toán.
 */
const ONE_OFF_PLANS = new Set(['TIN_DANG', 'TIN_DANG_PLUS']);

/** Hạn cuối để kích hoạt gói UNUSED (ngày). */
const ACTIVATION_DEADLINE_DAYS = 30;

/** Thứ tự ưu tiên gói (cao hơn = quyền lợi nhiều hơn). */
export const PACKAGE_TIER: Record<RecruiterJobPackageType, number> = {
  FREE: 0,
  STANDARD: 1,
  PLUS: 2,
  ENTERPRISE: 3,
};

function addUtcDays(from: Date, days: number): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

/**
 * Quản lý gói tin đăng (multi-active).
 *
 * Mỗi lần mua 1 gói nền tảng = 1 bản ghi `BillingJobPackage` độc lập.
 * Nhiều gói có thể cùng ACTIVE; mỗi gói dùng lượt đăng cho 1 tin riêng (Job.jobPackageId).
 */
@Injectable()
export class JobPackageService {
  private readonly logger = new Logger(JobPackageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Loại gói theo mã gói nền tảng. */
  packageTypeForPlan(planCode: string | null | undefined): RecruiterJobPackageType {
    if (!planCode) return 'FREE';
    return PLAN_PACKAGE_TYPE[planCode] ?? 'STANDARD';
  }

  /** Gói này có kích hoạt ngay sau khi thanh toán không (gói thuê bao + khám phá). */
  isAutoActivate(planCode: string | null | undefined): boolean {
    if (!planCode) return false;
    return AUTO_ACTIVATE_PLANS.has(planCode);
  }

  /**
   * Gói lẻ (Tin đăng / Tin đăng Plus) — mua nhiều lần tạo nhiều gói độc lập.
   *
   * Gói lẻ KHÔNG cấp Credit lúc thanh toán; Credit cấp khi NTD bấm "Sử dụng gói này".
   */
  isOneOffPlan(planCode: string | null | undefined): boolean {
    if (!planCode) return false;
    return ONE_OFF_PLANS.has(planCode);
  }

  /**
   * Tạo 1 gói tin đăng mới cho đơn đã trả.
   *
   * - Gói lẻ (Tin đăng / Tin đăng Plus): trạng thái `UNUSED`, chưa cấp Credit,
   *   đặt hạn kích hoạt = ngày mua + 30 ngày.
   * - Gói thuê bao (Doanh nghiệp) hoặc Khám phá: `ACTIVE` ngay, Credit đã cấp lúc thanh toán.
   */
  async createForOrder(input: {
    orderId: string;
    companyId: string;
    tenantId: string;
    planCode: string | null;
    planName: string | null;
    planId: string | null;
    jobPostQuota: number | null;
    creditQuota: number | null;
    durationDays: number | null;
    priceVnd: bigint;
    paidAt: Date | null;
  }): Promise<BillingJobPackage | null> {
    const packageType = this.packageTypeForPlan(input.planCode);
    const autoActivate = this.isAutoActivate(input.planCode);
    const now = input.paidAt ?? new Date();
    const durationDays = input.durationDays && input.durationDays > 0 ? input.durationDays : 30;

    const code = await this.nextCode(packageType);
    return this.prisma.billingJobPackage.create({
      data: {
        code,
        companyId: input.companyId,
        orderId: input.orderId,
        planId: input.planId,
        packageType,
        packageName: input.planName ?? 'Gói tin đăng',
        status: autoActivate ? 'ACTIVE' : 'UNUSED',
        totalJobs: input.jobPostQuota,
        usedJobs: 0,
        creditsIncluded: input.creditQuota ?? 0,
        durationDays,
        activationDeadlineAt: autoActivate ? null : addUtcDays(now, ACTIVATION_DEADLINE_DAYS),
        activatedAt: autoActivate ? now : null,
        expiresAt: autoActivate ? addUtcDays(now, durationDays) : null,
        // Gói kích hoạt ngay: Credit đã cấp lúc thanh toán → đánh dấu luôn để không cấp lại.
        creditsGranted: autoActivate,
        priceVnd: input.priceVnd,
        purchasedAt: now,
      },
    });
  }

  /** Sinh mã gói kế tiếp theo loại: JD-ST-000001, JD-PL-000001… */
  private async nextCode(packageType: RecruiterJobPackageType): Promise<string> {
    const prefix = PACKAGE_PREFIX[packageType];
    const latest = await this.prisma.billingJobPackage.findFirst({
      where: { code: { startsWith: `JD-${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const m = latest?.code.match(/(\d+)$/);
    const next = m ? Number(m[1]) + 1 : 1;
    return `JD-${prefix}-${String(next).padStart(6, '0')}`;
  }

  /**
   * Danh sách gói tin đăng của công ty + tổng hợp tài nguyên.
   *
   * Đồng bộ trạng thái trước khi trả về: gói UNUSED quá hạn kích hoạt → EXPIRED,
   * gói ACTIVE quá hạn → EXPIRED (nhưng tin đã đăng vẫn chạy tới hạn riêng).
   */
  async listForCompany(companyId: string): Promise<RecruiterJobPackageListResponse> {
    await this.syncExpiredPackages(companyId);

    const rows = await this.prisma.billingJobPackage.findMany({
      where: { companyId },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      include: { plan: true, order: true },
    });

    const now = new Date();
    const items: RecruiterJobPackageView[] = rows.map((row) => {
      const status = this.mapStatus(row, now);
      const totalJobs = row.totalJobs;
      const usedJobs = row.usedJobs;
      const jobsRemaining =
        status !== 'active' ? null : totalJobs == null ? null : Math.max(0, totalJobs - usedJobs);
      const canActivate =
        status === 'unused' &&
        (row.activationDeadlineAt == null || row.activationDeadlineAt.getTime() >= now.getTime());
      const canPostJob = status === 'active' && (totalJobs == null || usedJobs < totalJobs);

      return {
        id: row.id,
        code: row.code,
        orderId: row.orderId,
        planCode: row.plan?.code ?? null,
        planName: row.packageName,
        packageType: row.packageType as RecruiterJobPackageType,
        status,
        isCurrent: status === 'active',
        jobPostQuota: totalJobs,
        creditQuota: row.creditsIncluded > 0 ? row.creditsIncluded : null,
        displayDays: row.durationDays > 0 ? row.durationDays : null,
        jobsUsed: usedJobs,
        jobsRemaining,
        priceVnd: row.priceVnd.toString(),
        purchasedAt: row.purchasedAt.toISOString(),
        paidAt: row.order?.paidAt?.toISOString() ?? null,
        endsAt: row.expiresAt?.toISOString() ?? null,
        activationDeadlineAt: row.activationDeadlineAt?.toISOString() ?? null,
        activatedAt: row.activatedAt?.toISOString() ?? null,
        creditsGranted: row.creditsGranted,
        canActivate,
        canPostJob,
      };
    });

    return { items, total: items.length, summary: this.buildSummary(items) };
  }

  /**
   * Tóm tắt gói tin đăng cho entitlements (quota đăng tin, số ngày hiển thị).
   *
   * Nguồn sự thật = các gói ACTIVE của công ty. Nếu công ty chưa có gói ACTIVE
   * (VD mới đăng ký, gói Khám phá) → trả `null` để caller fallback về BillingCompanyPlan.
   */
  async activeSummary(companyId: string): Promise<{
    activePackages: BillingJobPackage[];
    summary: RecruiterJobPackageSummary;
  } | null> {
    const now = new Date();
    const rows = await this.prisma.billingJobPackage.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { activatedAt: 'asc' }],
      include: { plan: true, order: true },
    });
    if (rows.length === 0) return null;

    const items: RecruiterJobPackageView[] = rows.map((row) => {
      const totalJobs = row.totalJobs;
      const usedJobs = row.usedJobs;
      return {
        id: row.id,
        code: row.code,
        orderId: row.orderId,
        planCode: row.plan?.code ?? null,
        planName: row.packageName,
        packageType: row.packageType as RecruiterJobPackageType,
        status: 'active' as const,
        isCurrent: true,
        jobPostQuota: totalJobs,
        creditQuota: row.creditsIncluded > 0 ? row.creditsIncluded : null,
        displayDays: row.durationDays > 0 ? row.durationDays : null,
        jobsUsed: usedJobs,
        jobsRemaining: totalJobs == null ? null : Math.max(0, totalJobs - usedJobs),
        priceVnd: row.priceVnd.toString(),
        purchasedAt: row.purchasedAt.toISOString(),
        paidAt: row.order?.paidAt?.toISOString() ?? null,
        endsAt: row.expiresAt?.toISOString() ?? null,
        activationDeadlineAt: row.activationDeadlineAt?.toISOString() ?? null,
        activatedAt: row.activatedAt?.toISOString() ?? null,
        creditsGranted: row.creditsGranted,
        canActivate: false,
        canPostJob: totalJobs == null || usedJobs < totalJobs,
      };
    });

    return { activePackages: rows, summary: this.buildSummary(items) };
  }

  /** Tổng hợp KPI "Tài nguyên tin đăng" — query trực tiếp từ các gói. */
  private buildSummary(items: RecruiterJobPackageView[]): RecruiterJobPackageSummary {
    const active = items.filter((i) => i.status === 'active');
    const unused = items.filter((i) => i.status === 'unused');

    // Tổng lượt còn lại = SUM(totalJobs - usedJobs) của gói ACTIVE + UNUSED.
    let remaining = 0;
    let unlimited = false;
    for (const item of [...active, ...unused]) {
      if (item.jobPostQuota == null) {
        unlimited = true;
        continue;
      }
      remaining += Math.max(0, item.jobPostQuota - (item.jobsUsed ?? 0));
    }

    // Số ngày còn lại của gói ACTIVE hết hạn sớm nhất.
    let daysRemaining: number | null = null;
    for (const item of active) {
      if (!item.endsAt) continue;
      const days = Math.ceil((new Date(item.endsAt).getTime() - Date.now()) / 86_400_000);
      if (daysRemaining == null || days < daysRemaining) daysRemaining = days;
    }

    // Gói cấp cao nhất đang ACTIVE.
    let top: RecruiterJobPackageView | null = null;
    for (const item of active) {
      if (
        !top ||
        PACKAGE_TIER[item.packageType] > PACKAGE_TIER[top.packageType]
      ) {
        top = item;
      }
    }

    return {
      totalPackages: items.length,
      activePackages: active.length,
      unusedPackages: unused.length,
      jobsRemaining: unlimited ? null : remaining,
      daysRemaining: daysRemaining == null ? null : Math.max(0, daysRemaining),
      topPackageName: top?.planName ?? null,
      topPackageCode: top?.planCode ?? null,
    };
  }

  /** Chuyển gói hết hạn sang EXPIRED (không xoá — tin đã đăng vẫn cần tra cứu nguồn gói). */
  private async syncExpiredPackages(companyId: string): Promise<void> {
    const now = new Date();
    await this.prisma.billingJobPackage.updateMany({
      where: {
        companyId,
        status: 'UNUSED',
        activationDeadlineAt: { not: null, lt: now },
      },
      data: { status: 'EXPIRED' },
    });
    await this.prisma.billingJobPackage.updateMany({
      where: {
        companyId,
        status: 'ACTIVE',
        expiresAt: { not: null, lt: now },
      },
      data: { status: 'EXPIRED' },
    });
  }

  private mapStatus(row: BillingJobPackage, now: Date): RecruiterJobPackageStatus {
    const status = row.status;
    if (status === 'ACTIVE') {
      if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) return 'expired';
      return 'active';
    }
    if (status === 'UNUSED') {
      if (row.activationDeadlineAt && row.activationDeadlineAt.getTime() < now.getTime()) {
        return 'expired';
      }
      return 'unused';
    }
    return 'expired';
  }

  /** Tìm gói theo mã, kiểm tra thuộc công ty. */
  async findByCode(companyId: string, code: string): Promise<BillingJobPackage> {
    const normalized = code.trim().toUpperCase();
    const row = await this.prisma.billingJobPackage.findFirst({
      where: { companyId, code: normalized },
    });
    if (!row) throw new NotFoundException('Không tìm thấy gói tin đăng này');
    return row;
  }

  /**
   * Kích hoạt gói UNUSED → ACTIVE.
   *
   * Chuyển đổi chạy trong 1 transaction: kích hoạt gói + cấp Credit đúng 1 lần
   * (chống cộng trùng qua cờ `creditsGranted`).
   */
  async activate(
    actor: AuthenticatedUser,
    companyId: string,
    code: string,
  ): Promise<{ packageId: string; code: string; creditsGranted: number }> {
    const row = await this.findByCode(companyId, code);
    const now = new Date();

    if (row.status === 'ACTIVE') {
      return { packageId: row.id, code: row.code, creditsGranted: 0 };
    }
    if (row.status === 'EXPIRED') {
      throw new BadRequestException('Gói tin đăng này đã hết hạn kích hoạt');
    }
    if (row.activationDeadlineAt && row.activationDeadlineAt.getTime() < now.getTime()) {
      throw new BadRequestException('Gói tin đăng này đã quá hạn kích hoạt');
    }

    const expiresAt = addUtcDays(now, row.durationDays > 0 ? row.durationDays : 30);
    const credits = row.creditsIncluded;

    const result = await this.prisma.$transaction(async (tx) => {
      // Khoá dòng gói để 2 request cùng lúc không cấp Credit trùng.
      const locked = await tx.$queryRaw<Array<{ id: string; status: string; credits_granted: boolean }>>`
        SELECT id, status, credits_granted FROM billing.billing_job_package
        WHERE id = ${row.id}::uuid FOR UPDATE
      `;
      const current = locked[0];
      if (!current) throw new NotFoundException('Không tìm thấy gói tin đăng này');
      if (current.status === 'ACTIVE') {
        return { packageId: row.id, code: row.code, creditsGranted: 0 };
      }
      if (current.status !== 'UNUSED') {
        throw new BadRequestException('Gói tin đăng này không còn hiệu lực');
      }

      let granted = 0;
      if (!current.credits_granted && credits > 0) {
        granted = credits;
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { tenantId: true },
        });
        const tenantId = company?.tenantId ?? 'default';
        const account = await tx.billingCreditAccount.upsert({
          where: { companyId },
          create: { companyId, tenantId },
          update: {},
        });
        await tx.$queryRaw`SELECT id FROM billing.billing_credit_account WHERE id = ${account.id}::uuid FOR UPDATE`;
        const updated = await tx.billingCreditAccount.update({
          where: { id: account.id },
          data: {
            balance: { increment: credits },
            lifetimeGranted: { increment: credits },
            lastActivityAt: now,
          },
        });
        // Lô Credit có hạn khớp hạn gói → FIFO trừ lô sắp hết hạn trước.
        await tx.billingCreditLot.create({
          data: {
            companyId,
            accountId: account.id,
            sourceType: 'package',
            sourceKey: row.code,
            granted: credits,
            consumed: 0,
            expiresAt,
          },
        });
        await tx.billingCreditTransaction.create({
          data: {
            tenantId,
            companyId,
            accountId: account.id,
            type: 'grant',
            action: 'plan_grant',
            creditDelta: credits,
            balanceAfter: updated.balance,
            costPerUnit: 0,
            quantity: 1,
            actorUserId: actor.id,
            actorEmail: actor.email ?? null,
            note: `Cấp ${credits} Credit khi kích hoạt gói tin đăng ${row.packageName}`,
            metadata: {
              source: 'job_package_activate',
              packageCode: row.code,
              packageId: row.id,
              expiresAt: expiresAt.toISOString(),
            },
            enforced: true,
          },
        });
        await tx.billingAuditLog.create({
          data: {
            entity: 'credit_ledger',
            entityKey: companyId,
            action: 'package_grant',
            diff: {
              packageCode: row.code,
              packageId: row.id,
              creditDelta: credits,
              expiresAt: expiresAt.toISOString(),
            },
            actorId: actor.id,
            actorEmail: actor.email ?? null,
          },
        });
      }

      await tx.billingJobPackage.update({
        where: { id: row.id },
        data: {
          status: 'ACTIVE',
          activatedAt: now,
          expiresAt,
          creditsGranted: granted > 0 ? true : current.credits_granted,
        },
      });

      return { packageId: row.id, code: row.code, creditsGranted: granted };
    });

    await this.prisma.billingAuditLog.create({
      data: {
        entity: 'job_package',
        entityKey: result.packageId,
        action: 'activate',
        diff: {
          packageCode: result.code,
          companyId,
          creditsGranted: result.creditsGranted,
        },
        actorId: actor.id,
        actorEmail: actor.email ?? null,
      },
    });

    return result;
  }

  /**
   * Chọn gói ACTIVE còn lượt để đăng tin.
   * Ưu tiên gói hết hạn sớm nhất (dùng trước để không lãng phí gói dài hạn).
   */
  async pickForPosting(companyId: string, code?: string | null): Promise<BillingJobPackage | null> {
    const now = new Date();
    if (code) {
      const row = await this.findByCode(companyId, code);
      if (row.status !== 'ACTIVE' || (row.expiresAt && row.expiresAt < now)) {
        throw new BadRequestException('Gói tin đăng đã chọn không còn hiệu lực');
      }
      if (row.totalJobs != null && row.usedJobs >= row.totalJobs) {
        throw new BadRequestException('Gói tin đăng đã chọn đã dùng hết lượt đăng');
      }
      return row;
    }

    const candidates = await this.prisma.billingJobPackage.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { activatedAt: 'asc' }],
    });
    const usable = candidates.find(
      (p) => p.totalJobs == null || p.usedJobs < p.totalJobs,
    );
    return usable ?? null;
  }

  /**
   * Trừ 1 lượt đăng của gói (transaction + điều kiện chống vượt quota khi bấm đồng thời).
   */
  async consumePostingSlot(
    tx: Prisma.TransactionClient,
    packageId: string,
  ): Promise<{ totalJobs: number | null; usedJobs: number }> {
    const locked = await tx.$queryRaw<
      Array<{ id: string; status: string; total_jobs: number | null; used_jobs: number; expires_at: Date | null }>
    >`
      SELECT id, status, total_jobs, used_jobs, expires_at FROM billing.billing_job_package
      WHERE id = ${packageId}::uuid FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new BadRequestException('Gói tin đăng không tồn tại');
    if (row.status !== 'ACTIVE') {
      throw new BadRequestException('Gói tin đăng không còn hiệu lực');
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Gói tin đăng đã hết hạn');
    }
    if (row.total_jobs != null && row.used_jobs >= row.total_jobs) {
      throw new ForbiddenException({
        code: 'JOB_PACKAGE_QUOTA_EXCEEDED',
        message: 'Gói tin đăng đã dùng hết lượt đăng.',
      });
    }
    const updated = await tx.billingJobPackage.update({
      where: { id: packageId },
      data: { usedJobs: { increment: 1 } },
      select: { totalJobs: true, usedJobs: true },
    });
    return updated;
  }

  /** Hoàn lượt đăng khi tin bị xoá (đồng bộ với usedJobs). */
  async releasePostingSlot(packageId: string): Promise<void> {
    await this.prisma.billingJobPackage
      .update({
        where: { id: packageId },
        data: { usedJobs: { decrement: 1 } },
      })
      .catch((err) => {
        this.logger.warn(`Không hoàn được lượt đăng của gói ${packageId}: ${String(err)}`);
      });
  }
}
