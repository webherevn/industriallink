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
  availabilityToNoticeDays,
  type CandidateView,
  type CareerAdviceView,
  type CvDraftFromTextResponse,
  type CvDraftView,
  type ResumeParseStatusResponse,
  type ResumeParseStep,
  type ResumeUploadResponse,
  type SaveCvDraftToProfileResponse,
  type UpdateCandidateProfileRequest,
  type UpdateCandidateProfileResponse,
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
      include: {
        profile: true,
        aiProfile: true,
        skills: { orderBy: { name: 'asc' } },
        experiences: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!candidate) {
      throw new NotFoundException('Chưa có hồ sơ ứng viên');
    }
    return this.toCandidateView(candidate);
  }

  /** Cập nhật hồ sơ đầy đủ từ wizard chỉnh sửa hồ sơ. */
  async updateMyProfile(
    user: AuthenticatedUser,
    input: UpdateCandidateProfileRequest,
  ): Promise<UpdateCandidateProfileResponse> {
    const candidate = await this.getCandidateByUser(user.id);
    const skillRows = input.skills
      .map((s) => ({
        name: s.name.trim(),
        level: (s.level || 'intermediate').trim() || 'intermediate',
      }))
      .filter((s) => s.name.length > 0)
      .slice(0, 50);

    const experienceRows = (input.experiences ?? [])
      .map((e, idx) => ({
        sortOrder: idx,
        companyName: e.companyName.trim(),
        jobTitle: e.jobTitle.trim(),
        startYear: toIntOrNull(e.startYear),
        endYear: toIntOrNull(e.endYear),
        isCurrent: Boolean(e.isCurrent),
        industries: cleanList(e.industries),
        productsSold: cleanList(e.productsSold),
        customerSegments: cleanList(e.customerSegments),
        marketsCovered: cleanList(e.marketsCovered),
        sellingStages: cleanList(e.sellingStages),
        revenueBand: emptyToNull(e.revenueBand),
        latestRevenue: e.latestRevenue,
        kpiBand: emptyToNull(e.kpiBand),
        kpiAchievementPct: e.kpiAchievementPct,
        newCustomerRatioBand: emptyToNull(e.newCustomerRatioBand),
        newCustomerRatioPct: e.newCustomerRatioPct,
        dealType: emptyToNull(e.dealType),
        typicalDealValueBand: emptyToNull(e.typicalDealValueBand),
        typicalDealValue: e.typicalDealValue,
        maxDealValue: e.maxDealValue,
        maxDealRole: emptyToNull(e.maxDealRole),
        highlights: emptyToNull(e.highlights),
        jobDescription: emptyToNull(e.jobDescription),
        missingFields: cleanList(e.missingFields ?? []),
        source: e.source?.trim() || 'manual',
      }))
      .filter((e) => e.companyName.length > 0 && e.jobTitle.length > 0)
      .slice(0, 20);

    const union = (a: string[], b: string[]) =>
      [...new Set([...a, ...b].map((x) => x.trim()).filter(Boolean))];

    const productsSold = experienceRows.reduce(
      (acc, e) => union(acc, e.productsSold),
      cleanList(input.productsSold),
    );
    const customerSegments = experienceRows.reduce(
      (acc, e) => union(acc, e.customerSegments),
      cleanList(input.customerSegments),
    );
    const marketsCovered = experienceRows.reduce(
      (acc, e) => union(acc, e.marketsCovered),
      cleanList(input.marketsCovered),
    );
    const sellingStages = experienceRows.reduce(
      (acc, e) => union(acc, e.sellingStages),
      cleanList(input.sellingStages),
    );
    const industriesExperienced = experienceRows.reduce(
      (acc, e) => union(acc, e.industries),
      cleanList(input.industriesExperienced),
    );

    const firstExp = experienceRows[0];
    const profileData = {
      currentPosition: emptyToNull(input.currentPosition) ?? firstExp?.jobTitle ?? null,
      jobLevel: emptyToNull(input.jobLevel),
      totalExperienceYears: input.totalExperienceYears,
      industry: emptyToNull(input.industry) ?? firstExp?.industries[0] ?? null,
      industriesExperienced,
      specialization: emptyToNull(input.specialization),
      summary: emptyToNull(input.summary),
      careerObjective: emptyToNull(input.careerObjective),
      productsSold,
      customerSegments,
      b2bExperienceBand: emptyToNull(input.b2bExperienceBand),
      marketsCovered,
      salesHighlights: emptyToNull(input.salesHighlights),
      dealType: emptyToNull(input.dealType) ?? firstExp?.dealType ?? null,
      latestRevenue: input.latestRevenue ?? firstExp?.latestRevenue ?? null,
      kpiAchievementPct: input.kpiAchievementPct ?? firstExp?.kpiAchievementPct ?? null,
      newCustomerRatioPct: input.newCustomerRatioPct ?? firstExp?.newCustomerRatioPct ?? null,
      typicalDealValue: input.typicalDealValue ?? firstExp?.typicalDealValue ?? null,
      maxDealValue: input.maxDealValue ?? firstExp?.maxDealValue ?? null,
      sellingStages,
      jobReadiness: emptyToNull(input.jobReadiness),
      availabilityBand: emptyToNull(input.availabilityBand),
      noticePeriodDays: toIntOrNull(input.noticePeriodDays),
      expectedSalaryMin: toIntOrNull(input.expectedSalaryMin),
      expectedSalaryMax: toIntOrNull(input.expectedSalaryMax),
      expectedOte: toIntOrNull(input.expectedOte),
      languages: cleanList(input.languages),
      hasB2License: input.hasB2License,
      driverLicenseType: emptyToNull(input.driverLicenseType),
      willingToTravel: input.willingToTravel,
      travelAbility: emptyToNull(input.travelAbility),
      desiredPositions: cleanList(input.desiredPositions).slice(0, 3),
      desiredLocations: cleanList(input.desiredLocations),
      careerMotivations: cleanList(input.careerMotivations).slice(0, 3),
      workStyles: cleanList(input.workStyles),
      careerOrientation: (() => {
        const orientations = cleanList(input.careerOrientations ?? []);
        if (orientations.length) return orientations.join(' | ');
        return emptyToNull(input.careerOrientation);
      })(),
      // Câu assessment phong cách Sales — lưu kèm map Hunter/Hybrid/Farmer
      customerDevStyle: (() => {
        const behavior = emptyToNull(input.salesBehavior);
        if (behavior) return behavior;
        return emptyToNull(input.customerDevStyle);
      })(),
      educationLevel: emptyToNull(input.educationLevel),
      educationSchool: emptyToNull(input.educationSchool),
      educationMajor: emptyToNull(input.educationMajor),
      certificates: cleanList(input.certificates),
      birthYear: toIntOrNull(input.birthYear),
      currentCity: emptyToNull(input.currentCity),
      phone: emptyToNull(input.phone),
    };

    const existingAi = await this.prisma.candidateAiProfile.findUnique({
      where: { candidateId: candidate.id },
      select: { summary: true },
    });
    const profileCompletion = computeProfileCompletion({
      aiProfile: existingAi,
      profile: profileData,
      skills: skillRows,
      experiences: experienceRows,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          displayName: input.displayName.trim() || candidate.displayName,
          status: CandidateStatus.Completed,
          profileCompletion,
        },
      });

      await tx.candidateProfile.upsert({
        where: { candidateId: candidate.id },
        create: { candidateId: candidate.id, ...profileData },
        update: profileData,
      });

      await tx.candidateSkill.deleteMany({ where: { candidateId: candidate.id } });
      for (const s of skillRows) {
        await tx.candidateSkill.create({
          data: {
            candidateId: candidate.id,
            name: s.name,
            level: s.level,
          },
        });
      }

      await tx.candidateExperience.deleteMany({ where: { candidateId: candidate.id } });
      for (const e of experienceRows) {
        await tx.candidateExperience.create({
          data: { candidateId: candidate.id, ...e },
        });
      }

      await tx.candidateTimeline.create({
        data: {
          candidateId: candidate.id,
          tenantId: candidate.tenantId,
          type: 'profile_updated',
          title: 'Đã cập nhật hồ sơ',
          description: `Wizard hồ sơ (${experienceRows.length} kinh nghiệm, ${sellingStages.length} giai đoạn bán).`,
        },
      });
    });

    const updated = await this.getMyCandidate(user);
    return {
      message: 'Đã cập nhật hồ sơ thành công.',
      candidate: updated,
    };
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
      include: {
        profile: true,
        aiProfile: true,
        skills: { orderBy: { name: 'asc' } },
        experiences: { orderBy: { sortOrder: 'asc' } },
      },
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
    profile: Record<string, unknown> | null;
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
    experiences?: Array<Record<string, unknown>>;
  }): CandidateView {
    const p = candidate.profile as {
      currentPosition: string | null;
      jobLevel: string | null;
      totalExperienceYears: number | null;
      industry: string | null;
      industriesExperienced?: string[];
      specialization: string | null;
      summary: string | null;
      careerObjective: string | null;
      productsSold?: string[];
      customerSegments?: string[];
      b2bExperienceBand: string | null;
      marketsCovered?: string[];
      latestRevenue: number | null;
      kpiAchievementPct: number | null;
      salesHighlights: string | null;
      customerDevStyle: string | null;
      newCustomerRatioPct: number | null;
      dealType: string | null;
      typicalDealValue: number | null;
      maxDealValue: number | null;
      sellingStages?: string[];
      jobReadiness: string | null;
      availabilityBand?: string | null;
      noticePeriodDays: number | null;
      expectedSalaryMin: number | null;
      expectedSalaryMax: number | null;
      expectedOte?: number | null;
      languages?: string[];
      hasB2License: boolean | null;
      driverLicenseType?: string | null;
      willingToTravel: boolean | null;
      travelAbility?: string | null;
      desiredPositions?: string[];
      desiredLocations?: string[];
      careerMotivations?: string[];
      workStyles?: string[];
      careerOrientation?: string | null;
      educationLevel?: string | null;
      educationSchool?: string | null;
      educationMajor?: string | null;
      certificates?: string[];
      birthYear?: number | null;
      currentCity?: string | null;
      phone?: string | null;
    } | null;

    const experiences = (candidate.experiences ?? []).map((raw) => {
      const e = raw as {
        id: string;
        sortOrder: number;
        companyName: string;
        jobTitle: string;
        startYear: number | null;
        endYear: number | null;
        isCurrent: boolean;
        industries?: string[];
        productsSold?: string[];
        customerSegments?: string[];
        marketsCovered?: string[];
        sellingStages?: string[];
        revenueBand: string | null;
        latestRevenue: number | null;
        kpiBand: string | null;
        kpiAchievementPct: number | null;
        newCustomerRatioBand: string | null;
        newCustomerRatioPct: number | null;
        dealType: string | null;
        typicalDealValueBand: string | null;
        typicalDealValue: number | null;
        maxDealValue: number | null;
        maxDealRole: string | null;
        highlights: string | null;
        jobDescription: string | null;
        missingFields?: string[];
        source: string;
      };
      return {
        id: e.id,
        sortOrder: e.sortOrder,
        companyName: e.companyName,
        jobTitle: e.jobTitle,
        startYear: e.startYear,
        endYear: e.endYear,
        isCurrent: e.isCurrent,
        industries: e.industries ?? [],
        productsSold: e.productsSold ?? [],
        customerSegments: e.customerSegments ?? [],
        marketsCovered: e.marketsCovered ?? [],
        sellingStages: e.sellingStages ?? [],
        revenueBand: e.revenueBand,
        latestRevenue: e.latestRevenue,
        kpiBand: e.kpiBand,
        kpiAchievementPct: e.kpiAchievementPct,
        newCustomerRatioBand: e.newCustomerRatioBand,
        newCustomerRatioPct: e.newCustomerRatioPct,
        dealType: e.dealType,
        typicalDealValueBand: e.typicalDealValueBand,
        typicalDealValue: e.typicalDealValue,
        maxDealValue: e.maxDealValue,
        maxDealRole: e.maxDealRole,
        highlights: e.highlights,
        jobDescription: e.jobDescription,
        missingFields: e.missingFields ?? [],
        source: e.source,
      };
    });

    return {
      id: candidate.id,
      code: candidate.code,
      displayName: candidate.displayName,
      status: candidate.status as CandidateStatus,
      profileCompletion: computeProfileCompletion({
        aiProfile: candidate.aiProfile,
        profile: p,
        skills: candidate.skills,
        experiences,
      }),
      hasAvatar: Boolean(candidate.avatarStorageKey),
      profile: p
        ? {
            currentPosition: p.currentPosition,
            jobLevel: p.jobLevel,
            totalExperienceYears: p.totalExperienceYears,
            industry: p.industry,
            industriesExperienced: p.industriesExperienced ?? [],
            specialization: p.specialization,
            summary: p.summary,
            careerObjective: p.careerObjective,
            birthYear: p.birthYear ?? null,
            currentCity: p.currentCity ?? null,
            phone: p.phone ?? null,
            educationLevel: p.educationLevel ?? null,
            educationSchool: p.educationSchool ?? null,
            educationMajor: p.educationMajor ?? null,
            certificates: p.certificates ?? [],
            sales: {
              productsSold: p.productsSold ?? [],
              customerSegments: p.customerSegments ?? [],
              b2bExperienceBand: p.b2bExperienceBand,
              marketsCovered: p.marketsCovered ?? [],
              latestRevenue: p.latestRevenue,
              kpiAchievementPct: p.kpiAchievementPct,
              salesHighlights: p.salesHighlights,
              customerDevStyle: p.customerDevStyle,
              newCustomerRatioPct: p.newCustomerRatioPct,
              dealType: p.dealType,
              typicalDealValue: p.typicalDealValue,
              maxDealValue: p.maxDealValue,
              sellingStages: p.sellingStages ?? [],
              jobReadiness: p.jobReadiness,
              availabilityBand: p.availabilityBand ?? null,
              noticePeriodDays: p.noticePeriodDays,
              expectedSalaryMin: p.expectedSalaryMin,
              expectedSalaryMax: p.expectedSalaryMax,
              expectedOte: p.expectedOte ?? null,
              languages: p.languages ?? [],
              hasB2License: p.hasB2License,
              driverLicenseType: p.driverLicenseType ?? null,
              willingToTravel: p.willingToTravel,
              travelAbility: p.travelAbility ?? null,
              desiredPositions: p.desiredPositions ?? [],
              desiredLocations: p.desiredLocations ?? [],
              salesBehavior: p.customerDevStyle ?? null,
              careerMotivations: p.careerMotivations ?? [],
              workStyles: p.workStyles ?? [],
              careerOrientations: (p.careerOrientation ?? '')
                .split(/\s*\|\s*/)
                .map((s) => s.trim())
                .filter(Boolean),
              careerOrientation: p.careerOrientation ?? null,
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
      experiences,
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

      const salesHighlights =
        draft.salesHighlights?.trim() ||
        [
          ...draft.experience.map(
            (e) => `${e.role} @ ${e.company} (${e.period}): ${e.bullets}`.trim(),
          ),
          ...draft.projects.map((p) => `${p.name}: ${p.detail}`.trim()),
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 4000);

      const productsSold = [
        ...new Set([
          ...(draft.productsSold ?? []),
          ...draft.experience.flatMap((e) => e.productsSold ?? []),
        ]),
      ];
      const customerSegments = [
        ...new Set([
          ...(draft.customerSegments ?? []),
          ...draft.experience.flatMap((e) => e.customerSegments ?? []),
        ]),
      ];
      const marketsCovered = [
        ...new Set([
          ...(draft.marketsCovered ?? []),
          ...draft.experience.flatMap((e) => e.marketsCovered ?? []),
        ]),
      ];
      const sellingStages = [
        ...new Set(draft.experience.flatMap((e) => e.sellingStages ?? [])),
      ];
      const industriesExperienced = [
        ...new Set([
          ...(draft.industriesExperienced ?? []),
          ...draft.experience.flatMap((e) => e.industries ?? []),
        ]),
      ];
      const careerOrientations = cleanList(draft.careerOrientations ?? []);
      const careerMotivations = cleanList(draft.careerMotivations ?? []).slice(0, 3);
      const workStyles = cleanList(draft.workStyles ?? []);
      const salesBehavior = emptyToNull(draft.salesBehavior);
      const firstExp = draft.experience[0];

      const profileData = {
        currentPosition: draft.title || null,
        summary: draft.summary || null,
        careerObjective: draft.summary || null,
        currentCity: draft.location || null,
        phone: draft.phone || null,
        birthYear: toIntOrNull(draft.birthYear),
        educationLevel: emptyToNull(draft.educationLevel),
        industriesExperienced,
        productsSold,
        customerSegments,
        marketsCovered,
        sellingStages,
        b2bExperienceBand: emptyToNull(draft.b2bExperienceBand),
        latestRevenue: firstExp?.latestRevenue ?? null,
        kpiAchievementPct: firstExp?.kpiAchievementPct ?? null,
        newCustomerRatioPct:
          draft.newCustomerRatioPct ?? firstExp?.newCustomerRatioPct ?? null,
        dealType: emptyToNull(draft.dealType) ?? emptyToNull(firstExp?.dealType ?? null),
        typicalDealValue:
          draft.typicalDealValue ?? firstExp?.typicalDealValue ?? null,
        maxDealValue: draft.maxDealValue ?? firstExp?.maxDealValue ?? null,
        salesHighlights: salesHighlights || null,
        customerDevStyle: salesBehavior,
        jobReadiness: emptyToNull(draft.jobReadiness),
        availabilityBand: emptyToNull(draft.availabilityBand),
        noticePeriodDays: availabilityToNoticeDays(draft.availabilityBand ?? null),
        expectedSalaryMin: toIntOrNull(draft.expectedSalaryMin),
        expectedSalaryMax: toIntOrNull(draft.expectedSalaryMax),
        expectedOte: toIntOrNull(draft.expectedOte),
        languages: draft.languages ?? [],
        hasB2License: draft.hasB2License ?? null,
        driverLicenseType: emptyToNull(draft.driverLicenseType),
        travelAbility: emptyToNull(draft.travelAbility),
        desiredPositions: (draft.desiredPositions ?? []).slice(0, 3),
        desiredLocations: cleanList(draft.desiredLocations ?? []),
        careerMotivations,
        workStyles,
        careerOrientation: careerOrientations.length
          ? careerOrientations.join(' | ')
          : null,
        certificates: draft.certificates ?? [],
        educationSchool: draft.education[0]?.school || null,
        educationMajor: draft.education[0]?.degree || null,
      };

      await tx.candidateProfile.upsert({
        where: { candidateId: candidate.id },
        create: {
          candidateId: candidate.id,
          ...profileData,
        },
        update: profileData,
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

      await tx.candidateExperience.deleteMany({ where: { candidateId: candidate.id } });
      for (const [idx, exp] of draft.experience.slice(0, 12).entries()) {
        const years = parsePeriodYears(exp.period);
        const missingFields: string[] = [];
        if (exp.latestRevenue == null) missingFields.push('revenue');
        if (exp.kpiAchievementPct == null) missingFields.push('kpi');
        if (exp.newCustomerRatioPct == null) missingFields.push('newCustomerRatio');
        if (!(exp.sellingStages?.length > 0)) missingFields.push('sellingStages');
        if (!(exp.productsSold?.length > 0)) missingFields.push('products');
        if (!(exp.customerSegments?.length > 0)) missingFields.push('customerSegments');
        if (!(exp.marketsCovered?.length > 0)) missingFields.push('markets');
        if (!(exp.industries?.length > 0)) missingFields.push('industries');
        await tx.candidateExperience.create({
          data: {
            candidateId: candidate.id,
            sortOrder: idx,
            companyName: exp.company.trim() || 'Công ty chưa rõ',
            jobTitle: exp.role.trim() || draft.title || 'Sales',
            startYear: years.start,
            endYear: years.end,
            isCurrent: years.isCurrent,
            industries: exp.industries ?? [],
            productsSold: exp.productsSold ?? [],
            customerSegments: exp.customerSegments ?? [],
            marketsCovered: exp.marketsCovered ?? [],
            sellingStages: exp.sellingStages ?? [],
            latestRevenue: exp.latestRevenue ?? null,
            kpiAchievementPct: exp.kpiAchievementPct ?? null,
            newCustomerRatioPct: exp.newCustomerRatioPct ?? null,
            dealType: emptyToNull(exp.dealType),
            typicalDealValue: exp.typicalDealValue ?? null,
            maxDealValue: exp.maxDealValue ?? null,
            highlights: exp.bullets?.trim() || null,
            jobDescription: exp.bullets?.trim() || null,
            missingFields,
            source: 'cv_ai',
          },
        });
      }

      await tx.candidateTimeline.create({
        data: {
          candidateId: candidate.id,
          tenantId: candidate.tenantId,
          type: 'profile_updated',
          title: 'Đã lưu CV vào hồ sơ',
          description: `Cập nhật từ wizard tạo CV (${draft.experience.length} công ty, ${allSkillNames.length} kỹ năng).`,
        },
      });
    });

    return {
      message: 'Đã lưu thông tin CV vào hồ sơ của bạn. Hãy bổ sung các trường còn thiếu.',
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

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanList(values: string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, 40);
}

function toIntOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Suy năm bắt đầu/kết thúc từ chuỗi period kiểu "2021–2024" hoặc "2021 - Present". */
function parsePeriodYears(period: string | null | undefined): {
  start: number | null;
  end: number | null;
  isCurrent: boolean;
} {
  if (!period?.trim()) return { start: null, end: null, isCurrent: false };
  const years = [...period.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  const isCurrent = /present|hiện|nay|now|current/i.test(period);
  return {
    start: years[0] ?? null,
    end: isCurrent ? null : (years[1] ?? years[0] ?? null),
    isCurrent,
  };
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
    productsSold?: string[];
    sellingStages?: string[];
    jobReadiness?: string | null;
    desiredPositions?: string[];
    currentCity?: string | null;
  } | null;
  skills: ReadonlyArray<unknown>;
  experiences?: ReadonlyArray<unknown>;
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
 * % hoàn thiện hồ sơ Sales B2B:
 * - Có AI Profile: 15%
 * - Field cơ bản: 20%
 * - Có ≥1 kinh nghiệm công ty: 25%; có sản phẩm+tệp KH+thị trường trên exp: +10%
 * - Có sellingStages (≥4 bước): 15%
 * - Mong muốn (desiredPositions + readiness + city): 15%
 */
export function computeProfileCompletion(candidate: ProfileCompletionInput): number {
  let score = 0;

  if (candidate.aiProfile?.summary) score += 15;

  if (candidate.profile) {
    const filled = PROFILE_FIELD_KEYS.filter((key) => {
      const value = candidate.profile![key];
      return value !== null && value !== undefined && value !== '';
    }).length;
    score += (filled / PROFILE_FIELD_KEYS.length) * 20;
  }

  const expCount = candidate.experiences?.length ?? 0;
  if (expCount >= 1) score += 25;
  if ((candidate.profile?.productsSold?.length ?? 0) >= 1) score += 5;
  if ((candidate.profile?.sellingStages?.length ?? 0) >= 4) score += 15;
  else if ((candidate.profile?.sellingStages?.length ?? 0) >= 1) score += 8;

  const desire =
    (candidate.profile?.desiredPositions?.length ?? 0) > 0 ||
    Boolean(candidate.profile?.jobReadiness) ||
    Boolean(candidate.profile?.currentCity);
  if (desire) score += 15;

  const skillCount = candidate.skills.length;
  if (skillCount >= 1) score += 5;

  return Math.round(Math.min(100, score));
}
