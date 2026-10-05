export function formatMatchPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  // Some backends store score in 0..1, some in 0..100. Normalize.
  const numeric = value <= 1 ? value * 100 : value;
  const clamped = Math.max(0, Math.min(100, numeric));
  return clamped.toFixed(1);
}

export function matchBadgeTone(value: number | null | undefined): string {
  const numeric = value === null || value === undefined || Number.isNaN(value) ? 0 : (value <= 1 ? value * 100 : value);
  const clamped = Math.max(0, Math.min(100, numeric));
  if (clamped >= 80) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (clamped >= 60) return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
  if (clamped >= 40) return 'bg-orange-50 text-orange-700 ring-1 ring-orange-200';
  return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
}

export function matchRingColor(value: number | null | undefined): string {
  const numeric = value === null || value === undefined || Number.isNaN(value) ? 0 : (value <= 1 ? value * 100 : value);
  const clamped = Math.max(0, Math.min(100, numeric));
  if (clamped >= 80) return '#10b981';
  if (clamped >= 60) return '#f59e0b';
  if (clamped >= 40) return '#f97316';
  return '#ef4444';
}
