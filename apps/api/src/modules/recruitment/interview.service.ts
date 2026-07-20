import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  DomainEvents,
  InterviewStatus,
  InterviewType,
  type InterviewView,
} from '@industriallink/contracts';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from '../company/company.service';
import type { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto';

type InterviewRow = {
  id: string;
  code: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  type: string;
  status: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetingLink: string | null;
  location: string | null;
  interviewerName: string | null;
  notes: string | null;
  createdAt: Date;
  job: { title: string; company?: { name: string } | null };
  candidate: { displayName: string };
};

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly companies: CompanyService,
  ) {}

  async schedule(
    user: AuthenticatedUser,
    dto: CreateInterviewDto,
    correlationId: string,
  ): Promise<InterviewView> {
    const company = await this.companies.requireUserCompany(user.id);
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: {
        job: { select: { id: true, title: true, companyId: true } },
        candidate: { select: { id: true, displayName: true, userId: true } },
      },
    });

    if (!application || application.isDeleted) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }
    if (application.job.companyId !== company.companyId) {
      throw new ForbiddenException('Hồ sơ không thuộc công ty của bạn');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Thời gian phỏng vấn không hợp lệ');
    }

    const code = await this.codeGen.next('INT');
    const moveToInterview = dto.moveToInterview !== false;
    const prevStatus = application.status;

    const interview = await this.prisma.$transaction(async (tx) => {
      const created = await tx.interview.create({
        data: {
          code,
          tenantId: user.tenantId,
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          type: dto.type,
          status: InterviewStatus.Scheduled,
          scheduledAt,
          durationMinutes: dto.durationMinutes ?? 60,
          meetingLink: dto.meetingLink?.trim() || null,
          location: dto.location?.trim() || null,
          interviewerName: dto.interviewerName?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdBy: user.id,
        },
        include: {
          job: {
            select: { title: true, company: { select: { name: true } } },
          },
          candidate: { select: { displayName: true } },
        },
      });

      const typeLabel = interviewTypeLabel(dto.type);
      await tx.applicationTimeline.create({
        data: {
          applicationId: application.id,
          tenantId: user.tenantId,
          type: 'interview_scheduled',
          title: `Đặt lịch phỏng vấn ${typeLabel}`,
          description: [
            `Thời gian: ${scheduledAt.toLocaleString('vi-VN')}`,
            dto.location ? `Địa điểm: ${dto.location}` : null,
            dto.meetingLink ? `Link: ${dto.meetingLink}` : null,
            dto.interviewerName ? `Người PV: ${dto.interviewerName}` : null,
            dto.notes || null,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });

      if (
        moveToInterview &&
        prevStatus !== ApplicationStatus.Interview &&
        prevStatus !== ApplicationStatus.Offer &&
        prevStatus !== ApplicationStatus.Hired &&
        prevStatus !== ApplicationStatus.Rejected &&
        prevStatus !== ApplicationStatus.Withdrawn
      ) {
        await tx.application.update({
          where: { id: application.id },
          data: { status: ApplicationStatus.Interview, updatedBy: user.id },
        });
        await tx.applicationTimeline.create({
          data: {
            applicationId: application.id,
            tenantId: user.tenantId,
            type: 'status_changed',
            title: 'Chuyển sang Phỏng vấn',
            description: 'Tự động khi đặt lịch phỏng vấn',
          },
        });
      }

      return created;
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'interview.schedule',
      entityType: 'interview',
      entityId: interview.id,
      after: { code: interview.code, scheduledAt: interview.scheduledAt.toISOString() },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.InterviewScheduled,
        tenantId: user.tenantId,
        correlationId,
        payload: {
          interviewId: interview.id,
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          scheduledAt: interview.scheduledAt.toISOString(),
          type: interview.type,
        },
      }),
    );

    if (
      moveToInterview &&
      prevStatus !== ApplicationStatus.Interview &&
      prevStatus !== ApplicationStatus.Offer &&
      prevStatus !== ApplicationStatus.Hired
    ) {
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.ApplicationStatusChanged,
          tenantId: user.tenantId,
          correlationId,
          payload: {
            applicationId: application.id,
            from: prevStatus,
            to: ApplicationStatus.Interview,
          },
        }),
      );
    }

    this.logger.log(`Đã đặt lịch PV ${interview.code} cho application ${application.code}`);
    return this.toView(interview);
  }

  async listForCompany(
    user: AuthenticatedUser,
    params: { from?: string; to?: string; jobId?: string; status?: string },
  ): Promise<InterviewView[]> {
    const company = await this.companies.requireUserCompany(user.id);
    const from = params.from ? new Date(params.from) : startOfDay(new Date());
    const to = params.to
      ? new Date(params.to)
      : (() => {
          const d = new Date(from);
          d.setDate(d.getDate() + 14);
          return d;
        })();

    const rows = await this.prisma.interview.findMany({
      where: {
        isDeleted: false,
        job: { companyId: company.companyId },
        scheduledAt: { gte: from, lte: to },
        ...(params.jobId ? { jobId: params.jobId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { displayName: true } },
      },
      take: 200,
    });

    return rows.map((r) => this.toView(r));
  }

  async listMine(user: AuthenticatedUser): Promise<InterviewView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!candidate) {
      throw new BadRequestException('Chỉ ứng viên mới xem lịch phỏng vấn của mình');
    }

    const rows = await this.prisma.interview.findMany({
      where: {
        candidateId: candidate.id,
        isDeleted: false,
        status: { in: [InterviewStatus.Scheduled, InterviewStatus.Completed] },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { displayName: true } },
      },
      take: 50,
    });

    return rows.map((r) => this.toView(r));
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateInterviewDto,
    correlationId: string,
  ): Promise<InterviewView> {
    const company = await this.companies.requireUserCompany(user.id);
    const existing = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            title: true,
            companyId: true,
            company: { select: { name: true } },
          },
        },
        candidate: { select: { displayName: true } },
      },
    });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Không tìm thấy lịch phỏng vấn');
    }
    if (existing.job.companyId !== company.companyId) {
      throw new ForbiddenException('Lịch phỏng vấn không thuộc công ty của bạn');
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        type: dto.type ?? undefined,
        status: dto.status ?? undefined,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        durationMinutes: dto.durationMinutes ?? undefined,
        meetingLink:
          dto.meetingLink !== undefined ? dto.meetingLink.trim() || null : undefined,
        location: dto.location !== undefined ? dto.location.trim() || null : undefined,
        interviewerName:
          dto.interviewerName !== undefined
            ? dto.interviewerName.trim() || null
            : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
        updatedBy: user.id,
      },
      include: {
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { displayName: true } },
      },
    });

    if (dto.status === InterviewStatus.Cancelled || dto.scheduledAt) {
      await this.prisma.applicationTimeline.create({
        data: {
          applicationId: existing.applicationId,
          tenantId: user.tenantId,
          type: dto.status === InterviewStatus.Cancelled ? 'interview_cancelled' : 'interview_updated',
          title:
            dto.status === InterviewStatus.Cancelled
              ? 'Huỷ lịch phỏng vấn'
              : 'Cập nhật lịch phỏng vấn',
          description: dto.scheduledAt
            ? `Thời gian mới: ${new Date(dto.scheduledAt).toLocaleString('vi-VN')}`
            : null,
        },
      });
    }

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'interview.update',
      entityType: 'interview',
      entityId: id,
      after: { status: updated.status, scheduledAt: updated.scheduledAt.toISOString() },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.InterviewUpdated,
        tenantId: user.tenantId,
        correlationId,
        payload: {
          interviewId: updated.id,
          applicationId: updated.applicationId,
          status: updated.status,
          scheduledAt: updated.scheduledAt.toISOString(),
        },
      }),
    );

    return this.toView(updated);
  }

  /** Số buổi PV hôm nay + theo loại (dashboard). */
  async statsForCompany(user: AuthenticatedUser): Promise<{
    todayCount: number;
    next2hCount: number;
    byType: { hr: number; technical: number; other: number };
  }> {
    const company = await this.companies.requireUserCompany(user.id);
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const rows = await this.prisma.interview.findMany({
      where: {
        isDeleted: false,
        status: InterviewStatus.Scheduled,
        job: { companyId: company.companyId },
        scheduledAt: { gte: start, lte: end },
      },
      select: { type: true, scheduledAt: true },
    });

    return {
      todayCount: rows.length,
      next2hCount: rows.filter((r) => r.scheduledAt >= now && r.scheduledAt <= in2h).length,
      byType: {
        hr: rows.filter((r) => r.type === InterviewType.Hr).length,
        technical: rows.filter((r) => r.type === InterviewType.Technical).length,
        other: rows.filter((r) => r.type === InterviewType.Other).length,
      },
    };
  }

  private toView(row: InterviewRow): InterviewView {
    return {
      id: row.id,
      code: row.code,
      applicationId: row.applicationId,
      jobId: row.jobId,
      jobTitle: row.job.title,
      companyName: row.job.company?.name ?? '—',
      candidateId: row.candidateId,
      candidateName: row.candidate.displayName,
      type: row.type as InterviewType,
      status: row.status as InterviewStatus,
      scheduledAt: row.scheduledAt.toISOString(),
      durationMinutes: row.durationMinutes,
      meetingLink: row.meetingLink,
      location: row.location,
      interviewerName: row.interviewerName,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function interviewTypeLabel(type: InterviewType | string): string {
  switch (type) {
    case InterviewType.Hr:
      return 'HR';
    case InterviewType.Technical:
      return 'chuyên môn';
    default:
      return 'khác';
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
