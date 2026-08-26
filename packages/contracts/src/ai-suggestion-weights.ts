/**
 * Tỷ trọng % điểm gợi ý AI.
 *
 * Kinh doanh: ma trận 34 mục (A–E). Kỹ thuật: ma trận 32 mục (A–D, tổng 100%).
 * Field 0% không vào mẫu số. Hàm `weightedSuggestionPercent` chuẩn hoá theo track.
 */

export type SuggestionTrack = 'sales' | 'technical';

/** Kinh doanh — A 2% + B 11% + C 5% + D 5% + E ~75%. */
export const AI_SUGGESTION_WEIGHT_PCT_SALES: Record<string, number> = {
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
 * Kỹ thuật — A 12% + B 15% + C 7% + D 66% = 100%.
 * STT 21 định hướng & 22 động lực = 0% (tham khảo, không cộng điểm).
 */
export const AI_SUGGESTION_WEIGHT_PCT_TECHNICAL: Record<string, number> = {
  fullName: 0,
  birthYear: 0,
  phone: 0,
  email: 0,
  location: 2, // STT 5
  ward: 0,
  title: 0,
  educationLevel: 1, // STT 6
  education: 0, // STT 7 Trường học
  educationMajor: 1, // STT 8
  certificates: 2, // STT 9
  languages: 2, // STT 10
  driversLicense: 2, // STT 11
  travel: 2, // STT 12
  desiredPositions: 4, // STT 13
  desiredLocations: 3, // STT 14
  expectedSalary: 6, // STT 15
  availability: 2, // STT 16
  shiftFlexibility: 1, // STT 17
  technicalTools: 2, // STT 18
  documentLiteracy: 2, // STT 19
  cultureFit: 1, // STT 20 Cách làm việc kỹ thuật
  careerOrientations: 0, // STT 21 tham khảo
  careerMotivations: 0, // STT 22 tham khảo
  desiredWorkEnvironments: 1, // STT 23
  experience: 0, // STT 24 Tên công ty
  experienceRole: 4, // STT 25
  experiencePeriod: 5, // STT 26
  industries: 9, // STT 27 Lĩnh vực kỹ thuật đã làm
  products: 19, // STT 28 Thiết bị / hệ thống
  segments: 4, // STT 29 Môi trường làm việc thực tế
  technicalWorkTypes: 12, // STT 30
  technicalAutonomyLevel: 8, // STT 31
  salesHighlights: 5, // STT 32 Thành tích/dự án nổi bật
  brands: 0,
  summary: 0,
  careerObjective: 0,
  hobbies: 0,
  skills: 0,
  jobReadiness: 0,
};

/** @deprecated Dùng suggestionWeightTable(track) — mặc định kinh doanh. */
export const AI_SUGGESTION_WEIGHT_PCT = AI_SUGGESTION_WEIGHT_PCT_SALES;

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

/** % điểm gợi ý = tổng (trọng số × độ đầy) / tổng trọng số các mục > 0% theo track. */
export function weightedSuggestionPercent(
  items: ReadonlyArray<{ key: string; fill: number }>,
  track?: SuggestionTrack | string | null,
): number {
  const table = suggestionWeightTable(track);
  let earned = 0;
  let total = 0;
  for (const item of items) {
    const w = table[item.key] ?? 0;
    if (w <= 0) continue;
    total += w;
    earned += w * Math.max(0, Math.min(1, item.fill));
  }
  if (total <= 0) return 0;
  return Math.round((earned / total) * 100);
}
