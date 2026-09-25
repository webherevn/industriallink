/**
 * Tỷ trọng % hoàn thành hồ sơ (Tạo CV / chỉnh hồ sơ).
 * Độc lập với điểm Matching JD — không dùng completion để chấm phù hợp JD.
 *
 * Kinh doanh: ma trận 32 mục (PDF 8.9.2026). Kỹ thuật: 28 mục (PDF 8.9.2026).
 */

export type SuggestionTrack = 'sales' | 'technical';

/**
 * Kinh doanh — A 9,5% + B 7,5% + C 83% = 100% (PDF 8.9.2026, không matching).
 * Động lực / cultureFit không thuộc ma trận 32 mục → 0%.
 */
export const AI_SUGGESTION_WEIGHT_PCT_SALES: Record<string, number> = {
  fullName: 0.5,
  birthYear: 0.5,
  phone: 0.5,
  email: 0.5,
  location: 0.5,
  ward: 0,
  title: 0,
  educationLevel: 1,
  education: 0.5,
  educationMajor: 1,
  certificates: 0.5,
  languages: 2,
  driversLicense: 0.5,
  travel: 1.5,
  desiredPositions: 1.5,
  desiredLocations: 2,
  expectedSalary: 2,
  availability: 1,
  careerOrientations: 1,
  careerMotivations: 0,
  cultureFit: 0,
  experience: 0.5,
  experienceRole: 3,
  experiencePeriod: 5,
  industries: 14,
  products: 17,
  segments: 15,
  dealType: 5,
  sellingStages: 12,
  brands: 1,
  markets: 5,
  revenue: 1,
  kpi: 1,
  newCustomerRatio: 1,
  dealValue: 1,
  salesHighlights: 1.5,
  b2bExperience: 0,
  summary: 0,
  careerObjective: 0,
  hobbies: 0,
  skills: 0,
  jobReadiness: 0,
};

/**
 * Snapshot trọng số KD dùng để gom matching NTD (bảng cũ).
 * Cố định — đổi completion ở trên không được kéo theo Matching JD.
 */
const MATCH_SOURCE_WEIGHT_PCT_SALES: Record<string, number> = {
  fullName: 0,
  birthYear: 0,
  phone: 0,
  email: 0,
  location: 2,
  ward: 0,
  title: 0,
  desiredPositions: 5,
  desiredLocations: 2,
  expectedSalary: 3,
  availability: 1,
  educationLevel: 0.5,
  education: 0,
  educationMajor: 0.5,
  certificates: 0.5,
  languages: 2,
  driversLicense: 0.5,
  travel: 1,
  careerMotivations: 1,
  careerOrientations: 2,
  cultureFit: 2,
  experience: 0,
  experienceRole: 5,
  experiencePeriod: 5,
  industries: 12,
  products: 16,
  segments: 11,
  dealType: 5,
  sellingStages: 8,
  brands: 1,
  markets: 2,
  revenue: 3,
  kpi: 2,
  newCustomerRatio: 2,
  dealValue: 1,
  salesHighlights: 2,
  b2bExperience: 0,
  summary: 0,
  careerObjective: 0,
  hobbies: 0,
  skills: 0,
  jobReadiness: 0,
};

/**
 * Snapshot trọng số KT dùng để gom matching NTD (bảng 32 mục cũ).
 * Cố định — đổi completion ở trên không được kéo theo Matching JD.
 */
const MATCH_SOURCE_WEIGHT_PCT_TECHNICAL: Record<string, number> = {
  fullName: 0,
  birthYear: 0,
  phone: 0,
  email: 0,
  location: 2,
  ward: 0,
  title: 0,
  educationLevel: 1,
  education: 0,
  educationMajor: 1,
  certificates: 2,
  languages: 2,
  driversLicense: 2,
  travel: 2,
  desiredPositions: 4,
  desiredLocations: 3,
  expectedSalary: 6,
  availability: 2,
  shiftFlexibility: 1,
  technicalTools: 2,
  documentLiteracy: 2,
  cultureFit: 1,
  careerOrientations: 0,
  careerMotivations: 0,
  desiredWorkEnvironments: 1,
  experience: 0,
  experienceRole: 4,
  experiencePeriod: 5,
  industries: 9,
  products: 19,
  segments: 4,
  technicalWorkTypes: 12,
  technicalAutonomyLevel: 8,
  salesHighlights: 5,
  brands: 0,
  summary: 0,
  careerObjective: 0,
  hobbies: 0,
  skills: 0,
  jobReadiness: 0,
};

/**
 * Kỹ thuật — A 10,5% + B 6,5% + C 6,5% + D 76,5% = 100% (PDF 8.9.2026, 28 mục).
 * Cách làm việc / định hướng / động lực / môi trường mong muốn: tham khảo, 0%.
 */
export const AI_SUGGESTION_WEIGHT_PCT_TECHNICAL: Record<string, number> = {
  fullName: 0.5,
  birthYear: 0.5,
  phone: 0.5,
  email: 0.5,
  location: 1,
  ward: 0,
  title: 0,
  educationLevel: 1,
  education: 0.5,
  educationMajor: 1,
  certificates: 1,
  languages: 1.5,
  driversLicense: 1,
  travel: 1.5,
  desiredPositions: 1.5,
  desiredLocations: 2,
  expectedSalary: 2,
  availability: 1,
  shiftFlexibility: 1.5,
  technicalTools: 2.5,
  documentLiteracy: 2.5,
  cultureFit: 0,
  careerOrientations: 0,
  careerMotivations: 0,
  desiredWorkEnvironments: 0,
  experience: 0.5,
  experienceRole: 5,
  experiencePeriod: 5.5,
  industries: 14,
  products: 19,
  segments: 5,
  technicalWorkTypes: 16,
  technicalAutonomyLevel: 9,
  salesHighlights: 2.5,
  brands: 0,
  summary: 0,
  careerObjective: 0,
  hobbies: 0,
  skills: 0,
  jobReadiness: 0,
};

/** @deprecated Dùng suggestionWeightTable(track) — mặc định kinh doanh. */
export const AI_SUGGESTION_WEIGHT_PCT = AI_SUGGESTION_WEIGHT_PCT_SALES;

/** Gom field ma trận → key matching NTD (18 tiêu chí). */
const SUGGESTION_TO_MATCH_SALES: Record<string, string> = {
  location: 'region',
  desiredLocations: 'region',
  markets: 'region',
  desiredPositions: 'careerOrientation',
  careerOrientations: 'careerOrientation',
  expectedSalary: 'expectedIncome',
  availability: 'readiness',
  languages: 'languages',
  driversLicense: 'driversLicense',
  travel: 'travel',
  careerMotivations: 'careerMotivation',
  cultureFit: 'cultureFit',
  educationLevel: 'sellingCapability',
  educationMajor: 'sellingCapability',
  certificates: 'sellingCapability',
  experienceRole: 'b2bExperience',
  experiencePeriod: 'b2bExperience',
  industries: 'industry',
  products: 'products',
  brands: 'products',
  segments: 'customerSegments',
  dealType: 'dealProfile',
  dealValue: 'dealProfile',
  sellingStages: 'sellingCapability',
  revenue: 'achievements',
  kpi: 'achievements',
  salesHighlights: 'achievements',
  newCustomerRatio: 'customerDev',
};

const SUGGESTION_TO_MATCH_TECHNICAL: Record<string, string> = {
  location: 'region',
  desiredLocations: 'region',
  desiredPositions: 'careerOrientation',
  careerOrientations: 'careerOrientation',
  expectedSalary: 'expectedIncome',
  availability: 'readiness',
  languages: 'languages',
  driversLicense: 'driversLicense',
  travel: 'travel',
  careerMotivations: 'careerMotivation',
  cultureFit: 'salesStyle',
  shiftFlexibility: 'cultureFit',
  desiredWorkEnvironments: 'cultureFit',
  experienceRole: 'b2bExperience',
  experiencePeriod: 'b2bExperience',
  industries: 'industry',
  products: 'products',
  segments: 'customerSegments',
  technicalWorkTypes: 'sellingCapability',
  technicalTools: 'sellingCapability',
  documentLiteracy: 'sellingCapability',
  educationLevel: 'sellingCapability',
  educationMajor: 'sellingCapability',
  certificates: 'sellingCapability',
  technicalAutonomyLevel: 'dealProfile',
  salesHighlights: 'achievements',
};

/**
 * Gom tỷ trọng matching NTD (snapshot KD cũ / ma trận KT) về 18 key (tổng = 1).
 * Không dùng bảng hoàn thành hồ sơ — đổi % Tạo CV không kéo Matching JD.
 */
export function rollupMatchWeights(
  track?: SuggestionTrack | string | null,
): Record<string, number> {
  const isTech = track === 'technical';
  const table = isTech
    ? MATCH_SOURCE_WEIGHT_PCT_TECHNICAL
    : MATCH_SOURCE_WEIGHT_PCT_SALES;
  const map = isTech ? SUGGESTION_TO_MATCH_TECHNICAL : SUGGESTION_TO_MATCH_SALES;
  const rolled: Record<string, number> = {};
  for (const [field, pct] of Object.entries(table)) {
    if (pct <= 0) continue;
    const key = map[field];
    if (!key) continue;
    rolled[key] = (rolled[key] ?? 0) + pct;
  }
  const total = Object.values(rolled).reduce((s, w) => s + w, 0);
  if (total <= 0) return rolled;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rolled)) {
    out[k] = v / total;
  }
  return out;
}

export function suggestionWeightTable(
  track?: SuggestionTrack | string | null,
): Record<string, number> {
  return track === 'technical'
    ? AI_SUGGESTION_WEIGHT_PCT_TECHNICAL
    : AI_SUGGESTION_WEIGHT_PCT_SALES;
}

export function suggestionFillRatio(status: 'filled' | 'weak' | 'missing'): number {
  if (status === 'filled') return 1;
  if (status === 'weak') return 0.5;
  return 0;
}

/** % hoàn thành = tổng (trọng số × độ đầy) / 100 (mục thiếu = 0, mẫu số luôn bảng > 0%). */
export function weightedSuggestionPercent(
  items: ReadonlyArray<{ key: string; fill: number }>,
  track?: SuggestionTrack | string | null,
): number {
  const table = suggestionWeightTable(track);
  let total = 0;
  for (const w of Object.values(table)) {
    if (w > 0) total += w;
  }
  if (total <= 0) return 0;
  const fillByKey = new Map<string, number>();
  for (const item of items) {
    fillByKey.set(item.key, Math.max(0, Math.min(1, item.fill)));
  }
  let earned = 0;
  for (const [key, w] of Object.entries(table)) {
    if (w <= 0) continue;
    earned += w * (fillByKey.get(key) ?? 0);
  }
  return Math.round((earned / total) * 100);
}
