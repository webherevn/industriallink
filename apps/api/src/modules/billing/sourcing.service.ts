import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  BillingCompanySourcingPlan,
  BillingSourcingEngagement,
  BillingSourcingPlan,
  Prisma,
} from '@prisma/client';
import {
  SOURCING_QUOTA_LABELS,
  type AdminAssignCompanySourcingPlanRequest,
  type RecruiterConsumeSourcingRequest,
  type RecruiterSourcingEngagementView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingUsageView,
  type RecruiterSourcingWorkspace,
  type SourcingQuotaKind,
  type BillingCompanySourcingPlanView,
} from '@industriallink/contracts';
import { looksLikeUuid } from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

const SCOPE_FOR_KIND: Record<SourcingQuotaKind, string[] | null> = {
  position: null,
  search_round: null,
  shortlist: ['shortlist'],
  revision: null,
};

const USED_FIELD: Record<SourcingQuotaKind, keyof BillingCompanySourcingPlan> = {
  position: 'positionsUsed',
  search_round: 'searchRoundsUsed',
  shortlist: 'shortlistsUsed',
  revision: 'revisionsUsed',
};

@Injectable()
export class SourcingService {
  private readonly logger = new Logger(SourcingService.name);

  constructor(private readonly prisma: PrismaService) {}

  emptyEntitlements(): RecruiterSourcingEntitlements {
    return {
      assignment: null,
      planCode: null,
      planName: null,
      feeVnd: null,
      serviceScope: [],
      positionQuota: null,
      searchRoundQuota: null,
      shortlistQuota: null,
      revisionQuota: null,
      positionsUsed: 0,
      searchRoundsUsed: 0,
      shortlistsUsed: 0,
      revisionsUsed: 0,
      positionsRemaining: 0,
      searchRoundsRemaining: 0,
      shortlistsRemaining: 0,
      revisionsRemaining: 0,
    };
  }

  async getEntitlements(companyId: string): Promise<RecruiterSourcingEntitlements> {
    const row = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    if (!row?.plan || !row.isActive) return this.emptyEntitlements();
    return this.toEntitlements(row);
  }

  async getWorkspace(companyId: string): Promise<RecruiterSourcingWorkspace> {
    const entitlements = await this.getEntitlements(companyId);
    const assignmentId = entitlements.assignment?.id;
    if (!assignmentId) {
      return { entitlements, engagements: [], usages: [] };
    }
    const [engagements, usages] = await Promise.all([
      this.prisma.billingSourcingEngagement.findMany({
        where: { companyId, assignmentId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.billingSourcingUsage.findMany({
        where: { companyId, assignmentId },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
    ]);
    return {
      entitlements,
      engagements: engagements.map((e) => this.mapEngagement(e)),
      usages: usages.map((u) => this.mapUsage(u)),
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
  ): Promise<BillingCompanySourcingPlanView> {
    const plan = await this.prisma.billingSourcingPlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundException('Không tìm thấy gói Săn');

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const endsAt = input.endsAt === undefined ? null : input.endsAt ? new Date(input.endsAt) : null;
    const actorId = looksLikeUuid(actor.id) ? actor.id : null;
    const before = await this.prisma.billingCompanySourcingPlan.findUnique({
      where: { companyId: input.companyId },
    });
    const switching = !before || before.planId !== input.planId || !before.isActive;

    const row = await this.prisma.billingCompanySourcingPlan.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        planId: input.planId,
        startsAt,
        endsAt,
        isActive: input.isActive ?? true,
        note: input.note ?? 'Kích hoạt gói Săn nhân sự',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        planId: input.planId,
        startsAt: switching ? startsAt : undefined,
        endsAt,
        isActive: input.isActive ?? true,
        note: input.note ?? 'Kích hoạt gói Săn nhân sự',
        updatedBy: actorId,
        ...(switching
          ? { positionsUsed: 0, searchRoundsUsed: 0, shortlistsUsed: 0, revisionsUsed: 0 }
          : {}),
      },
      include: { plan: true },
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

  async activatePurchasedPlan(
    actor: AuthenticatedUser,
    companyId: string,
    planCode: string,
  ): Promise<BillingCompanySourcingPlanView> {
    const plan = await this.prisma.billingSourcingPlan.findFirst({
      where: { code: planCode, isActive: true },
    });
    if (!plan) throw new NotFoundException('Không tìm thấy gói Săn hoặc gói đã tắt');
    return this.assignCompanyPlan(actor, {
      companyId,
      planId: plan.id,
      isActive: true,
      note: `Kích hoạt gói ${plan.name} sau thanh toán / duyệt`,
    });
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

      this.assertScope(assignment.plan, kind);
      const entitlements = this.toEntitlements(assignment);
      const remaining = this.remainingFor(kind, entitlements);
      if (remaining !== null && remaining <= 0) {
        throw new ForbiddenException({
          code: 'SOURCING_QUOTA_EXCEEDED',
          message: `Gói ${assignment.plan.name} đã hết ${SOURCING_QUOTA_LABELS[kind].toLowerCase()}. Hãy nâng cấp gói Săn.`,
          kind,
          planCode: assignment.plan.code,
        });
      }

      const actorId = looksLikeUuid(actor.id) ? actor.id : null;
      let engagementId = input.engagementId ?? null;

      if (kind === 'position') {
        const title = input.title?.trim() || (input.jobId ? 'Vị trí theo tin đăng' : 'Vị trí Săn mới');
        const engagement = await tx.billingSourcingEngagement.create({
          data: {
            companyId,
            assignmentId: assignment.id,
            jobId: input.jobId && looksLikeUuid(input.jobId) ? input.jobId : null,
            title,
            status: 'open',
            createdBy: actorId,
          },
        });
        engagementId = engagement.id;
      } else {
        if (!engagementId) {
          throw new BadRequestException('Chọn vị trí Săn đang mở để ghi đợt tìm / shortlist / điều chỉnh');
        }
        const engagement = await tx.billingSourcingEngagement.findFirst({
          where: { id: engagementId, companyId, assignmentId: assignment.id },
        });
        if (!engagement) throw new NotFoundException('Không tìm thấy vị trí Săn');
        if (engagement.status === 'closed') {
          throw new BadRequestException('Vị trí Săn đã đóng');
        }
        if (kind === 'search_round' && engagement.status === 'open') {
          await tx.billingSourcingEngagement.update({
            where: { id: engagement.id },
            data: { status: 'in_progress' },
          });
        }
        if (kind === 'shortlist') {
          await tx.billingSourcingEngagement.update({
            where: { id: engagement.id },
            data: { status: 'shortlisted' },
          });
        }
      }

      const field = USED_FIELD[kind];
      await tx.billingCompanySourcingPlan.update({
        where: { id: assignment.id },
        data: { [field]: { increment: 1 }, updatedBy: actorId },
      });
      await tx.billingSourcingUsage.create({
        data: {
          companyId,
          assignmentId: assignment.id,
          engagementId,
          kind,
          jobId: input.jobId && looksLikeUuid(input.jobId) ? input.jobId : null,
          note: input.note?.trim() || this.defaultNote(kind),
          createdBy: actorId,
        },
      });
    });

    return this.getWorkspace(companyId);
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
    const scope = (plan.serviceScope as string[]) ?? [];
    if (scope.length === 0) return;
    if (required.some((s) => scope.includes(s))) return;
    throw new ForbiddenException({
      code: 'SOURCING_SCOPE_FORBIDDEN',
      message: `Gói ${plan.name} không gồm ${SOURCING_QUOTA_LABELS[kind].toLowerCase()}. Hãy nâng cấp gói Săn.`,
      kind,
      planCode: plan.code,
    });
  }

  private defaultNote(kind: SourcingQuotaKind): string {
    switch (kind) {
      case 'position':
        return 'Mở vị trí Săn';
      case 'search_round':
        return 'Ghi nhận 1 đợt tìm';
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

  private toEntitlements(
    row: BillingCompanySourcingPlan & { plan: BillingSourcingPlan },
  ): RecruiterSourcingEntitlements {
    const plan = row.plan;
    return {
      assignment: this.mapAssignment(row),
      planCode: plan.code,
      planName: plan.name,
      feeVnd: plan.feeVnd.toString(),
      serviceScope: (plan.serviceScope as string[]) ?? [],
      positionQuota: plan.positionQuota,
      searchRoundQuota: plan.searchRoundQuota,
      shortlistQuota: plan.shortlistQuota,
      revisionQuota: plan.revisionQuota,
      positionsUsed: row.positionsUsed,
      searchRoundsUsed: row.searchRoundsUsed,
      shortlistsUsed: row.shortlistsUsed,
      revisionsUsed: row.revisionsUsed,
      positionsRemaining: this.remaining(plan.positionQuota, row.positionsUsed),
      searchRoundsRemaining: this.remaining(plan.searchRoundQuota, row.searchRoundsUsed),
      shortlistsRemaining: this.remaining(plan.shortlistQuota, row.shortlistsUsed),
      revisionsRemaining: this.remaining(plan.revisionQuota, row.revisionsUsed),
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
      isActive: row.isActive,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapEngagement(e: BillingSourcingEngagement): RecruiterSourcingEngagementView {
    return {
      id: e.id,
      companyId: e.companyId,
      assignmentId: e.assignmentId,
      jobId: e.jobId,
      title: e.title,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    };
  }

  private mapUsage(u: {
    id: string;
    kind: string;
    engagementId: string | null;
    jobId: string | null;
    note: string | null;
    createdAt: Date;
  }): RecruiterSourcingUsageView {
    return {
      id: u.id,
      kind: u.kind as SourcingQuotaKind,
      engagementId: u.engagementId,
      jobId: u.jobId,
      note: u.note,
      createdAt: u.createdAt.toISOString(),
    };
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
