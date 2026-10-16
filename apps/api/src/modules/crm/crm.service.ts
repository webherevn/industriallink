import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  type CrmPartnerClaimView,
  type CrmPartnerSelfView,
  type UpdateCrmCommissionRequest,
  type RegisterCrmPartnerRequest,
  type CrmActivityType,
  type CrmActivityView,
  type CrmBoard,
  type CrmCompanyOption,
  type CrmDealView,
  type CrmLeadSource,
  type CrmLeadView,
  type CrmPlanKind,
  type CrmPartnerView,
  type CrmPlanOption,
  type CrmRenewalView,
  type IssueCrmInvoiceRequest,
  type MoveCrmDealRequest,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { commissionVnd } from './commission-amount';
import { normalizeReferralCode } from './referral-cookie';

const PIPELINE_CODE = 'ban_goi';
const CLAIM_LIMIT = 30;
const partnerClaims = { orderBy: { createdAt: 'desc' as const }, take: CLAIM_LIMIT };

/**
 * CRM ghi lead, deal, số hóa đơn đã xuất và khoản hoa hồng chờ đối soát.
 * Không tạo đơn thanh toán, không gán gói, không cộng Credit, không lệnh chi.
 */
@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

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
        },
      }),
    ]);
    const names = await this.ownerNames([
      ...leads.map((lead) => lead.ownerUserId),
      ...deals.map((deal) => deal.ownerUserId),
      ...activities.map((row) => row.createdByUserId),
    ]);
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
      deals: deals.map((deal) => this.mapDeal(deal, names)),
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
    const [companies, leads] = await Promise.all([
      this.prisma.company.findMany({
        where: { id: { in: companyIds }, isDeleted: false },
        select: { id: true, name: true },
      }),
      this.prisma.crmLead.findMany({
        where: { companyId: { in: companyIds }, status: { not: 'unqualified' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, companyId: true, status: true, ownerUserId: true },
      }),
    ]);
    const companyName = new Map(companies.map((company) => [company.id, company.name]));
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
      });
    }
    const visible = this.seesAll(actor) ? rows : rows.filter((row) => row.leadId);
    return visible.sort((a, b) => a.daysLeft - b.daysLeft);
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
      select: { id: true, name: true, taxCode: true },
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

  async partners(): Promise<CrmPartnerView[]> {
    const rows = await this.prisma.crmPartner.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { claims: partnerClaims },
    });
    return rows.map((row) => this.mapPartner(row));
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
    const [row, commissionPercent] = await Promise.all([
      this.prisma.crmPartner.findUnique({
        where: { userId: actor.id },
        include: { claims: partnerClaims },
      }),
      this.commissionPercent(),
    ]);
    const commissions = row ? await this.entriesForPartner(row.id, row.name, row.code) : [];
    return { partner: row ? this.mapPartner(row) : null, commissionPercent, commissions };
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
      await tx.crmCommissionEntry.create({
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
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
  }

  async commissionLedger(actor: AuthenticatedUser): Promise<CrmCommissionLedgerView> {
    const rows = await this.prisma.crmCommissionEntry.findMany({
      orderBy: { paidAt: 'desc' },
      take: 200,
      include: { partner: { select: { id: true, name: true, code: true, createdByUserId: true } } },
    });
    const visible = await this.visibleCommissionRows(actor, rows);
    const pendingTotalVnd = visible.reduce((sum, row) => sum + row.commissionVnd, 0n);
    return {
      entries: visible.map((row) => this.mapCommissionEntry(row, row.partner.name, row.partner.code)),
      pendingTotalVnd: pendingTotalVnd.toString(),
    };
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
    const taxCode = normalizeTax(input.taxCode);
    const source = leadSource(input.source);
    if (!companyName || !contactName || phone.length < 9) {
      throw new BadRequestException('Cần tên công ty, người liên hệ và số điện thoại');
    }
    if (!source) throw new BadRequestException('Chọn nguồn khách: Web, Zalo, sự kiện hoặc cộng tác viên');
    const partner = source === 'partner' ? await this.requirePartner(input.partnerId) : null;
    await this.assertNoDuplicate(taxCode, phone);
    const companyId = await this.resolveCompanyId(input.companyId, taxCode);

    const lead = await this.prisma.crmLead.create({
      data: {
        leadCode: await this.nextCode('LD'),
        companyName,
        taxCode,
        contactName,
        contactPhone: phone,
        contactEmail: input.contactEmail?.trim() || null,
        industry: input.industry?.trim() || null,
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
        summary: `Tạo deal ${deal.dealCode}. Chưa gán gói.`,
        createdByUserId: actor.id,
      },
    });
    return this.mapDeal(deal, await this.ownerNames([actor.id]));
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

    const updated = await this.prisma.crmDeal.update({
      where: { id: deal.id },
      data: {
        stageId: stage.id,
        wonAt: stage.code === 'won' ? new Date() : null,
        lostAt: stage.code === 'lost' ? new Date() : null,
        lostReason: stage.code === 'lost' ? input.lostReason?.trim() || null : null,
        provisionState: 'not_provisioned',
      },
      include: { stage: true, lead: true },
    });
    const summary =
      stage.code === 'won'
        ? `Chuyển ${deal.dealCode} sang Đã chốt. CRM không bật gói và không ghi hoa hồng.`
        : stage.code === 'awaiting_payment'
          ? `Chuyển ${deal.dealCode} sang Chờ thanh toán. Khách tự thanh toán trên inlink.`
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
    return this.mapDeal(updated, await this.ownerNames([deal.ownerUserId]));
  }

  async issueInvoice(
    actor: AuthenticatedUser,
    dealId: string,
    input: IssueCrmInvoiceRequest,
  ): Promise<CrmDealView> {
    const number = input.invoiceNumber?.trim() ?? '';
    if (number.length < 1 || number.length > 64) {
      throw new BadRequestException('Nhập số hóa đơn, tối đa 64 ký tự');
    }
    const deal = await this.prisma.crmDeal.findUnique({
      where: { id: dealId },
      include: { stage: true, lead: true },
    });
    if (!deal) throw new NotFoundException('Không tìm thấy deal');
    this.assertOwner(actor, deal.ownerUserId);
    const updated = await this.prisma.crmDeal.update({
      where: { id: deal.id },
      data: {
        invoiceNumber: number,
        invoiceStatus: 'issued',
        invoiceIssuedAt: new Date(),
      },
      include: { stage: true, lead: true },
    });
    await this.prisma.crmActivity.create({
      data: {
        leadId: deal.leadId,
        dealId: deal.id,
        activityType: 'note',
        summary: `Ghi hóa đơn ${number} cho ${deal.dealCode}. Chưa tính VAT, không theo dõi công nợ.`,
        createdByUserId: actor.id,
      },
    });
    return this.mapDeal(updated, await this.ownerNames([deal.ownerUserId]));
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

  private async assertNoDuplicate(taxCode: string | null, phone: string) {
    const existing = await this.prisma.crmLead.findFirst({
      where: {
        status: { not: 'unqualified' },
        OR: [
          ...(taxCode ? [{ taxCode }] : []),
          { contactPhone: phone },
        ],
      },
    });
    if (existing) {
      throw new BadRequestException(`Lead đã có: ${existing.leadCode}`);
    }
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
  }): CrmPartnerView {
    const origin = (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      code: row.code,
      referralUrl: `${origin}/bang-gia?ref=${encodeURIComponent(row.code)}`,
      fromAccount: Boolean(row.userId),
      createdAt: row.createdAt.toISOString(),
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
      const fromCookie = await tx.crmPartner.findUnique({ where: { code } });
      if (fromCookie) return fromCookie;
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
    });
    return rows.map((row) => this.mapCommissionEntry(row, partnerName, partnerCode));
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
    companyId: string | null;
    status: string;
    source: string;
    partnerId: string | null;
    partner: { name: string; code: string } | null;
    ownerUserId: string;
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
      companyId: lead.companyId,
      status,
      source: leadSource(lead.source) ?? 'unknown',
      partnerId: lead.partnerId,
      partnerName: lead.partner?.name ?? null,
      partnerCode: lead.partner?.code ?? null,
      ownerUserId: lead.ownerUserId,
      ownerName: names.get(lead.ownerUserId) || 'SuperAdmin',
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
    createdAt: Date;
    stage: { code: string };
    lead: { companyName: string };
  }, names: Map<string, string>): CrmDealView {
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
      billingOrderId: deal.billingOrderId,
      invoiceStatus: deal.invoiceStatus === 'issued' ? 'issued' : 'none',
      invoiceNumber: deal.invoiceNumber,
      invoiceIssuedAt: deal.invoiceIssuedAt?.toISOString() ?? null,
      provisionState: 'not_provisioned',
      ownerUserId: deal.ownerUserId,
      ownerName: names.get(deal.ownerUserId) || 'SuperAdmin',
      wonAt: deal.wonAt?.toISOString() ?? null,
      lostAt: deal.lostAt?.toISOString() ?? null,
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
      lead: { companyName: string } | null;
      deal: { lead: { companyName: string } } | null;
    },
    names: Map<string, string>,
  ): CrmActivityView {
    const known: CrmActivityType[] = ['note', 'call', 'zalo', 'visit', 'stage'];
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
      createdByName: names.get(row.createdByUserId) || 'SuperAdmin',
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function daysUntil(endsAt: Date, now: Date): number {
  return Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
}

function claimTax(raw: string | null | undefined): string | null {
  const value = (raw ?? '').replace(/[\s-]/g, '');
  if (!value) return null;
  return /^\d{10}(\d{3})?$/.test(value) ? value : null;
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

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84')) digits = `0${digits.slice(2)}`;
  return digits;
}

function normalizeTax(raw: string | null | undefined): string | null {
  const value = raw?.replace(/\s/g, '') ?? '';
  return value.length > 0 ? value : null;
}
