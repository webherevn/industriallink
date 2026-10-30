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
  CompanyStatus,
  DomainEvents,
  JobStatus,
  UserRole,
  type CompanyBrandProfile,
  type CompanyJobCard,
  type CompanyMemberView,
  type CompanyPublicProfileView,
  type CompanyVerificationView,
  type CompanyView,
  type SubmitCompanyVerificationRequest,
  type UploadCompanyLogoResponse,
  normalizeIndustry,
  looksLikeUuid,
} from '@industriallink/contracts';
import {
  allocateUniqueCompanySlug,
  backfillMissingJobSlugs,
} from '../../shared/seo/unique-slug';
import type { Company, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import { compressUploadedImage } from '../../shared/media/optimize-image';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { readBrandJson, toPublicBrand, type BrandJson, type CultureStoredItem, type VerificationRequestStored } from './company-verification';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateCompanyBrandDto } from './dto/update-company-brand.dto';

/** Vai trò có quyền quản trị công ty (mời/gỡ thành viên, sửa hồ sơ). */
const ADMIN_ROLES: CompanyRole[] = [CompanyRole.Owner, CompanyRole.Admin];

const COMPANY_PHOTO_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
]);
const LOGO_MAX_SIZE = 2 * 1024 * 1024;
const BANNER_MAX_SIZE = 5 * 1024 * 1024;
const CULTURE_MAX_SIZE = 4 * 1024 * 1024;
const CULTURE_LIMIT = 8;

type BrandProfileStored = CompanyBrandProfile & {
  logoStorageKey?: string | null;
  logoMime?: string | null;
  verificationRequest?: VerificationRequestStored | null;
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
    const slug = await allocateUniqueCompanySlug(this.prisma, dto.name);
    const company = await this.prisma.company.create({
      data: {
        code,
        slug,
        tenantId: user.tenantId,
        name: dto.name,
        taxCode: dto.taxCode ?? null,
        industry: normalizeIndustry(dto.industry) ?? dto.industry ?? null,
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
    await this.assignStarterPlan(company.id, user.id);
    return this.toView(company, 1, CompanyRole.Owner);
  }

  /**
   * NTD đăng ký / vào billing mà chưa có công ty → tạo công ty mặc định
   * (CompanyCreated → gán gói Khám phá).
   */
  async provisionForRecruiter(input: {
    userId: string;
    displayName: string;
    tenantId: string;
    correlationId: string;
  }): Promise<{ companyId: string; companyName: string }> {
    const existing = await this.prisma.companyMember.findFirst({
      where: { userId: input.userId },
      include: { company: { select: { id: true, name: true } } },
    });
    if (existing) {
      return { companyId: existing.companyId, companyName: existing.company.name };
    }

    const name = input.displayName.trim() || 'Công ty của tôi';
    const code = await this.codeGen.next('COM');
    const slug = await allocateUniqueCompanySlug(this.prisma, name);
    const company = await this.prisma.company.create({
      data: {
        code,
        slug,
        tenantId: input.tenantId,
        name,
        createdBy: input.userId,
        members: {
          create: { userId: input.userId, roleInCompany: CompanyRole.Owner },
        },
      },
    });

    await this.audit.record({
      tenantId: input.tenantId,
      actorId: input.userId,
      action: 'company.create',
      entityType: 'company',
      entityId: company.id,
      after: { code: company.code, name: company.name, source: 'recruiter-provision' },
      correlationId: input.correlationId,
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.CompanyCreated,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        payload: { companyId: company.id, code: company.code, name: company.name },
      }),
    );

    this.logger.log(`Đã tạo Company ${code} (provision) cho NTD ${input.userId}`);
    await this.assignStarterPlan(company.id, input.userId);
    return { companyId: company.id, companyName: company.name };
  }

  async requireOrProvisionCompany(user: AuthenticatedUser): Promise<{
    companyId: string;
    companyName: string;
  }> {
    const existing = await this.prisma.companyMember.findFirst({
      where: { userId: user.id },
      include: { company: { select: { id: true, name: true } } },
    });
    if (existing) {
      await this.assignStarterPlan(existing.companyId, user.id);
      return { companyId: existing.companyId, companyName: existing.company.name };
    }
    const canProvision = (
      [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin] as string[]
    ).includes(user.role);
    if (!canProvision) {
      throw new ForbiddenException('Bạn cần tạo/tham gia một công ty trước');
    }
    return this.provisionForRecruiter({
      userId: user.id,
      displayName: user.displayName,
      tenantId: user.tenantId,
      correlationId: `provision-${user.id}`,
    });
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
        industry: normalizeIndustry(dto.industry) ?? dto.industry ?? null,
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

  async getMyVerification(user: AuthenticatedUser): Promise<CompanyVerificationView> {
    const membership = await this.requireMembership(user.id);
    const company = await this.prisma.company.findFirst({
      where: { id: membership.companyId, isDeleted: false },
      select: { profile: true },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    return this.toVerificationView(readBrandJson(company.profile));
  }

  /** NTD gửi đơn — không tự bật verified / trustedEmployer. */
  async submitVerification(
    user: AuthenticatedUser,
    input: SubmitCompanyVerificationRequest,
    correlationId: string,
  ): Promise<CompanyVerificationView> {
    const membership = await this.requireMembership(user.id);
    this.requireAdmin(membership.roleInCompany as CompanyRole);
    const note = input.note?.trim() ?? '';
    if (note.length < 10) {
      throw new BadRequestException('Ghi chú cần ít nhất 10 ký tự (MST, website, người liên hệ…)');
    }
    if (note.length > 2000) throw new BadRequestException('Ghi chú quá dài');

    const company = await this.prisma.company.findFirst({
      where: { id: membership.companyId, isDeleted: false },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    const brand = readBrandJson(company.profile);
    const current = brand.verificationRequest;
    if (current?.status === 'pending') {
      throw new BadRequestException('Đã có đơn đang chờ SuperAdmin xét');
    }

    const askVerified = input.askVerified !== false && !brand.verified;
    const askTrusted = Boolean(input.askTrusted) && !brand.trustedEmployer;
    if (!askVerified && !askTrusted) {
      throw new BadRequestException('Công ty đã có các huy hiệu bạn xin, hoặc chưa chọn mục nào');
    }

    const request: VerificationRequestStored = {
      status: 'pending',
      note,
      requestedAt: new Date().toISOString(),
      requestedBy: user.id,
      askVerified,
      askTrusted,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };
    brand.verificationRequest = request;
    await this.prisma.company.update({
      where: { id: company.id },
      data: { profile: brand as Prisma.InputJsonValue, updatedBy: user.id },
    });
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'company.verification.request',
      entityType: 'company',
      entityId: company.id,
      after: { askVerified, askTrusted, note },
      correlationId,
    });
    return this.toVerificationView(brand);
  }

  async getById(ref: string): Promise<CompanyView> {
    const company = await this.findCompanyByRef(ref);
    const withSlug = await this.ensureCompanySlug(company);
    const memberCount = await this.prisma.companyMember.count({
      where: { companyId: company.id },
    });
    return this.toView(withSlug, memberCount, CompanyRole.Member);
  }

  /** Hồ sơ công khai đầy đủ cho trang thông tin NTD. */
  async getPublicProfile(
    ref: string,
    user?: AuthenticatedUser | null,
  ): Promise<CompanyPublicProfileView> {
    const company = await this.ensureCompanySlug(await this.findCompanyByRef(ref));

    const showOpenJobs = company.status === CompanyStatus.Active;
    const publishedWhere = {
      companyId: company.id,
      isDeleted: false,
      status: JobStatus.Published,
    };
    const [memberCount, openJobCount, jobs, membership] = await Promise.all([
      this.prisma.companyMember.count({ where: { companyId: company.id } }),
      showOpenJobs ? this.prisma.job.count({ where: publishedWhere }) : Promise.resolve(0),
      showOpenJobs
        ? this.prisma.job.findMany({
            where: publishedWhere,
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
            take: 12,
            select: {
              id: true,
              slug: true,
              title: true,
              department: true,
              location: true,
              salaryMin: true,
              salaryMax: true,
              publishedAt: true,
            },
          })
        : Promise.resolve([]),
      user
        ? this.prisma.companyMember.findFirst({
            where: { companyId: company.id, userId: user.id },
          })
        : Promise.resolve(null),
    ]);

    await backfillMissingJobSlugs(this.prisma, jobs);

    const myRole = (membership?.roleInCompany as CompanyRole | undefined) ?? CompanyRole.Member;
    const canEdit = Boolean(membership && ADMIN_ROLES.includes(myRole));
    const now = Date.now();
    const openJobs: CompanyJobCard[] = jobs.map((j) => ({
      id: j.id,
      slug: j.slug ?? j.id,
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
      brand: toPublicBrand(readBrandJson(company.profile)),
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

  /**
   * Gán Khám phá ngay khi tạo công ty — không chờ event bus.
   * Chu kỳ gói Khám phá 14 ngày. Thiếu KHAM_PHA thì lấy gói active giá 0đ / sort thấp nhất.
   */
  private async assignStarterPlan(companyId: string, actorId: string): Promise<void> {
    try {
      const already = await this.prisma.billingCompanyPlan.findUnique({
        where: { companyId },
        select: { isActive: true },
      });
      if (already?.isActive) return;

      const starter =
        (await this.prisma.billingPlatformPlan.findFirst({
          where: { code: 'KHAM_PHA', isActive: true },
        })) ??
        (await this.prisma.billingPlatformPlan.findFirst({
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }));
      if (!starter) {
        this.logger.warn(`Không có gói nền tảng active để gán cho công ty ${companyId}`);
        return;
      }

      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setUTCDate(endsAt.getUTCDate() + 14);
      const actor = looksLikeUuid(actorId) ? actorId : null;
      await this.prisma.billingCompanyPlan.upsert({
        where: { companyId },
        create: {
          companyId,
          planId: starter.id,
          startsAt,
          endsAt,
          isActive: true,
          note: 'Gói Khám phá mặc định khi tạo công ty',
          createdBy: actor,
          updatedBy: actor,
        },
        update: {
          planId: starter.id,
          startsAt,
          endsAt,
          isActive: true,
          note: 'Gói Khám phá mặc định khi tạo công ty',
          updatedBy: actor,
        },
      });
      this.logger.log(`Đã gán gói ${starter.code} cho công ty ${companyId}`);
    } catch (err) {
      this.logger.error(
        `Gán gói mặc định thất bại cho ${companyId}: ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
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

  /** SuperAdmin treo/cấm công ty → NTD không được đăng tin mới. */
  async assertCompanyCanPost(companyId: string): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isDeleted: false },
      select: { status: true, name: true },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');
    if (company.status !== CompanyStatus.Active) {
      throw new ForbiddenException(
        company.status === CompanyStatus.Banned
          ? 'Công ty đã bị cấm đăng tin. Liên hệ SuperAdmin.'
          : 'Công ty đang bị tạm dừng. Liên hệ SuperAdmin.',
      );
    }
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
    this.assertCompanyPhoto(file);
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

    const image = await this.toWebp(file.buffer, 1024);
    const storageKey = `company-logos/${company.id}/${uuidv7()}.${image.ext}`;
    await this.storage.putObject(storageKey, image.buffer, image.mime);

    const prev = parseBrandProfileStored(company.profile);
    const next: BrandProfileStored = {
      ...prev,
      logoStorageKey: storageKey,
      logoMime: image.mime,
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

  async updateBrand(user: AuthenticatedUser, dto: UpdateCompanyBrandDto): Promise<CompanyBrandProfile> {
    const company = await this.requireAdminCompany(user);
    const prev = readBrandJson(company.profile);
    const next: BrandJson = { ...prev };

    this.assignText(next, 'internationalName', dto.internationalName, 160);
    this.assignText(next, 'email', this.cleanEmail(dto.email), 120);
    this.assignText(next, 'phone', dto.phone, 30);
    this.assignText(next, 'bannerCaption', dto.bannerCaption, 160);
    this.assignText(next, 'facebookUrl', this.cleanUrl(dto.facebookUrl), 300);
    this.assignText(next, 'linkedinUrl', this.cleanUrl(dto.linkedinUrl), 300);
    this.assignText(next, 'youtubeUrl', this.cleanUrl(dto.youtubeUrl), 300);
    this.assignText(next, 'cultureNote', dto.cultureNote, 600);
    if (dto.foundedYear !== undefined) {
      next.foundedYear = dto.foundedYear;
    }
    if (dto.coreActivities) next.coreActivities = cleanLines(dto.coreActivities, 12, 80);
    if (dto.whyChooseUs) next.whyChooseUs = cleanLines(dto.whyChooseUs, 8, 160);
    if (dto.benefits) next.benefits = cleanLines(dto.benefits, 12, 120);
    if (dto.stats) {
      next.stats = {
        yearsActive: cleanCount(dto.stats.yearsActive),
        employees: cleanCount(dto.stats.employees),
        customers: cleanCount(dto.stats.customers),
        projects: cleanCount(dto.stats.projects),
        locations: cleanCount(dto.stats.locations),
      };
    }
    if (dto.awards) {
      next.awards = dto.awards
        .map((item) => ({ name: item.name.trim() }))
        .filter((item) => item.name.length > 0)
        .slice(0, 8);
    }
    if (dto.cultureTexts) {
      const gallery = [...(next.cultureGallery ?? [])];
      for (const row of dto.cultureTexts) {
        const item = gallery.find((entry) => entry.id === row.id);
        if (!item) continue;
        item.title = row.title.trim().slice(0, 80);
        item.caption = row.caption?.trim().slice(0, 160) || undefined;
      }
      next.cultureGallery = gallery;
    }

    await this.prisma.company.update({
      where: { id: company.id },
      data: { profile: next as Prisma.InputJsonValue, updatedBy: user.id },
    });
    return toPublicBrand(next);
  }

  async uploadBanner(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<CompanyBrandProfile> {
    const stored = await this.storeCompanyImage(user, file, {
      maxSize: BANNER_MAX_SIZE,
      maxEdge: 1920,
      folder: 'company-banners',
    });
    const prev = readBrandJson(stored.company.profile);
    if (prev.bannerStorageKey) {
      await this.storage.deleteObject(prev.bannerStorageKey).catch(() => undefined);
    }
    const next: BrandJson = {
      ...prev,
      bannerStorageKey: stored.storageKey,
      bannerMime: stored.mime,
      bannerUrl: `/companies/${stored.company.id}/banner`,
    };
    await this.prisma.company.update({
      where: { id: stored.company.id },
      data: { profile: next as Prisma.InputJsonValue, updatedBy: user.id },
    });
    return toPublicBrand(next);
  }

  async deleteBanner(user: AuthenticatedUser): Promise<CompanyBrandProfile> {
    const company = await this.requireAdminCompany(user);
    const prev = readBrandJson(company.profile);
    if (prev.bannerStorageKey) {
      await this.storage.deleteObject(prev.bannerStorageKey).catch(() => undefined);
    }
    const next: BrandJson = {
      ...prev,
      bannerStorageKey: null,
      bannerMime: null,
      bannerUrl: null,
    };
    await this.prisma.company.update({
      where: { id: company.id },
      data: { profile: next as Prisma.InputJsonValue, updatedBy: user.id },
    });
    return toPublicBrand(next);
  }

  async uploadCulture(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    title: string | undefined,
    caption: string | undefined,
  ): Promise<CompanyBrandProfile> {
    const label = title?.trim() ?? '';
    if (label.length < 1) throw new BadRequestException('Nhập tiêu đề ảnh văn hóa');
    const company = await this.requireAdminCompany(user);
    const prev = readBrandJson(company.profile);
    const gallery = [...(prev.cultureGallery ?? [])];
    if (gallery.length >= CULTURE_LIMIT) {
      throw new BadRequestException(`Tối đa ${CULTURE_LIMIT} ảnh văn hóa`);
    }
    const stored = await this.storeCompanyImage(user, file, {
      maxSize: CULTURE_MAX_SIZE,
      maxEdge: 1400,
      folder: 'company-culture',
      company,
    });
    const id = uuidv7();
    const item: CultureStoredItem = {
      id,
      title: label.slice(0, 80),
      caption: caption?.trim().slice(0, 160) || undefined,
      storageKey: stored.storageKey,
      mime: stored.mime,
      url: `/companies/${company.id}/culture/${id}`,
    };
    const next: BrandJson = { ...prev, cultureGallery: [...gallery, item] };
    await this.prisma.company.update({
      where: { id: company.id },
      data: { profile: next as Prisma.InputJsonValue, updatedBy: user.id },
    });
    return toPublicBrand(next);
  }

  async deleteCulture(user: AuthenticatedUser, itemId: string): Promise<CompanyBrandProfile> {
    const company = await this.requireAdminCompany(user);
    const prev = readBrandJson(company.profile);
    const gallery = [...(prev.cultureGallery ?? [])];
    const index = gallery.findIndex((item) => item.id === itemId);
    if (index < 0) throw new NotFoundException('Không tìm thấy ảnh văn hóa');
    const [removed] = gallery.splice(index, 1);
    if (removed?.storageKey) {
      await this.storage.deleteObject(removed.storageKey).catch(() => undefined);
    }
    const next: BrandJson = { ...prev, cultureGallery: gallery };
    await this.prisma.company.update({
      where: { id: company.id },
      data: { profile: next as Prisma.InputJsonValue, updatedBy: user.id },
    });
    return toPublicBrand(next);
  }

  async getCompanyBannerBuffer(
    companyRef: string,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    try {
      const company = await this.findCompanyByRef(companyRef);
      const brand = readBrandJson(company.profile);
      if (!brand.bannerStorageKey) return null;
      const buffer = await this.storage.getObject(brand.bannerStorageKey);
      return { buffer, mime: brand.bannerMime ?? 'image/webp' };
    } catch {
      return null;
    }
  }

  async getCompanyCultureBuffer(
    companyRef: string,
    itemId: string,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    try {
      const company = await this.findCompanyByRef(companyRef);
      const item = readBrandJson(company.profile).cultureGallery?.find((row) => row.id === itemId);
      if (!item?.storageKey) return null;
      const buffer = await this.storage.getObject(item.storageKey);
      return { buffer, mime: item.mime ?? 'image/webp' };
    } catch {
      return null;
    }
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
    companyRef: string,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    try {
      const company = await this.findCompanyByRef(companyRef);
      return this.readLogoFromCompany(company);
    } catch {
      return null;
    }
  }

  private async readLogoFromCompany(
    company: Company,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    const brand = parseBrandProfileStored(company.profile);
    if (!brand.logoStorageKey) return null;
    const buffer = await this.storage.getObject(brand.logoStorageKey);
    return { buffer, mime: brand.logoMime ?? 'image/jpeg' };
  }

  private async findCompanyByRef(ref: string): Promise<Company> {
    const where = looksLikeUuid(ref) ? { id: ref } : { slug: ref };
    const company = await this.prisma.company.findFirst({
      where: { ...where, isDeleted: false },
    });
    if (!company) {
      throw new NotFoundException('Không tìm thấy công ty');
    }
    return company;
  }

  private async requireAdminCompany(user: AuthenticatedUser): Promise<Company> {
    const membership = await this.requireMembership(user.id);
    this.requireAdmin(membership.roleInCompany as CompanyRole);
    const company = await this.prisma.company.findUnique({ where: { id: membership.companyId } });
    if (!company || company.isDeleted) {
      throw new NotFoundException('Không tìm thấy công ty');
    }
    return company;
  }

  private async storeCompanyImage(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    options: { maxSize: number; maxEdge: number; folder: string; company?: Company },
  ): Promise<{ company: Company; storageKey: string; mime: string }> {
    if (!file) throw new BadRequestException('Thiếu file ảnh');
    this.assertCompanyPhoto(file);
    if (file.size > options.maxSize) {
      throw new BadRequestException('Ảnh vượt quá dung lượng cho phép');
    }
    const company = options.company ?? (await this.requireAdminCompany(user));
    const image = await this.toWebp(file.buffer, options.maxEdge);
    const storageKey = `${options.folder}/${company.id}/${uuidv7()}.${image.ext}`;
    await this.storage.putObject(storageKey, image.buffer, image.mime);
    return { company, storageKey, mime: image.mime };
  }

  private assertCompanyPhoto(file: Express.Multer.File): void {
    const mime = (file.mimetype || '').toLowerCase();
    const name = file.originalname || '';
    const extOk = /\.(jpe?g|png|webp)$/i.test(name);
    const mimeOk = !mime || mime === 'application/octet-stream' || COMPANY_PHOTO_MIME.has(mime);
    if (!extOk || !mimeOk) {
      throw new BadRequestException('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP');
    }
  }

  private async toWebp(buffer: Buffer, maxEdge: number) {
    try {
      return await compressUploadedImage(buffer, maxEdge);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw new BadRequestException('Không đọc được ảnh. Hãy dùng JPG, PNG hoặc WebP.');
      }
      throw err;
    }
  }

  private assignText(
    target: BrandJson,
    key: 'internationalName' | 'email' | 'phone' | 'bannerCaption' | 'facebookUrl' | 'linkedinUrl' | 'youtubeUrl' | 'cultureNote',
    value: string | null | undefined,
    max: number,
  ): void {
    if (value === undefined) return;
    const text = value?.trim() ?? '';
    target[key] = text ? text.slice(0, max) : null;
  }

  private cleanEmail(value?: string | null): string | null | undefined {
    if (value === undefined) return undefined;
    const text = value?.trim() ?? '';
    if (!text) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      throw new BadRequestException('Email không hợp lệ');
    }
    return text;
  }

  private cleanUrl(value?: string | null): string | null | undefined {
    if (value === undefined) return undefined;
    const text = value?.trim() ?? '';
    if (!text) return null;
    if (/^javascript:/i.test(text) || /\s/.test(text)) {
      throw new BadRequestException('Liên kết không hợp lệ');
    }
    return text.slice(0, 300);
  }

  private async ensureCompanySlug(company: Company): Promise<Company> {
    if (company.slug) return company;
    const slug = await allocateUniqueCompanySlug(this.prisma, company.name, company.id);
    return this.prisma.company.update({
      where: { id: company.id },
      data: { slug },
    });
  }

  private toView(company: Company, memberCount: number, myRole: CompanyRole): CompanyView {
    const brand = readBrandJson(company.profile);
    return {
      id: company.id,
      slug: company.slug ?? company.id,
      code: company.code,
      name: company.name,
      taxCode: company.taxCode,
      industry: normalizeIndustry(company.industry) ?? company.industry,
      size: (company.size as CompanySize | null) ?? null,
      address: company.address,
      website: company.website,
      description: company.description,
      status: company.status,
      memberCount,
      myRole,
      hasLogo: Boolean(brand.logoStorageKey),
      brand: toPublicBrand(brand),
    };
  }

  private toVerificationView(brand: BrandProfileStored): CompanyVerificationView {
    const req = brand.verificationRequest;
    return {
      verified: Boolean(brand.verified),
      trustedEmployer: Boolean(brand.trustedEmployer),
      status: req?.status ?? 'none',
      note: req?.note ?? null,
      reviewNote: req?.reviewNote ?? null,
      requestedAt: req?.requestedAt ?? null,
      askVerified: Boolean(req?.askVerified),
      askTrusted: Boolean(req?.askTrusted),
    };
  }
}

function parseBrandProfileStored(
  raw: Prisma.JsonValue | null | undefined,
): BrandProfileStored {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as BrandProfileStored;
}

function cleanLines(values: string[], max: number, length: number): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, max)
    .map((value) => value.slice(0, length));
}

function cleanCount(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1_000_000, Math.round(value)));
}
