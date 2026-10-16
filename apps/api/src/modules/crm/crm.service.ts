import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  UserRole,
  type CreateCrmActivityRequest,
  type CreateCrmDealRequest,
  type CreateCrmLeadRequest,
  type CrmActivityType,
  type CrmActivityView,
  type CrmBoard,
  type CrmCompanyOption,
  type CrmDealView,
  type CrmLeadView,
  type CrmPlanKind,
  type CrmPlanOption,
  type CrmRenewalView,
  type IssueCrmInvoiceRequest,
  type MoveCrmDealRequest,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

const PIPELINE_CODE = 'ban_goi';

/**
 * CRM ghi lead, deal và số hóa đơn đã xuất.
 * Không tạo đơn thanh toán, không gán gói, không cộng Credit.
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

  async createLead(actor: AuthenticatedUser, input: CreateCrmLeadRequest): Promise<CrmLeadView> {
    const companyName = input.companyName?.trim();
    const contactName = input.contactName?.trim();
    const phone = normalizePhone(input.contactPhone ?? '');
    const taxCode = normalizeTax(input.taxCode);
    if (!companyName || !contactName || phone.length < 9) {
      throw new BadRequestException('Cần tên công ty, người liên hệ và số điện thoại');
    }
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
        ownerUserId: actor.id,
      },
    });
    await this.prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'note',
        summary: `Tạo lead ${lead.leadCode}`,
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
        ? `Chuyển ${deal.dealCode} sang Đã chốt. CRM không bật gói.`
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

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84')) digits = `0${digits.slice(2)}`;
  return digits;
}

function normalizeTax(raw: string | null | undefined): string | null {
  const value = raw?.replace(/\s/g, '') ?? '';
  return value.length > 0 ? value : null;
}
