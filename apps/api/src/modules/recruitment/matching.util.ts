import type { MatchCriterionScore, MatchExplanation } from '@industriallink/contracts';
import {
  AvailabilityBand,
  CUSTOMER_SEGMENTS,
  DEAL_TYPE_LABEL,
  DealType,
  EQUIPMENT_SYSTEM_OPTIONS,
  JobReadiness,
  JobTrack,
  PRODUCTS_SOLD,
  SELLING_STAGES,
  TECHNICAL_WORK_TYPES,
  TravelAbility,
  availabilityToNoticeDays,
  b2bBandToYears,
  b2bMatchCriterionLabel,
  b2bMatchWeightsForTrack,
  experienceBandToYears,
  getIndustryCatalog,
  normalizeDealTypeValue,
  normalizeIndustries,
  normalizeJobSalesCriteria,
  normalizeJobTechnicalCriteria,
  normalizeSellingStage,
  noticeDaysToAvailability,
  parseDriverLicenses,
  salesBehaviorToDevStyle,
  splitDealTypes,
  trackImpliedByDepartment,
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

/** Gộp giá trị CV (profile + mọi công ty) — giữ thứ tự, không trùng (không phân biệt hoa/dấu). */
export function unionUnique(
  ...lists: Array<readonly string[] | string | null | undefined>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    const items = Array.isArray(list) ? list : list ? [list] : [];
    for (const raw of items) {
      const s = String(raw ?? '').trim();
      if (!s) continue;
      const key = norm(s);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/** Tách địa điểm / chuỗi ghép "Hà Nội | Bắc Ninh". */
export function splitJoinedValues(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[|,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function maxNumeric(...vals: Array<number | null | undefined>): number | null {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? Math.max(...nums) : null;
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
    if (p === 'Thiết bị công nghiệp khác') return false;
    const tokens = norm(p)
      .split(/[\s\/,&]+/)
      .filter((t) => t.length >= 3);
    return tokens.some((t) => text.includes(t));
  });
}

/** Suy thiết bị / hệ thống kỹ thuật từ ngành / mô tả tin. */
export function inferEquipmentFromJob(input: {
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
  return EQUIPMENT_SYSTEM_OPTIONS.filter((p) => {
    const tokens = norm(p)
      .split(/[\s\/,&–-]+/)
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
  if (/tong thau|epc/.test(norm(text))) hits.push('Tổng thầu EPC');
  if (/nha thau|thau phu|thi cong|subcontractor|m&e|mep/.test(norm(text)))
    hits.push('Nhà thầu / đơn vị thi công');
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
  jobTrack?: string | null;
  currentCity?: string | null;
  desiredLocations?: string[];
  technicalAutonomyLevel?: number | null;
  technicalWorkTypes?: string[];
  certificates?: string[];
  technicalTools?: string[];
  documentLiteracy?: string[];
  shiftFlexibility?: string | null;
  /** Loại hình KD đã chuẩn hoá (mọi công ty). */
  dealTypes?: string[];
  /** Vị trí đã làm + hiện tại — so với title JD (STT 1). */
  jobTitles?: string[];
  driverLicenses?: string[];
  educationLevel?: string | null;
  educationMajor?: string | null;
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
  jobTrack?: string | null;
  jobLevel?: string | null;
  department?: string | null;
  /** Nhiều loại hình KD trên JD (STT 11). */
  filterDealTypes?: string[];
  filterDriverLicenses?: string[];
  educationLevel?: string | null;
  educationMajor?: string | null;
  /** Mức tự chủ kỹ thuật tối thiểu 1–5 (JD trường 11). */
  minTechnicalAutonomyLevel?: number | null;
  /**
   * Tin 22/23 trường: không suy diễn catalog, không chấm tiêu chí ngoài JD,
   * JD trống → bỏ qua (không phạt / không thưởng trung tính).
   */
  strictJdCriteria?: boolean;
}

export interface CandidateExperienceMatchSlice {
  companyName?: string | null;
  jobTitle?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  isCurrent?: boolean | null;
  industries?: string[] | null;
  productsSold?: string[] | null;
  customerSegments?: string[] | null;
  marketsCovered?: string[] | null;
  sellingStages?: string[] | null;
  dealType?: string | null;
  latestRevenue?: number | null;
  kpiAchievementPct?: number | null;
  typicalDealValue?: number | null;
  maxDealValue?: number | null;
  newCustomerRatioPct?: number | null;
  highlights?: string | null;
}

/** Hồ sơ + mọi dòng kinh nghiệm → input matching (không lấy công ty đầu tiên thôi). */
export function toB2bCandidateFromRecords(input: {
  profile?: (Partial<B2bCandidateMatchInput> & {
    currentPosition?: string | null;
  }) | null;
  experiences?: CandidateExperienceMatchSlice[] | null;
  skills?: string[];
}): B2bCandidateMatchInput {
  const p = input.profile ?? {};
  const exps = input.experiences ?? [];
  const dealTypes = unionUnique(
    splitDealTypes(p.dealType),
    ...exps.map((e) => splitDealTypes(e.dealType)),
  );
  const jobTitles = unionUnique(p.currentPosition, p.jobTitles, ...exps.map((e) => e.jobTitle));

  return {
    industry: p.industry,
    industriesExperienced: unionUnique(
      p.industriesExperienced,
      p.industry,
      ...exps.map((e) => e.industries),
    ),
    productsSold: unionUnique(p.productsSold, ...exps.map((e) => e.productsSold)),
    customerSegments: unionUnique(p.customerSegments, ...exps.map((e) => e.customerSegments)),
    b2bExperienceBand: p.b2bExperienceBand,
    totalExperienceYears: p.totalExperienceYears,
    marketsCovered: unionUnique(p.marketsCovered, ...exps.map((e) => e.marketsCovered)),
    latestRevenue: maxNumeric(p.latestRevenue, ...exps.map((e) => e.latestRevenue)),
    kpiAchievementPct: maxNumeric(p.kpiAchievementPct, ...exps.map((e) => e.kpiAchievementPct)),
    salesHighlights:
      p.salesHighlights?.trim() ||
      exps.find((e) => e.highlights?.trim())?.highlights ||
      null,
    customerDevStyle: p.customerDevStyle,
    newCustomerRatioPct: maxNumeric(
      p.newCustomerRatioPct,
      ...exps.map((e) => e.newCustomerRatioPct),
    ),
    dealType: p.dealType ?? exps.find((e) => e.dealType)?.dealType ?? null,
    dealTypes,
    typicalDealValue: maxNumeric(p.typicalDealValue, ...exps.map((e) => e.typicalDealValue)),
    maxDealValue: maxNumeric(p.maxDealValue, ...exps.map((e) => e.maxDealValue)),
    sellingStages: unionUnique(p.sellingStages, ...exps.map((e) => e.sellingStages)),
    jobReadiness: p.jobReadiness,
    availabilityBand: p.availabilityBand,
    noticePeriodDays: p.noticePeriodDays,
    expectedSalaryMin: p.expectedSalaryMin,
    expectedSalaryMax: p.expectedSalaryMax,
    expectedOte: p.expectedOte,
    languages: p.languages ?? [],
    hasB2License: p.hasB2License,
    driverLicenseType: p.driverLicenseType,
    driverLicenses: unionUnique(p.driverLicenses, parseDriverLicenses(p.driverLicenseType)),
    willingToTravel: p.willingToTravel,
    travelAbility: p.travelAbility,
    careerMotivations: p.careerMotivations ?? [],
    workStyles: p.workStyles ?? [],
    careerOrientation: p.careerOrientation,
    desiredPositions: unionUnique(p.desiredPositions, jobTitles),
    jobTitles,
    skills: input.skills ?? p.skills ?? [],
    jobTrack: p.jobTrack,
    currentCity: p.currentCity,
    desiredLocations: p.desiredLocations ?? [],
    technicalAutonomyLevel: p.technicalAutonomyLevel,
    technicalWorkTypes: p.technicalWorkTypes ?? [],
    certificates: p.certificates ?? [],
    technicalTools: p.technicalTools ?? [],
    documentLiteracy: p.documentLiteracy ?? [],
    shiftFlexibility: p.shiftFlexibility ?? null,
    educationLevel: p.educationLevel,
    educationMajor: p.educationMajor,
  };
}

/** Map tin tuyển dụng (+ salesCriteria 22 / technicalCriteria 23 trường) → input matching. */
export function jobToB2bMatchInput(job: {
  title?: string | null;
  industry?: string | null;
  location?: string | null;
  experienceBand?: string | null;
  description?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  jobLevel?: string | null;
  department?: string | null;
  jobTrack?: string | null;
  salesCriteria?: unknown;
  technicalCriteria?: unknown;
  skills?: Array<{ name: string; required?: boolean } | string>;
}): B2bJobMatchInput {
  const requiredSkills = (job.skills ?? []).flatMap((s) => {
    if (typeof s === 'string') return [];
    return s.required ? [s.name] : [];
  });
  const sales = job.salesCriteria == null ? null : normalizeJobSalesCriteria(job.salesCriteria);
  const tech =
    job.technicalCriteria == null ? null : normalizeJobTechnicalCriteria(job.technicalCriteria);
  const jobTrack = job.jobTrack?.trim() || null;
  const trackHint = resolveMatchTrack({
    job: { jobLevel: job.jobLevel, jobTrack, department: job.department },
  });
  const isTech =
    trackHint === 'technical' ||
    tech != null ||
    jobTrack === JobTrack.Technical ||
    jobTrack === 'technical' ||
    (job.jobLevel ?? '').startsWith('technical.');
  const strictJdCriteria = isTech
    ? tech != null ||
      jobTrack === JobTrack.Technical ||
      jobTrack === 'technical' ||
      (job.jobLevel ?? '').startsWith('technical.')
    : sales != null ||
      jobTrack === JobTrack.Sales ||
      jobTrack === 'sales' ||
      (job.jobLevel ?? '').startsWith('sales.');
  const title = job.title?.trim() || null;

  if (isTech) {
    const licenses = (tech?.driverLicenses ?? []).filter((l) => l !== 'Chưa có');
    return {
      industry: job.industry,
      location: job.location,
      experienceBand: job.experienceBand,
      title,
      description: job.description,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      requiredSkills,
      jobLevel: job.jobLevel,
      department: job.department,
      jobTrack: jobTrack ?? (strictJdCriteria ? JobTrack.Technical : jobTrack),
      strictJdCriteria,
      filterIndustries: tech?.industries?.length
        ? tech.industries
        : job.industry
          ? [job.industry]
          : [],
      filterProducts: tech?.equipmentSystems ?? (strictJdCriteria ? [] : undefined),
      filterCustomerSegments: tech?.workEnvironments ?? (strictJdCriteria ? [] : undefined),
      filterDealTypes: [],
      filterDealType: null,
      requiredSellingStages: tech?.technicalWorkTypes ?? [],
      filterRegions: [],
      filterLanguages: tech?.languages ?? [],
      filterDriverLicenses: licenses,
      requireB2License: licenses.length > 0,
      minTravelAbility: tech?.travelAbility ?? null,
      requireTravel: Boolean(tech?.travelAbility && tech.travelAbility !== TravelAbility.None),
      educationLevel: tech?.educationLevel ?? null,
      educationMajor: tech?.educationMajor ?? null,
      minTechnicalAutonomyLevel: tech?.autonomyLevel ?? null,
      careerPathTags: title ? [title] : [],
      filterB2bExperience: job.experienceBand ?? null,
    };
  }

  const licenses = (sales?.driverLicenses ?? []).filter((l) => l !== 'Chưa có');

  return {
    industry: job.industry,
    location: job.location,
    experienceBand: job.experienceBand,
    title,
    description: job.description,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    requiredSkills,
    jobLevel: job.jobLevel,
    department: job.department,
    jobTrack: jobTrack ?? (strictJdCriteria ? JobTrack.Sales : jobTrack),
    strictJdCriteria,
    filterIndustries: sales?.industries?.length
      ? sales.industries
      : job.industry
        ? [job.industry]
        : [],
    filterProducts: sales?.productsSold ?? (strictJdCriteria ? [] : undefined),
    filterCustomerSegments: sales?.customerSegments ?? (strictJdCriteria ? [] : undefined),
    filterDealTypes: sales?.dealTypes ?? [],
    filterDealType: sales?.dealTypes[0] ?? null,
    requiredSellingStages: sales?.sellingStages ?? [],
    filterRegions: sales?.marketsCovered ?? [],
    filterLanguages: sales?.languages ?? [],
    filterDriverLicenses: licenses,
    requireB2License: licenses.length > 0,
    minTravelAbility: sales?.travelAbility ?? null,
    requireTravel: Boolean(sales?.travelAbility && sales.travelAbility !== TravelAbility.None),
    educationLevel: sales?.educationLevel ?? null,
    educationMajor: sales?.educationMajor ?? null,
    careerPathTags: title ? [title] : [],
    filterB2bExperience: job.experienceBand ?? null,
  };
}

/**
 * Job match: ưu tiên lộ trình JD (jobLevel → jobTrack → phòng ban).
 * Search NTD không gắn tin: dùng jobTrack của ứng viên. Mặc định kinh doanh.
 */
export function resolveMatchTrack(input: {
  job?: Pick<B2bJobMatchInput, 'jobLevel' | 'jobTrack' | 'department'>;
  candidate?: Pick<B2bCandidateMatchInput, 'jobTrack'>;
}): 'sales' | 'technical' {
  const level = input.job?.jobLevel?.trim().toLowerCase() ?? '';
  if (level.startsWith('technical.')) return 'technical';
  if (level.startsWith('sales.')) return 'sales';

  const jobTrack = input.job?.jobTrack?.trim().toLowerCase();
  if (jobTrack === 'technical' || jobTrack === 'sales') return jobTrack;

  const implied = trackImpliedByDepartment(input.job?.department);
  if (implied === JobTrack.Technical) return 'technical';
  if (implied === JobTrack.Sales) return 'sales';

  const cand = input.candidate?.jobTrack?.trim().toLowerCase();
  if (cand === 'technical' || cand === 'sales') return cand;
  return 'sales';
}

function criterion(
  key: B2bMatchCriterionKey,
  score: number | null,
  note: string | undefined,
  weights: Record<B2bMatchCriterionKey, number>,
  track: string,
): MatchCriterionScore {
  return {
    key,
    label: b2bMatchCriterionLabel(key, track),
    score,
    weight: weights[key],
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
  extraLocations?: string[],
  opts?: { splitWorkplaceAndMarkets?: boolean },
): { score: number | null; note?: string } {
  if (opts?.splitWorkplaceAndMarkets) {
    const parts: { score: number; note: string }[] = [];
    if (filterRegions?.length) {
      const ov = setOverlapScore(filterRegions, markets);
      parts.push({
        score: ov.score ?? 0,
        note: ov.matched.length
          ? `Thị trường: ${ov.matched.join(', ')}`
          : 'Chưa khớp thị trường phụ trách',
      });
    }
    const workplaces = splitJoinedValues(jobLocation);
    if (workplaces.length) {
      const ov = setOverlapScore(workplaces, extraLocations);
      parts.push({
        score: ov.score ?? 0,
        note: ov.matched.length
          ? `Nơi làm: ${ov.matched.join(', ')}`
          : 'Chưa khớp địa điểm làm việc',
      });
    }
    if (!parts.length) return { score: null };
    const score = parts.reduce((s, p) => s + p.score, 0) / parts.length;
    return { score, note: parts.map((p) => p.note).join(' · ') };
  }

  const required = [
    ...(filterRegions ?? []),
    ...(jobLocation?.trim() ? [jobLocation.trim()] : []),
  ];
  if (required.length === 0) return { score: null };
  const pool = [...(markets ?? []), ...(extraLocations ?? [])].map((s) => s.trim()).filter(Boolean);
  const { score, matched } = setOverlapScore(required, pool);
  if ((score ?? 0) === 0 && jobLocation && pool.length > 0) {
    const jl = norm(jobLocation);
    const soft = pool.some((m) => {
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

function achievementsScore(
  c: B2bCandidateMatchInput,
  track: 'sales' | 'technical',
): { score: number | null; note?: string } {
  if (track === 'technical') {
    const text = c.salesHighlights?.trim() ?? '';
    if (!text) return { score: null };
    if (text.length < 20) {
      return { score: 0.45, note: 'Thành tích/dự án còn sơ lược' };
    }
    return { score: 1, note: 'Có thành tích/dự án nổi bật' };
  }

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

function dealCodesOf(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const code = normalizeDealTypeValue(raw) ?? (raw?.trim() || null);
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function dealProfileScore(
  c: B2bCandidateMatchInput,
  filterDealType?: string | null,
  track: 'sales' | 'technical' = 'sales',
  opts?: { filterDealTypes?: string[]; strict?: boolean; minAutonomyLevel?: number | null },
): { score: number | null; note?: string } {
  if (track === 'technical') {
    const need = opts?.minAutonomyLevel ?? null;
    const have = c.technicalAutonomyLevel;
    const autonomyNote = (level: number) => {
      const clamped = Math.max(1, Math.min(5, level));
      const label =
        clamped >= 5
          ? 'Hướng dẫn người khác'
          : clamped >= 4
            ? 'Tự xử lý việc phức tạp'
            : clamped >= 3
              ? 'Tự thực hiện'
              : clamped >= 2
                ? 'Làm theo hướng dẫn'
                : 'Cần hướng dẫn';
      return { clamped, label };
    };

    if (opts?.strict) {
      if (need == null) return { score: null };
      if (have == null || have < 1) {
        return { score: 0, note: 'Chưa có mức tự chủ kỹ thuật' };
      }
      const { clamped, label } = autonomyNote(have);
      if (clamped >= need) {
        return { score: 1, note: `Tự chủ mức ${clamped}/5 · ${label}` };
      }
      return {
        score: clamped / need,
        note: `Tự chủ mức ${clamped}/5 (yêu cầu ${need}) · ${label}`,
      };
    }

    if (have == null || have < 1) return { score: null };
    const { clamped, label } = autonomyNote(have);
    return { score: Math.min(1, clamped / 4), note: `Tự chủ mức ${clamped}/5 · ${label}` };
  }

  const have = dealCodesOf([...(c.dealTypes ?? []), c.dealType]);
  const need = dealCodesOf([...(opts?.filterDealTypes ?? []), filterDealType]);

  if (opts?.strict) {
    if (!need.length) return { score: null };
    const ov = setOverlapScore(need, have);
    const labels = ov.matched.map((code) => DEAL_TYPE_LABEL[code as DealType] ?? code);
    return {
      score: ov.score ?? 0,
      note: labels.length ? `Loại hình: ${labels.join(', ')}` : 'Chưa khớp loại hình kinh doanh',
    };
  }

  if (!c.dealType && !have.length && c.typicalDealValue == null && c.maxDealValue == null) {
    return { score: null };
  }
  if (filterDealType && c.dealType && norm(c.dealType) !== norm(filterDealType)) {
    return { score: 0.4, note: `Thương vụ ${c.dealType}` };
  }
  let score = c.dealType || have.length ? 0.7 : 0.5;
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
  opts?: { track?: string; technicalWorkTypes?: string[]; skipIfNoRequired?: boolean },
): { score: number | null; note?: string } {
  const isTech = opts?.track === 'technical';
  const haveRaw = isTech
    ? (opts?.technicalWorkTypes?.length ? opts.technicalWorkTypes : stages ?? []).map((s) =>
        s.trim(),
      )
    : (stages ?? []).map((s) => normalizeSellingStage(s) ?? s.trim());
  const have = [...new Set(haveRaw.filter(Boolean))];
  const hasRequired = Boolean(requiredStages && requiredStages.length > 0);

  if (!hasRequired && opts?.skipIfNoRequired) return { score: null };
  if (have.length === 0) {
    if (hasRequired) {
      return {
        score: 0,
        note: isTech ? 'Chưa có loại công việc kỹ thuật' : 'Chưa có giai đoạn bán hàng',
      };
    }
    return { score: null };
  }

  const need = hasRequired
    ? requiredStages!
        .map((s) => (isTech ? s.trim() : (normalizeSellingStage(s) ?? s.trim())))
        .filter(Boolean)
    : isTech
      ? [...TECHNICAL_WORK_TYPES]
      : [...SELLING_STAGES];

  const { score, matched } = setOverlapScore(need, have);
  return {
    score: score ?? 0,
    note: isTech
      ? `Đã làm ${matched.length}/${need.length} loại công việc kỹ thuật`
      : `Đã làm ${matched.length}/${need.length} giai đoạn chu trình bán`,
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
  opts?: { skipIfUnspecified?: boolean },
): { score: number | null; note?: string } {
  if (!required?.length) {
    if (opts?.skipIfUnspecified || !have?.length) return { score: null };
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
  opts?: { skipIfUnspecified?: boolean },
): { score: number | null; note?: string } {
  const ability =
    travelAbility ??
    (willingToTravel === true
      ? TravelAbility.From25To50
      : willingToTravel === false
        ? TravelAbility.None
        : null);

  if (!requireTravel && !minTravel) {
    if (opts?.skipIfUnspecified || ability == null) return { score: null };
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
  opts?: { filterLicenses?: string[]; candidateLicenses?: string[]; skipIfUnspecified?: boolean },
): { score: number | null; note?: string } {
  const have = unionUnique(
    opts?.candidateLicenses,
    parseDriverLicenses(licenseType),
    hasLicense ? 'Ô tô' : undefined,
  );
  const need = (opts?.filterLicenses ?? []).filter((l) => l !== 'Chưa có');
  if (need.length) {
    const ov = setOverlapScore(need, have);
    return {
      score: ov.score ?? 0,
      note: ov.matched.length ? ov.matched.join(', ') : 'Thiếu giấy phép lái xe yêu cầu',
    };
  }
  if (!require) {
    if (opts?.skipIfUnspecified) return { score: null };
    if (hasLicense == null && !licenseType && !have.length) return { score: null };
    return {
      score: hasLicense === true || Boolean(licenseType) || have.length ? 1 : 0.5,
      note: licenseType ?? (hasLicense ? 'Có bằng' : 'Không có bằng'),
    };
  }
  if (hasLicense === true || Boolean(licenseType) || have.length) {
    return { score: 1, note: licenseType ?? have[0] ?? 'Có bằng lái' };
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
  opts?: { skipIfUnspecified?: boolean },
): { score: number | null; note?: string } {
  const eMin = expectedMin ?? null;
  const eMax = expectedMax ?? expectedOte ?? expectedMin ?? null;
  if (eMin == null && eMax == null) return { score: null };
  if (jobMin == null && jobMax == null) {
    if (opts?.skipIfUnspecified) return { score: null };
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
  extraTitles?: string[],
  opts?: { skipIfUnspecified?: boolean },
): { score: number | null; note?: string } {
  const orientationList = Array.isArray(orientation)
    ? orientation
    : orientation
      ? orientation
          .split(/\s*\|\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const have = unionUnique(orientationList, desired, extraTitles);
  if (!pathTags?.length) {
    if (opts?.skipIfUnspecified || !have.length) return { score: null };
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

  const track = resolveMatchTrack({ job: input.job, candidate: input.candidate });
  const weights = b2bMatchWeightsForTrack(track);
  const isTech = track === 'technical';
  const strict = Boolean(input.job.strictJdCriteria);
  const row = (key: B2bMatchCriterionKey, score: number | null, note?: string) =>
    criterion(key, score, note, weights, track);

  const industriesHave = normalizeIndustries([
    ...(input.candidate.industriesExperienced ?? []),
    ...(input.candidate.industry ? [input.candidate.industry] : []),
  ]);
  const industriesNeed = normalizeIndustries([
    ...(input.job.filterIndustries ?? []),
    ...(input.job.industry ? [input.job.industry] : []),
  ]);
  const industryOv = setOverlapScore(industriesNeed, industriesHave);

  const inferredNeed = strict
    ? []
    : isTech
      ? inferEquipmentFromJob({
          industry: input.job.industry,
          title: input.job.title,
          description: input.job.description,
          skills: requiredSkills,
        })
      : inferProductsFromJob({
          industry: input.job.industry,
          title: input.job.title,
          description: input.job.description,
          skills: requiredSkills,
        });
  const productsNeed = input.job.filterProducts?.length
    ? input.job.filterProducts
    : inferredNeed;
  const productsOv =
    (input.candidate.productsSold?.length ?? 0) === 0 && !input.job.filterProducts?.length
      ? { score: null as number | null, matched: [] as string[] }
      : setOverlapScore(productsNeed, input.candidate.productsSold);

  const inferredSegments = strict
    ? []
    : inferCustomerSegmentsFromJob({
        title: input.job.title,
        description: input.job.description,
      });
  const segmentsNeed = input.job.filterCustomerSegments?.length
    ? input.job.filterCustomerSegments
    : inferredSegments;
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
    [
      ...(input.candidate.currentCity?.trim() ? [input.candidate.currentCity.trim()] : []),
      ...(input.candidate.desiredLocations ?? []),
    ],
    { splitWorkplaceAndMarkets: strict },
  );
  const skipExtra = strict;
  const ach = skipExtra
    ? { score: null as number | null, note: undefined as string | undefined }
    : achievementsScore(input.candidate, track);
  const custDev = skipExtra
    ? { score: null as number | null, note: undefined as string | undefined }
    : customerDevScore(
        input.candidate.customerDevStyle,
        input.candidate.newCustomerRatioPct,
        input.job.filterCustomerDevStyle ?? input.job.salesPersona,
      );
  const deal = dealProfileScore(input.candidate, input.job.filterDealType, track, {
    filterDealTypes: input.job.filterDealTypes,
    strict,
    minAutonomyLevel: input.job.minTechnicalAutonomyLevel,
  });
  const selling = sellingCapabilityScore(
    input.candidate.sellingStages,
    input.job.requiredSellingStages,
    {
      track,
      technicalWorkTypes: input.candidate.technicalWorkTypes,
      skipIfNoRequired: strict,
    },
  );
  const ready = skipExtra
    ? { score: null as number | null, note: undefined as string | undefined }
    : readinessScore(
        input.candidate.jobReadiness,
        input.candidate.availabilityBand,
        input.candidate.noticePeriodDays,
        input.job.filterJobReadiness,
        input.job.maxNoticeDays,
      );
  const langs = languagesScore(input.candidate.languages, input.job.filterLanguages, {
    skipIfUnspecified: strict,
  });
  const travel = travelScore(
    input.candidate.travelAbility,
    input.candidate.willingToTravel,
    input.job.requireTravel,
    input.job.minTravelAbility,
    { skipIfUnspecified: strict },
  );
  const license = driversLicenseScore(
    input.candidate.hasB2License,
    input.candidate.driverLicenseType,
    input.job.requireB2License,
    {
      filterLicenses: input.job.filterDriverLicenses,
      candidateLicenses: input.candidate.driverLicenses,
      skipIfUnspecified: strict,
    },
  );
  const income = expectedIncomeScore(
    input.candidate.expectedSalaryMin,
    input.candidate.expectedSalaryMax,
    input.candidate.expectedOte,
    input.job.salaryMin,
    input.job.salaryMax,
    { skipIfUnspecified: strict },
  );
  const style = skipExtra
    ? { score: null as number | null, note: undefined as string | undefined }
    : salesStyleScore(
        input.candidate.customerDevStyle,
        input.job.salesPersona ?? input.job.filterCustomerDevStyle,
      );
  const motivation = skipExtra
    ? { score: null as number | null, note: undefined as string | undefined }
    : tagOverlapScore(
        input.candidate.careerMotivations,
        input.job.motivationTags,
        'Chưa có động lực nghề',
      );
  const culture = skipExtra
    ? { score: null as number | null, note: undefined as string | undefined }
    : tagOverlapScore(
        input.candidate.workStyles,
        input.job.cultureTags,
        'Chưa có phong cách làm việc',
      );
  const orientation = careerOrientationScore(
    input.candidate.careerOrientation,
    input.candidate.desiredPositions,
    input.job.careerPathTags,
    input.candidate.jobTitles,
    { skipIfUnspecified: strict },
  );

  const productsGapNote = isTech
    ? 'Chưa khớp thiết bị / hệ thống'
    : 'Chưa khớp sản phẩm đã bán';
  const productsHitNote = (hits: string[]) =>
    isTech ? `Thiết bị: ${hits.join(', ')}` : `Sản phẩm: ${hits.join(', ')}`;
  const segmentsHitNote = (hits: string[]) =>
    isTech ? `Môi trường: ${hits.join(', ')}` : `Tệp KH: ${hits.join(', ')}`;
  const segmentsGapNote = isTech ? 'Chưa khớp môi trường làm việc' : 'Chưa khớp tệp khách hàng';
  const industryHitNote = (hits: string[]) =>
    isTech ? `Khớp lĩnh vực: ${hits.join(', ')}` : `Khớp ngành: ${hits.join(', ')}`;
  const industryGapNote = isTech ? 'Chưa khớp lĩnh vực kỹ thuật' : 'Chưa khớp ngành';

  const criteria: MatchCriterionScore[] = [
    row(
      'industry',
      industryOv.score,
      industryOv.matched.length
        ? industryHitNote(industryOv.matched)
        : industriesNeed.length
          ? industryGapNote
          : undefined,
    ),
    row(
      'products',
      productsOv.score,
      productsOv.matched.length
        ? productsHitNote(productsOv.matched)
        : productsNeed.length
          ? productsGapNote
          : undefined,
    ),
    row(
      'customerSegments',
      segmentsOv.score,
      segmentsOv.matched.length
        ? segmentsHitNote(segmentsOv.matched)
        : segmentsNeed.length
          ? segmentsGapNote
          : undefined,
    ),
    row('achievements', ach.score, ach.note),
    row('customerDev', custDev.score, custDev.note),
    row('b2bExperience', exp.score, exp.note),
    row('sellingCapability', selling.score, selling.note),
    row('dealProfile', deal.score, deal.note),
    row('region', region.score, region.note),
    row('readiness', ready.score, ready.note),
    row('languages', langs.score, langs.note),
    row('travel', travel.score, travel.note),
    row('driversLicense', license.score, license.note),
    row('expectedIncome', income.score, income.note),
    row('salesStyle', style.score, style.note),
    row('careerMotivation', motivation.score, motivation.note),
    row('cultureFit', culture.score, culture.note),
    row('careerOrientation', orientation.score, orientation.note),
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
    parts.push(`Khớp ${applicable.length} tiêu chí (năng lực lõi nổi bật: ${coreHit}).`);
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
