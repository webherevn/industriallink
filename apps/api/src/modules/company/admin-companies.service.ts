import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CompanyRole,
  CompanyStatus,
  JobModerationStatus,
  JobStatus,
  type AdminCompanyDetail,
  type AdminCompanyListItem,
  type AdminCompanyListPage,
  type AdminCompanyListQuery,
  type AdminVerificationQueueItem,
  type CompanyBrandProfile,
  type ReviewCompanyVerificationRequest,
  type UpdateAdminCompanyRequest,
} from '@industriallink/contracts';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { GoogleIndexingService } from '../../shared/seo/google-indexing.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { readBrandJson, type BrandJson, type VerificationRequestStored } from './company-verification';

const LIST_SELECT = {
  id: true,
  code: true,
  slug: true,
  name: true,
  taxCode: true,
  industry: true,
  status: true,
  trustScore: true,
  profile: true,
  website: true,
  address: true,
  description: true,
  createdAt: true,
  _count: { select: { members: true, jobs: { where: { isDeleted: false } } } },
} satisfies Prisma.CompanySelect;

@Injectable()
export class AdminCompaniesService {
  private readonly logger = new Logger(AdminCompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly indexing: GoogleIndexingService,
  ) {}

  async list(query: AdminCompanyListQuery = {}): Promise<AdminCompanyListPage> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = { isDeleted: false };
    if (query.status) where.status = query.status;
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { taxCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total, grouped, publishedByCompany] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: [{ trustScore: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: LIST_SELECT,
      }),
      this.prisma.company.count({ where }),
      this.prisma.company.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.job.groupBy({
        by: ['companyId'],
        where: { isDeleted: false, status: JobStatus.Published },
        _count: { _all: true },
      }),
    ]);

    const publishedMap = new Map(publishedByCompany.map((g) => [g.companyId, g._count._all]));
    const countOf = (s: CompanyStatus) =>
      grouped.find((g) => g.status === s)?._count._all ?? 0;

    return {
      items: rows.map((r) => this.toListItem(r, publishedMap.get(r.id) ?? 0)),
      total,
      page,
      limit,
      counts: {
        total: grouped.reduce((n, g) => n + g._count._all, 0),
        active: countOf(CompanyStatus.Active),
        suspended: countOf(CompanyStatus.Suspended),
        banned: countOf(CompanyStatus.Banned),
      },
    };
  }

  async get(id: string): Promise<AdminCompanyDetail> {
    const company = await this.prisma.company.findFirst({
      where: { id, isDeleted: false },
      select: LIST_SELECT,
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const [members, jobs, publishedJobCount] = await Promise.all([
      this.prisma.companyMember.findMany({
        where: { companyId: id },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { email: true, displayName: true, status: true } },
        },
      }),
      this.prisma.job.findMany({
        where: { companyId: id, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          moderationStatus: true,
          publishedAt: true,
        },
      }),
      this.prisma.job.count({
        where: { companyId: id, isDeleted: false, status: JobStatus.Published },
      }),
    ]);

    return {
      ...this.toListItem(company, publishedJobCount),
      website: company.website,
      address: company.address,
      description: company.description,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        displayName: m.user.displayName,
        roleInCompany: m.roleInCompany as CompanyRole,
        userStatus: m.user.status,
        createdAt: m.createdAt.toISOString(),
      })),
      jobs: jobs.map((j) => ({
        id: j.id,
        code: j.code,
        title: j.title,
        status: j.status as JobStatus,
        moderationStatus: j.moderationStatus as JobModerationStatus,
        publishedAt: j.publishedAt ? j.publishedAt.toISOString() : null,
      })),
    };
  }

  async update(
    admin: AuthenticatedUser,
    id: string,
    dto: UpdateAdminCompanyRequest,
    correlationId: string,
  ): Promise<AdminCompanyDetail> {
    const company = await this.prisma.company.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, name: true, status: true, trustScore: true, profile: true, tenantId: true },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const data: Prisma.CompanyUpdateInput = { updatedBy: admin.id };
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.trustScore !== undefined) data.trustScore = dto.trustScore;
    if (dto.verified !== undefined || dto.trustedEmployer !== undefined) {
      data.profile = this.mergeBrandFlags(company.profile, {
        verified: dto.verified,
        trustedEmployer: dto.trustedEmployer,
      }) as Prisma.InputJsonValue;
    }

    await this.prisma.company.update({ where: { id }, data });

    if (dto.status && dto.status !== company.status) {
      await this.applyStatusToJobs(id, dto.status);
    }

    await this.audit.record({
      tenantId: admin.tenantId,
      actorId: admin.id,
      action: 'company.admin.update',
      entityType: 'company',
      entityId: id,
      before: { status: company.status, trustScore: company.trustScore },
      after: { ...dto },
      correlationId,
    });
    this.logger.log(`SuperAdmin cập nhật công ty ${company.name}: ${JSON.stringify(dto)}`);
    return this.get(id);
  }

  async listVerification(
    status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
  ): Promise<AdminVerificationQueueItem[]> {
    const statuses: VerificationRequestStored['status'][] =
      status === 'all' ? ['pending', 'approved', 'rejected'] : [status];
    const rows = await this.prisma.company.findMany({
      where: {
        isDeleted: false,
        OR: statuses.map((value) => ({
          profile: { path: ['verificationRequest', 'status'], equals: value },
        })),
      },
      select: { id: true, code: true, name: true, status: true, profile: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const actorIds = rows
      .map((row) => readBrandJson(row.profile).verificationRequest?.requestedBy)
      .filter((id): id is string => Boolean(id));
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    return rows.flatMap((row) => {
      const brand = readBrandJson(row.profile);
      const req = brand.verificationRequest;
      if (!req) return [];
      return [
        {
          companyId: row.id,
          companyCode: row.code,
          companyName: row.name,
          companyStatus: row.status,
          verified: Boolean(brand.verified),
          trustedEmployer: Boolean(brand.trustedEmployer),
          requestStatus: req.status,
          note: req.note,
          reviewNote: req.reviewNote ?? null,
          requestedAt: req.requestedAt,
          requestedByEmail: emailById.get(req.requestedBy) ?? null,
          askVerified: req.askVerified,
          askTrusted: req.askTrusted,
        },
      ];
    });
  }

  async reviewVerification(
    admin: AuthenticatedUser,
    id: string,
    dto: ReviewCompanyVerificationRequest,
    correlationId: string,
  ): Promise<AdminVerificationQueueItem> {
    const company = await this.prisma.company.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, code: true, name: true, status: true, profile: true, tenantId: true },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    const brand = readBrandJson(company.profile);
    const req = brand.verificationRequest;
    if (!req || req.status !== 'pending') {
      throw new BadRequestException('Không có đơn xác minh đang chờ');
    }

    if (dto.decision === 'approve') {
      brand.verified = dto.verified ?? (req.askVerified ? true : Boolean(brand.verified));
      brand.trustedEmployer =
        dto.trustedEmployer ?? (req.askTrusted ? true : Boolean(brand.trustedEmployer));
      req.status = 'approved';
    } else {
      req.status = 'rejected';
    }
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = admin.id;
    req.reviewNote = dto.reviewNote?.trim() || null;
    brand.verificationRequest = req;

    await this.prisma.company.update({
      where: { id },
      data: { profile: brand as Prisma.InputJsonValue, updatedBy: admin.id },
    });
    await this.audit.record({
      tenantId: admin.tenantId,
      actorId: admin.id,
      action: `company.verification.${dto.decision}`,
      entityType: 'company',
      entityId: id,
      after: {
        decision: dto.decision,
        verified: Boolean(brand.verified),
        trustedEmployer: Boolean(brand.trustedEmployer),
        reviewNote: req.reviewNote,
      },
      correlationId,
    });

    const actor = await this.prisma.user.findUnique({
      where: { id: req.requestedBy },
      select: { email: true },
    });
    return this.toQueueItem(company, brand, actor?.email ?? null);
  }

  private toQueueItem(
    company: { id: string; code: string; name: string; status: string },
    brand: BrandJson,
    email: string | null,
  ): AdminVerificationQueueItem {
    const req = brand.verificationRequest!;
    return {
      companyId: company.id,
      companyCode: company.code,
      companyName: company.name,
      companyStatus: company.status,
      verified: Boolean(brand.verified),
      trustedEmployer: Boolean(brand.trustedEmployer),
      requestStatus: req.status,
      note: req.note,
      reviewNote: req.reviewNote ?? null,
      requestedAt: req.requestedAt,
      requestedByEmail: email,
      askVerified: req.askVerified,
      askTrusted: req.askTrusted,
    };
  }

  /** Treo → ẩn tin đang đăng. Cấm → đóng tin đang đăng. */
  private async applyStatusToJobs(companyId: string, status: CompanyStatus): Promise<void> {
    if (status === CompanyStatus.Active) return;
    const nextJobStatus =
      status === CompanyStatus.Banned ? JobStatus.Closed : JobStatus.Paused;

    const live = await this.prisma.job.findMany({
      where: { companyId, isDeleted: false, status: JobStatus.Published },
      select: { id: true, slug: true, industry: true },
    });
    if (!live.length) return;

    await this.prisma.job.updateMany({
      where: { id: { in: live.map((j) => j.id) } },
      data: { status: nextJobStatus },
    });
    for (const job of live) {
      void this.indexing.notifyJob(job, 'URL_DELETED');
    }
  }

  private mergeBrandFlags(
    raw: Prisma.JsonValue | null,
    flags: { verified?: boolean; trustedEmployer?: boolean },
  ): CompanyBrandProfile {
    const base =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? ({ ...(raw as CompanyBrandProfile) } as CompanyBrandProfile)
        : {};
    if (flags.verified !== undefined) base.verified = flags.verified;
    if (flags.trustedEmployer !== undefined) base.trustedEmployer = flags.trustedEmployer;
    return base;
  }

  private toListItem(
    row: Prisma.CompanyGetPayload<{ select: typeof LIST_SELECT }>,
    publishedJobCount: number,
  ): AdminCompanyListItem {
    const brand =
      row.profile && typeof row.profile === 'object' && !Array.isArray(row.profile)
        ? (row.profile as CompanyBrandProfile)
        : {};
    return {
      id: row.id,
      code: row.code,
      slug: row.slug,
      name: row.name,
      taxCode: row.taxCode,
      industry: row.industry,
      status: (row.status as CompanyStatus) || CompanyStatus.Active,
      trustScore: row.trustScore,
      verified: Boolean(brand.verified),
      trustedEmployer: Boolean(brand.trustedEmployer),
      memberCount: row._count.members,
      jobCount: row._count.jobs,
      publishedJobCount,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
