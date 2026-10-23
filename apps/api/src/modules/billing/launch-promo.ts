/**
 * Khuyến mại ra mắt V7. Giá trong bảng giá vẫn là giá niêm yết chưa VAT.
 * Khi chiến dịch đang mở, trang giá và đơn thanh toán dùng giá sau giảm.
 * Ngày bắt đầu lấy mốc triển khai bảng giá; hết hạn đúng 12 tháng sau.
 */
export const LAUNCH_PROMO = {
  code: 'RA_MAT_V7',
  startsAt: new Date('2026-10-23T00:00:00+07:00'),
  endsAt: new Date('2027-10-23T00:00:00+07:00'),
};

const PLATFORM_HALF = new Set(['TIN_DANG', 'TIN_DANG_PLUS', 'DOANH_NGHIEP']);
const SOURCING_THIRTY = new Set(['SAN_CO_BAN', 'SAN_TIEU_CHUAN', 'SAN_CHUYEN_SAU']);

export function launchPromoFor(
  kind: 'platform' | 'sourcing',
  code: string,
  now = new Date(),
): { percent: number; label: string | null; code: string | null } {
  if (now < LAUNCH_PROMO.startsAt || now >= LAUNCH_PROMO.endsAt) {
    return { percent: 0, label: null, code: null };
  }
  if (kind === 'platform' && PLATFORM_HALF.has(code)) {
    return { percent: 50, label: 'Giảm 50% ra mắt', code: LAUNCH_PROMO.code };
  }
  if (kind === 'sourcing' && SOURCING_THIRTY.has(code)) {
    return { percent: 30, label: 'Giảm 30% ra mắt', code: LAUNCH_PROMO.code };
  }
  return { percent: 0, label: null, code: null };
}

/** Giá chưa VAT sau giảm, làm tròn đồng. 0% thì giữ nguyên giá niêm yết. */
export function applyLaunchPromo(listPrice: bigint, percent: number): bigint {
  if (percent <= 0 || percent >= 100) return listPrice;
  return (listPrice * BigInt(100 - percent) + 50n) / 100n;
}
