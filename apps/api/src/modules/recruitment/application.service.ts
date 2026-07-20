import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  DomainEvents,
  JobStatus,
  type ApplicantView,
  type ApplicationDetailView,
  type ApplicationView,
  type InboxApplicantView,
  type RecruiterWorkspaceSummary,
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
import { CompanyService } from '../company/company.service';
import { JobService } from './job.service';
import { MatchingService } from './matching.service';
import { skillOverlap } from './matching.util';
import type { ApplyJobDto, UpdateApplicationStatusDto } from './dto/apply-job.dto';
import type { BroadcastEmailDto } from './dto/broadcast-email.dto';

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
  ) {}

  async apply(
    user: AuthenticatedUser,
    jobId: string,
    dto: ApplyJobDto,
    correlationId: string,
  ): Promise<ApplicationView> {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId: user.id } });
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

    const existing = await this.prisma.application.findUnique({
      where: { jobId_candidateId: { jobId, candidateId: candidate.id } },
    });
    if (existing) {
      throw new BadRequestException('Bạn đã ứng tuyển vị trí này');
    }

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

  /** Danh sách ứng viên đã ứng tuyển vào một tin (phía nhà tuyển dụng). */
  async listApplicants(user: AuthenticatedUser, jobId: string): Promise<ApplicantView[]> {
    const job = await this.jobs.requireOwnedJob(user, jobId);
    const requiredSkills = job.skills.filter((s) => s.required).map((s) => s.name);

    const applications = await this.prisma.application.findMany({
      where: { jobId, isDeleted: false },
      orderBy: [{ matchScore: 'desc' }, { createdAt: 'asc' }],
      include: { candidate: { include: { profile: true, skills: true } } },
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

    const applications = await this.prisma.application.findMany({
      where: {
        jobId,
        isDeleted: false,
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

    if (applications.length === 0) {
      throw new BadRequestException('Không có ứng viên nào khớp bộ lọc để gửi email');
    }

    const applicationsUrl = `${this.email.webOrigin}/applications`;
    const messages = applications.map((a) =>
      buildBroadcastEmail({
        candidateName: a.candidate.displayName,
        candidateEmail: a.candidate.user.email,
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
        recipients: applications.length,
        sent: result.sent,
        failed: result.failed,
      },
      correlationId,
    });

    // Ghi timeline trên tối đa 20 hồ sơ để không làm chậm request.
    const timelineSlice = applications.slice(0, 20);
    if (timelineSlice.length > 0) {
      await this.prisma.applicationTimeline.createMany({
        data: timelineSlice.map((a) => ({
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
      failed: result.failed,
    };
  }
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
