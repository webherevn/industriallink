import { Injectable, Logger } from '@nestjs/common';
import type { CandidateSearchFilters, CandidateSearchResult } from '@industriallink/contracts';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { inferSkillsFromText } from '../ai/providers/industrial-skills';
import { OpenSearchService } from '../../shared/infrastructure/opensearch/opensearch.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { buildB2bExplanation } from '../recruitment/matching.util';

function splitCsv(value?: string | string[]): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Search Domain. Nguyên tắc: Search KHÔNG query bảng giao dịch mà dùng chỉ mục.
 * Thứ tự: OpenSearch (full-text) → pgvector semantic → ILIKE Postgres → lọc B2B.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
    private readonly openSearch: OpenSearchService,
  ) {}

  /** Cập nhật chỉ mục cho một ứng viên (gọi khi nhận sự kiện CandidateUpdated). */
  async indexCandidate(candidateId: string): Promise<void> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { profile: true, skills: true },
    });
    if (!candidate) return;

    const p = candidate.profile;
    const searchText = [
      candidate.displayName,
      p?.currentPosition,
      p?.industry,
      ...(p?.industriesExperienced ?? []),
      p?.specialization,
      p?.summary,
      ...(p?.productsSold ?? []),
      ...(p?.customerSegments ?? []),
      ...(p?.marketsCovered ?? []),
      p?.salesHighlights,
      p?.customerDevStyle,
      p?.dealType,
      p?.jobReadiness,
      ...(p?.languages ?? []),
      candidate.skills.map((s) => s.name).join(', '),
    ]
      .filter(Boolean)
      .join('. ');

    await this.prisma.candidateSearchIndex.upsert({
      where: { candidateId },
      create: { candidateId, tenantId: candidate.tenantId, searchText },
      update: { searchText },
    });

    try {
      const vector = await this.ai.embed(searchText);
      const literal = `[${vector.join(',')}]`;
      await this.prisma.$executeRaw`
        UPDATE candidate.candidate_search_index
        SET embedding = ${literal}::vector
        WHERE candidate_id = ${candidateId}::uuid`;
    } catch (err) {
      this.logger.warn(`Bỏ qua index vector cho ${candidateId}: ${String(err)}`);
    }

    await this.openSearch.indexCandidate({
      candidateId,
      tenantId: candidate.tenantId,
      searchText,
      displayName: candidate.displayName,
    });

    this.logger.log(`Đã cập nhật chỉ mục tìm kiếm cho candidate ${candidateId}`);
  }

  /** Tìm ứng viên: semantic + tiêu chí Sales B2B (bộ lọc chính / nâng cao). */
  async searchCandidates(
    queryOrFilters: string | CandidateSearchFilters,
    tenantId: string,
  ): Promise<CandidateSearchResult[]> {
    const filters: CandidateSearchFilters =
      typeof queryOrFilters === 'string' ? { q: queryOrFilters } : queryOrFilters;

    const trimmed = (filters.q ?? '').trim();
    const querySkills = inferSkillsFromText(
      [
        trimmed,
        ...(filters.industries ?? []),
        ...(filters.products ?? []),
        ...(filters.customerSegments ?? []),
        ...(filters.regions ?? []),
      ].join(' '),
    );

    let ids: { candidate_id: string; score: number }[] = [];
    let source: 'opensearch' | 'pgvector' | 'ilike' | 'filter' = 'ilike';

    if (trimmed) {
      const osHits = await this.openSearch.searchCandidates(trimmed, tenantId, 40);
      if (osHits.length > 0) {
        ids = osHits.map((h) => ({ candidate_id: h.candidateId, score: h.score }));
        source = 'opensearch';
      }

      if (ids.length === 0) {
        try {
          const vector = await this.ai.embed(trimmed);
          const literal = `[${vector.join(',')}]`;
          ids = await this.prisma.$queryRaw<{ candidate_id: string; score: number }[]>`
            SELECT candidate_id, (1 - (embedding <=> ${literal}::vector))::float AS score
            FROM candidate.candidate_search_index
            WHERE tenant_id = ${tenantId} AND embedding IS NOT NULL
            ORDER BY embedding <=> ${literal}::vector
            LIMIT 40`;
          if (ids.length > 0) source = 'pgvector';
        } catch (err) {
          this.logger.warn(`Semantic search lỗi, dùng full-text: ${String(err)}`);
        }
      }

      if (ids.length === 0) {
        const rows = await this.prisma.candidateSearchIndex.findMany({
          where: {
            tenantId,
            searchText: { contains: trimmed, mode: 'insensitive' },
          },
          take: 40,
          select: { candidateId: true },
        });
        ids = rows.map((r) => ({ candidate_id: r.candidateId, score: 0.5 }));
        source = 'ilike';
      }
    }

    // Không có câu query → lấy theo bộ lọc B2B trên profile.
    if (ids.length === 0) {
      const whereProfile: Record<string, unknown> = {};
      if (filters.industries?.length) {
        whereProfile.OR = [
          { industry: { in: filters.industries } },
          { industriesExperienced: { hasSome: filters.industries } },
        ];
      }
      if (filters.products?.length) {
        whereProfile.productsSold = { hasSome: filters.products };
      }
      if (filters.customerSegments?.length) {
        whereProfile.customerSegments = { hasSome: filters.customerSegments };
      }
      if (filters.b2bExperience) {
        whereProfile.b2bExperienceBand = filters.b2bExperience;
      }
      if (filters.regions?.length) {
        whereProfile.marketsCovered = { hasSome: filters.regions };
      }
      if (filters.customerDevStyle) {
        whereProfile.customerDevStyle = filters.customerDevStyle;
      }
      if (filters.dealType) {
        whereProfile.dealType = filters.dealType;
      }
      if (filters.jobReadiness?.length) {
        whereProfile.jobReadiness = { in: filters.jobReadiness };
      }
      if (filters.requireB2License) {
        whereProfile.hasB2License = true;
      }
      if (filters.requireTravel) {
        whereProfile.willingToTravel = true;
      }
      if (filters.languages?.length) {
        whereProfile.languages = { hasSome: filters.languages };
      }

      const hasHardFilter = Object.keys(whereProfile).length > 0;
      const candidatesByFilter = await this.prisma.candidate.findMany({
        where: {
          tenantId,
          ...(hasHardFilter ? { profile: whereProfile } : {}),
        },
        take: 40,
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      ids = candidatesByFilter.map((c) => ({ candidate_id: c.id, score: 0.55 }));
      source = 'filter';
    }

    if (ids.length === 0) return [];

    this.logger.debug(`searchCandidates source=${source} hits=${ids.length}`);

    const scoreMap = new Map(ids.map((r) => [r.candidate_id, r.score]));
    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: ids.map((r) => r.candidate_id) } },
      include: { profile: true, skills: true },
    });

    return candidates
      .map((c) => {
        const semantic = Math.max(0, Math.min(1, scoreMap.get(c.id) ?? 0));
        const p = c.profile;
        const explanation = buildB2bExplanation({
          semantic,
          candidate: {
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
            expectedSalaryMin: p?.expectedSalaryMin,
            expectedSalaryMax: p?.expectedSalaryMax,
            languages: p?.languages ?? [],
            hasB2License: p?.hasB2License,
            willingToTravel: p?.willingToTravel,
            skills: c.skills.map((s) => s.name),
          },
          job: {
            requiredSkills: querySkills,
            filterIndustries: filters.industries,
            filterProducts: filters.products,
            filterCustomerSegments: filters.customerSegments,
            filterB2bExperience: filters.b2bExperience,
            filterRegions: filters.regions,
            filterCustomerDevStyle: filters.customerDevStyle,
            filterDealType: filters.dealType,
            filterJobReadiness: filters.jobReadiness,
            filterLanguages: filters.languages,
            requireB2License: filters.requireB2License,
            requireTravel: filters.requireTravel,
            salaryMin: filters.expectedSalaryMin ?? null,
            salaryMax: filters.expectedSalaryMax ?? null,
            title: trimmed || undefined,
            description: trimmed || undefined,
          },
        });

        return {
          candidateId: c.id,
          code: c.code,
          displayName: c.displayName,
          currentPosition: p?.currentPosition ?? null,
          industry: p?.industry ?? null,
          score: Number((explanation.score / 100).toFixed(4)),
          reason: explanation.reason,
          matchedSkills: explanation.matchedSkills,
          criteria: explanation.criteria,
        } satisfies CandidateSearchResult;
      })
      .sort((a, b) => b.score - a.score);
  }

  /** Parse query string từ controller thành filters. */
  static parseFilters(query: Record<string, string | string[] | undefined>): CandidateSearchFilters {
    const bool = (v?: string | string[]) => {
      const s = Array.isArray(v) ? v[0] : v;
      return s === '1' || s === 'true' || s === 'yes';
    };
    const num = (v?: string | string[]) => {
      const s = Array.isArray(v) ? v[0] : v;
      if (!s) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const one = (v?: string | string[]) => {
      const s = Array.isArray(v) ? v[0] : v;
      return s?.trim() || undefined;
    };

    return {
      q: one(query.q),
      industries: splitCsv(query.industries),
      products: splitCsv(query.products),
      customerSegments: splitCsv(query.customerSegments),
      b2bExperience: one(query.b2bExperience),
      regions: splitCsv(query.regions),
      customerDevStyle: one(query.customerDevStyle),
      dealType: one(query.dealType),
      jobReadiness: splitCsv(query.jobReadiness),
      languages: splitCsv(query.languages),
      requireB2License: bool(query.requireB2License) || undefined,
      requireTravel: bool(query.requireTravel) || undefined,
      expectedSalaryMin: num(query.expectedSalaryMin),
      expectedSalaryMax: num(query.expectedSalaryMax),
    };
  }
}
