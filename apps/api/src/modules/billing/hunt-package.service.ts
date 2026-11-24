import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type BillingHuntPackage } from '@prisma/client';
import type { HuntPackageType, RecruiterHuntPackageView } from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/** Mã gói Săn → loại gói (1-1 với chiến dịch). */
const PLAN_PACKAGE_TYPE: Record<string, HuntPackageType> = {
  SAN_CO_BAN: 'BASIC',
  SAN_TIEU_CHUAN: 'STANDARD',
  SAN_CHUYEN_SAU: 'DEEP',
};

/**
 * Hạn mức mặc định theo loại gói Săn.
 * Đây là nguồn sự thật cho hạn mức RIÊNG của từng gói (1 gói = 1 chiến dịch).
 * Gói DEEP là gói duy nhất có bàn giao Inlink.
 */
const PACKAGE_QUOTA: Record<
  HuntPackageType,
  {
    creditsIncluded: number;
    totalCriteriaEdits: number;
    totalReports: number;
    totalHandovers: number;
  }
> = {
  BASIC: { creditsIncluded: 30, totalCriteriaEdits: 4, totalReports: 1, totalHandovers: 0 },
  STANDARD: { creditsIncluded: 30, totalCriteriaEdits: 4, totalReports: 4, totalHandovers: 0 },
  DEEP: { creditsIncluded: 50, totalCriteriaEdits: 30, totalReports: 4, totalHandovers: 15 },
};

/** Thời hạn gói (ngày) tính từ lúc kích hoạt. */
export const HUNT_PACKAGE_DURATION_DAYS = 30;

/**
 * (B6) Số ngày được phép GIỮ gói Săn ở trạng thái chờ kích hoạt (UNUSED).
 * Quá hạn → gói chuyển EXPIRED, NTD không mất tiền âm thầm.
 */
export const HUNT_PACKAGE_ACTIVATION_DAYS = 30;

function addUtcDays(from: Date, days: number): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

/**
 * Quản lý Gói Săn nhân sự (multi-package) theo mô hình 1-1 với Chiến dịch.
 *
 * - Mỗi lần mua 1 gói Săn = 1 bản ghi `BillingHuntPackage` độc lập (status UNUSED).
 * - Khi NTD kích hoạt gói + tạo chiến dịch: 1 transaction duy nhất tạo `HuntCampaign`,
 *   chuyển gói sang ACTIVE (activatedAt / expiresAt) và cộng `creditsIncluded`
 *   vào Ví Credit dùng chung (chỉ 1 lần qua cờ `credits_granted`).
 */
@Injectable()
export class HuntPackageService {
  private readonly logger = new Logger(HuntPackageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Loại gói theo mã gói nền tảng. */
  packageTypeForPlan(planCode: string | null | undefined): HuntPackageType {
    if (!planCode) return 'BASIC';
    return PLAN_PACKAGE_TYPE[planCode] ?? 'BASIC';
  }

  /** Hạn mức mặc định của 1 loại gói. */
  quotaFor(type: HuntPackageType) {
    return PACKAGE_QUOTA[type];
  }

  /**
   * Tạo 1 gói Săn mới cho đơn đã trả.
   * Gói luôn ở trạng thái `UNUSED` — chỉ chuyển ACTIVE khi NTD tạo chiến dịch.
   */
  async createForOrder(input: {
    orderId: string;
    companyId: string;
    planId: string;
    planCode: string | null;
    planName: string | null;
    durationDays: number | null;
    paidAt: Date | null;
    creditsIncluded?: number | null;
    totalCriteriaEdits?: number | null;
    totalReports?: number | null;
    totalHandovers?: number | null;
  }): Promise<BillingHuntPackage | null> {
    const packageType = this.packageTypeForPlan(input.planCode);
    const quota = PACKAGE_QUOTA[packageType];
    const now = input.paidAt ?? new Date();
    const durationDays =
      input.durationDays && input.durationDays > 0 ? input.durationDays : HUNT_PACKAGE_DURATION_DAYS;
    const code = await this.nextUniqueCode();
    return this.prisma.billingHuntPackage.create({
      data: {
        code,
        companyId: input.companyId,
        planId: input.planId,
        orderId: input.orderId,
        packageType,
        packageName: input.planName ?? 'Gói Săn nhân sự',
        status: 'UNUSED',
        durationDays,
        purchasedAt: now,
        // (B6) Hạn chót kích hoạt = ngày mua + 30 ngày (gói chờ kích hoạt không sống vô hạn).
        activationDeadlineAt: addUtcDays(now, HUNT_PACKAGE_ACTIVATION_DAYS),
        creditsIncluded: input.creditsIncluded ?? quota.creditsIncluded,
        creditsGranted: false,
        totalCriteriaEdits: input.totalCriteriaEdits ?? quota.totalCriteriaEdits,
        totalReports: input.totalReports ?? quota.totalReports,
        totalHandovers: input.totalHandovers ?? quota.totalHandovers,
      },
    });
  }

  /** Sinh mã gói kế tiếp: TS-000101, TS-000102… */
  private async nextCode(): Promise<string> {
    const latest = await this.prisma.billingHuntPackage.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const m = latest?.code.match(/TS-(\d+)/);
    const nextNum = m ? Math.max(101, Number(m[1]) + 1) : 101;
    return `TS-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Sinh mã gói kế tiếp, tự thử lại khi trùng (2 đơn mua song sẽ có thể trùng số).
   * Mã gói là duy nhất toàn hệ thống → mỗi lần mua = 1 bản ghi độc lập.
   */
  private async nextUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await this.nextCode();
      const exists = await this.prisma.billingHuntPackage.findFirst({
        where: { code },
        select: { id: true },
      });
      if (!exists) return code;
      // Trùng → dồn số lên 1 rồi thử lại.
      const n = Number(code.slice(3)) + 1;
      const bumped = `TS-${String(n).padStart(6, '0')}`;
      const bumpedExists = await this.prisma.billingHuntPackage.findFirst({
        where: { code: bumped },
        select: { id: true },
      });
      if (!bumpedExists) return bumped;
    }
    throw new BadRequestException('Không sinh được mã gói Săn, vui lòng thử lại.');
  }

  /** Sinh mã chiến dịch kế tiếp: HD-000001… */
  async nextCampaignCode(tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.huntCampaign.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const m = latest?.code.match(/HD-(\d+)/);
    const nextNum = m ? Math.max(1, Number(m[1]) + 1) : 1;
    return `HD-${String(nextNum).padStart(6, '0')}`;
  }

  /**
   * Đồng bộ gói Săn (BillingHuntPackage) từ BillingCompanySourcingPlan khi SuperAdmin gán gói
   * trực tiếp cho công ty (hoặc tự backfill cho công ty đã được SuperAdmin gán trước đó).
   * Gói được tạo ở trạng thái `UNUSED` giống hệt luồng NTD tự mua — khi NTD bấm tạo chiến dịch
   * hệ thống sẽ kích hoạt, cộng Credit đi kèm và gắn 1-1 với chiến dịch Săn.
   */
  async syncFromCompanySourcingPlan(companyId: string): Promise<BillingHuntPackage | null> {
    if (
      !this.prisma?.billingCompanySourcingPlan?.findUnique ||
      !this.prisma?.billingHuntPackage?.findFirst
    ) {
      return null;
    }
    const now = new Date();
    const assignment = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!assignment || !assignment.isActive || !assignment.plan) return null;
    if (assignment.endsAt && assignment.endsAt.getTime() < now.getTime()) return null;

    // Nếu đã có gói trả phí từ đơn hàng (orderId != null) còn hiệu lực cho cùng planId thì không tạo trùng.
    const paidPkg = await this.prisma.billingHuntPackage.findFirst({
      where: {
        companyId,
        planId: assignment.planId,
        orderId: { not: null },
        status: { in: ['ACTIVE', 'UNUSED'] },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      select: { id: true },
    });
    if (paidPkg) return null;

    // Nếu đã có gói do SuperAdmin gán (orderId = null) cho cùng planId thì không tạo trùng.
    const existingAdminPkg = await this.prisma.billingHuntPackage.findFirst({
      where: {
        companyId,
        orderId: null,
        planId: assignment.planId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingAdminPkg) {
      return existingAdminPkg;
    }

    const packageType = this.packageTypeForPlan(assignment.plan.code);
    const quota = PACKAGE_QUOTA[packageType];
    const durationDays =
      assignment.plan.durationDays && assignment.plan.durationDays > 0
        ? assignment.plan.durationDays
        : HUNT_PACKAGE_DURATION_DAYS;
    const code = await this.nextUniqueCode();
    return this.prisma.billingHuntPackage.create({
      data: {
        code,
        companyId,
        planId: assignment.planId,
        orderId: null,
        packageType,
        packageName: assignment.plan.name,
        status: 'UNUSED',
        durationDays,
        purchasedAt: assignment.startsAt ?? now,
        activationDeadlineAt: addUtcDays(now, HUNT_PACKAGE_ACTIVATION_DAYS),
        creditsIncluded: quota.creditsIncluded,
        creditsGranted: false,
        totalCriteriaEdits: quota.totalCriteriaEdits,
        totalReports: quota.totalReports,
        totalHandovers: quota.totalHandovers,
      },
    });
  }

  /**
   * Danh sách gói Săn của công ty (kèm chiến dịch 1-1 đang gắn).
   * Đồng bộ trạng thái trước khi trả về: gói UNUSED quá hạn → EXPIRED,
   * gói ACTIVE quá hạn → EXPIRED (chiến dịch vẫn còn để tra cứu lịch sử).
   */
  async listForCompany(companyId: string): Promise<RecruiterHuntPackageView[]> {
    await this.syncExpiredPackages(companyId);
    await this.syncFromCompanySourcingPlan(companyId);
    const rows = await this.prisma.billingHuntPackage.findMany({
      where: { companyId },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      include: { plan: true, campaign: { select: { id: true, title: true, status: true } } },
    });
    return rows.map((row) => this.mapPackage(row));
  }

  private mapPackage(
    row: BillingHuntPackage & {
      plan?: { code: string; name: string } | null;
      campaign?: { id: string; title: string; status: string } | null;
    },
  ): RecruiterHuntPackageView {
    return {
      id: row.id,
      code: row.code,
      planId: row.planId,
      planCode: row.plan?.code ?? '',
      planName: row.packageName,
      packageType: row.packageType as HuntPackageType,
      packageName: row.packageName,
      status: row.status as RecruiterHuntPackageView['status'],
      durationDays: row.durationDays,
      creditsIncluded: row.creditsIncluded,
      creditsGranted: row.creditsGranted,
      totalCriteriaEdits: row.totalCriteriaEdits,
      usedCriteriaEdits: row.usedCriteriaEdits,
      totalReports: row.totalReports,
      usedReports: row.usedReports,
      totalHandovers: row.totalHandovers,
      usedHandovers: row.usedHandovers,
      purchasedAt: row.purchasedAt.toISOString(),
      activatedAt: row.activatedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      activationDeadlineAt: row.activationDeadlineAt?.toISOString() ?? null,
      campaignId: row.campaign?.id ?? null,
      campaignTitle: row.campaign?.title ?? null,
    };
  }

  /**
   * Đồng bộ trạng thái gói hết hạn:
   * - Gói `UNUSED` quá hạn kích hoạt (`activationDeadlineAt`) → `EXPIRED` (B6).
   * - Gói `ACTIVE` quá hạn sử dụng (`expiresAt`) → `EXPIRED` (chiến dịch vẫn còn để tra cứu lịch sử).
   */
  private async syncExpiredPackages(companyId: string): Promise<void> {
    const now = new Date();
    await this.prisma.billingHuntPackage.updateMany({
      where: { companyId, status: 'ACTIVE', expiresAt: { not: null, lt: now } },
      data: { status: 'EXPIRED' },
    });
    // (B6) Gói chờ kích hoạt quá hạn → hết hiệu lực.
    await this.prisma.billingHuntPackage.updateMany({
      where: {
        companyId,
        status: 'UNUSED',
        activationDeadlineAt: { not: null, lt: now },
      },
      data: { status: 'EXPIRED', note: 'Gói Săn chờ kích hoạt đã quá hạn 30 ngày' },
    });
  }

  /** Tìm gói theo id, kiểm tra thuộc công ty. */
  async findById(companyId: string, id: string): Promise<BillingHuntPackage> {
    const row = await this.prisma.billingHuntPackage.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Không tìm thấy gói Săn này');
    return row;
  }

  /** Tìm gói UNUSED sẵn sàng kích hoạt (mua lâu nhất trước, chưa quá hạn kích hoạt). */
  async findUnused(companyId: string, packageId?: string | null): Promise<BillingHuntPackage> {
    const now = new Date();
    if (packageId) {
      const row = await this.prisma.billingHuntPackage.findFirst({
        where: { id: packageId, companyId },
      });
      if (!row) throw new NotFoundException('Không tìm thấy gói Săn này');
      if (row.status !== 'UNUSED') {
        throw new BadRequestException('Gói Săn này không còn ở trạng thái chờ kích hoạt.');
      }
      if (row.activationDeadlineAt && row.activationDeadlineAt.getTime() < now.getTime()) {
        throw new BadRequestException('Gói Săn này đã quá hạn kích hoạt.');
      }
      return row;
    }
    const row = await this.prisma.billingHuntPackage.findFirst({
      where: {
        companyId,
        status: 'UNUSED',
        OR: [{ activationDeadlineAt: null }, { activationDeadlineAt: { gte: now } }],
      },
      orderBy: { purchasedAt: 'asc' },
    });
    if (!row) {
      throw new ForbiddenException({
        code: 'SOURCING_PACKAGE_REQUIRED',
        message: 'Bạn chưa có gói Săn chờ kích hoạt. Hãy mua thêm gói Săn nhân sự.',
      });
    }
    return row;
  }

  /**
   * Kích hoạt gói + tạo chiến dịch trong 1 TRANSACTION duy nhất.
   *
   * - Tạo `HuntCampaign` (1-1 với gói).
   * - Chuyển gói `UNUSED → ACTIVE`, set `activatedAt = now`, `expiresAt = now + durationDays`.
   * - Cộng `creditsIncluded` vào Ví Credit dùng chung (chỉ khi `creditsGranted === false`).
   */
  async activateWithCampaign(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      tenantId: string;
      packageId: string;
      assignmentId: string;
      jobId: string;
      title: string;
      actorUserId: string | null;
      actorEmail: string | null;
    },
  ): Promise<{ package: BillingHuntPackage; campaignId: string; campaignCode: string }> {
    // Khoá dòng gói để 2 request cùng lúc không kích hoạt trùng.
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        credits_granted: boolean;
        credits_included: number;
        duration_days: number;
        package_name: string;
        code: string;
        activation_deadline_at: Date | null;
      }>
    >`
      SELECT id, status, credits_granted, credits_included, duration_days, package_name, code, activation_deadline_at
      FROM billing.billing_hunt_package
      WHERE id = ${input.packageId}::uuid FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new NotFoundException('Không tìm thấy gói Săn này');
    if (row.status !== 'UNUSED') {
      throw new BadRequestException('Gói Săn này không còn ở trạng thái chờ kích hoạt.');
    }

    const now = new Date();
    if (row.activation_deadline_at && new Date(row.activation_deadline_at).getTime() < now.getTime()) {
      throw new BadRequestException('Gói Săn này đã quá hạn kích hoạt.');
    }
    const durationDays = row.duration_days > 0 ? row.duration_days : HUNT_PACKAGE_DURATION_DAYS;
    const expiresAt = addUtcDays(now, durationDays);

    const campaignCode = await this.nextCampaignCode(tx);
    const campaign = await tx.huntCampaign.create({
      data: {
        code: campaignCode,
        companyId: input.companyId,
        assignmentId: input.assignmentId,
        huntPackageId: row.id,
        jobId: input.jobId,
        title: input.title,
        status: 'open',
        createdBy: input.actorUserId,
      },
    });

    let granted = 0;
    if (!row.credits_granted && row.credits_included > 0) {
      granted = row.credits_included;
      const account = await tx.billingCreditAccount.upsert({
        where: { companyId: input.companyId },
        create: { companyId: input.companyId, tenantId: input.tenantId },
        update: {},
      });
      await tx.$queryRaw`SELECT id FROM billing.billing_credit_account WHERE id = ${account.id}::uuid FOR UPDATE`;
      const updated = await tx.billingCreditAccount.update({
        where: { id: account.id },
        data: {
          balance: { increment: granted },
          lifetimeGranted: { increment: granted },
          lastActivityAt: now,
        },
      });
      // Lô Credit vô thời hạn → Credit của gói Săn GIỮ LẠI trong ví dùng chung.
      await tx.billingCreditLot.create({
        data: {
          companyId: input.companyId,
          accountId: account.id,
          sourceType: 'package',
          sourceKey: row.code,
          granted,
          consumed: 0,
          expiresAt: null,
        },
      });
      await tx.billingCreditTransaction.create({
        data: {
          tenantId: input.tenantId,
          companyId: input.companyId,
          accountId: account.id,
          type: 'grant',
          action: 'package_grant',
          creditDelta: granted,
          balanceAfter: updated.balance,
          costPerUnit: 0,
          quantity: 1,
          campaignId: campaign.id,
          actorUserId: input.actorUserId,
          actorEmail: input.actorEmail,
          note: `Cấp ${granted} Credit khi kích hoạt gói Săn ${row.package_name}`,
          metadata: {
            source: 'package_grant',
            grantSource: 'hunt_package_activate',
            packageCode: row.code,
            packageName: row.package_name,
            packageId: row.id,
            campaignId: campaign.id,
            packageExpiresAt: expiresAt.toISOString(),
          },
          enforced: true,
        },
      });
    }

    await tx.billingHuntPackage.update({
      where: { id: row.id },
      data: {
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt,
        creditsGranted: granted > 0 ? true : row.credits_granted,
      },
    });

    await tx.billingAuditLog.create({
      data: {
        entity: 'hunt_package',
        entityKey: row.id,
        action: 'activate',
        diff: {
          packageCode: row.code,
          campaignId: campaign.id,
          campaignCode,
          companyId: input.companyId,
          creditsGranted: granted,
          expiresAt: expiresAt.toISOString(),
        },
        actorId: input.actorUserId,
        actorEmail: input.actorEmail,
      },
    });

    const updatedPkg = await tx.billingHuntPackage.findUniqueOrThrow({
      where: { id: row.id },
    });
    return { package: updatedPkg, campaignId: campaign.id, campaignCode };
  }

  /**
   * Khoá + đọc 1 gói (dùng để trừ lượt điều chỉnh / báo cáo / bàn giao theo gói).
   */
  async lockPackage(
    tx: Prisma.TransactionClient,
    packageId: string,
  ): Promise<{
    id: string;
    status: string;
    total_criteria_edits: number;
    used_criteria_edits: number;
    total_reports: number;
    used_reports: number;
    total_handovers: number;
    used_handovers: number;
    expires_at: Date | null;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        total_criteria_edits: number;
        used_criteria_edits: number;
        total_reports: number;
        used_reports: number;
        total_handovers: number;
        used_handovers: number;
        expires_at: Date | null;
      }>
    >`
      SELECT id, status, total_criteria_edits, used_criteria_edits, total_reports, used_reports,
             total_handovers, used_handovers, expires_at
      FROM billing.billing_hunt_package
      WHERE id = ${packageId}::uuid FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy gói Săn này');
    return row;
  }
}
