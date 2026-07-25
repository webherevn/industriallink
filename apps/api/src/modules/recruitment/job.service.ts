import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DomainEvents,
  EmploymentType,
  JobStatus,
  type GenerateJobDraftResponse,
  type JobListItem,
  type JobView,
  type SalaryEstimateView,
} from '@industriallink/contracts';
import type { Job, JobSkill } from '@prisma/client';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { SkillService } from '../knowledge/skill.service';
import { CompanyService } from '../company/company.service';
import type { CreateJobDto } from './dto/create-job.dto';
import type { EstimateSalaryDto } from './dto/estimate-salary.dto';
import type { GenerateJobDraftDto } from './dto/generate-job-draft.dto';

type JobWithRelations = Job & {
  skills: JobSkill[];
  company: { id: string; name: string };
};

/** Xây chuỗi văn bản mô tả công việc để tạo embedding phục vụ AI Matching. */
export function buildJobText(
  job: Pick<Job, 'title' | 'industry' | 'jobLevel' | 'location' | 'requirements' | 'description'>,
  skillNames: string[],
): string {
  return [
    job.title,
    job.industry,
    job.jobLevel,
    job.location,
    `Kỹ năng: ${skillNames.join(', ')}`,
    job.requirements,
    job.description,
  ]
    .filter(Boolean)
    .join('. ');
}

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly audit: AuditService,
    private readonly skills: SkillService,
    private readonly companies: CompanyService,
    private readonly ai: AiGatewayService,
  ) {}

  /** AI soạn / chuẩn hoá bản nháp tin tuyển dụng (không lưu DB). */
  async generateJobDraft(
    user: AuthenticatedUser,
    dto: GenerateJobDraftDto,
    correlationId: string,
  ): Promise<GenerateJobDraftResponse> {
    const draft = await this.ai.generateJobDraft({
      title: dto.title,
      industry: dto.industry,
      jobLevel: dto.jobLevel,
      location: dto.location,
      employmentType: dto.employmentType,
      hints: dto.hints,
      existingDescription: dto.existingDescription,
      existingRequirements: dto.existingRequirements,
      existingBenefits: dto.existingBenefits,
      existingSkills: dto.existingSkills,
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'job.ai_draft',
      entityType: 'job',
      entityId: null,
      after: {
        title: draft.title ?? dto.title,
        skillCount: draft.skills.length,
        hasSalary: Boolean(draft.suggestedSalaryMin || draft.suggestedSalaryMax),
        hasBenefits: Boolean(draft.benefits),
      },
      correlationId,
    });

    return {
      title: draft.title,
      description: draft.description,
      requirements: draft.requirements,
      benefits: draft.benefits,
      skills: draft.skills.map((s) => ({ name: s.name, required: s.required })),
      suggestedSalaryMin: draft.suggestedSalaryMin,
      suggestedSalaryMax: draft.suggestedSalaryMax,
      notes: draft.notes,
    };
  }

  /** Salary Engine: ước lương theo cấp bậc VN. */
  async estimateSalary(dto: EstimateSalaryDto): Promise<SalaryEstimateView> {
    return this.ai.estimateSalary({
      jobLevel: dto.jobLevel,
      industry: dto.industry,
      location: dto.location,
      title: dto.title,
      yearsOfExperience: dto.yearsOfExperience,
    });
  }

  async createJob(
    user: AuthenticatedUser,
    dto: CreateJobDto,
    correlationId: string,
  ): Promise<JobView> {
    const company = await this.companies.requireUserCompany(user.id);
    const code = await this.codeGen.next('JOB');
    const willPublish = dto.publish === true;

    const skillInputs = dto.skills ?? [];
    const skillData = await Promise.all(
      skillInputs.map(async (s) => ({
        skillId: await this.skills.resolveSkillId(s.name),
        name: s.name.trim(),
        required: s.required ?? true,
        weight: s.weight ?? 1,
      })),
    );

    const job = await this.prisma.job.create({
      data: {
        code,
        tenantId: user.tenantId,
        companyId: company.companyId,
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements ?? null,
        benefits: dto.benefits ?? null,
        industry: dto.industry ?? null,
        department: dto.department ?? null,
        jobLevel: dto.jobLevel ?? null,
        employmentType: dto.employmentType ?? null,
        location: dto.location ?? null,
        headcount: dto.headcount ?? 1,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        experienceBand: dto.experienceBand ?? null,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,
        status: willPublish ? JobStatus.Published : JobStatus.Draft,
        publishedAt: willPublish ? new Date() : null,
        createdBy: user.id,
        skills: {
          create: skillData.map((s) => ({
            skillId: s.skillId,
            name: s.name,
            required: s.required,
            weight: s.weight,
          })),
        },
      },
      include: { skills: true, company: { select: { id: true, name: true } } },
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'job.create',
      entityType: 'job',
      entityId: job.id,
      after: { code: job.code, title: job.title, status: job.status },
      correlationId,
    });

    if (willPublish) {
      await this.embedAndPublish(job, correlationId);
    }

    return this.toView(job);
  }

  async publishJob(
    user: AuthenticatedUser,
    jobId: string,
    correlationId: string,
  ): Promise<JobView> {
    return this.updateJobStatus(user, jobId, JobStatus.Published, correlationId);
  }

  async updateJob(
    user: AuthenticatedUser,
    jobId: string,
    dto: CreateJobDto,
    correlationId: string,
  ): Promise<JobView> {
    await this.requireOwnedJob(user, jobId);

    const skillInputs = dto.skills ?? [];
    const skillData = await Promise.all(
      skillInputs.map(async (s) => ({
        skillId: await this.skills.resolveSkillId(s.name),
        name: s.name.trim(),
        required: s.required ?? true,
        weight: s.weight ?? 1,
      })),
    );

    await this.prisma.jobSkill.deleteMany({ where: { jobId } });

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements ?? null,
        benefits: dto.benefits ?? null,
        industry: dto.industry ?? null,
        department: dto.department ?? null,
        jobLevel: dto.jobLevel ?? null,
        employmentType: dto.employmentType ?? null,
        location: dto.location ?? null,
        headcount: dto.headcount ?? 1,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        experienceBand: dto.experienceBand ?? null,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,
        updatedBy: user.id,
        skills: {
          create: skillData,
        },
      },
      include: { skills: true, company: { select: { id: true, name: true } } },
    });

    if (updated.status === JobStatus.Published) {
      await this.embedAndPublish(updated, correlationId);
    } else {
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.JobUpdated,
          tenantId: updated.tenantId,
          correlationId,
          payload: { jobId: updated.id, code: updated.code, title: updated.title },
        }),
      );
    }

    return this.toView(updated);
  }

  async updateJobStatus(
    user: AuthenticatedUser,
    jobId: string,
    status: JobStatus,
    correlationId: string,
  ): Promise<JobView> {
    const job = await this.requireOwnedJob(user, jobId);
    const allowed = new Set([
      JobStatus.Draft,
      JobStatus.Published,
      JobStatus.Paused,
      JobStatus.Closed,
    ]);
    if (!allowed.has(status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    if (job.status === status) {
      return this.toView(job);
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        publishedAt:
          status === JobStatus.Published
            ? (job.publishedAt ?? new Date())
            : job.publishedAt,
        updatedBy: user.id,
      },
      include: { skills: true, company: { select: { id: true, name: true } } },
    });

    if (status === JobStatus.Published) {
      await this.embedAndPublish(updated, correlationId);
    } else {
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.JobUpdated,
          tenantId: updated.tenantId,
          correlationId,
          payload: { jobId: updated.id, code: updated.code, title: updated.title, status },
        }),
      );
    }

    return this.toView(updated);
  }

  async deleteJob(
    user: AuthenticatedUser,
    jobId: string,
    correlationId: string,
  ): Promise<{ message: string }> {
    const job = await this.requireOwnedJob(user, jobId);
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.id,
        status: JobStatus.Closed,
        updatedBy: user.id,
      },
    });
    this.events.publish(
      createDomainEvent({
        name: DomainEvents.JobUpdated,
        tenantId: job.tenantId,
        correlationId,
        payload: { jobId: job.id, code: job.code, deleted: true },
      }),
    );
    this.logger.log(`Đã xoá tin tuyển dụng ${job.code}`);
    return { message: 'Đã xoá tin tuyển dụng' };
  }

  /** Sinh embedding cho JD và phát sự kiện JobPublished. */
  private async embedAndPublish(job: JobWithRelations, correlationId: string): Promise<void> {
    try {
      const text = buildJobText(
        job,
        job.skills.map((s) => s.name),
      );
      const vector = await this.ai.embed(text);
      const literal = `[${vector.join(',')}]`;
      await this.prisma.$executeRaw`
        UPDATE recruitment.job SET embedding = ${literal}::vector WHERE id = ${job.id}::uuid`;
    } catch (err) {
      this.logger.warn(`Bỏ qua embedding JD cho job ${job.id}: ${String(err)}`);
    }

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.JobPublished,
        tenantId: job.tenantId,
        correlationId,
        payload: { jobId: job.id, code: job.code, title: job.title, companyId: job.companyId },
      }),
    );
    this.logger.log(`Đã đăng tin tuyển dụng ${job.code}`);
  }

  async listMyJobs(user: AuthenticatedUser): Promise<JobListItem[]> {
    const company = await this.companies.requireUserCompany(user.id);
    const jobs = await this.prisma.job.findMany({
      where: { companyId: company.companyId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        skills: { select: { name: true }, take: 6 },
      },
    });
    return jobs.map((j) => this.toListItem(j, company.companyName));
  }

  async listBookmarkedJobs(user: AuthenticatedUser): Promise<JobListItem[]> {
    const rows = await this.prisma.jobBookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            company: { select: { id: true, name: true } },
            skills: { select: { name: true }, take: 6 },
          },
        },
      },
    });
    return rows
      .filter((r) => !r.job.isDeleted && r.job.status === JobStatus.Published)
      .map((r) => this.toListItem(r.job, r.job.company.name, { isBookmarked: true }));
  }

  async addBookmark(user: AuthenticatedUser, jobId: string): Promise<{ ok: true }> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.isDeleted || job.status !== JobStatus.Published) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    await this.prisma.jobBookmark.upsert({
      where: { userId_jobId: { userId: user.id, jobId } },
      create: { userId: user.id, jobId },
      update: {},
    });
    return { ok: true };
  }

  async removeBookmark(user: AuthenticatedUser, jobId: string): Promise<{ ok: true }> {
    await this.prisma.jobBookmark.deleteMany({
      where: { userId: user.id, jobId },
    });
    return { ok: true };
  }

  async listPublishedJobs(params: {
    keyword?: string;
    industry?: string;
    location?: string;
    /** CSV hoặc đã tách sẵn. */
    locations?: string | string[];
    experienceBand?: string;
    jobLevel?: string;
    jobTrack?: string;
    salaryMin?: number;
    salaryMax?: number;
    userId?: string;
  }): Promise<JobListItem[]> {
    const keyword = params.keyword?.trim();
    const experienceBands = splitCsv(params.experienceBand);
    const jobLevels = splitCsv(params.jobLevel);
    const track = params.jobTrack?.trim().toLowerCase();
    const locationFilters = resolveLocationFilters(params.location, params.locations);
    const andFilters: Array<Record<string, unknown>> = [];
    if (locationFilters.length === 1) {
      andFilters.push({ location: locationFilters[0] });
    } else if (locationFilters.length > 1) {
      andFilters.push({
        OR: locationFilters.map((loc) => ({ location: loc })),
      });
    }
    if (keyword) {
      andFilters.push({
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
          { skills: { some: { name: { contains: keyword, mode: 'insensitive' } } } },
        ],
      });
    }

    const jobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.Published,
        isDeleted: false,
        ...(params.industry ? { industry: { equals: params.industry, mode: 'insensitive' } } : {}),
        ...(experienceBands.length === 1
          ? { experienceBand: experienceBands[0] }
          : experienceBands.length > 1
            ? { experienceBand: { in: experienceBands } }
            : {}),
        ...(jobLevels.length === 1
          ? { jobLevel: jobLevels[0] }
          : jobLevels.length > 1
            ? { jobLevel: { in: jobLevels } }
            : track
              ? { jobLevel: { startsWith: `${track}.` } }
              : {}),
        ...(params.salaryMin != null ? { salaryMax: { gte: params.salaryMin } } : {}),
        ...(params.salaryMax != null ? { salaryMin: { lte: params.salaryMax } } : {}),
        ...(andFilters.length === 1
          ? andFilters[0]
          : andFilters.length > 1
            ? { AND: andFilters }
            : {}),
      },
      orderBy: { publishedAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        skills: { select: { name: true }, take: 6 },
      },
      take: 100,
    });

    let bookmarkedIds = new Set<string>();
    if (params.userId) {
      const bookmarks = await this.prisma.jobBookmark.findMany({
        where: { userId: params.userId, jobId: { in: jobs.map((j) => j.id) } },
        select: { jobId: true },
      });
      bookmarkedIds = new Set(bookmarks.map((b) => b.jobId));
    }

    return jobs.map((j) =>
      this.toListItem(j, j.company.name, {
        isBookmarked: bookmarkedIds.has(j.id),
      }),
    );
  }

  async getJob(id: string, user?: AuthenticatedUser): Promise<JobView> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { skills: true, company: { select: { id: true, name: true } } },
    });
    if (!job || job.isDeleted) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    const view = this.toView(job);
    if (user) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (candidate) {
        const existing = await this.prisma.application.findUnique({
          where: { jobId_candidateId: { jobId: id, candidateId: candidate.id } },
          select: { id: true },
        });
        view.hasApplied = Boolean(existing);
      }
    }
    return view;
  }

  /** Đảm bảo job thuộc công ty của user (dùng cho các thao tác quản trị tin). */
  async requireOwnedJob(user: AuthenticatedUser, jobId: string): Promise<JobWithRelations> {
    const company = await this.companies.requireUserCompany(user.id);
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: true, company: { select: { id: true, name: true } } },
    });
    if (!job || job.isDeleted) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    if (job.companyId !== company.companyId) {
      throw new ForbiddenException('Tin tuyển dụng không thuộc công ty của bạn');
    }
    return job;
  }

  private toView(job: JobWithRelations): JobView {
    return {
      id: job.id,
      code: job.code,
      companyId: job.companyId,
      companyName: job.company.name,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      benefits: job.benefits,
      industry: job.industry,
      department: job.department,
      jobLevel: job.jobLevel,
      employmentType: (job.employmentType as EmploymentType | null) ?? null,
      location: job.location,
      headcount: job.headcount,
      deadline: job.deadline ? job.deadline.toISOString().slice(0, 10) : null,
      experienceBand: job.experienceBand,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      status: job.status as JobStatus,
      skills: job.skills.map((s) => ({
        skillId: s.skillId,
        name: s.name,
        required: s.required,
        weight: s.weight,
      })),
      createdAt: job.createdAt.toISOString(),
    };
  }

  private toListItem(
    job: Job & {
      company: { id?: string; name: string };
      skills?: { name: string }[];
      publishedAt?: Date | null;
    },
    companyName: string,
    extras?: { isBookmarked?: boolean },
  ): JobListItem {
    const publishedAt = job.publishedAt ?? null;
    const isNew = publishedAt
      ? Date.now() - publishedAt.getTime() < 48 * 60 * 60 * 1000
      : false;
    return {
      id: job.id,
      code: job.code,
      title: job.title,
      companyId: job.companyId,
      companyName: job.company?.name ?? companyName,
      industry: job.industry,
      jobLevel: job.jobLevel,
      location: job.location,
      employmentType: (job.employmentType as EmploymentType | null) ?? null,
      experienceBand: job.experienceBand,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      status: job.status as JobStatus,
      skills: (job.skills ?? []).map((s) => s.name),
      createdAt: job.createdAt.toISOString(),
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      isNew,
      ...(extras?.isBookmarked != null ? { isBookmarked: extras.isBookmarked } : {}),
    };
  }
}

function splitCsv(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const LOCATION_PART_SEP = ' · ';

type LocationStringFilter =
  | { equals: string; mode: 'insensitive' }
  | { contains: string; mode: 'insensitive' };

/** Gom `location` + `locations` CSV → điều kiện Prisma (equals cụ thể / contains cả tỉnh). */
function resolveLocationFilters(
  location?: string,
  locations?: string | string[],
): LocationStringFilter[] {
  const fromList = Array.isArray(locations)
    ? locations.map((s) => s.trim()).filter(Boolean)
    : splitCsv(locations);
  const labels = fromList.length
    ? fromList
    : location?.trim()
      ? [location.trim()]
      : [];

  return labels.map((label) => {
    if (label.includes(LOCATION_PART_SEP) || /^kcn\b/i.test(label)) {
      return { equals: label, mode: 'insensitive' as const };
    }
    return { contains: label, mode: 'insensitive' as const };
  });
}
