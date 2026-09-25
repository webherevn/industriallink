/**
 * Đơn vị hành chính Việt Nam theo cải cách từ 01/7/2025
 * (Quyết định 19/2025/QĐ-TTg): 34 tỉnh/thành + cấp xã (xã/phường/đặc khu).
 * Không còn cấp huyện.
 */

/** 34 tỉnh / thành phố trực thuộc trung ương (cấp tỉnh mới). */
export const VN_PROVINCES_2025 = [
  'Thành phố Hà Nội',
  'Tỉnh Cao Bằng',
  'Tỉnh Tuyên Quang',
  'Tỉnh Điện Biên',
  'Tỉnh Lai Châu',
  'Tỉnh Sơn La',
  'Tỉnh Lào Cai',
  'Tỉnh Thái Nguyên',
  'Tỉnh Lạng Sơn',
  'Tỉnh Quảng Ninh',
  'Tỉnh Bắc Ninh',
  'Tỉnh Phú Thọ',
  'Thành phố Hải Phòng',
  'Tỉnh Hưng Yên',
  'Tỉnh Ninh Bình',
  'Tỉnh Thanh Hóa',
  'Tỉnh Nghệ An',
  'Tỉnh Hà Tĩnh',
  'Tỉnh Quảng Trị',
  'Thành phố Huế',
  'Thành phố Đà Nẵng',
  'Tỉnh Quảng Ngãi',
  'Tỉnh Gia Lai',
  'Tỉnh Khánh Hòa',
  'Tỉnh Đắk Lắk',
  'Tỉnh Lâm Đồng',
  'Tỉnh Đồng Nai',
  'Thành phố Hồ Chí Minh',
  'Tỉnh Tây Ninh',
  'Tỉnh Đồng Tháp',
  'Tỉnh Vĩnh Long',
  'Tỉnh An Giang',
  'Thành phố Cần Thơ',
  'Tỉnh Cà Mau',
] as const;

export type VnProvince2025 = (typeof VN_PROVINCES_2025)[number];

export type VnMacroRegion = 'Miền Bắc' | 'Miền Trung' | 'Miền Nam';

/** 34 tỉnh/TP (2025) → 3 miền. Matching Sales khóa bản 34, không dùng 63 tỉnh cũ. */
export const VN_PROVINCE_MACRO_REGION: Record<VnProvince2025, VnMacroRegion> = {
  'Thành phố Hà Nội': 'Miền Bắc',
  'Tỉnh Cao Bằng': 'Miền Bắc',
  'Tỉnh Tuyên Quang': 'Miền Bắc',
  'Tỉnh Điện Biên': 'Miền Bắc',
  'Tỉnh Lai Châu': 'Miền Bắc',
  'Tỉnh Sơn La': 'Miền Bắc',
  'Tỉnh Lào Cai': 'Miền Bắc',
  'Tỉnh Thái Nguyên': 'Miền Bắc',
  'Tỉnh Lạng Sơn': 'Miền Bắc',
  'Tỉnh Quảng Ninh': 'Miền Bắc',
  'Tỉnh Bắc Ninh': 'Miền Bắc',
  'Tỉnh Phú Thọ': 'Miền Bắc',
  'Thành phố Hải Phòng': 'Miền Bắc',
  'Tỉnh Hưng Yên': 'Miền Bắc',
  'Tỉnh Ninh Bình': 'Miền Bắc',
  'Tỉnh Thanh Hóa': 'Miền Trung',
  'Tỉnh Nghệ An': 'Miền Trung',
  'Tỉnh Hà Tĩnh': 'Miền Trung',
  'Tỉnh Quảng Trị': 'Miền Trung',
  'Thành phố Huế': 'Miền Trung',
  'Thành phố Đà Nẵng': 'Miền Trung',
  'Tỉnh Quảng Ngãi': 'Miền Trung',
  'Tỉnh Gia Lai': 'Miền Trung',
  'Tỉnh Khánh Hòa': 'Miền Trung',
  'Tỉnh Đắk Lắk': 'Miền Trung',
  'Tỉnh Lâm Đồng': 'Miền Trung',
  'Tỉnh Đồng Nai': 'Miền Nam',
  'Thành phố Hồ Chí Minh': 'Miền Nam',
  'Tỉnh Tây Ninh': 'Miền Nam',
  'Tỉnh Đồng Tháp': 'Miền Nam',
  'Tỉnh Vĩnh Long': 'Miền Nam',
  'Tỉnh An Giang': 'Miền Nam',
  'Thành phố Cần Thơ': 'Miền Nam',
  'Tỉnh Cà Mau': 'Miền Nam',
};

const VN_PROVINCE_ALIAS: Record<string, VnProvince2025> = {
  'ha noi': 'Thành phố Hà Nội',
  hanoi: 'Thành phố Hà Nội',
  'tp ha noi': 'Thành phố Hà Nội',
  'thanh pho ha noi': 'Thành phố Hà Nội',
  'hai phong': 'Thành phố Hải Phòng',
  'tp hai phong': 'Thành phố Hải Phòng',
  'da nang': 'Thành phố Đà Nẵng',
  'tp da nang': 'Thành phố Đà Nẵng',
  hue: 'Thành phố Huế',
  'tp hue': 'Thành phố Huế',
  'ho chi minh': 'Thành phố Hồ Chí Minh',
  'tp ho chi minh': 'Thành phố Hồ Chí Minh',
  tphcm: 'Thành phố Hồ Chí Minh',
  'tp.hcm': 'Thành phố Hồ Chí Minh',
  'tp hcm': 'Thành phố Hồ Chí Minh',
  'sai gon': 'Thành phố Hồ Chí Minh',
  'can tho': 'Thành phố Cần Thơ',
  'bac ninh': 'Tỉnh Bắc Ninh',
  'bac giang': 'Tỉnh Bắc Ninh',
  'binh duong': 'Thành phố Hồ Chí Minh',
  'long an': 'Tỉnh Tây Ninh',
  'dong nai': 'Tỉnh Đồng Nai',
};

function foldVnPlace(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(tinh|thanh pho|tp\.?)\s+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Chuẩn hoá tên tỉnh/TP về catalog 34 đơn vị (2025). */
export function resolveVnProvince2025(raw: string): VnProvince2025 | null {
  const t = raw.trim();
  if (!t) return null;
  if ((VN_PROVINCES_2025 as readonly string[]).includes(t)) return t as VnProvince2025;
  const folded = foldVnPlace(t);
  if (VN_PROVINCE_ALIAS[folded]) return VN_PROVINCE_ALIAS[folded];
  const hit = VN_PROVINCES_2025.find((p) => foldVnPlace(p) === folded);
  return hit ?? null;
}

export function vnMacroRegionOf(raw: string): VnMacroRegion | null {
  const province = resolveVnProvince2025(raw);
  if (province) return VN_PROVINCE_MACRO_REGION[province];
  const n = foldVnPlace(raw);
  if (n === 'mien bac' || n === 'bac') return 'Miền Bắc';
  if (n === 'mien trung' || n === 'trung') return 'Miền Trung';
  if (n === 'mien nam' || n === 'nam') return 'Miền Nam';
  return null;
}

/** Ghép địa chỉ hiển thị (xã/phường + tỉnh) — bỏ qua phần trống. */
export function formatVnAddress(parts: {
  ward?: string | null;
  province?: string | null;
}): string {
  return [parts.ward, parts.province]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ');
}
