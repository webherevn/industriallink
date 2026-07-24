import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  CandidateMatchView,
  JobMatchView,
  MatchExplanation,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { buildJobText } from './job.service';
import {
  buildB2bExplanation,
  cosine,
  type B2bCandidateMatchInput,
} from './matching.util';

const MATCH_LIMIT = 20;

type CandidateWithSales = {
  displayName: string;
  profile: {
    currentPosition: string | null;
    industry: string | null;
    industriesExperienced?: string[];
    specialization: string | null;
    summary: string | null;
    productsSold?: string[];
    customerSegments?: string[];
    b2bExperienceBand?: string | null;
    totalExperienceYears?: number | null;
    marketsCovered?: string[];
    latestRevenue?: number | null;
    kpiAchievementPct?: number | null;
    salesHighlights?: string | null;
    customerDevStyle?: string | null;
    newCustomerRatioPct?: number | null;
    dealType?: string | null;
    typicalDealValue?: number | null;
    maxDealValue?: number | null;
    sellingStages?: string[];
    jobReadiness?: string | null;
    expectedSalaryMin?: number | null;
    expectedSalaryMax?: number | null;
    languages?: string[];
    hasB2License?: boolean | null;
    willingToTravel?: boolean | null;
  } | null;
  skills: { name: string }[];
};

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
  ) {}

  /** Văn bản đại diện hồ sơ ứng viên để so khớp ngữ nghĩa. */
  private buildCandidateText(candidate: CandidateWithSales): string {
    const p = candidate.profile;
    return [
      candidate.displayName,
      p?.currentPosition,
      p?.industry,
      ...(p?.industriesExperienced ?? []),
      p?.specialization,
      p?.summary,
      `Sản phẩm: ${(p?.productsSold ?? []).join(', ')}`,
      `Tệp KH: ${(p?.customerSegments ?? []).join(', ')}`,
      `Thị trường: ${(p?.marketsCovered ?? []).join(', ')}`,
      p?.salesHighlights,
      `Kỹ năng: ${candidate.skills.map((s) => s.name).join(', ')}`,
    ]
      .filter(Boolean)
      .join('. ');
  }

  private toB2bCandidate(candidate: CandidateWithSales): B2bCandidateMatchInput {
    const p = candidate.profile;
    return {
      industry: p?.industry,
      industriesExperienced: p?.industriesExperienced ?? [],
      productsSold: p?.productsSold ?? [],
      customerSegments: p?.customerSegments ?? [],
      b2bExperienceBand: p?.b2bExperienceBand,
      totalExperienceYears: p?.totalExperienceYears,
      marketsCovered: p?.marketsCovered ?? [],
      latestRevenue: p?.latestRevenue,
      kpiAchievementPct: p?.kpiAchievementPct,
      salesHighlights: p?.salesHighlights,
      customerDevStyle: p?.customerDevStyle,
      newCustomerRatioPct: p?.newCustomerRatioPct,
      dealType: p?.dealType,
      typicalDealValue: p?.typicalDealValue,
      maxDealValue: p?.maxDealValue,
      sellingStages: p?.sellingStages ?? [],
      jobReadiness: p?.jobReadiness,
      availabilityBand: (p as { availabilityBand?: string | null })?.availabilityBand,
      noticePeriodDays: (p as { noticePeriodDays?: number | null })?.noticePeriodDays,
      expectedSalaryMin: p?.expectedSalaryMin,
      expectedSalaryMax: p?.expectedSalaryMax,
      expectedOte: (p as { expectedOte?: number | null })?.expectedOte,
      languages: p?.languages ?? [],
      hasB2License: p?.hasB2License,
      driverLicenseType: (p as { driverLicenseType?: string | null })?.driverLicenseType,
      willingToTravel: p?.willingToTravel,
      travelAbility: (p as { travelAbility?: string | null })?.travelAbility,
      careerMotivations: (p as { careerMotivations?: string[] })?.careerMotivations ?? [],
      workStyles: (p as { workStyles?: string[] })?.workStyles ?? [],
      careerOrientation: (p as { careerOrientation?: string | null })?.careerOrientation,
      desiredPositions: (p as { desiredPositions?: string[] })?.desiredPositions ?? [],
      skills: candidate.skills.map((s) => s.name),
    };
  }

  private explainPair(
    semantic: number,
    job: {
      industry: string | null;
      location: string | null;
      experienceBand: string | null;
      title: string;
      description: string | null;
      salaryMin: number | null;
      salaryMax: number | null;
      skills: { name: string; required: boolean }[];
    },
    candidate: CandidateWithSales,
  ): MatchExplanation {
    const requiredSkills = job.skills.filter((s) => s.required).map((s) => s.name);
    return buildB2bExplanation({
      semantic,
      candidate: this.toB2bCandidate(candidate),
      job: {
        industry: job.industry,
        location: job.location,
        experienceBand: job.experienceBand,
        title: job.title,
        description: job.description,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        requiredSkills,
      },
    });
  }

  /** Tính điểm phù hợp giữa một ứng viên và một tin tuyển dụng (dùng khi ứng tuyển). */
  async computePairMatch(jobId: string, candidateId: string): Promise<MatchExplanation> {
    const [job, candidate] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId }, include: { skills: true } }),
      this.prisma.candidate.findUnique({
        where: { id: candidateId },
        include: { profile: true, skills: true },
      }),
    ]);
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    if (!candidate) throw new NotFoundException('Không tìm thấy ứng viên');

    let semantic = 0;
    try {
      const [jobVec, candVec] = await Promise.all([
        this.ai.embed(buildJobText(job, job.skills.map((s) => s.name))),
        this.ai.embed(this.buildCandidateText(candidate)),
      ]);
      semantic = cosine(jobVec, candVec);
    } catch (err) {
      this.logger.warn(`Không tính được embedding khi so khớp: ${String(err)}`);
    }

    return this.explainPair(semantic, job, candidate);
  }

  /** Gợi ý ứng viên phù hợp cho một tin tuyển dụng (phía nhà tuyển dụng). */
  async candidatesForJob(user: AuthenticatedUser, jobId: string): Promise<CandidateMatchView[]> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { skills: true } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');

    let rows: { candidate_id: string; score: number }[] = [];
    try {
      const vector = await this.ai.embed(buildJobText(job, job.skills.map((s) => s.name)));
      const literal = `[${vector.join(',')}]`;
      rows = await this.prisma.$queryRaw<{ candidate_id: string; score: number }[]>`
        SELECT candidate_id, (1 - (embedding <=> ${literal}::vector))::float AS score
        FROM candidate.candidate_search_index
        WHERE tenant_id = ${user.tenantId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${MATCH_LIMIT}`;
    } catch (err) {
      this.logger.warn(`Semantic matching lỗi: ${String(err)}`);
    }
    if (rows.length === 0) return [];

    const scoreMap = new Map(rows.map((r) => [r.candidate_id, r.score]));
    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: rows.map((r) => r.candidate_id) } },
      include: { profile: true, skills: true },
    });

    return candidates
      .map((c) => {
        const explanation = this.explainPair(scoreMap.get(c.id) ?? 0, job, c);
        return {
          candidateId: c.id,
          displayName: c.displayName,
          currentPosition: c.profile?.currentPosition ?? null,
          industry: c.profile?.industry ?? null,
          match: explanation,
        } satisfies CandidateMatchView;
      })
      .sort((a, b) => b.match.score - a.match.score);
  }

  /** Gợi ý tin tuyển dụng phù hợp cho ứng viên đang đăng nhập. */
  async jobsForCandidate(user: AuthenticatedUser): Promise<JobMatchView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: { profile: true, skills: true },
    });
    if (!candidate) throw new NotFoundException('Chưa có hồ sơ ứng viên');

    let rows: { id: string; score: number }[] = [];
    try {
      const vector = await this.ai.embed(this.buildCandidateText(candidate));
      const literal = `[${vector.join(',')}]`;
      rows = await this.prisma.$queryRaw<{ id: string; score: number }[]>`
        SELECT id, (1 - (embedding <=> ${literal}::vector))::float AS score
        FROM recruitment.job
        WHERE tenant_id = ${user.tenantId}
          AND status = 'published'
          AND is_deleted = false
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${MATCH_LIMIT}`;
    } catch (err) {
      this.logger.warn(`Semantic matching (job) lỗi: ${String(err)}`);
    }

    // Fallback: tin chưa có embedding (vd. seed demo) → xếp theo tiêu chí B2B + kỹ năng.
    if (rows.length === 0) {
      const published = await this.prisma.job.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'published',
          isDeleted: false,
        },
        include: { skills: true, company: { select: { id: true, name: true } } },
        orderBy: { publishedAt: 'desc' },
        take: MATCH_LIMIT,
      });
      return published
        .map((j) => {
          const explanation = this.explainPair(0, j, candidate);
          return this.toJobMatchView(j, explanation);
        })
        .filter((j) => j.match.score > 0 || candidate.skills.length === 0)
        .sort((a, b) => b.match.score - a.match.score);
    }

    const scoreMap = new Map(rows.map((r) => [r.id, r.score]));
    const jobs = await this.prisma.job.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { skills: true, company: { select: { id: true, name: true } } },
    });

    return jobs
      .map((j) => {
        const explanation = this.explainPair(scoreMap.get(j.id) ?? 0, j, candidate);
        return this.toJobMatchView(j, explanation);
      })
      .sort((a, b) => b.match.score - a.match.score);
  }

  private toJobMatchView(
    j: {
      id: string;
      code: string;
      title: string;
      location: string | null;
      industry: string | null;
      jobLevel: string | null;
      experienceBand: string | null;
      salaryMin: number | null;
      salaryMax: number | null;
      publishedAt: Date | null;
      skills: { name: string; required: boolean }[];
      company: { id: string; name: string };
    },
    explanation: MatchExplanation,
  ): JobMatchView {
    return {
      jobId: j.id,
      code: j.code,
      title: j.title,
      companyId: j.company.id,
      companyName: j.company.name,
      location: j.location,
      industry: j.industry,
      jobLevel: j.jobLevel,
      experienceBand: j.experienceBand,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      skills: j.skills.map((s) => s.name).slice(0, 6),
      publishedAt: j.publishedAt?.toISOString() ?? null,
      match: explanation,
    };
  }
}
