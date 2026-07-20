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
  OfferStatus,
  type OfferView,
} from '@industriallink/contracts';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { offerStatusLabel } from '../../shared/domain/offer-status.label';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from '../company/company.service';
import type { CreateOfferDto, RespondOfferDto, UpdateOfferDto } from './dto/offer.dto';

type OfferRow = {
  id: string;
  code: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  status: string;
  salary: number;
  currency: string;
  startDate: Date | null;
  expiresAt: Date | null;
  benefits: string | null;
  notes: string | null;
  createdAt: Date;
  job: { title: string; company?: { name: string } | null };
  candidate: { displayName: string };
};

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly companies: CompanyService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateOfferDto,
    correlationId: string,
  ): Promise<OfferView> {
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

    const pending = await this.prisma.offer.findFirst({
      where: {
        applicationId: application.id,
        status: OfferStatus.Pending,
        isDeleted: false,
      },
    });
    if (pending) {
      throw new BadRequestException(
        'Đã có offer đang chờ phản hồi cho hồ sơ này. Hãy cập nhật hoặc rút offer cũ.',
      );
    }

    const code = await this.codeGen.next('OFR');
    const moveToOffer = dto.moveToOffer !== false;
    const prevStatus = application.status;

    const offer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.offer.create({
        data: {
          code,
          tenantId: user.tenantId,
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          status: OfferStatus.Pending,
          salary: dto.salary,
          currency: dto.currency?.trim() || 'VND',
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          benefits: dto.benefits?.trim() || null,
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
          type: 'offer_sent',
          title: 'Gửi đề nghị tuyển dụng (Offer)',
          description: [
            `Mức lương: ${dto.salary.toLocaleString('vi-VN')} ${dto.currency ?? 'VND'}/tháng`,
            dto.startDate ? `Ngày nhận việc: ${dto.startDate}` : null,
            dto.expiresAt ? `Hạn phản hồi: ${dto.expiresAt}` : null,
            dto.notes || null,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });

      if (
        moveToOffer &&
        prevStatus !== ApplicationStatus.Offer &&
        prevStatus !== ApplicationStatus.Hired &&
        prevStatus !== ApplicationStatus.Rejected &&
        prevStatus !== ApplicationStatus.Withdrawn
      ) {
        await tx.application.update({
          where: { id: application.id },
          data: { status: ApplicationStatus.Offer, updatedBy: user.id },
        });
        await tx.applicationTimeline.create({
          data: {
            applicationId: application.id,
            tenantId: user.tenantId,
            type: 'status_changed',
            title: 'Chuyển sang Đề nghị (Offer)',
            description: 'Tự động khi gửi offer',
          },
        });
      }

      return created;
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'offer.create',
      entityType: 'offer',
      entityId: offer.id,
      after: { code: offer.code, salary: offer.salary, status: offer.status },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.OfferSent,
        tenantId: user.tenantId,
        correlationId,
        payload: {
          offerId: offer.id,
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidateId,
          salary: offer.salary,
          currency: offer.currency,
        },
      }),
    );

    if (
      moveToOffer &&
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
            to: ApplicationStatus.Offer,
          },
        }),
      );
    }

    this.logger.log(`Đã gửi offer ${offer.code} cho application ${application.code}`);
    return this.toView(offer);
  }

  async listForCompany(
    user: AuthenticatedUser,
    params: { jobId?: string; status?: string },
  ): Promise<OfferView[]> {
    const company = await this.companies.requireUserCompany(user.id);
    const rows = await this.prisma.offer.findMany({
      where: {
        isDeleted: false,
        job: { companyId: company.companyId },
        ...(params.jobId ? { jobId: params.jobId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { displayName: true } },
      },
      take: 100,
    });
    return rows.map((r) => this.toView(r));
  }

  async listMine(user: AuthenticatedUser): Promise<OfferView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!candidate) {
      throw new BadRequestException('Chỉ ứng viên mới xem offer của mình');
    }
    const rows = await this.prisma.offer.findMany({
      where: { candidateId: candidate.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
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
    dto: UpdateOfferDto,
    correlationId: string,
  ): Promise<OfferView> {
    const company = await this.companies.requireUserCompany(user.id);
    const existing = await this.prisma.offer.findUnique({
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
      throw new NotFoundException('Không tìm thấy offer');
    }
    if (existing.job.companyId !== company.companyId) {
      throw new ForbiddenException('Offer không thuộc công ty của bạn');
    }

    const updated = await this.prisma.offer.update({
      where: { id },
      data: {
        status: dto.status ?? undefined,
        salary: dto.salary ?? undefined,
        currency: dto.currency ?? undefined,
        startDate:
          dto.startDate !== undefined
            ? dto.startDate
              ? new Date(dto.startDate)
              : null
            : undefined,
        expiresAt:
          dto.expiresAt !== undefined
            ? dto.expiresAt
              ? new Date(dto.expiresAt)
              : null
            : undefined,
        benefits: dto.benefits !== undefined ? dto.benefits.trim() || null : undefined,
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
          type: 'offer_updated',
          title: `Cập nhật đề nghị làm việc → ${offerStatusLabel(dto.status)}`,
          description: null,
        },
      });

      if (dto.status === OfferStatus.Accepted) {
        await this.prisma.application.update({
          where: { id: existing.applicationId },
          data: { status: ApplicationStatus.Hired, updatedBy: user.id },
        });
      }
    }

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'offer.update',
      entityType: 'offer',
      entityId: id,
      after: { status: updated.status, salary: updated.salary },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.OfferUpdated,
        tenantId: user.tenantId,
        correlationId,
        payload: {
          offerId: updated.id,
          applicationId: updated.applicationId,
          status: updated.status,
        },
      }),
    );

    return this.toView(updated);
  }

  /** Ứng viên chấp nhận / từ chối đề nghị làm việc của chính mình. */
  async respond(
    user: AuthenticatedUser,
    id: string,
    dto: RespondOfferDto,
    correlationId: string,
  ): Promise<OfferView> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!candidate) {
      throw new BadRequestException('Chỉ ứng viên mới phản hồi được offer');
    }

    const existing = await this.prisma.offer.findUnique({
      where: { id },
      include: {
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { displayName: true } },
      },
    });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Không tìm thấy offer');
    }
    if (existing.candidateId !== candidate.id) {
      throw new ForbiddenException('Offer không thuộc về bạn');
    }
    if (existing.status !== OfferStatus.Pending) {
      throw new BadRequestException('Offer này đã được phản hồi trước đó');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.offer.update({
        where: { id },
        data: { status: dto.status, updatedBy: user.id },
        include: {
          job: {
            select: { title: true, company: { select: { name: true } } },
          },
          candidate: { select: { displayName: true } },
        },
      });

      const accepted = dto.status === OfferStatus.Accepted;
      await tx.application.update({
        where: { id: existing.applicationId },
        data: {
          status: accepted ? ApplicationStatus.Hired : ApplicationStatus.Withdrawn,
          updatedBy: user.id,
        },
      });

      await tx.applicationTimeline.create({
        data: {
          applicationId: existing.applicationId,
          tenantId: user.tenantId,
          type: 'offer_responded',
          title: accepted
            ? 'Ứng viên đã chấp nhận đề nghị làm việc'
            : 'Ứng viên đã từ chối đề nghị làm việc',
          description: null,
        },
      });

      return result;
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'offer.respond',
      entityType: 'offer',
      entityId: id,
      after: { status: updated.status },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.OfferUpdated,
        tenantId: user.tenantId,
        correlationId,
        payload: {
          offerId: updated.id,
          applicationId: updated.applicationId,
          status: updated.status,
        },
      }),
    );

    this.logger.log(`Ứng viên phản hồi offer ${updated.code} → ${updated.status}`);
    return this.toView(updated);
  }

  private toView(row: OfferRow): OfferView {
    return {
      id: row.id,
      code: row.code,
      applicationId: row.applicationId,
      jobId: row.jobId,
      jobTitle: row.job.title,
      companyName: row.job.company?.name ?? '—',
      candidateId: row.candidateId,
      candidateName: row.candidate.displayName,
      status: row.status as OfferStatus,
      salary: row.salary,
      currency: row.currency,
      startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString().slice(0, 10) : null,
      benefits: row.benefits,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
