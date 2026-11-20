import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  BillingCompanySourcingPlan,
  BillingHuntPackage,
  BillingSourcingPlan,
  HuntCampaign,
  Prisma,
} from '@prisma/client';
import {
  includedScopeCodes,
  parseSourcingScope,
  SOURCING_OUTREACH_STATUS_META,
  SOURCING_QUOTA_LABELS,
  type AdminAssignCompanySourcingPlanRequest,
  type HuntPackageType,
  type RecruiterConsumeSourcingRequest,
  type RecruiterHuntCampaignResourceView,
  type RecruiterHuntCampaignView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingOutreachItem,
  type RecruiterSourcingScanCandidateItem,
  type RecruiterSourcingScanRoundView,
  type RecruiterSourcingReportView,
  type RecruiterSourcingUsageView,
  type RecruiterSourcingWorkspace,
  type SourcingOutreachStatus,
  type SourcingQuotaKind,
  type SourcingUsageKind,
  type BillingCompanySourcingPlanView,
} from '@industriallink/contracts';
import { looksLikeUuid } from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { addVnCalendarDays } from '../../shared/domain/vn-date.util';
import { toSeoSlug } from '@industriallink/contracts';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { canAttachHuntPackage } from './job-package-source.util';
import { HuntPackageService } from './hunt-package.service';

const SCOPE_FOR_KIND: Record<SourcingQuotaKind, string[] | null> = {
  position: null,
  search_round: null,
  shortlist: ['shortlist'],
  revision: null,
};

/**
 * Phạm vi dịch vụ theo LOẠI GÓI SĂN của chiến dịch (B3).
 *
 * ⚠ KHÔNG dùng scope của gói Săn đầu tiên (assignment.plan) — mỗi gói có
 * 1 chiến dịch riêng, mọi quyền lợi phải suy ra từ gói của chiến dịch đó.
 */
const PACKAGE_SCOPE: Record<string, string[]> = {
  BASIC: ['ai_match', 'filter_rank', 'shortlist'],
  STANDARD: ['ai_match', 'filter_rank', 'shortlist', 'strengths_gaps', 'priority'],
  DEEP: [
    'ai_match',
    'filter_rank',
    'shortlist',
    'strengths_gaps',
    'priority',
    'outreach',
  ],
};

const SOURCING_CYCLE_DAYS = 30;

function addUtcDays(from: Date, days: number): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

const USED_FIELD: Record<SourcingQuotaKind, keyof BillingCompanySourcingPlan> = {
  position: 'positionsUsed',
  search_round: 'searchRoundsUsed',
  shortlist: 'shortlistsUsed',
  revision: 'revisionsUsed',
};

@Injectable()
export class SourcingService {
  private readonly logger = new Logger(SourcingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly huntPackages: HuntPackageService,
  ) {}

  emptyEntitlements(): RecruiterSourcingEntitlements {
    return {
      assignment: null,
      planCode: null,
      planName: null,
      feeVnd: null,
      serviceScope: [],
      scopeItems: [],
      positionQuota: null,
      searchRoundQuota: null,
      shortlistQuota: null,
      revisionQuota: null,
      creditQuota: null,
      positionsUsed: 0,
      searchRoundsUsed: 0,
      shortlistsUsed: 0,
      revisionsUsed: 0,
      profileOpensUsed: 0,
      positionsRemaining: 0,
      searchRoundsRemaining: 0,
      shortlistsRemaining: 0,
      revisionsRemaining: 0,
      profileOpensRemaining: 0,
      outreachQuota: 0,
      outreachUsed: 0,
      outreachRemaining: 0,
    };
  }

  async getEntitlements(companyId: string): Promise<RecruiterSourcingEntitlements> {
    let row = await this.settleExpiredPlan(companyId);
    if (!row?.plan || !row.isActive) return this.emptyEntitlements();

    const campaigns = await this.prisma.huntCampaign.findMany({
      where: { companyId, assignmentId: row.id },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });

    // Mỗi gói Săn chỉ gắn 1 chiến dịch (ràng buộc UNIQUE ở DB).
    // Hạn mức vận hành lấy từ gói ACTIVE có hạn dài nhất.
    const activePackages = campaigns
      .map((c) => c.package)
      .filter((p): p is BillingHuntPackage => p.status === 'ACTIVE')
      .sort(
        (a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0),
      );
    const primaryPkg = activePackages[0] ?? null;

    // Số vị trí đang mở = số chiến dịch ACTIVE (1 gói = 1 chiến dịch).
    const validPositions = campaigns.filter((c) => c.status !== 'closed').length;
    if (row.positionsUsed !== validPositions) {
      row = await this.prisma.billingCompanySourcingPlan.update({
        where: { id: row.id },
        data: { positionsUsed: validPositions },
        include: { plan: true },
      });
    }

    // Số gói Săn CHỜ kích hoạt (UNUSED) → quyết định có thể tạo thêm chiến dịch hay không.
    // Đây là nguồn sự thật duy nhất (không dựa vào `assignment.endsAt`).
    const unusedPackages = await this.prisma.billingHuntPackage.count({
      where: { companyId, status: 'UNUSED' },
    });

    const activeJobIds = campaigns
      .filter((c) => c.status !== 'closed')
      .map((c) => c.jobId)
      .filter((id): id is string => Boolean(id));
    if (activeJobIds.length > 0) {
      await this.prisma.job.updateMany({
        where: {
          id: { in: activeJobIds },
          companyId,
          isDeleted: false,
          OR: [
            { status: { not: 'published' } },
            { moderationStatus: { not: 'approved' } },
            { publishedAt: null },
          ],
        },
        data: {
          status: 'published',
          moderationStatus: 'approved',
          publishedAt: new Date(),
        },
      });
    }

    const [opensUsed, outreachUsed, bookmarkShortlistsUsed] = await Promise.all([
      this.countIncludedOpens(row.id, row.startsAt),
      this.countOutreachUsed(row.id, row.startsAt),
      this.countShortlistBookmarks(row.id, row.startsAt),
    ]);
    if (row.shortlistsUsed !== bookmarkShortlistsUsed) {
      row = await this.prisma.billingCompanySourcingPlan.update({
        where: { id: row.id },
        data: { shortlistsUsed: bookmarkShortlistsUsed },
        include: { plan: true },
      });
    }
    return this.toEntitlements(row, primaryPkg, opensUsed, outreachUsed, unusedPackages);
  }

  async getWorkspace(companyId: string): Promise<RecruiterSourcingWorkspace> {
    const entitlements = await this.getEntitlements(companyId);
    const assignmentId = entitlements.assignment?.id;
    if (!assignmentId) {
      // (B6) Chưa có assignment (gói Săn chung) → vẫn PHẢI hiện gói Săn chờ kích hoạt
      // (UNUSED) để NTD không mất tiền âm thầm.
      return {
        entitlements,
        campaigns: [],
        packages: await this.huntPackages.listForCompany(companyId),
        campaignResources: [],
        usages: [],
        scanRounds: [],
      };
    }
    const [campaigns, usages] = await Promise.all([
      this.prisma.huntCampaign.findMany({
        where: { companyId, assignmentId, jobId: { not: null } },
        include: { package: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.huntCampaignActivity.findMany({
        where: { companyId, assignmentId },
        orderBy: { createdAt: 'desc' },
        take: 120,
      }),
    ]);
    const scanRounds = usages
      .filter((u) => u.kind === 'auto_scan' && u.campaignId)
      .map((u) => this.parseScanRound(u))
      .filter((r): r is RecruiterSourcingScanRoundView => r !== null);
    const reports = usages
      .filter((u) => u.kind === 'search_round' && u.note?.startsWith('report:'))
      .map((u) => this.parseReport(u))
      .filter((r): r is RecruiterSourcingReportView => r !== null);
    const shortlistedByCampaign: Record<string, string[]> = {};
    const outreachByCampaign: Record<string, RecruiterSourcingOutreachItem[]> = {};
    const statusByCampaignCandidate = new Map<string, SourcingOutreachStatus>();
    for (const u of usages) {
      if (u.kind === 'shortlist' && u.campaignId && u.note?.startsWith('outreach_status:')) {
        const parts = u.note.split(':');
        const cid = parts[1]?.trim();
        const st = parts[2]?.trim() as SourcingOutreachStatus | undefined;
        const key = `${u.campaignId}:${cid}`;
        if (cid && st && st in SOURCING_OUTREACH_STATUS_META && !statusByCampaignCandidate.has(key)) {
          statusByCampaignCandidate.set(key, st);
        }
      }
    }
    for (const u of usages) {
      if (u.kind === 'shortlist' && u.campaignId && u.note?.startsWith('shortlist:')) {
        const parts = u.note.split(':');
        const cid = parts[1]?.trim();
        if (cid) {
          const list = shortlistedByCampaign[u.campaignId] ?? [];
          if (!list.includes(cid)) list.push(cid);
          shortlistedByCampaign[u.campaignId] = list;
        }
      } else if (u.kind === 'shortlist' && u.campaignId && u.note?.startsWith('outreach:')) {
        const parts = u.note.split(':');
        const cid = parts[1]?.trim();
        const cname = parts[2]?.trim() || 'Ứng viên';
        const cnote = parts.slice(3).join(':').trim() || null;
        if (cid) {
          const list = outreachByCampaign[u.campaignId] ?? [];
          if (!list.some((item) => item.candidateId === cid)) {
            const st =
              statusByCampaignCandidate.get(`${u.campaignId}:${cid}`) ?? 'pending_contact';
            list.push({
              candidateId: cid,
              candidateName: cname,
              note: cnote,
              status: st,
              createdAt: u.createdAt.toISOString(),
            });
          }
          outreachByCampaign[u.campaignId] = list;
        }
      }
    }

    // Tự động đồng bộ trạng thái 'applied' nếu ứng viên đã nộp đơn vào JD của chiến dịch
    const campaignJobMap = new Map<string, string>();
    for (const c of campaigns) {
      if (c.jobId) campaignJobMap.set(c.id, c.jobId);
    }
    const outreachJobIds = [...new Set([...campaignJobMap.values()])];
    if (outreachJobIds.length > 0) {
      const apps = await this.prisma.application.findMany({
        where: { jobId: { in: outreachJobIds }, isDeleted: false },
        select: { jobId: true, candidateId: true },
      });
      const appliedJobCandSet = new Set(apps.map((a) => `${a.jobId}:${a.candidateId}`));
      for (const [campId, items] of Object.entries(outreachByCampaign)) {
        const jId = campaignJobMap.get(campId);
        if (!jId) continue;
        for (const item of items) {
          if (appliedJobCandSet.has(`${jId}:${item.candidateId}`)) {
            item.status = 'applied';
          }
        }
      }
    }
    const packages = await this.huntPackages.listForCompany(companyId);

    // Tài nguyên RIÊNG của từng chiến dịch (đọc đúng 1 gói đang gắn, không cộng dồn).
    const campaignResources = (
      await Promise.all(campaigns.map((c) => this.getCampaignResource(companyId, c.id)))
    ).filter((r): r is RecruiterHuntCampaignResourceView => r !== null);

    return {
      entitlements,
      packages,
      campaigns: campaigns.map((c) => this.mapCampaign(c)),
      campaignResources,
      usages: usages.map((u) => this.mapUsage(u)),
      scanRounds,
      shortlistedByCampaign,
      outreachByCampaign,
      reports,
    };
  }

  /**
   * Tài nguyên dịch vụ của RIÊNG 1 chiến dịch.
   * Đọc đúng 1 bản ghi `BillingHuntPackage` gắn với chiến dịch (không cộng dồn toàn công ty).
   */
  async getCampaignResource(companyId: string, campaignId: string): Promise<RecruiterHuntCampaignResourceView | null> {
    const campaign = await this.prisma.huntCampaign.findFirst({
      where: { id: campaignId, companyId },
      include: { package: true },
    });
    if (!campaign) return null;

    const pkg = campaign.package;
    const [scanRoundCount, creditBalance, creditConsumed] = await Promise.all([
      this.prisma.huntCampaignActivity.count({
        where: { campaignId, kind: 'auto_scan' },
      }),
      this.prisma.billingCreditAccount
        .findUnique({ where: { companyId }, select: { balance: true } })
        .then((a) => a?.balance ?? 0),
      this.prisma.billingCreditTransaction.aggregate({
        where: { campaignId, creditDelta: { lt: 0 } },
        _sum: { creditDelta: true },
      }),
    ]);

    const expiresAt = pkg.expiresAt?.toISOString() ?? null;
    const daysRemaining = pkg.expiresAt
      ? Math.max(0, Math.ceil((pkg.expiresAt.getTime() - Date.now()) / 86_400_000))
      : null;

    // Cô lập quyền lợi 100% theo CHIẾN DỊCH: mọi cờ đều suy ra từ đúng 1
    // `BillingHuntPackage` gắn qua `huntPackageId` — KHÔNG đọc cấp Company/User.
    const isDeepPackage = pkg.packageType === 'DEEP';
    const canHandover = isDeepPackage && pkg.totalHandovers > 0;

    return {
      campaignId: campaign.id,
      packageId: pkg.id,
      packageCode: pkg.code,
      packageName: pkg.packageName,
      packageType: pkg.packageType as HuntPackageType,
      expiresAt,
      daysRemaining,
      scanRoundCount,
      criteriaEditsRemaining: Math.max(0, pkg.totalCriteriaEdits - pkg.usedCriteriaEdits),
      totalCriteriaEdits: pkg.totalCriteriaEdits,
      usedCriteriaEdits: pkg.usedCriteriaEdits,
      reportsRemaining: Math.max(0, pkg.totalReports - pkg.usedReports),
      totalReports: pkg.totalReports,
      usedReports: pkg.usedReports,
      handoversRemaining: Math.max(0, pkg.totalHandovers - pkg.usedHandovers),
      handoversApplicable: pkg.totalHandovers > 0,
      isDeepPackage,
      canHandover,
      totalHandovers: pkg.totalHandovers,
      usedHandovers: pkg.usedHandovers,
      creditBalance,
      creditConsumedByCampaign: Math.abs(Number(creditConsumed._sum.creditDelta ?? 0)),
    };
  }

  async getCompanyAssignment(companyId: string): Promise<BillingCompanySourcingPlanView | null> {
    const row = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!row?.plan) return null;
    return this.mapAssignment(row);
  }

  async assignCompanyPlan(
    actor: AuthenticatedUser,
    input: AdminAssignCompanySourcingPlanRequest,
    opts: { restartCycle?: boolean; preserveRemaining?: boolean; reserveOnly?: boolean } = {},
  ): Promise<BillingCompanySourcingPlanView> {
    const plan = await this.prisma.billingSourcingPlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundException('Không tìm thấy gói Săn');

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const actorId = looksLikeUuid(actor.id) ? actor.id : null;
    const before = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId: input.companyId },
      include: { plan: true },
    });
    const switching =
      Boolean(opts.restartCycle) || !before || before.planId !== input.planId || !before.isActive;
    const reserveOnly = Boolean(opts.reserveOnly);
    const cycleEnd = reserveOnly
      ? null
      : input.endsAt === undefined
        ? addUtcDays(startsAt, SOURCING_CYCLE_DAYS)
        : input.endsAt
          ? new Date(input.endsAt)
          : null;
    const activatedAt = reserveOnly ? null : startsAt;
    const reserveEndsAt = reserveOnly ? addUtcDays(startsAt, 365) : null;

    let extraPositionQuota = before?.extraPositionQuota ?? 0;
    let extraSearchRoundQuota = before?.extraSearchRoundQuota ?? 0;
    let extraShortlistQuota = before?.extraShortlistQuota ?? 0;
    let extraRevisionQuota = before?.extraRevisionQuota ?? 0;
    let extraCreditQuota = before?.extraCreditQuota ?? 0;
    const now = new Date();
    const beforeValid =
      before &&
      before.isActive &&
      before.plan &&
      (!before.endsAt || before.endsAt >= now) &&
      (!before.reserveEndsAt || before.activatedAt != null || before.reserveEndsAt >= now);

    if (opts.preserveRemaining && beforeValid) {
      const [oldOpensUsed, activeCampaignCount] = await Promise.all([
        this.countIncludedOpens(before.id, before.startsAt),
        this.prisma.huntCampaign.count({
          where: {
            companyId: input.companyId,
            assignmentId: before.id,
            jobId: { not: null },
            status: { not: 'closed' },
          },
        }),
      ]);
      const oldPosQuota =
        before.plan.positionQuota != null
          ? before.plan.positionQuota + (before.extraPositionQuota ?? 0)
          : null;
      const remainingOldPos =
        oldPosQuota != null ? Math.max(0, oldPosQuota - activeCampaignCount) : 0;
      extraPositionQuota =
        plan.positionQuota != null ? activeCampaignCount + remainingOldPos : 0;
      extraSearchRoundQuota =
        before.plan.searchRoundQuota != null
          ? Math.max(
              0,
              before.plan.searchRoundQuota + (before.extraSearchRoundQuota ?? 0) - before.searchRoundsUsed,
            )
          : 0;
      extraShortlistQuota =
        before.plan.shortlistQuota != null
          ? Math.max(
              0,
              before.plan.shortlistQuota + (before.extraShortlistQuota ?? 0) - before.shortlistsUsed,
            )
          : 0;
      extraRevisionQuota =
        before.plan.revisionQuota != null
          ? Math.max(
              0,
              before.plan.revisionQuota + (before.extraRevisionQuota ?? 0) - before.revisionsUsed,
            )
          : 0;
      extraCreditQuota =
        before.plan.creditQuota != null
          ? Math.max(0, before.plan.creditQuota + (before.extraCreditQuota ?? 0) - oldOpensUsed)
          : 0;
    } else if (switching) {
      extraPositionQuota = 0;
      extraSearchRoundQuota = 0;
      extraShortlistQuota = 0;
      extraRevisionQuota = 0;
      extraCreditQuota = 0;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const assigned = await tx.billingCompanySourcingPlan.upsert({
        where: { companyId: input.companyId },
        create: {
          companyId: input.companyId,
          planId: input.planId,
          startsAt,
          endsAt: cycleEnd,
          activatedAt,
          reserveEndsAt,
          isActive: input.isActive ?? true,
          note: input.note ?? 'Kích hoạt gói Săn nhân sự',
          extraPositionQuota,
          extraSearchRoundQuota,
          extraShortlistQuota,
          extraRevisionQuota,
          extraCreditQuota,
          createdBy: actorId,
          updatedBy: actorId,
        },
        update: {
          planId: input.planId,
          startsAt: switching ? startsAt : undefined,
          endsAt: switching || input.endsAt !== undefined || reserveOnly ? cycleEnd : undefined,
          activatedAt: switching || reserveOnly ? activatedAt : undefined,
          reserveEndsAt: switching || reserveOnly ? reserveEndsAt : undefined,
          isActive: input.isActive ?? true,
          note: input.note ?? 'Kích hoạt gói Săn nhân sự',
          extraPositionQuota,
          extraSearchRoundQuota,
          extraShortlistQuota,
          extraRevisionQuota,
          extraCreditQuota,
          updatedBy: actorId,
          ...(switching
            ? { positionsUsed: 0, searchRoundsUsed: 0, shortlistsUsed: 0, revisionsUsed: 0 }
            : {}),
        },
        include: { plan: true },
      });
      // Chỉ xoá chiến dịch cũ khi admin reset thủ công; khi NTD mua cộng dồn thì giữ nguyên.
      if (switching && !opts.preserveRemaining) {
        await tx.huntCampaignActivity.deleteMany({
          where: { companyId: input.companyId, assignmentId: assigned.id },
        });
        await tx.huntCampaign.deleteMany({
          where: { companyId: input.companyId, assignmentId: assigned.id },
        });
        // (B7) Gói Săn ACTIVE mồ côi (chiến dịch vừa bị xoá) → chuyển EXPIRED.
        // Credit đã cấp vẫn nằm trong Ví dùng chung (không thu hồi) — nhưng gói
        // không được để ở ACTIVE mà không có chiến dịch để dùng.
        await tx.billingHuntPackage.updateMany({
          where: { companyId: input.companyId, status: 'ACTIVE' },
          data: {
            status: 'EXPIRED',
            note: 'Gói Săn bị vô hiệu hoá khi SuperAdmin gán lại gói Săn cho công ty',
          },
        });
      }
      return assigned;
    });

    await this.writeAudit(
      actor,
      'company_sourcing_plan',
      input.companyId,
      switching ? 'assign' : 'update',
      before
        ? { planId: before.planId, isActive: before.isActive }
        : null,
      { planId: row.planId, planCode: plan.code, isActive: row.isActive },
    );
    this.logger.log(`Gán gói Săn ${plan.code} cho công ty ${input.companyId}`);
    return this.mapAssignment(row);
  }

  /**
   * Sau khi thanh toán gói Săn: tạo 1 bản ghi gói UNUSED độc lập (TS-xxxxxx).
   * Gói chỉ chuyển ACTIVE khi NTD tạo chiến dịch.
   *
   * ⚠ KHÔNG BAO GIỜ ghi đè cấu hình gói Săn chung của công ty:
   * - Nếu công ty ĐÃ có gói Săn đang gán (`BillingCompanySourcingPlan`),
   *   giữ nguyên `planId` / `startsAt` / `endsAt` / `activatedAt` / các bộ đếm đã dùng.
   * - Mỗi lần mua = 1 `BillingHuntPackage` độc lập (INSERT thuần) → nhiều gói
   *   (kể cả khác loại) chạy song song mà không đè lên nhau.
   */
  async activatePurchasedPlan(
    actor: AuthenticatedUser,
    companyId: string,
    planCode: string,
  ): Promise<BillingCompanySourcingPlanView> {
    const plan = await this.prisma.billingSourcingPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy gói Săn hoặc gói đã tắt');

    // Đã có gói Săn chạy sẵn → KHÔNG upsert/ghi đè bản ghi chung của công ty.
    const existing = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (existing?.isActive) {
      await this.writeAudit(
        actor,
        'company_sourcing_plan',
        companyId,
        'purchase_add_package',
        { planId: existing.planId, isActive: existing.isActive },
        { purchasedPlanCode: plan.code, note: 'Gói Săn mới sẽ tạo 1 chiến dịch riêng' },
      );
      return this.mapAssignment(existing);
    }

    const startsAt = new Date();
    return this.assignCompanyPlan(
      actor,
      {
        companyId,
        planId: plan.id,
        startsAt: startsAt.toISOString(),
        endsAt: null,
        isActive: true,
        note: `Kích hoạt gói ${plan.name} sau thanh toán / duyệt (bảo lưu tối đa 365 ngày)`,
      },
      { restartCycle: true, preserveRemaining: true, reserveOnly: true },
    );
  }

  /**
   * Tạo gói Săn UNUSED cho 1 đơn đã trả (gọi từ PaymentService).
   */
  async createPackageForOrder(input: {
    orderId: string;
    companyId: string;
    planId: string;
    planCode: string | null;
    planName: string | null;
    durationDays: number | null;
    paidAt: Date | null;
  }): Promise<void> {
    await this.huntPackages.createForOrder(input);
  }

  async unassignCompanyPlan(actor: AuthenticatedUser, companyId: string): Promise<void> {
    const before = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId },
    });
    if (!before) throw new NotFoundException('Công ty chưa được gán gói Săn');
    await this.prisma.billingCompanySourcingPlan.update({
      where: { companyId },
      data: {
        isActive: false,
        updatedBy: looksLikeUuid(actor.id) ? actor.id : null,
      },
    });
    await this.writeAudit(
      actor,
      'company_sourcing_plan',
      companyId,
      'deactivate',
      { planId: before.planId },
      null,
    );
  }

  async consume(
    actor: AuthenticatedUser,
    companyId: string,
    input: RecruiterConsumeSourcingRequest,
  ): Promise<RecruiterSourcingWorkspace> {
    const kind = input.kind;
    if (!SOURCING_QUOTA_LABELS[kind]) {
      throw new BadRequestException('Loại hạn mức Săn không hợp lệ');
    }

    await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.billingCompanySourcingPlan.findUnique({
        where: { companyId },
        include: { plan: true },
      });
      if (!assignment?.plan || !assignment.isActive) {
        throw new ForbiddenException({
          code: 'SOURCING_PLAN_REQUIRED',
          message: 'Bạn chưa có gói Săn nhân sự. Hãy chọn gói trên bảng giá.',
        });
      }
      // ⚠ KHÔNG chặn theo `assignment.endsAt`: mỗi gói Săn có hạn riêng và 1-1 với chiến dịch.
      // Hạn của gói/chiến dịch được kiểm tra bên dưới theo `pkg.expiresAt`.

      this.assertScope(assignment.plan, kind);
      const actorId = looksLikeUuid(actor.id) ? actor.id : null;
      let campaignId = input.campaignId ?? null;

      if (kind === 'position') {
        const validJobId = input.jobId && looksLikeUuid(input.jobId) ? input.jobId : null;
        if (!validJobId) {
          throw new BadRequestException(
            'Vui lòng chọn một tin tuyển dụng (JD) có sẵn hoặc tạo JD mới để kích hoạt Tin Săn.',
          );
        }
        const dupCampaign = await tx.huntCampaign.findFirst({
          where: { companyId, assignmentId: assignment.id, jobId: validJobId, status: { not: 'closed' } },
        });
        if (dupCampaign) {
          throw new BadRequestException(
            'Tin tuyển dụng (JD) này đã được kích hoạt trong Danh sách Tin Săn.',
          );
        }

        const sourceJob = await tx.job.findFirst({
          where: { id: validJobId, companyId, isDeleted: false },
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
            requirements: true,
            benefits: true,
            industry: true,
            subIndustry: true,
            department: true,
            jobLevel: true,
            employmentType: true,
            location: true,
            headcount: true,
            deadline: true,
            experienceBand: true,
            salaryMin: true,
            salaryMax: true,
            jobTrack: true,
            salesCriteria: true,
            technicalCriteria: true,
            status: true,
            publishedAt: true,
            tenantId: true,
            jobPackageId: true,
            jobPackage: { select: { packageType: true } },
            skills: { select: { skillId: true, name: true, required: true, weight: true } },          },
        });
        if (!sourceJob) {
          throw new NotFoundException('Không tìm thấy tin tuyển dụng (JD) đã chọn.');
        }

        // (A) KHÓA CHIỀU 2 — Tin đang chạy bằng gói Tin đăng TRẢ PHÍ thì KHÔNG được
        // gắn trực tiếp gói Tin săn (1 tin chỉ có 1 nguồn gói trả phí).
        // Muốn săn cho vị trí đó → dùng luồng "Copy nội dung JD sang Tin săn mới".
        if (!input.copyJdToNewJob) {
          const { eligible, disabledReason } = canAttachHuntPackage({
            jobStatus: sourceJob.status,
            jobPackageType: sourceJob.jobPackage?.packageType ?? null,
            isHuntOwnedByOther: false,
          });
          if (!eligible) {
            throw new BadRequestException(
              disabledReason ??
                'Tin này đang chạy bằng gói Tin đăng trả phí — không thể gắn thêm gói Tin săn.',
            );
          }
        }

        // Chọn gói Săn cụ thể: theo packageId truyền lên, hoặc gói UNUSED lâu nhất.
        const targetPkg = await this.huntPackages.findUnused(companyId, input.packageId ?? null);
        const pkgDuration = targetPkg.durationDays > 0 ? targetPkg.durationDays : SOURCING_CYCLE_DAYS;
        const title = sourceJob.title || input.title?.trim() || 'Tin Săn tuyển dụng';

        // === 1 TRANSACTION DUY NHẤT ===
        // Tạo chiến dịch + chuyển gói UNUSED → ACTIVE + cộng Credit vào Ví dùng chung.
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { tenantId: true },
        });
        const tenantId = company?.tenantId ?? sourceJob.tenantId ?? 'default';

        // (A) Chế độ "Copy nội dung JD sang Tin săn mới": tạo bản ghi Job MỚI hoàn toàn,
        // KHÔNG ghi đè `jobId` của tin cũ. Tin cũ giữ nguyên toàn bộ dữ liệu.
        let targetJobId = sourceJob.id;
        let copiedJobId: string | null = null;
        if (input.copyJdToNewJob) {
          const newJob = await this.copyJobForHunt(tx, {
            sourceJob,
            companyId,
            tenantId,
            actorUserId: actorId,
          });
          targetJobId = newJob.id;
          copiedJobId = newJob.id;
        }

        const activated = await this.huntPackages.activateWithCampaign(tx, {
          companyId,
          tenantId,
          packageId: targetPkg.id,
          assignmentId: assignment.id,
          jobId: targetJobId,
          title,
          actorUserId: actorId,
          actorEmail: actor.email ?? null,
        });
        campaignId = activated.campaignId;

        // Kết thúc trạng thái bảo lưu khi NTD kích hoạt Tin Săn đầu tiên.
        if (!assignment.activatedAt) {
          await tx.billingCompanySourcingPlan.update({
            where: { id: assignment.id },
            data: {
              activatedAt: new Date(),
              endsAt: addUtcDays(new Date(), pkgDuration),
            },
          });
        }

        // (A) Đồng bộ nguồn gói & thời hạn khi chuyển sang Tin săn:
        // - Hạn hiển thị tin = now + 30 ngày (KHÔNG cộng dồn thành 60 ngày).
        // - Ngắt liên kết gói Tin đăng cũ (nếu có) → tin thuộc nguồn gói Săn.
        const huntDeadline = addVnCalendarDays(new Date(), pkgDuration);
        await tx.job.update({
          where: { id: targetJobId },
          data: {
            deadline: huntDeadline,
            jobPackageId: null,
            status: 'published',
            moderationStatus: 'approved',
            publishedAt: sourceJob.publishedAt ?? new Date(),
          },
        });

        // Tuỳ chọn: tự động đóng tin đăng thường cũ (tránh 2 tin trùng ngoài trang ứng viên).
        if (input.copyJdToNewJob && input.closeSourceJob && sourceJob.id !== targetJobId) {
          await tx.job.update({
            where: { id: sourceJob.id },
            data: { status: 'closed', pausedAt: null },
          });
        }
      } else {
        if (!campaignId) {
          throw new BadRequestException(
            'Chọn chiến dịch đang mở để ghi đợt tìm / shortlist / điều chỉnh',
          );
        }
        const campaign = await tx.huntCampaign.findFirst({
          where: { id: campaignId, companyId, assignmentId: assignment.id },
          include: { package: true },
        });
        if (!campaign) throw new NotFoundException('Không tìm thấy chiến dịch Săn');
        if (campaign.status === 'closed') {
          throw new BadRequestException('Chiến dịch Săn đã đóng');
        }
        const pkg = campaign.package;
        if (!pkg || pkg.status !== 'ACTIVE') {
          throw new ForbiddenException({
            code: 'SOURCING_PACKAGE_INACTIVE',
            message: 'Gói Săn của chiến dịch này không còn hiệu lực.',
          });
        }
        if (pkg.expiresAt && pkg.expiresAt.getTime() < Date.now()) {
          throw new ForbiddenException({
            code: 'SOURCING_CYCLE_ENDED',
            message: 'Gói Săn đã hết hạn. Hãy gia hạn để dùng tiếp.',
          });
        }

        // (B3) Phạm vi dịch vụ lấy theo GÓI CỦA CHIẾN DỊCH — không theo gói đầu tiên.
        this.assertCampaignScope(pkg, kind);

        if (kind === 'search_round' && campaign.status === 'open') {
          await tx.huntCampaign.update({
            where: { id: campaign.id },
            data: { status: 'in_progress' },
          });
        }

        if (kind === 'shortlist') {
          if (input.note?.startsWith('unshortlist:')) {
            const parts = input.note.split(':');
            const candidateId = parts[1]?.trim();
            if (candidateId) {
              const deleted = await tx.huntCampaignActivity.deleteMany({
                where: {
                  companyId,
                  assignmentId: assignment.id,
                  campaignId: campaign.id,
                  kind: 'shortlist',
                  note: { startsWith: `shortlist:${candidateId}:` },
                },
              });
              if (deleted.count > 0) {
                const nextUsed = Math.max(0, assignment.shortlistsUsed - deleted.count);
                await tx.billingCompanySourcingPlan.update({
                  where: { id: assignment.id },
                  data: { shortlistsUsed: nextUsed, updatedBy: actorId },
                });
              }
            }
            return;
          }
          if (input.note?.startsWith('outreach_status:')) {
            const parts = input.note.split(':');
            const candidateId = parts[1]?.trim();
            const status = parts[2]?.trim() as SourcingOutreachStatus | undefined;
            if (!candidateId || !status || !(status in SOURCING_OUTREACH_STATUS_META)) {
              throw new BadRequestException('Trạng thái liên hệ ứng viên không hợp lệ.');
            }
            await tx.huntCampaignActivity.deleteMany({
              where: {
                companyId,
                assignmentId: assignment.id,
                campaignId: campaign.id,
                kind: 'shortlist',
                note: { startsWith: `outreach_status:${candidateId}:` },
              },
            });
            await tx.huntCampaignActivity.create({
              data: {
                companyId,
                assignmentId: assignment.id,
                campaignId: campaign.id,
                kind: 'shortlist',
                jobId: input.jobId && looksLikeUuid(input.jobId) ? input.jobId : null,
                note: `outreach_status:${candidateId}:${status}`,
                createdBy: actorId,
              },
            });
            return;
          }
          if (input.note?.startsWith('outreach:')) {
            // Bàn giao Inlink: kiểm tra hạn mức riêng của GÓI (totalHandovers / usedHandovers).
            // Không trừ thêm Credit của doanh nghiệp.
            if (pkg.totalHandovers <= 0) {
              throw new ForbiddenException({
                code: 'SOURCING_OUTREACH_FORBIDDEN',
                message:
                  'Gói hiện tại không bao gồm tính năng Giao Inlink liên hệ ứng viên. Vui lòng nâng cấp lên gói Tin săn Chuyên sâu.',
              });
            }
            const lockedPkg = await this.huntPackages.lockPackage(tx, pkg.id);
            if (lockedPkg.used_handovers >= lockedPkg.total_handovers) {
              throw new ForbiddenException({
                code: 'SOURCING_OUTREACH_QUOTA_EXCEEDED',
                message: `Gói ${pkg.packageName} đã dùng hết ${lockedPkg.total_handovers}/${lockedPkg.total_handovers} lượt Giao Inlink liên hệ ứng viên.`,
              });
            }
            const parts = input.note.split(':');
            const candidateId = parts[1]?.trim();
            if (candidateId) {
              const dup = await tx.huntCampaignActivity.findFirst({
                where: {
                  assignmentId: assignment.id,
                  campaignId: campaign.id,
                  kind: 'shortlist',
                  note: { startsWith: `outreach:${candidateId}:` },
                },
              });
              if (dup) {
                return;
              }
            }
            // Ghi nhận lượt bàn giao của riêng gói này.
            await tx.billingHuntPackage.update({
              where: { id: pkg.id },
              data: { usedHandovers: { increment: 1 } },
            });
            if (candidateId) {
              const openPrefix = `open:${candidateId}`;
              const alreadyOpened = await tx.huntCampaignActivity.findFirst({
                where: {
                  assignmentId: assignment.id,
                  kind: 'profile_open',
                  createdAt: { gte: assignment.startsAt },
                  OR: [{ note: openPrefix }, { note: { startsWith: `${openPrefix}:` } }],
                },
              });
              if (!alreadyOpened) {
                await tx.huntCampaignActivity.create({
                  data: {
                    companyId,
                    assignmentId: assignment.id,
                    campaignId: campaign.id,
                    kind: 'profile_open',
                    jobId: input.jobId && looksLikeUuid(input.jobId) ? input.jobId : null,
                    note: `${openPrefix}:0`,
                    createdBy: actorId,
                  },
                });
              }
              // Tự động đánh dấu Shortlist khi NTD bàn giao (Giao Inlink).
              // Đảm bảo ứng viên bàn giao luôn nằm trong danh sách shortlist của CHÍNH chiến dịch này.
              const shortlistPrefix = `shortlist:${candidateId}`;
              const alreadyShortlisted = await tx.huntCampaignActivity.findFirst({
                where: {
                  assignmentId: assignment.id,
                  campaignId: campaign.id,
                  kind: 'shortlist',
                  note: { startsWith: `${shortlistPrefix}:` },
                },
              });
              if (!alreadyShortlisted) {
                await tx.huntCampaignActivity.create({
                  data: {
                    companyId,
                    assignmentId: assignment.id,
                    campaignId: campaign.id,
                    kind: 'shortlist',
                    jobId: input.jobId && looksLikeUuid(input.jobId) ? input.jobId : null,
                    note: `${shortlistPrefix}:outreach`,
                    createdBy: actorId,
                  },
                });
                await tx.billingCompanySourcingPlan.update({
                  where: { id: assignment.id },
                  data: { shortlistsUsed: { increment: 1 }, updatedBy: actorId },
                });
              }
            }
          }
          if (input.note?.startsWith('shortlist:')) {
            const parts = input.note.split(':');
            const candidateId = parts[1]?.trim();
            if (candidateId) {
              const dup = await tx.huntCampaignActivity.findFirst({
                where: {
                  assignmentId: assignment.id,
                  campaignId: campaign.id,
                  kind: 'shortlist',
                  note: { startsWith: `shortlist:${candidateId}:` },
                },
              });
              if (dup) {
                return;
              }
            }
          }
          await tx.huntCampaign.update({
            where: { id: campaign.id },
            data: { status: 'shortlisted' },
          });
        }

        // Trừ lượt theo gói RIÊNG của chiến dịch (báo cáo / điều chỉnh).
        if (kind === 'revision') {
          const lockedPkg = await this.huntPackages.lockPackage(tx, pkg.id);
          if (lockedPkg.used_criteria_edits >= lockedPkg.total_criteria_edits) {
            throw new ForbiddenException({
              code: 'SOURCING_QUOTA_EXCEEDED',
              message: `Gói ${pkg.packageName} đã hết lượt điều chỉnh tiêu chí.`,
              kind,
            });
          }
          await tx.billingHuntPackage.update({
            where: { id: pkg.id },
            data: { usedCriteriaEdits: { increment: 1 } },
          });
        }
        if (kind === 'search_round') {
          const lockedPkg = await this.huntPackages.lockPackage(tx, pkg.id);
          if (lockedPkg.used_reports >= lockedPkg.total_reports) {
            throw new ForbiddenException({
              code: 'SOURCING_QUOTA_EXCEEDED',
              message: `Gói ${pkg.packageName} đã hết lượt báo cáo tiến độ.`,
              kind,
            });
          }
          await tx.billingHuntPackage.update({
            where: { id: pkg.id },
            data: { usedReports: { increment: 1 } },
          });
        }
      }

      if (!input.note?.startsWith('outreach:')) {
        const field = USED_FIELD[kind];
        await tx.billingCompanySourcingPlan.update({
          where: { id: assignment.id },
          data: { [field]: { increment: 1 }, updatedBy: actorId },
        });
      }
      await tx.huntCampaignActivity.create({
        data: {
          companyId,
          assignmentId: assignment.id,
          campaignId,
          kind,
          jobId: input.jobId && looksLikeUuid(input.jobId) ? input.jobId : null,
          note: input.note?.trim() || this.defaultNote(kind),
          createdBy: actorId,
        },
      });
    });

    return this.getWorkspace(companyId);
  }

  /**
   * (A) "Copy nội dung JD sang Tin săn mới" — TẠO 1 bản ghi `Job` MỚI hoàn toàn.
   *
   * Copy: tiêu đề, mô tả, yêu cầu, lợi ích, lương, địa điểm, kỹ năng, tiêu chí AI,
   * ngành, cấp bậc, hình thức làm việc, kinh nghiệm.
   *
   * KHÔNG chạm / KHÔNG ghi đè tin cũ (`jobId` của tin cũ giữ nguyên).
   * Tin mới KHÔNG gắn gói tin đăng (`jobPackageId = null`) → nguồn gói là HUNT_PACKAGE.
   */
  private async copyJobForHunt(
    tx: Prisma.TransactionClient,
    input: {
      sourceJob: {
        id: string;
        title: string;
        description: string;
        requirements: string | null;
        benefits: string | null;
        industry: string | null;
        subIndustry: string | null;
        department: string | null;
        jobLevel: string | null;
        employmentType: string | null;
        location: string | null;
        headcount: number | null;
        experienceBand: string | null;
        salaryMin: number | null;
        salaryMax: number | null;
        jobTrack: string | null;
        salesCriteria: unknown;
        technicalCriteria: unknown;
        tenantId: string;
        skills: Array<{
          skillId: string | null;
          name: string;
          required: boolean;
          weight: number;
        }>;
      };
      companyId: string;
      tenantId: string;
      actorUserId: string | null;
    },
  ): Promise<{ id: string; code: string }> {
    const { sourceJob, companyId, tenantId, actorUserId } = input;

    // Mã tin mới: JOB-YYYY-NNNNNN (dùng sequence chung, không ghi đè tin cũ).
    const code = await this.nextJobCode(tx);

    // Slug duy nhất cho tin mới.
    const slug = await this.allocateSlugForJob(tx, {
      title: sourceJob.title,
      code,
      industry: sourceJob.industry,
      location: sourceJob.location,
    });

    const created = await tx.job.create({
      data: {
        code,
        slug,
        tenantId,
        companyId,
        title: sourceJob.title,
        description: sourceJob.description,
        requirements: sourceJob.requirements,
        benefits: sourceJob.benefits,
        industry: sourceJob.industry,
        subIndustry: sourceJob.subIndustry,
        department: sourceJob.department,
        jobLevel: sourceJob.jobLevel,
        employmentType: sourceJob.employmentType,
        location: sourceJob.location,
        headcount: sourceJob.headcount ?? 1,
        experienceBand: sourceJob.experienceBand,
        salaryMin: sourceJob.salaryMin,
        salaryMax: sourceJob.salaryMax,
        jobTrack: sourceJob.jobTrack,
        salesCriteria: (sourceJob.salesCriteria ?? undefined) as never,
        technicalCriteria: (sourceJob.technicalCriteria ?? undefined) as never,
        // Tin mới do gói Săn nuôi → KHÔNG gắn gói tin đăng.
        jobPackageId: null,
        status: 'published',
        moderationStatus: 'approved',
        publishedAt: new Date(),
        createdBy: actorUserId,
        skills: {
          create: sourceJob.skills
            .filter((s) => Boolean(s.skillId))
            .map((s) => ({
              skillId: s.skillId as string,
              name: s.name,
              required: s.required,
              weight: s.weight,
            })),
        },
      },
      select: { id: true, code: true },
    });

    return created;
  }

  /** Sinh mã JOB-YYYY-NNNNNN cho tin mới (dùng sequence chung của hệ thống). */
  private async nextJobCode(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const key = `JOB-${year}`;
    const seq = await tx.sequence.upsert({
      where: { key },
      create: { key, value: 1n },
      update: { value: { increment: 1n } },
    });
    return `JOB-${year}-${String(seq.value).padStart(6, '0')}`;
  }

  /** Cấp slug duy nhất cho tin mới. */
  private async allocateSlugForJob(
    tx: Prisma.TransactionClient,
    input: { title: string; code: string; industry: string | null; location: string | null },
  ): Promise<string> {
    const base = toSeoSlug(input.title) || 'tin-tuyen-dung';
    const rows = await tx.job.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const taken = rows.map((r) => r.slug).filter((s): s is string => Boolean(s));
    let slug = base;
    let n = 1;
    while (taken.includes(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    return slug;
  }

  /**
   * Kiểm tra lần mở hồ sơ ứng viên tiềm năng trong kỳ gói Săn.
   *
   * Mô hình mới (1-1 gói ↔ chiến dịch + Ví Credit dùng chung):
   * Credit của gói Săn được cộng vào Ví Credit dùng chung ngay khi kích hoạt gói,
   * nên không còn "kho Credit riêng của gói" nữa.
   *
   * ⚠ RÀNG BUỘC (B5): KHÔNG còn cơ chế "miễn phí mở hồ sơ theo assignment/gói".
   * Mở hồ sơ ứng viên TIỀM NĂNG luôn trừ Credit từ Ví dùng chung.
   * Chỉ MIỄN PHÍ cho:
   *   (a) ứng viên TỰ ỨNG TUYỂN (`applied`) — xử lý ở `candidate.service.ts`;
   *   (b) tối đa 15 lượt bàn giao Inlink ở gói Tin săn Chuyên sâu (DEEP) —
   *       được đánh dấu `profile_open` với cost 0 trong nhánh `outreach:` của `consume`.
   *
   * - 'repeat' : ứng viên này đã được mở (miễn phí) trong CHÍNH chiến dịch này → không trừ thêm.
   * - 'skip'   : mở mới → người gọi TRỪ Credit từ Ví dùng chung (FIFO lot),
   *              sau đó gọi `recordProfileOpen` để ghi vào ledger chiến dịch.
   */
  async coverIncludedOpen(input: {
    companyId: string;
    candidateId: string;
    campaignId?: string | null;
    actorUserId?: string;
    cost?: number;
  }): Promise<'included' | 'repeat' | 'skip'> {
    const assignment = await this.settleExpiredPlan(input.companyId);
    if (!assignment?.plan || !assignment.isActive) return 'skip';

    // ⚠ RÀNG BUỘC (B5): KHÔNG có cơ chế "miễn phí mở hồ sơ theo assignment/gói".
    // Mở hồ sơ ứng viên TIỀM NĂNG luôn trừ Credit từ Ví dùng chung.
    // Chỉ MIỄN PHÍ cho:
    //   (a) ứng viên TỰ ỨNG TUYỂN (`applied`) — xử lý ở `candidate.service.ts`;
    //   (b) tối đa 15 lượt bàn giao Inlink ở gói Tin săn Chuyên sâu (DEEP) —
    //       được đánh dấu `profile_open` với cost 0 trong nhánh `outreach:` của `consume`.
    //
    // Không có `campaignId` → không có mốc "đã mở miễn phí" nào → luôn trừ Credit.
    if (!input.campaignId) return 'skip';

    const prefix = `open:${input.candidateId}`;
    // ⚠ Cô lập theo CHIẾN DỊCH: mở ở chiến dịch A không được miễn phí ở chiến dịch B.
    const openRows = await this.prisma.huntCampaignActivity.findMany({
      where: {
        assignmentId: assignment.id,
        campaignId: input.campaignId,
        kind: 'profile_open',
        createdAt: { gte: assignment.startsAt },
      },
      select: { id: true, note: true },
    });
    const already = openRows.some(
      (r) => r.note === prefix || Boolean(r.note && r.note.startsWith(`${prefix}:`)),
    );
    return already ? 'repeat' : 'skip';
  }

  /**
   * Ghi ledger "mở hồ sơ ứng viên tiềm năng" vào đúng CHIẾN DỊCH đang chạy.
   * Được gọi sau khi Credit đã trừ thành công từ Ví dùng chung.
   */
  async recordProfileOpen(input: {
    companyId: string;
    candidateId: string;
    campaignId?: string | null;
    actorUserId?: string;
    cost?: number;
  }): Promise<void> {
    const assignment = await this.settleExpiredPlan(input.companyId);
    if (!assignment?.plan || !assignment.isActive) return;

    const cost = input.cost != null && input.cost > 0 ? Math.floor(input.cost) : 1;
    const prefix = `open:${input.candidateId}`;
    const marker = cost > 1 ? `${prefix}:${cost}` : prefix;

    await this.prisma.huntCampaignActivity.create({
      data: {
        companyId: input.companyId,
        assignmentId: assignment.id,
        campaignId: input.campaignId ?? null,
        kind: 'profile_open',
        note: marker,
        createdBy: input.actorUserId && looksLikeUuid(input.actorUserId) ? input.actorUserId : null,
      },
    });
  }

  private remainingFor(kind: SourcingQuotaKind, e: RecruiterSourcingEntitlements): number | null {
    switch (kind) {
      case 'position':
        return e.positionsRemaining;
      case 'search_round':
        return e.searchRoundsRemaining;
      case 'shortlist':
        return e.shortlistsRemaining;
      case 'revision':
        return e.revisionsRemaining;
    }
  }

  private assertScope(plan: BillingSourcingPlan, kind: SourcingQuotaKind): void {
    const required = SCOPE_FOR_KIND[kind];
    if (!required) return;
    const scope = includedScopeCodes(parseSourcingScope(plan.serviceScope));
    if (scope.length === 0) return;
    if (required.some((s) => scope.includes(s))) return;
    throw new ForbiddenException({
      code: 'SOURCING_SCOPE_FORBIDDEN',
      message: `Gói ${plan.name} không gồm ${SOURCING_QUOTA_LABELS[kind].toLowerCase()}. Hãy nâng cấp gói Săn.`,
      kind,
      planCode: plan.code,
    });
  }

  /**
   * Chặn theo phạm vi của GÓI SĂN CỦA CHIẾN DỊCH (B3).
   *
   * Thay vì dùng scope của gói Săn đầu tiên (assignment.plan), mọi gate nghiệp vụ
   * phải dựa trên gói đang gắn với chiến dịch — cô lập 100% theo chiến dịch.
   */
  private assertCampaignScope(pkg: BillingHuntPackage, kind: SourcingQuotaKind): void {
    const required = SCOPE_FOR_KIND[kind];
    if (!required) return;
    const scope = PACKAGE_SCOPE[pkg.packageType] ?? [];
    if (scope.length === 0) return;
    if (required.some((s) => scope.includes(s))) return;
    throw new ForbiddenException({
      code: 'SOURCING_SCOPE_FORBIDDEN',
      message: `Gói ${pkg.packageName} không gồm ${SOURCING_QUOTA_LABELS[kind].toLowerCase()}. Hãy nâng cấp gói Săn.`,
      kind,
      packageCode: pkg.code,
    });
  }

  private defaultNote(kind: SourcingQuotaKind): string {
    switch (kind) {
      case 'position':
        return 'Mở vị trí Săn';
      case 'search_round':
        return 'Xuất báo cáo tiến độ';
      case 'shortlist':
        return 'Giao shortlist';
      case 'revision':
        return 'Yêu cầu điều chỉnh';
    }
  }

  private remaining(quota: number | null, used: number): number | null {
    if (quota == null) return null;
    return Math.max(0, quota - used);
  }

  /**
   * Hết hạn mà không gia hạn thì tắt gói Săn và đưa hạn mức đã dùng về 0.
   *
   * ⚠ Vòng đời gói Săn KHÔNG còn bị gắn với `assignment.endsAt`:
   * mỗi gói Săn có hạn riêng (`BillingHuntPackage.expiresAt`) và 1-1 với chiến dịch.
   * Vì vậy chỉ tắt assignment khi KHÔNG còn gói Săn nào đang chạy và không còn
   * chiến dịch hợp lệ — để gói mới mua / chiến dịch mới không bị giết oan.
   */
  private async settleExpiredPlan(companyId: string) {
    const row = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!row?.plan || !row.isActive) return row;
    const nowMs = Date.now();
    // Đang bảo lưu (chưa kích hoạt Tin Săn đầu tiên): chỉ hết hạn khi quá 365 ngày bảo lưu.
    if (!row.activatedAt && row.reserveEndsAt) {
      if (row.reserveEndsAt.getTime() > nowMs) return row;
      // Vẫn còn gói Săn chờ kích hoạt (UNUSED) → giữ assignment hoạt động.
      const unusedLeft = await this.prisma.billingHuntPackage.count({
        where: { companyId, status: 'UNUSED' },
      });
      if (unusedLeft > 0) return row;
      return this.prisma.billingCompanySourcingPlan.update({
        where: { companyId },
        data: {
          isActive: false,
          positionsUsed: 0,
          searchRoundsUsed: 0,
          shortlistsUsed: 0,
          revisionsUsed: 0,
          note: 'Gói Săn hết hạn bảo lưu 365 ngày chưa sử dụng',
        },
        include: { plan: true },
      });
    }
    if (!row.endsAt || row.endsAt.getTime() > nowMs) return row;

    // Chu kỳ cấp gói đã kết thúc, nhưng còn gói Săn đang chạy / chiến dịch còn hiệu lực
    // → KHÔNG tắt assignment (chỉ mất quyền tạo chiến dịch mới khi hết gói).
    const [activePackages, validCampaigns] = await Promise.all([
      this.prisma.billingHuntPackage.count({
        where: {
          companyId,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
      }),
      this.prisma.huntCampaign.count({
        where: { companyId, assignmentId: row.id, status: { not: 'closed' } },
      }),
    ]);
    if (activePackages > 0 || validCampaigns > 0) return row;

    return this.prisma.billingCompanySourcingPlan.update({
      where: { companyId },
      data: {
        isActive: false,
        positionsUsed: 0,
        searchRoundsUsed: 0,
        shortlistsUsed: 0,
        revisionsUsed: 0,
        note: 'Gói Săn hết hạn và không gia hạn',
      },
      include: { plan: true },
    });
  }

  private cycleOpen(endsAt: Date | null): boolean {
    return !endsAt || endsAt.getTime() >= Date.now();
  }

  private parseOpenUsageCost(note: string | null | undefined): number {
    if (!note) return 1;
    const parts = note.split(':');
    if (parts.length >= 3) {
      const parsed = Number(parts[2]);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
    return 1;
  }

  private async countIncludedOpens(assignmentId: string, startsAt: Date): Promise<number> {
    const rows = await this.prisma.huntCampaignActivity.findMany({
      where: { assignmentId, kind: 'profile_open', createdAt: { gte: startsAt } },
      select: { note: true },
    });
    return rows.reduce((sum, r) => sum + this.parseOpenUsageCost(r.note), 0);
  }

  private async countOutreachUsed(assignmentId: string, startsAt: Date): Promise<number> {
    return this.prisma.huntCampaignActivity.count({
      where: {
        assignmentId,
        kind: 'shortlist',
        note: { startsWith: 'outreach:' },
        createdAt: { gte: startsAt },
      },
    });
  }

  private async countShortlistBookmarks(assignmentId: string, startsAt: Date): Promise<number> {
    return this.prisma.huntCampaignActivity.count({
      where: {
        assignmentId,
        kind: 'shortlist',
        note: { startsWith: 'shortlist:' },
        createdAt: { gte: startsAt },
      },
    });
  }

  private toEntitlements(
    row: BillingCompanySourcingPlan & { plan: BillingSourcingPlan },
    primaryPkg: BillingHuntPackage | null,
    profileOpensUsed = 0,
    outreachUsed = 0,
    unusedPackages = 0,
  ): RecruiterSourcingEntitlements {
    const plan = row.plan;
    const scopeItems = parseSourcingScope(plan.serviceScope);
    const scopeCodes = includedScopeCodes(scopeItems);
    const hasOutreach =
      scopeCodes.includes('outreach') ||
      plan.code === 'SAN_CHUYEN_SAU' ||
      (plan.shortlistQuota != null && plan.shortlistQuota > 0);
    const positionQuota =
      plan.positionQuota != null ? plan.positionQuota + (row.extraPositionQuota ?? 0) : null;
    const searchRoundQuota =
      plan.searchRoundQuota != null
        ? plan.searchRoundQuota + (row.extraSearchRoundQuota ?? 0)
        : null;
    const shortlistQuota =
      plan.shortlistQuota != null ? plan.shortlistQuota + (row.extraShortlistQuota ?? 0) : null;
    const revisionQuota =
      plan.revisionQuota != null ? plan.revisionQuota + (row.extraRevisionQuota ?? 0) : null;
    const creditQuota =
      plan.creditQuota != null ? plan.creditQuota + (row.extraCreditQuota ?? 0) : null;
    const outreachQuota = hasOutreach ? (shortlistQuota ?? 15) : 0;
    const outreachRemaining = hasOutreach ? Math.max(0, outreachQuota - outreachUsed) : 0;
    return {
      assignment: this.mapAssignment(row),
      planCode: plan.code,
      planName: plan.name,
      feeVnd: plan.feeVnd.toString(),
      serviceScope: scopeCodes,
      scopeItems,
      positionQuota,
      searchRoundQuota,
      shortlistQuota,
      revisionQuota,
      creditQuota,
      positionsUsed: row.positionsUsed,
      searchRoundsUsed: row.searchRoundsUsed,
      shortlistsUsed: row.shortlistsUsed,
      revisionsUsed: row.revisionsUsed,
      profileOpensUsed,
      // Số vị trí còn mở = số gói Săn CHỜ kích hoạt (UNUSED) — 1 gói = 1 chiến dịch.
      // KHÔNG dựa vào `assignment.endsAt` (hạn chu kỳ) để tránh chặn nhầm gói mới.
      positionsRemaining: positionQuota == null ? null : unusedPackages,
      searchRoundsRemaining: this.remaining(searchRoundQuota, row.searchRoundsUsed),
      shortlistsRemaining: this.remaining(shortlistQuota, row.shortlistsUsed),
      revisionsRemaining: this.remaining(revisionQuota, row.revisionsUsed),
      profileOpensRemaining: this.remaining(creditQuota, profileOpensUsed),
      outreachQuota,
      outreachUsed,
      outreachRemaining,
    };
  }

  private mapAssignment(
    row: BillingCompanySourcingPlan & { plan: BillingSourcingPlan },
  ): BillingCompanySourcingPlanView {
    return {
      id: row.id,
      companyId: row.companyId,
      planId: row.planId,
      planCode: row.plan.code,
      planName: row.plan.name,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      reserveEndsAt: row.reserveEndsAt?.toISOString() ?? null,
      isActive: row.isActive,
      note: row.note,
      extraPositionQuota: row.extraPositionQuota ?? 0,
      extraSearchRoundQuota: row.extraSearchRoundQuota ?? 0,
      extraShortlistQuota: row.extraShortlistQuota ?? 0,
      extraRevisionQuota: row.extraRevisionQuota ?? 0,
      extraCreditQuota: row.extraCreditQuota ?? 0,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapCampaign(
    c: HuntCampaign & { package: BillingHuntPackage },
  ): RecruiterHuntCampaignView {
    return {
      id: c.id,
      code: c.code,
      companyId: c.companyId,
      assignmentId: c.assignmentId,
      huntPackageId: c.huntPackageId,
      jobId: c.jobId,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      packageCode: c.package.code,
      packageName: c.package.packageName,
      packageType: c.package.packageType as HuntPackageType,
      packageStatus: c.package.status as RecruiterHuntCampaignView['packageStatus'],
      expiresAt: c.package.expiresAt?.toISOString() ?? null,
    };
  }

  private mapUsage(u: {
    id: string;
    kind: string;
    campaignId: string | null;
    jobId: string | null;
    note: string | null;
    createdAt: Date;
  }): RecruiterSourcingUsageView {
    let displayNote = u.note;
    if (u.kind === 'auto_scan' && u.note) {
      const parsed = this.parseScanRound(u);
      if (parsed) {
        const newBadge =
          parsed.newCount > 0 ? ` (+${parsed.newCount} ứng viên mới)` : ' (chưa có ứng viên mới)';
        const mailBadge = parsed.emailSent ? ' · Đã gửi thông báo Email' : '';
        displayNote = `Đợt tìm #${parsed.roundNumber} · ${parsed.totalMatched} ứng viên phù hợp${newBadge}${mailBadge}`;
      }
    } else if (u.kind === 'shortlist' && u.note?.startsWith('outreach:')) {
      const parts = u.note.split(':');
      const candName = parts[2]?.trim() || 'Ứng viên';
      const customNote = parts.slice(3).join(':').trim();
      displayNote = `Giao Inlink liên hệ · Ứng viên «${candName}»${customNote ? ` (${customNote})` : ''} — Đội CSKH Inlink tiếp nhận liên hệ & mở khóa hồ sơ`;
    } else if (u.kind === 'shortlist' && u.note?.startsWith('shortlist:')) {
      const parts = u.note.split(':');
      const candName = parts.slice(2).join(':').trim() || 'Ứng viên';
      displayNote = `Đưa ứng viên «${candName}» vào Shortlist`;
    } else if (u.kind === 'search_round' && u.note?.startsWith('report:')) {
      const parsed = this.parseReport(u);
      if (parsed) {
        displayNote = `Báo cáo tiến độ #${parsed.reportNumber} · ${parsed.title} (${parsed.highMatchCount} ứng viên ≥80%, ${parsed.shortlistedCount} Shortlist)`;
      }
    }
    return {
      id: u.id,
      kind: u.kind as SourcingUsageKind,
      campaignId: u.campaignId,
      jobId: u.jobId,
      note: displayNote,
      createdAt: u.createdAt.toISOString(),
    };
  }

  private parseScanRound(u: {
    id: string;
    campaignId: string | null;
    jobId: string | null;
    note: string | null;
    createdAt: Date;
  }): RecruiterSourcingScanRoundView | null {
    if (!u.campaignId || !u.note) return null;
    try {
      const raw = JSON.parse(u.note) as {
        roundNumber?: number;
        trigger?: 'initial' | 'cron' | 'manual';
        totalMatched?: number;
        newCount?: number;
        emailSent?: boolean;
        candidates?: RecruiterSourcingScanCandidateItem[];
      };
      const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
      return {
        id: u.id,
        campaignId: u.campaignId,
        jobId: u.jobId,
        roundNumber: typeof raw.roundNumber === 'number' && raw.roundNumber > 0 ? raw.roundNumber : 1,
        trigger: raw.trigger ?? 'cron',
        totalMatched: typeof raw.totalMatched === 'number' ? raw.totalMatched : candidates.length,
        newCount: typeof raw.newCount === 'number' ? raw.newCount : 0,
        emailSent: Boolean(raw.emailSent),
        createdAt: u.createdAt.toISOString(),
        candidates,
      };
    } catch {
      return null;
    }
  }

  private parseReport(u: {
    id: string;
    campaignId: string | null;
    jobId: string | null;
    note: string | null;
    createdAt: Date;
  }): RecruiterSourcingReportView | null {
    if (!u.note?.startsWith('report:')) return null;
    try {
      const raw = JSON.parse(u.note.slice('report:'.length)) as Partial<RecruiterSourcingReportView>;
      return {
        id: u.id,
        campaignId: u.campaignId,
        jobId: u.jobId,
        reportNumber: typeof raw.reportNumber === 'number' && raw.reportNumber > 0 ? raw.reportNumber : 1,
        title: raw.title || 'Báo cáo tiến độ Săn nhân sự',
        totalScanned: Number(raw.totalScanned ?? 0),
        highMatchCount: Number(raw.highMatchCount ?? 0),
        mediumMatchCount: Number(raw.mediumMatchCount ?? 0),
        openedCount: Number(raw.openedCount ?? 0),
        shortlistedCount: Number(raw.shortlistedCount ?? 0),
        appliedCount: Number(raw.appliedCount ?? 0),
        bottlenecks: Array.isArray(raw.bottlenecks) ? raw.bottlenecks : [],
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
        createdAt: u.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  private async writeAudit(
    actor: AuthenticatedUser,
    entity: string,
    entityKey: string,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
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
}
