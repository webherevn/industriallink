import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyRole,
  CompanySize,
  DomainEvents,
  JobStatus,
  type CompanyBrandProfile,
  type CompanyJobCard,
  type CompanyMemberView,
  type CompanyPublicProfileView,
  type CompanyView,
  type UploadCompanyLogoResponse,
} from '@industriallink/contracts';
import type { Company, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';

/** Vai trò có quyền quản trị công ty (mời/gỡ thành viên, sửa hồ sơ). */
const ADMIN_ROLES: CompanyRole[] = [CompanyRole.Owner, CompanyRole.Admin];

const LOGO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const LOGO_MAX_SIZE = 2 * 1024 * 1024;

type BrandProfileStored = CompanyBrandProfile & {
  logoStorageKey?: string | null;
  logoMime?: string | null;
};

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async createCompany(
    user: AuthenticatedUser,
    dto: CreateCompanyDto,
    correlationId: string,
  ): Promise<CompanyView> {
    const existing = await this.prisma.companyMember.findFirst({
      where: { userId: user.id },
    });
    if (existing) {
      throw new BadRequestException('Bạn đã thuộc một công ty, không thể tạo thêm');
    }

    const code = await this.codeGen.next('COM');
    const company = await this.prisma.company.create({
      data: {
        code,
        tenantId: user.tenantId,
        name: dto.name,
        taxCode: dto.taxCode ?? null,
        industry: dto.industry ?? null,
        size: dto.size ?? null,
        address: dto.address ?? null,
        website: dto.website ?? null,
        description: dto.description ?? null,
        createdBy: user.id,
        members: {
          create: {
            userId: user.id,
            roleInCompany: CompanyRole.Owner,
          },
        },
      },
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'company.create',
      entityType: 'company',
      entityId: company.id,
      after: { code: company.code, name: company.name },
      correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.CompanyCreated,
        tenantId: user.tenantId,
        correlationId,
        payload: { companyId: company.id, code: company.code, name: company.name },
      }),
    );

    this.logger.log(`Đã tạo Company ${code} cho user ${user.id}`);
    return this.toView(company, 1, CompanyRole.Owner);
  }

  async getMyCompany(user: AuthenticatedUser): Promise<CompanyView> {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId: user.id },
      include: { company: true },
    });
    if (!membership) {
      throw new NotFoundException('Bạn chưa có công ty');
    }
    const memberCount = await this.prisma.companyMember.count({
      where: { companyId: membership.companyId },
    });
    return this.toView(membership.company, memberCount, membership.roleInCompany as CompanyRole);
  }

  async updateMyCompany(
    user: AuthenticatedUser,
    dto: CreateCompanyDto,
    correlationId: string,
  ): Promise<CompanyView> {
    const membership = await this.requireMembership(user.id);
    this.requireAdmin(membership.roleInCompany as CompanyRole);

    const before = await this.prisma.company.findUnique({ where: { id: membership.companyId } });
    const updated = await this.prisma.company.update({
      where: { id: membership.companyId },
      data: {
        name: dto.name,
        taxCode: dto.taxCode ?? null,
        industry: dto.industry ?? null,
        size: dto.size ?? null,
        address: dto.address ?? null,
        website: dto.website ?? null,
        description: dto.description ?? null,
        updatedBy: user.id,
      },
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'company.update',
      entityType: 'company',
      entityId: updated.id,
      before: before ? { name: before.name } : undefined,
      after: { name: updated.name },
      correlationId,
    });

    const memberCount = await this.prisma.companyMember.count({
      where: { companyId: updated.id },
    });
    return this.toView(updated, memberCount, membership.roleInCompany as CompanyRole);
  }

  async getById(id: string): Promise<CompanyView> {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company || company.isDeleted) {
      throw new NotFoundException('Không tìm thấy công ty');
    }
    const memberCount = await this.prisma.companyMember.count({
      where: { companyId: id },
    });
    return this.toView(company, memberCount, CompanyRole.Member);
  }

  /** Hồ sơ công khai đầy đủ cho trang thông tin NTD. */
  async getPublicProfile(
    id: string,
    user?: AuthenticatedUser | null,
  ): Promise<CompanyPublicProfileView> {
    const company = await this.prisma.company.findFirst({
      where: { id, isDeleted: false },
    });
    if (!company) {
      throw new NotFoundException('Không tìm thấy công ty');
    }

    const [memberCount, openJobCount, jobs, membership] = await Promise.all([
      this.prisma.companyMember.count({ where: { companyId: id } }),
      this.prisma.job.count({
        where: { companyId: id, isDeleted: false, status: JobStatus.Published },
      }),
      this.prisma.job.findMany({
        where: { companyId: id, isDeleted: false, status: JobStatus.Published },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          salaryMin: true,
          salaryMax: true,
          publishedAt: true,
        },
      }),
      user
        ? this.prisma.companyMember.findFirst({
            where: { companyId: id, userId: user.id },
          })
        : Promise.resolve(null),
    ]);

    const myRole = (membership?.roleInCompany as CompanyRole | undefined) ?? CompanyRole.Member;
    const canEdit = Boolean(membership && ADMIN_ROLES.includes(myRole));
    const now = Date.now();
    const openJobs: CompanyJobCard[] = jobs.map((j) => ({
      id: j.id,
      title: j.title,
      department: j.department,
      location: j.location,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      publishedAt: j.publishedAt?.toISOString() ?? null,
      isNew: j.publishedAt ? now - j.publishedAt.getTime() < 48 * 60 * 60 * 1000 : false,
    }));

    return {
      ...this.toView(company, memberCount, myRole),
      brand: parseBrandProfile(company.profile),
      openJobs,
      openJobCount,
      canEdit,
    };
  }

  async listMembers(user: AuthenticatedUser): Promise<CompanyMemberView[]> {
    const membership = await this.requireMembership(user.id);
    const members = await this.prisma.companyMember.findMany({
      where: { companyId: membership.companyId },
      include: { user: { select: { email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      roleInCompany: m.roleInCompany as CompanyRole,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async inviteMember(
    user: AuthenticatedUser,
    dto: InviteMemberDto,
    correlationId: string,
  ): Promise<CompanyMemberView> {
    const membership = await this.requireMembership(user.id);
    this.requireAdmin(membership.roleInCompany as CompanyRole);

    const email = dto.email.toLowerCase().trim();
    const target = await this.prisma.user.findUnique({ where: { email } });
    if (!target || target.isDeleted) {
      throw new NotFoundException('Không tìm thấy người dùng với email này');
    }
    const existingMembership = await this.prisma.companyMember.findFirst({
      where: { userId: target.id },
    });
    if (existingMembership) {
      throw new BadRequestException('Người dùng này đã thuộc một công ty khác');
    }

    const created = await this.prisma.companyMember.create({
      data: {
        companyId: membership.companyId,
        userId: target.id,
        roleInCompany: dto.roleInCompany,
      },
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'company.invite_member',
      entityType: 'company_member',
      entityId: created.id,
      after: { email: target.email, roleInCompany: dto.roleInCompany },
      correlationId,
    });

    this.logger.log(
      `Đã mời ${target.email} vào company ${membership.companyId} với vai trò ${dto.roleInCompany}`,
    );

    return {
      id: created.id,
      userId: target.id,
      email: target.email,
      displayName: target.displayName,
      roleInCompany: dto.roleInCompany,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async removeMember(
    user: AuthenticatedUser,
    memberId: string,
    correlationId: string,
  ): Promise<{ message: string }> {
    const membership = await this.requireMembership(user.id);
    this.requireAdmin(membership.roleInCompany as CompanyRole);

    const target = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId: membership.companyId },
    });
    if (!target) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    if (target.roleInCompany === CompanyRole.Owner) {
      throw new ForbiddenException('Không thể gỡ chủ sở hữu công ty');
    }
    if (target.userId === user.id) {
      throw new ForbiddenException('Không thể tự gỡ chính mình');
    }

    await this.prisma.companyMember.delete({ where: { id: target.id } });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'company.remove_member',
      entityType: 'company_member',
      entityId: target.id,
      before: { userId: target.userId, roleInCompany: target.roleInCompany },
      correlationId,
    });

    return { message: 'Đã gỡ thành viên khỏi công ty' };
  }

  async requireUserCompany(userId: string): Promise<{ companyId: string; companyName: string }> {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
      include: { company: true },
    });
    if (!membership) {
      throw new ForbiddenException('Bạn cần tạo/tham gia một công ty trước');
    }
    return { companyId: membership.companyId, companyName: membership.company.name };
  }

  private async requireMembership(userId: string) {
    const membership = await this.prisma.companyMember.findFirst({ where: { userId } });
    if (!membership) {
      throw new NotFoundException('Bạn chưa có công ty');
    }
    return membership;
  }

  private requireAdmin(role: CompanyRole): void {
    if (!ADMIN_ROLES.includes(role)) {
      throw new ForbiddenException('Chỉ chủ sở hữu/quản trị công ty mới có quyền này');
    }
  }

  async uploadLogo(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<UploadCompanyLogoResponse> {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh logo');
    }
    if (!LOGO_MIME.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF');
    }
    if (file.size > LOGO_MAX_SIZE) {
      throw new BadRequestException('Ảnh vượt quá 2MB');
    }

    const membership = await this.requireMembership(user.id);
    this.requireAdmin(membership.roleInCompany as CompanyRole);

    const company = await this.prisma.company.findUnique({
      where: { id: membership.companyId },
    });
    if (!company || company.isDeleted) {
      throw new NotFoundException('Không tìm thấy công ty');
    }

    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : file.mimetype === 'image/gif'
            ? 'gif'
            : 'jpg';
    const storageKey = `company-logos/${company.id}/${uuidv7()}.${ext}`;
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const prev = parseBrandProfileStored(company.profile);
    const next: BrandProfileStored = {
      ...prev,
      logoStorageKey: storageKey,
      logoMime: file.mimetype,
      // Giữ URL công khai dạng endpoint stream (web dùng blob URL từ /me/logo)
      logoUrl: `/companies/${company.id}/logo`,
    };

    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        profile: next as Prisma.InputJsonValue,
        updatedBy: user.id,
      },
    });

    return { hasLogo: true, message: 'Đã cập nhật logo công ty' };
  }

  async getMyLogoBuffer(
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId: user.id },
      include: { company: true },
    });
    if (!membership) return null;
    return this.readLogoFromCompany(membership.company);
  }

  async getCompanyLogoBuffer(
    companyId: string,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isDeleted: false },
    });
    if (!company) return null;
    return this.readLogoFromCompany(company);
  }

  private async readLogoFromCompany(
    company: Company,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    const brand = parseBrandProfileStored(company.profile);
    if (!brand.logoStorageKey) return null;
    const buffer = await this.storage.getObject(brand.logoStorageKey);
    return { buffer, mime: brand.logoMime ?? 'image/jpeg' };
  }

  private toView(company: Company, memberCount: number, myRole: CompanyRole): CompanyView {
    const brand = parseBrandProfileStored(company.profile);
    return {
      id: company.id,
      code: company.code,
      name: company.name,
      taxCode: company.taxCode,
      industry: company.industry,
      size: (company.size as CompanySize | null) ?? null,
      address: company.address,
      website: company.website,
      description: company.description,
      status: company.status,
      memberCount,
      myRole,
      hasLogo: Boolean(brand.logoStorageKey),
    };
  }
}

function parseBrandProfile(raw: Prisma.JsonValue | null | undefined): CompanyBrandProfile {
  const stored = parseBrandProfileStored(raw);
  const { logoStorageKey: _k, logoMime: _m, ...publicBrand } = stored;
  return publicBrand;
}

function parseBrandProfileStored(
  raw: Prisma.JsonValue | null | undefined,
): BrandProfileStored {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as BrandProfileStored;
}
