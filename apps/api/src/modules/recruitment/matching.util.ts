import type { MatchCriterionScore, MatchExplanation } from '@industriallink/contracts';
import {
  B2B_MATCH_CRITERION_LABEL,
  B2B_MATCH_WEIGHTS,
  CUSTOMER_SEGMENTS,
  JobReadiness,
  PRODUCTS_SOLD,
  SELLING_STAGES,
  b2bBandToYears,
  experienceBandToYears,
  getIndustryCatalog,
  yearsToB2bBand,
  type B2bMatchCriterionKey,
} from '@industriallink/contracts';

/** Độ tương đồng cosine giữa hai vector embedding. */
export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** So khớp kỹ năng yêu cầu với kỹ năng ứng viên (không phân biệt hoa/thường). */
export function skillOverlap(
  requiredSkills: string[],
  candidateSkills: string[],
): { matched: string[]; missing: string[] } {
  const required = (requiredSkills ?? []).filter((s) => s.trim().length > 0);
  const have = new Set((candidateSkills ?? []).map(norm).filter(Boolean));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of required) {
    if (have.has(norm(skill))) matched.push(skill);
    else missing.push(skill);
  }
  return { matched, missing };
}

/** Giao nhau tập hợp (fuzzy contains), trả 0–1 hoặc null nếu không có yêu cầu. */
export function setOverlapScore(
  required: string[] | null | undefined,
  have: string[] | null | undefined,
): { score: number | null; matched: string[] } {
  const req = (required ?? []).map((s) => s.trim()).filter(Boolean);
  if (req.length === 0) return { score: null, matched: [] };
  const pool = (have ?? []).map((s) => s.trim()).filter(Boolean);
  if (pool.length === 0) return { score: 0, matched: [] };

  const matched: string[] = [];
  for (const r of req) {
    const nr = norm(r);
    const hit = pool.some((h) => {
      const nh = norm(h);
      return nh === nr || nh.includes(nr) || nr.includes(nh);
    });
    if (hit) matched.push(r);
  }
  return { score: matched.length / req.length, matched };
}

function tokenHaystack(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/** Suy ra sản phẩm liên quan từ ngành / mô tả tin (khi NTD chưa gắn products). */
export function inferProductsFromJob(input: {
  industry?: string | null;
  title?: string | null;
  description?: string | null;
  skills?: string[];
}): string[] {
  const text = tokenHaystack([
    input.industry,
    input.title,
    input.description,
    ...(input.skills ?? []),
    getIndustryCatalog(input.industry ?? '')?.details,
  ]);
  return PRODUCTS_SOLD.filter((p) => {
    if (p === 'Khác') return false;
    const tokens = norm(p)
      .split(/[\s\/,&]+/)
      .filter((t) => t.length >= 3);
    return tokens.some((t) => text.includes(t));
  });
}

/** Suy ra tệp KH từ mô tả tin. */
export function inferCustomerSegmentsFromJob(input: {
  title?: string | null;
  description?: string | null;
}): string[] {
  const text = tokenHaystack([input.title, input.description]);
  const hits: string[] = [];
  for (const seg of CUSTOMER_SEGMENTS) {
    if (seg === 'Khác') continue;
    const key = norm(seg).split(/\s+/)[0] ?? '';
    if (key && text.includes(key)) hits.push(seg);
  }
  if (/fdi|nuoc ngoai|multinational/.test(norm(text))) hits.push('Nhà máy FDI');
  if (/nha thau|epc|m&e|mep/.test(norm(text))) hits.push('Nhà thầu M&E / EPC');
  if (/dai ly|npp|distributor/.test(norm(text))) hits.push('Đại lý / NPP');
  if (/oem/.test(norm(text))) hits.push('OEM');
  return [...new Set(hits)];
}

export interface B2bCandidateMatchInput {
  industry?: string | null;
  industriesExperienced?: string[];
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
  skills?: string[];
}

export interface B2bJobMatchInput {
  industry?: string | null;
  location?: string | null;
  experienceBand?: string | null;
  title?: string | null;
  description?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  requiredSkills?: string[];
  /** Bộ lọc tường minh từ NTD (search). */
  filterProducts?: string[];
  filterCustomerSegments?: string[];
  filterIndustries?: string[];
  filterB2bExperience?: string | null;
  filterRegions?: string[];
  filterCustomerDevStyle?: string | null;
  filterDealType?: string | null;
  filterJobReadiness?: string[];
  filterLanguages?: string[];
  requireB2License?: boolean;
  requireTravel?: boolean;
}

function criterion(
  key: B2bMatchCriterionKey,
  score: number | null,
  note?: string,
): MatchCriterionScore {
  return {
    key,
    label: B2B_MATCH_CRITERION_LABEL[key],
    score,
    weight: B2B_MATCH_WEIGHTS[key],
    note,
  };
}

function experienceScore(
  jobBand: string | null | undefined,
  candBand: string | null | undefined,
  candYears: number | null | undefined,
): { score: number | null; note?: string } {
  const required = experienceBandToYears(jobBand) ?? b2bBandToYears(jobBand);
  if (!required) return { score: null };

  const years =
    candYears ??
    (() => {
      const r = b2bBandToYears(candBand) ?? experienceBandToYears(candBand);
      if (!r) return null;
      return (r.min + Math.min(r.max, r.min + 2)) / 2;
    })();

  if (years == null) return { score: 0, note: 'Chưa có dữ liệu kinh nghiệm B2B' };

  if (years >= required.min && years <= required.max + 2) {
    return { score: 1, note: `${years} năm ≈ yêu cầu` };
  }
  if (years >= required.min) {
    return { score: 0.85, note: `${years} năm (vượt mức tối thiểu)` };
  }
  const gap = required.min - years;
  const score = Math.max(0, 1 - gap / Math.max(required.min, 1));
  return { score, note: `${years} năm vs yêu cầu ≥ ${required.min}` };
}

function regionScore(
  jobLocation: string | null | undefined,
  filterRegions: string[] | undefined,
  markets: string[] | undefined,
): { score: number | null; note?: string } {
  const required = [
    ...(filterRegions ?? []),
    ...(jobLocation?.trim() ? [jobLocation.trim()] : []),
  ];
  if (required.length === 0) return { score: null };
  const { score, matched } = setOverlapScore(required, markets ?? []);
  // Fallback: chuỗi location nằm trong markets hoặc ngược lại
  if ((score ?? 0) === 0 && jobLocation && (markets?.length ?? 0) > 0) {
    const jl = norm(jobLocation);
    const soft = (markets ?? []).some((m) => {
      const nm = norm(m);
      return jl.includes(nm) || nm.includes(jl) || jl.includes('kcn') && nm.includes('kcn');
    });
    if (soft) return { score: 0.7, note: `Gần khu vực ${jobLocation}` };
  }
  return {
    score,
    note: matched.length ? `Khớp: ${matched.join(', ')}` : 'Chưa khớp khu vực',
  };
}

function achievementsScore(c: B2bCandidateMatchInput): { score: number | null; note?: string } {
  const hasAny =
    c.latestRevenue != null ||
    c.kpiAchievementPct != null ||
    Boolean(c.salesHighlights?.trim());
  if (!hasAny) return { score: null };

  let score = 0.4;
  const notes: string[] = [];
  if (c.kpiAchievementPct != null) {
    const kpi = Math.max(0, Math.min(150, c.kpiAchievementPct)) / 100;
    score += 0.4 * Math.min(1, kpi);
    notes.push(`KPI ${Math.round(c.kpiAchievementPct)}%`);
  }
  if (c.latestRevenue != null && c.latestRevenue > 0) {
    score += 0.2;
    notes.push('Có doanh số');
  }
  if (c.salesHighlights?.trim()) score = Math.min(1, score + 0.1);
  return { score: Math.min(1, score), note: notes.join(' · ') || undefined };
}

function customerDevScore(
  style: string | null | undefined,
  ratio: number | null | undefined,
  filterStyle?: string | null,
): { score: number | null; note?: string } {
  if (!style && ratio == null) return { score: null };
  if (filterStyle && style && norm(style) !== norm(filterStyle)) {
    return { score: 0.35, note: `Phong cách ${style} ≠ ${filterStyle}` };
  }
  let score = style ? 0.7 : 0.4;
  if (ratio != null) {
    // Hunter/hybrid được thưởng khi tỷ lệ KH mới cao
    if (norm(style ?? '') === 'hunter') score = 0.6 + 0.4 * Math.min(1, ratio / 100);
    else if (norm(style ?? '') === 'hybrid') score = 0.65 + 0.3 * Math.min(1, ratio / 70);
    else score = 0.55 + 0.2 * Math.min(1, (100 - ratio) / 100);
  }
  return { score: Math.min(1, score), note: style ?? undefined };
}

function dealProfileScore(c: B2bCandidateMatchInput, filterDealType?: string | null): {
  score: number | null;
  note?: string;
} {
  if (!c.dealType && c.typicalDealValue == null && c.maxDealValue == null) {
    return { score: null };
  }
  if (filterDealType && c.dealType && norm(c.dealType) !== norm(filterDealType)) {
    return { score: 0.4, note: `Thương vụ ${c.dealType}` };
  }
  let score = c.dealType ? 0.7 : 0.5;
  if (c.maxDealValue != null && c.maxDealValue > 0) score = Math.min(1, score + 0.2);
  if (c.typicalDealValue != null && c.typicalDealValue > 0) score = Math.min(1, score + 0.1);
  return { score, note: c.dealType ?? undefined };
}

function sellingCapabilityScore(stages: string[] | undefined): {
  score: number | null;
  note?: string;
} {
  const have = (stages ?? []).filter(Boolean);
  if (have.length === 0) return { score: null };
  const { score, matched } = setOverlapScore([...SELLING_STAGES], have);
  return {
    score: score ?? 0,
    note: `Tham gia ${matched.length}/${SELLING_STAGES.length} bước bán giải pháp`,
  };
}

function readinessScore(
  readiness: string | null | undefined,
  filterReadiness?: string[],
  expectedMin?: number | null,
  expectedMax?: number | null,
  jobSalaryMin?: number | null,
  jobSalaryMax?: number | null,
): { score: number | null; note?: string } {
  if (!readiness && expectedMin == null && expectedMax == null) {
    if (!filterReadiness?.length) return { score: null };
    return { score: 0, note: 'Chưa cập nhật mức sẵn sàng' };
  }

  let score = 0.6;
  const r = norm(readiness ?? '');
  if (r === JobReadiness.Active || r === 'active') score = 1;
  else if (r === JobReadiness.Open || r === 'open') score = 0.8;
  else if (r === JobReadiness.Passive || r === 'passive') score = 0.35;

  if (filterReadiness?.length && readiness) {
    const ok = filterReadiness.some((f) => norm(f) === r);
    if (!ok) score *= 0.4;
  }

  // Thu nhập kỳ vọng vs khung tin
  if (
    (expectedMin != null || expectedMax != null) &&
    (jobSalaryMin != null || jobSalaryMax != null)
  ) {
    const eMin = expectedMin ?? 0;
    const eMax = expectedMax ?? expectedMin ?? 0;
    const jMin = jobSalaryMin ?? 0;
    const jMax = jobSalaryMax ?? jobSalaryMin ?? 0;
    const overlap = Math.min(eMax, jMax) >= Math.max(eMin, jMin);
    if (overlap) score = Math.min(1, score + 0.15);
    else score *= 0.7;
  }

  return { score: Math.min(1, score), note: readiness ?? undefined };
}

/**
 * Tổng hợp điểm phù hợp có giải thích (explainable AI).
 * Kết hợp độ tương đồng ngữ nghĩa (embedding) và tỷ lệ kỹ năng trùng khớp.
 * (Giữ API cũ — dùng khi chưa có hồ sơ B2B.)
 */
export function buildExplanation(
  semantic: number,
  requiredSkills: string[],
  candidateSkills: string[],
): MatchExplanation {
  return buildB2bExplanation({
    semantic,
    candidate: { skills: candidateSkills },
    job: { requiredSkills },
  });
}

/**
 * Chấm điểm AI ứng viên theo tiêu chí Sales B2B VN + semantic/skills.
 * Tiêu chí thiếu dữ liệu được bỏ qua (redistribute weight), không phạt oan.
 */
export function buildB2bExplanation(input: {
  semantic: number;
  candidate: B2bCandidateMatchInput;
  job: B2bJobMatchInput;
}): MatchExplanation {
  const safeSemantic = Number.isFinite(input.semantic) ? input.semantic : 0;
  const clampedSemantic = Math.max(0, Math.min(1, safeSemantic));
  const requiredSkills = input.job.requiredSkills ?? [];
  const candidateSkills = input.candidate.skills ?? [];
  const { matched, missing } = skillOverlap(requiredSkills, candidateSkills);
  const requiredCount = requiredSkills.filter((s) => s.trim().length > 0).length;
  const skillRatio = requiredCount > 0 ? matched.length / requiredCount : clampedSemantic;
  const semanticSkillsScore = 0.6 * clampedSemantic + 0.4 * skillRatio;

  const industriesHave = [
    ...(input.candidate.industriesExperienced ?? []),
    ...(input.candidate.industry ? [input.candidate.industry] : []),
  ];
  const industriesNeed = [
    ...(input.job.filterIndustries ?? []),
    ...(input.job.industry ? [input.job.industry] : []),
  ];
  const industryOv = setOverlapScore(industriesNeed, industriesHave);

  const productsNeed =
    input.job.filterProducts?.length
      ? input.job.filterProducts
      : inferProductsFromJob({
          industry: input.job.industry,
          title: input.job.title,
          description: input.job.description,
          skills: requiredSkills,
        });
  const productsOv =
    (input.candidate.productsSold?.length ?? 0) === 0 && !input.job.filterProducts?.length
      ? { score: null as number | null, matched: [] as string[] }
      : setOverlapScore(productsNeed, input.candidate.productsSold);

  const segmentsNeed =
    input.job.filterCustomerSegments?.length
      ? input.job.filterCustomerSegments
      : inferCustomerSegmentsFromJob({
          title: input.job.title,
          description: input.job.description,
        });
  const segmentsOv =
    (input.candidate.customerSegments?.length ?? 0) === 0 &&
    !input.job.filterCustomerSegments?.length
      ? { score: null as number | null, matched: [] as string[] }
      : setOverlapScore(segmentsNeed, input.candidate.customerSegments);

  const exp = experienceScore(
    input.job.filterB2bExperience ?? input.job.experienceBand,
    input.candidate.b2bExperienceBand ??
      yearsToB2bBand(input.candidate.totalExperienceYears) ??
      null,
    input.candidate.totalExperienceYears,
  );
  const region = regionScore(
    input.job.location,
    input.job.filterRegions,
    input.candidate.marketsCovered,
  );
  const ach = achievementsScore(input.candidate);
  const custDev = customerDevScore(
    input.candidate.customerDevStyle,
    input.candidate.newCustomerRatioPct,
    input.job.filterCustomerDevStyle,
  );
  const deal = dealProfileScore(input.candidate, input.job.filterDealType);
  const selling = sellingCapabilityScore(input.candidate.sellingStages);
  const ready = readinessScore(
    input.candidate.jobReadiness,
    input.job.filterJobReadiness,
    input.candidate.expectedSalaryMin,
    input.candidate.expectedSalaryMax,
    input.job.salaryMin,
    input.job.salaryMax,
  );

  // Điều kiện bổ sung (soft boost / penalty trong readiness note)
  const extras: string[] = [];
  if (input.job.filterLanguages?.length) {
    const lang = setOverlapScore(input.job.filterLanguages, input.candidate.languages);
    if (lang.score != null) {
      extras.push(
        lang.score > 0
          ? `Ngoại ngữ: ${lang.matched.join(', ')}`
          : 'Thiếu ngoại ngữ yêu cầu',
      );
      if (ready.score != null) {
        ready.score = Math.max(0, Math.min(1, ready.score * (0.7 + 0.3 * lang.score)));
      }
    }
  }
  if (input.job.requireB2License) {
    if (input.candidate.hasB2License === true) extras.push('Có bằng B2');
    else if (input.candidate.hasB2License === false) {
      extras.push('Chưa có bằng B2');
      if (ready.score != null) ready.score *= 0.75;
    }
  }
  if (input.job.requireTravel) {
    if (input.candidate.willingToTravel === true) extras.push('Sẵn sàng đi công tác');
    else if (input.candidate.willingToTravel === false) {
      extras.push('Không đi công tác');
      if (ready.score != null) ready.score *= 0.7;
    }
  }

  const criteria: MatchCriterionScore[] = [
    criterion(
      'industry',
      industryOv.score,
      industryOv.matched.length
        ? `Khớp ngành: ${industryOv.matched.join(', ')}`
        : industriesNeed.length
          ? 'Chưa khớp ngành'
          : undefined,
    ),
    criterion(
      'products',
      productsOv.score,
      productsOv.matched.length
        ? `Sản phẩm: ${productsOv.matched.join(', ')}`
        : productsNeed.length
          ? 'Chưa khớp sản phẩm đã bán'
          : undefined,
    ),
    criterion(
      'customerSegments',
      segmentsOv.score,
      segmentsOv.matched.length
        ? `Tệp KH: ${segmentsOv.matched.join(', ')}`
        : segmentsNeed.length
          ? 'Chưa khớp tệp khách hàng'
          : undefined,
    ),
    criterion('b2bExperience', exp.score, exp.note),
    criterion('region', region.score, region.note),
    criterion('achievements', ach.score, ach.note),
    criterion('customerDev', custDev.score, custDev.note),
    criterion('dealProfile', deal.score, deal.note),
    criterion('sellingCapability', selling.score, selling.note),
    criterion(
      'readiness',
      ready.score,
      [ready.note, ...extras].filter(Boolean).join(' · ') || undefined,
    ),
    criterion(
      'semanticSkills',
      semanticSkillsScore,
      requiredCount > 0
        ? `Kỹ năng ${matched.length}/${requiredCount}`
        : `Ngữ nghĩa ${Math.round(clampedSemantic * 100)}%`,
    ),
  ];

  const applicable = criteria.filter((c) => c.score != null);
  const weightSum = applicable.reduce((s, c) => s + c.weight, 0) || 1;
  const ratio = applicable.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0) / weightSum;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 100)));

  const parts: string[] = [`Độ phù hợp tổng ${score}%.`];
  parts.push(`Hồ sơ ngữ nghĩa ${Math.round(clampedSemantic * 100)}%.`);
  if (requiredCount > 0) {
    parts.push(
      `Đáp ứng ${matched.length}/${requiredCount} kỹ năng yêu cầu` +
        (matched.length > 0 ? ` (${matched.join(', ')}).` : '.'),
    );
    if (missing.length > 0) parts.push(`Còn thiếu: ${missing.join(', ')}.`);
  }

  const highlights = applicable
    .filter((c) => c.key !== 'semanticSkills' && (c.score ?? 0) >= 0.6 && c.note)
    .slice(0, 4)
    .map((c) => c.note!);
  if (highlights.length) parts.push(`B2B: ${highlights.join(' · ')}.`);

  const gaps = applicable
    .filter((c) => c.key !== 'semanticSkills' && (c.score ?? 1) < 0.4 && c.note)
    .slice(0, 2)
    .map((c) => c.note!);
  if (gaps.length) parts.push(`Cần xem thêm: ${gaps.join(' · ')}.`);

  return {
    score,
    matchedSkills: matched,
    missingSkills: missing,
    reason: parts.join(' '),
    criteria,
  };
}
