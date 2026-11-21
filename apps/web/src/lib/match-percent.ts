/**
 * Định dạng điểm % phù hợp & bảng màu thuần thương hiệu inLink.
 *
 * ⭐ Ngưỡng chuẩn (nguồn sự thật duy nhất — xem `match-fit-label.ts`):
 *   >= 80%        → Rất phù hợp    (xanh ngọc #059669 / chữ #047857)
 *   60% – 79.9%   → Khá phù hợp    (xanh Navy inLink #0B468C / chữ #072348)
 *   40% – 59.9%   → Cân nhắc       (cam brand inLink #E8872A / chữ #C25E12)
 *   < 40%         → Độ phù hợp thấp (xám Slate #94A3B8 / chữ #64748B)
 */

/** Màu vòng nền (track) đồng nhất theo `--admin-border` của inLink. */
export const MATCH_RING_TRACK_COLOR = '#E2E8F0';

export function formatMatchPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  const clamped = Math.max(0, Math.min(100, value));
  return clamped.toFixed(1);
}

export function matchBadgeTone(value: number | null | undefined): string {
  const numeric = value === null || value === undefined || Number.isNaN(value) ? 0 : value;
  const clamped = Math.max(0, Math.min(100, numeric));
  if (clamped >= 80) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (clamped >= 60) return 'bg-sky-50 text-[#0B468C] ring-1 ring-sky-200';
  if (clamped >= 40) return 'bg-[#FFF8F1] text-[#C25E12] ring-1 ring-[#FFD0A3]';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

export function matchRingColor(value: number | null | undefined): string {
  const numeric = value === null || value === undefined || Number.isNaN(value) ? 0 : value;
  const clamped = Math.max(0, Math.min(100, numeric));
  if (clamped >= 80) return '#059669';
  if (clamped >= 60) return '#0B468C';
  if (clamped >= 40) return '#E8872A';
  return '#94A3B8';
}

export function matchScoreTextColor(value: number | null | undefined): string {
  const numeric = value === null || value === undefined || Number.isNaN(value) ? 0 : value;
  const clamped = Math.max(0, Math.min(100, numeric));
  if (clamped >= 80) return '#047857';
  if (clamped >= 60) return '#072348';
  if (clamped >= 40) return '#C25E12';
  return '#64748B';
}
