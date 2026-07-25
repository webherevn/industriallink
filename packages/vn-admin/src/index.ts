import districtsOld from './data/districts-old.json';
import provincesNew from './data/provinces-new.json';
import provincesOld from './data/provinces-old.json';
import wardsNew from './data/wards-new.json';
import type {
  AdminMode,
  AdminUnit,
  LocationPickerMode,
  LocationPickerValue,
  LocationSelectionItem,
} from './types';
import { LOCATION_MULTI_SEP, LOCATION_PART_SEP } from './types';

export type {
  AdminMode,
  AdminUnit,
  LocationPickerMode,
  LocationPickerValue,
  LocationSelectionItem,
} from './types';
export { LOCATION_MULTI_SEP, LOCATION_PART_SEP } from './types';

const provincesByMode: Record<AdminMode, AdminUnit[]> = {
  old: provincesOld as AdminUnit[],
  new: provincesNew as AdminUnit[],
};

const childrenByMode: Record<AdminMode, Record<string, AdminUnit[]>> = {
  old: districtsOld as Record<string, AdminUnit[]>,
  new: wardsNew as Record<string, AdminUnit[]>,
};

/** Bỏ dấu + lowercase để tìm kiếm không phân biệt dấu. */
export function searchNormalize(q: string): string {
  return q
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export function listProvinces(mode: AdminMode): AdminUnit[] {
  return provincesByMode[mode];
}

export function listChildren(mode: AdminMode, provinceId: string): AdminUnit[] {
  return childrenByMode[mode][provinceId] ?? [];
}

export function findProvinceByName(mode: AdminMode, name: string): AdminUnit | undefined {
  const n = searchNormalize(name);
  return provincesByMode[mode].find((p) => searchNormalize(p.name) === n);
}

export function filterUnits(units: AdminUnit[], query: string): AdminUnit[] {
  const n = searchNormalize(query);
  if (!n) return units;
  return units.filter((u) => searchNormalize(u.name).includes(n));
}

/** Chuỗi ổn định: `Hà Nội` hoặc `Hà Nội · Ba Đình`. */
export function formatLocationLabel(item: LocationSelectionItem): string {
  const province = item.province.trim();
  const child = item.child?.trim();
  if (!child) return province;
  return `${province}${LOCATION_PART_SEP}${child}`;
}

export function serializeLocationLabels(items: LocationSelectionItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const label = formatLocationLabel(item);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

/** Gộp nhiều địa điểm vào một field `job.location`. */
export function joinLocationLabels(labels: string[]): string {
  return labels.join(LOCATION_MULTI_SEP);
}

export function parseJoinedLocations(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(LOCATION_MULTI_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse label `Tỉnh · Đơn vị` → selection item.
 * Không suy ra mode (cũ/mới) — chỉ tách chuỗi.
 */
export function parseLocationLabel(label: string): LocationSelectionItem {
  const trimmed = label.trim();
  const idx = trimmed.indexOf(LOCATION_PART_SEP);
  if (idx === -1) return { province: trimmed };
  return {
    province: trimmed.slice(0, idx).trim(),
    child: trimmed.slice(idx + LOCATION_PART_SEP.length).trim() || undefined,
  };
}

export function toPickerValue(
  mode: LocationPickerMode,
  labels: string[],
): LocationPickerValue {
  return {
    mode,
    items: labels.map(parseLocationLabel),
  };
}
