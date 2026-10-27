import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  DomainEvents,
  InterviewStatus,
  InterviewType,
  JobStatus,
  type ApplicantView,
  type ApplicationDetailView,
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
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { buildBroadcastEmail } from '../../shared/infrastructure/email/broadcast-email.templates';
import { EmailService } from '../../shared/infrastructure/email/email.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
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
import { candidateMatchTrack, jobMatchTrack } from './match-track.util';
import { MatchingService } from './matching.service';
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
      include: { company: { select: { name: true } } },
    });
    if (!job || job.isDeleted) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    if (job.status !== JobStatus.Published) {
      throw new BadRequestException('Tin tuyển dụng chưa mở nhận hồ sơ');
    }
    if (job.deadline) {
      const todayVn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
        new Date(),
      );
      if (job.deadline.toISOString().slice(0, 10) < todayVn) {
        throw new BadRequestException('Tin tuyển dụng đã hết hạn hiển thị');
      }
    }

    const existing = await this.prisma.application.findUnique({
      where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
    });
    if (existing) {
      throw new BadRequestException('Bạn đã ứng tuyển vị trí này');
    }

    assertCompatibleApplyTrack(candidate, job);

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
    };
  }

  async myApplications(user: AuthenticatedUser): Promise<ApplicationView[]> {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId: user.id } });
    if (!candidate) return [];

    const applications = await this.prisma.application.findMany({
      where: { candidateId: candidate.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: { job: { include: { company: { select: { name: true } } } } },
    });

    return applications.map((a) => ({
      id: a.id,
      code: a.code,
      jobId: a.jobId,
      jobTitle: a.job.title,
      companyName: a.job.company.name,
      location: a.job.location,
      salaryMin: a.job.salaryMin,
      salaryMax: a.job.salaryMax,
      status: a.status as ApplicationStatus,
      matchScore: a.matchScore,
      coverLetter: a.coverLetter,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /** Chi tiết đơn + timeline — chỉ chủ sở hữu (ứng viên). */
  async getMineDetail(
    user: AuthenticatedUser,
    applicationId: string,
  ): Promise<ApplicationDetailView> {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId: user.id } });
    if (!candidate) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, candidateId: candidate.id, isDeleted: false },
      include: {
        job: { include: { company: { select: { name: true } } } },
        timeline: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }

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
      matchScore: application.matchScore,
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
        candidate: { include: { profile: true, skills: true } },
        interviews: interviewInclude,
      },
    });

    return applications.map((a) => {
      const requiredSkills = a.job.skills.filter((s) => s.required).map((s) => s.name);
      const { matched } = skillOverlap(
        requiredSkills,
        a.candidate.skills.map((s) => s.name),
      );
      return {
        applicationId: a.id,
        candidateId: a.candidateId,
        displayName: a.candidate.displayName,
        currentPosition: a.candidate.profile?.currentPosition ?? null,
        industry: a.candidate.profile?.industry ?? null,
        status: a.status as ApplicationStatus,
        matchScore: a.matchScore,
        matchedSkills: matched,
        coverLetter: a.coverLetter,
        createdAt: a.createdAt.toISOString(),
        interviews: interviewMarks(a.interviews),
        jobId: a.jobId,
        jobTitle: a.job.title,
      };
    });
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
      };
    }

    const companyId = membership.companyId;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
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
    ]);

    const { avgTimeToHireDays, avgTimeToHireDeltaDays } = computeTimeToHireStats(
      hiredApplications,
      now,
    );

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
    };
  }

  /** Báo cáo tuyển dụng: hồ sơ nhận trong kỳ, phễu trạng thái hiện tại và hiệu suất từng tin. */
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

    const [openJobs, applications, applicationsPrev, interviewSessions, offersSent, hiredRows] =
      await Promise.all([
        this.prisma.job.count({
          where: { ...jobScope, status: JobStatus.Published },
        }),
        this.prisma.application.findMany({
          where: { isDeleted: false, createdAt: { gte: from }, job: jobScope },
          select: {
            status: true,
            createdAt: true,
            updatedAt: true,
            matchScore: true,
            jobId: true,
            job: { select: { title: true, status: true, location: true } },
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
      ]);

    const count = (status: ApplicationStatus) =>
      applications.filter((row) => row.status === status).length;
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
    const hireDays = hiredRows.map(
      (row) => (row.updatedAt.getTime() - row.createdAt.getTime()) / MS_PER_DAY,
    );
    const avgTimeToHireDays = hireDays.length ? round1(average(hireDays)) : null;
    const conversionPct = applications.length
      ? round1((hires / applications.length) * 100)
      : null;

    const funnel: RecruitmentReportFunnelStep[] = [
      { key: 'applied', label: 'Ứng tuyển', count: count(ApplicationStatus.Applied) },
      { key: 'screening', label: 'Sàng lọc', count: screening },
      { key: 'interview', label: 'Phỏng vấn', count: interviews },
      { key: 'offer', label: 'Đề nghị', count: offers },
      { key: 'hired', label: 'Nhận việc', count: hires },
    ];

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
      avgTimeToHireDays,
      conversionPct,
      funnel,
      trend: buildReportTrend(days, from, now, applications, hiredRows),
      jobs: buildReportJobs(applications),
    };
  }

  /** Danh sách ứng viên đã ứng tuyển vào một tin (phía nhà tuyển dụng). */
  async listApplicants(user: AuthenticatedUser, jobId: string): Promise<ApplicantView[]> {
    const job = await this.jobs.requireOwnedJob(user, jobId);
    const requiredSkills = job.skills.filter((s) => s.required).map((s) => s.name);

    const applications = await this.prisma.application.findMany({
      where: { jobId, isDeleted: false },
      orderBy: [{ matchScore: 'desc' }, { createdAt: 'asc' }],
      include: {
        candidate: { include: { profile: true, skills: true } },
        interviews: interviewInclude,
      },
    });

    return applications.map((a) => {
      const { matched } = skillOverlap(
        requiredSkills,
        a.candidate.skills.map((s) => s.name),
      );
      return {
        applicationId: a.id,
        candidateId: a.candidateId,
        displayName: a.candidate.displayName,
        currentPosition: a.candidate.profile?.currentPosition ?? null,
        industry: a.candidate.profile?.industry ?? null,
        status: a.status as ApplicationStatus,
        matchScore: a.matchScore,
        matchedSkills: matched,
        coverLetter: a.coverLetter,
        createdAt: a.createdAt.toISOString(),
        interviews: interviewMarks(a.interviews),
      };
    });
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
  ): Promise<{ recipients: number; sent: number; failed: number }> {
    const job = await this.jobs.requireOwnedJob(user, jobId);
    const subject = dto.subject.trim();
    const body = dto.body.trim();
    if (!subject || !body) {
      throw new BadRequestException('Tiêu đề và nội dung không được để trống');
    }

    const applicationIds = dto.applicationIds ? [...new Set(dto.applicationIds)] : undefined;
    const applications = await this.prisma.application.findMany({
      where: {
        jobId,
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

    const withEmail = applications.filter((a) => a.candidate.user?.email);
    const missingEmail = applications.length - withEmail.length;
    if (withEmail.length === 0) {
      throw new BadRequestException('Ứng viên đã chọn chưa có email trên tài khoản');
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
        recipients: applications.length,
        sent: result.sent,
        failed: result.failed + missingEmail,
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
    }

    this.logger.log(
      `broadcast-email job=${jobId} recipients=${applications.length} sent=${result.sent}`,
    );

    return {
      recipients: applications.length,
      sent: result.sent,
      failed: result.failed + missingEmail,
    };
  }
}

/**
 * Chặn nộp chéo track (KD↔KT). Thiếu track ứng viên → bắt hoàn thiện hồ sơ.
 * Tin legacy không suy ra được track → vẫn cho nộp.
 */
function assertCompatibleApplyTrack(
  candidate: { profile?: { jobTrack?: string | null } | null },
  job: Parameters<typeof jobMatchTrack>[0],
): void {
  const candTrack = candidateMatchTrack(candidate);
  if (!candTrack) {
    throw new BadRequestException(
      'Vui lòng chọn lĩnh vực hồ sơ (Kinh doanh hoặc Kỹ thuật) trước khi ứng tuyển',
    );
  }

  const jobTrack = jobMatchTrack(job);
  if (!jobTrack || jobTrack === candTrack) return;

  throw new BadRequestException(
    candTrack === 'sales'
      ? 'Hồ sơ Kinh doanh không thể nộp tin Kỹ thuật'
      : 'Hồ sơ Kỹ thuật không thể nộp tin Kinh doanh',
  );
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
  { key: 'applied', label: 'Ứng tuyển', count: 0 },
  { key: 'screening', label: 'Sàng lọc', count: 0 },
  { key: 'interview', label: 'Phỏng vấn', count: 0 },
  { key: 'offer', label: 'Đề nghị', count: 0 },
  { key: 'hired', label: 'Nhận việc', count: 0 },
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
    avgTimeToHireDays: null,
    conversionPct: null,
    funnel: REPORT_FUNNEL.map((step) => ({ ...step })),
    trend: [],
    jobs: [],
  };
}

function matchScorePct(score: number | null): number | null {
  if (score == null || Number.isNaN(score)) return null;
  const scaled = score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, scaled));
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
    job: { title: string; status: string; location: string | null };
  }[],
): RecruitmentReportJobRow[] {
  const rows = new Map<
    string,
    RecruitmentReportJobRow & { matchSum: number; matchCount: number }
  >();
  for (const row of applications) {
    let job = rows.get(row.jobId);
    if (!job) {
      job = {
        jobId: row.jobId,
        title: row.job.title,
        status: row.job.status,
        location: row.job.location,
        applications: 0,
        screening: 0,
        interviews: 0,
        offers: 0,
        hires: 0,
        avgMatchScore: null,
        matchSum: 0,
        matchCount: 0,
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
    }
  }

  return [...rows.values()]
    .map((job) => ({
      jobId: job.jobId,
      title: job.title,
      status: job.status,
      location: job.location,
      applications: job.applications,
      screening: job.screening,
      interviews: job.interviews,
      offers: job.offers,
      hires: job.hires,
      avgMatchScore: job.matchCount ? round1(job.matchSum / job.matchCount) : null,
    }))
    .sort((a, b) => b.applications - a.applications || b.hires - a.hires)
    .slice(0, 12);
}
