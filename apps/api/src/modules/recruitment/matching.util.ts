import type { MatchCriterionScore, MatchExplanation } from '@industriallink/contracts';
import {
  AvailabilityBand,
  B2B_MATCH_CRITERION_LABEL,
  B2B_MATCH_WEIGHTS,
  CUSTOMER_SEGMENTS,
  JobReadiness,
  PRODUCTS_SOLD,
  SELLING_STAGES,
  TravelAbility,
  availabilityToNoticeDays,
  b2bBandToYears,
  experienceBandToYears,
  getIndustryCatalog,
  normalizeSellingStage,
  noticeDaysToAvailability,
  salesBehaviorToDevStyle,
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
  if (/tong thau|nha thau|epc|m&e|mep/.test(norm(text))) hits.push('Tổng thầu');
  if (/thau phu|subcontractor/.test(norm(text))) hits.push('Thầu phụ');
  if (/dai ly|npp|distributor|kenh phan phoi/.test(norm(text))) {
    hits.push('Đại lý & Kênh phân phối');
  }
  if (/quoc te|xuat khau|export|international/.test(norm(text))) hits.push('Quốc tế');
  if (/nha may viet|noi dia|domestic/.test(norm(text))) hits.push('Nhà máy Việt Nam');
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
  availabilityBand?: string | null;
  noticePeriodDays?: number | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  /** Tổng thu nhập kỳ vọng / tháng (OTE) nếu có. */
  expectedOte?: number | null;
  languages?: string[];
  hasB2License?: boolean | null;
  driverLicenseType?: string | null;
  willingToTravel?: boolean | null;
  travelAbility?: string | null;
  careerMotivations?: string[];
  workStyles?: string[];
  careerOrientation?: string | null;
  desiredPositions?: string[];
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
  /** Giai đoạn bán JD yêu cầu (nếu NTD chọn); trống → so với full cycle. */
  requiredSellingStages?: string[];
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
  /** Mức đi công tác tối thiểu theo TravelAbility. */
  minTravelAbility?: string | null;
  maxNoticeDays?: number | null;
  cultureTags?: string[];
  careerPathTags?: string[];
  motivationTags?: string[];
  salesPersona?: string | null;
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
  if ((score ?? 0) === 0 && jobLocation && (markets?.length ?? 0) > 0) {
    const jl = norm(jobLocation);
    const soft = (markets ?? []).some((m) => {
      const nm = norm(m);
      return jl.includes(nm) || nm.includes(jl) || (jl.includes('kcn') && nm.includes('kcn'));
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

  let score = 0.35;
  const notes: string[] = [];
  if (c.kpiAchievementPct != null) {
    const kpi = Math.max(0, Math.min(150, c.kpiAchievementPct)) / 100;
    score += 0.45 * Math.min(1, kpi);
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
    if (norm(style ?? '') === 'hunter') score = 0.6 + 0.4 * Math.min(1, ratio / 100);
    else if (norm(style ?? '') === 'hybrid') score = 0.65 + 0.3 * Math.min(1, ratio / 70);
    else score = 0.55 + 0.2 * Math.min(1, (100 - ratio) / 100);
  }
  return { score: Math.min(1, score), note: style ?? undefined };
}

function dealProfileScore(
  c: B2bCandidateMatchInput,
  filterDealType?: string | null,
): { score: number | null; note?: string } {
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

/**
 * Năng lực bán hàng toàn chu trình — suy từ checklist giai đoạn.
 * Nếu JD có requiredSellingStages: % giai đoạn JD mà UV đã làm độc lập.
 * Nếu không: độ phủ so với full cycle 13 bước.
 */
function sellingCapabilityScore(
  stages: string[] | undefined,
  requiredStages?: string[],
): { score: number | null; note?: string } {
  const haveRaw = (stages ?? []).map((s) => normalizeSellingStage(s) ?? s.trim()).filter(Boolean);
  const have = [...new Set(haveRaw)];
  if (have.length === 0) return { score: null };

  const need =
    requiredStages && requiredStages.length > 0
      ? requiredStages.map((s) => normalizeSellingStage(s) ?? s.trim()).filter(Boolean)
      : [...SELLING_STAGES];

  const { score, matched } = setOverlapScore(need, have);
  return {
    score: score ?? 0,
    note: `Đã làm ${matched.length}/${need.length} giai đoạn chu trình bán`,
  };
}

function readinessScore(
  readiness: string | null | undefined,
  availabilityBand: string | null | undefined,
  noticeDays: number | null | undefined,
  filterReadiness?: string[],
  maxNoticeDays?: number | null,
): { score: number | null; note?: string } {
  const avail =
    availabilityBand ??
    (noticeDays != null ? noticeDaysToAvailability(noticeDays) : null);
  const days =
    noticeDays ??
    (avail ? availabilityToNoticeDays(avail as AvailabilityBand) : null);

  if (!readiness && avail == null && days == null) {
    if (!filterReadiness?.length && maxNoticeDays == null) return { score: null };
    return { score: 0, note: 'Chưa cập nhật mức sẵn sàng' };
  }

  let score = 0.55;
  const r = norm(readiness ?? '');
  if (r === JobReadiness.Active || r === 'active') score = 1;
  else if (r === JobReadiness.Open || r === 'open') score = 0.85;
  else if (r === JobReadiness.SoftOpen || r === 'soft_open') score = 0.65;
  else if (r === JobReadiness.Passive || r === 'passive') score = 0.3;

  if (filterReadiness?.length && readiness) {
    const ok = filterReadiness.some((f) => norm(f) === r);
    if (!ok) score *= 0.4;
  }

  if (maxNoticeDays != null && days != null) {
    if (days <= maxNoticeDays) score = Math.min(1, score + 0.1);
    else {
      const gap = days - maxNoticeDays;
      score *= Math.max(0.35, 1 - gap / Math.max(maxNoticeDays, 30));
    }
  } else if (avail === AvailabilityBand.Immediate || days === 0) {
    score = Math.min(1, score + 0.05);
  }

  const notes = [readiness, avail].filter(Boolean);
  return { score: Math.min(1, score), note: notes.join(' · ') || undefined };
}

function languagesScore(
  have: string[] | undefined,
  required?: string[],
): { score: number | null; note?: string } {
  if (!required?.length) {
    if (!have?.length) return { score: null };
    // Có ngoại ngữ nhưng JD không yêu cầu → điểm trung tính, không ép
    return { score: 0.75, note: have.join(', ') };
  }
  const { score, matched } = setOverlapScore(required, have ?? []);
  return {
    score: score ?? 0,
    note: matched.length ? matched.join(', ') : 'Thiếu ngoại ngữ yêu cầu',
  };
}

function travelScore(
  travelAbility: string | null | undefined,
  willingToTravel: boolean | null | undefined,
  requireTravel?: boolean,
  minTravel?: string | null,
): { score: number | null; note?: string } {
  const ability =
    travelAbility ??
    (willingToTravel === true
      ? TravelAbility.From25To50
      : willingToTravel === false
        ? TravelAbility.None
        : null);

  if (!requireTravel && !minTravel) {
    if (ability == null) return { score: null };
    if (ability === TravelAbility.None) return { score: 0.5, note: 'Không đi công tác' };
    return { score: 0.85, note: ability };
  }

  if (ability == null) return { score: 0, note: 'Chưa cập nhật đi công tác' };

  const rank: Record<string, number> = {
    [TravelAbility.None]: 0,
    [TravelAbility.UpTo25]: 1,
    [TravelAbility.From25To50]: 2,
    [TravelAbility.Over50]: 3,
  };
  const needRank = minTravel ? (rank[minTravel] ?? (requireTravel ? 1 : 0)) : requireTravel ? 1 : 0;
  const haveRank = rank[ability] ?? 0;
  if (haveRank >= needRank) return { score: 1, note: ability };
  if (haveRank === 0) return { score: 0, note: 'Không đáp ứng đi công tác' };
  return { score: 0.4 + 0.2 * haveRank, note: ability };
}

function driversLicenseScore(
  hasLicense: boolean | null | undefined,
  licenseType: string | null | undefined,
  require?: boolean,
): { score: number | null; note?: string } {
  if (!require) {
    if (hasLicense == null && !licenseType) return { score: null };
    return {
      score: hasLicense === true || Boolean(licenseType) ? 1 : 0.5,
      note: licenseType ?? (hasLicense ? 'Có bằng' : 'Không có bằng'),
    };
  }
  if (hasLicense === true || Boolean(licenseType)) {
    return { score: 1, note: licenseType ?? 'Có bằng lái' };
  }
  if (hasLicense === false) return { score: 0, note: 'Không có bằng lái' };
  return { score: 0, note: 'Chưa cập nhật bằng lái' };
}

function expectedIncomeScore(
  expectedMin?: number | null,
  expectedMax?: number | null,
  expectedOte?: number | null,
  jobMin?: number | null,
  jobMax?: number | null,
): { score: number | null; note?: string } {
  const eMin = expectedMin ?? null;
  const eMax = expectedMax ?? expectedOte ?? expectedMin ?? null;
  if (eMin == null && eMax == null) return { score: null };
  if (jobMin == null && jobMax == null) {
    return { score: 0.7, note: 'Có thu nhập kỳ vọng' };
  }
  const jMin = jobMin ?? 0;
  const jMax = jobMax ?? jobMin ?? 0;
  const candLow = eMin ?? eMax ?? 0;
  const candHigh = eMax ?? eMin ?? 0;
  const overlap = Math.min(candHigh, jMax) >= Math.max(candLow, jMin);
  if (overlap) return { score: 1, note: 'Trong ngân sách' };
  if (candLow > jMax && jMax > 0) {
    const over = (candLow - jMax) / jMax;
    return { score: Math.max(0, 1 - over), note: 'Vượt ngân sách' };
  }
  return { score: 0.75, note: 'Gần khung lương' };
}

function salesStyleScore(
  style: string | null | undefined,
  persona?: string | null,
): { score: number | null; note?: string } {
  if (!style && !persona) return { score: null };
  const mapped =
    salesBehaviorToDevStyle(style) ??
    (['hunter', 'hybrid', 'farmer'].includes(norm(style ?? ''))
      ? (norm(style!) as string)
      : null);
  const styleKey = mapped ?? style;
  if (!persona) return { score: styleKey ? 0.7 : null, note: style ?? undefined };
  if (!styleKey) return { score: 0, note: 'Chưa có phong cách Sales' };
  if (norm(String(styleKey)) === norm(persona)) {
    return { score: 1, note: style ?? persona };
  }
  const close =
    (norm(String(styleKey)) === 'hybrid' || norm(persona) === 'hybrid') &&
    norm(String(styleKey)) !== norm(persona);
  return { score: close ? 0.55 : 0.25, note: `${style} vs ${persona}` };
}

function tagOverlapScore(
  have: string[] | undefined,
  need: string[] | undefined,
  emptyHaveNote: string,
): { score: number | null; note?: string } {
  if (!need?.length) {
    if (!have?.length) return { score: null };
    return { score: 0.65, note: have.slice(0, 3).join(', ') };
  }
  if (!have?.length) return { score: 0, note: emptyHaveNote };
  const { score, matched } = setOverlapScore(need, have);
  return {
    score: score ?? 0,
    note: matched.length ? matched.join(', ') : 'Chưa khớp',
  };
}

function careerOrientationScore(
  orientation: string | string[] | null | undefined,
  desired: string[] | undefined,
  pathTags?: string[],
): { score: number | null; note?: string } {
  const orientationList = Array.isArray(orientation)
    ? orientation
    : orientation
      ? orientation
          .split(/\s*\|\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const have = [...orientationList, ...(desired ?? [])];
  if (!pathTags?.length) {
    if (!have.length) return { score: null };
    return { score: 0.7, note: have.slice(0, 2).join(', ') };
  }
  if (!have.length) return { score: 0, note: 'Chưa có định hướng nghề' };
  const { score, matched } = setOverlapScore(pathTags, have);
  return {
    score: score ?? 0,
    note: matched.length ? matched.join(', ') : 'Định hướng lệch JD',
  };
}

/**
 * Legacy: chỉ semantic + skills (khi chưa có hồ sơ B2B).
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
 * Chấm điểm AI theo ma trận 18 tiêu chí (100%).
 * Tiêu chí thiếu dữ liệu / JD không yêu cầu → bỏ qua, chuẩn hoá lại trọng số.
 * Embedding chỉ dùng retrieval; nếu không có tiêu chí B2B nào → fallback semantic+skills.
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

  const industriesHave = [
    ...(input.candidate.industriesExperienced ?? []),
    ...(input.candidate.industry ? [input.candidate.industry] : []),
  ];
  const industriesNeed = [
    ...(input.job.filterIndustries ?? []),
    ...(input.job.industry ? [input.job.industry] : []),
  ];
  const industryOv = setOverlapScore(industriesNeed, industriesHave);

  const productsNeed = input.job.filterProducts?.length
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

  const segmentsNeed = input.job.filterCustomerSegments?.length
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
    input.job.filterCustomerDevStyle ?? input.job.salesPersona,
  );
  const deal = dealProfileScore(input.candidate, input.job.filterDealType);
  const selling = sellingCapabilityScore(
    input.candidate.sellingStages,
    input.job.requiredSellingStages,
  );
  const ready = readinessScore(
    input.candidate.jobReadiness,
    input.candidate.availabilityBand,
    input.candidate.noticePeriodDays,
    input.job.filterJobReadiness,
    input.job.maxNoticeDays,
  );
  const langs = languagesScore(input.candidate.languages, input.job.filterLanguages);
  const travel = travelScore(
    input.candidate.travelAbility,
    input.candidate.willingToTravel,
    input.job.requireTravel,
    input.job.minTravelAbility,
  );
  const license = driversLicenseScore(
    input.candidate.hasB2License,
    input.candidate.driverLicenseType,
    input.job.requireB2License,
  );
  const income = expectedIncomeScore(
    input.candidate.expectedSalaryMin,
    input.candidate.expectedSalaryMax,
    input.candidate.expectedOte,
    input.job.salaryMin,
    input.job.salaryMax,
  );
  const style = salesStyleScore(
    input.candidate.customerDevStyle,
    input.job.salesPersona ?? input.job.filterCustomerDevStyle,
  );
  const motivation = tagOverlapScore(
    input.candidate.careerMotivations,
    input.job.motivationTags,
    'Chưa có động lực nghề',
  );
  const culture = tagOverlapScore(
    input.candidate.workStyles,
    input.job.cultureTags,
    'Chưa có phong cách làm việc',
  );
  const orientation = careerOrientationScore(
    input.candidate.careerOrientation,
    input.candidate.desiredPositions,
    input.job.careerPathTags,
  );

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
    criterion('achievements', ach.score, ach.note),
    criterion('customerDev', custDev.score, custDev.note),
    criterion('b2bExperience', exp.score, exp.note),
    criterion('sellingCapability', selling.score, selling.note),
    criterion('dealProfile', deal.score, deal.note),
    criterion('region', region.score, region.note),
    criterion('readiness', ready.score, ready.note),
    criterion('languages', langs.score, langs.note),
    criterion('travel', travel.score, travel.note),
    criterion('driversLicense', license.score, license.note),
    criterion('expectedIncome', income.score, income.note),
    criterion('salesStyle', style.score, style.note),
    criterion('careerMotivation', motivation.score, motivation.note),
    criterion('cultureFit', culture.score, culture.note),
    criterion('careerOrientation', orientation.score, orientation.note),
  ];

  const applicable = criteria.filter((c) => c.score != null);
  let score: number;
  if (applicable.length === 0) {
    // Fallback khi chưa có dữ liệu ma trận B2B: semantic + skills (giữ tương thích cũ)
    const fallback = 0.6 * clampedSemantic + 0.4 * skillRatio;
    score = Math.max(0, Math.min(100, Math.round(fallback * 100)));
  } else {
    const weightSum = applicable.reduce((s, c) => s + c.weight, 0) || 1;
    const ratio = applicable.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0) / weightSum;
    // Soft blend nhẹ semantic (tối đa 5%) khi đã có tiêu chí B2B — không phá ma trận 100%
    const blended = ratio * 0.95 + clampedSemantic * 0.05;
    score = Math.max(0, Math.min(100, Math.round(blended * 100)));
  }

  const parts: string[] = [`Độ phù hợp tổng ${score}%.`];
  if (applicable.length === 0) {
    parts.push(`Hồ sơ ngữ nghĩa ${Math.round(clampedSemantic * 100)}% (chưa đủ tiêu chí B2B).`);
  } else {
    const coreHit = applicable.filter(
      (c) =>
        ['industry', 'products', 'customerSegments', 'sellingCapability', 'b2bExperience'].includes(
          c.key,
        ) && (c.score ?? 0) >= 0.6,
    ).length;
    parts.push(`Khớp ${applicable.length}/18 tiêu chí (năng lực lõi nổi bật: ${coreHit}).`);
  }
  if (requiredCount > 0) {
    parts.push(
      `Đáp ứng ${matched.length}/${requiredCount} kỹ năng yêu cầu` +
        (matched.length > 0 ? ` (${matched.join(', ')}).` : '.'),
    );
    if (missing.length > 0) parts.push(`Còn thiếu: ${missing.join(', ')}.`);
  }

  const highlights = applicable
    .filter((c) => (c.score ?? 0) >= 0.6 && c.note)
    .slice(0, 4)
    .map((c) => c.note!);
  if (highlights.length) parts.push(`B2B: ${highlights.join(' · ')}.`);

  const gaps = applicable
    .filter((c) => (c.score ?? 1) < 0.4 && c.note)
    .slice(0, 3)
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
