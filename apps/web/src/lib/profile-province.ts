import {
  VN_PROVINCE_MACRO_REGION,
  resolveVnProvince2025,
  vnMacroRegionOf,
  type VnProvince2025,
} from '@industriallink/contracts';

/** Tây Nam Bộ — các tỉnh/TP sau sáp nhập 2025 nằm trong vùng này. */
const SOUTHWEST_PROVINCES: readonly VnProvince2025[] = [
  'Tỉnh Tây Ninh',
  'Tỉnh Đồng Tháp',
  'Tỉnh Vĩnh Long',
  'Tỉnh An Giang',
  'Thành phố Cần Thơ',
  'Tỉnh Cà Mau',
];

/** Tên ngắn trên bộ lọc: Hà Nội, không phải «Thành phố Hà Nội» hay «Hà Nội · Phúc Thọ». */
function shortProvince(name: VnProvince2025): string {
  if (name === 'Thành phố Hồ Chí Minh') return 'TP. Hồ Chí Minh';
  return name.replace(/^(Thành phố|Tỉnh)\s+/, '');
}

/** Tách «Hà Nội · Phúc Thọ» / «Phúc Thọ, Hà Nội» và chỉ giữ tỉnh/TP. */
function collectProvinces(raw: string, into: VnProvince2025[]) {
  const push = (province: VnProvince2025 | null) => {
    if (province && !into.includes(province)) into.push(province);
  };
  const parts = raw
    .split(/\s*[·,;/|]\s*|\s+và\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts.length ? parts : [raw.trim()]) {
    push(resolveVnProvince2025(part));
    if (fold(part).includes('tay nam')) {
      for (const province of SOUTHWEST_PROVINCES) push(province);
    }
  }
}

/** Tỉnh/TP hồ sơ đã chọn. Bỏ xã, phường, quận, huyện và tên trùng. */
export function profileProvinces(locations: string[] | null | undefined): string[] {
  const found: VnProvince2025[] = [];
  for (const item of locations ?? []) {
    if (!item.trim()) continue;
    collectProvinces(item, found);
  }
  return found.map(shortProvince);
}

function isNationwide(location: string): boolean {
  const folded = location
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return folded.includes('toan quoc');
}

function fold(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function provinceOf(raw: string): VnProvince2025 | null {
  return resolveVnProvince2025(raw);
}

/** Một vế địa điểm hồ sơ (vd. "Bắc Ninh" trong "Bắc Ninh / Bắc Giang") có khớp một vế của tin không. */
function placeHits(jobPart: string, selectedPart: string): boolean {
  const jobProvince = provinceOf(jobPart);
  const selectedProvince = provinceOf(selectedPart);
  if (selectedProvince && jobProvince) return selectedProvince === jobProvince;

  const selectedFold = fold(selectedPart);
  if (selectedFold.includes('tay nam')) {
    return jobProvince != null && SOUTHWEST_PROVINCES.includes(jobProvince);
  }

  const selectedRegion = vnMacroRegionOf(selectedPart);
  const selectedIsRegion = Boolean(selectedRegion) && !selectedProvince;
  if (selectedIsRegion) {
    const jobRegion =
      vnMacroRegionOf(jobPart) ?? (jobProvince ? VN_PROVINCE_MACRO_REGION[jobProvince] : null);
    return jobRegion === selectedRegion;
  }

  return fold(jobPart).includes(selectedFold);
}

/** Tin nằm ở một trong các tỉnh/TP hồ sơ đã lưu. */
export function locationMatchesProfile(
  location: string | null | undefined,
  provinces: readonly string[],
): boolean {
  return provinces.some((province) => locationMatchesProvince(location, province));
}

/** Tin khớp tỉnh hồ sơ đã chọn. Tin toàn quốc vẫn hiện vì làm được ở tỉnh đó. */
export function locationMatchesProvince(
  location: string | null | undefined,
  province: string,
): boolean {
  const selected = province.trim();
  if (!selected) return true;
  const raw = (location ?? '').trim();
  if (!raw) return false;
  if (isNationwide(raw) || isNationwide(selected)) return true;
  const alternatives = selected.split('/').map((part) => part.trim()).filter(Boolean);
  const jobParts = raw
    .split(/\s*[·,;/|]\s*|\s+và\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const tokens = jobParts.length ? jobParts : [raw];
  return alternatives.some((alt) => tokens.some((part) => placeHits(part, alt)));
}
