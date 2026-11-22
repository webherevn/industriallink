import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  DomainEvents,
  includedScopeCodes,
  InterviewStatus,
  InterviewType,
  JobStatus,
  OfferStatus,
  parseSourcingScope,
  type ApplicantView,
  type ApplicationDetailView,
  type ApplicationSource,
  type ApplicationView,
  type InboxApplicantView,
  type RecruiterWorkspaceSummary,
  type RecruitmentReportFunnelStep,
  type RecruitmentReportJobRow,
  type RecruitmentReportTrendPoint,
  type RecruitmentReportView,
} from '@industriallink/contracts';
import { applicationStatusLabel } from '../../shared/domain/application-status.label';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { isVnDeadlineStillOpen } from '../../shared/domain/vn-date.util';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { buildBroadcastEmail } from '../../shared/infrastructure/email/broadcast-email.templates';
import { EmailService } from '../../shared/infrastructure/email/email.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { maskEmail } from '../../shared/domain/contact-mask.util';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { CompanyService } from '../company/company.service';
import {
  broadcastPurposeLabel,
  localBroadcastDraft,
  parseBroadcastDraft,
  stripCompanyFromSubject,
  type BroadcastEmailPurpose,
} from './broadcast-email-suggest';
import { JobService } from './job.service';
import {
  PROFILE_OPEN_ACTIONS,
  resolveApplicationSource,
} from './application-source.util';
import { candidateMatchTrack, jobMatchTrack } from './match-track.util';
import { CANDIDATE_MATCH_INCLUDE, MatchingService } from './matching.service';
import { skillOverlap } from './matching.util';
import type { ApplyJobDto, UpdateApplicationStatusDto } from './dto/apply-job.dto';
import type { BroadcastEmailDto } from './dto/broadcast-email.dto';
import type { SuggestBroadcastEmailDto } from './dto/suggest-broadcast-email.dto';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly jobs: JobService,
    private readonly matching: MatchingService,
    private readonly companies: CompanyService,
    private readonly email: EmailService,
    private readonly ai: AiGatewayService,
  ) {}

  async apply(
    user: AuthenticatedUser,
    jobId: string,
    dto: ApplyJobDto,
    correlationId: string,
  ): Promise<ApplicationView> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: { profile: { select: { jobTrack: true } } },
    });
    if (!candidate) {
      throw new BadRequestException('Chỉ ứng viên mới có thể ứng tuyển');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { company: { select: { name: true, status: true, isDeleted: true } } },
    });
    if (!job || job.isDeleted || job.company.isDeleted || job.company.status !== 'active') {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    if (job.status !== JobStatus.Published) {
      throw new BadRequestException('Tin tuyển dụng chưa mở nhận hồ sơ');
    }
    if (!isVnDeadlineStillOpen(job.deadline)) {
      throw new BadRequestException('Tin tuyển dụng đã hết hạn hiển thị');
    }

    const existing = await this.prisma.application.findUnique({
      where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
    });
    if (existing) {
      throw new BadRequestException('Bạn đã ứng tuyển vị trí này');
    }

    // ⭐ KHÔNG chặn ứng tuyển chéo lĩnh vực.
    // Mọi hồ sơ đều có thể ứng tuyển vào mọi tin (KD↔KT). Chỉ ghi nhận lưu ý
    // để Frontend hiển thị gợi ý mềm cho ứng viên.
    const trackNotice = resolveApplyTrackNotice(candidate, job);

    const match = await this.matching.computePairMatch(jobId, candidate.id);
    const code = await this.codeGen.next('APP');

    const application = await this.prisma.application.create({
      data: {
        code,
        tenantId: candidate.tenantId,
        jobId,
        candidateId: candidate.id,
        status: ApplicationStatus.Applied,
        matchScore: match.score,
        coverLetter: dto.coverLetter ?? null,
        createdBy: user.id,
        timeline: {
          create: {
            tenantId: candidate.tenantId,
            type: 'applied',
            title: 'Ứng tuyển',
            description: `Điểm phù hợp AI: ${match.score}%`,
          },
        },
      },
    });

    await this.audit.record({
      tenantId: candidate.tenantId,
      actorId: user.id,
      action: 'application.create',
      entityType: 'application',
      entityId: application.id,
      after: { code, jobId, matchScore: match.score },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.ApplicationSubmitted,
        tenantId: candidate.tenantId,
        correlationId,
        payload: { applicationId: application.id, jobId, candidateId: candidate.id },
      }),
    );

    this.logger.log(`Ứng viên ${candidate.code} ứng tuyển ${job.code} (match ${match.score}%)`);

    return {
      id: application.id,
      code: application.code,
      jobId,
      jobTitle: job.title,
      companyName: job.company.name,
      location: job.location,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      status: application.status as ApplicationStatus,
      matchScore: application.matchScore,
      coverLetter: application.coverLetter,
      createdAt: application.createdAt.toISOString(),
      trackNotice: trackNotice.notice,
      candidateTrack: trackNotice.candidateTrack,
      jobTrack: trackNotice.jobTrack,
      crossTrack: trackNotice.crossTrack,
    };
  }

  private resolveLiveMatch(
    app: { id?: string; matchScore: number | null },
    job: Parameters<MatchingService['scoreJobCandidate']>[0],
    candidate: Parameters<MatchingService['scoreJobCandidate']>[1],
    staleUpdates: Promise<unknown>[],
  ): { score: number | null; matchedSkills: string[] } {
    if (typeof this.matching?.scoreJobCandidate !== 'function') {
      return { score: app.matchScore, matchedSkills: [] };
    }
    const explanation = this.matching.scoreJobCandidate(job, candidate);
    const liveScore = explanation.score;
    if (
      app.id &&
      app.matchScore !== liveScore &&
      typeof this.prisma.application?.update === 'function'
    ) {
      staleUpdates.push(
        this.prisma.application.update({
          where: { id: app.id },
          data: { matchScore: liveScore },
        }),
      );
    }
    return { score: liveScore, matchedSkills: explanation.matchedSkills };
  }

  async myApplications(user: AuthenticatedUser): Promise<ApplicationView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: CANDIDATE_MATCH_INCLUDE,
    });
    if (!candidate) return [];

    const applications = await this.prisma.application.findMany({
      where: { candidateId: candidate.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: { job: { include: { skills: true, company: { select: { name: true } } } } },
    });

    const staleUpdates: Promise<unknown>[] = [];
    const views = applications.map((a) => {
      const live = this.resolveLiveMatch(a, a.job, candidate, staleUpdates);
      return {
        id: a.id,
        code: a.code,
        jobId: a.jobId,
        jobTitle: a.job.title,
        companyName: a.job.company.name,
        location: a.job.location,
        salaryMin: a.job.salaryMin,
        salaryMax: a.job.salaryMax,
        status: a.status as ApplicationStatus,
        matchScore: live.score,
        coverLetter: a.coverLetter,
        createdAt: a.createdAt.toISOString(),
      };
    });
    if (staleUpdates.length > 0) void Promise.allSettled(staleUpdates);
    return views;
  }

  /** Chi tiết đơn + timeline — chỉ chủ sở hữu (ứng viên). */
  async getMineDetail(
    user: AuthenticatedUser,
    applicationId: string,
  ): Promise<ApplicationDetailView> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: CANDIDATE_MATCH_INCLUDE,
    });
    if (!candidate) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, candidateId: candidate.id, isDeleted: false },
      include: {
        job: { include: { skills: true, company: { select: { name: true } } } },
        timeline: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }

    const staleUpdates: Promise<unknown>[] = [];
    const live = this.resolveLiveMatch(application, application.job, candidate, staleUpdates);
    if (staleUpdates.length > 0) void Promise.allSettled(staleUpdates);

    return {
      id: application.id,
      code: application.code,
      jobId: application.jobId,
      jobTitle: application.job.title,
      companyName: application.job.company.name,
      location: application.job.location,
      salaryMin: application.job.salaryMin,
      salaryMax: application.job.salaryMax,
      status: application.status as ApplicationStatus,
      matchScore: live.score,
      coverLetter: application.coverLetter,
      createdAt: application.createdAt.toISOString(),
      timeline: application.timeline.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        description: t.description,
        occurredAt: t.occurredAt.toISOString(),
      })),
    };
  }

  /**
   * Nguồn gốc hồ sơ: ứng viên do chiến dịch Săn mang về (job gắn hunt campaign)
   * → `hunt`; còn lại là ứng viên tự nộp hồ sơ → `self_applied`.
   */
  private async huntJobIds(companyId: string): Promise<Set<string>> {
    if (!this.prisma.huntCampaign?.findMany) return new Set();
    const rows = await this.prisma.huntCampaign.findMany({
      where: { companyId, jobId: { not: null } },
      select: { jobId: true },
    });
    return new Set(rows.flatMap((r) => (r.jobId ? [r.jobId] : [])));
  }

  /**
   * Ứng viên NTD đã mở khóa hồ sơ bằng Credit (mở profile / liên hệ / kết nối).
   * Ứng viên tự ứng tuyển thì không cần mở khóa — luôn thuộc quyền liên hệ.
   */
  private async unlockedCandidateIds(
    companyId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const ids: string[] = [];
    if (this.prisma.billingCreditTransaction?.findMany) {
      const rows = await this.prisma.billingCreditTransaction.findMany({
        where: {
          companyId,
          candidateId: { in: candidateIds },
          action: {
            in: [
              'view_profile',
              'view_profile_high_match',
              'view_applicant',
              'reopen_profile',
              'contact_potential',
              'contact_applicant',
            ],
          },
        },
        select: { candidateId: true },
        distinct: ['candidateId'],
      });
      ids.push(...rows.flatMap((r) => (r.candidateId ? [r.candidateId] : [])));
    }
    if (this.prisma.candidateConnection?.findMany) {
      const rows = await this.prisma.candidateConnection.findMany({
        where: { companyId, candidateId: { in: candidateIds }, status: { not: 'cancelled' } },
        select: { candidateId: true },
      });
      ids.push(...rows.flatMap((r) => (r.candidateId ? [r.candidateId] : [])));
    }
    return new Set(ids);
  }

  /** Lý do từ chối gần nhất (lưu ở timeline `status_changed`). */
  private async rejectionReasons(
    applicationIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (applicationIds.length === 0 || !this.prisma.applicationTimeline?.findMany) return map;
    const rows = await this.prisma.applicationTimeline.findMany({
      where: {
        applicationId: { in: applicationIds },
        type: 'status_changed',
        description: { not: null },
      },
      orderBy: { occurredAt: 'desc' },
      select: { applicationId: true, description: true, occurredAt: true },
    });
    for (const row of rows) {
      const text = row.description?.trim();
      if (!text || map.has(row.applicationId)) continue;
      map.set(row.applicationId, text);
    }
    return map;
  }

  /**
   * Ứng viên NTD đã CHỦ ĐỘNG mở khóa / shortlist từ luồng AI Săn.
   *
   * Khác với `unlockedCandidateIds` (mọi nguồn), hàm này chỉ trả về ứng viên
   * được NTD đưa vào quy trình TỪ AI Săn — dùng để phân loại nguồn "Tin săn nhân sự".
   */
  private async huntSourcedCandidateIds(
    companyId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const ids: string[] = [];

    // (1) Giao dịch Credit mở hồ sơ gắn campaignId → mở từ chiến dịch Săn.
    if (this.prisma.billingCreditTransaction?.findMany) {
      const rows = await this.prisma.billingCreditTransaction.findMany({
        where: {
          companyId,
          candidateId: { in: candidateIds },
          campaignId: { not: null },
          action: { in: [...PROFILE_OPEN_ACTIONS] },
        },
        select: { candidateId: true },
        distinct: ['candidateId'],
      });
      ids.push(...rows.flatMap((r) => (r.candidateId ? [r.candidateId] : [])));
    }

    // (2) NTD đã lưu ứng viên vào shortlist → chủ động đưa vào quy trình.
    if (this.prisma.candidateShortlist?.findMany) {
      const rows = await this.prisma.candidateShortlist.findMany({
        where: { companyId, candidateId: { in: candidateIds } },
        select: { candidateId: true },
        distinct: ['candidateId'],
      });
      ids.push(...rows.flatMap((r) => (r.candidateId ? [r.candidateId] : [])));
    }

    return new Set(ids);
  }

  /** Inbox ứng viên toàn công ty (Recruiter Workspace). */
  async listCompanyInbox(
    user: AuthenticatedUser,
    limit = 50,
  ): Promise<InboxApplicantView[]> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const applications = await this.prisma.application.findMany({
      where: { isDeleted: false, job: { companyId, isDeleted: false } },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        job: { include: { skills: true } },
        candidate: { include: CANDIDATE_MATCH_INCLUDE },
        interviews: interviewInclude,
      },
    });

    const candidateIds = applications.map((a) => a.candidateId);
    const [huntJobs, unlocked, huntSourced, rejectReasons] = await Promise.all([
      this.huntJobIds(companyId),
      this.unlockedCandidateIds(companyId, candidateIds),
      this.huntSourcedCandidateIds(companyId, candidateIds),
      this.rejectionReasons(applications.map((a) => a.id)),
    ]);

    const staleUpdates: Promise<unknown>[] = [];
    const rows = applications.map((a) => {
      const requiredSkills = a.job.skills.filter((s) => s.required).map((s) => s.name);
      const { matched } = skillOverlap(
        requiredSkills,
        a.candidate.skills.map((s) => s.name),
      );
      const live = this.resolveLiveMatch(a, a.job, a.candidate, staleUpdates);
      const candidateTrack = candidateMatchTrack(a.candidate);
      const jobTrack = jobMatchTrack(a.job);

      // ⭐ Nguồn chuẩn hóa: phản ánh CÁCH ứng viên đến, không phải gói tin.
      // Ứng viên tự bấm "Ứng tuyển ngay" vào tin thuộc gói Tin săn vẫn là
      // "Tự ứng tuyển" — KHÔNG gán nhầm "Tin săn nhân sự".
      const source: ApplicationSource = resolveApplicationSource({
        hasAppliedFromHuntJob: huntJobs.has(a.jobId),
        openedViaHuntCampaign: huntSourced.has(a.candidateId),
        shortlisted: huntSourced.has(a.candidateId),
        unlockedViaCredit: unlocked.has(a.candidateId),
      });

      const canContact = source === 'self_applied' || unlocked.has(a.candidateId);
      const rawEmail = a.candidate.user?.email ?? null;

      return {
        applicationId: a.id,
        candidateId: a.candidateId,
        displayName: a.candidate.displayName,
        currentPosition: a.candidate.profile?.currentPosition ?? null,
        industry: a.candidate.profile?.industry ?? null,
        status: a.status as ApplicationStatus,
        matchScore: live.score,
        matchedSkills: live.matchedSkills.length > 0 ? live.matchedSkills : matched,
        coverLetter: a.coverLetter,
        createdAt: a.createdAt.toISOString(),
        interviews: interviewMarks(a.interviews),
        jobId: a.jobId,
        jobTitle: a.job.title,
        source,
        // ⭐ Mask ngay tại Backend (không lộ qua Network F12).
        email: canContact ? rawEmail : maskEmail(rawEmail),
        canContact,
        isContactUnlocked: canContact,
        primaryTitle: a.candidate.profile?.currentPosition ?? null,
        candidateTrack,
        jobTrack,
        crossTrack: Boolean(candidateTrack && jobTrack && candidateTrack !== jobTrack),
        rejectionReason: rejectReasons.get(a.id) ?? null,
      };
    });
    if (staleUpdates.length > 0) void Promise.allSettled(staleUpdates);
    return rows;
  }

  /** Tóm tắt workspace nhà tuyển dụng. */
  async getWorkspaceSummary(user: AuthenticatedUser): Promise<RecruiterWorkspaceSummary> {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId: user.id },
      include: { company: true },
    });

    if (!membership) {
      return {
        companyName: null,
        hasCompany: false,
        jobCount: 0,
        publishedJobCount: 0,
        applicationCount: 0,
        newApplicationCount: 0,
        recentApplicants: [],
        publishedJobCount7dAgo: 0,
        newApplicationsToday: 0,
        newApplicationsYesterday: 0,
        avgTimeToHireDays: null,
        avgTimeToHireDeltaDays: null,
        pendingReviewCount: 0,
        pendingOfferCount: 0,
        hiredThisMonthCount: 0,
      };
    }

    const companyId = membership.companyId;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      jobCount,
      publishedJobCount,
      applicationCount,
      newApplicationCount,
      recentApplicants,
      publishedJobCount7dAgo,
      newApplicationsToday,
      newApplicationsYesterday,
      hiredApplications,
      pendingReviewCount,
      pendingOfferCount,
    ] = await Promise.all([
      this.prisma.job.count({ where: { companyId, isDeleted: false } }),
      this.prisma.job.count({
        where: { companyId, isDeleted: false, status: JobStatus.Published },
      }),
      this.prisma.application.count({
        where: { isDeleted: false, job: { companyId, isDeleted: false } },
      }),
      this.prisma.application.count({
        where: {
          isDeleted: false,
          status: ApplicationStatus.Applied,
          job: { companyId, isDeleted: false },
        },
      }),
      this.listCompanyInbox(user, 8),
      this.prisma.job.count({
        where: {
          companyId,
          isDeleted: false,
          status: JobStatus.Published,
          publishedAt: { lte: sevenDaysAgo },
        },
      }),
      this.prisma.application.count({
        where: {
          isDeleted: false,
          job: { companyId, isDeleted: false },
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.application.count({
        where: {
          isDeleted: false,
          job: { companyId, isDeleted: false },
          createdAt: { gte: startOfYesterday, lt: startOfToday },
        },
      }),
      this.prisma.application.findMany({
        where: {
          isDeleted: false,
          status: ApplicationStatus.Hired,
          job: { companyId, isDeleted: false },
        },
        select: { createdAt: true, updatedAt: true },
      }),
      this.prisma.application.count({
        where: {
          isDeleted: false,
          status: { in: [ApplicationStatus.Applied, ApplicationStatus.Screening] },
          job: { companyId, isDeleted: false },
        },
      }),
      this.prisma.offer.count({
        where: {
          isDeleted: false,
          status: OfferStatus.Pending,
          job: { companyId, isDeleted: false },
        },
      }),
    ]);

    const { avgTimeToHireDays, avgTimeToHireDeltaDays } = computeTimeToHireStats(
      hiredApplications,
      now,
    );
    const hiredThisMonthCount = hiredApplications.filter(
      (a) => a.updatedAt >= startOfMonth,
    ).length;

    return {
      companyName: membership.company.name,
      hasCompany: true,
      jobCount,
      publishedJobCount,
      applicationCount,
      newApplicationCount,
      recentApplicants,
      publishedJobCount7dAgo,
      newApplicationsToday,
      newApplicationsYesterday,
      avgTimeToHireDays,
      avgTimeToHireDeltaDays,
      pendingReviewCount,
      pendingOfferCount,
      hiredThisMonthCount,
    };
  }

  /** Báo cáo tuyển dụng: hồ sơ nhận trong kỳ, phễu chuyển đổi & trạng thái hiện tại, nguồn săn nhân sự AI, Credit và hiệu suất từng tin. */
  async getRecruitmentReport(user: AuthenticatedUser, daysRaw: number): Promise<RecruitmentReportView> {
    const days = REPORT_DAY_OPTIONS.includes(daysRaw as (typeof REPORT_DAY_OPTIONS)[number])
      ? daysRaw
      : 30;
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId: user.id },
      include: { company: { select: { name: true } } },
    });
    if (!membership) return emptyRecruitmentReport(days);

    const now = new Date();
    const from = new Date(now.getTime() - days * MS_PER_DAY);
    const prevFrom = new Date(from.getTime() - days * MS_PER_DAY);
    const companyId = membership.companyId;
    const jobScope = { companyId, isDeleted: false } as const;

    const [
      openJobs,
      applications,
      applicationsPrev,
      interviewSessions,
      offersSent,
      hiredRows,
      companyJobs,
      sourcingPlan,
      sourcingUsages,
      shortlistCount,
      connections,
      creditAccount,
      creditTransactions,
    ] = await Promise.all([
      this.prisma.job.count({
        where: { ...jobScope, status: JobStatus.Published },
      }),
      this.prisma.application.findMany({
        where: { isDeleted: false, createdAt: { gte: from }, job: jobScope },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          matchScore: true,
          jobId: true,
          job: { include: { skills: true } },
          candidate: { include: CANDIDATE_MATCH_INCLUDE },
        },
      }),
      this.prisma.application.count({
        where: {
          isDeleted: false,
          createdAt: { gte: prevFrom, lt: from },
          job: jobScope,
        },
      }),
      this.prisma.interview.count({
        where: {
          isDeleted: false,
          scheduledAt: { gte: from, lte: now },
          status: { not: InterviewStatus.Cancelled },
          job: jobScope,
        },
      }),
      this.prisma.offer.count({
        where: { isDeleted: false, createdAt: { gte: from }, job: jobScope },
      }),
      this.prisma.application.findMany({
        where: {
          isDeleted: false,
          status: ApplicationStatus.Hired,
          updatedAt: { gte: from },
          job: jobScope,
        },
        select: { createdAt: true, updatedAt: true },
      }),
      this.prisma.job?.findMany
        ? this.prisma.job.findMany({
            where: jobScope,
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              location: true,
              createdAt: true,
              jobPackage: { select: { packageName: true, code: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 25,
          })
        : Promise.resolve([]),
      this.prisma.billingCompanySourcingPlan?.findUnique
        ? this.prisma.billingCompanySourcingPlan.findUnique({
            where: { companyId },
            include: {
              plan: true,
              huntCampaigns: {
                where: { jobId: { not: null }, status: { not: 'closed' } },
                include: {
                  package: { select: { packageName: true, code: true, status: true } },
                },
              },
            },
          })
        : Promise.resolve(null),
      this.prisma.huntCampaignActivity?.findMany
        ? this.prisma.huntCampaignActivity.findMany({
            where: { companyId, createdAt: { gte: from } },
            select: { kind: true, jobId: true, note: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 300,
          })
        : Promise.resolve([]),
      this.prisma.candidateShortlist?.count
        ? this.prisma.candidateShortlist.count({ where: { companyId } })
        : Promise.resolve(0),
      this.prisma.candidateConnection?.findMany
        ? this.prisma.candidateConnection.findMany({
            where: { companyId, createdAt: { gte: from } },
            select: { status: true },
          })
        : Promise.resolve([]),
      this.prisma.billingCreditAccount?.findUnique
        ? this.prisma.billingCreditAccount.findUnique({
            where: { companyId },
            select: { balance: true },
          })
        : Promise.resolve(null),
      this.prisma.billingCreditTransaction?.findMany
        ? this.prisma.billingCreditTransaction.findMany({
            where: { companyId, createdAt: { gte: from } },
            select: { type: true, action: true, creditDelta: true },
          })
        : Promise.resolve([]),
    ]);

    const reportStaleUpdates: Promise<unknown>[] = [];
    for (const row of applications) {
      if (row.candidate && row.job) {
        const live = this.resolveLiveMatch(row, row.job, row.candidate, reportStaleUpdates);
        row.matchScore = live.score;
      }
    }
    if (reportStaleUpdates.length > 0) void Promise.allSettled(reportStaleUpdates);

    const count = (status: ApplicationStatus) =>
      applications.filter((row) => row.status === status).length;
    const appliedOnly = count(ApplicationStatus.Applied);
    const screening = count(ApplicationStatus.Screening);
    const interviews = count(ApplicationStatus.Interview);
    const offers = count(ApplicationStatus.Offer);
    const hires = count(ApplicationStatus.Hired);
    const rejected = count(ApplicationStatus.Rejected);
    const withdrawn = count(ApplicationStatus.Withdrawn);
    const scores = applications
      .map((row) => matchScorePct(row.matchScore))
      .filter((score): score is number => score != null);
    const avgMatchScore = scores.length ? round1(average(scores)) : null;
    const topMatchScore = scores.length ? round1(Math.max(...scores)) : null;
    const highMatchCount = scores.filter((score) => score >= 70).length;
    const hireDays = hiredRows.map(
      (row) => (row.updatedAt.getTime() - row.createdAt.getTime()) / MS_PER_DAY,
    );
    const avgTimeToHireDays = hireDays.length ? round1(average(hireDays)) : null;
    const conversionPct = applications.length
      ? round1((hires / applications.length) * 100)
      : null;

    // Phễu chuyển đổi lũy kế (Cumulative Funnel) kèm số lượng đang đứng tại từng bước
    const totalApps = applications.length;
    const cumScreening = screening + interviews + offers + hires;
    const cumInterview = Math.max(
      interviews + offers + hires,
      Math.min(totalApps, interviewSessions),
    );
    const cumOffer = Math.max(offers + hires, Math.min(totalApps, offersSent));
    const cumHired = hires;

    const rawSteps: {
      key: string;
      label: string;
      currentCount: number;
      cumulativeCount: number;
    }[] = [
      {
        key: 'applied',
        label: 'Ứng tuyển',
        currentCount: appliedOnly,
        cumulativeCount: totalApps,
      },
      {
        key: 'screening',
        label: 'Sàng lọc',
        currentCount: screening,
        cumulativeCount: cumScreening,
      },
      {
        key: 'interview',
        label: 'Phỏng vấn',
        currentCount: interviews,
        cumulativeCount: cumInterview,
      },
      {
        key: 'offer',
        label: 'Đề nghị',
        currentCount: offers,
        cumulativeCount: cumOffer,
      },
      {
        key: 'hired',
        label: 'Nhận việc',
        currentCount: hires,
        cumulativeCount: cumHired,
      },
    ];

    const funnel: RecruitmentReportFunnelStep[] = rawSteps.map((step, idx) => {
      const prevCum = idx === 0 ? totalApps : rawSteps[idx - 1]!.cumulativeCount;
      const conversionFromStartPct =
        totalApps > 0 ? round1((step.cumulativeCount / totalApps) * 100) : 0;
      const stepPassRatePct =
        idx === 0
          ? totalApps > 0
            ? 100
            : 0
          : prevCum > 0
            ? round1(Math.min(100, (step.cumulativeCount / prevCum) * 100))
            : 0;
      return {
        key: step.key,
        label: step.label,
        count: step.currentCount,
        currentCount: step.currentCount,
        cumulativeCount: step.cumulativeCount,
        conversionFromStartPct,
        stepPassRatePct,
      };
    });

    // Phân tích nguồn Săn nhân sự AI & kết nối chủ động
    const scanUsages = sourcingUsages.filter((u) => u.kind === 'auto_scan');
    const scannedCandidateIds = new Set<string>();
    for (const u of scanUsages) {
      if (!u.note) continue;
      try {
        const parsed = JSON.parse(u.note) as {
          candidates?: { candidateId?: string }[];
        };
        if (Array.isArray(parsed.candidates)) {
          for (const c of parsed.candidates) {
            if (c?.candidateId) scannedCandidateIds.add(c.candidateId);
          }
        }
      } catch {
        // ignore invalid json
      }
    }
    const outreachUsages = sourcingUsages.filter(
      (u) => u.kind === 'shortlist' && u.note?.startsWith('outreach:'),
    );
    const shortlistUsages = sourcingUsages.filter(
      (u) => u.kind === 'shortlist' && !u.note?.startsWith('outreach:'),
    );
    const sourcingProfileOpens = sourcingUsages.filter((u) => u.kind === 'profile_open').length;

    let outreachQuota = 0;
    if (sourcingPlan?.plan && sourcingPlan.isActive) {
      const scopeCodes = includedScopeCodes(parseSourcingScope(sourcingPlan.plan.serviceScope));
      const hasOutreach =
        scopeCodes.includes('outreach') ||
        sourcingPlan.plan.code === 'SAN_CHUYEN_SAU' ||
        (sourcingPlan.plan.shortlistQuota != null && sourcingPlan.plan.shortlistQuota > 0);
      outreachQuota = hasOutreach ? (sourcingPlan.plan.shortlistQuota ?? 15) : 0;
    }

    const uniqueEngagementsByJob = new Set(
      (sourcingPlan?.huntCampaigns ?? [])
        .map((e) => e.jobId)
        .filter((id): id is string => Boolean(id)),
    );

    const consumedCredits = creditTransactions
      .filter((t) => t.type === 'deduct' || t.creditDelta < 0)
      .reduce((sum, t) => sum + Math.abs(t.creditDelta), 0);
    const unlockedByCredits = creditTransactions.filter(
      (t) =>
        (t.type === 'deduct' || t.creditDelta < 0) &&
        (t.action === 'view_profile' || t.action === 'contact_potential'),
    ).length;

    return {
      companyName: membership.company.name,
      hasCompany: true,
      days,
      generatedAt: now.toISOString(),
      openJobs,
      applications: applications.length,
      applicationsPrev,
      screening,
      interviews,
      interviewSessions,
      offers,
      offersSent,
      hires,
      rejected,
      withdrawn,
      avgMatchScore,
      topMatchScore,
      highMatchCount,
      avgTimeToHireDays,
      conversionPct,
      funnel,
      trend: buildReportTrend(days, from, now, applications, hiredRows),
      jobs: buildReportJobs(
        applications,
        companyJobs,
        sourcingUsages,
        sourcingPlan?.huntCampaigns ?? [],
      ),
      sourcing: {
        planName: sourcingPlan?.isActive ? (sourcingPlan.plan?.name ?? null) : null,
        activeEngagements: uniqueEngagementsByJob.size,
        scanRoundsInPeriod: scanUsages.length,
        scannedCandidatesCount: scannedCandidateIds.size,
        shortlistedCount: Math.max(shortlistCount, shortlistUsages.length),
        outreachCount: outreachUsages.length,
        outreachQuota,
        connectionsSent: connections.length,
        connectionsAccepted: connections.filter((c) => c.status === 'accepted').length,
      },
      credits: {
        balance: creditAccount?.balance ?? 0,
        consumedInPeriod: consumedCredits,
        profilesUnlockedInPeriod: unlockedByCredits + sourcingProfileOpens,
      },
    };
  }

  /** Danh sách ứng viên đã ứng tuyển vào một tin (phía nhà tuyển dụng). */
  async listApplicants(user: AuthenticatedUser, jobId: string): Promise<ApplicantView[]> {
    const job = await this.jobs.requireOwnedJob(user, jobId);
    const requiredSkills = job.skills.filter((s) => s.required).map((s) => s.name);

    const applications = await this.prisma.application.findMany({
      where: { jobId: job.id, isDeleted: false },
      orderBy: [{ matchScore: 'desc' }, { createdAt: 'asc' }],
      include: {
        candidate: { include: CANDIDATE_MATCH_INCLUDE },
        interviews: interviewInclude,
      },
    });

    const { companyId } = await this.companies.requireUserCompany(user.id);
    const candidateIds = applications.map((a) => a.candidateId);
    const [huntJobs, unlocked, huntSourced, rejectReasons] = await Promise.all([
      this.huntJobIds(companyId),
      this.unlockedCandidateIds(companyId, candidateIds),
      this.huntSourcedCandidateIds(companyId, candidateIds),
      this.rejectionReasons(applications.map((a) => a.id)),
    ]);

    const staleUpdates: Promise<unknown>[] = [];
    const rows = applications.map((a) => {
      const { matched } = skillOverlap(
        requiredSkills,
        a.candidate.skills.map((s) => s.name),
      );
      const live = this.resolveLiveMatch(a, job, a.candidate, staleUpdates);
      const candidateTrack = candidateMatchTrack(a.candidate);
      const jobTrack = jobMatchTrack(job);

      // ⭐ Nguồn chuẩn hóa — ứng viên tự ứng tuyển vào tin Săn vẫn là "Tự ứng tuyển".
      const source: ApplicationSource = resolveApplicationSource({
        hasAppliedFromHuntJob: huntJobs.has(job.id),
        openedViaHuntCampaign: huntSourced.has(a.candidateId),
        shortlisted: huntSourced.has(a.candidateId),
        unlockedViaCredit: unlocked.has(a.candidateId),
      });

      const canContact = source === 'self_applied' || unlocked.has(a.candidateId);
      const rawEmail = a.candidate.user?.email ?? null;

      return {
        applicationId: a.id,
        candidateId: a.candidateId,
        displayName: a.candidate.displayName,
        currentPosition: a.candidate.profile?.currentPosition ?? null,
        industry: a.candidate.profile?.industry ?? null,
        status: a.status as ApplicationStatus,
        matchScore: live.score,
        matchedSkills: live.matchedSkills.length > 0 ? live.matchedSkills : matched,
        coverLetter: a.coverLetter,
        createdAt: a.createdAt.toISOString(),
        interviews: interviewMarks(a.interviews),
        source,
        // ⭐ Mask ngay tại Backend (không lộ qua Network F12).
        email: canContact ? rawEmail : maskEmail(rawEmail),
        canContact,
        isContactUnlocked: canContact,
        primaryTitle: a.candidate.profile?.currentPosition ?? null,
        candidateTrack,
        jobTrack,
        crossTrack: Boolean(candidateTrack && jobTrack && candidateTrack !== jobTrack),
        rejectionReason: rejectReasons.get(a.id) ?? null,
      };
    });
    if (staleUpdates.length > 0) void Promise.allSettled(staleUpdates);
    return rows.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
  }

  async updateStatus(
    user: AuthenticatedUser,
    applicationId: string,
    dto: UpdateApplicationStatusDto,
    correlationId: string,
  ): Promise<{ id: string; status: ApplicationStatus }> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!application || application.isDeleted) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }
    // Xác thực quyền: tin phải thuộc công ty của nhà tuyển dụng.
    await this.jobs.requireOwnedJob(user, application.jobId);

    const previous = application.status;
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: dto.status,
        updatedBy: user.id,
        timeline: {
          create: {
            tenantId: application.tenantId,
            type: 'status_changed',
            title: `Chuyển trạng thái: ${applicationStatusLabel(previous)} → ${applicationStatusLabel(dto.status)}`,
            description: dto.note ?? null,
          },
        },
      },
    });

    await this.audit.record({
      tenantId: application.tenantId,
      actorId: user.id,
      action: 'application.status',
      entityType: 'application',
      entityId: applicationId,
      before: { status: previous },
      after: { status: dto.status },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.ApplicationStatusChanged,
        tenantId: application.tenantId,
        correlationId,
        payload: { applicationId, from: previous, to: dto.status },
      }),
    );

    return { id: applicationId, status: dto.status };
  }

  /** AI soạn tiêu đề và nội dung email hàng loạt theo tin và trạng thái hồ sơ. Không gửi thư. */
  async suggestBroadcastEmail(
    user: AuthenticatedUser,
    jobId: string,
    dto: SuggestBroadcastEmailDto,
  ): Promise<{ subject: string; body: string }> {
    const job = await this.jobs.requireOwnedJob(user, jobId);
    const purpose = dto.purpose as BroadcastEmailPurpose;
    const statuses = [...new Set(dto.statuses ?? [])];
    const fallback = localBroadcastDraft({
      purpose,
      companyName: job.company.name,
      jobTitle: job.title,
      statuses,
    });
    const statusText =
      statuses.length > 0 ? statuses.map((status) => applicationStatusLabel(status)).join(', ') : 'chưa chọn';

    try {
      const raw = await this.ai.chat({
        system: [
          'Bạn soạn email tuyển dụng tiếng Việt cho nhà tuyển dụng gửi hàng loạt.',
          'Chỉ trả về JSON {"subject":"...","body":"..."} không markdown.',
          'subject tối đa 120 ký tự, không gắn tên công ty ở đầu.',
          'body là đoạn sau câu chào tên. Hệ thống tự thêm Xin chào {tên}.',
          'Giọng chuyên nghiệp, ngắn, nói rõ bước hiện tại và việc ứng viên cần làm.',
          'Không bịa ngày giờ, lương, tên người phỏng vấn, số điện thoại.',
          'Không hứa chuyển trạng thái hồ sơ. Không gọi tên một ứng viên cụ thể.',
        ].join(' '),
        user: [
          `Công ty: ${job.company.name}`,
          `Vị trí: ${job.title}`,
          `Mục đích: ${broadcastPurposeLabel(purpose)}`,
          `Trạng thái hồ sơ đang chọn: ${statusText}`,
          'Bản nháp để viết lại cho sát việc hơn:',
          `Tiêu đề: ${fallback.subject}`,
          fallback.body,
        ].join('\n'),
      });
      const parsed = parseBroadcastDraft(raw);
      if (!parsed) return fallback;
      return { ...parsed, subject: stripCompanyFromSubject(parsed.subject, job.company.name) };
    } catch (err) {
      this.logger.warn(`Gợi ý email hàng loạt dùng bản nháp: ${String(err)}`);
      return fallback;
    }
  }

  /** Gửi email hàng loạt tới ứng viên của một tin (lọc status tùy chọn). */
  async broadcastEmail(
    user: AuthenticatedUser,
    jobId: string,
    dto: BroadcastEmailDto,
    correlationId: string,
  ): Promise<{
    recipients: number;
    sent: number;
    failed: number;
    /** Ứng viên bị bỏ qua vì chưa mở khóa hồ sơ bằng Credit (paywall). */
    skippedByPaywall: number;
    /** Ứng viên bị bỏ qua vì chưa cập nhật email trên tài khoản. */
    skippedMissingEmail: number;
  }> {
    const job = await this.jobs.requireOwnedJob(user, jobId);
    const subject = dto.subject.trim();
    const body = dto.body.trim();
    if (!subject || !body) {
      throw new BadRequestException('Tiêu đề và nội dung không được để trống');
    }

    const applicationIds = dto.applicationIds ? [...new Set(dto.applicationIds)] : undefined;
    const applications = await this.prisma.application.findMany({
      where: {
        jobId: job.id,
        isDeleted: false,
        ...(applicationIds ? { id: { in: applicationIds } } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        candidate: {
          select: {
            displayName: true,
            user: { select: { email: true } },
          },
        },
      },
      take: 200,
    });

    if (applicationIds && applications.length !== applicationIds.length) {
      throw new BadRequestException('Có hồ sơ không thuộc tin này hoặc không còn để gửi');
    }

    if (applications.length === 0) {
      throw new BadRequestException('Không có ứng viên nào khớp bộ lọc để gửi email');
    }

    // ⚠ Paywall liên hệ: ứng viên tự ứng tuyển luôn được liên hệ (kể cả trên tin Săn).
    // Ứng viên do Săn mang về phải mở khóa hồ sơ bằng Credit trước — chặn lách paywall.
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const candIds = applications.map((a) => a.candidateId);
    const [huntJobs, unlocked, huntSourced] = await Promise.all([
      this.huntJobIds(companyId),
      this.unlockedCandidateIds(companyId, candIds),
      this.huntSourcedCandidateIds(companyId, candIds),
    ]);
    const jobIsHunt = huntJobs.has(job.id);
    const contactable = applications.filter((a) => {
      const source = resolveApplicationSource({
        hasAppliedFromHuntJob: jobIsHunt,
        openedViaHuntCampaign: huntSourced.has(a.candidateId),
        shortlisted: huntSourced.has(a.candidateId),
        unlockedViaCredit: unlocked.has(a.candidateId),
      });
      return source === 'self_applied' || unlocked.has(a.candidateId);
    });
    const blockedByPaywall = applications.length - contactable.length;

    const withEmail = contactable.filter((a) => a.candidate.user?.email);
    const missingEmail = contactable.length - withEmail.length;
    if (withEmail.length === 0) {
      throw new BadRequestException(
        blockedByPaywall > 0
          ? 'Các ứng viên đã chọn chưa mở khóa hồ sơ — cần dùng Credit để mở khóa trước khi gửi email'
          : 'Ứng viên đã chọn chưa có email trên tài khoản',
      );
    }

    const applicationsUrl = `${this.email.webOrigin}/applications`;
    const messages = withEmail.map((a) =>
      buildBroadcastEmail({
        candidateName: a.candidate.displayName,
        candidateEmail: a.candidate.user!.email,
        companyName: job.company.name,
        jobTitle: job.title,
        subject,
        body,
        applicationsUrl,
      }),
    );

    const result = await this.email.sendMany(messages);

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'job.broadcast_email',
      entityType: 'job',
      entityId: jobId,
      after: {
        subject,
        statusFilter: dto.status ?? null,
        applicationIds: applicationIds ?? null,
        recipients: contactable.length,
        sent: result.sent,
        failed: result.failed + missingEmail,
        skippedByPaywall: blockedByPaywall,
      },
      correlationId,
    });

    if (withEmail.length > 0) {
      await this.prisma.applicationTimeline.createMany({
        data: withEmail.map((a) => ({
          applicationId: a.id,
          tenantId: a.tenantId,
          type: 'broadcast_email',
          title: 'Email hàng loạt từ NTD',
          description: subject,
        })),
      });

      if (dto.nextStatus && this.prisma.application.updateMany) {
        const targetIds = withEmail.map((a) => a.id);
        await this.prisma.application.updateMany({
          where: { id: { in: targetIds }, jobId: job.id, isDeleted: false },
          data: { status: dto.nextStatus, updatedBy: user.id },
        });
        await this.prisma.applicationTimeline.createMany({
          data: withEmail.map((a) => ({
            applicationId: a.id,
            tenantId: a.tenantId,
            type: 'status_changed',
            title: `Tự động chuyển trạng thái → ${applicationStatusLabel(dto.nextStatus!)}`,
            description: `Cập nhật kèm đợt gửi email: ${subject}`,
          })),
        });
      }
    }

    this.logger.log(
      `broadcast-email job=${jobId} recipients=${contactable.length} sent=${result.sent} blocked=${blockedByPaywall}`,
    );

    return {
      recipients: contactable.length,
      sent: result.sent,
      failed: result.failed + missingEmail,
      // Ứng viên bị bỏ qua vì chưa mở khóa hồ sơ (paywall) — FE hiển thị cảnh báo.
      skippedByPaywall: blockedByPaywall,
      // Ứng viên bị bỏ qua vì chưa cập nhật email trên tài khoản.
      skippedMissingEmail: missingEmail,
    };
  }

  /** Lịch sử các đợt gửi email hàng loạt của một tin tuyển dụng. */
  async listBroadcastEmailHistory(
    user: AuthenticatedUser,
    jobId: string,
  ): Promise<
    {
      id: string;
      subject: string;
      recipientsCount: number;
      recipientNames: string[];
      sentAt: string;
    }[]
  > {
    const job = await this.jobs.requireOwnedJob(user, jobId);
    if (!this.prisma.applicationTimeline?.findMany) return [];

    const rows = await this.prisma.applicationTimeline.findMany({
      where: {
        type: 'broadcast_email',
        application: { jobId: job.id, isDeleted: false },
      },
      orderBy: { occurredAt: 'desc' },
      take: 150,
      include: {
        application: {
          select: {
            candidate: { select: { displayName: true } },
          },
        },
      },
    });

    const batches = new Map<
      string,
      {
        id: string;
        subject: string;
        recipientsCount: number;
        recipientNames: string[];
        sentAt: string;
      }
    >();

    for (const r of rows) {
      const minuteBucket = r.occurredAt.toISOString().slice(0, 16);
      const subject = r.description?.trim() || r.title;
      const key = `${minuteBucket}::${subject}`;
      let batch = batches.get(key);
      if (!batch) {
        batch = {
          id: r.id,
          subject,
          recipientsCount: 0,
          recipientNames: [],
          sentAt: r.occurredAt.toISOString(),
        };
        batches.set(key, batch);
      }
      batch.recipientsCount += 1;
      const candName = r.application?.candidate?.displayName;
      if (candName && batch.recipientNames.length < 5 && !batch.recipientNames.includes(candName)) {
        batch.recipientNames.push(candName);
      }
    }

    return [...batches.values()].slice(0, 15);
  }
}

/**
 * Chặn nộp chéo track (KD↔KT). Thiếu track ứng viên → bắt hoàn thiện hồ sơ.
 * Tin legacy không suy ra được track → vẫn cho nộp.
 */
const TRACK_DISPLAY_LABEL: Record<'sales' | 'technical', string> = {
  sales: 'Kinh doanh',
  technical: 'Kỹ thuật',
};

/**
 * ⭐ KHÔNG CHẶN ứng tuyển chéo lĩnh vực.
 *
 * Mọi hồ sơ (Kinh doanh hoặc Kỹ thuật) đều được phép ứng tuyển vào mọi tin.
 * Hàm này chỉ SINH RA gợi ý mềm để Frontend hiển thị cho ứng viên — không ném lỗi.
 *
 * Trả về:
 * - `notice`: gợi ý mềm (null nếu cùng lĩnh vực / không xác định được).
 * - `candidateTrack` / `jobTrack`: lĩnh vực để Frontend hiển thị tag.
 * - `crossTrack`: true khi ứng tuyển chéo lĩnh vực.
 */
export function resolveApplyTrackNotice(
  candidate: { profile?: { jobTrack?: string | null } | null },
  job: Parameters<typeof jobMatchTrack>[0],
): {
  notice: string | null;
  candidateTrack: 'sales' | 'technical' | null;
  jobTrack: 'sales' | 'technical' | null;
  crossTrack: boolean;
} {
  const candidateTrack = candidateMatchTrack(candidate);
  const jobTrack = jobMatchTrack(job);
  const crossTrack = Boolean(candidateTrack && jobTrack && candidateTrack !== jobTrack);

  if (!crossTrack) {
    return { notice: null, candidateTrack, jobTrack, crossTrack: false };
  }

  const notice =
    `Hồ sơ hiện tại của bạn thuộc lĩnh vực ${TRACK_DISPLAY_LABEL[candidateTrack!]}, ` +
    `khác với lĩnh vực của tin đăng. Bạn vẫn có thể ứng tuyển bình thường — nên ghi thêm ` +
    `lý do và kinh nghiệm liên quan ở phần Thư giới thiệu để gây ấn tượng với nhà tuyển dụng.`;

  return { notice, candidateTrack, jobTrack, crossTrack: true };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Tính thời gian tuyển trung bình (ngày, từ createdAt -> updatedAt của hồ sơ Hired)
 * và chênh lệch giữa 30 ngày gần nhất so với 30 ngày trước đó. Trả null nếu thiếu dữ liệu.
 */
function computeTimeToHireStats(
  hired: { createdAt: Date; updatedAt: Date }[],
  now: Date,
): { avgTimeToHireDays: number | null; avgTimeToHireDeltaDays: number | null } {
  if (hired.length === 0) {
    return { avgTimeToHireDays: null, avgTimeToHireDeltaDays: null };
  }

  const days = hired.map((a) => (a.updatedAt.getTime() - a.createdAt.getTime()) / MS_PER_DAY);
  const avgTimeToHireDays = average(days);

  const last30Cutoff = new Date(now.getTime() - 30 * MS_PER_DAY);
  const prev30Cutoff = new Date(now.getTime() - 60 * MS_PER_DAY);
  const last30 = hired.filter((a) => a.updatedAt >= last30Cutoff);
  const prev30 = hired.filter((a) => a.updatedAt >= prev30Cutoff && a.updatedAt < last30Cutoff);

  let avgTimeToHireDeltaDays: number | null = null;
  if (last30.length > 0 && prev30.length > 0) {
    const avgLast30 = average(
      last30.map((a) => (a.updatedAt.getTime() - a.createdAt.getTime()) / MS_PER_DAY),
    );
    const avgPrev30 = average(
      prev30.map((a) => (a.updatedAt.getTime() - a.createdAt.getTime()) / MS_PER_DAY),
    );
    avgTimeToHireDeltaDays = avgLast30 - avgPrev30;
  }

  return { avgTimeToHireDays, avgTimeToHireDeltaDays };
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const interviewInclude = {
  where: { isDeleted: false },
  orderBy: { scheduledAt: 'desc' as const },
  select: { type: true, status: true, scheduledAt: true },
};

function interviewMarks(
  rows: { type: string; status: string; scheduledAt: Date }[],
): ApplicantView['interviews'] {
  return rows
    .filter((row) => row.status !== InterviewStatus.Cancelled)
    .map((row) => ({
      type: row.type as InterviewType,
      status: row.status as InterviewStatus,
      scheduledAt: row.scheduledAt.toISOString(),
    }));
}

const REPORT_DAY_OPTIONS = [7, 30, 90, 365] as const;

const REPORT_FUNNEL: RecruitmentReportFunnelStep[] = [
  { key: 'applied', label: 'Ứng tuyển', count: 0, currentCount: 0, cumulativeCount: 0, conversionFromStartPct: 0, stepPassRatePct: 0 },
  { key: 'screening', label: 'Sàng lọc', count: 0, currentCount: 0, cumulativeCount: 0, conversionFromStartPct: 0, stepPassRatePct: 0 },
  { key: 'interview', label: 'Phỏng vấn', count: 0, currentCount: 0, cumulativeCount: 0, conversionFromStartPct: 0, stepPassRatePct: 0 },
  { key: 'offer', label: 'Đề nghị', count: 0, currentCount: 0, cumulativeCount: 0, conversionFromStartPct: 0, stepPassRatePct: 0 },
  { key: 'hired', label: 'Nhận việc', count: 0, currentCount: 0, cumulativeCount: 0, conversionFromStartPct: 0, stepPassRatePct: 0 },
];

function emptyRecruitmentReport(days: number): RecruitmentReportView {
  return {
    companyName: null,
    hasCompany: false,
    days,
    generatedAt: new Date().toISOString(),
    openJobs: 0,
    applications: 0,
    applicationsPrev: 0,
    screening: 0,
    interviews: 0,
    interviewSessions: 0,
    offers: 0,
    offersSent: 0,
    hires: 0,
    rejected: 0,
    withdrawn: 0,
    avgMatchScore: null,
    topMatchScore: null,
    highMatchCount: 0,
    avgTimeToHireDays: null,
    conversionPct: null,
    funnel: REPORT_FUNNEL.map((step) => ({ ...step })),
    trend: [],
    jobs: [],
    sourcing: {
      planName: null,
      activeEngagements: 0,
      scanRoundsInPeriod: 0,
      scannedCandidatesCount: 0,
      shortlistedCount: 0,
      outreachCount: 0,
      outreachQuota: 0,
      connectionsSent: 0,
      connectionsAccepted: 0,
    },
    credits: {
      balance: 0,
      consumedInPeriod: 0,
      profilesUnlockedInPeriod: 0,
    },
  };
}

function matchScorePct(score: number | null): number | null {
  if (score == null || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, score));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

type ReportGrain = 'day' | 'week' | 'month';

function reportGrain(days: number): ReportGrain {
  if (days > 120) return 'month';
  if (days > 31) return 'week';
  return 'day';
}

function bucketStart(date: Date, grain: ReportGrain): Date {
  const start = startOfDay(date);
  if (grain === 'month') {
    start.setDate(1);
    return start;
  }
  if (grain === 'week') {
    const weekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - weekday);
  }
  return start;
}

function bucketLabel(key: string, grain: ReportGrain): string {
  if (grain === 'month') {
    const [year, month] = key.split('-');
    return `${Number(month)}/${year.slice(2)}`;
  }
  const [, month, day] = key.split('-');
  return `${Number(day)}/${Number(month)}`;
}

function nextBucket(date: Date, grain: ReportGrain): Date {
  const next = new Date(date);
  if (grain === 'month') next.setMonth(next.getMonth() + 1);
  else if (grain === 'week') next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + 1);
  return next;
}

function buildReportTrend(
  days: number,
  from: Date,
  now: Date,
  applications: { createdAt: Date }[],
  hiredRows: { updatedAt: Date }[],
): RecruitmentReportTrendPoint[] {
  const grain = reportGrain(days);
  const points: RecruitmentReportTrendPoint[] = [];
  let cursor = bucketStart(from, grain);
  const end = startOfDay(now);
  while (cursor <= end && points.length < 400) {
    const key = dayKey(cursor).slice(0, grain === 'month' ? 7 : 10);
    points.push({ key, label: bucketLabel(key, grain), applications: 0, hires: 0 });
    const next = nextBucket(cursor, grain);
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
  }

  const index = new Map(points.map((point, i) => [point.key, i]));
  const place = (date: Date, field: 'applications' | 'hires') => {
    const key = dayKey(bucketStart(date, grain)).slice(0, grain === 'month' ? 7 : 10);
    const i = index.get(key);
    if (i != null) points[i][field] += 1;
  };
  for (const row of applications) place(row.createdAt, 'applications');
  for (const row of hiredRows) place(row.updatedAt, 'hires');
  return points;
}

function buildReportJobs(
  applications: {
    status: string;
    matchScore: number | null;
    jobId: string;
    job: { code?: string | null; title: string; status: string; location: string | null };
  }[],
  companyJobs: {
    id: string;
    code?: string | null;
    title: string;
    status: string;
    location: string | null;
    jobPackage?: { packageName: string; code: string } | null;
  }[] = [],
  sourcingUsages: { kind: string; jobId: string | null; note: string | null }[] = [],
  huntCampaigns: {
    jobId: string | null;
    package?: { packageName: string; code: string; status: string } | null;
  }[] = [],
): RecruitmentReportJobRow[] {
  const huntPkgByJob = new Map<string, { packageName: string; code: string }>();
  for (const camp of huntCampaigns) {
    if (!camp.jobId || !camp.package) continue;
    if (camp.package.status === 'ACTIVE' || !huntPkgByJob.has(camp.jobId)) {
      huntPkgByJob.set(camp.jobId, {
        packageName: camp.package.packageName,
        code: camp.package.code,
      });
    }
  }

  const rows = new Map<
    string,
    RecruitmentReportJobRow & { matchSum: number; matchCount: number; maxMatch: number | null }
  >();

  for (const cj of companyJobs) {
    const huntPkg = huntPkgByJob.get(cj.id);
    rows.set(cj.id, {
      jobId: cj.id,
      code: cj.code ?? null,
      title: cj.title,
      status: cj.status,
      location: cj.location,
      packageName: huntPkg?.packageName ?? cj.jobPackage?.packageName ?? null,
      packageCode: huntPkg?.code ?? cj.jobPackage?.code ?? null,
      applications: 0,
      screening: 0,
      interviews: 0,
      offers: 0,
      hires: 0,
      avgMatchScore: null,
      topMatchScore: null,
      highMatchCount: 0,
      sourcingScans: 0,
      shortlisted: 0,
      outreachCount: 0,
      matchSum: 0,
      matchCount: 0,
      maxMatch: null,
    });
  }

  for (const row of applications) {
    let job = rows.get(row.jobId);
    if (!job) {
      job = {
        jobId: row.jobId,
        code: row.job.code ?? null,
        title: row.job.title,
        status: row.job.status,
        location: row.job.location,
        applications: 0,
        screening: 0,
        interviews: 0,
        offers: 0,
        hires: 0,
        avgMatchScore: null,
        topMatchScore: null,
        highMatchCount: 0,
        sourcingScans: 0,
        shortlisted: 0,
        outreachCount: 0,
        matchSum: 0,
        matchCount: 0,
        maxMatch: null,
      };
      rows.set(row.jobId, job);
    }
    job.applications += 1;
    if (row.status === ApplicationStatus.Screening) job.screening += 1;
    if (row.status === ApplicationStatus.Interview) job.interviews += 1;
    if (row.status === ApplicationStatus.Offer) job.offers += 1;
    if (row.status === ApplicationStatus.Hired) job.hires += 1;
    const score = matchScorePct(row.matchScore);
    if (score != null) {
      job.matchSum += score;
      job.matchCount += 1;
      if (score >= 70) job.highMatchCount = (job.highMatchCount ?? 0) + 1;
      if (job.maxMatch == null || score > job.maxMatch) job.maxMatch = score;
    }
  }

  for (const u of sourcingUsages) {
    if (!u.jobId) continue;
    const job = rows.get(u.jobId);
    if (!job) continue;
    if (u.kind === 'auto_scan') {
      job.sourcingScans = (job.sourcingScans ?? 0) + 1;
    } else if (u.kind === 'shortlist') {
      if (u.note?.startsWith('outreach:')) {
        job.outreachCount = (job.outreachCount ?? 0) + 1;
      } else {
        job.shortlisted = (job.shortlisted ?? 0) + 1;
      }
    }
  }

  return [...rows.values()]
    .filter(
      (job) =>
        job.applications > 0 ||
        (job.sourcingScans ?? 0) > 0 ||
        (job.shortlisted ?? 0) > 0 ||
        (job.outreachCount ?? 0) > 0 ||
        job.status === JobStatus.Published,
    )
    .map((job) => ({
      jobId: job.jobId,
      code: job.code ?? null,
      title: job.title,
      status: job.status,
      location: job.location,
      packageName: job.packageName ?? null,
      packageCode: job.packageCode ?? null,
      applications: job.applications,
      screening: job.screening,
      interviews: job.interviews,
      offers: job.offers,
      hires: job.hires,
      avgMatchScore: job.matchCount ? round1(job.matchSum / job.matchCount) : null,
      topMatchScore: job.maxMatch != null ? round1(job.maxMatch) : null,
      highMatchCount: job.highMatchCount ?? 0,
      sourcingScans: job.sourcingScans ?? 0,
      shortlisted: job.shortlisted ?? 0,
      outreachCount: job.outreachCount ?? 0,
    }))
    .sort(
      (a, b) =>
        b.applications - a.applications ||
        b.hires - a.hires ||
        (b.sourcingScans ?? 0) - (a.sourcingScans ?? 0),
    )
    .slice(0, 12);
}
