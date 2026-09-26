import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DomainEvents,
  EmploymentType,
  JobModerationStatus,
  JobStatus,
  JobTrack,
  defaultDepartmentForTrack,
  expandJobSearchKeywords,
  industrySearchValues,
  normalizeIndustry,
  normalizeJobSalesCriteria,
  normalizeJobTechnicalCriteria,
  resolveJobLevel,
  type GenerateJobDraftResponse,
  type JobListItem,
  type JobPositionCount,
  type JobPositionStatsView,
  type JobSalesCriteria,
  type JobTechnicalCriteria,
  type JobView,
  type ParsedSalesJobDraft,
  type ParsedTechnicalJobDraft,
  type SalaryEstimateView,
  looksLikeUuid,
} from '@industriallink/contracts';
import {
  allocateUniqueJobSlug,
  backfillMissingCompanySlugs,
  backfillMissingJobSlugs,
} from '../../shared/seo/unique-slug';
import { GoogleIndexingService } from '../../shared/seo/google-indexing.service';
import type { Job, JobSkill, Prisma } from '@prisma/client';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { AppEventBus } from '../../shared/events/event-bus';
import { AuditService } from '../../shared/infrastructure/audit.service';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { SkillService } from '../knowledge/skill.service';
import { CompanyService } from '../company/company.service';
import {
  JOB_MODERATION_QUEUE_TOKEN,
  type JobModerationJobData,
} from './moderation/job-moderation.constants';
import type { CreateJobDto } from './dto/create-job.dto';
import type { EstimateSalaryDto } from './dto/estimate-salary.dto';
import type { GenerateJobDraftDto } from './dto/generate-job-draft.dto';
import { ExtractTextError, extractResumeText } from '../candidate/resume/extract-text.util';

const JOB_COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  website: true,
  address: true,
  profile: true,
} as const;

type JobWithRelations = Job & {
  skills: JobSkill[];
  company: {
    id: string;
    name: string;
    slug: string | null;
    website: string | null;
    address: string | null;
    profile: Prisma.JsonValue | null;
  };
};

function defaultJobDeadline(from = new Date()): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + 30);
  return end;
}

const JD_UPLOAD_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const JD_MAX_SIZE = 5 * 1024 * 1024;

function salesCriteriaJson(raw: unknown): Prisma.InputJsonValue {
  return normalizeJobSalesCriteria(raw) as unknown as Prisma.InputJsonValue;
}

function technicalCriteriaJson(raw: unknown): Prisma.InputJsonValue {
  return normalizeJobTechnicalCriteria(raw) as unknown as Prisma.InputJsonValue;
}

function parseStoredSalesCriteria(raw: Prisma.JsonValue | null | undefined): JobSalesCriteria | null {
  if (raw == null) return null;
  return normalizeJobSalesCriteria(raw);
}

function parseStoredTechnicalCriteria(
  raw: Prisma.JsonValue | null | undefined,
): JobTechnicalCriteria | null {
  if (raw == null) return null;
  return normalizeJobTechnicalCriteria(raw);
}

function resolveCreateJobTrack(dto: CreateJobDto): JobTrack | null {
  if (dto.jobTrack === JobTrack.Sales || dto.jobTrack === JobTrack.Technical) {
    return dto.jobTrack;
  }
  if (dto.technicalCriteria) return JobTrack.Technical;
  if (dto.salesCriteria) return JobTrack.Sales;
  if (dto.jobLevel?.startsWith('sales.')) return JobTrack.Sales;
  if (dto.jobLevel?.startsWith('technical.')) return JobTrack.Technical;
  return null;
}

function toAiParseTrack(track?: JobTrack | string | null): 'sales' | 'technical' | undefined {
  const v = String(track ?? '').trim().toLowerCase();
  if (v === JobTrack.Technical) return 'technical';
  if (v === JobTrack.Sales) return 'sales';
  return undefined;
}

function mapAiParseError(err: unknown): never {
  if (err instanceof HttpException) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b(429|503)\b|UNAVAILABLE|high demand|overloaded|RESOURCE_EXHAUSTED/i.test(msg)) {
    throw new ServiceUnavailableException(
      'AI đang quá tải. Vui lòng bấm lại sau vài giây, hoặc điền tay.',
    );
  }
  throw new BadGatewayException('Không phân tích được JD bằng AI. Thử lại hoặc điền tay.');
}

function isTechnicalParsedJob(
  draft: ParsedSalesJobDraft | ParsedTechnicalJobDraft,
): draft is ParsedTechnicalJobDraft {
  return 'equipmentSystems' in draft;
}

function inferJobLevelFromTitle(title: string, track: JobTrack | null): string | undefined {
  if (track === JobTrack.Sales) {
    return resolveJobLevel({ currentPosition: title, trackHint: JobTrack.Sales });
  }
  if (track === JobTrack.Technical) {
    return resolveJobLevel({ currentPosition: title, trackHint: JobTrack.Technical });
  }
  return undefined;
}

/** Xây chuỗi văn bản mô tả công việc để tạo embedding phục vụ AI Matching. */
export function buildJobText(
  job: Pick<
    Job,
    | 'title'
    | 'industry'
    | 'jobLevel'
    | 'location'
    | 'requirements'
    | 'description'
    | 'salesCriteria'
    | 'technicalCriteria'
  >,
  skillNames: string[],
): string {
  const sales = job.salesCriteria != null ? normalizeJobSalesCriteria(job.salesCriteria) : null;
  const tech =
    job.technicalCriteria != null ? normalizeJobTechnicalCriteria(job.technicalCriteria) : null;
  return [
    job.title,
    job.industry,
    ...(sales?.industries ?? []),
    ...(tech?.industries ?? []),
    job.jobLevel,
    job.location,
    sales?.productsSold.length ? `Sản phẩm: ${sales.productsSold.join(', ')}` : '',
    sales?.customerSegments.length ? `Tệp KH: ${sales.customerSegments.join(', ')}` : '',
    sales?.dealTypes.length ? `Loại hình: ${sales.dealTypes.join(', ')}` : '',
    sales?.sellingStages.length ? `Giai đoạn: ${sales.sellingStages.join(', ')}` : '',
    sales?.marketsCovered.length ? `Thị trường: ${sales.marketsCovered.join(', ')}` : '',
    tech?.equipmentSystems.length ? `Thiết bị: ${tech.equipmentSystems.join(', ')}` : '',
    tech?.workEnvironments.length ? `Môi trường: ${tech.workEnvironments.join(', ')}` : '',
    tech?.technicalWorkTypes.length ? `Công việc KT: ${tech.technicalWorkTypes.join(', ')}` : '',
    tech?.autonomyLevel != null ? `Tự chủ mức ${tech.autonomyLevel}` : '',
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
    private readonly indexing: GoogleIndexingService,
    @Inject(JOB_MODERATION_QUEUE_TOKEN)
    private readonly moderationQueue: Queue<JobModerationJobData>,
  ) {}

  /** Đưa tin vào hàng đợi kiểm duyệt (Lớp 2). */
  private async enqueueModeration(
    jobId: string,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.moderationQueue.add(
      'moderate',
      { jobId, tenantId, correlationId },
      { jobId: `job-moderation:${jobId}` },
    );
  }

  /**
   * Side-effect khi tin được duyệt & xuất bản: embedding JD, ping Google Indexing,
   * phát JobPublished. Gọi bởi JobModerationService sau khi flip status=Published.
   */
  async applyPublishSideEffects(jobId: string, correlationId: string): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId },
      include: { skills: true, company: { select: JOB_COMPANY_SELECT } },
    });
    if (!job) return;
    await this.embedAndPublish(job, correlationId);
    void this.indexing.notifyJob(job, 'URL_UPDATED');
  }

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

  /** AI đọc JD (text) → 22 trường Sales hoặc 23 trường Kỹ thuật; không lưu DB. */
  async parseJobFromText(
    user: AuthenticatedUser,
    text: string,
    correlationId: string,
    jobTrack?: JobTrack | string,
  ): Promise<ParsedSalesJobDraft | ParsedTechnicalJobDraft> {
    const track = toAiParseTrack(jobTrack);
    try {
      const draft = await this.ai.parseJobDescription({
        fileName: 'jd-paste.txt',
        text,
        track,
      });
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'job.ai_parse_text',
        entityType: 'job',
        entityId: null,
        after: isTechnicalParsedJob(draft)
          ? { title: draft.title, equipmentCount: draft.equipmentSystems.length, track }
          : { title: draft.title, productCount: draft.productsSold.length, track },
        correlationId,
      });
      return draft;
    } catch (err) {
      mapAiParseError(err);
    }
  }

  /** AI đọc JD (PDF/DOCX/TXT) → 22 trường Sales hoặc 23 trường Kỹ thuật; không lưu DB. */
  async parseJobFromFile(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    correlationId: string,
    jobTrack?: JobTrack | string,
  ): Promise<ParsedSalesJobDraft | ParsedTechnicalJobDraft> {
    if (!file) {
      throw new BadRequestException('Thiếu file JD');
    }
    if (!JD_UPLOAD_MIME.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận PDF, DOC, DOCX hoặc TXT');
    }
    if (file.size > JD_MAX_SIZE) {
      throw new BadRequestException('File vượt quá 5MB');
    }

    let text = '';
    try {
      text = await extractResumeText(file.buffer, file.mimetype);
    } catch (err) {
      if (!/pdf|image\//i.test(file.mimetype)) {
        throw new BadRequestException(
          err instanceof ExtractTextError
            ? err.message
            : 'Không đọc được nội dung JD. Thử PDF/DOCX/TXT có chữ.',
        );
      }
    }

    const track = toAiParseTrack(jobTrack);
    try {
      const draft = await this.ai.parseJobDescription({
        fileName: file.originalname || 'jd-upload.pdf',
        text: text.trim() || `JD file: ${file.originalname}`,
        fileBytes: file.buffer,
        mimeType: file.mimetype,
        track,
      });

      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'job.ai_parse_file',
        entityType: 'job',
        entityId: null,
        after: {
          fileName: file.originalname,
          title: draft.title,
          track,
          ...(isTechnicalParsedJob(draft)
            ? { equipmentCount: draft.equipmentSystems.length }
            : { productCount: draft.productsSold.length }),
        },
        correlationId,
      });
      return draft;
    } catch (err) {
      mapAiParseError(err);
    }
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

    const track = resolveCreateJobTrack(dto);
    const inferredLevel = dto.jobLevel ?? inferJobLevelFromTitle(dto.title, track);
    const department =
      dto.department ??
      (track ? defaultDepartmentForTrack(track) : null);
    const criteria = dto.salesCriteria ? salesCriteriaJson(dto.salesCriteria) : undefined;
    const techCriteria = dto.technicalCriteria
      ? technicalCriteriaJson(dto.technicalCriteria)
      : undefined;
    const primaryIndustry =
      dto.industry ||
      (dto.salesCriteria?.industries?.length ? dto.salesCriteria.industries[0] : undefined) ||
      (dto.technicalCriteria?.industries?.length ? dto.technicalCriteria.industries[0] : undefined);

    const slug = await allocateUniqueJobSlug(this.prisma, dto.title);
    const job = await this.prisma.job.create({
      data: {
        code,
        slug,
        tenantId: user.tenantId,
        companyId: company.companyId,
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements ?? null,
        benefits: dto.benefits ?? null,
        industry: normalizeIndustry(primaryIndustry) ?? primaryIndustry ?? null,
        subIndustry: dto.subIndustry?.trim() || null,
        department,
        jobLevel: inferredLevel ?? null,
        jobTrack: track,
        salesCriteria: criteria,
        technicalCriteria: techCriteria,
        employmentType: dto.employmentType ?? null,
        location: dto.location ?? null,
        headcount: dto.headcount ?? 1,
        deadline: dto.deadline
          ? new Date(dto.deadline)
          : willPublish
            ? defaultJobDeadline()
            : null,
        experienceBand: dto.experienceBand ?? null,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,
        // Tin chỉ public sau khi qua kiểm duyệt. Khi "đăng", đưa vào hàng đợi
        // (status=Draft + moderation=pending), worker mới quyết định publish.
        status: JobStatus.Draft,
        moderationStatus: willPublish
          ? JobModerationStatus.Pending
          : JobModerationStatus.Draft,
        publishedAt: null,
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
      include: { skills: true, company: { select: JOB_COMPANY_SELECT } },
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
      await this.enqueueModeration(job.id, job.tenantId, correlationId);
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.JobSubmittedForModeration,
          tenantId: job.tenantId,
          correlationId,
          payload: { jobId: job.id, code: job.code, title: job.title },
        }),
      );
    }

    return this.toView(job);
  }

  /** Gửi tin (nháp) vào hàng đợi kiểm duyệt thay vì publish trực tiếp. */
  async submitForModeration(
    user: AuthenticatedUser,
    jobId: string,
    correlationId: string,
  ): Promise<JobView> {
    const job = await this.requireOwnedJob(user, jobId);
    if (job.status === JobStatus.Published) {
      return this.toView(job);
    }
    const updated = await this.prisma.job.update({
      where: { id: job.id },
      data: {
        moderationStatus: JobModerationStatus.Pending,
        updatedBy: user.id,
      },
      include: { skills: true, company: { select: JOB_COMPANY_SELECT } },
    });
    await this.enqueueModeration(job.id, job.tenantId, correlationId);
    this.events.publish(
      createDomainEvent({
        name: DomainEvents.JobSubmittedForModeration,
        tenantId: job.tenantId,
        correlationId,
        payload: { jobId: job.id, code: job.code, title: job.title },
      }),
    );
    return this.toView(updated);
  }

  async publishJob(
    user: AuthenticatedUser,
    jobId: string,
    correlationId: string,
  ): Promise<JobView> {
    return this.submitForModeration(user, jobId, correlationId);
  }

  async updateJob(
    user: AuthenticatedUser,
    jobId: string,
    dto: CreateJobDto,
    correlationId: string,
  ): Promise<JobView> {
    const owned = await this.requireOwnedJob(user, jobId);
    const id = owned.id;

    const skillInputs = dto.skills ?? [];
    const skillData = await Promise.all(
      skillInputs.map(async (s) => ({
        skillId: await this.skills.resolveSkillId(s.name),
        name: s.name.trim(),
        required: s.required ?? true,
        weight: s.weight ?? 1,
      })),
    );

    await this.prisma.jobSkill.deleteMany({ where: { jobId: id } });

    const track = resolveCreateJobTrack(dto);
    const inferredLevel = dto.jobLevel ?? inferJobLevelFromTitle(dto.title, track);
    const primaryIndustry =
      dto.industry ||
      (dto.salesCriteria?.industries?.length ? dto.salesCriteria.industries[0] : undefined) ||
      (dto.technicalCriteria?.industries?.length ? dto.technicalCriteria.industries[0] : undefined);

    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements ?? null,
        benefits: dto.benefits ?? null,
        industry: normalizeIndustry(primaryIndustry) ?? primaryIndustry ?? null,
        subIndustry: dto.subIndustry?.trim() || null,
        department: dto.department ?? null,
        jobLevel: inferredLevel ?? dto.jobLevel ?? null,
        ...(track ? { jobTrack: track } : {}),
        ...(dto.salesCriteria != null ? { salesCriteria: salesCriteriaJson(dto.salesCriteria) } : {}),
        ...(dto.technicalCriteria != null
          ? { technicalCriteria: technicalCriteriaJson(dto.technicalCriteria) }
          : {}),
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
      include: { skills: true, company: { select: JOB_COMPANY_SELECT } },
    });

    if (updated.status === JobStatus.Published) {
      await this.embedAndPublish(updated, correlationId);
      void this.indexing.notifyJob(updated, 'URL_UPDATED');
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

    // Chuyển sang "Đăng" phải qua kiểm duyệt, không publish trực tiếp.
    if (status === JobStatus.Published) {
      return this.submitForModeration(user, jobId, correlationId);
    }

    // Các chuyển trạng thái còn lại: nháp / tạm dừng / đóng.
    const updated = await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status,
        publishedAt: job.publishedAt,
        deadline: job.deadline,
        updatedBy: user.id,
      },
      include: { skills: true, company: { select: JOB_COMPANY_SELECT } },
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.JobUpdated,
        tenantId: updated.tenantId,
        correlationId,
        payload: { jobId: updated.id, code: updated.code, title: updated.title, status },
      }),
    );
    if (status === JobStatus.Closed || status === JobStatus.Paused) {
      void this.indexing.notifyJob(updated, 'URL_DELETED');
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
      where: { id: job.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.id,
        status: JobStatus.Closed,
        updatedBy: user.id,
      },
    });
    void this.indexing.notifyJob(job, 'URL_DELETED');
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
        company: { select: JOB_COMPANY_SELECT },
        skills: { select: { name: true }, take: 6 },
      },
    });
    await backfillMissingJobSlugs(this.prisma, jobs);
    await backfillMissingCompanySlugs(this.prisma, jobs.map((j) => j.company));
    return jobs.map((j) => this.toListItem(j, company.companyName));
  }

  async listBookmarkedJobs(user: AuthenticatedUser): Promise<JobListItem[]> {
    const rows = await this.prisma.jobBookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            company: { select: JOB_COMPANY_SELECT },
            skills: { select: { name: true }, take: 6 },
          },
        },
      },
    });
    const visible = rows
      .filter((r) => !r.job.isDeleted && r.job.status === JobStatus.Published)
      .map((r) => r.job);
    await backfillMissingJobSlugs(this.prisma, visible);
    await backfillMissingCompanySlugs(
      this.prisma,
      visible.map((j) => j.company),
    );
    return visible.map((j) => this.toListItem(j, j.company.name, { isBookmarked: true }));
  }

  async addBookmark(user: AuthenticatedUser, jobRef: string): Promise<{ ok: true }> {
    const job = await this.findJobByRef(jobRef);
    if (job.status !== JobStatus.Published) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    await this.prisma.jobBookmark.upsert({
      where: { userId_jobId: { userId: user.id, jobId: job.id } },
      create: { userId: user.id, jobId: job.id },
      update: {},
    });
    return { ok: true };
  }

  async removeBookmark(user: AuthenticatedUser, jobRef: string): Promise<{ ok: true }> {
    const job = await this.findJobByRef(jobRef);
    await this.prisma.jobBookmark.deleteMany({
      where: { userId: user.id, jobId: job.id },
    });
    return { ok: true };
  }

  async listPublishedJobs(params: {
    keyword?: string;
    industry?: string;
    subIndustry?: string;
    role?: string;
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
    const subIndustry = params.subIndustry?.trim();
    const role = params.role?.trim();
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
      const terms = expandJobSearchKeywords(keyword);
      andFilters.push({
        OR: terms.flatMap((term) => [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { skills: { some: { name: { contains: term, mode: 'insensitive' } } } },
        ]),
      });
    }
    if (subIndustry) {
      andFilters.push({
        OR: [
          { subIndustry: { equals: subIndustry, mode: 'insensitive' } },
          { title: { contains: subIndustry, mode: 'insensitive' } },
          { description: { contains: subIndustry, mode: 'insensitive' } },
          { requirements: { contains: subIndustry, mode: 'insensitive' } },
        ],
      });
    }
    if (role) {
      andFilters.push({
        OR: [
          { title: { contains: role, mode: 'insensitive' } },
          { description: { contains: role, mode: 'insensitive' } },
          { skills: { some: { name: { contains: role, mode: 'insensitive' } } } },
        ],
      });
    }

    const industryValues = params.industry
      ? industrySearchValues([params.industry])
      : [];
    if (industryValues.length === 1) {
      andFilters.push({ industry: { equals: industryValues[0], mode: 'insensitive' } });
    } else if (industryValues.length > 1) {
      andFilters.push({
        OR: industryValues.map((v) => ({
          industry: { equals: v, mode: 'insensitive' },
        })),
      });
    }

    if (!jobLevels.length && track) {
      andFilters.push({
        OR: [{ jobTrack: track }, { jobLevel: { startsWith: `${track}.` } }],
      });
    }

    const jobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.Published,
        isDeleted: false,
        ...(experienceBands.length === 1
          ? { experienceBand: experienceBands[0] }
          : experienceBands.length > 1
            ? { experienceBand: { in: experienceBands } }
            : {}),
        ...(jobLevels.length === 1
          ? { jobLevel: jobLevels[0] }
          : jobLevels.length > 1
            ? { jobLevel: { in: jobLevels } }
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
        company: { select: JOB_COMPANY_SELECT },
        skills: { select: { name: true }, take: 6 },
      },
      take: 100,
    });

    await backfillMissingJobSlugs(this.prisma, jobs);
    const companies = [
      ...new Map(jobs.map((j) => [j.company.id, j.company])).values(),
    ];
    await backfillMissingCompanySlugs(this.prisma, companies);

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

  /** Vị trí đang tuyển — gom từ tin published trên nền tảng. */
  async listPublishedPositionStats(): Promise<JobPositionStatsView> {
    const jobs = await this.prisma.job.findMany({
      where: { status: JobStatus.Published, isDeleted: false },
      select: { title: true, industry: true },
    });
    const popular = aggregateJobTitles(jobs, 12);
    const grouped = new Map<string, { title: string; industry: string | null }[]>();
    for (const job of jobs) {
      const industry = job.industry?.trim() || 'Khác';
      const list = grouped.get(industry) ?? [];
      list.push(job);
      grouped.set(industry, list);
    }
    const byIndustry = [...grouped.entries()]
      .map(([industry, rows]) => ({
        industry,
        positions: aggregateJobTitles(rows, 10),
      }))
      .sort((a, b) => a.industry.localeCompare(b.industry, 'vi'));
    return { popular, byIndustry };
  }

  async getJob(ref: string, user?: AuthenticatedUser): Promise<JobView> {
    const job = await this.findJobByRef(ref);
    const withSlug = await this.ensureJobSlug(job);
    const view = this.toView(withSlug);
    if (user) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (candidate) {
        const existing = await this.prisma.application.findUnique({
          where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
          select: { id: true },
        });
        view.hasApplied = Boolean(existing);
      }
    }
    return view;
  }

  /** Đảm bảo job thuộc công ty của user (dùng cho các thao tác quản trị tin). */
  async requireOwnedJob(user: AuthenticatedUser, jobRef: string): Promise<JobWithRelations> {
    const company = await this.companies.requireUserCompany(user.id);
    const job = await this.findJobByRef(jobRef);
    if (job.companyId !== company.companyId) {
      throw new ForbiddenException('Tin tuyển dụng không thuộc công ty của bạn');
    }
    return this.ensureJobSlug(job);
  }

  private async findJobByRef(ref: string): Promise<JobWithRelations> {
    const where = looksLikeUuid(ref) ? { id: ref } : { slug: ref };
    const job = await this.prisma.job.findFirst({
      where: { ...where, isDeleted: false },
      include: { skills: true, company: { select: JOB_COMPANY_SELECT } },
    });
    if (!job) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    return job;
  }

  private async ensureJobSlug(job: JobWithRelations): Promise<JobWithRelations> {
    if (job.slug) return job;
    const slug = await allocateUniqueJobSlug(this.prisma, job.title, job.id);
    await this.prisma.job.update({ where: { id: job.id }, data: { slug } });
    return { ...job, slug };
  }

  private toView(job: JobWithRelations): JobView {
    const profile = job.company.profile as { logoStorageKey?: string } | null;
    return {
      id: job.id,
      slug: job.slug ?? job.id,
      code: job.code,
      companyId: job.companyId,
      companySlug: job.company.slug,
      companyName: job.company.name,
      companyWebsite: job.company.website ?? null,
      companyAddress: job.company.address ?? null,
      companyHasLogo: Boolean(profile?.logoStorageKey),
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      benefits: job.benefits,
      industry: normalizeIndustry(job.industry) ?? job.industry,
      subIndustry: job.subIndustry,
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
      moderationStatus: (job.moderationStatus as JobModerationStatus) ?? undefined,
      aiRiskScore: job.aiRiskScore ?? null,
      aiReason: job.aiReason ?? null,
      aiSuggestedAction:
        (job.aiSuggestedAction as JobView['aiSuggestedAction']) ?? null,
      jobTrack: job.jobTrack ?? null,
      salesCriteria: parseStoredSalesCriteria(job.salesCriteria),
      technicalCriteria: parseStoredTechnicalCriteria(job.technicalCriteria),
      skills: job.skills.map((s) => ({
        skillId: s.skillId,
        name: s.name,
        required: s.required,
        weight: s.weight,
      })),
      createdAt: job.createdAt.toISOString(),
      publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
    };
  }

  private toListItem(
    job: Job & {
      company: { id?: string; name: string; slug?: string | null };
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
      slug: job.slug ?? job.id,
      code: job.code,
      title: job.title,
      companyId: job.companyId,
      companySlug: job.company?.slug ?? null,
      companyName: job.company?.name ?? companyName,
      industry: normalizeIndustry(job.industry) ?? job.industry,
      subIndustry: job.subIndustry,
      jobLevel: job.jobLevel,
      location: job.location,
      employmentType: (job.employmentType as EmploymentType | null) ?? null,
      experienceBand: job.experienceBand,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      status: job.status as JobStatus,
      moderationStatus: (job.moderationStatus as JobModerationStatus) ?? undefined,
      jobTrack: job.jobTrack ?? null,
      skills: (job.skills ?? []).map((s) => s.name),
      createdAt: job.createdAt.toISOString(),
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      isNew,
      ...(extras?.isBookmarked != null ? { isBookmarked: extras.isBookmarked } : {}),
    };
  }
}

function aggregateJobTitles(
  rows: Array<{ title: string }>,
  limit: number,
): JobPositionCount[] {
  const map = new Map<string, JobPositionCount>();
  for (const row of rows) {
    const title = row.title.replace(/\s+/g, ' ').trim();
    if (!title) continue;
    const key = title.toLowerCase();
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { title, count: 1 });
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'vi'))
    .slice(0, limit);
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
