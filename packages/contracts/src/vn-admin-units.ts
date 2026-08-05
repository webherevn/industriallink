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
