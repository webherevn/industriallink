import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CandidateStatus,
  DomainEvents,
  JobTrack,
  ResumeParseStatus,
  UserRole,
  type CandidateView,
  type CareerAdviceView,
  type CvDraftFromTextResponse,
  type CvDraftView,
  type ResumeParseStatusResponse,
  type ResumeParseStep,
  type ResumeUploadResponse,
  type SaveCvDraftToProfileResponse,
  type UploadAvatarResponse,
} from '@industriallink/contracts';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { AppEventBus } from '../../shared/events/event-bus';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { buildCvDraftFromText } from './cv-draft-from-text';
import { ExtractTextError, extractResumeText } from './resume/extract-text.util';
import { RESUME_PARSE_QUEUE_TOKEN, type ResumeParseJobData } from './resume/queue.constants';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const MAX_SIZE = 5 * 1024 * 1024;

const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AVATAR_MAX_SIZE = 2 * 1024 * 1024;

@Injectable()
export class CandidateService {
  private readonly logger = new Logger(CandidateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly codeGen: CodeGeneratorService,
    private readonly events: AppEventBus,
    private readonly ai: AiGatewayService,
    @Inject(RESUME_PARSE_QUEUE_TOKEN) private readonly queue: Queue<ResumeParseJobData>,
  ) {}

  /** Tạo hồ sơ ứng viên khi user vai trò Candidate đăng ký (xử lý sự kiện UserRegistered). */
  async createForUser(payload: {
    userId: string;
    displayName: string;
    role: string;
    tenantId: string;
  }): Promise<void> {
    if (payload.role !== UserRole.Candidate) return;
    const existing = await this.prisma.candidate.findUnique({ where: { userId: payload.userId } });
    if (existing) return;

    const code = await this.codeGen.next('CAN');
    const candidate = await this.prisma.candidate.create({
      data: {
        code,
        tenantId: payload.tenantId,
        userId: payload.userId,
        displayName: payload.displayName,
        status: CandidateStatus.Registered,
      },
    });
    await this.prisma.candidateTimeline.create({
      data: {
        candidateId: candidate.id,
        tenantId: payload.tenantId,
        type: 'candidate_created',
        title: 'Tạo hồ sơ ứng viên',
      },
    });
    this.logger.log(`Đã tạo Candidate ${code} cho user ${payload.userId}`);
  }

  async uploadResume(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    correlationId: string,
  ): Promise<ResumeUploadResponse> {
    if (!file) {
      throw new BadRequestException('Thiếu file CV');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận PDF, DOC, DOCX hoặc TXT');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File vượt quá 5MB');
    }

    const candidate = await this.getCandidateByUser(user.id);

    const storageKey = `resumes/${candidate.id}/${uuidv7()}-${file.originalname}`;
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const resume = await this.prisma.candidateResume.create({
      data: {
        candidateId: candidate.id,
        tenantId: candidate.tenantId,
        fileName: file.originalname,
        storageKey,
        mime: file.mimetype,
        size: file.size,
        hash,
        parseStatus: ResumeParseStatus.Pending,
      },
    });

    const jobData: ResumeParseJobData = {
      resumeId: resume.id,
      candidateId: candidate.id,
      tenantId: candidate.tenantId,
      correlationId,
    };
    let job;
    try {
      job = await this.queue.add('parse-resume', jobData, { jobId: resume.id });
    } catch (err) {
      this.logger.error(`Không enqueue parse-resume: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Không đưa CV vào hàng đợi phân tích (Redis). Kiểm tra REDIS_HOST trên server.',
      );
    }
    await this.prisma.candidateResume.update({
      where: { id: resume.id },
      data: { jobId: job.id },
    });

    await this.prisma.candidateTimeline.create({
      data: {
        candidateId: candidate.id,
        tenantId: candidate.tenantId,
        type: 'resume_uploaded',
        title: 'Tải lên CV',
        description: file.originalname,
      },
    });

    this.events.publish(
      createDomainEvent({
        name: DomainEvents.ResumeUploaded,
        tenantId: candidate.tenantId,
        correlationId,
        payload: { candidateId: candidate.id, resumeId: resume.id, fileName: file.originalname },
      }),
    );

    return { resumeId: resume.id, jobId: job.id ?? resume.id, status: ResumeParseStatus.Pending };
  }

  async getResumeStatus(
    user: AuthenticatedUser,
    resumeId: string,
  ): Promise<ResumeParseStatusResponse> {
    const candidate = await this.getCandidateByUser(user.id);
    const resume = await this.prisma.candidateResume.findFirst({
      where: { id: resumeId, candidateId: candidate.id },
    });
    if (!resume) {
      throw new NotFoundException('Không tìm thấy CV');
    }

    const [profile, aiProfile, skillCount] = await Promise.all([
      this.prisma.candidateProfile.findUnique({ where: { candidateId: candidate.id } }),
      this.prisma.candidateAiProfile.findUnique({ where: { candidateId: candidate.id } }),
      this.prisma.candidateSkill.count({ where: { candidateId: candidate.id } }),
    ]);

    const status = resume.parseStatus as ResumeParseStatus;
    const done = status === ResumeParseStatus.Completed;
    const steps: ResumeParseStep[] = [
      { key: 'read_cv', label: 'Đọc CV', done: status !== ResumeParseStatus.Pending },
      { key: 'analyze_skill', label: 'Phân tích kỹ năng', done: skillCount > 0 },
      { key: 'identify_industry', label: 'Xác định ngành', done: Boolean(profile?.industry) },
      { key: 'career', label: 'Định hướng nghề nghiệp', done: Boolean(aiProfile?.careerPath) },
      { key: 'summary', label: 'Tạo tóm tắt AI', done: Boolean(aiProfile?.summary) },
      { key: 'matching', label: 'Sẵn sàng gợi ý', done },
    ];

    return {
      resumeId: resume.id,
      status,
      steps,
      candidateId: done ? candidate.id : null,
      error: resume.parseError,
    };
  }

  async getMyCandidate(user: AuthenticatedUser): Promise<CandidateView> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: { profile: true, aiProfile: true, skills: { orderBy: { name: 'asc' } } },
    });
    if (!candidate) {
      throw new NotFoundException('Chưa có hồ sơ ứng viên');
    }
    return this.toCandidateView(candidate);
  }

  /**
   * Hồ sơ ứng viên cho NTD xem (cùng tenant) — dùng từ Search / Matching.
   */
  async getCandidateForRecruiter(
    user: AuthenticatedUser,
    candidateId: string,
  ): Promise<CandidateView> {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        tenantId: user.tenantId,
        isDeleted: false,
      },
      include: { profile: true, aiProfile: true, skills: { orderBy: { name: 'asc' } } },
    });
    if (!candidate) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }
    return this.toCandidateView(candidate);
  }

  private toCandidateView(candidate: {
    id: string;
    code: string;
    displayName: string;
    status: string;
    avatarStorageKey: string | null;
    profile: {
      currentPosition: string | null;
      jobLevel: string | null;
      totalExperienceYears: number | null;
      industry: string | null;
      industriesExperienced: string[];
      specialization: string | null;
      summary: string | null;
      careerObjective: string | null;
      productsSold: string[];
      customerSegments: string[];
      b2bExperienceBand: string | null;
      marketsCovered: string[];
      latestRevenue: number | null;
      kpiAchievementPct: number | null;
      salesHighlights: string | null;
      customerDevStyle: string | null;
      newCustomerRatioPct: number | null;
      dealType: string | null;
      typicalDealValue: number | null;
      maxDealValue: number | null;
      sellingStages: string[];
      jobReadiness: string | null;
      noticePeriodDays: number | null;
      expectedSalaryMin: number | null;
      expectedSalaryMax: number | null;
      languages: string[];
      hasB2License: boolean | null;
      willingToTravel: boolean | null;
    } | null;
    aiProfile: {
      summary: string | null;
      strengths: string[];
      weaknesses: string[];
      careerPath: string | null;
      aiScore: number | null;
      confidence: number | null;
      lastAnalyzedAt: Date | null;
    } | null;
    skills: {
      skillId: string | null;
      name: string;
      level: string;
      yearsOfExperience: number | null;
    }[];
  }): CandidateView {
    return {
      id: candidate.id,
      code: candidate.code,
      displayName: candidate.displayName,
      status: candidate.status as CandidateStatus,
      profileCompletion: computeProfileCompletion(candidate),
      hasAvatar: Boolean(candidate.avatarStorageKey),
      profile: candidate.profile
        ? {
            currentPosition: candidate.profile.currentPosition,
            jobLevel: candidate.profile.jobLevel,
            totalExperienceYears: candidate.profile.totalExperienceYears,
            industry: candidate.profile.industry,
            industriesExperienced: candidate.profile.industriesExperienced ?? [],
            specialization: candidate.profile.specialization,
            summary: candidate.profile.summary,
            careerObjective: candidate.profile.careerObjective,
            sales: {
              productsSold: candidate.profile.productsSold ?? [],
              customerSegments: candidate.profile.customerSegments ?? [],
              b2bExperienceBand: candidate.profile.b2bExperienceBand,
              marketsCovered: candidate.profile.marketsCovered ?? [],
              latestRevenue: candidate.profile.latestRevenue,
              kpiAchievementPct: candidate.profile.kpiAchievementPct,
              salesHighlights: candidate.profile.salesHighlights,
              customerDevStyle: candidate.profile.customerDevStyle,
              newCustomerRatioPct: candidate.profile.newCustomerRatioPct,
              dealType: candidate.profile.dealType,
              typicalDealValue: candidate.profile.typicalDealValue,
              maxDealValue: candidate.profile.maxDealValue,
              sellingStages: candidate.profile.sellingStages ?? [],
              jobReadiness: candidate.profile.jobReadiness,
              noticePeriodDays: candidate.profile.noticePeriodDays,
              expectedSalaryMin: candidate.profile.expectedSalaryMin,
              expectedSalaryMax: candidate.profile.expectedSalaryMax,
              languages: candidate.profile.languages ?? [],
              hasB2License: candidate.profile.hasB2License,
              willingToTravel: candidate.profile.willingToTravel,
            },
          }
        : null,
      aiProfile: candidate.aiProfile
        ? {
            summary: candidate.aiProfile.summary,
            strengths: candidate.aiProfile.strengths,
            weaknesses: candidate.aiProfile.weaknesses,
            careerPath: candidate.aiProfile.careerPath,
            aiScore: candidate.aiProfile.aiScore,
            confidence: candidate.aiProfile.confidence,
            lastAnalyzedAt: candidate.aiProfile.lastAnalyzedAt?.toISOString() ?? null,
          }
        : null,
      skills: candidate.skills.map((s) => ({
        skillId: s.skillId,
        name: s.name,
        level: s.level as CandidateView['skills'][number]['level'],
        yearsOfExperience: s.yearsOfExperience,
      })),
    };
  }

  async uploadAvatar(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<UploadAvatarResponse> {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh');
    }
    if (!AVATAR_MIME.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF');
    }
    if (file.size > AVATAR_MAX_SIZE) {
      throw new BadRequestException('Ảnh vượt quá 2MB');
    }

    const candidate = await this.getCandidateByUser(user.id);
    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : file.mimetype === 'image/gif'
            ? 'gif'
            : 'jpg';
    const storageKey = `avatars/${candidate.id}/${uuidv7()}.${ext}`;
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    await this.prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        avatarStorageKey: storageKey,
        avatarMime: file.mimetype,
        updatedBy: user.id,
      },
    });

    return { hasAvatar: true, message: 'Đã cập nhật ảnh đại diện' };
  }

  async getAvatarBuffer(
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; mime: string } | null> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      select: { avatarStorageKey: true, avatarMime: true },
    });
    if (!candidate?.avatarStorageKey) return null;
    const buffer = await this.storage.getObject(candidate.avatarStorageKey);
    return { buffer, mime: candidate.avatarMime ?? 'image/jpeg' };
  }

  /**
   * Tạo bản nháp CV từ văn bản tự do: AI parse + heuristic → trường đã có / còn thiếu.
   */
  async draftCvFromText(
    user: AuthenticatedUser,
    text: string,
  ): Promise<CvDraftFromTextResponse> {
    const trimmed = text.trim();
    if (trimmed.length < 40) {
      throw new BadRequestException('Vui lòng nhập ít nhất khoảng 40 ký tự để AI phân tích');
    }
    return this.buildCvDraftResponse(user, trimmed, 'cv-free-text.txt');
  }

  /**
   * Upload file CV → trích text → AI phân tích → cùng format trường đã có / còn thiếu.
   */
  async draftCvFromFile(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<CvDraftFromTextResponse> {
    if (!file) {
      throw new BadRequestException('Thiếu file CV');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận PDF, DOC, DOCX hoặc TXT');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File vượt quá 5MB');
    }

    let text: string;
    try {
      text = await extractResumeText(file.buffer, file.mimetype);
    } catch (err) {
      throw new BadRequestException(
        err instanceof ExtractTextError
          ? err.message
          : 'Không đọc được nội dung CV. Thử PDF/DOCX/TXT có chữ.',
      );
    }

    const trimmed = text.trim();
    return this.buildCvDraftResponse(
      user,
      trimmed || `CV file: ${file.originalname}`,
      file.originalname || 'cv-upload.pdf',
    );
  }

  /**
   * Lưu bản nháp CV (wizard) vào hồ sơ ứng viên — tuỳ chọn, không bắt buộc để tải CV.
   */
  async saveCvDraftToProfile(
    user: AuthenticatedUser,
    draft: CvDraftView,
  ): Promise<SaveCvDraftToProfileResponse> {
    const candidate = await this.getCandidateByUser(user.id);
    const skills = [...new Set(draft.skills.map((s) => s.trim()).filter(Boolean))];
    const soft = [...new Set(draft.softSkills.map((s) => s.trim()).filter(Boolean))];
    const allSkillNames = [...new Set([...skills, ...soft])];

    const filled = [
      draft.fullName,
      draft.title,
      draft.summary,
      draft.email,
      draft.phone,
      draft.location,
      skills.length > 0,
      draft.experience.length > 0,
      draft.education.length > 0,
    ].filter(Boolean).length;
    const profileCompletion = Math.min(95, Math.round((filled / 9) * 100));

    await this.prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          displayName: draft.fullName.trim() || candidate.displayName,
          status: CandidateStatus.Completed,
          profileCompletion,
        },
      });

      const salesHighlights = [
        ...draft.experience.map(
          (e) => `${e.role} @ ${e.company} (${e.period}): ${e.bullets}`.trim(),
        ),
        ...draft.projects.map((p) => `${p.name}: ${p.detail}`.trim()),
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 4000);

      await tx.candidateProfile.upsert({
        where: { candidateId: candidate.id },
        create: {
          candidateId: candidate.id,
          currentPosition: draft.title || null,
          summary: draft.summary || null,
          careerObjective: draft.summary || null,
          specialization: draft.location || null,
          salesHighlights: salesHighlights || null,
        },
        update: {
          currentPosition: draft.title || null,
          summary: draft.summary || null,
          careerObjective: draft.summary || null,
          specialization: draft.location || null,
          salesHighlights: salesHighlights || null,
        },
      });

      await tx.candidateSkill.deleteMany({ where: { candidateId: candidate.id } });
      for (const name of allSkillNames.slice(0, 40)) {
        await tx.candidateSkill.create({
          data: {
            candidateId: candidate.id,
            name,
            level: soft.includes(name) ? 'intermediate' : 'advanced',
          },
        });
      }

      await tx.candidateTimeline.create({
        data: {
          candidateId: candidate.id,
          tenantId: candidate.tenantId,
          type: 'profile_updated',
          title: 'Đã lưu CV vào hồ sơ',
          description: `Cập nhật từ wizard tạo CV (${allSkillNames.length} kỹ năng).`,
        },
      });
    });

    return {
      message: 'Đã lưu thông tin CV vào hồ sơ của bạn.',
      profileCompletion,
    };
  }

  private async buildCvDraftResponse(
    user: AuthenticatedUser,
    text: string,
    fileName: string,
  ): Promise<CvDraftFromTextResponse> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: { user: { select: { email: true, displayName: true } } },
    });
    if (!candidate) {
      throw new NotFoundException('Chưa có hồ sơ ứng viên');
    }

    const parsed = await this.ai.parseResume({ fileName, text });

    const { draft, fields } = buildCvDraftFromText({
      text,
      parsed,
      fallbackName: candidate.displayName || candidate.user.displayName || 'Ứng viên',
      fallbackEmail: candidate.user.email ?? '',
    });

    const missingCount = fields.filter((f) => f.status === 'missing').length;
    const weakCount = fields.filter((f) => f.status === 'weak').length;

    return {
      draft,
      fields,
      missingCount,
      aiScore: parsed.aiScore,
      message:
        missingCount === 0
          ? weakCount > 0
            ? `AI đã trích xuất hồ sơ. Còn ${weakCount} mục nên bổ sung để CV mạnh hơn.`
            : 'AI đã trích xuất khá đầy đủ. Bạn có thể chỉnh sửa rồi chọn mẫu CV.'
          : `AI đã tạo ${fields.length - missingCount} trường. Còn ${missingCount} mục cần bổ sung.`,
    };
  }

  /** Career Engine: lộ trình + khung lương dựa trên hồ sơ ứng viên. */
  async getCareerAdvice(
    user: AuthenticatedUser,
    opts?: { track?: JobTrack },
  ): Promise<CareerAdviceView> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: { profile: true, aiProfile: true, skills: true },
    });
    if (!candidate) {
      throw new NotFoundException('Chưa có hồ sơ ứng viên');
    }

    return this.ai.adviseCareer({
      track: opts?.track,
      jobLevel: candidate.profile?.jobLevel,
      currentPosition: candidate.profile?.currentPosition,
      industry: candidate.profile?.industry,
      skills: candidate.skills.map((s) => s.name),
      yearsOfExperience: candidate.profile?.totalExperienceYears,
      strengths: candidate.aiProfile?.strengths ?? [],
      weaknesses: candidate.aiProfile?.weaknesses ?? [],
    });
  }

  private async getCandidateByUser(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException('Tài khoản không phải ứng viên hoặc chưa có hồ sơ');
    }
    return candidate;
  }
}

type ProfileCompletionInput = {
  aiProfile: { summary: string | null } | null;
  profile: {
    currentPosition: string | null;
    jobLevel: string | null;
    totalExperienceYears: number | null;
    industry: string | null;
    specialization: string | null;
    summary: string | null;
  } | null;
  skills: ReadonlyArray<unknown>;
};

const PROFILE_FIELD_KEYS = [
  'currentPosition',
  'jobLevel',
  'totalExperienceYears',
  'industry',
  'specialization',
  'summary',
] as const;

/**
 * % hoàn thiện hồ sơ tính từ dữ liệu thật (không dùng số cứng):
 * - Có AI Profile (đã phân tích CV): 30%.
 * - Mỗi field trong hồ sơ nghề nghiệp đã điền: chia đều 40%.
 * - Có ít nhất 1 kỹ năng: 15%; có từ 3 kỹ năng trở lên: thêm 15%.
 */
export function computeProfileCompletion(candidate: ProfileCompletionInput): number {
  let score = 0;

  if (candidate.aiProfile?.summary) {
    score += 30;
  }

  if (candidate.profile) {
    const filled = PROFILE_FIELD_KEYS.filter((key) => {
      const value = candidate.profile![key];
      return value !== null && value !== undefined && value !== '';
    }).length;
    score += (filled / PROFILE_FIELD_KEYS.length) * 40;
  }

  const skillCount = candidate.skills.length;
  if (skillCount >= 1) score += 15;
  if (skillCount >= 3) score += 15;

  return Math.round(Math.min(100, score));
}
