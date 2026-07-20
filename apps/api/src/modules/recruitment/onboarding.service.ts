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
  OnboardingStatus,
  type OnboardingView,
} from '@industriallink/contracts';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { onboardingStatusLabel } from '../../shared/domain/onboarding-status.label';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from '../company/company.service';
import type { CreateOnboardingDto, UpdateOnboardingDto } from './dto/onboarding.dto';

type OnboardingRow = {
  id: string;
  code: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  status: string;
  startDate: Date;
  reportLocation: string | null;
  contactName: string | null;
  contactPhone: string | null;
  checklist: string | null;
  notes: string | null;
  createdAt: Date;
  job: { title: string; company?: { name: string } | null };
  candidate: { displayName: string };
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly companies: CompanyService,
  ) {}

  async start(
    user: AuthenticatedUser,
    dto: CreateOnboardingDto,
    correlationId: string,
  ): Promise<OnboardingView> {
    const company = await this.companies.requireUserCompany(user.id);
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: {
        job: { select: { id: true, title: true, companyId: true } },
        candidate: { select: { id: true, displayName: true } },
      },
    });

    if (!application || application.isDeleted) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }
    if (application.job.companyId !== company.companyId) {
      throw new ForbiddenException('Hồ sơ không thuộc công ty của bạn');
    }

    const existing = await this.prisma.onboarding.findFirst({
      where: {
        applicationId: application.id,
        isDeleted: false,
        status: { in: [OnboardingStatus.Pending, OnboardingStatus.InProgress] },
      },
    });
    if (existing) {
      throw new BadRequestException('Hồ sơ này đã có quy trình onboarding đang mở');
    }

    const startDate = new Date(dto.startDate);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Ngày nhận việc không hợp lệ');
    }

    const code = await this.codeGen.next('ONB');
    const moveToHired = dto.moveToHired !== false;
    const prevStatus = application.status;

    const onboarding = await this.prisma.$transaction(async (tx) => {
      const created = await tx.onboarding.create({
        data: {
          code,
          tenantId: user.tenantId,
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          status: OnboardingStatus.Pending,
          startDate,
          reportLocation: dto.reportLocation?.trim() || null,
          contactName: dto.contactName?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          checklist: dto.checklist?.trim() || null,
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

      await tx.applicationTimeline.create({
        data: {
          applicationId: application.id,
          tenantId: user.tenantId,
          type: 'onboarding_started',
          title: 'Bắt đầu onboarding',
          description: [
            `Ngày nhận việc: ${dto.startDate}`,
            dto.reportLocation ? `Địa điểm: ${dto.reportLocation}` : null,
            dto.contactName ? `Liên hệ: ${dto.contactName}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });

      if (
        moveToHired &&
        prevStatus !== ApplicationStatus.Hired &&
        prevStatus !== ApplicationStatus.Rejected &&
        prevStatus !== ApplicationStatus.Withdrawn
      ) {
        await tx.application.update({
          where: { id: application.id },
          data: { status: ApplicationStatus.Hired, updatedBy: user.id },
        });
        await tx.applicationTimeline.create({
          data: {
            applicationId: application.id,
            tenantId: user.tenantId,
            type: 'status_changed',
            title: 'Chuyển sang Trúng tuyển',
            description: 'Tự động khi bắt đầu onboarding',
          },
        });
      }

      return created;
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'onboarding.start',
      entityType: 'onboarding',
      entityId: onboarding.id,
      after: { code: onboarding.code, startDate: dto.startDate },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.OnboardingStarted,
        tenantId: user.tenantId,
        correlationId,
        payload: {
          onboardingId: onboarding.id,
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          startDate: dto.startDate,
        },
      }),
    );

    if (moveToHired && prevStatus !== ApplicationStatus.Hired) {
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.ApplicationStatusChanged,
          tenantId: user.tenantId,
          correlationId,
          payload: {
            applicationId: application.id,
            from: prevStatus,
            to: ApplicationStatus.Hired,
          },
        }),
      );
    }

    this.logger.log(`Đã tạo onboarding ${onboarding.code}`);
    return this.toView(onboarding);
  }

  async listForCompany(
    user: AuthenticatedUser,
    params: { jobId?: string; status?: string },
  ): Promise<OnboardingView[]> {
    const company = await this.companies.requireUserCompany(user.id);
    const rows = await this.prisma.onboarding.findMany({
      where: {
        isDeleted: false,
        job: { companyId: company.companyId },
        ...(params.jobId ? { jobId: params.jobId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { startDate: 'asc' },
      include: {
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { displayName: true } },
      },
      take: 100,
    });
    return rows.map((r) => this.toView(r));
  }

  async listMine(user: AuthenticatedUser): Promise<OnboardingView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!candidate) {
      throw new BadRequestException('Chỉ ứng viên mới xem onboarding của mình');
    }
    const rows = await this.prisma.onboarding.findMany({
      where: { candidateId: candidate.id, isDeleted: false },
      orderBy: { startDate: 'desc' },
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
    dto: UpdateOnboardingDto,
    correlationId: string,
  ): Promise<OnboardingView> {
    const company = await this.companies.requireUserCompany(user.id);
    const existing = await this.prisma.onboarding.findUnique({
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
      throw new NotFoundException('Không tìm thấy onboarding');
    }
    if (existing.job.companyId !== company.companyId) {
      throw new ForbiddenException('Onboarding không thuộc công ty của bạn');
    }

    const updated = await this.prisma.onboarding.update({
      where: { id },
      data: {
        status: dto.status ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        reportLocation:
          dto.reportLocation !== undefined ? dto.reportLocation.trim() || null : undefined,
        contactName:
          dto.contactName !== undefined ? dto.contactName.trim() || null : undefined,
        contactPhone:
          dto.contactPhone !== undefined ? dto.contactPhone.trim() || null : undefined,
        checklist: dto.checklist !== undefined ? dto.checklist.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
        updatedBy: user.id,
      },
      include: {
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { displayName: true } },
      },
    });

    if (dto.status) {
      await this.prisma.applicationTimeline.create({
        data: {
          applicationId: existing.applicationId,
          tenantId: user.tenantId,
          type: 'onboarding_updated',
          title: `Cập nhật nhận việc → ${onboardingStatusLabel(dto.status)}`,
          description: null,
        },
      });
    }

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'onboarding.update',
      entityType: 'onboarding',
      entityId: id,
      after: { status: updated.status },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.OnboardingUpdated,
        tenantId: user.tenantId,
        correlationId,
        payload: {
          onboardingId: updated.id,
          applicationId: updated.applicationId,
          status: updated.status,
        },
      }),
    );

    return this.toView(updated);
  }

  private toView(row: OnboardingRow): OnboardingView {
    return {
      id: row.id,
      code: row.code,
      applicationId: row.applicationId,
      jobId: row.jobId,
      jobTitle: row.job.title,
      companyName: row.job.company?.name ?? '—',
      candidateId: row.candidateId,
      candidateName: row.candidate.displayName,
      status: row.status as OnboardingStatus,
      startDate: row.startDate.toISOString().slice(0, 10),
      reportLocation: row.reportLocation,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      checklist: row.checklist,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
