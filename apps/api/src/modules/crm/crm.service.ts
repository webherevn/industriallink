import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  UserRole,
  type CreateCrmActivityRequest,
  type CreateCrmDealRequest,
  type CreateCrmLeadRequest,
  type CaptureCrmReferralRequest,
  type CaptureCrmReferralResponse,
  type CreateCrmPartnerClaimRequest,
  type CreateCrmPartnerRequest,
  type CrmCommissionView,
  type CrmCommissionEntryView,
  type CrmCommissionLedgerView,
  type CrmCommissionPeriodListView,
  type CloseCrmCommissionMonthResult,
  type CrmPartnerClaimView,
  type CrmPartnerSelfView,
  type CrmPayoutDayView,
  type CrmVatView,
  type CrmWalletTxnView,
  type UpdateCrmVatRequest,
  type UpdateCrmPayoutDayRequest,
  type UpdateCrmCommissionRequest,
  type RegisterCrmPartnerRequest,
  type CrmActivityType,
  type CrmActivityView,
  type CrmBoard,
  type CrmCompanyOption,
  type CrmTaxSuggestion,
  type CrmCompanyProfileView,
  type CrmUnclaimedCustomerView,
  type CrmOwnerOption,
  type UpdateCrmLeadRequest,
  type CrmDealView,
  type CrmLeadSource,
  type CrmLeadView,
  type CrmPlanKind,
  type CrmPartnerView,
  type CrmReferralSignupView,
  type CrmPlanOption,
  type CrmPaidInvoiceLedgerView,
  type CrmPaidOrderInvoiceView,
  type CrmRenewalView,
  type CrmFunnelReport,
  type CrmFunnelBucket,
  type CrmEnterpriseRequestView,
  type IssueCrmInvoiceRequest,
  type MoveCrmDealRequest,
} from '@industriallink/contracts';
import { DEFAULT_TENANT_ID } from '../../shared/common/constants';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { commissionVnd } from './commission-amount';
import { groupCommissionClose, previousVietnamPeriodMonth, vietnamMonthBounds, vietnamMonthHasEnded } from './commission-period';
import {
  commissionClosedNotice,
  payoutDayReminderNotice,
  shouldRemindPayoutDay,
  vatPercentOrEmpty,
  vietnamDateIso,
} from './commission-notices';
import { payoutDayOrDefault } from './commission-payout-day';
import { signedWalletBalance, walletRunningBalances } from './commission-wallet';
import { assignPaidOrders, pickDealForPayment } from './deal-payment';
import { paidActivitySummary } from './paid-activity';
import { normalizeReferralCode, referralForPayingAccount } from './referral-cookie';
import { referralSignupNotices } from './referral-signup-notice';

function walletTxnLabel(row: {
  kind: string;
  entry: { companyName: string; planName: string | null } | null;
  period: { periodMonth: string } | null;
}): string {
  if (row.kind === 'debit') {
    const [year, month] = (row.period?.periodMonth ?? '').split('-');
    return year && month ? `Đã chi kỳ tháng ${Number(month)}/${year}` : 'Đã chi kỳ';
  }
  const company = row.entry?.companyName ?? 'Khách thanh toán';
  return row.entry?.planName ? `${company} · ${row.entry.planName}` : company;
}

function periodStatusOf(status: string | undefined): CrmCommissionEntryView['periodStatus'] {
  if (status === 'closed' || status === 'payable' || status === 'paid') return status;
  return null;
}

const PIPELINE_CODE = 'ban_goi';
const CLAIM_LIMIT = 30;
const partnerClaims = { orderBy: { createdAt: 'desc' as const }, take: CLAIM_LIMIT };

/**
 * CRM ghi lead, deal, số hóa đơn của đơn đã thanh toán và khoản hoa hồng chờ đối soát.
 * Không tạo đơn thanh toán, không gán gói, không cộng Credit, không lệnh chi.
 */
@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async board(actor: AuthenticatedUser): Promise<CrmBoard> {
    const pipeline = await this.prisma.crmPipeline.findUnique({
      where: { code: PIPELINE_CODE },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!pipeline) throw new NotFoundException('Chưa có phễu bán gói');
    const own = this.ownScope(actor);
    const [leads, deals, activities] = await Promise.all([
      this.prisma.crmLead.findMany({
        where: own,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { partner: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.crmDeal.findMany({
        where: { pipelineId: pipeline.id, ...own },
        include: { stage: true, lead: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.crmActivity.findMany({
        where: own
          ? { OR: [{ lead: own }, { deal: own }] }
          : {},
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: {
          lead: { select: { companyName: true } },
          deal: { select: { lead: { select: { companyName: true } } } },
          billingOrder: { select: { orderInvoice: { select: { invoiceNumber: true } } } },
        },
      }),
    ]);
    const names = await this.ownerNames([
      ...leads.map((lead) => lead.ownerUserId),
      ...deals.map((deal) => deal.ownerUserId),
      ...activities.map((row) => row.createdByUserId),
    ]);
    const paid = await this.paymentsForDeals(deals);
    return {
      pipelineCode: pipeline.code,
      pipelineName: pipeline.name,
      stages: pipeline.stages.map((stage) => ({
        id: stage.id,
        code: stage.code,
        name: stage.name,
        sortOrder: stage.sortOrder,
        winProbability: stage.winProbability,
      })),
      leads: leads.map((lead) => this.mapLead(lead, names)),
      deals: deals.map((deal) => this.mapDeal(deal, names, paid.get(deal.id))),
      activities: activities.map((row) => this.mapActivity(row, names)),
    };
  }

  async renewals(actor: AuthenticatedUser): Promise<CrmRenewalView[]> {
    const now = new Date();
    const until = new Date(now.getTime() + 30 * 86_400_000);
    const since = new Date(now.getTime() - 14 * 86_400_000);
    const window = { gte: since, lte: until };
    const [platform, sourcing] = await Promise.all([
      this.prisma.billingCompanyPlan.findMany({
        where: { isActive: true, endsAt: window },
        include: { plan: { select: { code: true, name: true } } },
      }),
      this.prisma.billingCompanySourcingPlan.findMany({
        where: { isActive: true, endsAt: window },
        include: { plan: { select: { code: true, name: true } } },
      }),
    ]);
    const companyIds = [...new Set([...platform, ...sourcing].map((row) => row.companyId))];
    if (companyIds.length === 0) return [];
    const [companies, leads, orders, credits, jobs] = await Promise.all([
      this.prisma.company.findMany({
        where: { id: { in: companyIds }, isDeleted: false },
        select: { id: true, name: true },
      }),
      this.prisma.crmLead.findMany({
        where: { companyId: { in: companyIds }, status: { not: 'unqualified' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, companyId: true, status: true, ownerUserId: true },
      }),
      this.prisma.billingOrder.findMany({
        where: {
          companyId: { in: companyIds },
          status: 'paid',
          priceVndSnapshot: { gt: 0 },
          paidAt: { not: null },
          kind: { in: ['platform', 'sourcing'] },
        },
        orderBy: { paidAt: 'desc' },
        select: { companyId: true, kind: true, planCode: true, paidAt: true },
      }),
      this.prisma.billingCreditAccount.findMany({
        where: { companyId: { in: companyIds } },
        select: { companyId: true, balance: true },
      }),
      this.prisma.job.groupBy({
        by: ['companyId'],
        where: { companyId: { in: companyIds }, isDeleted: false, status: 'published' },
        _count: { _all: true },
      }),
    ]);
    const companyName = new Map(companies.map((company) => [company.id, company.name]));
    const creditByCompany = new Map(credits.map((row) => [row.companyId, row.balance]));
    const jobsByCompany = new Map(jobs.map((row) => [row.companyId, row._count._all]));
    const scopedLeads = this.seesAll(actor) ? leads : leads.filter((lead) => lead.ownerUserId === actor.id);
    const leadByCompany = new Map<string, string>();
    for (const lead of scopedLeads) {
      if (!lead.companyId) continue;
      const current = leads.find((item) => item.id === leadByCompany.get(lead.companyId!));
      if (!current || (current.status !== 'open' && lead.status === 'open')) {
        leadByCompany.set(lead.companyId, lead.id);
      }
    }
    const rows: CrmRenewalView[] = [];
    for (const row of platform) {
      if (!row.endsAt || !companyName.has(row.companyId)) continue;
      rows.push({
        companyId: row.companyId,
        companyName: companyName.get(row.companyId)!,
        kind: 'platform',
        planCode: row.plan.code,
        planName: row.plan.name,
        endsAt: row.endsAt.toISOString(),
        daysLeft: daysUntil(row.endsAt, now),
        leadId: leadByCompany.get(row.companyId) ?? null,
        cyclePaidAt: paidAtInCycle(orders, row.companyId, 'platform', row.plan.code, row.startsAt, row.endsAt),
        creditBalance: creditByCompany.get(row.companyId) ?? 0,
        openJobCount: jobsByCompany.get(row.companyId) ?? 0,
      });
    }
    for (const row of sourcing) {
      if (!row.endsAt || !companyName.has(row.companyId)) continue;
      rows.push({
        companyId: row.companyId,
        companyName: companyName.get(row.companyId)!,
        kind: 'sourcing',
        planCode: row.plan.code,
        planName: row.plan.name,
        endsAt: row.endsAt.toISOString(),
        daysLeft: daysUntil(row.endsAt, now),
        leadId: leadByCompany.get(row.companyId) ?? null,
        cyclePaidAt: paidAtInCycle(orders, row.companyId, 'sourcing', row.plan.code, row.startsAt, row.endsAt),
        creditBalance: creditByCompany.get(row.companyId) ?? 0,
        openJobCount: jobsByCompany.get(row.companyId) ?? 0,
      });
    }
    const visible = this.seesAll(actor) ? rows : rows.filter((row) => row.leadId);
    return visible.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  /** Gợi ý theo mã số thuế. Công ty trên inlink trước, đủ 10 hoặc 13 số thì hỏi thêm sổ thuế. Không tạo lead. */
  async taxSuggestions(raw: string): Promise<CrmTaxSuggestion[]> {
    const digits = raw.replace(/\D/g, '').slice(0, 13);
    if (digits.length < 2) return [];
    const companies = await this.prisma.company.findMany({
      where: { isDeleted: false, taxCode: { contains: digits } },
      select: { id: true, name: true, taxCode: true, address: true },
      orderBy: { name: 'asc' },
      take: 8,
    });
    const rows: CrmTaxSuggestion[] = companies.flatMap((company) => {
      const taxCode = claimTax(company.taxCode);
      if (!taxCode) return [];
      return [{
        taxCode,
        companyName: company.name,
        address: company.address,
        companyId: company.id,
        source: 'inlink' as const,
      }];
    });
    const complete = digits.length === 10 || digits.length === 13;
    if (complete && !rows.some((row) => row.taxCode === digits)) {
      const registry = await this.lookupTaxRegistry(digits);
      if (registry) rows.unshift(registry);
    }
    return rows;
  }

  async searchCompanies(query: string): Promise<CrmCompanyOption[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    return this.prisma.company.findMany({
      where: {
        isDeleted: false,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { taxCode: { contains: q } },
        ],
      },
      select: { id: true, name: true, taxCode: true, address: true },
      orderBy: { name: 'asc' },
      take: 8,
    });
  }

  async plans(): Promise<CrmPlanOption[]> {
    const [platform, sourcing] = await Promise.all([
      this.prisma.billingPlatformPlan.findMany({
        where: { isActive: true, code: { not: 'ENTERPRISE' } },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.billingSourcingPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    return [
      ...platform.map((plan) => ({
        kind: 'platform' as const,
        code: plan.code,
        name: plan.name,
        priceVnd: plan.priceVnd.toString(),
      })),
      ...sourcing.map((plan) => ({
        kind: 'sourcing' as const,
        code: plan.code,
        name: plan.name,
        priceVnd: plan.feeVnd.toString(),
      })),
    ];
  }

  async partners(actor: AuthenticatedUser): Promise<CrmPartnerView[]> {
    const rows = await this.prisma.crmPartner.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { claims: partnerClaims },
    });
    const ids = rows.map((row) => row.id);
    await this.ensureWalletCredits(ids);
    const [pending, signups, wallets] = await Promise.all([
      this.pendingByPartner(actor, ids),
      this.unpaidSignups(ids),
      this.walletBalances(ids),
    ]);
    return rows.map((row) => this.mapPartner(row, pending.get(row.id), signups.get(row.id) ?? [], wallets.get(row.id) ?? 0n));
  }

  async createPartner(actor: AuthenticatedUser, input: CreateCrmPartnerRequest): Promise<CrmPartnerView> {
    const name = input.name?.trim();
    const phone = normalizePhone(input.phone ?? '');
    if (!name || name.length < 2 || phone.length < 9) {
      throw new BadRequestException('Cần tên cộng tác viên và số điện thoại');
    }
    const existing = await this.prisma.crmPartner.findUnique({ where: { phone } });
    if (existing) throw new BadRequestException('Số này đã có cộng tác viên');
    const row = await this.prisma.crmPartner.create({
      data: {
        name,
        phone,
        code: await this.nextPartnerCode(),
        createdByUserId: actor.id,
      },
    });
    return this.mapPartner(row);
  }

  async myPartner(actor: AuthenticatedUser): Promise<CrmPartnerSelfView> {
    const [row, commissionPercent, payoutDay] = await Promise.all([
      this.prisma.crmPartner.findUnique({
        where: { userId: actor.id },
        include: { claims: partnerClaims },
      }),
      this.commissionPercent(),
      this.storedPayoutDay(),
    ]);
    const commissions = row ? await this.entriesForPartner(row.id, row.name, row.code) : [];
    const pendingLines = commissions.filter((entry) => entry.periodMonth == null);
    const pending = {
      count: pendingLines.length,
      amount: pendingLines.reduce((sum, entry) => sum + BigInt(entry.commissionVnd), 0n),
    };
    if (row) await this.ensureWalletCredits([row.id]);
    const signups = row ? (await this.unpaidSignups([row.id])).get(row.id) ?? [] : [];
    const walletBalance = row ? (await this.walletBalances([row.id])).get(row.id) ?? 0n : 0n;
    const walletTxns = row ? await this.walletStatement(row.id) : [];
    return {
      partner: row ? this.mapPartner(row, pending, signups, walletBalance) : null,
      commissionPercent,
      payoutDay,
      walletTxns,
      commissions,
    };
  }

  async payoutDay(actor: AuthenticatedUser): Promise<CrmPayoutDayView> {
    return {
      day: await this.storedPayoutDay(),
      canEdit: actor.role === UserRole.SuperAdmin,
    };
  }

  /** Đặt ngày kế toán ghi đã chi. Không trừ ví và không chuyển khoản. */
  async setPayoutDay(actor: AuthenticatedUser, input: UpdateCrmPayoutDayRequest): Promise<CrmPayoutDayView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin đặt ngày chi hoa hồng');
    }
    const day = input.day;
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      throw new BadRequestException('Ngày chi là số nguyên từ 1 đến 28');
    }
    await this.prisma.crmCommissionPayoutSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', payoutDay: day, updatedByUserId: actor.id },
      update: { payoutDay: day, updatedByUserId: actor.id },
    });
    return { day, canEdit: true };
  }

  async commission(actor: AuthenticatedUser): Promise<CrmCommissionView> {
    return {
      percent: await this.commissionPercent(),
      canEdit: actor.role === UserRole.SuperAdmin,
    };
  }

  async setCommission(actor: AuthenticatedUser, input: UpdateCrmCommissionRequest): Promise<CrmCommissionView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin đặt tỷ lệ hoa hồng');
    }
    const percent = input.percent;
    if (!Number.isInteger(percent) || percent < 0 || percent > 30) {
      throw new BadRequestException('Tỷ lệ hoa hồng là số nguyên từ 0 đến 30');
    }
    await this.prisma.crmCommissionSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', percent, updatedByUserId: actor.id },
      update: { percent, updatedByUserId: actor.id },
    });
    return { percent, canEdit: true };
  }

  /**
   * Ghi một dòng khi nhà tuyển dụng đăng ký trong hạn cookie.
   * Không tạo hoa hồng, không tạo đơn và không bật gói.
   */
  async recordReferralSignup(input: {
    cookie: string | null | undefined;
    userId: string;
    role: string;
    displayName: string;
    registeredAt: Date;
  }): Promise<void> {
    const stamp = referralForPayingAccount({
      cookie: input.cookie,
      role: input.role,
      userCreatedAt: input.registeredAt,
    });
    if (!stamp) return;
    const partner = await this.prisma.crmPartner.findUnique({
      where: { code: stamp.code },
      select: { id: true, code: true, userId: true, createdByUserId: true },
    });
    if (!partner) return;
    const displayName = input.displayName.trim().slice(0, 160);
    if (displayName.length < 1) return;
    try {
      await this.prisma.crmReferralSignup.create({
        data: {
          partnerId: partner.id,
          userId: input.userId,
          displayName,
          capturedAt: stamp.capturedAt,
          registeredAt: input.registeredAt,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
    await this.notifyReferralSignup(partner, displayName);
  }

  private async notifyReferralSignup(
    partner: { id: string; code: string; userId: string | null; createdByUserId: string },
    displayName: string,
  ): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { id: partner.createdByUserId },
      select: { role: true },
    });
    const notices = referralSignupNotices({
      partnerCode: partner.code,
      partnerUserId: partner.userId,
      createdByUserId: partner.createdByUserId,
      createdByRole: owner?.role ?? null,
      displayName,
    });
    await Promise.all(
      notices.map(async (notice) => {
        try {
          await this.notifications.createInApp({
            tenantId: DEFAULT_TENANT_ID,
            userId: notice.userId,
            type: 'crm.referral_signup',
            title: notice.title,
            body: notice.body,
            link: notice.link,
            entityType: 'crm.partner',
            entityId: partner.id,
          });
        } catch (err) {
          this.logger.error(`Không gửi được thông báo đăng ký giới thiệu: ${String(err)}`);
        }
      }),
    );
  }

  async referralCodeForCookie(raw: string | null | undefined): Promise<string | null> {
    const code = normalizeReferralCode(raw);
    if (!code) return null;
    const partner = await this.prisma.crmPartner.findUnique({ where: { code }, select: { id: true } });
    return partner ? code : null;
  }

  /**
   * Ghi một dòng khi đơn gói đã thanh toán. Không gọi từ bước Đã chốt.
   * Mã cookie trên đơn được ưu tiên. Không ghi nạp Credit hoặc đơn 0 đồng.
   */
  async recordPaidOrderCommission(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      companyId: string;
      kind: string;
      planCode: string | null;
      planName: string | null;
      priceVndSnapshot: bigint;
      paidAt: Date;
      referralCode?: string | null;
    },
  ): Promise<void> {
    if (order.kind !== 'platform' && order.kind !== 'sourcing') return;
    const setting = await tx.crmCommissionSetting.findUnique({
      where: { id: 'default' },
      select: { percent: true },
    });
    if (!setting) return;
    const amount = commissionVnd(order.priceVndSnapshot, setting.percent);
    if (amount <= 0n) return;

    const already = await tx.crmCommissionEntry.findUnique({
      where: { billingOrderId: order.id },
      select: { id: true },
    });
    if (already) return;

    const partner = await this.partnerForPaidCompany(tx, order.companyId, order.referralCode);
    if (!partner) return;
    const company = await tx.company.findUnique({
      where: { id: order.companyId },
      select: { name: true },
    });
    if (!company) return;

    try {
      const entry = await tx.crmCommissionEntry.create({
        data: {
          partnerId: partner.id,
          companyId: order.companyId,
          companyName: company.name,
          billingOrderId: order.id,
          orderKind: order.kind,
          planCode: order.planCode,
          planName: order.planName,
          paidAmountVnd: order.priceVndSnapshot,
          percent: setting.percent,
          commissionVnd: amount,
          status: 'pending_reconcile',
          paidAt: order.paidAt,
        },
        select: { id: true },
      });
      await this.creditCommissionWallet(tx, {
        partnerId: partner.id,
        commissionEntryId: entry.id,
        amountVnd: amount,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
  }

  /**
   * Ghi một dòng nhật ký cho deal cùng công ty, cùng gói.
   * Không đổi bước, không bật gói và không tạo hoa hồng.
   */
  async recordPaidOrderActivity(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      companyId: string;
      kind: string;
      planCode: string | null;
      planName: string | null;
      priceVndSnapshot: bigint;
      paidAt: Date;
    },
  ): Promise<void> {
    if ((order.kind !== 'platform' && order.kind !== 'sourcing') || !order.planCode || order.priceVndSnapshot <= 0n) return;
    const existing = await tx.crmActivity.findUnique({
      where: { billingOrderId: order.id },
      select: { id: true },
    });
    if (existing) return;
    const deals = await tx.crmDeal.findMany({
      where: { companyId: order.companyId, planKind: order.kind, planCode: order.planCode },
      include: { stage: { select: { code: true } } },
    });
    const picked = pickDealForPayment(
      deals
        .filter((row) => row.createdAt.getTime() <= order.paidAt.getTime())
        .map((row) => ({
          id: row.id,
          updatedAt: row.updatedAt,
          stageCode: row.stage.code,
        })),
    );
    const deal = picked ? deals.find((row) => row.id === picked.id) : undefined;
    if (!deal) return;
    try {
      await tx.crmActivity.create({
        data: {
          leadId: deal.leadId,
          dealId: deal.id,
          activityType: 'payment',
          summary: paidActivitySummary(order),
          createdByUserId: deal.ownerUserId,
          billingOrderId: order.id,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
  }

  async commissionLedger(actor: AuthenticatedUser): Promise<CrmCommissionLedgerView> {
    const rows = await this.prisma.crmCommissionEntry.findMany({
      where: { periodId: null },
      orderBy: { paidAt: 'desc' },
      take: 200,
      include: {
        partner: { select: { id: true, name: true, code: true, createdByUserId: true } },
        billingOrder: { select: { orderInvoice: { select: { invoiceNumber: true } } } },
      },
    });
    const visible = await this.visibleCommissionRows(actor, rows);
    const pendingTotalVnd = visible.reduce((sum, row) => sum + row.commissionVnd, 0n);
    return {
      entries: visible.map((row) =>
        this.mapCommissionEntry(row, row.partner.name, row.partner.code, row.billingOrder.orderInvoice?.invoiceNumber ?? null, null, null),
      ),
      pendingTotalVnd: pendingTotalVnd.toString(),
    };
  }

  async commissionPeriods(actor: AuthenticatedUser): Promise<CrmCommissionPeriodListView> {
    const rows = await this.prisma.crmCommissionPeriod.findMany({
      orderBy: [{ periodMonth: 'desc' }, { closedAt: 'desc' }],
      take: 200,
      include: { partner: { select: { name: true, code: true, createdByUserId: true } } },
    });
    const visible = await this.visiblePeriods(actor, rows);
    return {
      periods: visible.map((row) => this.mapCommissionPeriod(row)),
      canClose: actor.role === UserRole.SuperAdmin,
    };
  }

  async closeCommissionMonth(actor: AuthenticatedUser, periodMonth: string): Promise<CloseCrmCommissionMonthResult> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin chốt kỳ hoa hồng');
    }
    const closedCount = await this.writeCommissionClose(periodMonth, actor.id);
    const list = await this.commissionPeriods(actor);
    return { ...list, closedCount };
  }

  /** Chốt tháng đã qua hết ngày cuối. Không làm gì khi tháng đó không còn khoản mới. */
  async autoCloseFinishedCommissionMonth(now = new Date()): Promise<number> {
    const periodMonth = previousVietnamPeriodMonth(now);
    try {
      const closed = await this.writeCommissionClose(periodMonth, null);
      if (closed > 0) await this.notifySuperAdmins(commissionClosedNotice(periodMonth, closed), 'crm.commission_closed');
      return closed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'Tháng này không có khoản chờ chốt' || message === 'Tháng này đã chốt') return 0;
      this.logger.error(`Không tự chốt được kỳ ${periodMonth}: ${message}`);
      return 0;
    }
  }

  /** Nhắc một lần vào ngày chi nếu còn kỳ chờ ghi đã chi. Không trừ ví. */
  async remindCommissionPayoutDay(now = new Date()): Promise<boolean> {
    const todayIso = vietnamDateIso(now);
    const setting = await this.prisma.crmCommissionPayoutSetting.findUnique({
      where: { id: 'default' },
      select: { payoutDay: true, remindedOn: true },
    });
    const day = payoutDayOrDefault(setting?.payoutDay);
    const payableCount = await this.prisma.crmCommissionPeriod.count({ where: { status: 'payable' } });
    if (!shouldRemindPayoutDay({ todayIso, payoutDay: day, remindedOn: setting?.remindedOn ?? null, payableCount })) {
      return false;
    }
    const claimed = await this.prisma.crmCommissionPayoutSetting.updateMany({
      where: {
        id: 'default',
        OR: [{ remindedOn: null }, { remindedOn: { not: todayIso } }],
      },
      data: { remindedOn: todayIso },
    });
    if (claimed.count !== 1) return false;
    await this.notifySuperAdmins(payoutDayReminderNotice(day, payableCount), 'crm.payout_day');
    return true;
  }

  async vat(actor: AuthenticatedUser): Promise<CrmVatView> {
    return {
      percent: await this.storedVatPercent(),
      canEdit: actor.role === UserRole.SuperAdmin,
    };
  }

  /** Đặt thuế suất. Không đổi giá niêm yết và không cộng vào đơn đã thanh toán. */
  async setVat(actor: AuthenticatedUser, input: UpdateCrmVatRequest): Promise<CrmVatView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin đặt thuế suất');
    }
    const percent = vatPercentOrEmpty(input.percent);
    if (percent == null) throw new BadRequestException('Thuế suất là số nguyên từ 0 đến 100');
    await this.prisma.crmVatSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', percent, updatedByUserId: actor.id },
      update: { percent, updatedByUserId: actor.id },
    });
    return { percent, canEdit: true };
  }

  private async writeCommissionClose(periodMonth: string, closedByUserId: string | null): Promise<number> {
    const bounds = vietnamMonthBounds(periodMonth ?? '');
    if (!bounds) throw new BadRequestException('Tháng không hợp lệ');
    if (!vietnamMonthHasEnded(periodMonth)) {
      throw new BadRequestException('Chỉ chốt tháng đã kết thúc');
    }
    const entries = await this.prisma.crmCommissionEntry.findMany({
      where: {
        status: 'pending_reconcile',
        periodId: null,
        paidAt: { gte: bounds.start, lt: bounds.end },
      },
      select: { id: true, partnerId: true, paidAmountVnd: true, commissionVnd: true },
    });
    const existing = await this.prisma.crmCommissionPeriod.findMany({
      where: { periodMonth },
      select: { partnerId: true },
    });
    const taken = new Set(existing.map((row) => row.partnerId));
    const groups = groupCommissionClose(entries).filter((group) => !taken.has(group.partnerId));
    if (groups.length === 0) {
      throw new BadRequestException(entries.length === 0 ? 'Tháng này không có khoản chờ chốt' : 'Tháng này đã chốt');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const group of groups) {
          const period = await tx.crmCommissionPeriod.create({
            data: {
              partnerId: group.partnerId,
              periodMonth,
              paidAmountVnd: group.paidAmountVnd,
              commissionVnd: group.commissionVnd,
              entryCount: group.entryCount,
              status: 'closed',
              closedByUserId,
            },
          });
          const linked = await tx.crmCommissionEntry.updateMany({
            where: { id: { in: group.ids }, periodId: null },
            data: { periodId: period.id },
          });
          if (linked.count !== group.ids.length) {
            throw new BadRequestException('Kỳ đang được chốt');
          }
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Tháng này đã chốt');
      }
      throw err;
    }
    return groups.length;
  }

  /** Mở quyền chi cho một kỳ đã chốt. Không trừ ví. */
  async allowCommissionPayout(actor: AuthenticatedUser, periodId: string): Promise<CrmCommissionPeriodListView['periods'][number]> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin cho phép chi hoa hồng');
    }
    try {
      const updated = await this.prisma.crmCommissionPeriod.updateMany({
        where: { id: periodId, status: 'closed' },
        data: { status: 'payable', approvedAt: new Date(), approvedByUserId: actor.id },
      });
      if (updated.count === 0) {
        const existing = await this.prisma.crmCommissionPeriod.findUnique({
          where: { id: periodId },
          select: { id: true },
        });
        if (!existing) throw new NotFoundException('Không tìm thấy kỳ chốt');
        throw new BadRequestException('Kỳ này đã chuyển kế toán');
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2023' || err.code === 'P2025')) {
        throw new NotFoundException('Không tìm thấy kỳ chốt');
      }
      throw err;
    }
    const row = await this.prisma.crmCommissionPeriod.findUniqueOrThrow({
      where: { id: periodId },
      include: { partner: { select: { name: true, code: true, createdByUserId: true } } },
    });
    return this.mapCommissionPeriod(row);
  }

  /** Ghi đã chi một kỳ kế toán đang giữ. Trừ đúng số hoa hồng khỏi ví inlink. Không chuyển khoản. */
  async markCommissionPaid(actor: AuthenticatedUser, periodId: string): Promise<CrmCommissionPeriodListView['periods'][number]> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin ghi đã chi hoa hồng');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const period = await tx.crmCommissionPeriod.findUnique({
          where: { id: periodId },
          select: { id: true, partnerId: true, status: true, commissionVnd: true },
        });
        if (!period) throw new NotFoundException('Không tìm thấy kỳ chốt');
        if (period.status === 'paid') throw new BadRequestException('Kỳ này đã chi');
        if (period.status !== 'payable') throw new BadRequestException('Kỳ này chưa được phép chi');

        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "crm"."crm_commission_wallet"
          WHERE "partner_id" = ${period.partnerId}::uuid
          FOR UPDATE
        `;
        const wallet = locked[0];
        if (!wallet) throw new BadRequestException('Chưa có ví hoa hồng');

        const txns = await tx.crmCommissionWalletTxn.findMany({
          where: { partnerId: period.partnerId },
          select: { kind: true, amountVnd: true },
        });
        if (signedWalletBalance(txns) < period.commissionVnd) {
          throw new BadRequestException('Số dư ví không đủ để chi kỳ này');
        }

        const updated = await tx.crmCommissionPeriod.updateMany({
          where: { id: period.id, status: 'payable' },
          data: { status: 'paid', paidAt: new Date(), paidByUserId: actor.id },
        });
        if (updated.count !== 1) throw new BadRequestException('Kỳ này đã chi');

        await tx.crmCommissionWalletTxn.create({
          data: {
            walletId: wallet.id,
            partnerId: period.partnerId,
            periodId: period.id,
            amountVnd: period.commissionVnd,
            kind: 'debit',
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2023' || err.code === 'P2025') throw new NotFoundException('Không tìm thấy kỳ chốt');
        if (err.code === 'P2002') throw new BadRequestException('Kỳ này đã chi');
      }
      throw err;
    }
    const row = await this.prisma.crmCommissionPeriod.findUniqueOrThrow({
      where: { id: periodId },
      include: { partner: { select: { name: true, code: true, createdByUserId: true } } },
    });
    return this.mapCommissionPeriod(row);
  }

  async registerPartner(actor: AuthenticatedUser, input: RegisterCrmPartnerRequest): Promise<CrmPartnerView> {
    const existing = await this.prisma.crmPartner.findUnique({ where: { userId: actor.id } });
    if (existing) return this.mapPartner(existing);

    const phone = normalizePhone(input.phone ?? '');
    const name = actor.displayName?.trim() || 'Cộng tác viên';
    if (phone.length < 9) throw new BadRequestException('Cần số điện thoại');

    const byPhone = await this.prisma.crmPartner.findUnique({ where: { phone } });
    if (byPhone) throw new BadRequestException('Số này đã có cộng tác viên');

    const row = await this.prisma.crmPartner.create({
      data: {
        name,
        phone,
        code: await this.nextPartnerCode(),
        userId: actor.id,
        createdByUserId: actor.id,
      },
    });
    return this.mapPartner(row);
  }

  async captureReferral(input: CaptureCrmReferralRequest): Promise<CaptureCrmReferralResponse> {
    const trap = input.website?.trim() ?? '';
    if (trap.length > 0) return { ok: true };

    const code = input.code?.trim().toUpperCase() ?? '';
    if (!/^CTV[0-9A-F]{4}$/.test(code)) {
      throw new BadRequestException('Mã giới thiệu không hợp lệ');
    }
    const partner = await this.prisma.crmPartner.findUnique({ where: { code } });
    if (!partner) throw new BadRequestException('Mã giới thiệu không hợp lệ');

    const companyName = clip(input.companyName, 160);
    const contactName = clip(input.contactName, 80);
    const phone = normalizePhone(input.contactPhone ?? '');
    const taxCode = claimTax(input.taxCode);
    if ((input.taxCode?.trim() ?? '') !== '' && !taxCode) {
      throw new BadRequestException('Mã số thuế không hợp lệ');
    }
    if (companyName.length < 2 || contactName.length < 2 || phone.length < 9 || phone.length > 15) {
      throw new BadRequestException('Cần tên công ty, người liên hệ và số điện thoại');
    }
    if (taxCode) {
      const claim = await this.prisma.crmPartnerClaim.findUnique({ where: { taxCode }, select: { partnerId: true } });
      if (claim && claim.partnerId !== partner.id) return { ok: true };
    }

    const duplicate = await this.prisma.crmLead.findFirst({
      where: {
        status: { not: 'unqualified' },
        OR: [...(taxCode ? [{ taxCode }] : []), { contactPhone: phone }],
      },
      select: { id: true },
    });
    if (duplicate) return { ok: true };

    const ownerUserId = await this.referralOwnerId(partner.createdByUserId);
    const companyId = await this.resolveCompanyId(null, taxCode);
    const lead = await this.prisma.crmLead.create({
      data: {
        leadCode: await this.nextCode('LD'),
        companyName,
        taxCode,
        contactName,
        contactPhone: phone,
        companyId,
        source: 'partner',
        partnerId: partner.id,
        ownerUserId,
      },
    });
    await this.prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'note',
        summary: `Khách để lại qua mã ${partner.code}. Chưa gán gói.`,
        createdByUserId: ownerUserId,
      },
    });
    if (taxCode) await this.lockTaxCode(partner.id, companyName, taxCode, phone);
    return { ok: true };
  }

  async addPartnerClaim(
    actor: AuthenticatedUser,
    partnerId: string,
    input: CreateCrmPartnerClaimRequest,
  ): Promise<CrmPartnerClaimView> {
    const partner = await this.prisma.crmPartner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Không tìm thấy cộng tác viên');
    this.assertClaimWriter(actor, partner);
    return this.insertClaim(partner.id, input);
  }

  async addMyClaim(
    actor: AuthenticatedUser,
    input: CreateCrmPartnerClaimRequest,
  ): Promise<CrmPartnerClaimView> {
    const partner = await this.prisma.crmPartner.findUnique({ where: { userId: actor.id } });
    if (!partner) throw new BadRequestException('Đăng ký cộng tác viên trước khi khóa mã số thuế');
    return this.insertClaim(partner.id, input);
  }

  async createLead(actor: AuthenticatedUser, input: CreateCrmLeadRequest): Promise<CrmLeadView> {
    const companyName = input.companyName?.trim();
    const contactName = input.contactName?.trim();
    const phone = normalizePhone(input.contactPhone ?? '');
    const taxCode = this.readTax(input.taxCode);
    const source = leadSource(input.source);
    if (!companyName || !contactName || phone.length < 9) {
      throw new BadRequestException('Cần tên công ty, người liên hệ và số điện thoại');
    }
    if (!source) throw new BadRequestException('Chọn nguồn khách: Web, Zalo, sự kiện hoặc cộng tác viên');
    const partner = source === 'partner' ? await this.requirePartner(input.partnerId) : null;
    const companyId = await this.resolveCompanyId(input.companyId, taxCode);
    await this.assertNoDuplicate(taxCode, phone, undefined, companyId);

    const lead = await this.prisma.crmLead.create({
      data: {
        leadCode: await this.nextCode('LD'),
        companyName,
        taxCode,
        contactName,
        contactPhone: phone,
        contactEmail: input.contactEmail?.trim() || null,
        industry: input.industry?.trim() || null,
        address: clip(input.address, 300) || null,
        companyId,
        source,
        partnerId: partner?.id ?? null,
        ownerUserId: actor.id,
      },
      include: { partner: { select: { id: true, name: true, code: true } } },
    });
    await this.prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'note',
        summary: partner
          ? `Tạo lead ${lead.leadCode} từ cộng tác viên ${partner.name} (${partner.code})`
          : `Tạo lead ${lead.leadCode} từ ${sourceLabel(source)}`,
        createdByUserId: actor.id,
      },
    });
    return this.mapLead(lead, await this.ownerNames([actor.id]));
  }

  /** Công ty đã trả gói trên web và chưa có lead. Không gán gói. */
  async unclaimedCustomers(): Promise<CrmUnclaimedCustomerView[]> {
    const orders = await this.prisma.billingOrder.findMany({
      where: this.paidPlanOrderWhere(),
      orderBy: { paidAt: 'desc' },
      select: { companyId: true, paidAt: true, priceVndSnapshot: true, planName: true },
    });
    const latest = new Map<string, (typeof orders)[number]>();
    for (const order of orders) {
      if (order.paidAt && !latest.has(order.companyId)) latest.set(order.companyId, order);
    }
    const companyIds = [...latest.keys()];
    if (companyIds.length === 0) return [];
    const [leads, companies, members] = await Promise.all([
      this.prisma.crmLead.findMany({
        where: { companyId: { in: companyIds }, status: { not: 'unqualified' } },
        select: { companyId: true },
      }),
      this.prisma.company.findMany({
        where: { id: { in: companyIds }, isDeleted: false },
        select: { id: true, name: true, taxCode: true },
      }),
      this.prisma.companyMember.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          companyId: true,
          roleInCompany: true,
          user: { select: { displayName: true, email: true, isDeleted: true } },
        },
      }),
    ]);
    const owned = new Set(leads.map((lead) => lead.companyId));
    const companyById = new Map(companies.map((company) => [company.id, company]));
    const contactByCompany = new Map<string, { name: string; email: string }>();
    for (const member of members) {
      if (member.user.isDeleted) continue;
      const current = contactByCompany.get(member.companyId);
      if (!current || member.roleInCompany === 'owner') {
        contactByCompany.set(member.companyId, { name: member.user.displayName, email: member.user.email });
      }
    }
    return companyIds
      .filter((id) => !owned.has(id) && companyById.has(id))
      .slice(0, 100)
      .map((id) => {
        const company = companyById.get(id)!;
        const order = latest.get(id)!;
        const contact = contactByCompany.get(id);
        return {
          companyId: id,
          companyName: company.name,
          taxCode: company.taxCode,
          contactName: contact?.name ?? null,
          contactEmail: contact?.email ?? null,
          lastPaidAt: order.paidAt!.toISOString(),
          lastPlanName: order.planName,
          lastPaidAmountVnd: order.priceVndSnapshot.toString(),
        };
      });
  }

  /** Sale hoặc SuperAdmin nhận khách. Tạo lead, không tạo đơn và không bật gói. */
  async claimCustomer(actor: AuthenticatedUser, companyId: string): Promise<CrmLeadView> {
    if (!/^[0-9a-f-]{36}$/i.test(companyId)) throw new NotFoundException('Không tìm thấy công ty');
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.isDeleted) throw new NotFoundException('Không tìm thấy công ty');
    const taxCode = claimTax(company.taxCode);
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      select: {
        roleInCompany: true,
        user: { select: { displayName: true, email: true, isDeleted: true } },
      },
    });
    const contact = members.find((member) => !member.user.isDeleted && member.roleInCompany === 'owner')
      ?? members.find((member) => !member.user.isDeleted);

    const lead = await this.prisma.$transaction(async (tx) => {
      const owned = await tx.crmLead.findFirst({
        where: { companyId, status: { not: 'unqualified' } },
        select: { leadCode: true },
      });
      if (owned) throw new BadRequestException('Công ty này đã có người phụ trách');
      if (taxCode) {
        const byTax = await tx.crmLead.findFirst({
          where: { taxCode, status: { not: 'unqualified' } },
          include: { partner: { select: { id: true, name: true, code: true } } },
        });
        if (byTax) {
          if (byTax.companyId && byTax.companyId !== companyId) {
            throw new BadRequestException(`Lead đã có: ${byTax.leadCode}`);
          }
          if (byTax.ownerUserId !== actor.id && !this.seesAll(actor)) {
            throw new BadRequestException(`Lead đã có: ${byTax.leadCode}`);
          }
          const linked = await tx.crmLead.update({
            where: { id: byTax.id },
            data: { companyId, ...(byTax.address ? {} : { address: clip(company.address, 300) || null }) },
            include: { partner: { select: { id: true, name: true, code: true } } },
          });
          await tx.crmActivity.create({
            data: {
              leadId: linked.id,
              activityType: 'note',
              summary: `Gắn ${linked.leadCode} với công ty đã thanh toán trên inlink. Không gán gói.`,
              createdByUserId: actor.id,
            },
          });
          return linked;
        }
      }
      const created = await tx.crmLead.create({
        data: {
          leadCode: await this.nextCode('LD'),
          companyName: company.name,
          taxCode,
          contactName: contact?.user.displayName?.trim() || company.name,
          contactPhone: '',
          contactEmail: contact?.user.email ?? null,
          industry: company.industry,
          address: clip(company.address, 300) || null,
          companyId,
          source: 'web',
          ownerUserId: actor.id,
        },
        include: { partner: { select: { id: true, name: true, code: true } } },
      });
      await tx.crmActivity.create({
        data: {
          leadId: created.id,
          activityType: 'note',
          summary: `Nhận khách tự mua ${company.name}. Không gán gói.`,
          createdByUserId: actor.id,
        },
      });
      return created;
    });
    return this.mapLead(lead, await this.ownerNames([lead.ownerUserId]));
  }

  async companyProfile(actor: AuthenticatedUser, companyId: string): Promise<CrmCompanyProfileView> {
    if (!/^[0-9a-f-]{36}$/i.test(companyId)) throw new NotFoundException('Không tìm thấy công ty');
    await this.assertCompanyVisible(actor, companyId);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.isDeleted) throw new NotFoundException('Không tìm thấy công ty');
    const now = new Date();
    const [platform, sourcing, credit, openJobCount, orders, leads, commission] = await Promise.all([
      this.prisma.billingCompanyPlan.findUnique({
        where: { companyId },
        include: { plan: { select: { code: true, name: true } } },
      }),
      this.prisma.billingCompanySourcingPlan.findUnique({
        where: { companyId },
        include: { plan: { select: { code: true, name: true } } },
      }),
      this.prisma.billingCreditAccount.findUnique({ where: { companyId }, select: { balance: true } }),
      this.prisma.job.count({ where: { companyId, isDeleted: false, status: 'published' } }),
      this.prisma.billingOrder.findMany({
        where: { ...this.paidPlanOrderWhere(), companyId },
        include: { orderInvoice: true },
        orderBy: { paidAt: 'desc' },
        take: 20,
      }),
      this.prisma.crmLead.findMany({
        where: {
          companyId,
          status: { not: 'unqualified' },
          ...(this.seesAll(actor) ? {} : { ownerUserId: actor.id }),
        },
        include: { partner: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.crmCommissionEntry.findFirst({
        where: { companyId },
        orderBy: { paidAt: 'desc' },
        include: { partner: { select: { name: true, code: true } } },
      }),
    ]);
    const partnerLead = leads.find((lead) => lead.partner);
    const names = await this.ownerNames(leads.map((lead) => lead.ownerUserId));
    const planSnapshot = (
      kind: 'platform' | 'sourcing',
      row: { isActive: boolean; endsAt: Date | null; plan: { code: string; name: string } } | null,
    ) =>
      row
        ? {
            kind,
            code: row.plan.code,
            name: row.plan.name,
            endsAt: row.endsAt?.toISOString() ?? null,
            active: row.isActive && (!row.endsAt || row.endsAt > now),
          }
        : null;
    return {
      id: company.id,
      name: company.name,
      taxCode: company.taxCode,
      industry: company.industry,
      platformPlan: planSnapshot('platform', platform),
      sourcingPlan: planSnapshot('sourcing', sourcing),
      creditBalance: credit?.balance ?? 0,
      openJobCount,
      partnerName: partnerLead?.partner?.name ?? commission?.partner.name ?? null,
      partnerCode: partnerLead?.partner?.code ?? commission?.partner.code ?? null,
      orders: orders.map((order) =>
        this.mapPaidInvoice(order, company.name),
      ),
      leads: leads.map((lead) => this.mapLead(lead, names)),
    };
  }

  async followUps(actor: AuthenticatedUser): Promise<CrmLeadView[]> {
    const rows = await this.prisma.crmLead.findMany({
      where: { ...this.ownScope(actor), nextFollowUpAt: { not: null } },
      orderBy: { nextFollowUpAt: 'asc' },
      take: 100,
      include: { partner: { select: { id: true, name: true, code: true } } },
    });
    const names = await this.ownerNames(rows.map((lead) => lead.ownerUserId));
    return rows.map((lead) => this.mapLead(lead, names));
  }

  async owners(actor: AuthenticatedUser): Promise<CrmOwnerOption[]> {
    if (!this.seesAll(actor)) throw new ForbiddenException('Chỉ SuperAdmin chuyển lead');
    const users = await this.prisma.user.findMany({
      where: { isDeleted: false, status: 'active', role: { in: [UserRole.Sales, UserRole.SuperAdmin] } },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
    return users.map((user) => ({ id: user.id, name: user.displayName }));
  }

  async updateLead(actor: AuthenticatedUser, leadId: string, input: UpdateCrmLeadRequest): Promise<CrmLeadView> {
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) throw new NotFoundException('Không tìm thấy lead');
    const current = await this.prisma.crmLead.findUnique({ where: { id: leadId } });
    if (!current) throw new NotFoundException('Không tìm thấy lead');
    this.assertOwner(actor, current.ownerUserId);
    const companyName = input.companyName?.trim();
    const contactName = input.contactName?.trim();
    const phone = normalizePhone(input.contactPhone ?? '');
    const taxCode = this.readTax(input.taxCode);
    const source = leadSource(input.source);
    if (!companyName || !contactName || phone.length < 9) {
      throw new BadRequestException('Cần tên công ty, người liên hệ và số điện thoại');
    }
    if (!source) throw new BadRequestException('Chọn nguồn khách: Web, Zalo, sự kiện hoặc cộng tác viên');
    const partner = source === 'partner' ? await this.requirePartner(input.partnerId) : null;
    await this.assertNoDuplicate(taxCode, phone, current.id, current.companyId);
    let ownerUserId = current.ownerUserId;
    let ownerNameForLog: string | null = null;
    if (input.ownerUserId && input.ownerUserId !== current.ownerUserId) {
      if (!this.seesAll(actor)) throw new ForbiddenException('Chỉ SuperAdmin chuyển lead');
      const nextOwner = await this.prisma.user.findFirst({
        where: {
          id: input.ownerUserId,
          isDeleted: false,
          status: 'active',
          role: { in: [UserRole.Sales, UserRole.SuperAdmin] },
        },
        select: { id: true, displayName: true },
      });
      if (!nextOwner) throw new BadRequestException('Chọn sale hoặc SuperAdmin đang hoạt động');
      ownerUserId = nextOwner.id;
      ownerNameForLog = nextOwner.displayName;
    }
    const followUp = parseFollowUp(input.nextFollowUpAt);
    const lead = await this.prisma.crmLead.update({
      where: { id: current.id },
      data: {
        companyName,
        taxCode,
        contactName,
        contactPhone: phone,
        contactEmail: input.contactEmail?.trim() || null,
        industry: input.industry?.trim() || null,
        address: clip(input.address, 300) || null,
        source,
        partnerId: partner?.id ?? null,
        ownerUserId,
        ...(followUp !== undefined ? { nextFollowUpAt: followUp } : {}),
      },
      include: { partner: { select: { id: true, name: true, code: true } } },
    });
    if (ownerUserId !== current.ownerUserId) {
      await this.prisma.crmDeal.updateMany({ where: { leadId: lead.id }, data: { ownerUserId } });
      await this.prisma.crmActivity.create({
        data: {
          leadId: lead.id,
          activityType: 'note',
          summary: `Chuyển ${lead.leadCode} sang ${ownerNameForLog}. Không đổi gói.`,
          createdByUserId: actor.id,
        },
      });
    }
    return this.mapLead(lead, await this.ownerNames([lead.ownerUserId, actor.id]));
  }

  async createActivity(actor: AuthenticatedUser, input: CreateCrmActivityRequest): Promise<CrmActivityView> {
    const summary = input.summary?.trim();
    const activityType = input.activityType;
    if (!summary || summary.length < 2) throw new BadRequestException('Cần nội dung nhật ký');
    if (activityType !== 'note' && activityType !== 'call' && activityType !== 'zalo' && activityType !== 'visit') {
      throw new BadRequestException('Loại nhật ký không hợp lệ');
    }
    let leadId = input.leadId ?? null;
    const dealId = input.dealId ?? null;
    if (dealId) {
      const deal = await this.prisma.crmDeal.findUnique({ where: { id: dealId } });
      if (!deal) throw new NotFoundException('Không tìm thấy deal');
      this.assertOwner(actor, deal.ownerUserId);
      leadId = deal.leadId;
    } else if (leadId) {
      const lead = await this.prisma.crmLead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundException('Không tìm thấy lead');
      this.assertOwner(actor, lead.ownerUserId);
    } else {
      throw new BadRequestException('Cần chọn lead hoặc deal');
    }
    const followUp = parseFollowUp(input.nextFollowUpAt);
    if (followUp !== undefined && leadId) {
      await this.prisma.crmLead.update({ where: { id: leadId }, data: { nextFollowUpAt: followUp } });
    }
    const row = await this.prisma.crmActivity.create({
      data: {
        leadId,
        dealId,
        activityType,
        summary,
        createdByUserId: actor.id,
      },
      include: {
        lead: { select: { companyName: true } },
        deal: { select: { lead: { select: { companyName: true } } } },
      },
    });
    return this.mapActivity(row, await this.ownerNames([actor.id]));
  }

  async createDeal(actor: AuthenticatedUser, input: CreateCrmDealRequest): Promise<CrmDealView> {
    const lead = await this.prisma.crmLead.findUnique({ where: { id: input.leadId } });
    if (!lead || lead.status === 'unqualified') {
      throw new NotFoundException('Không tìm thấy lead đang mở');
    }
    this.assertOwner(actor, lead.ownerUserId);
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Cần tiêu đề deal');
    const pipeline = await this.prisma.crmPipeline.findUnique({
      where: { code: PIPELINE_CODE },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    const first = pipeline?.stages[0];
    if (!pipeline || !first) throw new NotFoundException('Chưa có phễu bán gói');

    const plan = await this.snapshotPlan(input.planKind ?? null, input.planCode ?? null);
    const deal = await this.prisma.crmDeal.create({
      data: {
        dealCode: await this.nextCode('DL'),
        title,
        leadId: lead.id,
        companyId: lead.companyId,
        pipelineId: pipeline.id,
        stageId: first.id,
        planKind: plan?.kind ?? null,
        planCode: plan?.code ?? null,
        listPriceVnd: plan?.priceVnd ?? null,
        provisionState: 'not_provisioned',
        ownerUserId: actor.id,
      },
      include: { stage: true, lead: true },
    });
    if (lead.status === 'open') {
      await this.prisma.crmLead.update({
        where: { id: lead.id },
        data: { status: 'converted' },
      });
    }
    await this.prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        dealId: deal.id,
        activityType: 'note',
        summary: plan
          ? `Tạo deal ${deal.dealCode} cho ${plan.kind === 'sourcing' ? 'gói Săn' : 'gói tin'} ${plan.code}. CRM không bật gói.`
          : `Tạo deal ${deal.dealCode}. Chưa chọn gói.`,
        createdByUserId: actor.id,
      },
    });
    const paid = await this.paymentsForDeals([deal]);
    return this.mapDeal(deal, await this.ownerNames([actor.id]), paid.get(deal.id));
  }

  /**
   * Nhà tuyển dụng bấm tư vấn Enterprise. Tạo lead và deal trong phễu.
   * Không tạo đơn, không bật gói, không ghi giá niêm yết.
   */
  async requestEnterprise(actor: AuthenticatedUser): Promise<CrmEnterpriseRequestView> {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId: actor.id, company: { isDeleted: false } },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    });
    const member = memberships.find((row) => row.roleInCompany === 'owner') ?? memberships[0];
    if (!member) throw new BadRequestException('Tài khoản chưa gắn công ty');
    const company = member.company;
    const receiver = await this.prisma.user.findFirst({
      where: { role: UserRole.SuperAdmin, isDeleted: false, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayName: true },
    });
    if (!receiver) throw new BadRequestException('Chưa có người nhận yêu cầu tư vấn');

    const openDeal = await this.prisma.crmDeal.findFirst({
      where: { companyId: company.id, planCode: 'ENTERPRISE', stage: { code: { not: 'lost' } } },
      include: { lead: { select: { leadCode: true } } },
    });
    if (openDeal) {
      const names = await this.ownerNames([openDeal.ownerUserId]);
      return {
        leadCode: openDeal.lead.leadCode,
        dealCode: openDeal.dealCode,
        ownerName: names.get(openDeal.ownerUserId) ?? receiver.displayName,
        alreadyOpen: true,
      };
    }

    const pipeline = await this.prisma.crmPipeline.findUnique({
      where: { code: PIPELINE_CODE },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    const first = pipeline?.stages[0];
    if (!pipeline || !first) throw new NotFoundException('Chưa có phễu bán gói');

    const taxCode = claimTax(company.taxCode);
    const existing = await this.prisma.crmLead.findFirst({
      where: {
        status: { not: 'unqualified' },
        OR: [{ companyId: company.id }, ...(taxCode ? [{ taxCode }] : [])],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing?.companyId && existing.companyId !== company.id) {
      throw new BadRequestException(`Lead đã có: ${existing.leadCode}`);
    }

    const ownerUserId = existing?.ownerUserId ?? receiver.id;
    const lead = existing
      ? await this.prisma.crmLead.update({
          where: { id: existing.id },
          data: {
            companyId: existing.companyId ?? company.id,
            ...(existing.address ? {} : { address: clip(company.address, 300) || null }),
            ...(existing.status === 'open' ? { status: 'converted' } : {}),
          },
        })
      : await this.prisma.crmLead.create({
          data: {
            leadCode: await this.nextCode('LD'),
            companyName: company.name,
            taxCode,
            contactName: actor.displayName?.trim() || company.name,
            contactPhone: '',
            contactEmail: actor.email,
            industry: company.industry,
            address: clip(company.address, 300) || null,
            companyId: company.id,
            source: 'web',
            status: 'converted',
            ownerUserId,
          },
        });

    const deal = await this.prisma.crmDeal.create({
      data: {
        dealCode: await this.nextCode('DL'),
        title: `Tư vấn Enterprise — ${company.name}`,
        leadId: lead.id,
        companyId: company.id,
        pipelineId: pipeline.id,
        stageId: first.id,
        planKind: 'platform',
        planCode: 'ENTERPRISE',
        listPriceVnd: null,
        provisionState: 'not_provisioned',
        ownerUserId,
      },
    });
    await this.prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        dealId: deal.id,
        activityType: 'note',
        summary: `Khách yêu cầu tư vấn gói Enterprise. Deal ${deal.dealCode}. CRM không bật gói và không tạo đơn.`,
        createdByUserId: actor.id,
      },
    });
    try {
      await this.notifications.createInApp({
        tenantId: DEFAULT_TENANT_ID,
        userId: ownerUserId,
        type: 'crm.enterprise_request',
        title: 'Yêu cầu tư vấn Enterprise',
        body: `${company.name} vừa gửi yêu cầu. CRM không bật gói.`,
        link: '/crm/pipeline',
        entityType: 'crm.deal',
        entityId: deal.id,
      });
    } catch (err) {
      this.logger.warn(`Không gửi được thông báo Enterprise: ${String(err)}`);
    }
    const names = await this.ownerNames([ownerUserId]);
    return {
      leadCode: lead.leadCode,
      dealCode: deal.dealCode,
      ownerName: names.get(ownerUserId) ?? receiver.displayName,
      alreadyOpen: false,
    };
  }

  async moveDeal(
    actor: AuthenticatedUser,
    dealId: string,
    input: MoveCrmDealRequest,
  ): Promise<CrmDealView> {
    const deal = await this.prisma.crmDeal.findUnique({
      where: { id: dealId },
      include: { stage: true, lead: true },
    });
    if (!deal) throw new NotFoundException('Không tìm thấy deal');
    this.assertOwner(actor, deal.ownerUserId);
    const stage = await this.prisma.crmStage.findFirst({
      where: { pipelineId: deal.pipelineId, code: input.stageCode },
    });
    if (!stage) throw new BadRequestException('Bước phễu không hợp lệ');
    const lostReason = input.lostReason?.trim() ?? '';
    if (stage.code === 'lost' && lostReason.length < 2) {
      throw new BadRequestException('Nhập lý do mất, ít nhất 2 ký tự');
    }

    const updated = await this.prisma.crmDeal.update({
      where: { id: deal.id },
      data: {
        stageId: stage.id,
        wonAt: stage.code === 'won' ? new Date() : null,
        lostAt: stage.code === 'lost' ? new Date() : null,
        lostReason: stage.code === 'lost' ? lostReason : null,
        provisionState: 'not_provisioned',
      },
      include: { stage: true, lead: true },
    });
    const summary =
      stage.code === 'won'
        ? `Chuyển ${deal.dealCode} sang Đã chốt. CRM không bật gói và không ghi hoa hồng.`
        : stage.code === 'awaiting_payment'
          ? `Chuyển ${deal.dealCode} sang Chờ thanh toán. Khách tự thanh toán trên inlink.`
          : stage.code === 'lost'
            ? `Chuyển ${deal.dealCode} sang ${stage.name}. Lý do: ${lostReason}`
            : `Chuyển ${deal.dealCode} sang ${stage.name}`;
    await this.prisma.crmActivity.create({
      data: {
        leadId: deal.leadId,
        dealId: deal.id,
        activityType: 'stage',
        summary,
        createdByUserId: actor.id,
      },
    });
    const paid = await this.paymentsForDeals([updated]);
    return this.mapDeal(updated, await this.ownerNames([deal.ownerUserId]), paid.get(updated.id));
  }

  /** Lead và đơn gói đã trả, theo người phụ trách, nguồn và cộng tác viên. */
  async funnelReport(actor: AuthenticatedUser): Promise<CrmFunnelReport> {
    const leads = await this.prisma.crmLead.findMany({
      where: { status: { not: 'unqualified' }, ...this.ownScope(actor) },
      select: { companyId: true, source: true, partnerId: true, ownerUserId: true },
      orderBy: { createdAt: 'asc' },
    });
    const companyIds = [...new Set(leads.flatMap((lead) => (lead.companyId ? [lead.companyId] : [])))];
    const orders = companyIds.length === 0 && !this.seesAll(actor)
      ? []
      : await this.prisma.billingOrder.findMany({
          where: {
            ...this.paidPlanOrderWhere(),
            ...(this.seesAll(actor) ? {} : { companyId: { in: companyIds } }),
          },
          select: { companyId: true, priceVndSnapshot: true },
        });
    const firstLead = new Map<string, (typeof leads)[number]>();
    for (const lead of leads) {
      if (lead.companyId && !firstLead.has(lead.companyId)) firstLead.set(lead.companyId, lead);
    }
    const owners = new Map<string, FunnelTally>();
    const sources = new Map<string, FunnelTally>();
    const partners = new Map<string, FunnelTally>();
    for (const lead of leads) {
      tally(owners, lead.ownerUserId).leads += 1;
      tally(sources, lead.source).leads += 1;
      if (lead.partnerId) tally(partners, lead.partnerId).leads += 1;
    }
    for (const order of orders) {
      const lead = firstLead.get(order.companyId);
      if (!lead) {
        if (!this.seesAll(actor)) continue;
        const owner = tally(owners, 'unassigned');
        owner.paidOrders += 1;
        owner.paidAmountVnd += order.priceVndSnapshot;
        const source = tally(sources, 'none');
        source.paidOrders += 1;
        source.paidAmountVnd += order.priceVndSnapshot;
        continue;
      }
      const owner = tally(owners, lead.ownerUserId);
      owner.paidOrders += 1;
      owner.paidAmountVnd += order.priceVndSnapshot;
      const source = tally(sources, lead.source);
      source.paidOrders += 1;
      source.paidAmountVnd += order.priceVndSnapshot;
    }
    if (this.seesAll(actor) || companyIds.length > 0) {
      const entries = await this.prisma.crmCommissionEntry.findMany({
        where: this.seesAll(actor) ? {} : { companyId: { in: companyIds } },
        select: { partnerId: true, paidAmountVnd: true },
      });
      for (const entry of entries) {
        const row = tally(partners, entry.partnerId);
        row.paidOrders += 1;
        row.paidAmountVnd += entry.paidAmountVnd;
      }
    }
    const ownerNames = await this.ownerNames([...owners.keys()].filter((id) => id !== 'unassigned'));
    const partnerIds = [...partners.keys()];
    const partnerRows = partnerIds.length === 0
      ? []
      : await this.prisma.crmPartner.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, code: true },
        });
    const partnerName = new Map(partnerRows.map((row) => [row.id, `${row.name} · ${row.code}`]));
    return {
      byOwner: funnelBuckets(owners, (key) => (key === 'unassigned' ? 'Chưa có người phụ trách' : ownerNames.get(key) ?? 'Người phụ trách')),
      bySource: funnelBuckets(sources, funnelSourceLabel),
      byPartner: funnelBuckets(partners, (key) => partnerName.get(key) ?? 'Cộng tác viên'),
    };
  }

  /** Đơn gói đã thanh toán. Sale chỉ thấy công ty mình phụ trách. */
  async paidInvoices(actor: AuthenticatedUser): Promise<CrmPaidInvoiceLedgerView> {
    const companyIds = await this.invoiceCompanyIds(actor);
    if (companyIds && companyIds.length === 0) return { orders: [] };
    const orders = await this.prisma.billingOrder.findMany({
      where: {
        status: 'paid',
        kind: { in: ['platform', 'sourcing'] },
        priceVndSnapshot: { gt: 0 },
        paidAt: { not: null },
        ...(companyIds ? { companyId: { in: companyIds } } : {}),
      },
      include: { orderInvoice: true },
      orderBy: { paidAt: 'desc' },
      take: 200,
    });
    const companies = await this.prisma.company.findMany({
      where: { id: { in: [...new Set(orders.map((order) => order.companyId))] } },
      select: { id: true, name: true },
    });
    const names = new Map(companies.map((company) => [company.id, company.name]));
    return {
      orders: orders.map((order) => this.mapPaidInvoice(order, names.get(order.companyId) ?? order.orderInvoice?.companyName ?? 'Nhà tuyển dụng')),
    };
  }

  /** Ghi số hóa đơn cho đơn đã trả tiền. Không tính VAT, không thu thêm và không bật gói. */
  async issueOrderInvoice(
    actor: AuthenticatedUser,
    orderId: string,
    input: IssueCrmInvoiceRequest,
  ): Promise<CrmPaidOrderInvoiceView> {
    const number = input.invoiceNumber?.trim() ?? '';
    if (number.length < 1 || number.length > 64) {
      throw new BadRequestException('Nhập số hóa đơn, tối đa 64 ký tự');
    }
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new NotFoundException('Không tìm thấy đơn đã thanh toán');
    const order = await this.prisma.billingOrder.findUnique({
      where: { id: orderId },
      include: { orderInvoice: true },
    });
    if (!order || !order.paidAt || order.status !== 'paid' || (order.kind !== 'platform' && order.kind !== 'sourcing') || order.priceVndSnapshot <= 0n) {
      throw new NotFoundException('Không tìm thấy đơn đã thanh toán');
    }
    const companyIds = await this.invoiceCompanyIds(actor);
    if (companyIds && !companyIds.includes(order.companyId)) {
      throw new NotFoundException('Không tìm thấy đơn đã thanh toán');
    }
    const company = await this.prisma.company.findUnique({
      where: { id: order.companyId },
      select: { name: true },
    });
    const companyName = company?.name ?? order.orderInvoice?.companyName ?? 'Nhà tuyển dụng';
    const vat = await this.prisma.crmVatSetting.findUnique({ where: { id: 'default' }, select: { percent: true } });
    try {
      const saved = order.orderInvoice
        ? await this.prisma.crmOrderInvoice.update({
            where: { billingOrderId: order.id },
            data: { invoiceNumber: number },
          })
        : await this.prisma.crmOrderInvoice.create({
            data: {
              billingOrderId: order.id,
              companyId: order.companyId,
              companyName,
              orderKind: order.kind,
              planCode: order.planCode,
              planName: order.planName,
              paidAmountVnd: order.priceVndSnapshot,
              paidAt: order.paidAt,
              invoiceNumber: number,
              vatPercent: vat?.percent ?? null,
              issuedByUserId: actor.id,
            },
          });
      return this.mapPaidInvoice({ ...order, orderInvoice: saved }, companyName);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Số hóa đơn này đã ghi cho đơn khác');
      }
      throw err;
    }
  }

  /** null = SuperAdmin thấy mọi công ty. Mảng rỗng = không thấy đơn nào. */
  private async invoiceCompanyIds(actor: AuthenticatedUser): Promise<string[] | null> {
    if (this.seesAll(actor)) return null;
    if (actor.role !== UserRole.Sales) return [];
    const [leads, deals] = await Promise.all([
      this.prisma.crmLead.findMany({
        where: { ownerUserId: actor.id, status: { not: 'unqualified' }, companyId: { not: null } },
        select: { companyId: true },
      }),
      this.prisma.crmDeal.findMany({
        where: { ownerUserId: actor.id, companyId: { not: null } },
        select: { companyId: true },
      }),
    ]);
    return [
      ...new Set(
        [...leads, ...deals].map((row) => row.companyId).filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  private mapPaidInvoice(
    order: {
      id: string;
      companyId: string;
      kind: string;
      planCode: string | null;
      planName: string | null;
      priceVndSnapshot: bigint;
      paidAt: Date | null;
      orderInvoice: { invoiceNumber: string; issuedAt: Date; vatPercent: number | null } | null;
    },
    companyName: string,
  ): CrmPaidOrderInvoiceView {
    return {
      billingOrderId: order.id,
      companyId: order.companyId,
      companyName,
      orderKind: order.kind === 'sourcing' ? 'sourcing' : 'platform',
      planCode: order.planCode,
      planName: order.planName,
      paidAmountVnd: order.priceVndSnapshot.toString(),
      paidAt: (order.paidAt ?? new Date()).toISOString(),
      invoiceNumber: order.orderInvoice?.invoiceNumber ?? null,
      invoiceIssuedAt: order.orderInvoice?.issuedAt.toISOString() ?? null,
      vatPercent: order.orderInvoice?.vatPercent ?? null,
    };
  }

  /**
   * Đơn đã trả của từng deal. Deal tạo sau lần thanh toán không nhận đơn cũ.
   * Không tạo đơn và không đổi bước.
   */
  private async paymentsForDeals(
    deals: {
      id: string;
      companyId: string | null;
      planKind: string | null;
      planCode: string | null;
      createdAt: Date;
      updatedAt: Date;
      stage: { code: string };
    }[],
  ): Promise<Map<string, { amount: bigint; paidAt: Date; invoiceNumber: string | null; companyName: string | null }>> {
    const keys = new Map<string, { companyId: string; kind: 'platform' | 'sourcing'; planCode: string }>();
    for (const deal of deals) {
      if (!deal.companyId || (deal.planKind !== 'platform' && deal.planKind !== 'sourcing') || !deal.planCode) continue;
      keys.set(`${deal.companyId}:${deal.planKind}:${deal.planCode}`, {
        companyId: deal.companyId,
        kind: deal.planKind,
        planCode: deal.planCode,
      });
    }
    const list = [...keys.values()];
    const paid = new Map<string, { amount: bigint; paidAt: Date; invoiceNumber: string | null; companyName: string | null }>();
    if (list.length === 0) return paid;
    const match = list.map((item) => ({ companyId: item.companyId, planKind: item.kind, planCode: item.planCode }));
    const [siblings, orders] = await Promise.all([
      this.prisma.crmDeal.findMany({
        where: { OR: match },
        select: {
          id: true,
          companyId: true,
          planKind: true,
          planCode: true,
          createdAt: true,
          updatedAt: true,
          stage: { select: { code: true } },
        },
      }),
      this.prisma.billingOrder.findMany({
        where: {
          status: 'paid',
          priceVndSnapshot: { gt: 0 },
          paidAt: { not: null },
          OR: list.map((item) => ({ companyId: item.companyId, kind: item.kind, planCode: item.planCode })),
        },
        select: {
          id: true,
          companyId: true,
          kind: true,
          planCode: true,
          priceVndSnapshot: true,
          paidAt: true,
          orderInvoice: { select: { invoiceNumber: true } },
        },
      }),
    ]);
    const ready = orders.flatMap((order) =>
      order.paidAt && order.planCode
        ? [{ ...order, planCode: order.planCode, paidAt: order.paidAt }]
        : [],
    );
    const links = ready.length
      ? await this.prisma.crmActivity.findMany({
          where: { billingOrderId: { in: ready.map((order) => order.id) } },
          select: { billingOrderId: true, dealId: true },
        })
      : [];
    const assigned = assignPaidOrders({
      deals: siblings.map((deal) => ({
        id: deal.id,
        companyId: deal.companyId,
        planKind: deal.planKind,
        planCode: deal.planCode,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        stageCode: deal.stage.code,
      })),
      orders: ready,
      linkedDealIdByOrderId: new Map(
        links.flatMap((row) => (row.billingOrderId && row.dealId ? [[row.billingOrderId, row.dealId] as const] : [])),
      ),
    });
    const companyIds = [...new Set([...assigned.values()].map((order) => order.companyId))];
    const companies = companyIds.length
      ? await this.prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(companies.map((company) => [company.id, company.name]));
    for (const [dealId, order] of assigned) {
      paid.set(dealId, {
        amount: order.priceVndSnapshot,
        paidAt: order.paidAt,
        invoiceNumber: order.orderInvoice?.invoiceNumber ?? null,
        companyName: names.get(order.companyId) ?? null,
      });
    }
    return paid;
  }

  private seesAll(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.SuperAdmin;
  }

  private ownScope(actor: AuthenticatedUser): { ownerUserId: string } | undefined {
    return this.seesAll(actor) ? undefined : { ownerUserId: actor.id };
  }

  private assertOwner(actor: AuthenticatedUser, ownerUserId: string) {
    if (this.seesAll(actor) || ownerUserId === actor.id) return;
    throw new ForbiddenException('Hồ sơ này thuộc người phụ trách khác');
  }

  private async resolveCompanyId(companyId: string | null | undefined, taxCode: string | null) {
    if (companyId) {
      await this.assertCompany(companyId);
      return companyId;
    }
    if (!taxCode) return null;
    const company = await this.prisma.company.findFirst({
      where: { taxCode, isDeleted: false },
      select: { id: true },
    });
    return company?.id ?? null;
  }

  private async ownerNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }

  private async snapshotPlan(kind: CrmPlanKind | null, code: string | null) {
    const planCode = code?.trim();
    if (!kind || !planCode) return null;
    if (kind === 'platform') {
      const plan = await this.prisma.billingPlatformPlan.findFirst({
        where: { code: planCode, isActive: true },
      });
      if (!plan) throw new NotFoundException('Không tìm thấy gói tin');
      if (plan.code === 'ENTERPRISE') {
        throw new BadRequestException('Gói Enterprise không đưa vào phễu tự phục vụ');
      }
      return { kind, code: plan.code, priceVnd: plan.priceVnd };
    }
    const plan = await this.prisma.billingSourcingPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy gói Săn');
    return { kind, code: plan.code, priceVnd: plan.feeVnd };
  }

  private async assertCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.isDeleted) throw new NotFoundException('Không tìm thấy công ty');
  }

  private async assertNoDuplicate(
    taxCode: string | null,
    phone: string,
    excludeId?: string,
    companyId?: string | null,
  ) {
    const or = [
      ...(taxCode ? [{ taxCode }] : []),
      ...(phone.length >= 9 ? [{ contactPhone: phone }] : []),
      ...(companyId ? [{ companyId }] : []),
    ];
    if (or.length === 0) return;
    const existing = await this.prisma.crmLead.findFirst({
      where: {
        status: { not: 'unqualified' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: or,
      },
    });
    if (existing) {
      throw new BadRequestException(`Lead đã có: ${existing.leadCode}`);
    }
  }

  private async lookupTaxRegistry(taxCode: string): Promise<CrmTaxSuggestion | null> {
    if (!/^\d{10}(\d{3})?$/.test(taxCode)) return null;
    try {
      const response = await fetch(`https://api.vietqr.io/v2/business/${taxCode}`, {
        signal: AbortSignal.timeout(4000),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        code?: string;
        data?: { id?: string; name?: string; address?: string };
      };
      const name = body.data?.name?.trim();
      if (body.code !== '00' || !name) return null;
      return {
        taxCode: claimTax(body.data?.id) ?? taxCode,
        companyName: name,
        address: body.data?.address?.trim() || null,
        companyId: null,
        source: 'registry',
      };
    } catch (err) {
      this.logger.warn(`Không tra được sổ thuế: ${err instanceof Error ? err.message : 'lỗi mạng'}`);
      return null;
    }
  }

  private readTax(raw: string | null | undefined): string | null {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) return null;
    const taxCode = claimTax(raw);
    if (!taxCode) throw new BadRequestException('Mã số thuế gồm 10 hoặc 13 số');
    return taxCode;
  }

  private paidPlanOrderWhere() {
    return {
      status: 'paid' as const,
      paidAt: { not: null },
      priceVndSnapshot: { gt: 0 },
      kind: { in: ['platform', 'sourcing'] as string[] },
    };
  }

  private async assertCompanyVisible(actor: AuthenticatedUser, companyId: string) {
    if (this.seesAll(actor)) return;
    const [lead, deal, paid] = await Promise.all([
      this.prisma.crmLead.findFirst({
        where: { companyId, ownerUserId: actor.id, status: { not: 'unqualified' } },
        select: { id: true },
      }),
      this.prisma.crmDeal.findFirst({
        where: { companyId, ownerUserId: actor.id },
        select: { id: true },
      }),
      this.prisma.billingOrder.findFirst({
        where: { ...this.paidPlanOrderWhere(), companyId },
        select: { id: true },
      }),
    ]);
    if (lead || deal) return;
    if (!paid) throw new NotFoundException('Không tìm thấy công ty');
    const owner = await this.prisma.crmLead.findFirst({
      where: { companyId, status: { not: 'unqualified' } },
      select: { id: true },
    });
    if (owner) throw new NotFoundException('Không tìm thấy công ty');
  }

  private async creditCommissionWallet(
    tx: Prisma.TransactionClient,
    input: { partnerId: string; commissionEntryId: string; amountVnd: bigint },
  ): Promise<void> {
    const wallet = await tx.crmCommissionWallet.upsert({
      where: { partnerId: input.partnerId },
      create: { partnerId: input.partnerId },
      update: {},
      select: { id: true },
    });
    await tx.crmCommissionWalletTxn.create({
      data: {
        walletId: wallet.id,
        partnerId: input.partnerId,
        commissionEntryId: input.commissionEntryId,
        amountVnd: input.amountVnd,
        kind: 'credit',
      },
    });
  }

  /** Khoản ghi trước khi có ví vẫn được cộng một lần. */
  private async ensureWalletCredits(partnerIds: string[]): Promise<void> {
    if (partnerIds.length === 0) return;
    const missing = await this.prisma.crmCommissionEntry.findMany({
      where: { partnerId: { in: partnerIds }, walletTxn: { is: null } },
      select: { id: true, partnerId: true, commissionVnd: true },
    });
    for (const entry of missing) {
      try {
        await this.prisma.$transaction((tx) =>
          this.creditCommissionWallet(tx, {
            partnerId: entry.partnerId,
            commissionEntryId: entry.id,
            amountVnd: entry.commissionVnd,
          }),
        );
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        this.logger.error(`Không cộng được số dư ví hoa hồng: ${String(err)}`);
      }
    }
  }

  private async walletBalances(partnerIds: string[]): Promise<Map<string, bigint>> {
    const totals = new Map<string, bigint>();
    if (partnerIds.length === 0) return totals;
    const rows = await this.prisma.crmCommissionWalletTxn.groupBy({
      by: ['partnerId', 'kind'],
      where: { partnerId: { in: partnerIds } },
      _sum: { amountVnd: true },
    });
    const grouped = new Map<string, Array<{ kind: string; amountVnd: bigint }>>();
    for (const row of rows) {
      const bucket = grouped.get(row.partnerId) ?? [];
      bucket.push({ kind: row.kind, amountVnd: row._sum.amountVnd ?? 0n });
      grouped.set(row.partnerId, bucket);
    }
    for (const [partnerId, txns] of grouped) {
      totals.set(partnerId, signedWalletBalance(txns));
    }
    return totals;
  }

  private mapPartner(row: {
    id: string;
    name: string;
    phone: string;
    code: string;
    userId: string | null;
    createdAt: Date;
    claims?: Array<{
      id: string;
      partnerId: string;
      companyName: string;
      taxCode: string;
      contactPhone: string;
      createdAt: Date;
    }>;
  }, pending?: { count: number; amount: bigint }, signups: CrmReferralSignupView[] = [], walletBalanceVnd = 0n): CrmPartnerView {
    const origin = (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      code: row.code,
      referralUrl: `${origin}/bang-gia?ref=${encodeURIComponent(row.code)}`,
      fromAccount: Boolean(row.userId),
      createdAt: row.createdAt.toISOString(),
      pendingCommissionVnd: (pending?.amount ?? 0n).toString(),
      pendingCount: pending?.count ?? 0,
      walletBalanceVnd: walletBalanceVnd.toString(),
      signups,
      claims: (row.claims ?? []).map((claim) => ({
        id: claim.id,
        partnerId: claim.partnerId,
        companyName: claim.companyName,
        taxCode: claim.taxCode,
        contactPhone: claim.contactPhone,
        createdAt: claim.createdAt.toISOString(),
      })),
    };
  }

  private assertClaimWriter(
    actor: AuthenticatedUser,
    partner: { userId: string | null; createdByUserId: string },
  ) {
    if (actor.role === UserRole.SuperAdmin) return;
    if (actor.role === UserRole.Sales && partner.createdByUserId === actor.id) return;
    if (partner.userId === actor.id) return;
    throw new ForbiddenException('Không khóa mã số thuế cho cộng tác viên này');
  }

  private async insertClaim(partnerId: string, input: CreateCrmPartnerClaimRequest): Promise<CrmPartnerClaimView> {
    const companyName = clip(input.companyName, 160);
    const taxCode = claimTax(input.taxCode);
    const phone = normalizePhone(input.contactPhone ?? '');
    if (companyName.length < 2 || !taxCode || phone.length < 9 || phone.length > 15) {
      throw new BadRequestException('Cần tên nhà máy, mã số thuế 10 hoặc 13 số và số điện thoại');
    }
    const count = await this.prisma.crmPartnerClaim.count({ where: { partnerId } });
    if (count >= CLAIM_LIMIT) throw new BadRequestException('Mỗi cộng tác viên khóa tối đa 30 mã số thuế');
    const taken = await this.prisma.crmPartnerClaim.findUnique({ where: { taxCode }, select: { partnerId: true } });
    if (taken) throw new BadRequestException('Mã số thuế này đã có người giới thiệu');
    const lead = await this.prisma.crmLead.findFirst({
      where: {
        taxCode,
        status: { not: 'unqualified' },
        OR: [{ partnerId: null }, { partnerId: { not: partnerId } }],
      },
      select: { id: true },
    });
    if (lead) throw new BadRequestException('Mã số thuế này đã có trong CRM');
    try {
      const row = await this.prisma.crmPartnerClaim.create({
        data: { partnerId, companyName, taxCode, contactPhone: phone },
      });
      return {
        id: row.id,
        partnerId: row.partnerId,
        companyName: row.companyName,
        taxCode: row.taxCode,
        contactPhone: row.contactPhone,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Mã số thuế này đã có người giới thiệu');
      }
      throw err;
    }
  }

  private async lockTaxCode(partnerId: string, companyName: string, taxCode: string, phone: string) {
    const count = await this.prisma.crmPartnerClaim.count({ where: { partnerId } });
    if (count >= CLAIM_LIMIT) return;
    try {
      await this.prisma.crmPartnerClaim.create({
        data: { partnerId, companyName, taxCode, contactPhone: phone },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
  }

  private async pendingByPartner(
    actor: AuthenticatedUser,
    partnerIds: string[],
  ): Promise<Map<string, { count: number; amount: bigint }>> {
    const totals = new Map<string, { count: number; amount: bigint }>();
    if (partnerIds.length === 0) return totals;
    const entries = await this.prisma.crmCommissionEntry.findMany({
      where: { partnerId: { in: partnerIds }, periodId: null },
      select: {
        id: true,
        partnerId: true,
        companyId: true,
        commissionVnd: true,
        partner: { select: { createdByUserId: true } },
      },
    });
    const visible = await this.visibleCommissionRows(actor, entries);
    for (const entry of visible) {
      const current = totals.get(entry.partnerId) ?? { count: 0, amount: 0n };
      current.count += 1;
      current.amount += entry.commissionVnd;
      totals.set(entry.partnerId, current);
    }
    return totals;
  }

  /** Đăng ký qua mã mà tài khoản đó chưa trả đơn gói có giá. */
  private async unpaidSignups(partnerIds: string[]): Promise<Map<string, CrmReferralSignupView[]>> {
    const grouped = new Map<string, CrmReferralSignupView[]>();
    if (partnerIds.length === 0) return grouped;
    const rows = await this.prisma.crmReferralSignup.findMany({
      where: { partnerId: { in: partnerIds } },
      orderBy: { registeredAt: 'desc' },
      take: 300,
    });
    if (rows.length === 0) return grouped;
    const userIds = rows.map((row) => row.userId);
    const [members, paidOrders] = await Promise.all([
      this.prisma.companyMember.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          roleInCompany: true,
          company: { select: { name: true, isDeleted: true } },
        },
      }),
      this.prisma.billingOrder.findMany({
        where: {
          createdByUserId: { in: userIds },
          status: 'paid',
          priceVndSnapshot: { gt: 0 },
          kind: { in: ['platform', 'sourcing'] },
        },
        select: { createdByUserId: true },
      }),
    ]);
    const paidUsers = new Set(paidOrders.map((order) => order.createdByUserId));
    const companyName = new Map<string, string>();
    for (const member of members) {
      if (member.company.isDeleted) continue;
      const current = companyName.get(member.userId);
      if (!current || member.roleInCompany === 'owner') {
        companyName.set(member.userId, member.company.name);
      }
    }
    for (const row of rows) {
      if (paidUsers.has(row.userId)) continue;
      const list = grouped.get(row.partnerId) ?? [];
      if (list.length >= 30) continue;
      list.push({
        id: row.id,
        partnerId: row.partnerId,
        companyName: companyName.get(row.userId) ?? row.displayName,
        registeredAt: row.registeredAt.toISOString(),
      });
      grouped.set(row.partnerId, list);
    }
    return grouped;
  }

  private async notifySuperAdmins(notice: { title: string; body: string; link: string }, type: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.SuperAdmin, isDeleted: false, status: 'active' },
      select: { id: true },
    });
    await Promise.all(
      admins.map(async (admin) => {
        try {
          await this.notifications.createInApp({
            tenantId: DEFAULT_TENANT_ID,
            userId: admin.id,
            type,
            title: notice.title,
            body: notice.body,
            link: notice.link,
            entityType: 'crm.commission_period',
            entityId: null,
          });
        } catch (err) {
          this.logger.error(`Không gửi được thông báo hoa hồng: ${String(err)}`);
        }
      }),
    );
  }

  private async walletStatement(partnerId: string): Promise<CrmWalletTxnView[]> {
    const rows = await this.prisma.crmCommissionWalletTxn.findMany({
      where: { partnerId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        entry: { select: { companyName: true, planName: true } },
        period: { select: { periodMonth: true } },
      },
    });
    const balances = walletRunningBalances(rows);
    return rows
      .map((row, index) => ({
        id: row.id,
        kind: row.kind === 'debit' ? ('debit' as const) : ('credit' as const),
        amountVnd: row.amountVnd.toString(),
        balanceAfterVnd: (balances[index] ?? 0n).toString(),
        createdAt: row.createdAt.toISOString(),
        label: walletTxnLabel(row),
      }))
      .reverse()
      .slice(0, 80);
  }

  private async storedVatPercent(): Promise<number | null> {
    const row = await this.prisma.crmVatSetting.findUnique({
      where: { id: 'default' },
      select: { percent: true },
    });
    return vatPercentOrEmpty(row?.percent);
  }

  private async storedPayoutDay(): Promise<number> {
    const row = await this.prisma.crmCommissionPayoutSetting.findUnique({
      where: { id: 'default' },
      select: { payoutDay: true },
    });
    return payoutDayOrDefault(row?.payoutDay);
  }

  private async commissionPercent(): Promise<number | null> {
    const row = await this.prisma.crmCommissionSetting.findUnique({
      where: { id: 'default' },
      select: { percent: true },
    });
    return row?.percent ?? null;
  }

  private async partnerForPaidCompany(
    tx: Prisma.TransactionClient,
    companyId: string,
    referralCode?: string | null,
  ) {
    const code = normalizeReferralCode(referralCode);
    if (code) {
      return tx.crmPartner.findUnique({ where: { code } });
    }
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { taxCode: true },
    });
    const taxCode = claimTax(company?.taxCode);
    if (taxCode) {
      const claim = await tx.crmPartnerClaim.findUnique({
        where: { taxCode },
        include: { partner: true },
      });
      if (claim) return claim.partner;
    }
    const lead = await tx.crmLead.findFirst({
      where: {
        partnerId: { not: null },
        status: { not: 'unqualified' },
        OR: [{ companyId }, { deals: { some: { companyId } } }],
      },
      orderBy: { createdAt: 'asc' },
      include: { partner: true },
    });
    return lead?.partner ?? null;
  }

  private async entriesForPartner(partnerId: string, partnerName: string, partnerCode: string) {
    const rows = await this.prisma.crmCommissionEntry.findMany({
      where: { partnerId },
      orderBy: { paidAt: 'desc' },
      take: 50,
      include: {
        billingOrder: { select: { orderInvoice: { select: { invoiceNumber: true } } } },
        period: { select: { periodMonth: true, status: true } },
      },
    });
    return rows.map((row) =>
      this.mapCommissionEntry(
        row,
        partnerName,
        partnerCode,
        row.billingOrder.orderInvoice?.invoiceNumber ?? null,
        row.period?.periodMonth ?? null,
        periodStatusOf(row.period?.status),
      ),
    );
  }

  private async visibleCommissionRows<T extends { id: string; partnerId: string; companyId: string; partner: { createdByUserId: string } }>(
    actor: AuthenticatedUser,
    rows: T[],
  ): Promise<T[]> {
    if (this.seesAll(actor)) return rows;
    if (actor.role !== UserRole.Sales) return [];
    const leads = await this.prisma.crmLead.findMany({
      where: {
        ownerUserId: actor.id,
        status: { not: 'unqualified' },
        partnerId: { in: [...new Set(rows.map((row) => row.partnerId))] },
      },
      select: {
        partnerId: true,
        companyId: true,
        deals: { select: { companyId: true } },
      },
    });
    const owned = new Set<string>();
    for (const lead of leads) {
      if (!lead.partnerId) continue;
      if (lead.companyId) owned.add(`${lead.partnerId}:${lead.companyId}`);
      for (const deal of lead.deals) {
        if (deal.companyId) owned.add(`${lead.partnerId}:${deal.companyId}`);
      }
    }
    return rows.filter(
      (row) => row.partner.createdByUserId === actor.id || owned.has(`${row.partnerId}:${row.companyId}`),
    );
  }

  private mapCommissionEntry(
    row: {
      id: string;
      partnerId: string;
      companyId: string;
      companyName: string;
      billingOrderId: string;
      orderKind: string;
      planCode: string | null;
      planName: string | null;
      paidAmountVnd: bigint;
      percent: number;
      commissionVnd: bigint;
      paidAt: Date;
    },
    partnerName: string,
    partnerCode: string,
      invoiceNumber: string | null,
      periodMonth: string | null,
      periodStatus: CrmCommissionEntryView['periodStatus'],
  ): CrmCommissionEntryView {
    return {
      id: row.id,
      partnerId: row.partnerId,
      partnerName,
      partnerCode,
      companyId: row.companyId,
      companyName: row.companyName,
      billingOrderId: row.billingOrderId,
      orderKind: row.orderKind === 'sourcing' ? 'sourcing' : 'platform',
      planCode: row.planCode,
      planName: row.planName,
      paidAmountVnd: row.paidAmountVnd.toString(),
      percent: row.percent,
      commissionVnd: row.commissionVnd.toString(),
      status: 'pending_reconcile',
      paidAt: row.paidAt.toISOString(),
      invoiceNumber,
      periodMonth,
      periodStatus,
    };
  }

  private async visiblePeriods<T extends { partnerId: string; partner: { createdByUserId: string } }>(
    actor: AuthenticatedUser,
    rows: T[],
  ): Promise<T[]> {
    if (rows.length === 0 || this.seesAll(actor)) return rows;
    if (actor.role !== UserRole.Sales) return [];
    const ownedPartners = new Set(
      (
        await this.prisma.crmLead.findMany({
          where: {
            ownerUserId: actor.id,
            status: { not: 'unqualified' },
            partnerId: { in: rows.map((row) => row.partnerId) },
          },
          select: { partnerId: true },
        })
      )
        .map((lead) => lead.partnerId)
        .filter((id): id is string => Boolean(id)),
    );
    return rows.filter((row) => row.partner.createdByUserId === actor.id || ownedPartners.has(row.partnerId));
  }

  private mapCommissionPeriod(row: {
    id: string;
    partnerId: string;
    periodMonth: string;
    paidAmountVnd: bigint;
    commissionVnd: bigint;
    entryCount: number;
    status: string;
    closedAt: Date;
    closedByUserId: string | null;
    approvedAt: Date | null;
    paidAt: Date | null;
    partner: { name: string; code: string };
  }): CrmCommissionPeriodListView['periods'][number] {
    return {
      id: row.id,
      partnerId: row.partnerId,
      partnerName: row.partner.name,
      partnerCode: row.partner.code,
      periodMonth: row.periodMonth,
      paidAmountVnd: row.paidAmountVnd.toString(),
      commissionVnd: row.commissionVnd.toString(),
      entryCount: row.entryCount,
      status: row.status === 'paid' ? 'paid' : row.status === 'payable' ? 'payable' : 'closed',
      closedAt: row.closedAt.toISOString(),
      autoClosed: row.closedByUserId == null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
    };
  }

  private async referralOwnerId(createdByUserId: string): Promise<string> {
    const creator = await this.prisma.user.findUnique({
      where: { id: createdByUserId },
      select: { id: true, role: true, status: true, isDeleted: true },
    });
    if (
      creator &&
      !creator.isDeleted &&
      creator.status === 'active' &&
      (creator.role === UserRole.Sales || creator.role === UserRole.SuperAdmin)
    ) {
      return creator.id;
    }
    const admin = await this.prisma.user.findFirst({
      where: { role: UserRole.SuperAdmin, isDeleted: false, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!admin) throw new BadRequestException('Chưa ghi nhận được, thử lại sau');
    return admin.id;
  }

  private async requirePartner(partnerId: string | null | undefined) {
    if (!partnerId) throw new BadRequestException('Chọn cộng tác viên giới thiệu lead này');
    const partner = await this.prisma.crmPartner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, code: true },
    });
    if (!partner) throw new BadRequestException('Không tìm thấy cộng tác viên');
    return partner;
  }

  private async nextPartnerCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `CTV${randomBytes(2).toString('hex').toUpperCase()}`;
      const taken = await this.prisma.crmPartner.findUnique({ where: { code }, select: { id: true } });
      if (!taken) return code;
    }
    throw new BadRequestException('Chưa tạo được mã giới thiệu, thử lại');
  }

  private async nextCode(prefix: 'LD' | 'DL'): Promise<string> {
    const stamp = new Date().toISOString().slice(0, 7).replace('-', '');
    return `${prefix}-${stamp}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private mapLead(lead: {
    id: string;
    leadCode: string;
    companyName: string;
    taxCode: string | null;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
    industry: string | null;
    address: string | null;
    companyId: string | null;
    status: string;
    source: string;
    partnerId: string | null;
    partner: { name: string; code: string } | null;
    ownerUserId: string;
    nextFollowUpAt: Date | null;
    createdAt: Date;
  }, names: Map<string, string>): CrmLeadView {
    const status = lead.status === 'converted' || lead.status === 'unqualified' ? lead.status : 'open';
    return {
      id: lead.id,
      leadCode: lead.leadCode,
      companyName: lead.companyName,
      taxCode: lead.taxCode,
      contactName: lead.contactName,
      contactPhone: lead.contactPhone,
      contactEmail: lead.contactEmail,
      industry: lead.industry,
      address: lead.address,
      companyId: lead.companyId,
      status,
      source: leadSource(lead.source) ?? 'unknown',
      partnerId: lead.partnerId,
      partnerName: lead.partner?.name ?? null,
      partnerCode: lead.partner?.code ?? null,
      ownerUserId: lead.ownerUserId,
      ownerName: names.get(lead.ownerUserId) || 'SuperAdmin',
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
    };
  }

  private mapDeal(deal: {
    id: string;
    dealCode: string;
    title: string;
    leadId: string;
    companyId: string | null;
    stageId: string;
    planKind: string | null;
    planCode: string | null;
    listPriceVnd: bigint | null;
    billingOrderId: string | null;
    invoiceStatus: string;
    invoiceNumber: string | null;
    invoiceIssuedAt: Date | null;
    provisionState: string;
    ownerUserId: string;
    wonAt: Date | null;
    lostAt: Date | null;
    lostReason: string | null;
    createdAt: Date;
    stage: { code: string };
    lead: { companyName: string };
  }, names: Map<string, string>, payment?: { amount: bigint; paidAt: Date; invoiceNumber: string | null; companyName: string | null }): CrmDealView {
    const planKind = deal.planKind === 'platform' || deal.planKind === 'sourcing' ? deal.planKind : null;
    return {
      id: deal.id,
      dealCode: deal.dealCode,
      title: deal.title,
      leadId: deal.leadId,
      companyName: deal.lead.companyName,
      companyId: deal.companyId,
      stageId: deal.stageId,
      stageCode: deal.stage.code,
      planKind,
      planCode: deal.planCode,
      listPriceVnd: deal.listPriceVnd == null ? null : deal.listPriceVnd.toString(),
      paidAmountVnd: payment ? payment.amount.toString() : null,
      paidAt: payment ? payment.paidAt.toISOString() : null,
      paidInvoiceNumber: payment?.invoiceNumber ?? null,
      paidCompanyName: payment?.companyName ?? null,
      billingOrderId: deal.billingOrderId,
      invoiceStatus: deal.invoiceStatus === 'issued' ? 'issued' : 'none',
      invoiceNumber: deal.invoiceNumber,
      invoiceIssuedAt: deal.invoiceIssuedAt?.toISOString() ?? null,
      provisionState: 'not_provisioned',
      ownerUserId: deal.ownerUserId,
      ownerName: names.get(deal.ownerUserId) || 'SuperAdmin',
      wonAt: deal.wonAt?.toISOString() ?? null,
      lostAt: deal.lostAt?.toISOString() ?? null,
      lostReason: deal.lostReason,
      createdAt: deal.createdAt.toISOString(),
    };
  }

  private mapActivity(
    row: {
      id: string;
      leadId: string | null;
      dealId: string | null;
      activityType: string;
      summary: string;
      createdByUserId: string;
      createdAt: Date;
      billingOrderId?: string | null;
      billingOrder?: { orderInvoice: { invoiceNumber: string } | null } | null;
      lead: { companyName: string } | null;
      deal: { lead: { companyName: string } } | null;
    },
    names: Map<string, string>,
  ): CrmActivityView {
    const known: CrmActivityType[] = ['note', 'call', 'zalo', 'visit', 'stage', 'payment'];
    const activityType = known.includes(row.activityType as CrmActivityType)
      ? (row.activityType as CrmActivityType)
      : 'note';
    return {
      id: row.id,
      leadId: row.leadId,
      dealId: row.dealId,
      companyName: row.lead?.companyName ?? row.deal?.lead.companyName ?? null,
      activityType,
      summary: row.summary,
      createdByName: row.billingOrderId ? 'inlink' : names.get(row.createdByUserId) || 'SuperAdmin',
      createdAt: row.createdAt.toISOString(),
      invoiceNumber: row.billingOrder?.orderInvoice?.invoiceNumber ?? null,
    };
  }
}

function paidAtInCycle(
  orders: Array<{ companyId: string; kind: string; planCode: string | null; paidAt: Date | null }>,
  companyId: string,
  kind: string,
  planCode: string,
  startsAt: Date,
  endsAt: Date,
): string | null {
  const paid = orders.find(
    (order) =>
      order.companyId === companyId &&
      order.kind === kind &&
      order.planCode === planCode &&
      order.paidAt &&
      order.paidAt >= startsAt &&
      order.paidAt <= endsAt,
  );
  return paid?.paidAt?.toISOString() ?? null;
}

function daysUntil(endsAt: Date, now: Date): number {
  return Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
}

function claimTax(raw: string | null | undefined): string | null {
  const value = (raw ?? '').replace(/[\s-]/g, '');
  if (!value) return null;
  return /^\d{10}(\d{3})?$/.test(value) ? value : null;
}

type FunnelTally = { leads: number; paidOrders: number; paidAmountVnd: bigint };

function tally(map: Map<string, FunnelTally>, key: string): FunnelTally {
  const row = map.get(key) ?? { leads: 0, paidOrders: 0, paidAmountVnd: 0n };
  map.set(key, row);
  return row;
}

function funnelSourceLabel(key: string): string {
  if (key === 'web') return 'Web';
  if (key === 'zalo') return 'Zalo';
  if (key === 'event') return 'Sự kiện';
  if (key === 'partner') return 'Cộng tác viên';
  if (key === 'none') return 'Chưa có lead';
  return 'Chưa rõ';
}

function funnelBuckets(map: Map<string, FunnelTally>, labelOf: (key: string) => string): CrmFunnelBucket[] {
  return [...map.entries()]
    .map(([key, row]) => ({
      key,
      label: labelOf(key),
      leads: row.leads,
      paidOrders: row.paidOrders,
      paidAmountVnd: row.paidAmountVnd.toString(),
    }))
    .sort((a, b) => {
      const amount = BigInt(b.paidAmountVnd) - BigInt(a.paidAmountVnd);
      if (amount > 0n) return 1;
      if (amount < 0n) return -1;
      return b.leads - a.leads;
    });
}

function clip(value: string | null | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function leadSource(value: string | null | undefined): Exclude<CrmLeadSource, 'unknown'> | null {
  if (value === 'web' || value === 'zalo' || value === 'event' || value === 'partner') return value;
  return null;
}

function sourceLabel(source: Exclude<CrmLeadSource, 'unknown'>): string {
  if (source === 'web') return 'Web';
  if (source === 'zalo') return 'Zalo';
  if (source === 'event') return 'sự kiện';
  return 'cộng tác viên';
}

function parseFollowUp(raw: string | null | undefined): Date | null | undefined {
  if (raw === undefined) return undefined;
  const value = raw?.trim() ?? '';
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Ngày hẹn là ngày tháng năm');
  const date = new Date(`${value}T02:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày hẹn không hợp lệ');
  return date;
}

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84')) digits = `0${digits.slice(2)}`;
  return digits;
}

function normalizeTax(raw: string | null | undefined): string | null {
  const value = raw?.replace(/\s/g, '') ?? '';
  return value.length > 0 ? value : null;
}
