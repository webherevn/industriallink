/**
 * Ranh giới phân tách dữ liệu theo lĩnh vực hồ sơ (ATS).
 *
 * Bất biến (STRICT BOUNDARY):
 * - Mục 1–12 là thông tin chung — dùng chung cho cả 2 nhánh, KHÔNG reset khi đổi lĩnh vực.
 * - Nhánh KINH DOANH (`sales`): mục 13–32.
 * - Nhánh KỸ THUẬT (`technical`): mục 13–28.
 * - Tại mọi thời điểm trong DB, hồ sơ chính CHỈ được chứa dữ liệu mục 13+ của
 *   DUY NHẤT 1 lĩnh vực đang active. Lưu sang nhánh mới phải xóa sạch nhánh cũ.
 */

import { DESIRED_POSITIONS } from './sales-b2b-criteria';
import { TECHNICAL_DESIRED_POSITIONS } from './technical-criteria';
import { JobTrack } from './career-path';

export type ProfileTrack = 'sales' | 'technical';

/** Danh sách vị trí ứng tuyển CHUẨN theo từng nhánh — nguồn sự thật duy nhất. */
export const ALLOWED_POSITIONS = {
  sales: [...DESIRED_POSITIONS],
  technical: [...TECHNICAL_DESIRED_POSITIONS],
} as const;

/** Số vị trí ứng tuyển tối đa được chọn (mục 13) — áp dụng cho CẢ 2 nhánh. */
export const MAX_DESIRED_POSITIONS = 3;

/**
 * Lọc danh sách vị trí ứng tuyển theo nhánh đang active:
 * - Bỏ mọi giá trị không thuộc danh mục chuẩn của nhánh (chống dữ liệu lai tạp).
 * - Bỏ giá trị trùng.
 * - Cắt còn tối đa `MAX_DESIRED_POSITIONS`.
 */
export function filterDesiredPositionsForTrack(
  values: readonly string[] | null | undefined,
  track: ProfileTrack,
): string[] {
  const allowed = new Set<string>(ALLOWED_POSITIONS[track]);
  const out: string[] = [];
  for (const raw of values ?? []) {
    const value = (raw ?? '').trim();
    if (!value) continue;
    if (!allowed.has(value)) continue;
    if (out.includes(value)) continue;
    out.push(value);
    if (out.length >= MAX_DESIRED_POSITIONS) break;
  }
  return out;
}

/** Kiểm tra một giá trị vị trí có thuộc danh mục chuẩn của nhánh không. */
export function isAllowedPositionForTrack(
  value: string,
  track: ProfileTrack,
): boolean {
  return (ALLOWED_POSITIONS[track] as readonly string[]).includes(value);
}

/**
 * Các trường hồ sơ CHỈ thuộc nhánh Kinh doanh (mục 13–32 của SALES).
 * Khi lưu với `jobTrack = 'technical'` — phải xóa sạch toàn bộ những trường này.
 */
export const SALES_ONLY_PROFILE_FIELDS = [
  'b2bExperienceBand',
  'marketsCovered',
  'customerDevStyle',
  'dealType',
  'typicalDealValue',
  'maxDealValue',
  'sellingStages',
  'latestRevenue',
  'kpiAchievementPct',
  'newCustomerRatioPct',
  'expectedOte',
  'hasB2License',
  'driverLicenseType',
] as const;

/**
 * Các trường hồ sơ CHỈ thuộc nhánh Kỹ thuật (mục 13–28 của TECHNICAL).
 * Khi lưu với `jobTrack = 'sales'` — phải xóa sạch toàn bộ những trường này.
 */
export const TECHNICAL_ONLY_PROFILE_FIELDS = [
  'brandsTechnologies',
  'technicalWorkTypes',
  'technicalAutonomyLevel',
  'troubleshootingLevel',
  'technicalTools',
  'documentLiteracy',
  'systemScaleNote',
  'shiftFlexibility',
  'desiredWorkEnvironments',
] as const;

/**
 * Các trường hồ sơ dùng chung cho 2 nhánh (mục 1–12) — TUYỆT ĐỐI KHÔNG reset
 * khi ứng viên chuyển lĩnh vực.
 */
export const SHARED_PROFILE_FIELDS = [
  'currentPosition',
  'jobLevel',
  'totalExperienceYears',
  'industry',
  'industriesExperienced',
  'specialization',
  'summary',
  'careerObjective',
  'desiredPositions',
  'desiredLocations',
  'careerMotivations',
  'workStyles',
  'careerOrientation',
  'educationLevel',
  'educationClassification',
  'educationSchool',
  'educationMajor',
  'certificates',
  'hobbies',
  'birthYear',
  'birthDate',
  'currentCity',
  'district',
  'ward',
  'phone',
  'languages',
  'languageSkills',
  'travelAbility',
  'willingToTravel',
] as const;

/**
 * Chuẩn hóa `jobTrack` về giá trị hợp lệ. Giá trị rỗng/không xác định → `sales`
 * (mặc định của ma trận 32 mục).
 */
export function normalizeProfileTrack(
  track: string | null | undefined,
): ProfileTrack {
  return track?.toString().toLowerCase() === JobTrack.Technical
    ? 'technical'
    : 'sales';
}

/** Tổng số tiêu chí bắt buộc theo ma trận — 32 (KD) / 28 (KT). */
export const PROFILE_CRITERIA_TOTAL = {
  sales: 32,
  technical: 28,
} as const;
