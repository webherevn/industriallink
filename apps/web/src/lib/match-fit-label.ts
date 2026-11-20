/**
 * CHUẨN HÓA NHÃN ĐIỂM AI MATCHING — 1 nguồn sự thật duy nhất toàn sàn.
 *
 * ⚠ Trước đây mỗi màn hình tự định nghĩa ngưỡng riêng (`matchRingLabel`,
 * `fitRingLabel`, `matchLabel`, `listingMatchLabel`) → dẫn tới lỗi hiển thị:
 *   - 10.3% hiện "Cân nhắc" ở trang việc làm (sai — phải là "Độ phù hợp thấp")
 *   - 18.4% / 18.2% hiện "Phù hợp" ở trang Tìm ứng viên AI (sai — phải là "Độ phù hợp thấp")
 *
 * Ngưỡng chuẩn (áp dụng cho Trang chi tiết việc làm, Tìm ứng viên AI,
 * Săn nhân sự và Drawer đối chiếu JD):
 *   >= 80%        → Rất phù hợp      (xanh lá)
 *   60% – 79.9%   → Khá phù hợp     (xanh dương)
 *   40% – 59.9%   → Cân nhắc         (vàng cam)
 *   < 40%          → Độ phù hợp thấp (xám / đỏ nhạt)
 */

/** Mức độ phù hợp định tính — dùng để chọn màu badge. */
export type MatchLevel = 'high' | 'medium' | 'low' | 'poor';

export const MATCH_LEVEL_LABEL: Record<MatchLevel, string> = {
  high: 'Rất phù hợp',
  medium: 'Khá phù hợp',
  low: 'Cân nhắc',
  poor: 'Độ phù hợp thấp',
};

/** Ngưỡng dưới của từng mức (%). */
export const MATCH_LEVEL_THRESHOLD = {
  high: 80,
  medium: 60,
  low: 40,
} as const;

/** Phân loại điểm phù hợp → mức định tính. */
export function matchLevelOf(score: number | null | undefined): MatchLevel {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'poor';
  if (value >= MATCH_LEVEL_THRESHOLD.high) return 'high';
  if (value >= MATCH_LEVEL_THRESHOLD.medium) return 'medium';
  if (value >= MATCH_LEVEL_THRESHOLD.low) return 'low';
  return 'poor';
}

/** Nhãn % độ phù hợp — dùng chung toàn sàn. */
export function matchFitLabel(score: number | null | undefined): string {
  return MATCH_LEVEL_LABEL[matchLevelOf(score)];
}

/** Class Tailwind cho badge % độ phù hợp (nền + chữ + viền). */
export function matchLevelBadgeClass(level: MatchLevel): string {
  switch (level) {
    case 'high':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80';
    case 'medium':
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80';
    case 'low':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80';
    case 'poor':
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80';
  }
}

/** Nhãn ngắn gọn dùng trong vòng tròn % (tránh chữ quá dài). */
export function matchRingFitLabel(score: number | null | undefined): string {
  return MATCH_LEVEL_LABEL[matchLevelOf(score)];
}
