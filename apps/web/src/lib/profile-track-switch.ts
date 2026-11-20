import {
  MAX_DESIRED_POSITIONS,
  filterDesiredPositionsForTrack,
  normalizeProfileTrack,
  type ProfileTrack,
} from '@industriallink/contracts';

export type { ProfileTrack };

/**
 * Chuyển lĩnh vực hồ sơ an toàn (STRICT BOUNDARY).
 *
 * - Mục 1–12 (thông tin chung) giữ nguyên 100% khi đổi lĩnh vực.
 * - Dữ liệu mục 13+ của nhánh cũ được lưu vào `sessionDraftByTrack[oldTrack]`
 *   (chỉ sống trong phiên chỉnh sửa hiện tại) → quay lại nhánh cũ trong cùng
 *   phiên thì không mất dữ liệu vừa nhập.
 * - Dữ liệu mục 13+ của nhánh mới được nạp lại từ `sessionDraftByTrack[newTrack]`
 *   nếu có, ngược lại reset sạch về rỗng.
 */

export type TrackDraftSnapshot = {
  /** Vị trí ứng tuyển đã chọn (mục 13) của nhánh. */
  desiredPositions: string[];
  /** Toàn bộ state thuộc nhánh (mục 13+) đã lưu tạm. */
  fields: Record<string, unknown>;
};

/** Danh sách field của FormState thuộc nhánh KINH DOANH (mục 13–32). */
export const SALES_TRACK_FIELD_KEYS = [
  'desiredPositions',
  'b2bExperienceBand',
  'salesHighlights',
  'dealType',
  'latestRevenue',
  'kpiAchievementPct',
  'newCustomerRatioPct',
  'typicalDealValue',
  'maxDealValue',
  'expectedOte',
  'careerOrientations',
  'cultureFit',
  'salesBehavior',
  'careerMotivations',
] as const;

/** Danh sách field của FormState thuộc nhánh KỸ THUẬT (mục 13–28). */
export const TECHNICAL_TRACK_FIELD_KEYS = [
  'desiredPositions',
  'technicalWorkStyles',
] as const;

/** Field của FormState thuộc TrackExtras (nhánh Kỹ thuật). */
export const TECHNICAL_TRACK_EXTRA_KEYS = [
  'brandsTechnologies',
  'technicalWorkTypes',
  'technicalAutonomyLevel',
  'troubleshootingLevel',
  'technicalTools',
  'documentLiteracy',
  'systemScaleNote',
  'shiftFlexibility',
  'technicalWorkStyles',
  'desiredWorkEnvironments',
] as const;

/** Field của FormState thuộc TrackExtras (nhánh Kinh doanh). */
export const SALES_TRACK_EXTRA_KEYS = [] as const;

/**
 * Reset sạch toàn bộ field của `keys` về giá trị rỗng/mặc định.
 * Dùng cho việc làm mới nhánh mới khi chuyển lĩnh vực.
 */
export function resetTrackFields<T extends Record<string, unknown>>(
  source: T,
  keys: readonly string[],
): T {
  const next = { ...source } as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in next)) continue;
    const current = next[key];
    if (Array.isArray(current)) {
      next[key] = [];
    } else if (typeof current === 'number') {
      next[key] = null;
    } else if (typeof current === 'boolean') {
      next[key] = false;
    } else if (current && typeof current === 'object') {
      next[key] = {};
    } else {
      next[key] = '';
    }
  }
  return next as T;
}

/**
 * Lọc `desiredPositions` theo nhánh mới + cắt tối đa 3.
 * Dùng khi nạp lại nhánh cũ hoặc khi chuyển nhánh.
 */
export function sanitizeDesiredPositions(
  values: readonly string[] | null | undefined,
  track: ProfileTrack,
): string[] {
  return filterDesiredPositionsForTrack(values, track).slice(0, MAX_DESIRED_POSITIONS);
}

/** Chuẩn hóa track bất kỳ về 'sales' | 'technical'. */
export function toProfileTrack(track: string | null | undefined): ProfileTrack {
  return normalizeProfileTrack(track);
}

/**
 * Nhãn hiển thị của nhánh — dùng trong Confirm Modal.
 */
export const TRACK_DISPLAY_LABEL: Record<ProfileTrack, string> = {
  sales: 'Kinh doanh',
  technical: 'Kỹ thuật',
};
