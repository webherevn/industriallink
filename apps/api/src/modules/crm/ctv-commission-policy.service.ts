import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateCtvCommissionPolicyRequest,
  CrmCommissionPolicySettingsView,
  CtvCommissionItemView,
  CtvCommissionPolicyPublicView,
  CtvCommissionPolicyView,
  CtvCommissionProductType,
  CtvCommissionTierCode,
  CtvCommissionTierView,
  CtvMonthlyStatementView,
  CtvMonthlyTierView,
} from '@industriallink/contracts';
import { UserRole } from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import {
  CommissionTier,
  CommissionTierCode,
  nextTier,
  parseVnd,
  resolveTier,
  revenueToNextTier,
  tierCommissionVnd,
  validateTiers,
} from './commission-tier';
import { nextPeriodMonth, vietnamPeriodMonth } from './commission-period';

/** Tên chính sách mặc định. */
export const DEFAULT_POLICY_NAME = 'Chính sách hoa hồng CTV Inlink';

/** Số ngày tối thiểu phải báo trước khi chính sách mới có hiệu lực. */
export const MIN_POLICY_LEAD_DAYS = 30;

/** Loại sản phẩm theo `orderKind` của BillingOrder. */
const PRODUCT_TYPE_BY_ORDER_KIND: Record<string, CtvCommissionProductType> = {
  platform: 'JOB_PACKAGE',
  sourcing: 'HUNT_PACKAGE',
  topup: 'CREDIT_TOPUP',
};

type TierRow = {
  code: string;
  name: string;
  minMonthlyRevenue: bigint;
  maxMonthlyRevenue: bigint | null;
  ratePercent: number;
  sortOrder: number;
};

type PolicyRow = {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED';
  effectiveFrom: Date;
  includeJobPosting: boolean;
  includeHuntPackage: boolean;
  includeCreditTopup: boolean;
  excludeVat: boolean;
  createdById: string;
  createdAt: Date;
  note: string | null;
  tiers: TierRow[];
};

/** Client trong transaction — cùng API với PrismaClient nhưng không tự connect. */
type Db = Prisma.TransactionClient;

@Injectable()
export class CtvCommissionPolicyService {
  private readonly logger = new Logger(CtvCommissionPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Chỉ SuperAdmin được sửa chính sách. Sale xem read-only. */
  canEdit(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.SuperAdmin;
  }

  private assertCanEdit(actor: AuthenticatedUser): void {
    if (!this.canEdit(actor)) {
      throw new ForbiddenException('Chỉ SuperAdmin được sửa chính sách hoa hồng.');
    }
  }

  // ── Mapping ─────────────────────────────────────────────────────────────

  private mapTier(row: TierRow): CtvCommissionTierView {
    return {
      code: row.code as CtvCommissionTierCode,
      name: row.name,
      minMonthlyRevenueVnd: row.minMonthlyRevenue.toString(),
      maxMonthlyRevenueVnd:
        row.maxMonthlyRevenue === null ? null : row.maxMonthlyRevenue.toString(),
      ratePercent: row.ratePercent,
    };
  }

  private mapPolicy(row: PolicyRow): CtvCommissionPolicyView {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      status: row.status,
      effectiveFrom: row.effectiveFrom.toISOString(),
      includeJobPosting: row.includeJobPosting,
      includeHuntPackage: row.includeHuntPackage,
      includeCreditTopup: row.includeCreditTopup,
      excludeVat: row.excludeVat,
      tiers: [...row.tiers]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((tier) => this.mapTier(tier)),
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      note: row.note,
    };
  }

  private toEngineTier(row: TierRow): CommissionTier {
    return {
      code: row.code as CommissionTierCode,
      name: row.name,
      minMonthlyRevenue: row.minMonthlyRevenue,
      maxMonthlyRevenue: row.maxMonthlyRevenue,
      ratePercent: row.ratePercent,
      sortOrder: row.sortOrder,
    };
  }

  // ── Truy vấn chính sách ─────────────────────────────────────────────────

  /**
   * Chính sách đang áp dụng tại thời điểm `at`.
   * Ưu tiên chính sách ACTIVE có hiệu lực; nếu có SCHEDULED đã tới ngày thì lấy cái
   * mới nhất (hiệu lực sớm hơn). Không hồi tố: chỉ xét effectiveFrom <= at.
   */
  async activePolicyAt(at: Date = new Date()) {
    const rows = await this.prisma.ctvCommissionPolicy.findMany({
      where: {
        effectiveFrom: { lte: at },
        status: { in: ['ACTIVE', 'SCHEDULED'] },
      },
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });
    const row = rows[0];
    if (!row) return null;
    return { ...row, tiers: row.tiers as TierRow[] };
  }

  /** Chính sách ACTIVE hiện tại (dùng cho màn cài đặt + Cổng CTV). */
  async currentPolicy() {
    const rows = await this.prisma.ctvCommissionPolicy.findMany({
      where: { status: 'ACTIVE' },
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { version: 'desc' },
    });
    const row = rows[0];
    if (!row) return null;
    return { ...row, tiers: row.tiers as TierRow[] };
  }

  /** Toàn bộ lịch sử phiên bản (mới nhất trước). */
  async policyHistory(): Promise<CtvCommissionPolicyView[]> {
    const rows = await this.prisma.ctvCommissionPolicy.findMany({
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ version: 'desc' }],
    });
    return rows.map((row) => this.mapPolicy({ ...row, tiers: row.tiers as TierRow[] }));
  }

  /** Dữ liệu cho trang cài đặt `/crm/settings/commission`. */
  async settingsView(actor: AuthenticatedUser): Promise<CrmCommissionPolicySettingsView> {
    const active = await this.currentPolicy();
    return {
      activePolicy: active ? this.mapPolicy(active) : null,
      history: await this.policyHistory(),
      canEdit: this.canEdit(actor),
    };
  }

  /** Chính sách public cho Cổng CTV (read-only). */
  async publicPolicy(): Promise<CtvCommissionPolicyPublicView | null> {
    const policy = await this.currentPolicy();
    if (!policy) return null;
    return {
      name: policy.name,
      version: policy.version,
      effectiveFrom: policy.effectiveFrom.toISOString(),
      includeJobPosting: policy.includeJobPosting,
      includeHuntPackage: policy.includeHuntPackage,
      includeCreditTopup: policy.includeCreditTopup,
      excludeVat: policy.excludeVat,
      tiers: [...policy.tiers]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((tier) => this.mapTier(tier)),
    };
  }

  // ── Quản lý phiên bản ───────────────────────────────────────────────────

  /**
   * Tạo phiên bản chính sách mới.
   *  - Ngày hiệu lực bắt buộc và phải cách hôm nay ít nhất MIN_POLICY_LEAD_DAYS.
   *  - Không áp dụng hồi tố: phiên bản mới chỉ có tác dụng từ effectiveFrom.
   *  - Khi tới ngày hiệu lực, phiên bản cũ chuyển ARCHIVED và bản mới thành ACTIVE.
   */
  async createPolicy(
    actor: AuthenticatedUser,
    body: CreateCtvCommissionPolicyRequest,
  ): Promise<CtvCommissionPolicyView> {
    this.assertCanEdit(actor);

    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Tên chính sách không được để trống.');

    const effectiveFrom = this.parseEffectiveFrom(body.effectiveFrom);
    const leadDays = this.leadDays(effectiveFrom);
    if (leadDays < MIN_POLICY_LEAD_DAYS) {
      throw new BadRequestException(
        `Ngày hiệu lực phải sau ít nhất ${MIN_POLICY_LEAD_DAYS} ngày kể từ hôm nay. ` +
          'Chính sách không áp dụng hồi tố cho các giao dịch và kỳ đã phát sinh.',
      );
    }

    const tiers = this.parseTiers(body.tiers);
    const errors = validateTiers(tiers);
    if (errors.length > 0) {
      throw new BadRequestException(errors.join(' '));
    }

    const latest = await this.prisma.ctvCommissionPolicy.findFirst({
      where: { name },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    const created = await this.prisma.ctvCommissionPolicy.create({
      data: {
        name,
        version,
        // effectiveFrom ở tương lai → SCHEDULED. Nếu bằng 0 ngày thì ACTIVE.
        status: leadDays > 0 ? 'SCHEDULED' : 'ACTIVE',
        effectiveFrom,
        includeJobPosting: body.includeJobPosting !== false,
        includeHuntPackage: body.includeHuntPackage !== false,
        includeCreditTopup: body.includeCreditTopup === true,
        excludeVat: body.excludeVat !== false,
        createdById: actor.id,
        note: body.note?.trim() || null,
        tiers: {
          create: tiers.map((tier, index) => ({
            code: tier.code,
            name: tier.name,
            minMonthlyRevenue: tier.minMonthlyRevenue,
            maxMonthlyRevenue: tier.maxMonthlyRevenue,
            ratePercent: tier.ratePercent,
            sortOrder: index + 1,
          })),
        },
      },
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
    });

    this.logger.log(
      `Tạo chính sách "${name}" v${version}, hiệu lực ${effectiveFrom.toISOString()}`,
    );
    return this.mapPolicy({ ...created, tiers: created.tiers as TierRow[] });
  }

  /** Ngày hiệu lực dạng YYYY-MM-DD (giờ Việt Nam) → Date UTC đầu ngày. */
  private parseEffectiveFrom(raw: string): Date {
    const text = (raw ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException('Ngày hiệu lực phải có dạng YYYY-MM-DD.');
    }
    const date = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ngày hiệu lực không hợp lệ.');
    }
    return date;
  }

  /** Số ngày từ hôm nay tới ngày hiệu lực (có thể âm nếu quá khứ). */
  private leadDays(effectiveFrom: Date): number {
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return Math.round((effectiveFrom.getTime() - todayUtc) / (24 * 60 * 60 * 1000));
  }

  /** Chuyển input tier sang engine tier, có validate từng bậc. */
  private parseTiers(input: CreateCtvCommissionPolicyRequest['tiers']): CommissionTier[] {
    if (!Array.isArray(input) || input.length === 0) {
      throw new BadRequestException('Cần ít nhất một cấp bậc.');
    }
    return input.map((tier, index) => {
      const min = parseVnd(tier.minMonthlyRevenueVnd);
      if (min === null) {
        throw new BadRequestException(
          `Cấp bậc ${tier.name || index + 1}: ngưỡng dưới không hợp lệ.`,
        );
      }
      let max: bigint | null = null;
      if (tier.maxMonthlyRevenueVnd !== null && tier.maxMonthlyRevenueVnd !== undefined) {
        max = parseVnd(tier.maxMonthlyRevenueVnd);
        if (max === null) {
          throw new BadRequestException(
            `Cấp bậc ${tier.name || index + 1}: ngưỡng trên không hợp lệ.`,
          );
        }
      }
      if (!tier.code || !tier.name?.trim()) {
        throw new BadRequestException('Mỗi cấp bậc cần có mã và tên.');
      }
      return {
        code: tier.code as CommissionTierCode,
        name: tier.name.trim(),
        minMonthlyRevenue: min,
        maxMonthlyRevenue: max,
        ratePercent: tier.ratePercent,
        sortOrder: index + 1,
      };
    });
  }

  /**
   * Bật chính sách SCHEDULED khi tới ngày hiệu lực.
   * Gọi từ cron đầu tháng hoặc khi đọc chính sách.
   */
  async activateDuePolicies(at: Date = new Date()): Promise<number> {
    const due = await this.prisma.ctvCommissionPolicy.findMany({
      where: { status: 'SCHEDULED', effectiveFrom: { lte: at } },
      select: { id: true, version: true },
    });
    if (due.length === 0) return 0;

    for (const policy of due) {
      await this.prisma.$transaction(async (tx) => {
        // Chỉ policy ACTIVE cùng tên mới bị archive. Policy khác tên giữ nguyên.
        await tx.ctvCommissionPolicy.updateMany({
          where: { name: (await tx.ctvCommissionPolicy.findUniqueOrThrow({
            where: { id: policy.id },
            select: { name: true },
          })).name, status: 'ACTIVE' },
          data: { status: 'ARCHIVED' },
        });
        await tx.ctvCommissionPolicy.update({
          where: { id: policy.id },
          data: { status: 'ACTIVE' },
        });
      });
    }
    this.logger.log(`Đã kích hoạt ${due.length} chính sách hoa hồng theo lịch.`);
    return due.length;
  }

  // ── Ghi nhận giao dịch hợp lệ ───────────────────────────────────────────

  /**
   * Loại sản phẩm của đơn theo chính sách.
   * Trả null khi đơn KHÔNG được tính hoa hồng (nạp Credit khi policy tắt,
   * hoặc gói nằm ngoài phạm vi).
   */
  productTypeForOrder(
    policy: {
      includeJobPosting: boolean;
      includeHuntPackage: boolean;
      includeCreditTopup: boolean;
    },
    orderKind: string,
  ): CtvCommissionProductType | null {
    const type = PRODUCT_TYPE_BY_ORDER_KIND[orderKind];
    if (!type) return null;
    if (type === 'CREDIT_TOPUP') {
      return policy.includeCreditTopup ? 'CREDIT_TOPUP' : null;
    }
    if (type === 'JOB_PACKAGE') {
      return policy.includeJobPosting ? 'JOB_PACKAGE' : null;
    }
    if (type === 'HUNT_PACKAGE') {
      return policy.includeHuntPackage ? 'HUNT_PACKAGE' : null;
    }
    return null;
  }

  /**
   * Ghi nhận một giao dịch hợp lệ vào kỳ tháng của CTV.
   *
   * Trả null khi giao dịch không sinh hoa hồng (nạp Credit bị loại, gói 0đ,
   * hoặc ngoài phạm vi chính sách).
   */
  async recordEligibleTransaction(
    tx: Db,
    input: {
      ctvId: string;
      companyId: string;
      companyName?: string | null;
      billingOrderId: string;
      orderKind: string;
      planCode?: string | null;
      planName?: string | null;
      /** Tổng tiền khách chuyển (gồm VAT). */
      paidAmountGross: bigint;
      /** Tiền VAT. */
      vatAmount?: bigint;
      /** Tiền chiết khấu. */
      discountAmount?: bigint;
      /** Doanh thu thực thu chưa VAT (cơ sở tính hoa hồng). */
      eligibleRevenue: bigint;
      paidAt: Date;
      /** Nâng cấp gói: chỉ tính phần doanh thu tăng thêm. */
      isUpgradeDelta?: boolean;
    },
  ): Promise<CtvCommissionItemView | null> {
    const policy = await this.activePolicyAt(input.paidAt);
    if (!policy) return null;

    const productType = this.productTypeForOrder(policy, input.orderKind);
    if (!productType) return null;

    // Gói 0đ / đơn 0đ không sinh hoa hồng.
    if (input.paidAmountGross <= 0n || input.eligibleRevenue <= 0n) return null;

    const yearMonth = vietnamPeriodMonth(input.paidAt);
    const statement = await this.ensureOpenStatement(tx, input.ctvId, yearMonth, policy.id);

    // Đơn đã ghi trong tháng này rồi → không ghi lại.
    const existing = await tx.ctvCommissionItem.findUnique({
      where: {
        billingOrderId_yearMonth: {
          billingOrderId: input.billingOrderId,
          yearMonth,
        },
      },
    });
    if (existing) return null;

    const finalType: CtvCommissionProductType = input.isUpgradeDelta
      ? 'UPGRADE_DELTA'
      : productType;

    const item = await tx.ctvCommissionItem.create({
      data: {
        statementId: statement.id,
        ctvId: input.ctvId,
        companyId: input.companyId,
        billingOrderId: input.billingOrderId,
        productType: finalType,
        planCode: input.planCode ?? null,
        planName: input.planName ?? null,
        paidAmountGross: input.paidAmountGross,
        vatAmount: input.vatAmount ?? 0n,
        discountAmount: input.discountAmount ?? 0n,
        eligibleRevenue: input.eligibleRevenue,
        // Tỷ lệ tạm = bậc theo doanh số hiện tại. Sẽ tính lại sau khi ghi.
        appliedRatePercent: 0,
        commissionAmount: 0n,
        status: 'RECORDED',
        yearMonth,
        paidAt: input.paidAt,
      },
    });

    await this.recalculateCtvMonth(tx, input.ctvId, yearMonth);

    return {
      id: item.id,
      statementId: item.statementId,
      ctvId: item.ctvId,
      companyId: item.companyId,
      companyName: input.companyName ?? '',
      billingOrderId: item.billingOrderId,
      productType: finalType,
      planCode: item.planCode,
      planName: item.planName,
      paidAmountGrossVnd: item.paidAmountGross.toString(),
      vatAmountVnd: item.vatAmount.toString(),
      discountAmountVnd: item.discountAmount.toString(),
      eligibleRevenueVnd: item.eligibleRevenue.toString(),
      appliedRatePercent: item.appliedRatePercent,
      commissionAmountVnd: item.commissionAmount.toString(),
      status: 'RECORDED',
      yearMonth: item.yearMonth,
      paidAt: item.paidAt.toISOString(),
    };
  }

  /** Lấy (hoặc tạo) kỳ đối soát đang OPEN cho CTV + tháng. */
  private async ensureOpenStatement(
    tx: Db,
    ctvId: string,
    yearMonth: string,
    policyId: string,
  ) {
    const existing = await tx.ctvMonthlyStatement.findUnique({
      where: { ctvId_yearMonth: { ctvId, yearMonth } },
    });
    if (existing) {
      if (existing.status !== 'OPEN') {
        throw new BadRequestException(
          `Kỳ ${yearMonth} đã chốt — không thể ghi giao dịch mới. ` +
            'Thay đổi chính sách không áp dụng hồi tố cho kỳ đã phát sinh.',
        );
      }
      return existing;
    }
    return tx.ctvMonthlyStatement.create({
      data: { ctvId, yearMonth, policyId, status: 'OPEN' },
    });
  }

  /**
   * Tính lại bậc & toàn bộ hoa hồng của tháng CTV.
   *
   * Chỉ chạy trên kỳ đang OPEN. Kỳ đã RECONCILED/PAID giữ nguyên, không sửa ngược.
   */
  async recalculateCtvMonth(
    tx: Db,
    ctvId: string,
    yearMonth: string,
  ): Promise<void> {
    const statement = await tx.ctvMonthlyStatement.findUnique({
      where: { ctvId_yearMonth: { ctvId, yearMonth } },
      include: { policy: { include: { tiers: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!statement) return;
    if (statement.status !== 'OPEN') return;

    const items = await tx.ctvCommissionItem.findMany({
      where: { ctvId, yearMonth, status: 'RECORDED' },
    });

    const totalRevenue = items.reduce((sum, item) => sum + item.eligibleRevenue, 0n);
    const tiers = statement.policy.tiers.map((tier) => this.toEngineTier(tier as TierRow));
    const tier = resolveTier(tiers, totalRevenue);
    const rate = tier?.ratePercent ?? 0;

    // Bậc đạt được áp dụng cho TOÀN BỘ doanh thu hợp lệ trong tháng.
    for (const item of items) {
      const amount = tierCommissionVnd(item.eligibleRevenue, rate);
      if (item.appliedRatePercent !== rate || item.commissionAmount !== amount) {
        await tx.ctvCommissionItem.update({
          where: { id: item.id },
          data: { appliedRatePercent: rate, commissionAmount: amount },
        });
      }
    }

    const gross = tierCommissionVnd(totalRevenue, rate);
    await tx.ctvMonthlyStatement.update({
      where: { id: statement.id },
      data: {
        policyId: statement.policy.id,
        totalEligibleRevenue: totalRevenue,
        achievedTierCode: tier?.code ?? null,
        achievedTierName: tier?.name ?? null,
        appliedRatePercent: rate,
        grossCommission: gross,
        finalCommission: gross + statement.adjustmentAmount,
      },
    });
  }

  /**
   * Xử lý hoàn tiền / hủy đơn.
   *  - Kỳ đang OPEN → VOID item + tính lại tháng (có thể hạ bậc).
   *  - Kỳ đã RECONCILED/PAID → giữ nguyên kỳ cũ, ghi khoản điều chỉnh âm
   *    vào kỳ hiện tại đang mở.
   */
  async handleRefundOrCancel(
    tx: Db,
    input: { ctvId: string; billingOrderId: string; yearMonth: string },
  ): Promise<void> {
    const item = await tx.ctvCommissionItem.findUnique({
      where: {
        billingOrderId_yearMonth: {
          billingOrderId: input.billingOrderId,
          yearMonth: input.yearMonth,
        },
      },
    });
    if (!item || item.status === 'VOIDED') return;

    const statement = await tx.ctvMonthlyStatement.findUnique({
      where: { id: item.statementId },
    });
    if (!statement) return;

    if (statement.status === 'OPEN') {
      await tx.ctvCommissionItem.update({
        where: { id: item.id },
        data: { status: 'VOIDED' },
      });
      await this.recalculateCtvMonth(tx, input.ctvId, input.yearMonth);
      return;
    }

    // Kỳ đã chốt → không sửa lịch sử. Ghi điều chỉnh âm vào kỳ hiện tại đang mở.
    const currentMonth = vietnamPeriodMonth(new Date());
    const currentStatement = await this.ensureOpenStatement(
      tx,
      input.ctvId,
      currentMonth,
      statement.policyId,
    ).catch(async (err) => {
      // Kỳ hiện tại đã chốt → điều chỉnh dồn sang kỳ kế tiếp (tháng sau).
      if (err instanceof BadRequestException) {
        const nextMonth = nextPeriodMonth(currentMonth);
        this.logger.log(
          `Kỳ ${currentMonth} đã chốt — điều chỉnh hoàn tiền chuyển sang kỳ ${nextMonth}`,
        );
        return this.ensureOpenStatement(tx, input.ctvId, nextMonth, statement.policyId);
      }
      throw err;
    });

    await tx.ctvCommissionItem.update({
      where: { id: item.id },
      data: { status: 'ADJUSTED_NEXT_PERIOD' },
    });

    const negative = -item.commissionAmount;
    await tx.ctvMonthlyStatement.update({
      where: { id: currentStatement.id },
      data: {
        adjustmentAmount: { increment: negative },
        finalCommission: { increment: negative },
      },
    });

    this.logger.log(
      `Hoàn tiền đơn ${input.billingOrderId} (kỳ ${input.yearMonth} đã chốt) ` +
        `→ điều chỉnh ${negative} vào kỳ ${currentMonth}`,
    );
  }

  // ── Truy vấn kỳ & bậc ────────────────────────────────────────────────────

  async statementsForCtv(ctvId: string): Promise<CtvMonthlyStatementView[]> {
    const rows = await this.prisma.ctvMonthlyStatement.findMany({
      where: { ctvId },
      include: { ctv: { select: { name: true, code: true } } },
      orderBy: { yearMonth: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      ctvId: row.ctvId,
      ctvName: row.ctv.name,
      ctvCode: row.ctv.code,
      yearMonth: row.yearMonth,
      policyId: row.policyId,
      totalEligibleRevenueVnd: row.totalEligibleRevenue.toString(),
      achievedTierCode: row.achievedTierCode as CtvCommissionTierCode | null,
      achievedTierName: row.achievedTierName,
      appliedRatePercent: row.appliedRatePercent,
      grossCommissionVnd: row.grossCommission.toString(),
      adjustmentAmountVnd: row.adjustmentAmount.toString(),
      finalCommissionVnd: row.finalCommission.toString(),
      status: row.status as CtvMonthlyStatementView['status'],
      reconciledAt: row.reconciledAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
    }));
  }

  async itemsForStatement(statementId: string): Promise<CtvCommissionItemView[]> {
    const rows = await this.prisma.ctvCommissionItem.findMany({
      where: { statementId },
      orderBy: { paidAt: 'desc' },
    });
    const companyNames = await this.prisma.company.findMany({
      where: { id: { in: rows.map((row) => row.companyId) } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(companyNames.map((company) => [company.id, company.name]));

    return rows.map((row) => ({
      id: row.id,
      statementId: row.statementId,
      ctvId: row.ctvId,
      companyId: row.companyId,
      companyName: nameMap.get(row.companyId) ?? '',
      billingOrderId: row.billingOrderId,
      productType: row.productType as CtvCommissionProductType,
      planCode: row.planCode,
      planName: row.planName,
      paidAmountGrossVnd: row.paidAmountGross.toString(),
      vatAmountVnd: row.vatAmount.toString(),
      discountAmountVnd: row.discountAmount.toString(),
      eligibleRevenueVnd: row.eligibleRevenue.toString(),
      appliedRatePercent: row.appliedRatePercent,
      commissionAmountVnd: row.commissionAmount.toString(),
      status: row.status as CtvCommissionItemView['status'],
      yearMonth: row.yearMonth,
      paidAt: row.paidAt.toISOString(),
    }));
  }

  /**
   * Bậc tháng hiện tại của CTV + thanh tiến độ lên hạng.
   * Tính trực tiếp từ item RECORDED để luôn khớp với kỳ đang mở.
   */
  async monthlyTier(ctvId: string, yearMonth: string): Promise<CtvMonthlyTierView> {
    const policy = await this.currentPolicy();
    const tiers = policy
      ? policy.tiers.map((tier) => this.toEngineTier(tier as TierRow))
      : [];

    const items = await this.prisma.ctvCommissionItem.findMany({
      where: { ctvId, yearMonth, status: 'RECORDED' },
      select: { eligibleRevenue: true },
    });
    const totalRevenue = items.reduce((sum, item) => sum + item.eligibleRevenue, 0n);

    const tier = resolveTier(tiers, totalRevenue);
    const rate = tier?.ratePercent ?? 0;
    const progress = revenueToNextTier(tiers, totalRevenue);
    const upcoming = progress.tier;

    return {
      yearMonth,
      totalEligibleRevenueVnd: totalRevenue.toString(),
      achievedTierCode: tier?.code ?? null,
      achievedTierName: tier?.name ?? null,
      appliedRatePercent: tier ? rate : null,
      nextTierCode: upcoming?.code ?? null,
      nextTierName: upcoming?.name ?? null,
      nextTierRatePercent: upcoming?.ratePercent ?? null,
      revenueToNextTierVnd: progress.missing.toString(),
      nextTierThresholdVnd: progress.threshold === null ? null : progress.threshold.toString(),
      estimatedCommissionVnd: tierCommissionVnd(totalRevenue, rate).toString(),
    };
  }

  /** Chốt kỳ đối soát: OPEN → RECONCILED. Ghi finalCommission vào ví chờ chi ngày 10. */
  async reconcileStatement(
    ctvId: string,
    yearMonth: string,
    reconciledAt: Date = new Date(),
  ): Promise<CtvMonthlyStatementView> {
    const statement = await this.prisma.ctvMonthlyStatement.findUnique({
      where: { ctvId_yearMonth: { ctvId, yearMonth } },
    });
    if (!statement) {
      throw new NotFoundException(`Không tìm thấy kỳ ${yearMonth} của cộng tác viên.`);
    }
    if (statement.status !== 'OPEN') {
      throw new BadRequestException(`Kỳ ${yearMonth} đã chốt.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.recalculateCtvMonth(tx, ctvId, yearMonth);
      await tx.ctvMonthlyStatement.update({
        where: { id: statement.id },
        data: { status: 'RECONCILED', reconciledAt },
      });
    });

    const updated = await this.prisma.ctvMonthlyStatement.findUnique({
      where: { id: statement.id },
      include: { ctv: { select: { name: true, code: true } } },
    });
    return this.mapStatement(updated!);
  }

  private mapStatement(row: {
    id: string;
    ctvId: string;
    yearMonth: string;
    policyId: string;
    totalEligibleRevenue: bigint;
    achievedTierCode: string | null;
    achievedTierName: string | null;
    appliedRatePercent: number | null;
    grossCommission: bigint;
    adjustmentAmount: bigint;
    finalCommission: bigint;
    status: string;
    reconciledAt: Date | null;
    paidAt: Date | null;
    ctv: { name: string; code: string };
  }): CtvMonthlyStatementView {
    return {
      id: row.id,
      ctvId: row.ctvId,
      ctvName: row.ctv.name,
      ctvCode: row.ctv.code,
      yearMonth: row.yearMonth,
      policyId: row.policyId,
      totalEligibleRevenueVnd: row.totalEligibleRevenue.toString(),
      achievedTierCode: row.achievedTierCode as CtvCommissionTierCode | null,
      achievedTierName: row.achievedTierName,
      appliedRatePercent: row.appliedRatePercent,
      grossCommissionVnd: row.grossCommission.toString(),
      adjustmentAmountVnd: row.adjustmentAmount.toString(),
      finalCommissionVnd: row.finalCommission.toString(),
      status: row.status as CtvMonthlyStatementView['status'],
      reconciledAt: row.reconciledAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
    };
  }
}
