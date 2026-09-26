import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AdminJobAction,
  DomainEvents,
  JobModerationStatus,
  JobStatus,
  type AdminJobListItem,
  type AdminJobListPage,
  type AdminJobListQuery,
} from '@industriallink/contracts';
import type { Prisma } from '@prisma/client';
import { createDomainEvent } from '../../../shared/domain/domain-event';
import { AppEventBus } from '../../../shared/events/event-bus';
import { AuditService } from '../../../shared/infrastructure/audit.service';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { GoogleIndexingService } from '../../../shared/seo/google-indexing.service';
import type { AuthenticatedUser } from '../../../shared/security/security.types';
import { JobService } from '../job.service';

const APPROVED = new Set<string>([
  JobModerationStatus.ApprovedAuto,
  JobModerationStatus.ApprovedManual,
]);

const LIST_SELECT = {
  id: true,
  code: true,
  title: true,
  slug: true,
  industry: true,
  location: true,
  companyId: true,
  status: true,
  moderationStatus: true,
  aiRiskScore: true,
  aiReason: true,
  createdAt: true,
  publishedAt: true,
  moderatedAt: true,
  createdBy: true,
  company: { select: { name: true, trustScore: true } },
} satisfies Prisma.JobSelect;

@Injectable()
export class AdminJobsService {
  private readonly logger = new Logger(AdminJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly indexing: GoogleIndexingService,
  ) {}

  async list(query: AdminJobListQuery = {}): Promise<AdminJobListPage> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = { isDeleted: false };
    if (query.status) where.status = query.status;
    if (query.moderationStatus) where.moderationStatus = query.moderationStatus;
    if (query.companyId) where.companyId = query.companyId;
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [rows, total, statusGroups, modGroups, companies] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: LIST_SELECT,
      }),
      this.prisma.job.count({ where }),
      this.prisma.job.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.job.groupBy({
        by: ['moderationStatus'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.company.findMany({
        where: { jobs: { some: { isDeleted: false } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);

    const statusCount = (s: JobStatus) =>
      statusGroups.find((g) => g.status === s)?._count._all ?? 0;
    const modCount = (s: JobModerationStatus) =>
      modGroups.find((g) => g.moderationStatus === s)?._count._all ?? 0;

    const submitterIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] as string[];
    const submitters = submitterIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(submitters.map((u) => [u.id, u.email]));

    return {
      items: rows.map((r) => this.toItem(r, emailById)),
      total,
      page,
      limit,
      counts: {
        total: statusGroups.reduce((n, g) => n + g._count._all, 0),
        draft: statusCount(JobStatus.Draft),
        published: statusCount(JobStatus.Published),
        paused: statusCount(JobStatus.Paused),
        closed: statusCount(JobStatus.Closed),
        pending: modCount(JobModerationStatus.Pending),
        needsManualReview: modCount(JobModerationStatus.NeedsManualReview),
      },
      companies,
    };
  }

  async act(
    admin: AuthenticatedUser,
    jobId: string,
    action: AdminJobAction,
    correlationId: string,
    note?: string,
  ): Promise<AdminJobListItem> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, isDeleted: false },
      select: { ...LIST_SELECT, tenantId: true },
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');

    if (action === AdminJobAction.Hide) {
      if (job.status === JobStatus.Paused) {
        return this.reloadItem(job.id);
      }
      await this.setStatus(job.id, JobStatus.Paused, admin.id);
      if (job.status === JobStatus.Published) {
        void this.indexing.notifyJob(job, 'URL_DELETED');
      }
    } else if (action === AdminJobAction.Unhide) {
      if (job.status !== JobStatus.Paused) {
        throw new BadRequestException('Chỉ hiện lại được tin đang ẩn (tạm dừng).');
      }
      const canRestore = APPROVED.has(job.moderationStatus) || Boolean(job.publishedAt);
      if (!canRestore) {
        throw new BadRequestException('Tin chưa được duyệt — hãy đẩy lại hàng đợi kiểm duyệt.');
      }
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.Published,
          publishedAt: job.publishedAt ?? new Date(),
          updatedBy: admin.id,
        },
      });
      await this.jobs.applyPublishSideEffects(job.id, correlationId);
    } else if (action === AdminJobAction.Close) {
      if (job.status !== JobStatus.Closed) {
        await this.setStatus(job.id, JobStatus.Closed, admin.id);
        if (job.status === JobStatus.Published) {
          void this.indexing.notifyJob(job, 'URL_DELETED');
        }
      }
    } else if (action === AdminJobAction.Requeue) {
      const wasPublic = job.status === JobStatus.Published;
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.Draft,
          moderationStatus: JobModerationStatus.Pending,
          updatedBy: admin.id,
        },
      });
      await this.jobs.enqueueModeration(job.id, job.tenantId, correlationId, { unique: true });
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.JobSubmittedForModeration,
          tenantId: job.tenantId,
          correlationId,
          payload: { jobId: job.id, code: job.code, title: job.title, requeued: true },
        }),
      );
      if (wasPublic) void this.indexing.notifyJob(job, 'URL_DELETED');
    } else {
      throw new BadRequestException('Thao tác không hợp lệ');
    }

    await this.audit.record({
      tenantId: admin.tenantId,
      actorId: admin.id,
      action: `job.admin.${action}`,
      entityType: 'job',
      entityId: job.id,
      after: { action, note: note ?? null },
      correlationId,
    });
    this.logger.log(`SuperAdmin ${action} job ${job.code}`);
    return this.reloadItem(job.id);
  }

  private async setStatus(jobId: string, status: JobStatus, adminId: string): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status, updatedBy: adminId },
    });
  }

  private async reloadItem(jobId: string): Promise<AdminJobListItem> {
    const row = await this.prisma.job.findFirst({
      where: { id: jobId },
      select: LIST_SELECT,
    });
    if (!row) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const email = row.createdBy
      ? (
          await this.prisma.user.findUnique({
            where: { id: row.createdBy },
            select: { email: true },
          })
        )?.email ?? null
      : null;
    return this.toItem(row, new Map(row.createdBy ? [[row.createdBy, email ?? '']] : []));
  }

  private toItem(
    row: Prisma.JobGetPayload<{ select: typeof LIST_SELECT }>,
    emailById: Map<string, string>,
  ): AdminJobListItem {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      slug: row.slug,
      industry: row.industry,
      location: row.location,
      companyId: row.companyId,
      companyName: row.company?.name ?? '',
      companyTrustScore: row.company?.trustScore ?? 0,
      status: row.status as JobStatus,
      moderationStatus: row.moderationStatus as JobModerationStatus,
      aiRiskScore: row.aiRiskScore,
      aiReason: row.aiReason,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
      submittedByEmail: row.createdBy ? emailById.get(row.createdBy) ?? null : null,
    };
  }
}
