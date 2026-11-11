import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type BillingPlatformPlan,
  type BillingSourcingPlan,
  type BillingCreditTopup,
  type BillingCreditPolicy,
  type BillingCurrencyConfig,
  type BillingPlanActionCost,
  type BillingCompanyPlan,
  type BillingPageContent,
} from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { addVnCalendarDays, toVnCalendarDate } from '../../shared/domain/vn-date.util';
import { applyPublicVatCopy, vatPercentOrEmpty } from '../crm/commission-notices';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { applyLaunchPromo, launchPromoFor } from './launch-promo';
import type {
  AdminCreatePlatformPlanRequest,
  AdminUpdatePlatformPlanRequest,
  AdminCreateSourcingPlanRequest,
  AdminUpdateSourcingPlanRequest,
  AdminCreateCreditTopupRequest,
  AdminUpdateCreditTopupRequest,
  AdminUpdateCreditPolicyRequest,
  AdminUpdateCurrencyConfigRequest,
  AdminUpdatePlanActionCostsRequest,
  AdminAssignCompanyPlanRequest,
  BillingPlatformPlanView,
  BillingSourcingPlanView,
  BillingCreditTopupView,
  BillingCreditPolicyView,
  BillingCurrencyDisplay,
  BillingPublicConfig,
  BillingAdminAuditLogView,
  BillingPlanActionCostView,
  BillingCompanyPlanView,
  BillingPlanBillableAction,
  AdminUpdatePageContentRequest,
  BillingPageContentView,
  BillingPageTextItem,
  BillingPageFaqItem,
  BillingCompareTables,
  BillingCompareTable,
  BillingCompareRow,
  RecruiterBillingEntitlements,
} from '@industriallink/contracts';
import {
  BILLING_PLAN_BILLABLE_ACTIONS,
  DEFAULT_BILLING_PAGE_FEATURES,
  DEFAULT_BILLING_PAGE_HOW_STEPS,
  DEFAULT_BILLING_PAGE_FAQ,
  DEFAULT_BILLING_PAGE_TRUST,
  includedScopeCodes,
  parseSourcingScope,
  UserRole,
  looksLikeUuid,
} from '@industriallink/contracts';
import {
  defaultActionCostRows,
  isBillableAction,
  policyCostForAction,
} from './billing-action-cost';
import { SourcingService } from './sourcing.service';

type PlatformPlanWithCosts = BillingPlatformPlan & { actionCosts?: BillingPlanActionCost[] };
type CreditPolicyWithHighMatch = BillingCreditPolicy & { costPerHighMatchProfile?: number };

const POLICY_SCOPE = 'default';
const HIGH_MATCH_POLICY_SCOPE = 'high_match';
const CURRENCY_SCOPE = 'default';
const PAGE_SCOPE = 'default';

const PAGE_STRING_KEYS = [
  'seoTitle',
  'seoDescription',
  'seoTitleRecruiter',
  'seoDescriptionRecruiter',
  'ogImageAlt',
  'heroBadge',
  'heroHeading',
  'heroHeadingAccent',
  'heroSubtitle',
  'heroSocialProof',
  'heroCtaPrimary',
  'heroCtaSecondary',
  'recruiterKicker',
  'recruiterHeading',
  'recruiterSubtitle',
  'platformTitle',
  'platformSubtitle',
  'sourcingTitle',
  'sourcingSubtitle',
  'creditTitle',
  'creditSubtitle',
  'featuresTitle',
  'featuresSubtitle',
  'compareTitle',
  'compareSubtitle',
  'howTitle',
  'howSubtitle',
  'howFooter',
  'faqTitle',
  'faqSubtitle',
  'contactTitle',
  'contactSubtitle',
  'finalCtaTitle',
  'finalCtaSubtitle',
  'footerTagline',
  'consultNavText',
  'contactEmail',
  'contactEmailDesc',
  'contactHotline',
  'contactHotlineHref',
  'contactHotlineDesc',
  'contactZaloLabel',
  'contactZaloHref',
  'contactZaloDesc',
] as const;

const PAGE_NULLABLE_KEYS = ['focusKeyword', 'ogTitle', 'ogDescription', 'ogImageUrl'] as const;

/** Gói mặc định khi tạo NTD. Chu kỳ Khám phá 14 ngày, trùng hạn hiển thị tin. */
const STARTER_PLAN_CODE = 'KHAM_PHA';
const STARTER_CYCLE_DAYS = 14;
/** Sau ngày kết thúc Khám phá, đợi thêm bấy nhiêu ngày mới mở chu kỳ mới. */
const TRIAL_COOLDOWN_DAYS = 30;

function addUtcDays(from: Date, days: number): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly sourcing: SourcingService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE billing.billing_company_plan
          ADD COLUMN IF NOT EXISTS custom_job_post_quota INTEGER,
          ADD COLUMN IF NOT EXISTS custom_credit_quota INTEGER,
          ADD COLUMN IF NOT EXISTS custom_duration_days INTEGER
      `);
    } catch (err) {
      this.logger.warn(`Không tự kiểm tra cột mở rộng billing_company_plan: ${String(err)}`);
    }
  }

  // =========================================================================
  // PUBLIC
  // =========================================================================
  async getPublicConfig(): Promise<BillingPublicConfig> {
    const [plans, sourcings, topups, policy, currency, page, paymentSetting, vatSetting] = await Promise.all([
      this.prisma.billingPlatformPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: { actionCosts: true },
      }),
      this.prisma.billingSourcingPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.billingCreditTopup.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.ensureCreditPolicy(),
      this.ensureCurrencyConfig(),
      this.ensurePageContent(),
      this.prisma.billingPaymentSetting.findUnique({ where: { scope: 'default' } }),
      this.prisma.crmVatSetting.findUnique({ where: { id: 'default' }, select: { percent: true } }),
    ]);
    const vatPercent = vatPercentOrEmpty(vatSetting?.percent);
    const pageContent = this.mapPageContent(page);
    pageContent.faqItems = pageContent.faqItems.map((item) => ({
      ...item,
      a: applyPublicVatCopy(item.a, vatPercent),
    }));

    return {
      platformPlans: plans.map((p) => this.mapPlatformPlan(p, policy)),
      sourcingPlans: sourcings.map((s) => this.mapSourcingPlan(s)),
      creditTopups: topups.map((t) => this.mapCreditTopup(t)),
      creditPolicy: this.mapCreditPolicy(policy),
      currency: this.mapCurrency(currency),
      pageContent,
      vatPercent,
      paymentMode: (paymentSetting?.mode as 'mock' | 'live') ?? 'mock',
      creditEnforcement: this.config.get('billing', { infer: true })?.enforcement ?? 'log',
    };
  }

  // =========================================================================
  // PLATFORM PLANS
  // =========================================================================
  async listPlatformPlans(includeInactive = true): Promise<BillingPlatformPlanView[]> {
    const where = includeInactive ? {} : { isActive: true };
    const [rows, policy] = await Promise.all([
      this.prisma.billingPlatformPlan.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        include: { actionCosts: true },
      }),
      this.ensureCreditPolicy(),
    ]);
    return rows.map((p) => this.mapPlatformPlan(p, policy));
  }

  async createPlatformPlan(
    actor: AuthenticatedUser,
    input: AdminCreatePlatformPlanRequest,
  ): Promise<BillingPlatformPlanView> {
    const code = input.code.toUpperCase();
    const exists = await this.prisma.billingPlatformPlan.findUnique({ where: { code } });
    if (exists) throw new BadRequestException(`Mã gói "${code}" đã tồn tại`);

    const priceVnd = BigInt(input.priceVnd);
    const created = await this.prisma.billingPlatformPlan.create({
      data: {
        code,
        name: input.name,
        description: input.description,
        priceVnd,
        billingUnit: input.billingUnit,
        durationDays: input.durationDays,
        jobPostQuota: input.jobPostQuota,
        creditQuota: input.creditQuota,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        isFeatured: input.isFeatured ?? false,
        features: (input.features ?? []) as Prisma.JsonArray,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    await this.syncPlanActionCosts(created.id, input.actionCosts);
    await this.writeAudit(actor, 'platform_plan', code, 'create', null, this.diffPlatformPlan(created));
    return this.getPlatformPlanView(created.id);
  }

  async updatePlatformPlan(
    actor: AuthenticatedUser,
    id: string,
    input: AdminUpdatePlatformPlanRequest,
  ): Promise<BillingPlatformPlanView> {
    const before = await this.prisma.billingPlatformPlan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy gói');

    const data: Prisma.BillingPlatformPlanUpdateInput = {
      updatedBy: actor.id,
    };
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.priceVnd !== undefined) data.priceVnd = BigInt(input.priceVnd);
    if (input.billingUnit !== undefined) data.billingUnit = input.billingUnit;
    if (input.durationDays !== undefined) data.durationDays = input.durationDays ?? null;
    if (input.jobPostQuota !== undefined) data.jobPostQuota = input.jobPostQuota ?? null;
    if (input.creditQuota !== undefined) data.creditQuota = input.creditQuota ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;
    if (input.features !== undefined) data.features = input.features as Prisma.JsonArray;

    const after = await this.prisma.billingPlatformPlan.update({ where: { id }, data });
    if (input.actionCosts !== undefined) {
      await this.syncPlanActionCosts(id, input.actionCosts);
    }
    await this.writeAudit(
      actor,
      'platform_plan',
      after.code,
      'update',
      this.diffPlatformPlan(before),
      this.diffPlatformPlan(after)
    );
    return this.getPlatformPlanView(id);
  }

  async deletePlatformPlan(actor: AuthenticatedUser, id: string): Promise<void> {
    const before = await this.prisma.billingPlatformPlan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy gói');
    // Soft delete: chỉ tắt active để giữ lịch sử
    await this.prisma.billingPlatformPlan.update({
      where: { id },
      data: { isActive: false, updatedBy: actor.id },
    });
    await this.writeAudit(actor, 'platform_plan', before.code, 'deactivate', this.diffPlatformPlan(before), null);
  }

  async getPlanActionCosts(planId: string): Promise<BillingPlanActionCostView[]> {
    const plan = await this.prisma.billingPlatformPlan.findUnique({
      where: { id: planId },
      include: { actionCosts: true },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy gói');
    const policy = await this.ensureCreditPolicy();
    return this.mergeActionCosts(plan.actionCosts, policy);
  }

  async updatePlanActionCosts(
    actor: AuthenticatedUser,
    planId: string,
    input: AdminUpdatePlanActionCostsRequest,
  ): Promise<BillingPlanActionCostView[]> {
    const plan = await this.prisma.billingPlatformPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Không tìm thấy gói');
    const before = await this.getPlanActionCosts(planId);
    await this.syncPlanActionCosts(planId, input.costs);
    const after = await this.getPlanActionCosts(planId);
    await this.writeAudit(
      actor,
      'plan_action_cost',
      plan.code,
      'update',
      { costs: before },
      { costs: after },
    );
    return after;
  }

  async getCompanyPlan(companyId: string): Promise<BillingCompanyPlanView | null> {
    const row = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    return row ? this.mapCompanyPlan(row) : null;
  }

  async assignCompanyPlan(
    actor: AuthenticatedUser,
    input: AdminAssignCompanyPlanRequest,
  ): Promise<BillingCompanyPlanView> {
    const plan = await this.prisma.billingPlatformPlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundException('Không tìm thấy gói');

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, tenantId: true },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const endsAt =
      input.endsAt === undefined
        ? this.planCycleEndsAt(plan, startsAt)
        : input.endsAt
          ? new Date(input.endsAt)
          : null;

    const actorId = looksLikeUuid(actor.id) ? actor.id : null;
    const before = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId: input.companyId },
    });
    const isEnterprise = plan.code === 'ENTERPRISE';
    const toOptInt = (v: number | null | undefined): number | null => {
      if (v == null || !Number.isFinite(Number(v))) return null;
      return Math.max(0, Math.trunc(Number(v)));
    };
    const customJobPostQuota = isEnterprise
      ? input.customJobPostQuota === undefined
        ? before?.planId === plan.id
          ? before.customJobPostQuota
          : null
        : toOptInt(input.customJobPostQuota)
      : null;
    const customCreditQuota = isEnterprise
      ? input.customCreditQuota === undefined
        ? before?.planId === plan.id
          ? before.customCreditQuota
          : null
        : toOptInt(input.customCreditQuota)
      : null;
    const customDurationDays = isEnterprise
      ? input.customDurationDays === undefined
        ? before?.planId === plan.id
          ? before.customDurationDays
          : null
        : toOptInt(input.customDurationDays)
      : null;

    const shouldGrant = this.shouldGrantPlanQuota(before, {
      planId: input.planId,
      isActive: input.isActive ?? true,
    });
    const effectiveQuota = isEnterprise
      ? (customCreditQuota ?? plan.creditQuota ?? 0)
      : (plan.creditQuota ?? 0);
    const prevEnterpriseQuota =
      isEnterprise && before?.planId === plan.id
        ? (before.customCreditQuota ?? plan.creditQuota ?? 0)
        : 0;
    const quota = shouldGrant
      ? effectiveQuota
      : isEnterprise && (input.isActive ?? true) && customCreditQuota != null
        ? Math.max(0, customCreditQuota - prevEnterpriseQuota)
        : 0;

    const row = await this.prisma.$transaction(async (tx) => {
      const assigned = await tx.billingCompanyPlan.upsert({
        where: { companyId: input.companyId },
        create: {
          companyId: input.companyId,
          planId: input.planId,
          startsAt,
          endsAt,
          isActive: input.isActive ?? true,
          note: input.note ?? null,
          customJobPostQuota,
          customCreditQuota,
          customDurationDays,
          createdBy: actorId,
          updatedBy: actorId,
        },
        update: {
          planId: input.planId,
          startsAt,
          endsAt,
          isActive: input.isActive ?? true,
          note: input.note === undefined ? undefined : input.note,
          customJobPostQuota,
          customCreditQuota,
          customDurationDays,
          updatedBy: actorId,
        },
        include: { plan: true },
      });

      if (quota > 0 && assigned.isActive) {
        const account = await tx.billingCreditAccount.upsert({
          where: { companyId: company.id },
          create: { companyId: company.id, tenantId: company.tenantId },
          update: {},
        });
        const updatedAccount = await tx.billingCreditAccount.update({
          where: { id: account.id },
          data: {
            balance: { increment: quota },
            lifetimeGranted: { increment: quota },
            lastActivityAt: new Date(),
          },
        });
        await tx.billingCreditTransaction.create({
          data: {
            tenantId: company.tenantId,
            companyId: company.id,
            accountId: account.id,
            type: 'grant',
            action: 'plan_grant',
            creditDelta: quota,
            balanceAfter: updatedAccount.balance,
            costPerUnit: 0,
            quantity: 1,
            actorUserId: actorId,
            actorEmail: actor.email ?? null,
            note: isEnterprise
              ? `${shouldGrant ? 'Cấp' : 'Cấp bổ sung'} ${quota} Credit theo hợp đồng ${plan.name}`
              : `Tặng ${quota} Credit khi gán gói ${plan.name}`,
            metadata: {
              source: 'plan_assign',
              planId: plan.id,
              planCode: plan.code,
              assignmentId: assigned.id,
            },
            enforced: true,
          },
        });
        await tx.billingAuditLog.create({
          data: {
            entity: 'credit_ledger',
            entityKey: company.id,
            action: 'plan_grant',
            diff: {
              reason: `Gán gói ${plan.code}`,
              creditDelta: quota,
              planId: plan.id,
              planCode: plan.code,
              assignmentId: assigned.id,
              before: { balance: account.balance, lifetimeGranted: account.lifetimeGranted },
              after: { balance: updatedAccount.balance, lifetimeGranted: updatedAccount.lifetimeGranted },
            },
            actorId,
            actorEmail: actor.email ?? null,
          },
        });
      }

      return assigned;
    });

    await this.writeAudit(
      actor,
      'company_plan',
      input.companyId,
      before ? 'update' : 'create',
      before
        ? {
            planId: before.planId,
            isActive: before.isActive,
            endsAt: before.endsAt?.toISOString() ?? null,
            customJobPostQuota: before.customJobPostQuota,
            customCreditQuota: before.customCreditQuota,
            customDurationDays: before.customDurationDays,
          }
        : null,
      {
        planId: row.planId,
        planCode: plan.code,
        isActive: row.isActive,
        endsAt: row.endsAt?.toISOString() ?? null,
        customJobPostQuota: row.customJobPostQuota,
        customCreditQuota: row.customCreditQuota,
        customDurationDays: row.customDurationDays,
        creditGranted: quota > 0 && row.isActive ? quota : 0,
      },
    );
    return this.mapCompanyPlan(row);
  }

  /**
   * Tặng creditQuota khi: gán lần đầu, đổi gói, hoặc bật lại gói đã tắt.
   * Sửa note / gia hạn cùng gói đang active → không cộng thêm (tránh farm).
   */
  private shouldGrantPlanQuota(
    before: BillingCompanyPlan | null,
    after: { planId: string; isActive: boolean },
  ): boolean {
    if (!after.isActive) return false;
    if (!before) return true;
    if (before.planId !== after.planId) return true;
    if (!before.isActive && after.isActive) return true;
    if (before.endsAt && before.endsAt < new Date()) return true;
    return false;
  }

  /**
   * Công ty mới / chưa gán gói → Khám phá. Chu kỳ gói 14 ngày, trùng hạn hiển thị tin.
   */
  async ensureCompanyPlan(companyId: string): Promise<BillingCompanyPlanView | null> {
    let existing = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!existing || !existing.plan) {
      return this.provisionStarterPlan(companyId);
    }

    const now = new Date();
    if (
      existing.isActive &&
      existing.plan.code !== STARTER_PLAN_CODE &&
      existing.plan.code !== 'ENTERPRISE'
    ) {
      let cycleEnd = existing.endsAt;
      if (!cycleEnd && existing.plan.durationDays != null && existing.plan.durationDays > 0) {
        cycleEnd = addUtcDays(existing.startsAt, existing.plan.durationDays);
        const restored = await this.prisma.billingCompanyPlan.update({
          where: { companyId },
          data: { endsAt: cycleEnd },
          include: { plan: true },
        });
        existing = restored;
      }
      if (!cycleEnd || now < cycleEnd) {
        await this.safeBackfillPlanGrant(companyId, existing);
        return this.mapCompanyPlan(existing);
      }
      await this.zeroStarterCredit(companyId, existing.startsAt, cycleEnd, existing.plan.name);
      return this.provisionStarterPlan(companyId, {
        renew: true,
        note: `Về gói Khám phá vì ${existing.plan.name} hết hạn và không gia hạn`,
      });
    }

    if (existing.plan.code === STARTER_PLAN_CODE && existing.isActive) {
      const cycleEnd = addUtcDays(existing.startsAt, STARTER_CYCLE_DAYS);
      if (now < cycleEnd) {
        if (!existing.endsAt || existing.endsAt.getTime() !== cycleEnd.getTime()) {
          const fixed = await this.prisma.billingCompanyPlan.update({
            where: { companyId },
            data: { endsAt: cycleEnd },
            include: { plan: true },
          });
          await this.safeBackfillPlanGrant(companyId, fixed);
          return this.mapCompanyPlan(fixed);
        }
        await this.safeBackfillPlanGrant(companyId, existing);
        return this.mapCompanyPlan(existing);
      }
      await this.zeroStarterCredit(companyId, existing.startsAt, cycleEnd, 'Khám phá');
      const restartAt = addUtcDays(cycleEnd, TRIAL_COOLDOWN_DAYS);
      if (now < restartAt) {
        if (!existing.endsAt || existing.endsAt.getTime() !== cycleEnd.getTime()) {
          const closed = await this.prisma.billingCompanyPlan.update({
            where: { companyId },
            data: { endsAt: cycleEnd },
            include: { plan: true },
          });
          return this.mapCompanyPlan(closed);
        }
        return this.mapCompanyPlan(existing);
      }
      return this.provisionStarterPlan(companyId, { renew: true });
    }
    const expired = Boolean(existing.endsAt && existing.endsAt < now);
    if (expired) {
      await this.zeroStarterCredit(companyId, existing.startsAt, existing.endsAt!, existing.plan.name);
      return this.provisionStarterPlan(companyId, {
        renew: true,
        note: `Về gói Khám phá vì hợp đồng ${existing.plan.name} hết hạn`,
      });
    }
    if (!existing.isActive) {
      return this.provisionStarterPlan(companyId, { renew: true });
    }
    await this.safeBackfillPlanGrant(companyId, existing);
    return this.mapCompanyPlan(existing);
  }

  async provisionStarterPlan(
    companyId: string,
    opts: { renew?: boolean; note?: string } = {},
  ): Promise<BillingCompanyPlanView | null> {
    const already = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    const now = new Date();
    const stillValid =
      already &&
      already.isActive &&
      already.startsAt <= now &&
      (already.endsAt == null || already.endsAt >= now);
    if (already && stillValid && !opts.renew) {
      return this.mapCompanyPlan(already);
    }

    const starter = await this.resolveStarterPlan();
    if (!starter) {
      this.logger.warn('Không có gói nền tảng active để gán mặc định — bỏ qua provision');
      return null;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true, createdBy: true },
    });
    if (!company) return null;

    const startsAt = new Date();
    const endsAt = addUtcDays(startsAt, STARTER_CYCLE_DAYS);

    try {
      return await this.assignCompanyPlan(this.systemActor(company), {
        companyId,
        planId: starter.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        note:
          opts.note ??
          (opts.renew
            ? 'Mở lại gói Khám phá sau 30 ngày kể từ lần kết thúc trước'
            : 'Gói Khám phá mặc định khi tạo tài khoản nhà tuyển dụng'),
      });
    } catch (err) {
      this.logger.error(
        `Provision gói ${starter.code} thất bại cho ${companyId}: ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return null;
    }
  }

  async getEntitlements(companyId: string): Promise<RecruiterBillingEntitlements> {
    let planView: BillingCompanyPlanView | null = null;
    try {
      planView = await this.ensureCompanyPlan(companyId);
    } catch (err) {
      this.logger.error(
        `ensureCompanyPlan thất bại cho ${companyId}: ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
    const assignment = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: { include: { actionCosts: true } } },
    });
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { tenantId: true },
    });
    const tenantId = company?.tenantId ?? 'default';
    let account = {
      balance: 0,
      lifetimeGranted: 0,
      lifetimeConsumed: 0,
      lifetimeRefunded: 0,
    };
    try {
      account = await this.prisma.billingCreditAccount.upsert({
        where: { companyId },
        create: { companyId, tenantId },
        update: {},
      });
    } catch (err) {
      this.logger.error(
        `Đọc credit account thất bại cho ${companyId}: ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }

    const quota = assignment?.customJobPostQuota ?? assignment?.plan?.jobPostQuota ?? null;
    const effectiveCreditQuota = assignment?.customCreditQuota ?? assignment?.plan?.creditQuota ?? null;
    const effectiveDisplayDays = assignment?.customDurationDays ?? assignment?.plan?.durationDays ?? null;
    const countActiveJobs =
      assignment?.plan?.code === 'DOANH_NGHIEP' || assignment?.plan?.code === 'ENTERPRISE';
    const jobsUsed = assignment
      ? await this.prisma.job.count({
          where: countActiveJobs
            ? { companyId, isDeleted: false, status: 'published' }
            : {
                companyId,
                isDeleted: false,
                createdAt: {
                  gte: assignment.startsAt,
                  ...(assignment.endsAt ? { lte: assignment.endsAt } : {}),
                },
              },
        })
      : 0;
    const jobsRemaining = quota == null ? null : Math.max(0, quota - jobsUsed);

    const [policy, sourcing] = await Promise.all([
      this.ensureCreditPolicy(),
      this.sourcing.getEntitlements(companyId).catch((err) => {
        this.logger.error(
          `Đọc entitlements Săn thất bại cho ${companyId}: ${String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
        return this.sourcing.emptyEntitlements();
      }),
    ]);
    const hasActiveSourcing = Boolean(
      sourcing.assignment?.isActive &&
        (!sourcing.assignment.endsAt ||
          new Date(sourcing.assignment.endsAt).getTime() >= Date.now()),
    );
    const usePolicyCostsOnly =
      !assignment?.plan || (assignment.plan.code === STARTER_PLAN_CODE && hasActiveSourcing);
    const actionCosts = usePolicyCostsOnly
      ? defaultActionCostRows(this.mapCreditPolicy(policy))
      : defaultActionCostRows(this.mapCreditPolicy(policy)).map((fallback) => {
          const row = assignment.plan.actionCosts?.find((c) => c.action === fallback.action);
          if (!row) return fallback;
          return {
            action: row.action as BillingPlanBillableAction,
            cost: row.cost,
            isActive: row.isActive,
          };
        });

    return {
      plan: planView ?? (assignment?.plan ? this.mapCompanyPlan(assignment) : null),
      planCode: assignment?.plan?.code ?? planView?.planCode ?? null,
      planName: assignment?.plan?.name ?? planView?.planName ?? null,
      creditQuota: effectiveCreditQuota,
      jobPostQuota: quota,
      credits: {
        balance: account.balance,
        lifetimeGranted: account.lifetimeGranted,
        lifetimeConsumed: account.lifetimeConsumed,
        lifetimeRefunded: account.lifetimeRefunded,
      },
      jobsUsed,
      jobsRemaining,
      jobDisplayDays: effectiveDisplayDays,
      actionCosts,
      enforcement: this.config.get('billing', { infer: true })?.enforcement ?? 'log',
      sourcing,
    };
  }

  /** Số ngày tin được phép hiển thị — lấy customDurationDays (nếu có) hoặc durationDays SuperAdmin của gói đang gán. */
  async getJobDisplayDays(companyId: string): Promise<number | null> {
    await this.ensureCompanyPlan(companyId);
    const row = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: { select: { code: true, durationDays: true } } },
    });
    const days = row?.customDurationDays ?? row?.plan?.durationDays;
    if (row?.plan?.code === STARTER_PLAN_CODE && (await this.hasActiveSourcingPlan(companyId))) {
      return Math.max(days ?? 0, 30);
    }
    return days != null && days > 0 ? days : null;
  }

  /**
   * Mốc muộn nhất của hạn tin (ngày dương lịch theo giờ Việt Nam, chuẩn hoá `00:00:00.000Z` cho cột `@db.Date`).
   * Khám phá không được vượt ngày kết thúc gói.
   * Gói tin đăng khác chỉ theo số ngày hiển thị, không có hạn gói.
   */
  async getJobDeadlineCeiling(companyId: string, from = new Date()): Promise<Date | null> {
    await this.ensureCompanyPlan(companyId);
    const row = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: { select: { code: true, durationDays: true } } },
    });
    if (row?.plan?.code === STARTER_PLAN_CODE && (await this.hasActiveSourcingPlan(companyId))) {
      return addVnCalendarDays(from, 30);
    }
    const days = row?.customDurationDays ?? row?.plan?.durationDays;
    const fromDays = days != null && days > 0 ? addVnCalendarDays(from, days) : null;
    if (row?.plan?.code === STARTER_PLAN_CODE && row.endsAt) {
      const endsAtVnDate = toVnCalendarDate(row.endsAt);
      if (!fromDays || endsAtVnDate.getTime() < fromDays.getTime()) return endsAtVnDate;
    }
    return fromDays;
  }

  /** Khám phá hạn 14 ngày. Gói tin đăng khác hạn theo số ngày trên gói. Enterprise theo hợp đồng. */
  private planCycleEndsAt(plan: BillingPlatformPlan, startsAt: Date): Date | null {
    if (plan.code === STARTER_PLAN_CODE) {
      return addUtcDays(startsAt, STARTER_CYCLE_DAYS);
    }
    if (plan.code === 'ENTERPRISE') return null;
    if (plan.durationDays != null && plan.durationDays > 0) {
      return addUtcDays(startsAt, plan.durationDays);
    }
    return null;
  }

  async hasActiveSourcingPlan(companyId: string): Promise<boolean> {
    const s = await this.sourcing.getEntitlements(companyId).catch(() => null);
    const assign = s?.assignment;
    if (!assign?.isActive) return false;
    if (assign.endsAt && new Date(assign.endsAt).getTime() < Date.now()) return false;
    return true;
  }

  /**
   * Khám phá được mua Top-up trong 14 ngày (hoặc khi có gói Săn còn hạn). Hết hạn thì không bán thêm
   * cho đến khi đủ 30 ngày và gói được mở lại, hoặc họ chuyển sang gói tin đăng / gói Săn.
   */
  async assertStarterTopupAllowed(companyId: string): Promise<void> {
    await this.ensureCompanyPlan(companyId);
    const row = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: { plan: { select: { code: true } } },
    });
    if (!row?.plan || row.plan.code === 'ENTERPRISE') return;
    const cycleEnd =
      row.endsAt ??
      (row.plan.code === STARTER_PLAN_CODE ? addUtcDays(row.startsAt, STARTER_CYCLE_DAYS) : null);
    if (!cycleEnd || new Date() < cycleEnd) return;
    if (await this.hasActiveSourcingPlan(companyId)) return;
    if (row.plan.code === STARTER_PLAN_CODE) {
      throw new BadRequestException(
        'Gói Khám phá đã hết hạn 14 ngày dùng thử. Hãy nâng cấp gói Tin đăng hoặc gói Săn nhân sự để nạp thêm và sử dụng Credit.',
      );
    }
    throw new BadRequestException(
      'Gói đã hết hạn và tài khoản đã về gói Khám phá. Hãy gia hạn gói Tin đăng hoặc gói Săn nhân sự để nạp thêm và sử dụng Credit.',
    );
  }

  /**
   * Khi hết hạn gói nền tảng: chỉ thu hồi phần Credit được tặng kèm gói (plan_grant) chưa dùng hết trong chu kỳ đó.
   * Toàn bộ Credit mua từ gói Top-up (type = 'topup') và cấp thủ công được bảo lưu vô thời hạn.
   */
  private async zeroStarterCredit(
    companyId: string,
    cycleStart: Date,
    cycleEnd: Date,
    planName: string,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { tenantId: true },
    });
    if (!company) return;
    const windowStart = new Date(cycleStart.getTime() - 60_000);
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
        SELECT id, balance FROM billing.billing_credit_account
        WHERE company_id = ${companyId}::uuid
        FOR UPDATE
      `;
      const account = locked[0];
      const balance = Number(account?.balance ?? 0);
      if (!account || !Number.isFinite(balance) || balance <= 0) return;

      const alreadyReset = await tx.billingCreditTransaction.findFirst({
        where: {
          companyId,
          action: 'trial_reset',
          createdAt: { gte: windowStart },
        },
        select: { id: true, metadata: true },
      });
      if (
        alreadyReset &&
        (alreadyReset.metadata as { cycleEnd?: string } | null)?.cycleEnd === cycleEnd.toISOString()
      ) {
        return;
      }

      const [grantedAgg, consumedAgg] = await Promise.all([
        tx.billingCreditTransaction.aggregate({
          where: {
            companyId,
            action: 'plan_grant',
            creditDelta: { gt: 0 },
            createdAt: { gte: windowStart, lte: cycleEnd },
          },
          _sum: { creditDelta: true },
        }),
        tx.billingCreditTransaction.aggregate({
          where: {
            companyId,
            type: 'deduct',
            enforced: true,
            creditDelta: { lt: 0 },
            createdAt: { gte: windowStart },
          },
          _sum: { creditDelta: true },
        }),
      ]);

      const grantedInCycle = Number(grantedAgg._sum.creditDelta ?? 0);
      const consumedInCycle = Math.abs(Number(consumedAgg._sum.creditDelta ?? 0));
      const unusedPlanGrant = Math.max(0, grantedInCycle - consumedInCycle);
      const expireAmount = Math.min(balance, unusedPlanGrant);
      if (expireAmount <= 0) return;

      const newBalance = balance - expireAmount;
      await tx.billingCreditAccount.update({
        where: { id: account.id },
        data: { balance: newBalance, lastActivityAt: new Date() },
      });
      await tx.billingCreditTransaction.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          accountId: account.id,
          type: 'adjustment',
          action: 'trial_reset',
          creditDelta: -expireAmount,
          balanceAfter: newBalance,
          costPerUnit: 0,
          quantity: 1,
          note: `Thu hồi ${expireAmount} Credit tặng kèm gói ${planName} hết hạn (bảo lưu Credit Top-up)`,
          metadata: {
            cycleStart: cycleStart.toISOString(),
            cycleEnd: cycleEnd.toISOString(),
            grantedInCycle,
            consumedInCycle,
            source: 'trial_reset',
          },
          enforced: true,
        },
      });
    });
  }

  async assertJobQuota(companyId: string): Promise<void> {
    const e = await this.getEntitlements(companyId);
    const hasSourcingQuota = Boolean(
      e.sourcing?.assignment?.isActive &&
        (!e.sourcing.assignment.endsAt ||
          new Date(e.sourcing.assignment.endsAt).getTime() >= Date.now()) &&
        (e.sourcing.positionsRemaining == null || e.sourcing.positionsRemaining > 0),
    );
    if (hasSourcingQuota) return;
    if (
      e.planCode === STARTER_PLAN_CODE &&
      e.plan?.endsAt &&
      new Date(e.plan.endsAt).getTime() <= Date.now()
    ) {
      throw new ForbiddenException({
        code: 'TRIAL_COOLDOWN',
        message: `Gói Khám phá đã hết ${STARTER_CYCLE_DAYS} ngày. Có thể đăng tin thử lại sau ${TRIAL_COOLDOWN_DAYS} ngày kể từ ngày kết thúc, hoặc đăng ký gói tin đăng.`,
      });
    }
    if (e.jobsRemaining == null) return;
    if (e.jobsRemaining > 0) return;
    throw new ForbiddenException({
      code: 'JOB_QUOTA_EXCEEDED',
      message:
        e.planCode === STARTER_PLAN_CODE
          ? `Gói Khám phá chỉ được đăng ${e.jobPostQuota} tin trong ${STARTER_CYCLE_DAYS} ngày. Hết hạn phải đợi ${TRIAL_COOLDOWN_DAYS} ngày hoặc đăng ký gói tin đăng.`
          : e.planCode === 'DOANH_NGHIEP'
            ? `Gói Doanh nghiệp chỉ được có ${e.jobPostQuota} tin đang hoạt động. Đóng bớt tin hoặc nâng cấp để đăng thêm.`
            : `Gói ${e.planName ?? 'hiện tại'} chỉ được đăng ${e.jobPostQuota} tin. Hãy nâng cấp để đăng thêm.`,
      used: e.jobsUsed,
      quota: e.jobPostQuota,
    });
  }

  private async safeBackfillPlanGrant(
    companyId: string,
    assignment: BillingCompanyPlan & { plan: BillingPlatformPlan },
  ): Promise<void> {
    try {
      await this.backfillPlanGrant(companyId, assignment);
    } catch (err) {
      this.logger.error(
        `Backfill credit gói thất bại cho ${companyId}: ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  private async backfillPlanGrant(
    companyId: string,
    assignment: BillingCompanyPlan & { plan: BillingPlatformPlan },
  ): Promise<void> {
    const quota = assignment.customCreditQuota ?? assignment.plan.creditQuota ?? 0;
    if (quota <= 0) return;
    const granted = await this.prisma.billingCreditTransaction.findFirst({
      where: { companyId, action: 'plan_grant' },
      select: { id: true },
    });
    if (granted) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true, createdBy: true },
    });
    if (!company) return;

    const account = await this.prisma.billingCreditAccount.upsert({
      where: { companyId },
      create: { companyId, tenantId: company.tenantId },
      update: {},
    });
    if (account.lifetimeGranted >= quota) return;
    const updated = await this.prisma.billingCreditAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: quota },
        lifetimeGranted: { increment: quota },
        lastActivityAt: new Date(),
      },
    });
    await this.prisma.billingCreditTransaction.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        accountId: account.id,
        type: 'grant',
        action: 'plan_grant',
        creditDelta: quota,
        balanceAfter: updated.balance,
        costPerUnit: 0,
        quantity: 1,
        actorEmail: 'system:plan-backfill',
        note: `Tặng ${quota} Credit (bổ sung) theo gói ${assignment.plan.name}`,
        metadata: {
          source: 'plan_backfill',
          planId: assignment.planId,
          planCode: assignment.plan.code,
          assignmentId: assignment.id,
        },
        enforced: true,
      },
    });
    this.logger.log(`Backfill ${quota} Credit gói ${assignment.plan.code} cho công ty ${companyId}`);
  }

  /**
   * Gói mặc định: ưu tiên code Khám phá (KHAM_PHA) SuperAdmin đang bật.
   * Quota / số ngày lấy từ row đó, không hardcode.
   */
  private async resolveStarterPlan(): Promise<BillingPlatformPlan | null> {
    const khamPha = await this.prisma.billingPlatformPlan.findFirst({
      where: { code: STARTER_PLAN_CODE, isActive: true },
    });
    if (khamPha) return khamPha;
    const plans = await this.prisma.billingPlatformPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (plans.length === 0) return null;
    return plans.find((p) => p.priceVnd === 0n) ?? plans[0];
  }

  /**
   * NTD thanh toán / SuperAdmin duyệt → gán gói. Khám phá hạn 14 ngày; gói tin khác không hạn ngày.
   */
  async activatePurchasedPlan(
    actor: AuthenticatedUser,
    companyId: string,
    planCode: string,
  ): Promise<BillingCompanyPlanView> {
    const plan = await this.prisma.billingPlatformPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy gói hoặc gói đã tắt');
    if (plan.code === 'ENTERPRISE') {
      throw new BadRequestException('Gói Enterprise liên hệ sales — không tự thanh toán');
    }
    return this.assignCompanyPlan(actor, {
      companyId,
      planId: plan.id,
      isActive: true,
      note: `Kích hoạt gói ${plan.name} sau thanh toán / duyệt`,
    });
  }

  private systemActor(company: { tenantId: string; createdBy: string | null }): AuthenticatedUser {
    return {
      id: company.createdBy ?? '00000000-0000-0000-0000-000000000001',
      email: 'system:billing-provision',
      role: UserRole.SuperAdmin,
      tenantId: company.tenantId,
      displayName: 'Hệ thống Billing',
      status: 'active',
    };
  }

  async unassignCompanyPlan(actor: AuthenticatedUser, companyId: string): Promise<void> {
    const before = await this.prisma.billingCompanyPlan.findUnique({ where: { companyId } });
    if (!before) throw new NotFoundException('Công ty chưa được gán gói');
    await this.prisma.billingCompanyPlan.update({
      where: { companyId },
      data: { isActive: false, updatedBy: actor.id },
    });
    await this.writeAudit(actor, 'company_plan', companyId, 'deactivate', { planId: before.planId }, null);
  }

  /**
   * Cost của 1 action cho công ty: gói đang gán (còn hạn) → fallback policy global.
   */
  async resolveActionCost(
    companyId: string,
    action: string,
  ): Promise<{
    cost: number;
    allowed: boolean;
    source: 'plan' | 'policy';
    planId: string | null;
    planCode: string | null;
  }> {
    const policy = await this.ensureCreditPolicy();
    const fallback = policyCostForAction(this.mapCreditPolicy(policy), action);
    if (!isBillableAction(action)) {
      return { cost: fallback, allowed: true, source: 'policy', planId: null, planCode: null };
    }

    const assignment = await this.prisma.billingCompanyPlan.findUnique({
      where: { companyId },
      include: {
        plan: { include: { actionCosts: true } },
      },
    });
    const now = new Date();
    const active =
      assignment &&
      assignment.isActive &&
      assignment.startsAt <= now &&
      (assignment.endsAt == null || assignment.endsAt >= now);

    if (!active || !assignment) {
      return { cost: fallback, allowed: true, source: 'policy', planId: null, planCode: null };
    }

    if (
      assignment.plan.code === STARTER_PLAN_CODE &&
      (await this.hasActiveSourcingPlan(companyId))
    ) {
      return {
        cost: fallback,
        allowed: true,
        source: 'policy',
        planId: assignment.planId,
        planCode: assignment.plan.code,
      };
    }

    const row = assignment.plan.actionCosts?.find((c) => c.action === action);
    if (row && !row.isActive) {
      return {
        cost: row.cost,
        allowed: false,
        source: 'plan',
        planId: assignment.planId,
        planCode: assignment.plan.code,
      };
    }
    if (!row) {
      return {
        cost: fallback,
        allowed: true,
        source: 'policy',
        planId: assignment.planId,
        planCode: assignment.plan.code,
      };
    }
    return {
      cost: row.cost,
      allowed: true,
      source: 'plan',
      planId: assignment.planId,
      planCode: assignment.plan.code,
    };
  }

  // =========================================================================
  // SOURCING PLANS
  // =========================================================================
  async listSourcingPlans(includeInactive = true): Promise<BillingSourcingPlanView[]> {
    const where = includeInactive ? {} : { isActive: true };
    const rows = await this.prisma.billingSourcingPlan.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((s) => this.mapSourcingPlan(s));
  }

  async createSourcingPlan(
    actor: AuthenticatedUser,
    input: AdminCreateSourcingPlanRequest,
  ): Promise<BillingSourcingPlanView> {
    const code = input.code.toUpperCase();
    const exists = await this.prisma.billingSourcingPlan.findUnique({ where: { code } });
    if (exists) throw new BadRequestException(`Mã gói Săn "${code}" đã tồn tại`);

    const created = await this.prisma.billingSourcingPlan.create({
      data: {
        code,
        name: input.name,
        description: input.description,
        feeVnd: BigInt(input.feeVnd),
        creditQuota: input.creditQuota,
        positionQuota: input.positionQuota,
        searchRoundQuota: input.searchRoundQuota,
        shortlistQuota: input.shortlistQuota,
        revisionQuota: input.revisionQuota,
        serviceScope: this.scopePayload(input) as Prisma.JsonArray,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        isFeatured: input.isFeatured ?? false,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    await this.writeAudit(actor, 'sourcing_plan', code, 'create', null, this.diffSourcingPlan(created));
    return this.mapSourcingPlan(created);
  }

  async updateSourcingPlan(
    actor: AuthenticatedUser,
    id: string,
    input: AdminUpdateSourcingPlanRequest,
  ): Promise<BillingSourcingPlanView> {
    const before = await this.prisma.billingSourcingPlan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy gói Săn');

    const data: Prisma.BillingSourcingPlanUpdateInput = {
      updatedBy: actor.id,
    };
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.feeVnd !== undefined) data.feeVnd = BigInt(input.feeVnd);
    if (input.positionQuota !== undefined) data.positionQuota = input.positionQuota;
    if (input.searchRoundQuota !== undefined) data.searchRoundQuota = input.searchRoundQuota;
    if (input.shortlistQuota !== undefined) data.shortlistQuota = input.shortlistQuota;
    if (input.revisionQuota !== undefined) data.revisionQuota = input.revisionQuota;
    if (input.creditQuota !== undefined) data.creditQuota = input.creditQuota;
    if (input.scopeItems !== undefined || input.serviceScope !== undefined) {
      data.serviceScope = this.scopePayload(input) as Prisma.JsonArray;
    }
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;

    const after = await this.prisma.billingSourcingPlan.update({ where: { id }, data });
    await this.writeAudit(
      actor,
      'sourcing_plan',
      after.code,
      'update',
      this.diffSourcingPlan(before),
      this.diffSourcingPlan(after)
    );
    return this.mapSourcingPlan(after);
  }

  async deleteSourcingPlan(actor: AuthenticatedUser, id: string): Promise<void> {
    const before = await this.prisma.billingSourcingPlan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy gói Săn');
    await this.prisma.billingSourcingPlan.update({
      where: { id },
      data: { isActive: false, updatedBy: actor.id },
    });
    await this.writeAudit(actor, 'sourcing_plan', before.code, 'deactivate', this.diffSourcingPlan(before), null);
  }

  // =========================================================================
  // CREDIT TOP-UP
  // =========================================================================
  async listCreditTopups(includeInactive = true): Promise<BillingCreditTopupView[]> {
    const where = includeInactive ? {} : { isActive: true };
    const rows = await this.prisma.billingCreditTopup.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((t) => this.mapCreditTopup(t));
  }

  async createCreditTopup(
    actor: AuthenticatedUser,
    input: AdminCreateCreditTopupRequest,
  ): Promise<BillingCreditTopupView> {
    if (input.creditCount < 1) throw new BadRequestException('creditCount phải ≥ 1');
    const priceVnd = BigInt(input.priceVnd);
    if (priceVnd <= 0n) throw new BadRequestException('priceVnd phải > 0');
    const unitPriceVnd = priceVnd / BigInt(input.creditCount);

    const created = await this.prisma.billingCreditTopup.create({
      data: {
        name: input.name,
        creditCount: input.creditCount,
        priceVnd,
        unitPriceVnd,
        badge: input.badge,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        isFeatured: input.isFeatured ?? false,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    await this.writeAudit(actor, 'credit_topup', created.id, 'create', null, this.diffTopup(created));
    return this.mapCreditTopup(created);
  }

  async updateCreditTopup(
    actor: AuthenticatedUser,
    id: string,
    input: AdminUpdateCreditTopupRequest,
  ): Promise<BillingCreditTopupView> {
    const before = await this.prisma.billingCreditTopup.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy gói top-up');

    const data: Prisma.BillingCreditTopupUpdateInput = { updatedBy: actor.id };
    let priceVnd: bigint | undefined;
    let creditCount: number | undefined;
    if (input.name !== undefined) data.name = input.name;
    if (input.creditCount !== undefined) {
      data.creditCount = input.creditCount;
      creditCount = input.creditCount;
    }
    if (input.priceVnd !== undefined) {
      priceVnd = BigInt(input.priceVnd);
      data.priceVnd = priceVnd;
    }
    if (input.badge !== undefined) data.badge = input.badge;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;

    // Recompute unitPriceVnd khi một trong hai thay đổi
    if (priceVnd !== undefined || creditCount !== undefined) {
      const nextPrice = priceVnd ?? before.priceVnd;
      const nextCount = creditCount ?? before.creditCount;
      if (nextCount < 1) throw new BadRequestException('creditCount phải ≥ 1');
      data.unitPriceVnd = nextPrice / BigInt(nextCount);
    }

    const after = await this.prisma.billingCreditTopup.update({ where: { id }, data });
    await this.writeAudit(actor, 'credit_topup', id, 'update', this.diffTopup(before), this.diffTopup(after));
    return this.mapCreditTopup(after);
  }

  async deleteCreditTopup(actor: AuthenticatedUser, id: string): Promise<void> {
    const before = await this.prisma.billingCreditTopup.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy gói top-up');
    await this.prisma.billingCreditTopup.update({
      where: { id },
      data: { isActive: false, updatedBy: actor.id },
    });
    await this.writeAudit(actor, 'credit_topup', id, 'deactivate', this.diffTopup(before), null);
  }

  // =========================================================================
  // CREDIT POLICY
  // =========================================================================
  async getCreditPolicy(): Promise<BillingCreditPolicyView> {
    const policy = await this.ensureCreditPolicy();
    return this.mapCreditPolicy(policy);
  }

  async updateCreditPolicy(
    actor: AuthenticatedUser,
    input: AdminUpdateCreditPolicyRequest,
  ): Promise<BillingCreditPolicyView> {
    const before = await this.ensureCreditPolicy();
    const data: Prisma.BillingCreditPolicyUpdateInput = { updatedBy: actor.id };
    if (input.costPerProfile !== undefined) data.costPerProfile = input.costPerProfile;
    if (input.costPerReopen !== undefined) data.costPerReopen = input.costPerReopen;
    if (input.costPerApplicant !== undefined) data.costPerApplicant = input.costPerApplicant;
    if (input.costPerContactPotential !== undefined) data.costPerContactPotential = input.costPerContactPotential;
    if (input.costPerContactApplicant !== undefined) data.costPerContactApplicant = input.costPerContactApplicant;
    if (input.costPerMatchSummary !== undefined) data.costPerMatchSummary = input.costPerMatchSummary;
    if (input.allowAutoPurchase !== undefined) data.allowAutoPurchase = input.allowAutoPurchase;
    if (input.defaultBudgetVnd !== undefined) {
      data.defaultBudgetVnd = input.defaultBudgetVnd == null ? null : BigInt(input.defaultBudgetVnd);
    }
    if (input.warnWhenBelowPercent !== undefined) data.warnWhenBelowPercent = input.warnWhenBelowPercent;
    if (input.allowBudgetOverspend !== undefined) data.allowBudgetOverspend = input.allowBudgetOverspend;
    if (input.expireWhenInactive !== undefined) data.expireWhenInactive = input.expireWhenInactive;
    if (input.inactiveDays !== undefined) data.inactiveDays = input.inactiveDays;
    if (input.allowRefund !== undefined) data.allowRefund = input.allowRefund;

    const updatedBase = await this.prisma.billingCreditPolicy.update({
      where: { id: before.id },
      data,
    });
    let nextHighMatchCost = before.costPerHighMatchProfile ?? 2;
    if (input.costPerHighMatchProfile !== undefined) {
      const updatedHigh = await this.prisma.billingCreditPolicy.upsert({
        where: { scope: HIGH_MATCH_POLICY_SCOPE },
        create: {
          scope: HIGH_MATCH_POLICY_SCOPE,
          costPerProfile: input.costPerHighMatchProfile,
          updatedBy: actor.id,
        },
        update: {
          costPerProfile: input.costPerHighMatchProfile,
          updatedBy: actor.id,
        },
      });
      nextHighMatchCost = updatedHigh.costPerProfile;
    }
    const after: CreditPolicyWithHighMatch = {
      ...updatedBase,
      costPerHighMatchProfile: nextHighMatchCost,
    };
    await this.writeAudit(
      actor,
      'credit_policy',
      POLICY_SCOPE,
      'update',
      this.diffPolicy(before),
      this.diffPolicy(after)
    );
    return this.mapCreditPolicy(after);
  }

  // =========================================================================
  // CURRENCY CONFIG
  // =========================================================================
  async getCurrencyConfig(): Promise<BillingCurrencyDisplay> {
    const cur = await this.ensureCurrencyConfig();
    return this.mapCurrency(cur);
  }

  async updateCurrencyConfig(
    actor: AuthenticatedUser,
    input: AdminUpdateCurrencyConfigRequest,
  ): Promise<BillingCurrencyDisplay> {
    const before = await this.ensureCurrencyConfig();
    const data: Prisma.BillingCurrencyConfigUpdateInput = { updatedBy: actor.id };
    if (input.currencyCode !== undefined) data.currencyCode = input.currencyCode;
    if (input.displaySymbol !== undefined) data.displaySymbol = input.displaySymbol;
    if (input.symbolBefore !== undefined) data.symbolBefore = input.symbolBefore;
    if (input.useThousandsSeparator !== undefined) data.useThousandsSeparator = input.useThousandsSeparator;
    if (input.thousandsSeparator !== undefined) data.thousandsSeparator = input.thousandsSeparator;
    if (input.decimalDigits !== undefined) data.decimalDigits = input.decimalDigits;
    if (input.showReferenceUsd !== undefined) data.showReferenceUsd = input.showReferenceUsd;
    if (input.referenceUsdRate !== undefined) {
      data.referenceUsdRate = input.referenceUsdRate == null ? null : BigInt(input.referenceUsdRate);
    }
    if (input.usdToVndRateHundredths !== undefined) {
      data.usdToVndRateHundredths =
        input.usdToVndRateHundredths == null ? null : BigInt(input.usdToVndRateHundredths);
    }

    const after = await this.prisma.billingCurrencyConfig.update({
      where: { id: before.id },
      data,
    });
    await this.writeAudit(
      actor,
      'currency_config',
      CURRENCY_SCOPE,
      'update',
      this.diffCurrency(before),
      this.diffCurrency(after)
    );
    return this.mapCurrency(after);
  }

  // =========================================================================
  // PAGE CONTENT (/bang-gia)
  // =========================================================================
  async getPageContent(): Promise<BillingPageContentView> {
    const row = await this.ensurePageContent();
    return this.mapPageContent(row);
  }

  async updatePageContent(
    actor: AuthenticatedUser,
    input: AdminUpdatePageContentRequest,
  ): Promise<BillingPageContentView> {
    const before = await this.ensurePageContent();
    const data: Prisma.BillingPageContentUpdateInput = { updatedBy: actor.id };

    for (const key of PAGE_STRING_KEYS) {
      const value = input[key];
      if (value !== undefined) data[key] = value.trim();
    }
    for (const key of PAGE_NULLABLE_KEYS) {
      const value = input[key];
      if (value !== undefined) data[key] = value?.trim() ? value.trim() : null;
    }
    if (input.robotsIndex !== undefined) data.robotsIndex = input.robotsIndex;
    if (input.robotsFollow !== undefined) data.robotsFollow = input.robotsFollow;
    if (input.features !== undefined) {
      data.features = this.parseTextItems(input.features, 'features') as unknown as Prisma.JsonArray;
    }
    if (input.howSteps !== undefined) {
      data.howSteps = this.parseTextItems(input.howSteps, 'howSteps') as unknown as Prisma.JsonArray;
    }
    if (input.faqItems !== undefined) {
      data.faqItems = this.parseFaqItems(input.faqItems) as unknown as Prisma.JsonArray;
    }
    if (input.trustItems !== undefined) {
      data.trustItems = this.parseTextItems(input.trustItems, 'trustItems') as unknown as Prisma.JsonArray;
    }
    if (input.compareTables !== undefined) {
      data.compareTables =
        input.compareTables === null
          ? Prisma.JsonNull
          : (this.parseCompareTables(input.compareTables) as unknown as Prisma.InputJsonValue);
    }

    const after = await this.prisma.billingPageContent.update({
      where: { id: before.id },
      data,
    });
    await this.writeAudit(
      actor,
      'page_content',
      PAGE_SCOPE,
      'update',
      this.diffPageContent(before),
      this.diffPageContent(after),
    );
    return this.mapPageContent(after);
  }

  // =========================================================================
  // AUDIT LOG
  // =========================================================================
  async listAuditLogs(opts: { limit?: number; offset?: number; entity?: string } = {}): Promise<{
    items: BillingAdminAuditLogView[];
    total: number;
  }> {
    const where: Prisma.BillingAuditLogWhereInput = {};
    if (opts.entity) where.entity = opts.entity;
    const [items, total] = await Promise.all([
      this.prisma.billingAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      this.prisma.billingAuditLog.count({ where }),
    ]);
    return {
      items: items.map((a) => ({
        id: a.id,
        entity: a.entity,
        entityKey: a.entityKey,
        action: a.action,
        diff: a.diff as Record<string, unknown>,
        actorId: a.actorId,
        actorEmail: a.actorEmail,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
    };
  }

  // =========================================================================
  // HELPERS
  // =========================================================================
  private async ensureCreditPolicy(): Promise<CreditPolicyWithHighMatch> {
    const [existing, highMatch] = await Promise.all([
      this.prisma.billingCreditPolicy.findUnique({ where: { scope: POLICY_SCOPE } }),
      this.prisma.billingCreditPolicy.findUnique({ where: { scope: HIGH_MATCH_POLICY_SCOPE } }),
    ]);
    const base =
      existing ?? (await this.prisma.billingCreditPolicy.create({ data: { scope: POLICY_SCOPE } }));
    const high =
      highMatch ??
      (await this.prisma.billingCreditPolicy.create({
        data: { scope: HIGH_MATCH_POLICY_SCOPE, costPerProfile: 2 },
      }));
    return {
      ...base,
      costPerHighMatchProfile: high.costPerProfile,
    };
  }

  private async ensureCurrencyConfig(): Promise<BillingCurrencyConfig> {
    const existing = await this.prisma.billingCurrencyConfig.findUnique({ where: { scope: CURRENCY_SCOPE } });
    if (existing) return existing;
    return this.prisma.billingCurrencyConfig.create({ data: { scope: CURRENCY_SCOPE } });
  }

  private async ensurePageContent(): Promise<BillingPageContent> {
    const existing = await this.prisma.billingPageContent.findUnique({ where: { scope: PAGE_SCOPE } });
    if (existing) return existing;
    return this.prisma.billingPageContent.create({
      data: {
        scope: PAGE_SCOPE,
        features: DEFAULT_BILLING_PAGE_FEATURES as unknown as Prisma.JsonArray,
        howSteps: DEFAULT_BILLING_PAGE_HOW_STEPS as unknown as Prisma.JsonArray,
        faqItems: DEFAULT_BILLING_PAGE_FAQ as unknown as Prisma.JsonArray,
        trustItems: DEFAULT_BILLING_PAGE_TRUST as unknown as Prisma.JsonArray,
      },
    });
  }

  private parseTextItems(raw: unknown, label: string): BillingPageTextItem[] {
    if (!Array.isArray(raw)) throw new BadRequestException(`${label} phải là mảng`);
    return raw.map((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException(`${label}[${i}] không hợp lệ`);
      }
      const rec = item as Record<string, unknown>;
      const title = String(rec.title ?? '').trim();
      const desc = String(rec.desc ?? '').trim();
      if (!title) throw new BadRequestException(`${label}[${i}].title là bắt buộc`);
      return { title, desc };
    });
  }

  private parseFaqItems(raw: unknown): BillingPageFaqItem[] {
    if (!Array.isArray(raw)) throw new BadRequestException('faqItems phải là mảng');
    return raw.map((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException(`faqItems[${i}] không hợp lệ`);
      }
      const rec = item as Record<string, unknown>;
      const q = String(rec.q ?? '').trim();
      const a = String(rec.a ?? '').trim();
      if (!q) throw new BadRequestException(`faqItems[${i}].q là bắt buộc`);
      if (!a) throw new BadRequestException(`faqItems[${i}].a là bắt buộc`);
      return { q, a };
    });
  }

  private asTextItems(raw: unknown, fallback: BillingPageTextItem[]): BillingPageTextItem[] {
    if (!Array.isArray(raw) || raw.length === 0) return fallback;
    try {
      return this.parseTextItems(raw, 'list');
    } catch {
      return fallback;
    }
  }

  private parseCompareTables(raw: unknown): BillingCompareTables {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('compareTables không hợp lệ');
    }
    const rec = raw as Record<string, unknown>;
    return {
      platform: this.parseCompareTable(rec.platform, 'platform'),
      sourcing: this.parseCompareTable(rec.sourcing, 'sourcing'),
      credit: this.parseCompareTable(rec.credit, 'credit'),
    };
  }

  private parseCompareTable(raw: unknown, label: string): BillingCompareTable {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException(`compareTables.${label} không hợp lệ`);
    }
    const rec = raw as Record<string, unknown>;
    const insight = String(rec.insight ?? '').trim();
    if (insight.length > 600) throw new BadRequestException(`Câu gợi ý ${label} quá dài`);
    if (!Array.isArray(rec.columns)) throw new BadRequestException(`compareTables.${label}.columns phải là mảng`);
    if (rec.columns.length > 12) throw new BadRequestException(`Bảng ${label} tối đa 12 cột`);
    const columns = rec.columns.map((col, i) => {
      const name = String(col ?? '').trim();
      if (!name) throw new BadRequestException(`Cột ${label}[${i}] cần có tên`);
      if (name.length > 80) throw new BadRequestException(`Tên cột ${label}[${i}] quá dài`);
      return name;
    });
    if (!Array.isArray(rec.rows)) throw new BadRequestException(`compareTables.${label}.rows phải là mảng`);
    if (rec.rows.length > 40) throw new BadRequestException(`Bảng ${label} tối đa 40 dòng`);
    return {
      columns,
      insight,
      rows: rec.rows.map((row, i) => this.parseCompareRow(row, columns.length, `${label}[${i}]`)),
    };
  }

  private parseCompareRow(raw: unknown, columnCount: number, label: string): BillingCompareRow {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException(`${label} không hợp lệ`);
    }
    const rec = raw as Record<string, unknown>;
    const rowLabel = String(rec.label ?? '').trim();
    if (!rowLabel) throw new BadRequestException(`${label}.label là bắt buộc`);
    if (rowLabel.length > 160) throw new BadRequestException(`${label}.label quá dài`);
    const cellsRaw = Array.isArray(rec.cells) ? rec.cells : [];
    const cells = Array.from({ length: columnCount }, (_, i) => {
      const text = String(cellsRaw[i] ?? '').trim();
      if (text.length > 240) throw new BadRequestException(`${label}.cells[${i}] quá dài`);
      return text;
    });
    return { label: rowLabel, cells };
  }

  private asCompareTables(raw: unknown): BillingCompareTables | null {
    if (raw == null) return null;
    try {
      return this.parseCompareTables(raw);
    } catch {
      return null;
    }
  }

  private asFaqItems(raw: unknown, fallback: BillingPageFaqItem[]): BillingPageFaqItem[] {
    if (!Array.isArray(raw) || raw.length === 0) return fallback;
    try {
      return this.parseFaqItems(raw);
    } catch {
      return fallback;
    }
  }

  private mapPageContent(row: BillingPageContent): BillingPageContentView {
    return {
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      seoTitleRecruiter: row.seoTitleRecruiter,
      seoDescriptionRecruiter: row.seoDescriptionRecruiter,
      focusKeyword: row.focusKeyword,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImageUrl: row.ogImageUrl,
      ogImageAlt: row.ogImageAlt,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      heroBadge: row.heroBadge,
      heroHeading: row.heroHeading,
      heroHeadingAccent: row.heroHeadingAccent,
      heroSubtitle: row.heroSubtitle,
      heroSocialProof: row.heroSocialProof,
      heroCtaPrimary: row.heroCtaPrimary,
      heroCtaSecondary: row.heroCtaSecondary,
      recruiterKicker: row.recruiterKicker,
      recruiterHeading: row.recruiterHeading,
      recruiterSubtitle: row.recruiterSubtitle,
      platformTitle: row.platformTitle,
      platformSubtitle: row.platformSubtitle,
      sourcingTitle: row.sourcingTitle,
      sourcingSubtitle: row.sourcingSubtitle,
      creditTitle: row.creditTitle,
      creditSubtitle: row.creditSubtitle,
      featuresTitle: row.featuresTitle,
      featuresSubtitle: row.featuresSubtitle,
      compareTitle: row.compareTitle,
      compareSubtitle: row.compareSubtitle,
      howTitle: row.howTitle,
      howSubtitle: row.howSubtitle,
      howFooter: row.howFooter,
      faqTitle: row.faqTitle,
      faqSubtitle: row.faqSubtitle,
      contactTitle: row.contactTitle,
      contactSubtitle: row.contactSubtitle,
      finalCtaTitle: row.finalCtaTitle,
      finalCtaSubtitle: row.finalCtaSubtitle,
      footerTagline: row.footerTagline,
      consultNavText: row.consultNavText,
      contactEmail: row.contactEmail,
      contactEmailDesc: row.contactEmailDesc,
      contactHotline: row.contactHotline,
      contactHotlineHref: row.contactHotlineHref,
      contactHotlineDesc: row.contactHotlineDesc,
      contactZaloLabel: row.contactZaloLabel,
      contactZaloHref: row.contactZaloHref,
      contactZaloDesc: row.contactZaloDesc,
      features: this.asTextItems(row.features, DEFAULT_BILLING_PAGE_FEATURES),
      howSteps: this.asTextItems(row.howSteps, DEFAULT_BILLING_PAGE_HOW_STEPS),
      faqItems: this.asFaqItems(row.faqItems, DEFAULT_BILLING_PAGE_FAQ),
      trustItems: this.asTextItems(row.trustItems, DEFAULT_BILLING_PAGE_TRUST),
      compareTables: this.asCompareTables(row.compareTables),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private diffPageContent(row: BillingPageContent): Record<string, unknown> {
    return {
      seoTitle: row.seoTitle,
      seoTitleRecruiter: row.seoTitleRecruiter,
      heroHeading: row.heroHeading,
      contactEmail: row.contactEmail,
      contactHotline: row.contactHotline,
      contactZaloHref: row.contactZaloHref,
      robotsIndex: row.robotsIndex,
      featuresCount: Array.isArray(row.features) ? row.features.length : 0,
      howStepsCount: Array.isArray(row.howSteps) ? row.howSteps.length : 0,
      faqCount: Array.isArray(row.faqItems) ? row.faqItems.length : 0,
      trustCount: Array.isArray(row.trustItems) ? row.trustItems.length : 0,
      compareCustom: row.compareTables != null,
    };
  }

  private async writeAudit(
    actor: AuthenticatedUser,
    entity: string,
    entityKey: string,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null
  ): Promise<void> {
    const diff: Record<string, unknown> = {};
    if (before) diff.before = before;
    if (after) diff.after = after;
    await this.prisma.billingAuditLog.create({
      data: {
        entity,
        entityKey,
        action,
        diff: diff as Prisma.JsonObject,
        actorId: looksLikeUuid(actor.id) ? actor.id : null,
        actorEmail: actor.email ?? null,
      },
    });
  }

  // ---- Mappers ----
  private async getPlatformPlanView(id: string): Promise<BillingPlatformPlanView> {
    const [plan, policy] = await Promise.all([
      this.prisma.billingPlatformPlan.findUnique({
        where: { id },
        include: { actionCosts: true },
      }),
      this.ensureCreditPolicy(),
    ]);
    if (!plan) throw new NotFoundException('Không tìm thấy gói');
    return this.mapPlatformPlan(plan, policy);
  }

  private mapPlatformPlan(
    p: PlatformPlanWithCosts,
    policy?: BillingCreditPolicy | BillingCreditPolicyView | null,
  ): BillingPlatformPlanView {
    const policyView = policy && 'costPerProfile' in policy && 'updatedAt' in policy && typeof (policy as BillingCreditPolicyView).updatedAt === 'string'
      ? (policy as BillingCreditPolicyView)
      : policy
        ? this.mapCreditPolicy(policy as BillingCreditPolicy)
        : null;
    const promo = launchPromoFor('platform', p.code);
    const sale = applyLaunchPromo(p.priceVnd, promo.percent);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      priceVnd: p.priceVnd.toString(),
      promoPercent: promo.percent > 0 ? promo.percent : null,
      promoPriceVnd: sale.toString(),
      promoLabel: promo.label,
      billingUnit: p.billingUnit as 'per_jd' | 'per_month',
      durationDays: p.durationDays,
      jobPostQuota: p.jobPostQuota,
      creditQuota: p.creditQuota,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      features: (p.features as string[]) ?? [],
      actionCosts: this.mergeActionCosts(p.actionCosts ?? [], policyView),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private mergeActionCosts(
    rows: BillingPlanActionCost[] | BillingPlanActionCostView[],
    policy: BillingCreditPolicy | BillingCreditPolicyView | null,
  ): BillingPlanActionCostView[] {
    const policyView =
      policy && 'updatedAt' in policy && typeof (policy as BillingCreditPolicyView).updatedAt === 'string'
        ? (policy as BillingCreditPolicyView)
        : policy
          ? this.mapCreditPolicy(policy as BillingCreditPolicy)
          : null;
    const byAction = new Map(rows.map((r) => [r.action, r]));
    const defaults = defaultActionCostRows(policyView);
    return defaults.map((d) => {
      const existing = byAction.get(d.action);
      if (!existing) return d;
      return {
        action: d.action,
        cost: existing.cost,
        isActive: existing.isActive,
      };
    });
  }

  private async syncPlanActionCosts(
    planId: string,
    items?: { action: BillingPlanBillableAction; cost: number; isActive?: boolean }[],
  ): Promise<void> {
    const policy = await this.ensureCreditPolicy();
    const source = items?.length
      ? items.filter((i) => isBillableAction(i.action))
      : BILLING_PLAN_BILLABLE_ACTIONS.map((action) => ({
          action,
          cost: policyCostForAction(this.mapCreditPolicy(policy), action),
          isActive: true,
        }));

    for (const item of source) {
      if (!Number.isInteger(item.cost) || item.cost < 0) {
        throw new BadRequestException(`Cost của ${item.action} phải là số nguyên ≥ 0`);
      }
      await this.prisma.billingPlanActionCost.upsert({
        where: { planId_action: { planId, action: item.action } },
        create: {
          planId,
          action: item.action,
          cost: item.cost,
          isActive: item.isActive ?? true,
        },
        update: {
          cost: item.cost,
          isActive: item.isActive ?? true,
        },
      });
    }
  }

  private mapCompanyPlan(
    row: BillingCompanyPlan & { plan: BillingPlatformPlan },
  ): BillingCompanyPlanView {
    return {
      id: row.id,
      companyId: row.companyId,
      planId: row.planId,
      planCode: row.plan.code,
      planName: row.plan.name,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      isActive: row.isActive,
      note: row.note,
      customJobPostQuota: row.customJobPostQuota ?? null,
      customCreditQuota: row.customCreditQuota ?? null,
      customDurationDays: row.customDurationDays ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private scopePayload(input: {
    scopeItems?: AdminCreateSourcingPlanRequest['scopeItems'];
    serviceScope?: AdminCreateSourcingPlanRequest['serviceScope'];
  }): unknown[] {
    if (input.scopeItems) return parseSourcingScope(input.scopeItems);
    return input.serviceScope ?? [];
  }

  private mapSourcingPlan(s: BillingSourcingPlan): BillingSourcingPlanView {
    const promo = launchPromoFor('sourcing', s.code);
    const sale = applyLaunchPromo(s.feeVnd, promo.percent);
    const scopeItems = parseSourcingScope(s.serviceScope);
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      feeVnd: s.feeVnd.toString(),
      promoPercent: promo.percent > 0 ? promo.percent : null,
      promoPriceVnd: sale.toString(),
      promoLabel: promo.label,
      creditQuota: s.creditQuota,
      positionQuota: s.positionQuota,
      searchRoundQuota: s.searchRoundQuota,
      shortlistQuota: s.shortlistQuota,
      revisionQuota: s.revisionQuota,
      serviceScope: includedScopeCodes(scopeItems),
      scopeItems,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      isFeatured: s.isFeatured,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private mapCreditTopup(t: BillingCreditTopup): BillingCreditTopupView {
    return {
      id: t.id,
      name: t.name,
      creditCount: t.creditCount,
      priceVnd: t.priceVnd.toString(),
      unitPriceVnd: t.unitPriceVnd.toString(),
      badge: t.badge,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      isFeatured: t.isFeatured,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private mapCreditPolicy(p: CreditPolicyWithHighMatch): BillingCreditPolicyView {
    return {
      id: p.id,
      scope: p.scope,
      costPerProfile: p.costPerProfile,
      costPerHighMatchProfile: p.costPerHighMatchProfile ?? 2,
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

  private mapCurrency(c: BillingCurrencyConfig): BillingCurrencyDisplay {
    return {
      id: c.id,
      scope: c.scope,
      currencyCode: c.currencyCode,
      displaySymbol: c.displaySymbol,
      symbolBefore: c.symbolBefore,
      useThousandsSeparator: c.useThousandsSeparator,
      thousandsSeparator: c.thousandsSeparator,
      decimalDigits: c.decimalDigits,
      showReferenceUsd: c.showReferenceUsd,
      referenceUsdRate: c.referenceUsdRate?.toString() ?? null,
      usdToVndRateHundredths: c.usdToVndRateHundredths?.toString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  // ---- Diff helpers (chỉ lưu field thay đổi) ----
  private diffPlatformPlan(p: BillingPlatformPlan): Record<string, unknown> {
    return {
      name: p.name,
      priceVnd: p.priceVnd.toString(),
      billingUnit: p.billingUnit,
      durationDays: p.durationDays,
      jobPostQuota: p.jobPostQuota,
      creditQuota: p.creditQuota,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      features: p.features,
    };
  }
  private diffSourcingPlan(s: BillingSourcingPlan): Record<string, unknown> {
    return {
      name: s.name,
      feeVnd: s.feeVnd.toString(),
      positionQuota: s.positionQuota,
      searchRoundQuota: s.searchRoundQuota,
      shortlistQuota: s.shortlistQuota,
      revisionQuota: s.revisionQuota,
      creditQuota: s.creditQuota,
      serviceScope: s.serviceScope,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      isFeatured: s.isFeatured,
    };
  }
  private diffTopup(t: BillingCreditTopup): Record<string, unknown> {
    return {
      name: t.name,
      creditCount: t.creditCount,
      priceVnd: t.priceVnd.toString(),
      unitPriceVnd: t.unitPriceVnd.toString(),
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      isFeatured: t.isFeatured,
    };
  }
  private diffPolicy(p: CreditPolicyWithHighMatch): Record<string, unknown> {
    return {
      costPerProfile: p.costPerProfile,
      costPerHighMatchProfile: p.costPerHighMatchProfile ?? 2,
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
    };
  }
  private diffCurrency(c: BillingCurrencyConfig): Record<string, unknown> {
    return {
      currencyCode: c.currencyCode,
      displaySymbol: c.displaySymbol,
      symbolBefore: c.symbolBefore,
      useThousandsSeparator: c.useThousandsSeparator,
      thousandsSeparator: c.thousandsSeparator,
      decimalDigits: c.decimalDigits,
      showReferenceUsd: c.showReferenceUsd,
      referenceUsdRate: c.referenceUsdRate?.toString() ?? null,
      usdToVndRateHundredths: c.usdToVndRateHundredths?.toString() ?? null,
    };
  }
}
