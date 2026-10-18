import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { readLeadProfile } from './lead-profile';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  UserRole,
  resolveVnProvince2025,
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
  type CrmCustomerView,
  type CrmCustomerStanding,
  type CrmTaxSuggestion,
  type CrmCompanyProfileView,
  type CrmUnclaimedCustomerView,
  type CrmOwnerOption,
  type UpdateCrmLeadRequest,
  type CrmDealView,
  type CrmLeadView,
  type CrmPlanKind,
  type CrmPartnerView,
  type CrmPartnerProfileView,
  type CrmPartnerPaidOrderView,
  type CrmReferralSignupView,
  type CrmPlanOption,
  type CrmPaidInvoiceLedgerView,
  type CrmPaidOrderInvoiceView,
  type CrmRenewalView,
  type CrmFunnelReport,
  type CrmFunnelBucket,
  type CrmPipelineReport,
  type CrmLeadSourceReport,
  type CrmQuoteReport,
  type CrmRenewalReport,
  type CrmRenewalReportRow,
  type CrmRenewalReportStatus,
  type CrmPartnerPaidReport,
  type CrmWorkspaceReport,
  type CrmWorkspacePerson,
  type CrmReceivableLedger,
  type CrmQuoteInstallmentInput,
  type CreateCrmQuoteRequest,
  type CrmQuoteFormView,
  type UpdateCrmQuoteFormRequest,
  type CrmStaffGender,
  type CrmStaffProfilePage,
  type CrmStaffProfileView,
  type UpdateCrmStaffProfileRequest,
  type CrmQuoteView,
  type CrmEnterpriseRequestView,
  type IssueCrmInvoiceRequest,
  type MoveCrmDealRequest,
} from '@industriallink/contracts';
import { DEFAULT_TENANT_ID } from '../../shared/common/constants';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import { compressUploadedImage } from '../../shared/media/optimize-image';
import { v7 as uuidv7 } from 'uuid';
import { CrmMarketingService } from './crm-marketing.service';
import { NotificationService } from '../notification/notification.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { commissionVnd } from './commission-amount';
import { groupCommissionClose, previousVietnamPeriodMonth, vietnamMonthBounds, vietnamMonthHasEnded, vietnamPeriodMonth } from './commission-period';
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
    private readonly marketing: CrmMarketingService,
    private readonly storage: StorageService,
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
        include: {
          partner: { select: { id: true, name: true, code: true } },
          campaign: { select: { name: true, campaignCode: true } },
        },
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

  async quotes(actor: AuthenticatedUser): Promise<CrmQuoteView[]> {
    const rows = await this.prisma.crmQuote.findMany({
      where: this.ownScope(actor),
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { installments: { orderBy: { sortOrder: 'asc' } } },
    });
    const names = await this.ownerNames(rows.map((row) => row.ownerUserId));
    return this.withQuoteDeals(rows, names);
  }

  async quote(actor: AuthenticatedUser, id: string): Promise<CrmQuoteView> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Không tìm thấy báo giá');
    const row = await this.prisma.crmQuote.findUnique({
      where: { id },
      include: { installments: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Không tìm thấy báo giá');
    this.assertOwner(actor, row.ownerUserId);
    const [view] = await this.withQuoteDeals([row], await this.ownerNames([row.ownerUserId]));
    return view;
  }

  /** Mẫu in trên mọi tờ. Sale đọc được. Không chứa giá. */
  async quoteForm(actor: AuthenticatedUser): Promise<CrmQuoteFormView> {
    const row = await this.prisma.crmQuoteForm.findUnique({ where: { id: 'default' } });
    return this.mapQuoteForm(row, actor.role === UserRole.SuperAdmin);
  }

  /** SuperAdmin sửa phần cố định của tờ. Không đổi báo giá đã lập. */
  async setQuoteForm(actor: AuthenticatedUser, input: UpdateCrmQuoteFormRequest): Promise<CrmQuoteFormView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin sửa mẫu tờ báo giá');
    }
    const data = {
      legalName: clip(input.legalName, 200) || null,
      taxCode: this.readTax(input.taxCode),
      address: clip(input.address, 300) || null,
      phone: this.optionalContactPhone(input.phone),
      email: this.optionalContactEmail(input.email),
      website: optionalSite(input.website),
      bankName: clip(input.bankName, 120) || null,
      bankAccount: optionalAccount(input.bankAccount),
      bankHolder: clip(input.bankHolder, 160) || null,
      transferNote: clip(input.transferNote, 160) || null,
      terms: clip(input.terms, 4000) || null,
      signerTitle: clip(input.signerTitle, 80) || null,
      updatedByUserId: actor.id,
    };
    await this.prisma.crmQuoteForm.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });
    return this.quoteForm(actor);
  }

  async uploadQuoteFormLogo(
    actor: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<CrmQuoteFormView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin sửa mẫu tờ báo giá');
    }
    if (!file) throw new BadRequestException('Thiếu file ảnh logo');
    if (!QUOTE_LOGO_MIME.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF');
    }
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('Ảnh vượt quá 2MB');
    const image = await compressUploadedImage(file.buffer, 1024);
    const storageKey = `crm/quote-form/${uuidv7()}.${image.ext}`;
    await this.storage.putObject(storageKey, image.buffer, image.mime);
    const current = await this.prisma.crmQuoteForm.findUnique({ where: { id: 'default' }, select: { logoStorageKey: true } });
    await this.prisma.crmQuoteForm.upsert({
      where: { id: 'default' },
      create: { id: 'default', logoStorageKey: storageKey, logoMime: image.mime, updatedByUserId: actor.id },
      update: { logoStorageKey: storageKey, logoMime: image.mime, updatedByUserId: actor.id },
    });
    if (current?.logoStorageKey && current.logoStorageKey !== storageKey) {
      await this.storage.deleteObject(current.logoStorageKey).catch(() => undefined);
    }
    return this.quoteForm(actor);
  }

  async quoteFormLogo(): Promise<{ buffer: Buffer; mime: string } | null> {
    const row = await this.prisma.crmQuoteForm.findUnique({
      where: { id: 'default' },
      select: { logoStorageKey: true, logoMime: true },
    });
    if (!row?.logoStorageKey) return null;
    const buffer = await this.storage.getObject(row.logoStorageKey);
    return { buffer, mime: row.logoMime ?? 'image/jpeg' };
  }

  /** Hồ sơ nhân sự. Người đó sửa của mình. SuperAdmin sửa của từng nhân sự. */
  async staffProfile(actor: AuthenticatedUser, userId?: string): Promise<CrmStaffProfilePage> {
    const staff = actor.role === UserRole.SuperAdmin ? await this.staffOptions() : null;
    const targetId = userId?.trim() || (actor.role === UserRole.SuperAdmin ? staff?.[0]?.id : actor.id);
    if (!targetId) return { profile: null, staff };
    const user = await this.staffUser(actor, targetId);
    const row = await this.prisma.crmStaffProfile.findUnique({ where: { userId: user.id } });
    return { profile: this.mapStaffProfile(user, row, actor), staff };
  }

  async saveStaffProfile(actor: AuthenticatedUser, input: UpdateCrmStaffProfileRequest): Promise<CrmStaffProfileView> {
    const user = await this.staffUser(actor, input.userId?.trim() || actor.id);
    const displayName = input.displayName?.trim() ?? '';
    if (displayName.length < 2) throw new BadRequestException('Cần tên đầy đủ');
    const gender = readStaffGender(input.gender);
    const phone = this.optionalContactPhone(input.phone);
    const birthDate = this.readBirth(input.birthDate);
    const postalCode = optionalPostal(input.postalCode);
    const province = readStaffProvince(input.province);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { displayName: displayName.slice(0, 160), updatedBy: actor.id },
    });
    const row = await this.prisma.crmStaffProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        birthDate,
        gender,
        phone,
        address: clip(input.address, 300) || null,
        province,
        postalCode,
      },
      update: {
        birthDate,
        gender,
        phone,
        address: clip(input.address, 300) || null,
        province,
        postalCode,
      },
    });
    return this.mapStaffProfile({ ...user, displayName: displayName.slice(0, 160) }, row, actor);
  }

  async uploadStaffAvatar(
    actor: AuthenticatedUser,
    userId: string | undefined,
    file: Express.Multer.File | undefined,
  ): Promise<CrmStaffProfileView> {
    const user = await this.staffUser(actor, userId?.trim() || actor.id);
    if (!file) throw new BadRequestException('Thiếu ảnh đại diện');
    if (!QUOTE_LOGO_MIME.has(file.mimetype)) throw new BadRequestException('Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('Ảnh vượt quá 2MB');
    const image = await compressUploadedImage(file.buffer, 512);
    const storageKey = `crm/staff-avatar/${user.id}/${uuidv7()}.${image.ext}`;
    await this.storage.putObject(storageKey, image.buffer, image.mime);
    const current = await this.prisma.crmStaffProfile.findUnique({ where: { userId: user.id }, select: { avatarStorageKey: true } });
    const row = await this.prisma.crmStaffProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, avatarStorageKey: storageKey, avatarMime: image.mime },
      update: { avatarStorageKey: storageKey, avatarMime: image.mime },
    });
    if (current?.avatarStorageKey && current.avatarStorageKey !== storageKey) {
      await this.storage.deleteObject(current.avatarStorageKey).catch(() => undefined);
    }
    return this.mapStaffProfile(user, row, actor);
  }

  async staffAvatar(actor: AuthenticatedUser, userId?: string): Promise<{ buffer: Buffer; mime: string } | null> {
    const targetId = userId?.trim() || actor.id;
    const user = await this.staffUser(actor, targetId);
    const row = await this.prisma.crmStaffProfile.findUnique({
      where: { userId: user.id },
      select: { avatarStorageKey: true, avatarMime: true },
    });
    if (!row?.avatarStorageKey) return null;
    const buffer = await this.storage.getObject(row.avatarStorageKey);
    return { buffer, mime: row.avatarMime ?? 'image/jpeg' };
  }

  /** Lập tờ chào giá. Giá lấy từ gói SuperAdmin, chưa VAT. Không tạo đơn. */
  async createQuote(actor: AuthenticatedUser, input: CreateCrmQuoteRequest): Promise<CrmQuoteView> {
    const companyName = input.companyName?.trim();
    const contactName = input.contactName?.trim();
    if (!companyName || companyName.length < 2 || !contactName || contactName.length < 2) {
      throw new BadRequestException('Cần tên công ty và người nhận báo giá');
    }
    const taxCode = this.readTax(input.taxCode);
    let companyId = input.companyId ?? null;
    if (input.leadId) {
      if (!/^[0-9a-f-]{36}$/i.test(input.leadId)) throw new NotFoundException('Không tìm thấy lead');
      const lead = await this.prisma.crmLead.findUnique({ where: { id: input.leadId } });
      if (!lead || lead.status === 'unqualified') throw new NotFoundException('Không tìm thấy lead');
      this.assertOwner(actor, lead.ownerUserId);
      companyId = companyId ?? lead.companyId;
    }
    if (companyId) {
      if (!/^[0-9a-f-]{36}$/i.test(companyId)) throw new NotFoundException('Không tìm thấy công ty');
      await this.assertCompany(companyId);
    } else if (taxCode) {
      const company = await this.prisma.company.findFirst({
        where: { taxCode, isDeleted: false },
        select: { id: true },
      });
      companyId = company?.id ?? null;
    }
    const quotedOn = calendarDay(input.quotedOn, 'Ngày báo giá');
    if (!quotedOn) throw new BadRequestException('Cần ngày báo giá');
    const validUntil = calendarDay(input.validUntil, 'Hiệu lực đến ngày');
    if (validUntil && validUntil < quotedOn) throw new BadRequestException('Hiệu lực phải từ ngày báo giá trở đi');
    const status = input.status === 'sent' ? 'sent' : input.status === 'draft' || input.status == null ? 'draft' : null;
    if (!status) throw new BadRequestException('Tình trạng là bản thảo hoặc đã gửi');
    let dealId: string | null = null;
    if (input.dealId) {
      if (!/^[0-9a-f-]{36}$/i.test(input.dealId)) throw new NotFoundException('Không tìm thấy cơ hội');
      const deal = await this.prisma.crmDeal.findUnique({ where: { id: input.dealId }, select: { id: true, ownerUserId: true } });
      if (!deal) throw new NotFoundException('Không tìm thấy cơ hội');
      this.assertOwner(actor, deal.ownerUserId);
      dealId = deal.id;
    }
    const vat = await this.prisma.crmVatSetting.findUnique({ where: { id: 'default' }, select: { percent: true } });
    const note = input.note?.trim().slice(0, 500) || null;
    const contactPhone = this.optionalContactPhone(input.contactPhone);
    const contactEmail = this.optionalContactEmail(input.contactEmail);
    if (input.quoteKind === 'enterprise') {
      const plan = this.readEnterpriseQuote(input.packageName, input.contractVnd, input.installments, quotedOn);
      const row = await this.prisma.crmQuote.create({
        data: {
          quoteCode: await this.nextCode('BG'),
          companyName: companyName.slice(0, 160),
          taxCode,
          contactName: contactName.slice(0, 160),
          contactPhone,
          contactEmail,
          address: clip(input.address, 300) || null,
          quotedOn,
          validUntil,
          status,
          kind: 'enterprise',
          leadId: input.leadId ?? null,
          dealId,
          companyId,
          ownerUserId: actor.id,
          option1Kind: 'enterprise',
          option1Code: 'ENTERPRISE',
          option1Name: plan.packageName,
          option1PriceVnd: plan.contractVnd,
          vatPercent: vat?.percent ?? null,
          note,
          installments: { create: plan.lines },
        },
        include: { installments: { orderBy: { sortOrder: 'asc' } } },
      });
      const [view] = await this.withQuoteDeals([row], await this.ownerNames([actor.id]));
      return view;
    }
    const option1 = await this.snapshotPlan(input.option1Kind ?? null, input.option1Code ?? null);
    if (!option1) throw new BadRequestException('Chọn phương án 1');
    const option2Kind = input.option2Kind ?? null;
    const option2Code = input.option2Code?.trim() ?? '';
    const option2 = option2Kind || option2Code ? await this.snapshotPlan(option2Kind, option2Code || null) : null;
    if ((option2Kind || option2Code) && !option2) throw new BadRequestException('Phương án 2 chưa đủ gói');
    if (option2 && option2.kind === option1.kind && option2.code === option1.code) {
      throw new BadRequestException('Hai phương án đang trùng một gói');
    }
    const row = await this.prisma.crmQuote.create({
      data: {
        quoteCode: await this.nextCode('BG'),
        companyName: companyName.slice(0, 160),
        taxCode,
        contactName: contactName.slice(0, 160),
        contactPhone,
        contactEmail,
        address: clip(input.address, 300) || null,
        quotedOn,
        validUntil,
        status,
        leadId: input.leadId ?? null,
        dealId,
        companyId,
        ownerUserId: actor.id,
        option1Kind: option1.kind,
        option1Code: option1.code,
        option1Name: option1.name,
        option1PriceVnd: option1.priceVnd,
        option2Kind: option2?.kind ?? null,
        option2Code: option2?.code ?? null,
        option2Name: option2?.name ?? null,
        option2PriceVnd: option2?.priceVnd ?? null,
        vatPercent: vat?.percent ?? null,
        note,
      },
    });
    const [view] = await this.withQuoteDeals([row], await this.ownerNames([actor.id]));
    return view;
  }

  /** Chốt tờ Enterprise. Các đợt thành công nợ. Không tạo đơn và không bật gói. */
  async acceptEnterpriseQuote(actor: AuthenticatedUser, id: string): Promise<CrmQuoteView> {
    const current = await this.quote(actor, id);
    if (current.quoteKind !== 'enterprise') throw new BadRequestException('Chỉ hợp đồng Enterprise mới ghi công nợ');
    if (current.status === 'accepted') throw new BadRequestException('Hợp đồng này đã chốt');
    if (current.installments.length < 2) throw new BadRequestException('Hợp đồng cần ít nhất hai đợt');
    if (current.dealId) {
      const deal = await this.prisma.crmDeal.findUnique({
        where: { id: current.dealId },
        select: { stage: { select: { code: true } } },
      });
      if (deal?.stage.code === 'lost') throw new BadRequestException('Cơ hội đã kết thúc thất bại, không chốt hợp đồng');
    }
    await this.prisma.$transaction([
      this.prisma.crmQuote.update({ where: { id }, data: { status: 'accepted', acceptedAt: new Date() } }),
      this.prisma.crmQuoteInstallment.updateMany({ where: { quoteId: id, status: 'scheduled' }, data: { status: 'open' } }),
    ]);
    return this.quote(actor, id);
  }

  /** Ghi một đợt đã thu đủ. Không bật gói Enterprise. */
  async collectInstallment(actor: AuthenticatedUser, quoteId: string, installmentId: string): Promise<CrmQuoteView> {
    await this.quote(actor, quoteId);
    if (!/^[0-9a-f-]{36}$/i.test(installmentId)) throw new NotFoundException('Không tìm thấy đợt thanh toán');
    const line = await this.prisma.crmQuoteInstallment.findFirst({ where: { id: installmentId, quoteId } });
    if (!line) throw new NotFoundException('Không tìm thấy đợt thanh toán');
    if (line.status !== 'open') throw new BadRequestException('Đợt này chưa ở trạng thái phải thu');
    await this.prisma.crmQuoteInstallment.update({
      where: { id: line.id },
      data: { status: 'collected', collectedAt: new Date() },
    });
    return this.quote(actor, quoteId);
  }

  /** Công nợ Enterprise đang mở. Sale chỉ thấy tờ của mình. */
  async receivables(actor: AuthenticatedUser): Promise<CrmReceivableLedger> {
    const rows = await this.prisma.crmQuoteInstallment.findMany({
      where: { status: 'open', quote: this.ownScope(actor) },
      orderBy: { dueOn: 'asc' },
      include: { quote: { select: { id: true, quoteCode: true, companyName: true, ownerUserId: true } } },
    });
    const names = await this.ownerNames(rows.map((row) => row.quote.ownerUserId));
    const receivable = rows.reduce((sum, row) => sum + row.amountVnd, 0n);
    return {
      receivableVnd: receivable.toString(),
      rows: rows.map((row) => ({
        id: row.id,
        quoteId: row.quote.id,
        quoteCode: row.quote.quoteCode,
        companyName: row.quote.companyName,
        ownerName: names.get(row.quote.ownerUserId) ?? 'Người phụ trách',
        label: row.label,
        percent: row.percent,
        amountVnd: row.amountVnd.toString(),
        dueOn: row.dueOn.toISOString().slice(0, 10),
      })),
    };
  }

  /** Sổ khách. Sale chỉ thấy công ty mình phụ trách. Không gán gói. */
  async customers(actor: AuthenticatedUser, rawQuery: string): Promise<CrmCustomerView[]> {
    const q = rawQuery.trim().slice(0, 80);
    const scopedIds = this.seesAll(actor) ? null : await this.invoiceCompanyIds(actor);
    if (scopedIds && scopedIds.length === 0) return [];
    const [leadRows, paidCompanyRows, platformHolders, sourcingHolders] = await Promise.all([
      this.prisma.crmLead.findMany({
        where: {
          status: { not: 'unqualified' },
          companyId: scopedIds ? { in: scopedIds } : { not: null },
        },
        select: {
          companyId: true,
          ownerUserId: true,
          status: true,
          createdAt: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          department: true,
          orgField: true,
          industry: true,
          address: true,
          street: true,
          ward: true,
          province: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.seesAll(actor)
        ? this.prisma.billingOrder.findMany({
            where: this.paidPlanOrderWhere(),
            distinct: ['companyId'],
            select: { companyId: true },
          })
        : Promise.resolve([] as { companyId: string }[]),
      this.seesAll(actor)
        ? this.prisma.billingCompanyPlan.findMany({ select: { companyId: true } })
        : Promise.resolve([] as { companyId: string }[]),
      this.seesAll(actor)
        ? this.prisma.billingCompanySourcingPlan.findMany({ select: { companyId: true } })
        : Promise.resolve([] as { companyId: string }[]),
    ]);
    const ids = [
      ...new Set([
        ...leadRows.flatMap((lead) => (lead.companyId ? [lead.companyId] : [])),
        ...paidCompanyRows.map((row) => row.companyId),
        ...platformHolders.map((row) => row.companyId),
        ...sourcingHolders.map((row) => row.companyId),
      ]),
    ];
    if (ids.length === 0) return [];
    const companies = await this.prisma.company.findMany({
      where: {
        id: { in: ids },
        isDeleted: false,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { taxCode: { contains: q.replace(/\s+/g, '') } },
                { id: { in: await this.customerIdsByContact(q, scopedIds) } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, taxCode: true, address: true, industry: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
    if (companies.length === 0) return [];
    const companyIds = companies.map((company) => company.id);
    const now = new Date();
    const [platformPlans, sourcingPlans, paidForPage] = await Promise.all([
      this.prisma.billingCompanyPlan.findMany({
        where: { companyId: { in: companyIds } },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.billingCompanySourcingPlan.findMany({
        where: { companyId: { in: companyIds } },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.billingOrder.findMany({
        where: { ...this.paidPlanOrderWhere(), companyId: { in: companyIds } },
        distinct: ['companyId'],
        select: { companyId: true },
      }),
    ]);
    const platformByCompany = new Map(platformPlans.map((row) => [row.companyId, row]));
    const sourcingByCompany = new Map(sourcingPlans.map((row) => [row.companyId, row]));
    const paidIds = new Set(paidForPage.map((row) => row.companyId));
    const pageIds = new Set(companyIds);
    const ownerByCompany = new Map<string, (typeof leadRows)[number] & { open: boolean }>();
    for (const lead of leadRows) {
      if (!lead.companyId || !pageIds.has(lead.companyId)) continue;
      const open = lead.status === 'open';
      const current = ownerByCompany.get(lead.companyId);
      if (!current || (!current.open && open)) ownerByCompany.set(lead.companyId, { ...lead, open });
    }
    const names = await this.ownerNames([...ownerByCompany.values()].map((row) => row.ownerUserId));
    const planLive = (row: { isActive: boolean; endsAt: Date | null } | undefined) =>
      Boolean(row && row.isActive && (!row.endsAt || row.endsAt > now));
    return companies.map((company) => {
      const platform = platformByCompany.get(company.id);
      const sourcing = sourcingByCompany.get(company.id);
      const standing: CrmCustomerStanding = planLive(platform) || planLive(sourcing)
        ? 'active'
        : paidIds.has(company.id) || platform || sourcing
          ? 'lapsed'
          : 'prospect';
      const lead = ownerByCompany.get(company.id);
      const address = customerAddress(lead, company.address);
      return {
        companyId: company.id,
        companyName: company.name,
        taxCode: company.taxCode,
        contactName: lead?.contactName?.trim() || null,
        department: lead?.department?.trim() || null,
        contactPhone: lead?.contactPhone?.trim() || null,
        contactEmail: lead?.contactEmail?.trim() || null,
        orgField: lead?.orgField?.trim() || lead?.industry?.trim() || company.industry?.trim() || null,
        address,
        standing,
        platformPlanName: planLive(platform) ? platform?.plan.name ?? null : null,
        sourcingPlanName: planLive(sourcing) ? sourcing?.plan.name ?? null : null,
        ownerName: names.get(lead?.ownerUserId ?? '') ?? null,
      };
    });
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
    const bounds = vietnamMonthBounds(vietnamPeriodMonth(new Date()))!;
    const [pending, signups, wallets, paid, leads] = await Promise.all([
      this.pendingByPartner(actor, ids),
      this.unpaidSignups(ids),
      this.walletBalances(ids),
      this.partnerMonthPaid(actor, ids, bounds.start, bounds.end),
      this.partnerLeadCounts(actor, ids),
    ]);
    return rows.map((row) =>
      this.mapPartner(row, pending.get(row.id), signups.get(row.id) ?? [], wallets.get(row.id) ?? 0n, paid.get(row.id), leads.get(row.id) ?? 0),
    );
  }

  /** Hồ sơ một cộng tác viên. Doanh số là đơn đã trả trong tháng, không phải hoa hồng. */
  async partnerProfile(actor: AuthenticatedUser, id: string, rawMonth: string): Promise<CrmPartnerProfileView> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Không thấy cộng tác viên');
    const { periodMonth, start, end } = this.reportBounds(rawMonth);
    const row = await this.prisma.crmPartner.findUnique({ where: { id }, include: { claims: partnerClaims } });
    if (!row) throw new NotFoundException('Không thấy cộng tác viên');
    await this.ensureWalletCredits([id]);
    const [pending, signups, wallets, paid, leads, orders] = await Promise.all([
      this.pendingByPartner(actor, [id]),
      this.unpaidSignups([id]),
      this.walletBalances([id]),
      this.partnerMonthPaid(actor, [id], start, end),
      this.partnerLeadCounts(actor, [id]),
      this.partnerPaidOrders(actor, id, start, end),
    ]);
    return {
      periodMonth,
      partner: this.mapPartner(row, pending.get(id), signups.get(id) ?? [], wallets.get(id) ?? 0n, paid.get(id), leads.get(id) ?? 0),
      orders,
    };
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
    const phone = this.readPhone(input.contactPhone);
    const taxCode = this.readTax(input.taxCode);
    const source = await this.readLeadSource(input.source);
    const profile = readLeadProfile(input);
    if (!companyName || companyName.length < 2 || !contactName || contactName.length < 2 || !taxCode) {
      throw new BadRequestException('Cần mã số thuế, tên công ty và người liên hệ');
    }
    const partner = source.code === 'partner' ? await this.requirePartner(input.partnerId) : null;
    const companyId = await this.resolveCompanyId(input.companyId, taxCode);
    await this.assertNoDuplicate(taxCode, phone, undefined, companyId);
    const campaignId = await this.marketing.campaignIdFor(actor, input.campaignId ?? null);

    const lead = await this.prisma.crmLead.create({
      data: {
        leadCode: await this.nextCode('LD'),
        companyName,
        taxCode,
        contactName,
        contactPhone: phone,
        ...profile,
        companyId,
        source: source.code,
        partnerId: partner?.id ?? null,
        campaignId,
        ownerUserId: actor.id,
      },
      include: {
        partner: { select: { id: true, name: true, code: true } },
        campaign: { select: { name: true, campaignCode: true } },
      },
    });
    await this.prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'note',
        summary: partner
          ? `Tạo lead ${lead.leadCode} từ cộng tác viên ${partner.name} (${partner.code})`
          : `Tạo lead ${lead.leadCode} từ ${source.name}`,
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
      address: company.address,
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
    if (!this.seesAll(actor)) throw new ForbiddenException('Chỉ trưởng phòng hoặc SuperAdmin chuyển người phụ trách');
    const users = await this.prisma.user.findMany({
      where: { isDeleted: false, status: 'active', role: { in: [UserRole.Sales, UserRole.SalesManager, UserRole.SuperAdmin] } },
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
    const phone = this.readPhone(input.contactPhone);
    const taxCode = this.readTax(input.taxCode);
    const source = await this.readLeadSource(input.source, current.source);
    const profile = readLeadProfile(input);
    if (!companyName || companyName.length < 2 || !contactName || contactName.length < 2 || !taxCode) {
      throw new BadRequestException('Cần mã số thuế, tên công ty và người liên hệ');
    }
    const partner = source.code === 'partner' ? await this.requirePartner(input.partnerId) : null;
    await this.assertNoDuplicate(taxCode, phone, current.id, current.companyId);
    let ownerUserId = current.ownerUserId;
    let ownerNameForLog: string | null = null;
    if (input.ownerUserId && input.ownerUserId !== current.ownerUserId) {
      if (!this.seesAll(actor)) throw new ForbiddenException('Chỉ trưởng phòng hoặc SuperAdmin chuyển người phụ trách');
      const nextOwner = await this.prisma.user.findFirst({
        where: {
          id: input.ownerUserId,
          isDeleted: false,
          status: 'active',
          role: { in: [UserRole.Sales, UserRole.SalesManager, UserRole.SuperAdmin] },
        },
        select: { id: true, displayName: true },
      });
      if (!nextOwner) throw new BadRequestException('Chọn sale hoặc SuperAdmin đang hoạt động');
      ownerUserId = nextOwner.id;
      ownerNameForLog = nextOwner.displayName;
    }
    const followUp = parseFollowUp(input.nextFollowUpAt);
    const campaignId = input.campaignId === undefined ? undefined : await this.marketing.campaignIdFor(actor, input.campaignId);
    const lead = await this.prisma.crmLead.update({
      where: { id: current.id },
      data: {
        companyName,
        taxCode,
        contactName,
        contactPhone: phone,
        ...profile,
        source: source.code,
        partnerId: partner?.id ?? null,
        ownerUserId,
        ...(followUp !== undefined ? { nextFollowUpAt: followUp } : {}),
        ...(campaignId !== undefined ? { campaignId } : {}),
      },
      include: {
        partner: { select: { id: true, name: true, code: true } },
        campaign: { select: { name: true, campaignCode: true } },
      },
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
    const requested = input.stageCode?.trim();
    const stage = requested ? pipeline.stages.find((item) => item.code === requested) : first;
    if (!stage) throw new BadRequestException('Bước phễu không hợp lệ');
    const lostReason = input.lostReason?.trim() ?? '';
    if (stage.code === 'lost' && lostReason.length < 2) {
      throw new BadRequestException('Nhập lý do mất, ít nhất 2 ký tự');
    }

    const plan = await this.snapshotPlan(input.planKind ?? null, input.planCode ?? null);
    const deal = await this.prisma.crmDeal.create({
      data: {
        dealCode: await this.nextCode('DL'),
        title,
        leadId: lead.id,
        companyId: lead.companyId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        planKind: plan?.kind ?? null,
        planCode: plan?.code ?? null,
        listPriceVnd: plan?.priceVnd ?? null,
        expectedCloseOn: expectedCloseDay(input.expectedCloseOn),
        wonAt: stage.code === 'won' ? new Date() : null,
        lostAt: stage.code === 'lost' ? new Date() : null,
        lostReason: stage.code === 'lost' ? lostReason : null,
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
          ? `Tạo deal ${deal.dealCode} ở bước ${stage.name}, gói ${plan.kind === 'sourcing' ? 'Săn' : 'tin'} ${plan.code}. CRM không bật gói.`
          : `Tạo deal ${deal.dealCode} ở bước ${stage.name}. Chưa chọn gói.`,
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

  /** Doanh số một tháng: lead mới và đơn gói đã trả, tách gói tin với gói Săn. */
  async funnelReport(actor: AuthenticatedUser, rawMonth: string): Promise<CrmFunnelReport> {
    const periodMonth = rawMonth.trim() || vietnamPeriodMonth(new Date());
    const bounds = vietnamMonthBounds(periodMonth);
    if (!bounds) throw new BadRequestException('Chọn tháng dạng YYYY-MM');
    const paidAt = { gte: bounds.start, lt: bounds.end };
    const leads = await this.prisma.crmLead.findMany({
      where: { status: { not: 'unqualified' }, ...this.ownScope(actor) },
      select: { companyId: true, source: true, partnerId: true, ownerUserId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const companyIds = [...new Set(leads.flatMap((lead) => (lead.companyId ? [lead.companyId] : [])))];
    const orders = companyIds.length === 0 && !this.seesAll(actor)
      ? []
      : await this.prisma.billingOrder.findMany({
          where: {
            ...this.paidPlanOrderWhere(),
            paidAt,
            ...(this.seesAll(actor) ? {} : { companyId: { in: companyIds } }),
          },
          select: { companyId: true, kind: true, priceVndSnapshot: true },
        });
    const firstLead = new Map<string, (typeof leads)[number]>();
    for (const lead of leads) {
      if (lead.companyId && !firstLead.has(lead.companyId)) firstLead.set(lead.companyId, lead);
    }
    const owners = new Map<string, FunnelTally>();
    const sources = new Map<string, FunnelTally>();
    const partners = new Map<string, FunnelTally>();
    for (const lead of leads) {
      if (lead.createdAt < bounds.start || lead.createdAt >= bounds.end) continue;
      tally(owners, lead.ownerUserId).leads += 1;
      tally(sources, lead.source).leads += 1;
      if (lead.partnerId) tally(partners, lead.partnerId).leads += 1;
    }
    for (const order of orders) {
      const kind = order.kind === 'sourcing' ? 'sourcing' : 'platform';
      const lead = firstLead.get(order.companyId);
      if (!lead) {
        if (!this.seesAll(actor)) continue;
        addPaid(tally(owners, 'unassigned'), kind, order.priceVndSnapshot);
        addPaid(tally(sources, 'none'), kind, order.priceVndSnapshot);
        continue;
      }
      addPaid(tally(owners, lead.ownerUserId), kind, order.priceVndSnapshot);
      addPaid(tally(sources, lead.source), kind, order.priceVndSnapshot);
    }
    if (this.seesAll(actor) || companyIds.length > 0) {
      const entries = await this.prisma.crmCommissionEntry.findMany({
        where: {
          paidAt,
          ...(this.seesAll(actor) ? {} : { companyId: { in: companyIds } }),
        },
        select: { partnerId: true, orderKind: true, paidAmountVnd: true },
      });
      for (const entry of entries) {
        const kind = entry.orderKind === 'sourcing' ? 'sourcing' : 'platform';
        addPaid(tally(partners, entry.partnerId), kind, entry.paidAmountVnd);
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
    const sourceNames = await this.sourceNames();
    return {
      periodMonth,
      byOwner: funnelBuckets(owners, (key) => (key === 'unassigned' ? 'Chưa có người phụ trách' : ownerNames.get(key) ?? 'Người phụ trách')),
      bySource: funnelBuckets(sources, (key) => sourceText(sourceNames, key)),
      byPartner: funnelBuckets(partners, (key) => partnerName.get(key) ?? 'Cộng tác viên'),
    };
  }

  /** Phễu hiện tại và cơ hội có ngày kỳ vọng trong tháng. Giá niêm yết, không phải doanh số. */
  async pipelineReport(actor: AuthenticatedUser, rawMonth: string): Promise<CrmPipelineReport> {
    const { periodMonth, start, end } = this.reportBounds(rawMonth);
    const [stageRows, deals] = await Promise.all([
      this.prisma.crmStage.findMany({ orderBy: { sortOrder: 'asc' }, select: { code: true, name: true, sortOrder: true } }),
      this.prisma.crmDeal.findMany({
        where: this.ownScope(actor),
        select: { listPriceVnd: true, expectedCloseOn: true, stage: { select: { code: true, name: true, sortOrder: true } } },
      }),
    ]);
    const stages = new Map<string, { label: string; sort: number; deals: number; price: bigint }>();
    for (const stage of stageRows) {
      if (!stages.has(stage.code)) stages.set(stage.code, { label: stageLabel(stage.code, stage.name), sort: stage.sortOrder, deals: 0, price: 0n });
    }
    const expected = new Map<string, { label: string; sort: number; deals: number; price: bigint }>();
    for (const deal of deals) {
      const code = deal.stage.code;
      const row = stages.get(code) ?? { label: stageLabel(code, deal.stage.name), sort: deal.stage.sortOrder, deals: 0, price: 0n };
      row.deals += 1;
      row.price += deal.listPriceVnd ?? 0n;
      stages.set(code, row);
      if (!deal.expectedCloseOn || deal.expectedCloseOn < start || deal.expectedCloseOn >= end) continue;
      const slot = expected.get(code) ?? { label: row.label, sort: row.sort, deals: 0, price: 0n };
      slot.deals += 1;
      slot.price += deal.listPriceVnd ?? 0n;
      expected.set(code, slot);
    }
    return { periodMonth, stages: stageMoneyRows(stages), expected: stageMoneyRows(expected) };
  }

  /** Lead tạo trong tháng, theo nguồn và người phụ trách, kèm công ty đã trả gói sau đó. */
  async leadSourceReport(actor: AuthenticatedUser, rawMonth: string): Promise<CrmLeadSourceReport> {
    const { periodMonth, start, end } = this.reportBounds(rawMonth);
    const leads = await this.prisma.crmLead.findMany({
      where: { status: { not: 'unqualified' }, createdAt: { gte: start, lt: end }, ...this.ownScope(actor) },
      select: { companyId: true, source: true, ownerUserId: true, createdAt: true },
    });
    const companyIds = [...new Set(leads.flatMap((lead) => (lead.companyId ? [lead.companyId] : [])))];
    const orders = companyIds.length === 0
      ? []
      : await this.prisma.billingOrder.findMany({
          where: { ...this.paidPlanOrderWhere(), companyId: { in: companyIds } },
          select: { companyId: true, paidAt: true },
        });
    const paidAt = new Map<string, Date>();
    for (const order of orders) {
      if (!order.paidAt) continue;
      const current = paidAt.get(order.companyId);
      if (!current || order.paidAt < current) paidAt.set(order.companyId, order.paidAt);
    }
    const sources = new Map<string, LeadSourceTally>();
    const owners = new Map<string, LeadSourceTally>();
    for (const lead of leads) {
      const paid = Boolean(lead.companyId && paidAt.get(lead.companyId) && paidAt.get(lead.companyId)! >= lead.createdAt);
      addLeadSource(sources, lead.source, lead.companyId, paid);
      addLeadSource(owners, lead.ownerUserId, lead.companyId, paid);
    }
    const names = await this.ownerNames([...owners.keys()]);
    const sourceNames = await this.sourceNames();
    return {
      periodMonth,
      bySource: leadSourceRows(sources, (key) => sourceText(sourceNames, key)),
      byOwner: leadSourceRows(owners, (key) => names.get(key) ?? 'Người phụ trách'),
    };
  }

  /** Báo giá lập trong tháng. Hai phương án không cộng lại. Đơn đã trả chỉ để đối chiếu. */
  async quoteReport(actor: AuthenticatedUser, rawMonth: string): Promise<CrmQuoteReport> {
    const { periodMonth, start, end } = this.reportBounds(rawMonth);
    const quotes = await this.prisma.crmQuote.findMany({
      where: { ...this.ownScope(actor), quotedOn: { gte: start, lt: end } },
      select: {
        id: true,
        kind: true,
        status: true,
        companyId: true,
        quotedOn: true,
        option1PriceVnd: true,
        option2PriceVnd: true,
        installments: { select: { status: true, amountVnd: true } },
      },
    });
    const collectedLines = await this.prisma.crmQuoteInstallment.findMany({
      where: { status: 'collected', collectedAt: { gte: start, lt: end }, quote: this.ownScope(actor) },
      select: { amountVnd: true },
    });
    const companyIds = [...new Set(quotes.flatMap((row) => (row.companyId ? [row.companyId] : [])))];
    const orders = companyIds.length === 0
      ? []
      : await this.prisma.billingOrder.findMany({
          where: { ...this.paidPlanOrderWhere(), companyId: { in: companyIds } },
          select: { companyId: true, paidAt: true },
        });
    const paid = new Map<string, Date[]>();
    for (const order of orders) {
      if (!order.paidAt) continue;
      paid.set(order.companyId, [...(paid.get(order.companyId) ?? []), order.paidAt]);
    }
    const catalog = quotes.filter((row) => row.kind !== 'enterprise');
    const enterpriseQuotes = quotes.filter((row) => row.kind === 'enterprise');
    const rows = (['draft', 'sent'] as const).map((status) => {
      const group = catalog.filter((row) => row.status === status);
      let option1 = 0n;
      let option2 = 0n;
      let option2Quotes = 0;
      let paidQuotes = 0;
      for (const quote of group) {
        option1 += quote.option1PriceVnd;
        if (quote.option2PriceVnd != null) {
          option2 += quote.option2PriceVnd;
          option2Quotes += 1;
        }
        const from = new Date(quote.quotedOn.getTime() - 7 * 60 * 60 * 1000);
        if (quote.companyId && (paid.get(quote.companyId) ?? []).some((at) => at >= from)) paidQuotes += 1;
      }
      return {
        status,
        label: status === 'sent' ? 'Đã gửi' : 'Bản thảo',
        quotes: group.length,
        option1Vnd: option1.toString(),
        option2Quotes,
        option2Vnd: option2.toString(),
        paidQuotes,
      };
    });
    const enterpriseReceivable = enterpriseQuotes.reduce(
      (sum, quote) => sum + quote.installments.filter((line) => line.status === 'open').reduce((inner, line) => inner + line.amountVnd, 0n),
      0n,
    );
    return {
      periodMonth,
      rows,
      enterprise: {
        quotes: enterpriseQuotes.length,
        contractVnd: enterpriseQuotes.filter((quote) => quote.status === 'accepted').reduce((sum, quote) => sum + quote.option1PriceVnd, 0n).toString(),
        accepted: enterpriseQuotes.filter((quote) => quote.status === 'accepted').length,
        receivableVnd: enterpriseReceivable.toString(),
        collectedVnd: collectedLines.reduce((sum, line) => sum + line.amountVnd, 0n).toString(),
      },
    };
  }

  /** Gói hết hạn trong tháng, và gói đã có đơn trả mới sau một đơn trước đó. */
  async renewalReport(actor: AuthenticatedUser, rawMonth: string): Promise<CrmRenewalReport> {
    const { periodMonth, start, end } = this.reportBounds(rawMonth);
    const empty = { periodMonth, ending: 0, expired: 0, renewed: 0, rows: [] as CrmRenewalReportRow[] };
    const scoped = await this.invoiceCompanyIds(actor);
    if (scoped && scoped.length === 0) return empty;
    const companyWhere = scoped ? { companyId: { in: scoped } } : {};
    const [platformPlans, sourcingPlans, monthOrders] = await Promise.all([
      this.prisma.billingCompanyPlan.findMany({
        where: { ...companyWhere, endsAt: { gte: start, lt: end } },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.billingCompanySourcingPlan.findMany({
        where: { ...companyWhere, endsAt: { gte: start, lt: end } },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.billingOrder.findMany({
        where: { ...this.paidPlanOrderWhere(), ...companyWhere, paidAt: { gte: start, lt: end } },
        select: { companyId: true, kind: true, planName: true, priceVndSnapshot: true, paidAt: true },
      }),
    ]);
    const touched = [...new Set([
      ...platformPlans.map((row) => row.companyId),
      ...sourcingPlans.map((row) => row.companyId),
      ...monthOrders.map((row) => row.companyId),
    ])];
    const companies = touched.length === 0
      ? []
      : await this.prisma.company.findMany({
          where: { id: { in: touched }, isDeleted: false },
          select: { id: true, name: true },
        });
    const names = new Map(companies.map((company) => [company.id, company.name]));
    const prior = touched.length === 0
      ? []
      : await this.prisma.billingOrder.findMany({
          where: { ...this.paidPlanOrderWhere(), companyId: { in: touched }, paidAt: { lt: start } },
          select: { companyId: true, kind: true },
        });
    const priorKey = new Set(prior.map((row) => `${row.companyId}:${row.kind}`));
    const now = new Date();
    const rows: CrmRenewalReportRow[] = [];
    const pushPlan = (
      kind: 'platform' | 'sourcing',
      plan: { companyId: string; endsAt: Date | null; plan: { name: string } },
    ) => {
      if (!plan.endsAt || !names.has(plan.companyId)) return;
      const paidRows = monthOrders.filter((order) => order.companyId === plan.companyId && order.kind === kind);
      const renewed = paidRows.length > 0 && priorKey.has(`${plan.companyId}:${kind}`);
      const status: CrmRenewalReportStatus = renewed ? 'renewed' : plan.endsAt < now ? 'expired' : 'ending';
      rows.push({
        companyId: plan.companyId,
        companyName: names.get(plan.companyId)!,
        kind,
        planName: plan.plan.name,
        endsAt: plan.endsAt.toISOString(),
        status,
        paidAmountVnd: paidRows.reduce((sum, order) => sum + order.priceVndSnapshot, 0n).toString(),
      });
    };
    for (const plan of platformPlans) pushPlan('platform', plan);
    for (const plan of sourcingPlans) pushPlan('sourcing', plan);
    const seen = new Set(rows.map((row) => `${row.companyId}:${row.kind}`));
    for (const order of monthOrders) {
      const kind = order.kind === 'sourcing' ? 'sourcing' : 'platform';
      const key = `${order.companyId}:${kind}`;
      if (seen.has(key) || !priorKey.has(key) || !names.has(order.companyId)) continue;
      seen.add(key);
      const paidRows = monthOrders.filter((item) => item.companyId === order.companyId && item.kind === kind);
      rows.push({
        companyId: order.companyId,
        companyName: names.get(order.companyId)!,
        kind,
        planName: order.planName ?? (kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'),
        endsAt: null,
        status: 'renewed',
        paidAmountVnd: paidRows.reduce((sum, item) => sum + item.priceVndSnapshot, 0n).toString(),
      });
    }
    rows.sort((a, b) => a.companyName.localeCompare(b.companyName, 'vi') || a.kind.localeCompare(b.kind));
    return {
      periodMonth,
      ending: rows.filter((row) => row.status === 'ending').length,
      expired: rows.filter((row) => row.status === 'expired').length,
      renewed: rows.filter((row) => row.status === 'renewed').length,
      rows,
    };
  }

  /** Đơn đã trả gắn mã giới thiệu. Không trả số hoa hồng. */
  async partnerPaidReport(actor: AuthenticatedUser, rawMonth: string): Promise<CrmPartnerPaidReport> {
    const { periodMonth, start, end } = this.reportBounds(rawMonth);
    const scoped = await this.invoiceCompanyIds(actor);
    if (scoped && scoped.length === 0) return { periodMonth, rows: [] };
    const entries = await this.prisma.crmCommissionEntry.findMany({
      where: { paidAt: { gte: start, lt: end }, ...(scoped ? { companyId: { in: scoped } } : {}) },
      select: { partnerId: true, companyId: true, orderKind: true, paidAmountVnd: true },
    });
    const buckets = new Map<string, { orders: number; companies: Set<string>; platform: bigint; sourcing: bigint }>();
    for (const entry of entries) {
      const row = buckets.get(entry.partnerId) ?? { orders: 0, companies: new Set<string>(), platform: 0n, sourcing: 0n };
      row.orders += 1;
      row.companies.add(entry.companyId);
      if (entry.orderKind === 'sourcing') row.sourcing += entry.paidAmountVnd;
      else row.platform += entry.paidAmountVnd;
      buckets.set(entry.partnerId, row);
    }
    const partners = buckets.size === 0
      ? []
      : await this.prisma.crmPartner.findMany({
          where: { id: { in: [...buckets.keys()] } },
          select: { id: true, name: true, code: true },
        });
    const label = new Map(partners.map((row) => [row.id, `${row.name} · ${row.code}`]));
    const rows = [...buckets.entries()].map(([partnerId, row]) => ({
      partnerId,
      label: label.get(partnerId) ?? 'Cộng tác viên',
      orders: row.orders,
      companies: row.companies.size,
      platformPaidVnd: row.platform.toString(),
      sourcingPaidVnd: row.sourcing.toString(),
      paidAmountVnd: (row.platform + row.sourcing).toString(),
    })).sort((a, b) => {
      const amount = BigInt(b.paidAmountVnd) - BigInt(a.paidAmountVnd);
      if (amount > 0n) return 1;
      if (amount < 0n) return -1;
      return b.orders - a.orders;
    });
    return { periodMonth, rows };
  }

  /** Số trên bàn làm việc. Doanh số gói là đơn đã trả. Công nợ là đợt Enterprise đã chốt và chưa thu. */
  async workspaceReport(actor: AuthenticatedUser, rawMonth: string): Promise<CrmWorkspaceReport> {
    const { periodMonth, start, end } = this.reportBounds(rawMonth);
    const year = periodMonth.slice(0, 4);
    const yearStart = vietnamMonthBounds(`${year}-01`)!.start;
    const yearEnd = vietnamMonthBounds(`${year}-12`)!.end;
    const scoped = await this.invoiceCompanyIds(actor);
    const companyWhere = scoped ? { companyId: { in: scoped } } : {};
    const noCompanies = Boolean(scoped && scoped.length === 0);
    const [yearOrders, monthLeads, monthQuotes, monthDeals, openDeals, collectedInstallments, openInstallments] = await Promise.all([
      noCompanies
        ? []
        : this.prisma.billingOrder.findMany({
            where: { ...this.paidPlanOrderWhere(), ...companyWhere, paidAt: { gte: yearStart, lt: yearEnd } },
            select: { companyId: true, kind: true, planCode: true, planName: true, priceVndSnapshot: true, paidAt: true },
          }),
      this.prisma.crmLead.findMany({
        where: { status: { not: 'unqualified' }, createdAt: { gte: start, lt: end }, ...this.ownScope(actor) },
        select: { ownerUserId: true },
      }),
      this.prisma.crmQuote.findMany({
        where: { quotedOn: { gte: start, lt: end }, ...this.ownScope(actor) },
        select: { ownerUserId: true },
      }),
      this.prisma.crmDeal.findMany({
        where: { createdAt: { gte: start, lt: end }, ...this.ownScope(actor) },
        select: { ownerUserId: true },
      }),
      this.prisma.crmDeal.findMany({
        where: { ...this.ownScope(actor), stage: { code: { notIn: ['won', 'lost'] } } },
        select: { listPriceVnd: true },
      }),
      this.prisma.crmQuoteInstallment.findMany({
        where: { status: 'collected', collectedAt: { gte: yearStart, lt: yearEnd }, quote: this.ownScope(actor) },
        select: { amountVnd: true, collectedAt: true, quote: { select: { ownerUserId: true, companyId: true } } },
      }),
      this.prisma.crmQuoteInstallment.findMany({
        where: { status: 'open', quote: this.ownScope(actor) },
        select: { amountVnd: true, dueOn: true },
      }),
    ]);
    const monthOrders = yearOrders.filter((order) => order.paidAt && order.paidAt >= start && order.paidAt < end);
    const monthCollected = collectedInstallments.filter((line) => line.collectedAt && line.collectedAt >= start && line.collectedAt < end);
    const companyIds = [...new Set([
      ...monthOrders.map((order) => order.companyId),
      ...monthCollected.flatMap((line) => (line.quote.companyId ? [line.quote.companyId] : [])),
    ])];
    const leadRows = companyIds.length === 0
      ? []
      : await this.prisma.crmLead.findMany({
          where: { companyId: { in: companyIds }, status: { not: 'unqualified' }, ...(this.seesAll(actor) ? {} : { ownerUserId: actor.id }) },
          select: { companyId: true, source: true, ownerUserId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
    const firstLead = new Map<string, (typeof leadRows)[number]>();
    for (const lead of leadRows) {
      if (lead.companyId && !firstLead.has(lead.companyId)) firstLead.set(lead.companyId, lead);
    }
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`;
      const bounds = vietnamMonthBounds(month)!;
      const rows = yearOrders.filter((order) => order.paidAt && order.paidAt >= bounds.start && order.paidAt < bounds.end);
      const collected = collectedInstallments.filter((line) => line.collectedAt && line.collectedAt >= bounds.start && line.collectedAt < bounds.end);
      const paid = rows.reduce((sum, order) => sum + order.priceVndSnapshot, 0n)
        + collected.reduce((sum, line) => sum + line.amountVnd, 0n);
      return {
        month,
        label: `T${index + 1}`,
        orders: rows.length,
        paidAmountVnd: paid.toString(),
      };
    });
    let platform = 0n;
    let sourcing = 0n;
    const sources = new Map<string, { orders: number; amount: bigint }>();
    const plans = new Map<string, { label: string; orders: number; amount: bigint }>();
    const people = new Map<string, CrmWorkspacePerson>();
    const person = (key: string) => {
      const row = people.get(key) ?? { key, label: key, leads: 0, quotes: 0, deals: 0, orders: 0, paidAmountVnd: '0', enterpriseCollectedVnd: '0' };
      people.set(key, row);
      return row;
    };
    for (const order of monthOrders) {
      const kind = order.kind === 'sourcing' ? 'sourcing' : 'platform';
      if (kind === 'sourcing') sourcing += order.priceVndSnapshot;
      else platform += order.priceVndSnapshot;
      const lead = firstLead.get(order.companyId);
      const sourceKey = lead?.source ?? 'none';
      const source = sources.get(sourceKey) ?? { orders: 0, amount: 0n };
      source.orders += 1;
      source.amount += order.priceVndSnapshot;
      sources.set(sourceKey, source);
      const planKey = `${kind}:${order.planCode ?? order.planName ?? 'goi'}`;
      const plan = plans.get(planKey) ?? { label: order.planName ?? (kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'), orders: 0, amount: 0n };
      plan.orders += 1;
      plan.amount += order.priceVndSnapshot;
      plans.set(planKey, plan);
      const ownerKey = lead?.ownerUserId ?? 'unassigned';
      const owner = person(ownerKey);
      owner.orders += 1;
      owner.paidAmountVnd = (BigInt(owner.paidAmountVnd) + order.priceVndSnapshot).toString();
    }
    for (const line of monthCollected) {
      const owner = person(line.quote.ownerUserId);
      owner.enterpriseCollectedVnd = (BigInt(owner.enterpriseCollectedVnd) + line.amountVnd).toString();
      const sourceKey = (line.quote.companyId && firstLead.get(line.quote.companyId)?.source) || 'none';
      const source = sources.get(sourceKey) ?? { orders: 0, amount: 0n };
      source.amount += line.amountVnd;
      sources.set(sourceKey, source);
    }
    for (const lead of monthLeads) person(lead.ownerUserId).leads += 1;
    for (const quote of monthQuotes) person(quote.ownerUserId).quotes += 1;
    for (const deal of monthDeals) person(deal.ownerUserId).deals += 1;
    const staffSeed = new Map<string, { orders: number; online: bigint; enterprise: bigint }>();
    const staffRow = (key: string) => {
      const row = staffSeed.get(key) ?? { orders: 0, online: 0n, enterprise: 0n };
      staffSeed.set(key, row);
      return row;
    };
    for (const row of people.values()) {
      const online = BigInt(row.paidAmountVnd);
      const enterprise = BigInt(row.enterpriseCollectedVnd);
      if (online + enterprise <= 0n) continue;
      const item = staffRow(row.key);
      item.orders = row.orders;
      item.online = online;
      item.enterprise = enterprise;
    }
    const names = await this.ownerNames([...new Set([...people.keys(), ...staffSeed.keys()])].filter((id) => id !== 'unassigned'));
    const receivable = openInstallments.reduce((sum, row) => sum + row.amountVnd, 0n);
    const receivableDue = openInstallments
      .filter((row) => row.dueOn >= start && row.dueOn < end)
      .reduce((sum, row) => sum + row.amountVnd, 0n);
    const enterpriseCollected = monthCollected.reduce((sum, row) => sum + row.amountVnd, 0n);
    const channels = await this.prisma.crmMarketingChannel.findMany({
      select: { code: true, name: true, isActive: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
    const sourceNames = new Map(channels.map((row) => [row.code, row.name]));
    for (const channel of channels) {
      if (channel.isActive && !sources.has(channel.code)) sources.set(channel.code, { orders: 0, amount: 0n });
    }
    const activeCodes = new Set(channels.filter((row) => row.isActive).map((row) => row.code));
    const sourceRank = new Map(channels.map((row) => [row.code, row.sortOrder]));
    return {
      periodMonth,
      orders: monthOrders.length,
      paidAmountVnd: (platform + sourcing).toString(),
      platformPaidVnd: platform.toString(),
      sourcingPaidVnd: sourcing.toString(),
      newLeads: monthLeads.length,
      quotes: monthQuotes.length,
      openDeals: openDeals.length,
      openListPriceVnd: openDeals.reduce((sum, deal) => sum + (deal.listPriceVnd ?? 0n), 0n).toString(),
      months,
      bySource: [...sources.entries()]
        .map(([key, row]) => ({ key, label: sourceText(sourceNames, key), orders: row.orders, paidAmountVnd: row.amount.toString() }))
        .filter((row) => row.orders > 0 || activeCodes.has(row.key))
        .sort((a, b) => (sourceRank.get(a.key) ?? 1000) - (sourceRank.get(b.key) ?? 1000)),
      plans: [...plans.entries()]
        .map(([key, row]) => ({ key, label: row.label, orders: row.orders, paidAmountVnd: row.amount.toString() }))
        .sort((a, b) => (BigInt(b.paidAmountVnd) > BigInt(a.paidAmountVnd) ? 1 : -1))
        .slice(0, 5),
      people: [...people.values()]
        .map((row) => ({ ...row, label: row.key === 'unassigned' ? 'Chưa có người phụ trách' : names.get(row.key) ?? 'Người phụ trách' }))
        .sort((a, b) => {
          const amount = (BigInt(b.paidAmountVnd) + BigInt(b.enterpriseCollectedVnd)) - (BigInt(a.paidAmountVnd) + BigInt(a.enterpriseCollectedVnd));
          if (amount > 0n) return 1;
          if (amount < 0n) return -1;
          return b.leads - a.leads;
        }),
      enterpriseCollectedVnd: enterpriseCollected.toString(),
      receivableVnd: receivable.toString(),
      receivableDueVnd: receivableDue.toString(),
      staff: [...staffSeed.entries()]
        .map(([key, row]) => ({
          key,
          label: key === 'unassigned' ? 'Chưa có người phụ trách' : names.get(key) ?? 'Người phụ trách',
          orders: row.orders,
          enterpriseCollectedVnd: row.enterprise.toString(),
          paidAmountVnd: (row.online + row.enterprise).toString(),
        }))
        .sort((a, b) => {
          const amount = BigInt(b.paidAmountVnd) - BigInt(a.paidAmountVnd);
          if (amount > 0n) return 1;
          if (amount < 0n) return -1;
          return b.orders - a.orders;
        }),
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

  async deleteLead(actor: AuthenticatedUser, leadId: string): Promise<void> {
    const lead = await this.prisma.crmLead.findUnique({ where: { id: leadId }, select: { id: true, ownerUserId: true } });
    if (!lead) throw new NotFoundException('Không thấy tiềm năng');
    this.assertOwner(actor, lead.ownerUserId);
    const deals = await this.prisma.crmDeal.findMany({ where: { leadId }, select: { id: true } });
    const dealIds = deals.map((deal) => deal.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.crmActivity.deleteMany({
        where: dealIds.length > 0 ? { OR: [{ leadId }, { dealId: { in: dealIds } }] } : { leadId },
      });
      if (dealIds.length > 0) {
        await tx.crmQuote.updateMany({ where: { dealId: { in: dealIds } }, data: { dealId: null } });
        await tx.crmDeal.deleteMany({ where: { leadId } });
      }
      await tx.crmQuote.updateMany({ where: { leadId }, data: { leadId: null } });
      await tx.crmLead.delete({ where: { id: leadId } });
    });
  }

  async deleteDeal(actor: AuthenticatedUser, dealId: string): Promise<void> {
    const deal = await this.prisma.crmDeal.findUnique({ where: { id: dealId }, select: { id: true, ownerUserId: true } });
    if (!deal) throw new NotFoundException('Không thấy cơ hội');
    this.assertOwner(actor, deal.ownerUserId);
    await this.prisma.$transaction(async (tx) => {
      await tx.crmActivity.deleteMany({ where: { dealId } });
      await tx.crmQuote.updateMany({ where: { dealId }, data: { dealId: null } });
      await tx.crmDeal.delete({ where: { id: dealId } });
    });
  }

  async deleteQuote(actor: AuthenticatedUser, quoteId: string): Promise<void> {
    const quote = await this.prisma.crmQuote.findUnique({
      where: { id: quoteId },
      select: { id: true, ownerUserId: true, installments: { select: { status: true } } },
    });
    if (!quote) throw new NotFoundException('Không thấy báo giá');
    this.assertOwner(actor, quote.ownerUserId);
    if (quote.installments.some((line) => line.status === 'collected')) {
      throw new BadRequestException('Tờ đã ghi thu, không xóa');
    }
    await this.prisma.crmQuote.delete({ where: { id: quote.id } });
  }

  private async readLeadSource(raw: string | null | undefined, current?: string | null): Promise<{ code: string; name: string }> {
    const value = (raw ?? '').trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value === 'unknown') {
      throw new BadRequestException('Chọn nguồn khách đang bật');
    }
    const channel = await this.prisma.crmMarketingChannel.findUnique({
      where: { code: value },
      select: { code: true, name: true, isActive: true },
    });
    if (!channel) throw new BadRequestException('Chọn nguồn khách đang bật');
    if (!channel.isActive && value !== (current ?? '').trim().toLowerCase()) {
      throw new BadRequestException('Nguồn này đang tắt');
    }
    return channel;
  }

  private async sourceNames(): Promise<Map<string, string>> {
    const rows = await this.prisma.crmMarketingChannel.findMany({ select: { code: true, name: true } });
    return new Map(rows.map((row) => [row.code, row.name]));
  }

  /** SuperAdmin và trưởng phòng thấy CRM của cả đội. Nhân viên chỉ thấy hồ sơ mình. */
  private seesAll(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.SuperAdmin || actor.role === UserRole.SalesManager;
  }

  private reportBounds(rawMonth: string): { periodMonth: string; start: Date; end: Date } {
    const periodMonth = rawMonth.trim() || vietnamPeriodMonth(new Date());
    const bounds = vietnamMonthBounds(periodMonth);
    if (!bounds) throw new BadRequestException('Chọn tháng dạng YYYY-MM');
    return { periodMonth, start: bounds.start, end: bounds.end };
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
      return { kind, code: plan.code, name: plan.name, priceVnd: plan.priceVnd };
    }
    const plan = await this.prisma.billingSourcingPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy gói Săn');
    return { kind, code: plan.code, name: plan.name, priceVnd: plan.feeVnd };
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

  private async customerIdsByContact(rawQuery: string, scopedIds: string[] | null): Promise<string[]> {
    const q = rawQuery.trim();
    if (q.length < 2) return [];
    const digits = q.replace(/\D/g, '');
    const hits = await this.prisma.crmLead.findMany({
      where: {
        status: { not: 'unqualified' },
        companyId: scopedIds ? { in: scopedIds } : { not: null },
        OR: [
          { contactName: { contains: q, mode: 'insensitive' } },
          { contactEmail: { contains: q, mode: 'insensitive' } },
          { department: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ contactPhone: { contains: digits } }] : []),
        ],
      },
      select: { companyId: true },
      take: 200,
    });
    return [...new Set(hits.flatMap((row) => (row.companyId ? [row.companyId] : [])))];
  }

  private mapQuoteForm(
    row: {
      legalName: string | null;
      taxCode: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      bankName: string | null;
      bankAccount: string | null;
      bankHolder: string | null;
      transferNote: string | null;
      terms: string | null;
      signerTitle: string | null;
      logoStorageKey: string | null;
    } | null,
    canEdit: boolean,
  ): CrmQuoteFormView {
    return {
      legalName: row?.legalName ?? null,
      taxCode: row?.taxCode ?? null,
      address: row?.address ?? null,
      phone: row?.phone ?? null,
      email: row?.email ?? null,
      website: row?.website ?? null,
      bankName: row?.bankName ?? null,
      bankAccount: row?.bankAccount ?? null,
      bankHolder: row?.bankHolder ?? null,
      transferNote: row?.transferNote ?? null,
      terms: row?.terms ?? null,
      signerTitle: row?.signerTitle ?? null,
      hasLogo: Boolean(row?.logoStorageKey),
      canEdit,
    };
  }

  private async staffOptions(): Promise<Array<{ id: string; name: string; code: string }>> {
    const rows = await this.prisma.user.findMany({
      where: { isDeleted: false, role: { in: [UserRole.Sales, UserRole.SalesManager] } },
      select: { id: true, displayName: true, code: true },
      orderBy: { displayName: 'asc' },
    });
    return rows.map((row) => ({ id: row.id, name: row.displayName, code: row.code }));
  }

  private async staffUser(actor: AuthenticatedUser, userId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new NotFoundException('Không thấy nhân sự');
    if (userId !== actor.id && actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ sửa hồ sơ của chính mình');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isDeleted: false, role: { in: [UserRole.Sales, UserRole.SalesManager] } },
      select: { id: true, code: true, displayName: true, email: true, isVerified: true, department: true },
    });
    if (!user) throw new NotFoundException('Không thấy nhân sự');
    if (actor.role !== UserRole.SuperAdmin && actor.id !== user.id) {
      throw new ForbiddenException('Chỉ sửa hồ sơ của chính mình');
    }
    if (actor.role !== UserRole.SuperAdmin && actor.role !== UserRole.Sales && actor.role !== UserRole.SalesManager) {
      throw new ForbiddenException('Hồ sơ này dành cho nhân sự inlink');
    }
    return user;
  }

  private mapStaffProfile(
    user: { id: string; code: string; displayName: string; email: string; isVerified: boolean; department: string | null },
    row: { birthDate: Date | null; gender: string | null; phone: string | null; address: string | null; province: string | null; postalCode: string | null; avatarStorageKey: string | null } | null,
    actor: AuthenticatedUser,
  ): CrmStaffProfileView {
    const gender = row?.gender === 'male' || row?.gender === 'female' || row?.gender === 'other' ? row.gender : null;
    return {
      userId: user.id,
      code: user.code,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.isVerified,
      department: user.department,
      birthDate: row?.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
      gender,
      phone: row?.phone ?? null,
      address: row?.address ?? null,
      province: row?.province ?? null,
      postalCode: row?.postalCode ?? null,
      hasAvatar: Boolean(row?.avatarStorageKey),
      canEdit: actor.role === UserRole.SuperAdmin || actor.id === user.id,
    };
  }

  private readBirth(raw: string | null | undefined): Date | null {
    const day = calendarDay(raw, 'Ngày sinh');
    if (!day) return null;
    const today = new Date();
    const todayDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (day > todayDay) throw new BadRequestException('Ngày sinh không được ở tương lai');
    if (day.getUTCFullYear() < 1940) throw new BadRequestException('Ngày sinh chưa đúng');
    return day;
  }

  private optionalContactPhone(raw: string | null | undefined): string | null {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) return null;
    return this.readPhone(trimmed);
  }

  private optionalContactEmail(raw: string | null | undefined): string | null {
    const email = raw?.trim().toLowerCase() ?? '';
    if (!email) return null;
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email chưa đúng');
    }
    return email;
  }

  private readPhone(raw: string | null | undefined): string {
    const phone = normalizePhone(raw ?? '');
    if (!phone) return '';
    if (phone.length < 9 || phone.length > 15) throw new BadRequestException('Số điện thoại gồm 9 đến 15 số');
    return phone;
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

  /** Tiền khách đã trả trong tháng, cùng phạm vi với báo cáo cộng tác viên. Không phải hoa hồng. */
  private async partnerMonthPaid(
    actor: AuthenticatedUser,
    partnerIds: string[],
    start: Date,
    end: Date,
  ): Promise<Map<string, { platform: bigint; sourcing: bigint; orders: number; companies: number }>> {
    const totals = new Map<string, { platform: bigint; sourcing: bigint; orders: number; companies: number }>();
    if (partnerIds.length === 0) return totals;
    const scoped = await this.invoiceCompanyIds(actor);
    if (scoped && scoped.length === 0) return totals;
    const entries = await this.prisma.crmCommissionEntry.findMany({
      where: {
        partnerId: { in: partnerIds },
        paidAt: { gte: start, lt: end },
        ...(scoped ? { companyId: { in: scoped } } : {}),
      },
      select: { partnerId: true, companyId: true, orderKind: true, paidAmountVnd: true },
    });
    const companies = new Map<string, Set<string>>();
    for (const entry of entries) {
      const row = totals.get(entry.partnerId) ?? { platform: 0n, sourcing: 0n, orders: 0, companies: 0 };
      row.orders += 1;
      if (entry.orderKind === 'sourcing') row.sourcing += entry.paidAmountVnd;
      else row.platform += entry.paidAmountVnd;
      const set = companies.get(entry.partnerId) ?? new Set<string>();
      set.add(entry.companyId);
      companies.set(entry.partnerId, set);
      row.companies = set.size;
      totals.set(entry.partnerId, row);
    }
    return totals;
  }

  private async partnerLeadCounts(actor: AuthenticatedUser, partnerIds: string[]): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    if (partnerIds.length === 0) return totals;
    const rows = await this.prisma.crmLead.groupBy({
      by: ['partnerId'],
      where: {
        partnerId: { in: partnerIds },
        status: { not: 'unqualified' },
        ...this.ownScope(actor),
      },
      _count: { _all: true },
    });
    for (const row of rows) {
      if (row.partnerId) totals.set(row.partnerId, row._count._all);
    }
    return totals;
  }

  private async partnerPaidOrders(
    actor: AuthenticatedUser,
    partnerId: string,
    start: Date,
    end: Date,
  ): Promise<CrmPartnerPaidOrderView[]> {
    const scoped = await this.invoiceCompanyIds(actor);
    if (scoped && scoped.length === 0) return [];
    const entries = await this.prisma.crmCommissionEntry.findMany({
      where: {
        partnerId,
        paidAt: { gte: start, lt: end },
        ...(scoped ? { companyId: { in: scoped } } : {}),
      },
      orderBy: { paidAt: 'desc' },
      select: {
        id: true,
        companyId: true,
        companyName: true,
        orderKind: true,
        planName: true,
        paidAmountVnd: true,
        paidAt: true,
      },
    });
    return entries.map((entry) => ({
      id: entry.id,
      companyId: entry.companyId,
      companyName: entry.companyName,
      orderKind: entry.orderKind === 'sourcing' ? 'sourcing' : 'platform',
      planName: entry.planName ?? (entry.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'),
      paidAmountVnd: entry.paidAmountVnd.toString(),
      paidAt: entry.paidAt.toISOString(),
    }));
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
  }, pending?: { count: number; amount: bigint }, signups: CrmReferralSignupView[] = [], walletBalanceVnd = 0n, paid?: { platform: bigint; sourcing: bigint; orders: number; companies: number }, leadCount = 0): CrmPartnerView {
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
      leadCount,
      monthPaidVnd: ((paid?.platform ?? 0n) + (paid?.sourcing ?? 0n)).toString(),
      monthPlatformPaidVnd: (paid?.platform ?? 0n).toString(),
      monthSourcingPaidVnd: (paid?.sourcing ?? 0n).toString(),
      monthOrderCount: paid?.orders ?? 0,
      monthCompanyCount: paid?.companies ?? 0,
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
    if (actor.role === UserRole.SuperAdmin || actor.role === UserRole.SalesManager) return;
    if (actor.role === UserRole.Sales && partner.createdByUserId === actor.id) return;
    if (partner.userId === actor.id) return;
    throw new ForbiddenException('Không khóa mã số thuế cho cộng tác viên này');
  }

  private async insertClaim(partnerId: string, input: CreateCrmPartnerClaimRequest): Promise<CrmPartnerClaimView> {
    const companyName = clip(input.companyName, 160);
    const taxCode = claimTax(input.taxCode);
    const phone = normalizePhone(input.contactPhone ?? '');
    if (companyName.length < 2 || !taxCode || phone.length < 9 || phone.length > 15) {
      throw new BadRequestException('Cần tên công ty, mã số thuế 10 hoặc 13 số và số điện thoại');
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
      (creator.role === UserRole.Sales || creator.role === UserRole.SalesManager || creator.role === UserRole.SuperAdmin)
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

  private async nextCode(prefix: 'LD' | 'DL' | 'BG'): Promise<string> {
    const stamp = new Date().toISOString().slice(0, 7).replace('-', '');
    return `${prefix}-${stamp}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private readEnterpriseQuote(
    rawName: string | null | undefined,
    rawContract: string | null | undefined,
    rawLines: CrmQuoteInstallmentInput[] | null | undefined,
    quotedOn: Date,
  ) {
    const packageName = rawName?.trim() ?? '';
    if (packageName.length < 2 || packageName.length > 120) throw new BadRequestException('Cần tên gói Enterprise');
    const digits = (rawContract ?? '').replace(/\D/g, '');
    if (!digits || digits.length > 15) throw new BadRequestException('Cần giá trị hợp đồng');
    const contractVnd = BigInt(digits);
    if (contractVnd <= 0n) throw new BadRequestException('Giá trị hợp đồng phải lớn hơn 0');
    const lines = rawLines ?? [];
    if (lines.length < 2 || lines.length > 6) throw new BadRequestException('Hợp đồng cần từ 2 đến 6 đợt');
    let percent = 0;
    const parsed = lines.map((line, index) => {
      const label = line.label?.trim() ?? '';
      if (label.length < 2 || label.length > 80) throw new BadRequestException(`Đợt ${index + 1} cần tên`);
      if (!Number.isInteger(line.percent) || line.percent < 1 || line.percent > 99) {
        throw new BadRequestException(`Tỉ lệ đợt ${index + 1} là số nguyên từ 1 đến 99`);
      }
      percent += line.percent;
      const dueOn = calendarDay(line.dueOn, `Hạn đợt ${index + 1}`);
      if (!dueOn) throw new BadRequestException(`Cần hạn đợt ${index + 1}`);
      if (dueOn < quotedOn) throw new BadRequestException(`Hạn đợt ${index + 1} phải từ ngày báo giá trở đi`);
      return { label: label.slice(0, 80), percent: line.percent, dueOn };
    });
    if (percent !== 100) throw new BadRequestException('Các đợt phải cộng đủ 100%');
    const amounts = parsed.map((line) => (contractVnd * BigInt(line.percent)) / 100n);
    const allocated = amounts.reduce((sum, amount) => sum + amount, 0n);
    amounts[amounts.length - 1] += contractVnd - allocated;
    return {
      packageName: packageName.slice(0, 120),
      contractVnd,
      lines: parsed.map((line, index) => ({
        sortOrder: index + 1,
        label: line.label,
        percent: line.percent,
        amountVnd: amounts[index]!,
        dueOn: line.dueOn,
        status: 'scheduled',
      })),
    };
  }

  private async withQuoteDeals(
    rows: Parameters<CrmService['mapQuote']>[0][],
    names: Map<string, string>,
  ): Promise<CrmQuoteView[]> {
    const ids = [...new Set(rows.flatMap((row) => (row.dealId ? [row.dealId] : [])))];
    const deals = ids.length
      ? await this.prisma.crmDeal.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, dealCode: true } })
      : [];
    const byId = new Map(deals.map((deal) => [deal.id, deal]));
    return rows.map((row) => this.mapQuote(row, names, row.dealId ? byId.get(row.dealId) ?? null : null));
  }

  private mapQuote(
    row: {
      id: string;
      quoteCode: string;
      companyName: string;
      taxCode: string | null;
      contactName: string;
      contactPhone?: string | null;
      contactEmail?: string | null;
      companyId: string | null;
      ownerUserId: string;
      option1Kind: string;
      option1Code: string;
      option1Name: string;
      option1PriceVnd: bigint;
      option2Kind: string | null;
      option2Code: string | null;
      option2Name: string | null;
      option2PriceVnd: bigint | null;
      note: string | null;
      vatPercent: number | null;
      createdAt: Date;
      address?: string | null;
      quotedOn?: Date | null;
      validUntil?: Date | null;
      status?: string | null;
      dealId?: string | null;
      kind?: string | null;
      installments?: Array<{
        id: string;
        label: string;
        percent: number;
        amountVnd: bigint;
        dueOn: Date;
        status: string;
        collectedAt: Date | null;
      }>;
    },
    names: Map<string, string>,
    deal?: { title: string; dealCode: string } | null,
  ): CrmQuoteView {
    const kind = (value: string | null): CrmPlanKind | null =>
      value === 'sourcing' ? 'sourcing' : value === 'platform' ? 'platform' : null;
    const option1Kind = kind(row.option1Kind) ?? 'platform';
    const quoteKind = row.kind === 'enterprise' || row.option1Kind === 'enterprise' ? 'enterprise' : 'catalog';
    const installments = (row.installments ?? []).map((line) => {
      const status: 'scheduled' | 'open' | 'collected' = line.status === 'open' || line.status === 'collected' ? line.status : 'scheduled';
      return {
        id: line.id,
        label: line.label,
        percent: line.percent,
        amountVnd: line.amountVnd.toString(),
        dueOn: line.dueOn.toISOString().slice(0, 10),
        status,
        collectedAt: line.collectedAt ? line.collectedAt.toISOString() : null,
      };
    });
    const receivable = installments.filter((line) => line.status === 'open').reduce((sum, line) => sum + BigInt(line.amountVnd), 0n);
    const collected = installments.filter((line) => line.status === 'collected').reduce((sum, line) => sum + BigInt(line.amountVnd), 0n);
    return {
      id: row.id,
      quoteCode: row.quoteCode,
      companyName: row.companyName,
      taxCode: row.taxCode,
      contactName: row.contactName,
      contactPhone: row.contactPhone ?? null,
      contactEmail: row.contactEmail ?? null,
      address: row.address ?? null,
      quotedOn: row.quotedOn ? row.quotedOn.toISOString().slice(0, 10) : row.createdAt.toISOString().slice(0, 10),
      validUntil: row.validUntil ? row.validUntil.toISOString().slice(0, 10) : null,
      status: row.status === 'accepted' ? 'accepted' : row.status === 'sent' ? 'sent' : 'draft',
      companyId: row.companyId,
      dealId: row.dealId ?? null,
      dealTitle: deal?.title ?? null,
      dealCode: deal?.dealCode ?? null,
      ownerUserId: row.ownerUserId,
      ownerName: names.get(row.ownerUserId) ?? 'Người phụ trách',
      quoteKind,
      installments,
      receivableVnd: receivable.toString(),
      collectedVnd: collected.toString(),
      option1Kind,
      option1Code: row.option1Code,
      option1Name: row.option1Name,
      option1PriceVnd: row.option1PriceVnd.toString(),
      option2Kind: kind(row.option2Kind),
      option2Code: row.option2Code,
      option2Name: row.option2Name,
      option2PriceVnd: row.option2PriceVnd == null ? null : row.option2PriceVnd.toString(),
      note: row.note,
      vatPercent: row.vatPercent,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapLead(lead: {
    id: string;
    leadCode: string;
    companyName: string;
    taxCode: string | null;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
    zalo?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    industry: string | null;
    bankAccount?: string | null;
    bankName?: string | null;
    foundedOn?: Date | null;
    orgType?: string | null;
    orgField?: string | null;
    revenueBand?: string | null;
    country?: string | null;
    province?: string | null;
    ward?: string | null;
    street?: string | null;
    areaCode?: string | null;
    address: string | null;
    companyId: string | null;
    status: string;
    source: string;
    partnerId: string | null;
    partner: { name: string; code: string } | null;
    ownerUserId: string;
    nextFollowUpAt: Date | null;
    createdAt: Date;
    campaignId?: string | null;
    campaign?: { name: string; campaignCode: string } | null;
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
      zalo: lead.zalo ?? null,
      jobTitle: lead.jobTitle ?? null,
      department: lead.department ?? null,
      industry: lead.industry,
      bankAccount: lead.bankAccount ?? null,
      bankName: lead.bankName ?? null,
      foundedOn: lead.foundedOn ? lead.foundedOn.toISOString().slice(0, 10) : null,
      orgType: lead.orgType ?? null,
      orgField: lead.orgField ?? null,
      revenueBand: lead.revenueBand ?? null,
      country: lead.country ?? null,
      province: lead.province ?? null,
      ward: lead.ward ?? null,
      street: lead.street ?? null,
      areaCode: lead.areaCode ?? null,
      address: lead.address,
      companyId: lead.companyId,
      status,
      source: storedLeadSource(lead.source),
      partnerId: lead.partnerId,
      partnerName: lead.partner?.name ?? null,
      partnerCode: lead.partner?.code ?? null,
      campaignId: lead.campaignId ?? null,
      campaignName: lead.campaign?.name ?? null,
      campaignCode: lead.campaign?.campaignCode ?? null,
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
    expectedCloseOn?: Date | null;
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
      expectedCloseOn: deal.expectedCloseOn ? deal.expectedCloseOn.toISOString().slice(0, 10) : null,
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

type FunnelTally = {
  leads: number;
  paidOrders: number;
  paidAmountVnd: bigint;
  platformPaidVnd: bigint;
  sourcingPaidVnd: bigint;
};

function tally(map: Map<string, FunnelTally>, key: string): FunnelTally {
  const row = map.get(key) ?? {
    leads: 0,
    paidOrders: 0,
    paidAmountVnd: 0n,
    platformPaidVnd: 0n,
    sourcingPaidVnd: 0n,
  };
  map.set(key, row);
  return row;
}

function addPaid(row: FunnelTally, kind: 'platform' | 'sourcing', amount: bigint) {
  row.paidOrders += 1;
  row.paidAmountVnd += amount;
  if (kind === 'sourcing') row.sourcingPaidVnd += amount;
  else row.platformPaidVnd += amount;
}

function stageLabel(code: string, name: string): string {
  if (code === 'won') return 'Kết thúc thành công';
  if (code === 'lost') return 'Kết thúc thất bại';
  return name;
}

const STAGE_RANK = ['new', 'consulting', 'quoted', 'awaiting_payment', 'won', 'lost'];

function stageMoneyRows(map: Map<string, { label: string; sort: number; deals: number; price: bigint }>) {
  return [...map.entries()]
    .map(([code, row]) => ({ code, label: row.label, deals: row.deals, listPriceVnd: row.price.toString(), sort: row.sort }))
    .sort((a, b) => {
      const left = STAGE_RANK.indexOf(a.code);
      const right = STAGE_RANK.indexOf(b.code);
      if (left !== -1 || right !== -1) return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
      return a.sort - b.sort;
    })
    .map(({ sort: _sort, ...row }) => row);
}

interface LeadSourceTally {
  leads: number;
  companies: Set<string>;
  paid: Set<string>;
}

function addLeadSource(map: Map<string, LeadSourceTally>, key: string, companyId: string | null, paid: boolean) {
  const row = map.get(key) ?? { leads: 0, companies: new Set<string>(), paid: new Set<string>() };
  row.leads += 1;
  if (companyId) {
    row.companies.add(companyId);
    if (paid) row.paid.add(companyId);
  }
  map.set(key, row);
}

function leadSourceRows(map: Map<string, LeadSourceTally>, labelOf: (key: string) => string) {
  return [...map.entries()]
    .map(([key, row]) => ({
      key,
      label: labelOf(key),
      leads: row.leads,
      companies: row.companies.size,
      paidCompanies: row.paid.size,
    }))
    .sort((a, b) => b.leads - a.leads || b.paidCompanies - a.paidCompanies);
}

function sourceText(names: Map<string, string>, key: string): string {
  const named = names.get(key);
  if (named) return named;
  if (key === 'none') return 'Chưa có lead';
  if (key === 'unknown') return 'Chưa rõ';
  return key;
}

function funnelBuckets(map: Map<string, FunnelTally>, labelOf: (key: string) => string): CrmFunnelBucket[] {
  return [...map.entries()]
    .map(([key, row]) => ({
      key,
      label: labelOf(key),
      leads: row.leads,
      paidOrders: row.paidOrders,
      paidAmountVnd: row.paidAmountVnd.toString(),
      platformPaidVnd: row.platformPaidVnd.toString(),
      sourcingPaidVnd: row.sourcingPaidVnd.toString(),
    }))
    .sort((a, b) => {
      const amount = BigInt(b.paidAmountVnd) - BigInt(a.paidAmountVnd);
      if (amount > 0n) return 1;
      if (amount < 0n) return -1;
      return b.leads - a.leads;
    });
}

function customerAddress(
  lead: { address: string | null; street: string | null; ward: string | null; province: string | null } | undefined,
  companyAddress: string | null,
): string | null {
  const written = lead?.address?.trim();
  if (written) return written;
  const parts = [lead?.street, lead?.ward, lead?.province].map((part) => part?.trim() ?? '').filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return companyAddress?.trim() || null;
}

const QUOTE_LOGO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function optionalSite(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  if (value.length > 160 || /\s/.test(value)) throw new BadRequestException('Website chưa đúng');
  return value;
}

function readStaffGender(raw: string | null | undefined): CrmStaffGender | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  if (value === 'male' || value === 'female' || value === 'other') return value;
  throw new BadRequestException('Giới tính là Nam, Nữ hoặc Khác');
}

function readStaffProvince(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const province = resolveVnProvince2025(value);
  if (!province) throw new BadRequestException('Chọn tỉnh, thành theo địa giới từ 01/07/2025');
  return province;
}

function optionalPostal(raw: string | null | undefined): string | null {
  const value = raw?.replace(/\s/g, '') ?? '';
  if (!value) return null;
  if (!/^\d{5,6}$/.test(value)) throw new BadRequestException('Mã bưu chính gồm 5 hoặc 6 số');
  return value;
}

function optionalAccount(raw: string | null | undefined): string | null {
  const value = raw?.replace(/\s/g, '') ?? '';
  if (!value) return null;
  if (!/^\d{4,30}$/.test(value)) throw new BadRequestException('Số tài khoản gồm 4 đến 30 số');
  return value;
}

function clip(value: string | null | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function storedLeadSource(value: string | null | undefined): string {
  const code = (value ?? '').trim().toLowerCase();
  return code || 'unknown';
}

function expectedCloseDay(raw: string | null | undefined): Date | null {
  return calendarDay(raw, 'Ngày kỳ vọng');
}

function calendarDay(raw: string | null | undefined, label: string): Date | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${label} là ngày tháng năm`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException(`${label} không hợp lệ`);
  }
  return date;
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
