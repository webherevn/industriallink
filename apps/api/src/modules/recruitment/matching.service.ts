import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  CandidateMatchView,
  JobMatchView,
  MatchExplanation,
} from '@industriallink/contracts';
import { shouldUseSalesMatchEngine, shouldUseTechnicalMatchEngine } from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import {
  backfillMissingCompanySlugs,
  backfillMissingJobSlugs,
} from '../../shared/seo/unique-slug';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { buildJobText } from './job.service';
import {
  buildB2bExplanation,
  cosine,
  jobToB2bMatchInput,
  toB2bCandidateFromRecords,
} from './matching.util';
import { explainSalesJobCandidate } from './sales-match-explain';
import { explainTechnicalJobCandidate } from './technical-match-explain';

const MATCH_LIMIT = 20;
/** Pool ứng viên đưa vào engine Sales/Kỹ thuật khi matching theo JD. */
const CANDIDATE_POOL = 80;
/** Điểm tối thiểu (0–100) để hiện trong kết quả mạng lưới. */
const MIN_ENGINE_SCORE = 1;

const CANDIDATE_MATCH_INCLUDE = {
  profile: true,
  skills: true,
  experiences: true,
} as const;

type CandidateWithSales = {
  displayName: string;
  profile: Parameters<typeof toB2bCandidateFromRecords>[0]['profile'];
  skills: { name: string }[];
  experiences?: Parameters<typeof toB2bCandidateFromRecords>[0]['experiences'];
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
    const b2b = toB2bCandidateFromRecords({
      profile: candidate.profile,
      experiences: candidate.experiences,
      skills: candidate.skills.map((s) => s.name),
    });
    return [
      candidate.displayName,
      ...(b2b.jobTitles ?? []),
      ...(b2b.industriesExperienced ?? []),
      `Sản phẩm: ${(b2b.productsSold ?? []).join(', ')}`,
      `Tệp KH: ${(b2b.customerSegments ?? []).join(', ')}`,
      `Thị trường: ${(b2b.marketsCovered ?? []).join(', ')}`,
      `Loại hình: ${(b2b.dealTypes ?? []).join(', ')}`,
      `Giai đoạn: ${(b2b.sellingStages ?? []).join(', ')}`,
      `Công việc KT: ${(b2b.technicalWorkTypes ?? []).join(', ')}`,
      b2b.technicalAutonomyLevel != null ? `Tự chủ mức ${b2b.technicalAutonomyLevel}` : '',
      b2b.salesHighlights,
      `Kỹ năng: ${(b2b.skills ?? []).join(', ')}`,
    ]
      .filter(Boolean)
      .join('. ');
  }

  private explainPair(
    semantic: number,
    job: Parameters<typeof jobToB2bMatchInput>[0],
    candidate: CandidateWithSales,
  ): MatchExplanation {
    if (shouldUseTechnicalMatchEngine(job)) {
      return explainTechnicalJobCandidate(job, candidate);
    }
    if (shouldUseSalesMatchEngine(job)) {
      return explainSalesJobCandidate(job, candidate);
    }
    return buildB2bExplanation({
      semantic,
      candidate: toB2bCandidateFromRecords({
        profile: candidate.profile,
        experiences: candidate.experiences,
        skills: candidate.skills.map((s) => s.name),
      }),
      job: jobToB2bMatchInput(job),
    });
  }

  /** Tính điểm phù hợp giữa một ứng viên và một tin tuyển dụng (dùng khi ứng tuyển). */
  async computePairMatch(jobId: string, candidateId: string): Promise<MatchExplanation> {
    const [job, candidate] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId }, include: { skills: true } }),
      this.prisma.candidate.findUnique({
        where: { id: candidateId },
        include: CANDIDATE_MATCH_INCLUDE,
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

  /**
   * Gợi ý ứng viên phù hợp cho một tin (NTD chọn JD → Tìm ngay).
   * Chấm bằng engine Sales B2B / Kỹ thuật đã code — không thay bằng full-text search.
   * Vector chỉ dùng để ưu tiên đưa vào pool khi có embedding.
   */
  async candidatesForJob(user: AuthenticatedUser, jobId: string): Promise<CandidateMatchView[]> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: true },
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');

    const poolIds = new Set<string>();
    const appliedIds = new Set<string>();

    // 1) Hồ sơ đã nộp vào đúng tin — luôn đưa vào pool để chấm lại bằng engine JD
    const applied = await this.prisma.application.findMany({
      where: { jobId, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      take: CANDIDATE_POOL,
      select: { candidateId: true },
    });
    for (const a of applied) {
      appliedIds.add(a.candidateId);
      poolIds.add(a.candidateId);
    }

    // 2) Semantic recall (tuỳ chọn) — chỉ để mở rộng pool, không phải điểm cuối
    try {
      const vector = await this.ai.embed(buildJobText(job, job.skills.map((s) => s.name)));
      const literal = `[${vector.join(',')}]`;
      const rows = await this.prisma.$queryRaw<{ candidate_id: string }[]>`
        SELECT candidate_id
        FROM candidate.candidate_search_index
        WHERE tenant_id = ${user.tenantId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${CANDIDATE_POOL}`;
      for (const r of rows) {
        poolIds.add(r.candidate_id);
        if (poolIds.size >= CANDIDATE_POOL) break;
      }
    } catch (err) {
      this.logger.warn(`Semantic recall (pool) lỗi: ${String(err)}`);
    }

    // 3) Bổ sung ứng viên có hồ sơ (cùng tenant) để engine Sales/KT có đủ dữ liệu chấm
    if (poolIds.size < CANDIDATE_POOL) {
      const recent = await this.prisma.candidate.findMany({
        where: {
          tenantId: user.tenantId,
          isDeleted: false,
          profile: { isNot: null },
          ...(poolIds.size > 0 ? { id: { notIn: [...poolIds] } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: CANDIDATE_POOL - poolIds.size,
        select: { id: true },
      });
      for (const c of recent) poolIds.add(c.id);
    }

    if (poolIds.size === 0) return [];

    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: [...poolIds] }, isDeleted: false },
      include: CANDIDATE_MATCH_INCLUDE,
    });

    // Điểm cuối = engine Sales / Kỹ thuật (explainPair), không dùng điểm embedding
    const scored = candidates.map((c) => {
      const explanation = this.explainPair(0, job, c);
      return {
        candidateId: c.id,
        displayName: c.displayName,
        currentPosition: c.profile?.currentPosition ?? null,
        industry: c.profile?.industry ?? null,
        match: explanation,
        applied: appliedIds.has(c.id),
      };
    });

    const appliedRows = scored
      .filter((r) => r.applied)
      .sort((a, b) => b.match.score - a.match.score);
    const networkRows = scored
      .filter((r) => !r.applied && r.match.score >= MIN_ENGINE_SCORE)
      .sort((a, b) => b.match.score - a.match.score);

    return [...appliedRows, ...networkRows]
      .slice(0, MATCH_LIMIT)
      .map(({ applied: _applied, ...row }): CandidateMatchView => row);
  }

  /** Gợi ý tin tuyển dụng phù hợp cho ứng viên đang đăng nhập. */
  async jobsForCandidate(user: AuthenticatedUser): Promise<JobMatchView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: CANDIDATE_MATCH_INCLUDE,
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
        include: { skills: true, company: { select: { id: true, name: true, slug: true } } },
        orderBy: { publishedAt: 'desc' },
        take: MATCH_LIMIT,
      });
      await backfillMissingJobSlugs(this.prisma, published);
      await backfillMissingCompanySlugs(
        this.prisma,
        published.map((j) => j.company),
      );
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
      include: { skills: true, company: { select: { id: true, name: true, slug: true } } },
    });

    await backfillMissingJobSlugs(this.prisma, jobs);
    await backfillMissingCompanySlugs(
      this.prisma,
      jobs.map((j) => j.company),
    );

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
      slug?: string | null;
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
      company: { id: string; name: string; slug?: string | null };
    },
    explanation: MatchExplanation,
  ): JobMatchView {
    return {
      jobId: j.id,
      slug: j.slug ?? j.id,
      code: j.code,
      title: j.title,
      companyId: j.company.id,
      companySlug: j.company.slug ?? null,
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
