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
import { toVnCalendarDate } from '../../shared/domain/vn-date.util';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { HUNT_OWNED_JOB_REASON } from './job-package-source.util';

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

/** Dòng gói tin đăng sau khi `SELECT ... FOR UPDATE` (đã khoá dòng). */
interface LockedJobPackageRow {
  id: string;
  code: string;
  status: string;
  company_id: string;
  package_name: string;
  total_jobs: number | null;
  used_jobs: number;
  credits_granted: boolean;
  credits_included: number;
  duration_days: number;
  expires_at: Date | null;
  activation_deadline_at: Date | null;
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

  /**
   * Đồng bộ gói tin đăng (BillingJobPackage) từ BillingCompanyPlan khi SuperAdmin gán gói trực tiếp
   * cho công ty hoặc công ty đang ở gói mặc định Khám phá (KHAM_PHA).
   * Credit đã được cấp bởi BillingService.assignCompanyPlan → đặt creditsGranted=true (không cấp trùng).
   */
  async syncFromCompanyPlan(companyId: string): Promise<BillingJobPackage | null> {
    const now = new Date();
    const companyPlan = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!companyPlan || !companyPlan.isActive || !companyPlan.plan) return null;
    if (companyPlan.endsAt && companyPlan.endsAt.getTime() < now.getTime()) return null;

    const baseQuota = companyPlan.customJobPostQuota ?? companyPlan.plan.jobPostQuota;
    const totalJobs =
      baseQuota == null ? null : baseQuota + (companyPlan.extraJobPostQuota ?? 0);
    const creditQuota = companyPlan.customCreditQuota ?? companyPlan.plan.creditQuota ?? 0;
    const durationDays = companyPlan.customDurationDays ?? companyPlan.plan.durationDays ?? 30;
    const startsAt = companyPlan.activatedAt ?? companyPlan.startsAt;
    const expiresAt = companyPlan.endsAt ?? addUtcDays(startsAt, durationDays);

    // Nếu đã có gói trả phí từ đơn hàng (orderId != null) còn hiệu lực cho cùng planId thì không tạo trùng
    const paidPkg = await this.prisma.billingJobPackage.findFirst({
      where: {
        companyId,
        planId: companyPlan.planId,
        orderId: { not: null },
        status: { in: ['ACTIVE', 'UNUSED'] },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      select: { id: true },
    });
    if (paidPkg) return null;

    const existingAdminPkg = await this.prisma.billingJobPackage.findFirst({
      where: {
        companyId,
        orderId: null,
        planId: companyPlan.planId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAdminPkg) {
      if (existingAdminPkg.status === 'ACTIVE') {
        return this.prisma.billingJobPackage.update({
          where: { id: existingAdminPkg.id },
          data: {
            packageName: companyPlan.plan.name,
            totalJobs,
            creditsIncluded: creditQuota,
            durationDays,
            expiresAt,
          },
        });
      }
      // Không tự cấp lại gói dùng thử Khám phá nếu đã hết hạn / đã dùng xong
      if (companyPlan.plan.code === 'KHAM_PHA') return null;
    }

    const packageType = this.packageTypeForPlan(companyPlan.plan.code);
    const code = await this.nextCode(packageType);
    return this.prisma.billingJobPackage.create({
      data: {
        code,
        companyId,
        orderId: null,
        planId: companyPlan.planId,
        packageType,
        packageName: companyPlan.plan.name,
        status: 'ACTIVE',
        totalJobs,
        usedJobs: 0,
        creditsIncluded: creditQuota,
        durationDays,
        activationDeadlineAt: null,
        activatedAt: startsAt,
        expiresAt,
        creditsGranted: true,
        priceVnd: 0n,
        purchasedAt: startsAt,
      },
    });
  }

  /**
   * Sinh mã gói kế tiếp theo loại: JD-ST-000001, JD-PL-000001…
   *
   * Có retry khi trùng mã (2 đơn mua song song có thể cùng sinh 1 số) — tránh
   * lỗi unique constraint `billing_job_package_code_key`.
   */
  private async nextCode(packageType: RecruiterJobPackageType): Promise<string> {
    const prefix = PACKAGE_PREFIX[packageType];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const latest = await this.prisma.billingJobPackage.findFirst({
        where: { code: { startsWith: `JD-${prefix}-` } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      const m = latest?.code.match(/(\d+)$/);
      const next = m ? Number(m[1]) + 1 + attempt : 1;
      const code = `JD-${prefix}-${String(next).padStart(6, '0')}`;
      const exists = await this.prisma.billingJobPackage.findFirst({
        where: { code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new BadRequestException('Không sinh được mã gói tin đăng, vui lòng thử lại.');
  }

  /**
   * Danh sách gói tin đăng của công ty + tổng hợp tài nguyên.
   *
   * Đồng bộ trạng thái trước khi trả về: gói UNUSED quá hạn kích hoạt → EXPIRED,
   * gói ACTIVE quá hạn → EXPIRED (nhưng tin đã đăng vẫn chạy tới hạn riêng).
   */
  async listForCompany(companyId: string): Promise<RecruiterJobPackageListResponse> {
    await this.syncExpiredPackages(companyId);
    await this.syncFromCompanyPlan(companyId);

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
   * Chọn gói tin đăng để đăng tin.
   *
   * - Có `code` → dùng đúng gói NTD chọn:
   *   - Gói `UNUSED` còn hạn kích hoạt → chấp nhận (sẽ kích hoạt trong cùng
   *     transaction tạo tin, chống "kích hoạt rỗng").
   *   - Gói `ACTIVE` → phải còn lượt đăng và còn hiệu lực.
   * - Không có `code` → tự chọn gói ACTIVE còn lượt, ưu tiên gói hết hạn sớm nhất.
   */
  async pickForPosting(companyId: string, code?: string | null): Promise<BillingJobPackage | null> {
    const now = new Date();
    if (code) {
      const row = await this.findByCode(companyId, code);
      if (row.status === 'UNUSED') {
        if (row.activationDeadlineAt && row.activationDeadlineAt.getTime() < now.getTime()) {
          throw new BadRequestException('Gói tin đăng đã chọn đã quá hạn kích hoạt');
        }
        return row;
      }
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
    if (usable) return usable;

    // Không còn gói ACTIVE còn lượt → dùng gói UNUSED còn hạn kích hoạt.
    // Gói sẽ được kích hoạt trong cùng transaction tạo/đăng tin (không kích hoạt rỗng).
    const unused = await this.prisma.billingJobPackage.findFirst({
      where: {
        companyId,
        status: 'UNUSED',
        OR: [{ activationDeadlineAt: null }, { activationDeadlineAt: { gte: now } }],
      },
      orderBy: [{ purchasedAt: 'asc' }],
    });
    return unused ?? null;
  }

  /**
   * Kích hoạt gói (nếu đang UNUSED) + gắn gói vào 1 tin tuyển dụng — TRONG 1 TRANSACTION.
   *
   * Đây là API chống "kích hoạt rỗng": không bao giờ kích hoạt gói mà không gắn vào tin.
   *
   * - Gói `UNUSED`: chuyển `status = ACTIVE`, set `activatedAt = now`,
   *   `expiresAt = now + durationDays`, cộng `creditsIncluded` vào Ví Credit chung
   *   (chỉ 1 lần qua cờ `creditsGranted`), rồi trừ 1 lượt đăng + gắn `Job.jobPackageId`.
   * - Gói `ACTIVE` còn lượt: KHÔNG cộng lại Credit, chỉ trừ 1 lượt đăng + gắn tin.
   *
   * Tin được publish và đặt hạn theo `expiresAt` của gói.
   */
  async activateAndApply(
    actor: AuthenticatedUser,
    companyId: string,
    packageId: string,
    jobId: string,
  ): Promise<{
    packageId: string;
    packageCode: string;
    jobId: string;
    jobsRemaining: number | null;
    activated: boolean;
    creditsGranted: number;
    expiresAt: Date | null;
  }> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Khoá dòng gói: chặn 2 request đồng thời dùng trùng 1 lượt / cộng trùng Credit.
      const pkg = await this.lockPackageRow(tx, packageId);
      if (pkg.company_id !== companyId) {
        throw new NotFoundException('Không tìm thấy gói tin đăng này');
      }

      // Tin phải thuộc công ty.
      const job = await tx.job.findFirst({
        where: { id: jobId, companyId, isDeleted: false },
        select: { id: true, code: true, title: true, status: true, jobPackageId: true },
      });
      if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng cần gắn gói.');

      // (A) KHÓA CHIỀU 1 — Tin đang chạy bằng gói Săn nhân sự thì KHÔNG được gắn
      // thêm gói Tin đăng (1 tin chỉ có 1 nguồn gói trả phí).
      await this.assertNotHuntOwned(tx, job.id);

      // Không cho phép gắn đè lên tin đã published đang chạy bằng gói trả phí khác (tránh lách hoàn lượt).
      if (job.jobPackageId && job.jobPackageId !== pkg.id) {
        const oldPkg = await tx.billingJobPackage.findUnique({
          where: { id: job.jobPackageId },
          select: { packageType: true, status: true },
        });
        if (
          job.status === 'published' &&
          oldPkg &&
          oldPkg.packageType !== 'FREE' &&
          oldPkg.status === 'ACTIVE'
        ) {
          throw new BadRequestException(
            'Tin tuyển dụng này đang chạy bằng một gói trả phí khác. Hãy tạo tin mới để dùng gói này.',
          );
        }
      }

      // --- Kích hoạt gói nếu đang UNUSED (cộng Credit đúng 1 lần) ---
      const activation = await this.activatePackageInTx(tx, pkg, actor, companyId, now);

      // --- Trừ 1 lượt đăng (dùng chung cho cả 2 nhánh UNUSED / ACTIVE) ---
      // Idempotent: tin đã gắn chính gói này rồi → không trừ thêm lượt.
      const samePackageAlready = job.jobPackageId === pkg.id;
      const afterConsume = samePackageAlready
        ? { totalJobs: pkg.total_jobs, usedJobs: pkg.used_jobs }
        : await this.consumePostingSlot(tx, pkg.id);

      // Chỉ hoàn lượt đăng của gói cũ khi tin đang ở trạng thái Nháp (chưa chạy thực tế).
      if (job.jobPackageId && job.jobPackageId !== pkg.id && job.status === 'draft') {
        await tx.$queryRaw`
          UPDATE billing.billing_job_package
          SET used_jobs = GREATEST(used_jobs - 1, 0)
          WHERE id = ${job.jobPackageId}::uuid
        `;
      }

      // --- Gắn gói vào tin ---
      // Hạn hiển thị tin = now + durationDays của gói (KHÔNG phụ thuộc hạn gói).
      // `package.expiresAt` = hạn cuối để tiêu hết lượt đăng trong gói (vận hành).
      const durationDays = pkg.duration_days > 0 ? pkg.duration_days : 30;
      const displayDeadline = toVnCalendarDate(addUtcDays(now, durationDays));
      // ⚠ (A3) Tin KHÔNG được publish thẳng — phải qua hàng đợi kiểm duyệt
      // (AI/moderation) giống luồng đăng tin thông thường.
      await tx.job.update({
        where: { id: job.id },
        data: {
          jobPackageId: pkg.id,
          status: 'draft',
          moderationStatus: 'pending',
          publishedAt: null,
          deadline: displayDeadline,
        },
      });

      await tx.billingAuditLog.create({
        data: {
          entity: 'job_package',
          entityKey: pkg.id,
          action: 'apply_job',
          diff: {
            packageCode: pkg.code,
            packageId: pkg.id,
            jobId: job.id,
            jobCode: job.code,
            activated: activation.activated,
            creditsGranted: activation.creditsGranted,
            expiresAt: activation.expiresAt ? activation.expiresAt.toISOString() : null,
          },
          actorId: actor.id,
          actorEmail: actor.email ?? null,
        },
      });

      return {
        packageId: pkg.id,
        packageCode: pkg.code,
        jobId: job.id,
        jobsRemaining:
          afterConsume.totalJobs == null
            ? null
            : Math.max(0, afterConsume.totalJobs - afterConsume.usedJobs),
        activated: activation.activated,
        creditsGranted: activation.creditsGranted,
        expiresAt: activation.expiresAt,
      };
    });
  }

  /**
   * (A) KHÓA CHIỀU 1 — Chặn gắn Gói Tin đăng vào tin đang chạy gói Săn nhân sự.
   *
   * Một tin `PUBLISHED` chỉ được nuôi bởi DUY NHẤT 1 nguồn gói trả phí:
   * `JOB_PACKAGE` HOẶC `HUNT_PACKAGE`. Tin đang có chiến dịch Săn `ACTIVE`
   * (gói Săn còn hiệu lực) → không được gắn thêm gói Tin đăng.
   */
  async assertNotHuntOwned(
    tx: Prisma.TransactionClient,
    jobId: string,
  ): Promise<void> {
    const hunt = await tx.huntCampaign.findFirst({
      where: {
        jobId,
        status: { not: 'closed' },
        package: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (hunt) {
      throw new BadRequestException(HUNT_OWNED_JOB_REASON);
    }
  }

  /**
   * Khoá dòng gói (`FOR UPDATE`) để tránh race khi 2 request dùng cùng 1 gói.
   */
  async lockPackageRow(
    tx: Prisma.TransactionClient,
    packageId: string,
  ): Promise<LockedJobPackageRow> {    const locked = await tx.$queryRaw<LockedJobPackageRow[]>`
      SELECT id, code, status, company_id, package_name, total_jobs, used_jobs,
             credits_granted, credits_included, duration_days, expires_at, activation_deadline_at
      FROM billing.billing_job_package
      WHERE id = ${packageId}::uuid FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new NotFoundException('Không tìm thấy gói tin đăng này');
    return row;
  }

  /**
   * Kích hoạt gói `UNUSED` → `ACTIVE` TRONG transaction đang chạy.
   *
   * - `status = ACTIVE`, `activatedAt = now`, `expiresAt = now + durationDays`.
   * - Cộng `creditsIncluded` vào Ví Credit chung — CHỈ 1 LẦN (cờ `creditsGranted`).
   *
   * Nếu gói đã `ACTIVE`: giữ nguyên hạn, KHÔNG cộng lại Credit.
   *
   * @returns `activated` = gói vừa được kích hoạt, `creditsGranted` = số Credit vừa cộng.
   */
  async activatePackageInTx(
    tx: Prisma.TransactionClient,
    pkg: LockedJobPackageRow,
    actor: AuthenticatedUser,
    companyId: string,
    now: Date,
  ): Promise<{ activated: boolean; creditsGranted: number; expiresAt: Date | null }> {
    if (pkg.status === 'ACTIVE') {
      if (pkg.expires_at && new Date(pkg.expires_at).getTime() < now.getTime()) {
        throw new BadRequestException('Gói tin đăng đã hết hạn.');
      }
      // Gói đã chạy: KHÔNG cộng lại Credit.
      return {
        activated: false,
        creditsGranted: 0,
        expiresAt: pkg.expires_at ? new Date(pkg.expires_at) : null,
      };
    }

    if (pkg.status !== 'UNUSED') {
      throw new BadRequestException('Gói tin đăng này không còn hiệu lực.');
    }
    if (pkg.activation_deadline_at && new Date(pkg.activation_deadline_at).getTime() < now.getTime()) {
      throw new BadRequestException('Gói tin đăng này đã quá hạn kích hoạt.');
    }

    const durationDays = pkg.duration_days > 0 ? pkg.duration_days : 30;
    const expiresAt = addUtcDays(now, durationDays);
    let creditsGranted = 0;

    // Cộng Credit vào ví chung (đúng 1 lần).
    if (!pkg.credits_granted && pkg.credits_included > 0) {
      creditsGranted = pkg.credits_included;
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
          balance: { increment: creditsGranted },
          lifetimeGranted: { increment: creditsGranted },
          lastActivityAt: now,
        },
      });
      await tx.billingCreditLot.create({
        data: {
          companyId,
          accountId: account.id,
          sourceType: 'package',
          sourceKey: pkg.code,
          granted: creditsGranted,
          consumed: 0,
          // Credit của gói mua → GIỮ LẠI trong ví dùng chung, không hết hạn theo hạn gói.
          expiresAt: null,
        },
      });
      await tx.billingCreditTransaction.create({
        data: {
          tenantId,
          companyId,
          accountId: account.id,
          type: 'grant',
          action: 'package_grant',
          creditDelta: creditsGranted,
          balanceAfter: updated.balance,
          costPerUnit: 0,
          quantity: 1,
          actorUserId: actor.id,
          actorEmail: actor.email ?? null,
          note: `Cấp ${creditsGranted} Credit khi kích hoạt gói tin đăng ${pkg.package_name}`,
          metadata: {
            source: 'package_grant',
            grantSource: 'job_package_activate',
            packageCode: pkg.code,
            packageName: pkg.package_name,
            packageId: pkg.id,
            packageExpiresAt: expiresAt.toISOString(),
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
            packageCode: pkg.code,
            packageId: pkg.id,
            creditDelta: creditsGranted,
            expiresAt: expiresAt.toISOString(),
          },
          actorId: actor.id,
          actorEmail: actor.email ?? null,
        },
      });
    }

    await tx.billingJobPackage.update({
      where: { id: pkg.id },
      data: {
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt,
        creditsGranted: pkg.credits_granted || creditsGranted > 0,
      },
    });

    return { activated: true, creditsGranted, expiresAt };
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

  /**
   * Hoàn 1 lượt đăng của gói (dùng khi tin bị hệ thống TỪ CHỐI kiểm duyệt).
   *
   * Dùng raw SQL `GREATEST(used_jobs - 1, 0)` để không bao giờ âm.
   *
   * ⚠ KHÔNG gọi khi NTD tự xoá / tự đóng tin: lượt đăng đã tiêu là mất.
   */
  async releasePostingSlot(packageId: string): Promise<void> {
    await this.prisma.$queryRaw`
      UPDATE billing.billing_job_package
      SET used_jobs = GREATEST(used_jobs - 1, 0)
      WHERE id = ${packageId}::uuid
    `.catch((err) => {
      this.logger.warn(`Không hoàn được lượt đăng của gói ${packageId}: ${String(err)}`);
    });
  }
}
