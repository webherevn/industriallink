import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type BillingCreditAccount, type BillingCreditTransaction } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AppConfig } from '../../config/configuration';
import type {
  BillingCreditAccountView,
  BillingCreditTransactionView,
  BillingCreditLedgerListResponse,
  BillingCreditSummary,
  BillingCreditPolicyView,
  CreditTransactionType,
  CreditAction,
} from '@industriallink/contracts';
import { BillingService } from './billing.service';
import { policyCostForAction } from './billing-action-cost';

const POLICY_SCOPE = 'default';

const PROFILE_VIEW_ACTIONS = new Set(['view_profile', 'view_applicant', 'reopen_profile']);

function isProfileViewAction(action: string): boolean {
  return PROFILE_VIEW_ACTIONS.has(action);
}

export interface RecordTransactionInput {
  tenantId: string;
  companyId: string;
  type: CreditTransactionType;
  action: CreditAction;
  costPerUnit: number;
  quantity?: number;
  candidateId?: string;
  jobId?: string;
  connectionId?: string;
  actorUserId?: string;
  actorEmail?: string;
  note?: string;
  policySnapshot?: Record<string, unknown>;
  /**
   * Nếu true: thực sự trừ balance + set enforced=true. Throw 402 nếu không đủ.
   * Nếu false (mặc định): log-only, không trừ, ghi lifetimeConsumed.
   * Nếu 'check': chỉ check đủ không, không ghi ledger (dry-run).
   */
  mode?: 'log' | 'enforce' | 'check';
  /**
   * Một công ty chỉ bị trừ 1 lần cho cùng action + candidateId
   * (F5 / mở lại hồ sơ không ghi ledger, không trừ thêm).
   */
  oncePerCandidate?: boolean;
  /** Một công ty chỉ bị trừ 1 lần cho cùng action + jobId (vd. xem matching). */
  oncePerJob?: boolean;
}

export interface ConsumeActionInput {
  tenantId: string;
  companyId: string;
  action: CreditAction;
  candidateId?: string;
  jobId?: string;
  connectionId?: string;
  actorUserId?: string;
  actorEmail?: string;
  note?: string;
  oncePerCandidate?: boolean;
  oncePerJob?: boolean;
}

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  enforcementMode(): 'log' | 'enforce' {
    return this.config.get('billing', { infer: true })?.enforcement ?? 'log';
  }

  /**
   * Resolve cost + ghi ledger (log/enforce). Cost = 0 → không ghi.
   * Throw 402 INSUFFICIENT_CREDIT khi enforce mà thiếu số dư.
   */
  async consumeAction(input: ConsumeActionInput): Promise<BillingCreditTransaction | null> {
    await this.billing.ensureCompanyPlan(input.companyId).catch((err) => {
      this.logger.warn(`ensureCompanyPlan ${input.companyId}: ${String(err)}`);
    });
    const resolved = await this.resolveActionCost(input.companyId, input.action).catch(() => null);
    const policy = await this.getPolicySnapshot(input.tenantId).catch(() => null);
    if (resolved && resolved.allowed === false) {
      throw new ForbiddenException({
        code: 'PLAN_ACTION_FORBIDDEN',
        message: `Gói ${resolved.planCode ?? 'hiện tại'} không bao gồm thao tác này. Hãy nâng cấp gói.`,
        action: input.action,
        planCode: resolved.planCode,
      });
    }
    const costPerUnit = resolved?.cost ?? policyCostForAction(policy, input.action);
    if (costPerUnit <= 0) {
      if (input.oncePerCandidate && input.candidateId && isProfileViewAction(input.action)) {
        await this.rememberProfileView(input).catch((err) => {
          this.logger.warn(`rememberProfileView: ${String(err)}`);
        });
      }
      return null;
    }

    return this.recordTransaction({
      tenantId: input.tenantId,
      companyId: input.companyId,
      type: 'deduct',
      action: input.action,
      costPerUnit,
      quantity: 1,
      candidateId: input.candidateId,
      jobId: input.jobId,
      connectionId: input.connectionId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      note: input.note,
      policySnapshot: {
        ...(policy as unknown as Record<string, unknown> | undefined),
        resolvedSource: resolved?.source,
        resolvedPlanId: resolved?.planId,
        resolvedPlanCode: resolved?.planCode,
      },
      mode: 'enforce',
      oncePerCandidate: input.oncePerCandidate,
      oncePerJob: input.oncePerJob,
    });
  }

  /**
   * Cost của action cho công ty: gói đang gán (còn hạn) → fallback policy global.
   */
  resolveActionCost(companyId: string, action: CreditAction) {
    return this.billing.resolveActionCost(companyId, action);
  }

  // =========================================================================
  // ACCOUNT
  // =========================================================================

  /**
   * Mốc «đã xem» khi mở hồ sơ không tốn Credit.
   * Không đổi số dư. Sổ Credit bỏ qua dòng creditDelta = 0.
   */
  private async rememberProfileView(input: ConsumeActionInput): Promise<void> {
    if (!input.candidateId) return;
    const existing = await this.prisma.billingCreditTransaction.findFirst({
      where: {
        companyId: input.companyId,
        candidateId: input.candidateId,
        action: { in: [...PROFILE_VIEW_ACTIONS] },
      },
      select: { id: true },
    });
    if (existing) return;
    const account = await this.getOrCreateAccount(input.companyId, input.tenantId);
    await this.prisma.billingCreditTransaction.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        accountId: account.id,
        type: 'deduct',
        action: input.action,
        creditDelta: 0,
        balanceAfter: account.balance,
        costPerUnit: 0,
        quantity: 1,
        candidateId: input.candidateId,
        jobId: input.jobId,
        connectionId: input.connectionId,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        enforced: false,
        note: 'Đã xem hồ sơ',
      },
    });
  }

  /**
   * Lấy hoặc tạo tài khoản credit cho công ty.
   * Dùng upsert nên luôn trả về account.
   */
  async getOrCreateAccount(companyId: string, tenantId: string): Promise<BillingCreditAccount> {
    return this.prisma.billingCreditAccount.upsert({
      where: { companyId },
      create: { companyId, tenantId },
      update: {},
    });
  }

  /**
   * Số dư credit hiện tại của công ty.
   * Trả về 0 nếu chưa có tài khoản.
   */
  async getBalance(companyId: string): Promise<number> {
    const account = await this.prisma.billingCreditAccount.findUnique({
      where: { companyId },
      select: { balance: true },
    });
    return account?.balance ?? 0;
  }

  /**
   * Lấy thông tin tài khoản credit (view model).
   */
  async getAccountView(companyId: string): Promise<BillingCreditAccountView | null> {
    const a = await this.prisma.billingCreditAccount.findUnique({ where: { companyId } });
    if (!a) return null;
    return this.mapAccount(a);
  }

  /**
   * Lấy snapshot quy tắc credit hiện tại (từ BillingCreditPolicy).
   * Trả về null nếu chưa có policy.
   */
  async getPolicySnapshot(tenantId: string): Promise<BillingCreditPolicyView | null> {
    const p = await this.prisma.billingCreditPolicy.findUnique({ where: { scope: POLICY_SCOPE } });
    if (!p) return null;
    return {
      id: p.id,
      scope: p.scope,
      costPerProfile: p.costPerProfile,
      costPerReopen: p.costPerReopen,
      costPerApplicant: p.costPerApplicant,
      costPerContactPotential: p.costPerContactPotential,
      costPerContactApplicant: p.costPerContactApplicant,
      costPerMatchSummary: p.costPerMatchSummary,
      allowAutoPurchase: p.allowAutoPurchase,
      defaultBudgetVnd: p.defaultBudgetVnd?.toString() ?? null,
      warnWhenBelowPercent: p.warnWhenBelowPercent,
      allowBudgetOverspend: p.allowBudgetOverspend,
      expireWhenInactive: p.expireWhenInactive,
      inactiveDays: p.inactiveDays,
      allowRefund: p.allowRefund,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /**
   * List all accounts (admin).
   */
  async listAccounts(opts: { companyId?: string } = {}): Promise<{
    items: BillingCreditAccountView[];
    total: number;
  }> {
    const where = opts.companyId ? { companyId: opts.companyId } : {};
    const [items, total] = await Promise.all([
      this.prisma.billingCreditAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billingCreditAccount.count({ where }),
    ]);
    return { items: items.map((a) => this.mapAccount(a)), total };
  }

  // =========================================================================
  // TRANSACTIONS
  // =========================================================================

  /**
   * Ghi một giao dịch vào ledger.
   *
   * Mode 'log' (mặc định — backward compatible):
   *   - Ghi ledger với creditDelta = -cost, enforced = false
   *   - balanceAfter = balance hiện tại (không thay đổi thật)
   *   - lifetimeConsumed vẫn tăng để admin thấy pattern
   *
   * Mode 'enforce':
   *   - Check balance đủ trước; nếu thiếu throw BadRequestException với code=INSUFFICIENT_CREDIT
   *   - Ghi ledger với creditDelta = -cost, enforced = true
   *   - balanceAfter = balance - cost; balance -= cost
   *
   * Mode 'check':
   *   - Dry-run: chỉ trả về { allowed: boolean, required, balance, missing }
   *   - Không ghi ledger, không trừ balance
   *
   * cost == 0: KHÔNG ghi gì (không có gì xảy ra) cho mọi mode.
   */
  async recordTransaction(input: RecordTransactionInput): Promise<BillingCreditTransaction | null> {
    const { costPerUnit, quantity = 1, mode = 'log' } = input;
    const totalCost = costPerUnit * quantity;

    // Nếu cost == 0 → không gì xảy ra
    if (totalCost === 0) {
      this.logger.debug(`Skipping zero-cost transaction: action=${input.action}`);
      return null;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Ensure account exists
        const account = await tx.billingCreditAccount.upsert({
          where: { companyId: input.companyId },
          create: { companyId: input.companyId, tenantId: input.tenantId },
          update: {},
        });
        // Khoá account để 2 request cùng lúc không trừ trùng 1 hồ sơ.
        await tx.$queryRaw`SELECT id FROM billing.billing_credit_account WHERE id = ${account.id}::uuid FOR UPDATE`;

        const now = new Date();

        if (input.oncePerCandidate && input.candidateId) {
          const existing = await tx.billingCreditTransaction.findFirst({
            where: {
              companyId: input.companyId,
              action: input.action,
              candidateId: input.candidateId,
            },
            orderBy: { createdAt: 'asc' },
          });
          if (existing) {
            this.logger.debug(
              `Skip duplicate ${input.action} company=${input.companyId} candidate=${input.candidateId}`,
            );
            return existing;
          }
        }

        if (input.oncePerJob && input.jobId) {
          const existing = await tx.billingCreditTransaction.findFirst({
            where: {
              companyId: input.companyId,
              action: input.action,
              jobId: input.jobId,
            },
            orderBy: { createdAt: 'asc' },
          });
          if (existing) {
            this.logger.debug(
              `Skip duplicate ${input.action} company=${input.companyId} job=${input.jobId}`,
            );
            return existing;
          }
        }

        // Mode 'check' → dry-run
        if (mode === 'check') {
          if (account.balance < totalCost) {
            throw new BadRequestException({
              code: 'INSUFFICIENT_CREDIT',
              message: 'Số dư credit không đủ để thực hiện thao tác này',
              required: totalCost,
              balance: account.balance,
              missing: totalCost - account.balance,
              action: input.action,
            });
          }
          return null;
        }

        // Mode 'enforce' → check balance trước
        if (mode === 'enforce' && account.balance < totalCost) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_CREDIT',
            message: 'Số dư credit không đủ để thực hiện thao tác này',
            required: totalCost,
            balance: account.balance,
            missing: totalCost - account.balance,
            action: input.action,
          });
        }

        // Xác định creditDelta và type
        const isPositive = totalCost < 0; // positive delta = grant/refund/topup
        const creditDelta = isPositive ? totalCost : -totalCost;
        const txType: CreditTransactionType = input.type;

        // Tính balanceAfter tùy mode
        const balanceAfter =
          mode === 'enforce' ? account.balance - totalCost : account.balance;

        // Create transaction record
        const txRecord = await tx.billingCreditTransaction.create({
          data: {
            tenantId: input.tenantId,
            companyId: input.companyId,
            accountId: account.id,
            type: txType,
            action: input.action,
            creditDelta: creditDelta,
            balanceAfter,
            costPerUnit: costPerUnit,
            quantity,
            candidateId: input.candidateId ?? null,
            jobId: input.jobId ?? null,
            connectionId: input.connectionId ?? null,
            actorUserId: input.actorUserId ?? null,
            actorEmail: input.actorEmail ?? null,
            policySnapshot: (input.policySnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
            note: input.note ?? null,
            metadata: { mode },
            enforced: mode === 'enforce',
          },
        });

        // Update account
        const updateData: Prisma.BillingCreditAccountUpdateInput = {
          lifetimeConsumed: { increment: Math.abs(creditDelta) },
          lastActivityAt: now,
        };
        if (mode === 'enforce') {
          updateData.balance = { decrement: totalCost };
        }
        await tx.billingCreditAccount.update({
          where: { id: account.id },
          data: updateData,
        });

        return txRecord;
      });
    } catch (err) {
      // Re-throw lỗi enforced / check để caller xử lý
      if (
        err instanceof BadRequestException &&
        typeof err.getResponse() === 'object' &&
        (err.getResponse() as { code?: string }).code === 'INSUFFICIENT_CREDIT'
      ) {
        throw err;
      }
      this.logger.warn(`Failed to record credit transaction: ${String(err)}`);
      return null;
    }
  }

  /**
   * Helper: dry-run check xem balance có đủ trước khi thực hiện thao tác tốn credit.
   * Trả về { allowed, balance, required, missing, costPerUnit }.
   * KHÔNG ghi ledger, KHÔNG throw — caller tự quyết định có throw 402 hay không.
   */
  async tryConsume(opts: {
    companyId: string;
    tenantId: string;
    action: CreditAction;
    costPerUnit: number;
    quantity?: number;
  }): Promise<{
    allowed: boolean;
    balance: number;
    required: number;
    missing: number;
    costPerUnit: number;
    action: CreditAction;
  }> {
    const quantity = opts.quantity ?? 1;
    const required = opts.costPerUnit * quantity;
    const account = await this.prisma.billingCreditAccount.upsert({
      where: { companyId: opts.companyId },
      create: { companyId: opts.companyId, tenantId: opts.tenantId },
      update: {},
    });
    return {
      allowed: account.balance >= required,
      balance: account.balance,
      required,
      missing: Math.max(0, required - account.balance),
      costPerUnit: opts.costPerUnit,
      action: opts.action,
    };
  }

  /**
   * Ghi adjustment thủ công do admin thực hiện.
   * creditDelta dương = cấp thêm, âm = trừ bớt.
   */
  async adminAdjust(
    actorUserId: string,
    actorEmail: string,
    companyId: string,
    tenantId: string,
    creditDelta: number,
    reason: string,
  ): Promise<BillingCreditTransaction> {
    // Validate input
    if (!Number.isInteger(creditDelta)) {
      throw new BadRequestException('creditDelta phải là số nguyên');
    }
    if (creditDelta === 0) {
      throw new BadRequestException('creditDelta phải khác 0');
    }
    const trimmedReason = reason?.trim() ?? '';
    if (trimmedReason.length < 3) {
      throw new BadRequestException('Lý do phải có ít nhất 3 ký tự');
    }
    if (trimmedReason.length > 500) {
      throw new BadRequestException('Lý do không được quá 500 ký tự');
    }
    const account = await this.prisma.$transaction(async (tx) => {
      const acc = await tx.billingCreditAccount.upsert({
        where: { companyId },
        create: { companyId, tenantId },
        update: {},
      });

      // Snapshot trước khi thay đổi (để ghi audit diff)
      const beforeBalance = acc.balance;
      const beforeGranted = acc.lifetimeGranted;

      // Thực sự cập nhật balance cho adjustment
      const updated = await tx.billingCreditAccount.update({
        where: { id: acc.id },
        data: {
          balance: { increment: creditDelta },
          lifetimeGranted:
            creditDelta > 0 ? { increment: creditDelta } : undefined,
          lastActivityAt: new Date(),
        },
      });

      const createdTx = await tx.billingCreditTransaction.create({
        data: {
          tenantId,
          companyId,
          accountId: acc.id,
          type: 'adjustment',
          action: creditDelta > 0 ? 'manual_grant' : 'manual_adjust',
          creditDelta,
          balanceAfter: updated.balance,
          costPerUnit: 0,
          quantity: 1,
          actorUserId,
          actorEmail,
          note: reason,
          metadata: {},
          enforced: true,
        },
      });

      // Ghi audit log trong cùng transaction để đảm bảo consistency
      await tx.billingAuditLog.create({
        data: {
          entity: 'credit_ledger',
          entityKey: companyId,
          action: creditDelta > 0 ? 'manual_grant' : 'manual_adjust',
          diff: {
            reason,
            creditDelta,
            transactionId: createdTx.id,
            before: { balance: beforeBalance, lifetimeGranted: beforeGranted },
            after: { balance: updated.balance, lifetimeGranted: updated.lifetimeGranted },
          },
          actorId: actorUserId,
          actorEmail,
        },
      });

      return updated;
    });

    // Trả về transaction vừa tạo
    const tx = await this.prisma.billingCreditTransaction.findFirst({
      where: { companyId, type: 'adjustment' },
      orderBy: { createdAt: 'desc' },
    });
    return tx!;
  }

  // =========================================================================
  // LIST — company (recruiter)
  // =========================================================================

  async listForCompany(
    companyId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{ items: BillingCreditTransactionView[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.billingCreditTransaction.findMany({
        where: { companyId, creditDelta: { not: 0 } },
        orderBy: { createdAt: 'desc' },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      this.prisma.billingCreditTransaction.count({ where: { companyId, creditDelta: { not: 0 } } }),
    ]);
    return { items: items.map((t) => this.mapTransaction(t)), total };
  }

  // =========================================================================
  // LIST — admin (all)
  // =========================================================================

  async listAll(opts: {
    companyId?: string;
    type?: string;
    action?: string;
    candidateId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<BillingCreditLedgerListResponse> {
    const where: Prisma.BillingCreditTransactionWhereInput = { creditDelta: { not: 0 } };
    if (opts.companyId) where.companyId = opts.companyId;
    if (opts.type) where.type = opts.type;
    if (opts.action) where.action = opts.action;
    if (opts.candidateId) where.candidateId = opts.candidateId;
    if (opts.from || opts.to) {
      where.createdAt = {};
      if (opts.from) where.createdAt.gte = opts.from;
      if (opts.to) where.createdAt.lte = opts.to;
    }

    const [items, total] = await Promise.all([
      this.prisma.billingCreditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      this.prisma.billingCreditTransaction.count({ where }),
    ]);
    return { items: items.map((t) => this.mapTransaction(t)), total };
  }

  // =========================================================================
  // SUMMARY — admin dashboard
  // =========================================================================

  async summary(): Promise<BillingCreditSummary> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(todayStart);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalAccounts,
      accountAgg,
      allTimeAgg,
      last7dAgg,
      last30dAgg,
      todayAgg,
      topCompaniesRows,
      dailyRows,
      byActionRows,
    ] = await Promise.all([
      // Total accounts
      this.prisma.billingCreditAccount.count(),

      // Total balance
      this.prisma.billingCreditAccount.aggregate({ _sum: { balance: true } }),

      // All-time consumed (creditDelta < 0 = deduction = consumption)
      // Không filter enforced: giai đoạn LOG-ONLY vẫn cần admin thấy pattern usage
      this.prisma.billingCreditTransaction.aggregate({
        where: { creditDelta: { lt: 0 } },
        _sum: { creditDelta: true },
      }),

      // Last 7 days consumed
      this.prisma.billingCreditTransaction.aggregate({
        where: {
          creditDelta: { lt: 0 },
          createdAt: { gte: sevenDaysAgo },
        },
        _sum: { creditDelta: true },
      }),

      // Last 30 days consumed
      this.prisma.billingCreditTransaction.aggregate({
        where: {
          creditDelta: { lt: 0 },
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { creditDelta: true },
      }),

      // Today consumed
      this.prisma.billingCreditTransaction.aggregate({
        where: {
          creditDelta: { lt: 0 },
          createdAt: { gte: todayStart },
        },
        _sum: { creditDelta: true },
      }),

      // Top 5 companies by consumption (last 30d)
      this.prisma.billingCreditTransaction.groupBy({
        by: ['companyId'],
        where: {
          creditDelta: { lt: 0 },
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { creditDelta: true },
        orderBy: { _sum: { creditDelta: 'desc' } },
        take: 5,
      }),

      // Daily series: 14 days
      this.prisma.$queryRaw<{ date: Date; total: BigInt }[]>`
        SELECT
          DATE(created_at) AS date,
          SUM(credit_delta) AS total
        FROM billing.billing_credit_transaction
        WHERE credit_delta < 0
          AND created_at >= ${fourteenDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,

      // By-action: last 30 days (chỉ consumption)
      this.prisma.billingCreditTransaction.groupBy({
        by: ['action'],
        where: {
          creditDelta: { lt: 0 },
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { creditDelta: true },
      }),
    ]);

    const totalBalance = Number(accountAgg._sum.balance ?? 0);
    const totalConsumedAllTime = Math.abs(Number(allTimeAgg._sum.creditDelta ?? 0));
    const totalConsumedLast7d = Math.abs(Number(last7dAgg._sum.creditDelta ?? 0));
    const totalConsumedLast30d = Math.abs(Number(last30dAgg._sum.creditDelta ?? 0));
    const totalConsumedToday = Math.abs(Number(todayAgg._sum.creditDelta ?? 0));

    return {
      totalAccounts,
      totalBalance,
      totalConsumedAllTime,
      totalConsumedLast7d,
      totalConsumedLast30d,
      totalConsumedToday,
      topCompanies: topCompaniesRows.map((r) => ({
        companyId: r.companyId,
        total: Math.abs(Number(r._sum.creditDelta ?? 0)),
      })),
      dailySeries: dailyRows
        .map((r) => ({
          date: r.date.toISOString().split('T')[0],
          total: Math.abs(Number(r.total)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byAction: byActionRows.map((r) => ({
        action: r.action as CreditAction,
        total: Math.abs(Number(r._sum.creditDelta ?? 0)),
      })),
    };
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private mapAccount(a: BillingCreditAccount): BillingCreditAccountView {
    return {
      id: a.id,
      tenantId: a.tenantId,
      companyId: a.companyId,
      balance: a.balance,
      lifetimeGranted: a.lifetimeGranted,
      lifetimeConsumed: a.lifetimeConsumed,
      lifetimeRefunded: a.lifetimeRefunded,
      lastActivityAt: a.lastActivityAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private mapTransaction(t: BillingCreditTransaction): BillingCreditTransactionView {
    return {
      id: t.id,
      tenantId: t.tenantId,
      companyId: t.companyId,
      accountId: t.accountId,
      type: t.type as CreditTransactionType,
      action: t.action as CreditAction,
      creditDelta: t.creditDelta,
      balanceAfter: t.balanceAfter,
      costPerUnit: t.costPerUnit,
      quantity: t.quantity,
      candidateId: t.candidateId,
      jobId: t.jobId,
      connectionId: t.connectionId,
      actorUserId: t.actorUserId,
      actorEmail: t.actorEmail,
      policySnapshot: (t.policySnapshot as Record<string, unknown>) ?? null,
      note: t.note,
      metadata: (t.metadata as Record<string, unknown>) ?? {},
      enforced: t.enforced,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
