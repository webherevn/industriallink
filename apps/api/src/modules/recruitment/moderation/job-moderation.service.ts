import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DomainEvents,
  JobModerationAction,
  JobModerationDecision,
  JobModerationStatus,
  JobStatus,
  UserStatus,
  type DecideJobModerationRequest,
  type JobModerationQueueItem,
  type JobModerationQueuePage,
} from '@industriallink/contracts';
import type { Prisma } from '@prisma/client';
import { createDomainEvent } from '../../../shared/domain/domain-event';
import { AppEventBus } from '../../../shared/events/event-bus';
import { AuditService } from '../../../shared/infrastructure/audit.service';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../../shared/security/security.types';
import { AiGatewayService } from '../../ai/ai-gateway.service';
import { JobService } from '../job.service';
import { runJobStaticFilter } from './job-static-filter';
import type { JobModerationJobData } from './job-moderation.constants';

/** Điểm cộng/trừ tín nhiệm công ty. */
const TRUST_DELTA_VALID_JOB = 1;
const TRUST_DELTA_REPORTED = 10;
const TRUST_MIN = 0;
const TRUST_MAX = 100;

const MODERATION_QUEUE_SELECT = {
  id: true,
  code: true,
  title: true,
  slug: true,
  description: true,
  status: true,
  companyId: true,
  moderationStatus: true,
  aiRiskScore: true,
  aiReason: true,
  aiIsB2b: true,
  aiSuggestedAction: true,
  moderationNote: true,
  createdAt: true,
  moderatedAt: true,
  createdBy: true,
  company: { select: { name: true, trustScore: true } },
} satisfies Prisma.JobSelect;

@Injectable()
export class JobModerationService {
  private readonly logger = new Logger(JobModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly jobs: JobService,
  ) {}

  /**
   * Worker gọi hàm này cho mỗi tin trong hàng đợi.
   * Lớp 1 (bộ lọc tĩnh) → Lớp 2 (Gemini) → cập nhật trạng thái.
   */
  async process(data: JobModerationJobData): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: { id: data.jobId, isDeleted: false },
      include: { company: { select: { name: true } } },
    });
    if (!job) {
      this.logger.warn(`Bỏ qua kiểm duyệt: không tìm thấy job ${data.jobId}`);
      return;
    }
    if (job.moderationStatus !== JobModerationStatus.Pending) {
      // Đã xử lý (idempotent) — tránh double publish khi retry.
      return;
    }

    // ---- Lớp 1: Bộ lọc tĩnh ----
    const staticResult = runJobStaticFilter({
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      benefits: job.benefits,
    });

    if (staticResult.blocked) {
      await this.finalizeReject(
        job.id,
        JobModerationStatus.RejectedAuto,
        `[Bộ lọc tĩnh] ${staticResult.reason}`,
        { riskScore: 100, action: JobModerationAction.Reject, isB2b: false },
      );
      this.logger.log(`Job ${job.code} bị chặn bởi bộ lọc tĩnh: ${staticResult.reason}`);
      return;
    }

    // ---- Lớp 2: Gemini ----
    let ai;
    try {
      ai = await this.ai.moderateJobPosting({
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits,
        companyName: job.company?.name,
        staticFilterNote: staticResult.reason || null,
      });
    } catch (err) {
      // Gemini lỗi/hết hạn mức → không auto-publish, đẩy sang duyệt tay.
      this.logger.warn(`Gemini kiểm duyệt job ${job.code} lỗi, chuyển duyệt tay: ${String(err)}`);
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          moderationStatus: JobModerationStatus.NeedsManualReview,
          aiReason: 'AI tạm thời không phản hồi, cần duyệt tay.',
          moderationNote: staticResult.reason || null,
          moderatedAt: new Date(),
        },
      });
      this.emitModerated(job.id, job.tenantId, JobModerationStatus.NeedsManualReview, data.correlationId);
      return;
    }

    const noteBits = [staticResult.reason].filter(Boolean);
    if (staticResult.contactLinks.length) {
      noteBits.push('Cần xoá link Telegram/Zalo trước khi đăng.');
    }
    const moderationNote = noteBits.join(' ') || null;

    if (ai.suggested_action === JobModerationAction.Publish) {
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          moderationStatus: JobModerationStatus.ApprovedAuto,
          status: JobStatus.Published,
          publishedAt: job.publishedAt ?? new Date(),
          aiRiskScore: ai.risk_score,
          aiReason: ai.reason,
          aiIsB2b: ai.is_b2b,
          aiSuggestedAction: ai.suggested_action,
          moderationNote,
          moderatedAt: new Date(),
        },
      });
      await this.jobs.applyPublishSideEffects(job.id, data.correlationId);
      await this.bumpTrust(job.companyId, TRUST_DELTA_VALID_JOB);
      this.emitModerated(job.id, job.tenantId, JobModerationStatus.ApprovedAuto, data.correlationId);
      this.logger.log(`Job ${job.code} tự động duyệt (risk=${ai.risk_score}).`);
      return;
    }

    if (ai.suggested_action === JobModerationAction.Reject) {
      await this.finalizeReject(job.id, JobModerationStatus.RejectedAuto, moderationNote, {
        riskScore: ai.risk_score,
        action: ai.suggested_action,
        isB2b: ai.is_b2b,
        reason: ai.reason,
      });
      this.emitModerated(job.id, job.tenantId, JobModerationStatus.RejectedAuto, data.correlationId);
      this.logger.log(`Job ${job.code} bị AI từ chối (risk=${ai.risk_score}).`);
      return;
    }

    // MANUAL_REVIEW
    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        moderationStatus: JobModerationStatus.NeedsManualReview,
        aiRiskScore: ai.risk_score,
        aiReason: ai.reason,
        aiIsB2b: ai.is_b2b,
        aiSuggestedAction: ai.suggested_action,
        moderationNote,
        moderatedAt: new Date(),
      },
    });
    this.emitModerated(job.id, job.tenantId, JobModerationStatus.NeedsManualReview, data.correlationId);
    this.logger.log(`Job ${job.code} chờ duyệt tay (risk=${ai.risk_score}).`);
  }

  /** Danh sách hàng đợi cho SuperAdmin (mặc định: cần duyệt tay). */
  async listQueue(params: {
    status?: JobModerationStatus;
    limit?: number;
  } = {}): Promise<JobModerationQueuePage> {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const status = params.status ?? JobModerationStatus.NeedsManualReview;

    const [rows, total, grouped] = await Promise.all([
      this.prisma.job.findMany({
        where: { isDeleted: false, moderationStatus: status },
        orderBy: [{ aiRiskScore: 'desc' }, { createdAt: 'asc' }],
        take,
        select: MODERATION_QUEUE_SELECT,
      }),
      this.prisma.job.count({ where: { isDeleted: false, moderationStatus: status } }),
      this.prisma.job.groupBy({
        by: ['moderationStatus'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
    ]);

    const submitterIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] as string[];
    const submitters = submitterIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(submitters.map((u) => [u.id, u.email]));

    const countOf = (s: JobModerationStatus): number =>
      grouped.find((g) => g.moderationStatus === s)?._count._all ?? 0;

    return {
      items: rows.map((r) => this.toQueueItem(r, emailById)),
      total,
      counts: {
        pending: countOf(JobModerationStatus.Pending),
        needsManualReview: countOf(JobModerationStatus.NeedsManualReview),
        rejectedAuto: countOf(JobModerationStatus.RejectedAuto),
        approvedAuto: countOf(JobModerationStatus.ApprovedAuto),
      },
    };
  }

  /** SuperAdmin quyết định: duyệt / từ chối / khoá tài khoản người đăng. */
  async decide(
    admin: AuthenticatedUser,
    jobId: string,
    dto: DecideJobModerationRequest,
    correlationId: string,
  ): Promise<JobModerationQueueItem> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, isDeleted: false },
      select: MODERATION_QUEUE_SELECT,
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');

    if (dto.decision === JobModerationDecision.Approve) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          moderationStatus: JobModerationStatus.ApprovedManual,
          status: JobStatus.Published,
          publishedAt: new Date(),
          moderatedBy: admin.id,
          moderatedAt: new Date(),
          ...(dto.note ? { moderationNote: dto.note } : {}),
        },
      });
      await this.jobs.applyPublishSideEffects(jobId, correlationId);
      await this.bumpTrust(job.companyId, TRUST_DELTA_VALID_JOB);
    } else if (dto.decision === JobModerationDecision.Reject) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          moderationStatus: JobModerationStatus.RejectedManual,
          status: JobStatus.Draft,
          moderatedBy: admin.id,
          moderatedAt: new Date(),
          ...(dto.note ? { moderationNote: dto.note } : {}),
        },
      });
    } else if (dto.decision === JobModerationDecision.BanUser) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          moderationStatus: JobModerationStatus.RejectedManual,
          status: JobStatus.Closed,
          moderatedBy: admin.id,
          moderatedAt: new Date(),
          moderationNote: dto.note || 'Khoá tài khoản người đăng do vi phạm.',
        },
      });
      if (job.createdBy) {
        await this.prisma.user.update({
          where: { id: job.createdBy },
          data: { status: UserStatus.Locked, updatedBy: admin.id },
        });
      }
      await this.bumpTrust(job.companyId, -TRUST_DELTA_REPORTED);
    } else {
      throw new ForbiddenException('Quyết định không hợp lệ');
    }

    await this.audit.record({
      tenantId: admin.tenantId,
      actorId: admin.id,
      action: `job.moderation.${dto.decision}`,
      entityType: 'job',
      entityId: jobId,
      after: { decision: dto.decision, note: dto.note ?? null },
      correlationId,
    });
    this.emitModerated(jobId, admin.tenantId, JobModerationStatus.ApprovedManual, correlationId);

    const fresh = await this.prisma.job.findFirst({
      where: { id: jobId },
      select: MODERATION_QUEUE_SELECT,
    });
    const email = job.createdBy
      ? (await this.prisma.user.findUnique({
          where: { id: job.createdBy },
          select: { email: true },
        }))?.email ?? null
      : null;
    return this.toQueueItem(fresh ?? job, new Map(job.createdBy ? [[job.createdBy, email ?? '']] : []));
  }

  // ---- Helpers ----

  private async finalizeReject(
    jobId: string,
    status: JobModerationStatus,
    note: string | null,
    ai: {
      riskScore: number;
      action: JobModerationAction;
      isB2b: boolean;
      reason?: string;
    },
  ): Promise<void> {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        moderationStatus: status,
        status: JobStatus.Draft,
        aiRiskScore: ai.riskScore,
        aiReason: ai.reason ?? note ?? 'Bị chặn tự động.',
        aiIsB2b: ai.isB2b,
        aiSuggestedAction: ai.action,
        moderationNote: note,
        moderatedAt: new Date(),
      },
    });
  }

  private async bumpTrust(companyId: string, delta: number): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { trustScore: true },
    });
    if (!company) return;
    const next = Math.min(TRUST_MAX, Math.max(TRUST_MIN, company.trustScore + delta));
    await this.prisma.company.update({
      where: { id: companyId },
      data: { trustScore: next },
    });
  }

  private emitModerated(
    jobId: string,
    tenantId: string,
    status: JobModerationStatus,
    correlationId: string,
  ): void {
    this.events.publish(
      createDomainEvent({
        name: DomainEvents.JobModerated,
        tenantId,
        correlationId,
        payload: { jobId, moderationStatus: status },
      }),
    );
  }

  private toQueueItem(
    row: Prisma.JobGetPayload<{ select: typeof MODERATION_QUEUE_SELECT }>,
    emailById: Map<string, string>,
  ): JobModerationQueueItem {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      slug: row.slug,
      description: row.description,
      companyId: row.companyId,
      companyName: row.company?.name ?? '',
      companyTrustScore: row.company?.trustScore ?? 0,
      status: row.status as JobStatus,
      moderationStatus: row.moderationStatus as JobModerationStatus,
      aiRiskScore: row.aiRiskScore,
      aiReason: row.aiReason,
      aiIsB2b: row.aiIsB2b,
      aiSuggestedAction: (row.aiSuggestedAction as JobModerationAction | null) ?? null,
      moderationNote: row.moderationNote,
      createdAt: row.createdAt.toISOString(),
      moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
      submittedByUserId: row.createdBy ?? null,
      submittedByEmail: row.createdBy ? emailById.get(row.createdBy) ?? null : null,
    };
  }
}
