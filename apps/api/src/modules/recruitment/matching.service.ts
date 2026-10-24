import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  CandidateMatchView,
  JobMatchView,
  MatchExplanation,
} from '@industriallink/contracts';
import { CreditService } from '../billing/credit.service';
import { SourcingService } from '../billing/sourcing.service';
import { CompanyService } from '../company/company.service';
import { shouldUseSalesMatchEngine, shouldUseTechnicalMatchEngine } from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import {
  backfillMissingCompanySlugs,
  backfillMissingJobSlugs,
} from '../../shared/seo/unique-slug';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { buildJobText } from './job.service';
import { candidateMatchTrack, jobMatchTrack, type MatchTrack } from './match-track.util';
import {
  buildB2bExplanation,
  cosine,
  jobToB2bMatchInput,
  toB2bCandidateFromRecords,
} from './matching.util';
import { explainSalesJobCandidate } from './sales-match-explain';
import { explainTechnicalJobCandidate } from './technical-match-explain';
import { plainLabel } from './html.util';

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

/** Chỉ chấm cùng nhóm (KD↔KD, KT↔KT). Thiếu nhóm → không đưa vào gợi ý mạng lưới. */
function sameMatchTrack(jobTrack: MatchTrack | null, candTrack: MatchTrack | null): boolean {
  return Boolean(jobTrack && candTrack && jobTrack === candTrack);
}

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
    private readonly credit: CreditService,
    private readonly sourcing: SourcingService,
    private readonly companies: CompanyService,
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
    const { companyId } = await this.companies.requireUserCompany(user.id);
    if (job.companyId !== companyId) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    try {
      await this.credit.consumeAction({
        tenantId: user.tenantId,
        companyId,
        action: 'view_match_summary',
        jobId: job.id,
        actorUserId: user.id,
        actorEmail: user.email ?? undefined,
        oncePerJob: true,
      });
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      if (
        err instanceof BadRequestException &&
        typeof err.getResponse() === 'object' &&
        (err.getResponse() as { code?: string }).code === 'INSUFFICIENT_CREDIT'
      ) {
        throw err;
      }
      this.logger.warn(`Failed to record credit ledger for view_match_summary: ${String(err)}`);
    }
    return this.rankJobCandidates(user, jobId);
  }

  /**
   * iLink săn ứng viên cho vị trí đã gắn trong gói Săn.
   * Không trừ Credit xem matching — phí nằm trong gói. Mở hồ sơ mới trừ lượt mở.
   */
  async candidatesForSourcing(user: AuthenticatedUser, jobId: string): Promise<CandidateMatchView[]> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const entitlements = await this.sourcing.getEntitlements(companyId);
    const endsAt = entitlements.assignment?.endsAt;
    const cycleOpen = !endsAt || new Date(endsAt).getTime() >= Date.now();
    if (!entitlements.assignment?.isActive || !cycleOpen) {
      throw new ForbiddenException({
        code: 'SOURCING_PLAN_REQUIRED',
        message: 'Bạn chưa có gói Săn nhân sự đang dùng.',
      });
    }
    const linked = await this.prisma.billingSourcingEngagement.findFirst({
      where: { companyId, jobId, assignmentId: entitlements.assignment.id },
      select: { id: true },
    });
    if (!linked) {
      throw new ForbiddenException({
        code: 'SOURCING_POSITION_REQUIRED',
        message: 'Hãy mở vị trí Săn gắn với tin này trước.',
      });
    }
    const ranked = await this.rankJobCandidates(user, jobId);
    if (ranked.length === 0) return ranked;
    const opened = await this.prisma.billingSourcingUsage.findMany({
      where: {
        companyId,
        assignmentId: entitlements.assignment.id,
        kind: 'profile_open',
        note: { in: ranked.map((row) => `open:${row.candidateId}`) },
      },
      select: { note: true },
    });
    const openedIds = new Set(
      opened.flatMap((row) => (row.note?.startsWith('open:') ? [row.note.slice(5)] : [])),
    );
    return ranked.map((row) => ({
      ...row,
      viewed: row.viewed || openedIds.has(row.candidateId),
    }));
  }

  private async rankJobCandidates(user: AuthenticatedUser, jobId: string): Promise<CandidateMatchView[]> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: true },
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const { companyId } = await this.companies.requireUserCompany(user.id);
    if (job.companyId !== companyId) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    const jobTrack = jobMatchTrack(job);

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

    if (jobTrack) {
      const otherTrack = await this.prisma.candidate.findMany({
        where: {
          id: { in: [...poolIds].filter((id) => !appliedIds.has(id)) },
          profile: { is: { jobTrack: { not: jobTrack } } },
        },
        select: { id: true },
      });
      for (const c of otherTrack) poolIds.delete(c.id);
    }

    // 3) Bổ sung ứng viên có hồ sơ (cùng tenant) để engine Sales/KT có đủ dữ liệu chấm
    if (poolIds.size < CANDIDATE_POOL) {
      const recent = await this.prisma.candidate.findMany({
        where: {
          tenantId: user.tenantId,
          isDeleted: false,
          profile: jobTrack ? { is: { jobTrack } } : { isNot: null },
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

    // Điểm cuối = engine Sales / Kỹ thuật (explainPair), không dùng điểm embedding.
    // Ứng viên đã nộp vào tin luôn giữ lại để NTD thấy đủ hồ sơ ứng tuyển.
    const eligible = candidates.filter(
      (c) => appliedIds.has(c.id) || sameMatchTrack(jobTrack, candidateMatchTrack(c)),
    );
    const scored = eligible.map((c) => {
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
    const ranked = [...appliedRows, ...networkRows].slice(0, MATCH_LIMIT);
    const viewedIds = await this.viewedCandidateIds(
      companyId,
      ranked.map((row) => row.candidateId),
    );

    return ranked.map(
      (row): CandidateMatchView => ({
        candidateId: row.candidateId,
        displayName: row.displayName,
        currentPosition: row.currentPosition,
        industry: row.industry,
        match: row.match,
        applied: row.applied,
        viewed: viewedIds.has(row.candidateId),
      }),
    );
  }

  /** Công ty đã mở hồ sơ: lượt xem có phí, hoặc mốc xem miễn phí. */
  private async viewedCandidateIds(companyId: string, candidateIds: string[]): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const rows = await this.prisma.billingCreditTransaction.findMany({
      where: {
        companyId,
        candidateId: { in: candidateIds },
        action: { in: ['view_profile', 'view_applicant', 'reopen_profile'] },
      },
      select: { candidateId: true },
      distinct: ['candidateId'],
    });
    return new Set(rows.flatMap((row) => (row.candidateId ? [row.candidateId] : [])));
  }

  /** Gợi ý tin tuyển dụng phù hợp cho ứng viên đang đăng nhập. */
  async jobsForCandidate(user: AuthenticatedUser): Promise<JobMatchView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: CANDIDATE_MATCH_INCLUDE,
    });
    if (!candidate) throw new NotFoundException('Chưa có hồ sơ ứng viên');
    const candTrack = candidateMatchTrack(candidate);
    const fetchLimit = candTrack ? MATCH_LIMIT * 3 : MATCH_LIMIT;
    const fitsTrack = (j: Parameters<typeof jobMatchTrack>[0]) =>
      sameMatchTrack(jobMatchTrack(j), candTrack);

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
        LIMIT ${fetchLimit}`;
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
        take: fetchLimit,
      });
      const sameTrackJobs = published.filter(fitsTrack).slice(0, MATCH_LIMIT);
      await backfillMissingJobSlugs(this.prisma, sameTrackJobs);
      await backfillMissingCompanySlugs(
        this.prisma,
        sameTrackJobs.map((j) => j.company),
      );
      return sameTrackJobs
        .map((j) => {
          const explanation = this.explainPair(0, j, candidate);
          return this.toJobMatchView(j, explanation);
        })
        .filter((j) => j.match.score > 0 || candidate.skills.length === 0)
        .sort((a, b) => b.match.score - a.match.score);
    }

    const scoreMap = new Map(rows.map((r) => [r.id, r.score]));
    const fetched = await this.prisma.job.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { skills: true, company: { select: { id: true, name: true, slug: true } } },
    });
    const jobs = fetched
      .filter(fitsTrack)
      .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
      .slice(0, MATCH_LIMIT);

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
      skills: j.skills
        .map((s) => plainLabel(s.name))
        .filter(Boolean)
        .filter((name, index, all) => all.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === index)
        .slice(0, 6),
      publishedAt: j.publishedAt?.toISOString() ?? null,
      match: explanation,
    };
  }
}
