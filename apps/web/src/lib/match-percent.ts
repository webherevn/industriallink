/**
 * Định dạng điểm % phù hợp.
 *
 * ⭐ Ngưỡng chuẩn (nguồn sự thật duy nhất — xem `match-fit-label.ts`):
 *   >= 80%        → Rất phù hợp    (xanh lá)
 *   60% – 79.9%   → Khá phù hợp   (xanh dương)
 *   40% – 59.9%   → Cân nhắc       (vàng cam)
 *   < 40%          → Độ phù hợp thấp (đỏ nhạt)
 */

export function formatMatchPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  const clamped = Math.max(0, Math.min(100, value));
  return clamped.toFixed(1);
}

export function matchBadgeTone(value: number | null | undefined): string {
  const numeric = value === null || value === undefined || Number.isNaN(value) ? 0 : value;
  const clamped = Math.max(0, Math.min(100, numeric));
  if (clamped >= 80) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (clamped >= 60) return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
  if (clamped >= 40) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

export function matchRingColor(value: number | null | undefined): string {
  const numeric = value === null || value === undefined || Number.isNaN(value) ? 0 : value;
  const clamped = Math.max(0, Math.min(100, numeric));
  if (clamped >= 80) return '#10b981';
  if (clamped >= 60) return '#0ea5e9';
  if (clamped >= 40) return '#f59e0b';
  return '#94a3b8';
}
