/**
 * Engine tính cấp bậc hoa hồng CTV theo doanh số thực thu/tháng.
 *
 * Mô hình 3 cấp bậc (mặc định):
 *   Cơ bản (BASIC)   0        → < 10.000.000đ   15%
 *   Bạc   (SILVER)  10.000.000đ → < 30.000.000đ  20%
 *   Vàng  (GOLD)    30.000.000đ → không giới hạn 25%
 *
 * Nguyên tắc quan trọng:
 *  - Bậc đạt được trong tháng áp dụng cho TOÀN BỘ doanh thu hợp lệ của tháng,
 *    KHÔNG tính từng đơn một. Đơn nhỏ vẫn nhận tỷ lệ của bậc cả tháng.
 *  - Sang tháng mới bậc reset về 0đ (Cơ bản). Không giữ bậc tháng trước.
 *  - Hoa hồng tính trên doanh thu thực thu CHƯA VAT, sau chiết khấu.
 *  - Tiền là số nguyên VND. Làm tròn nửa lên.
 */

export type CommissionTierCode = 'BASIC' | 'SILVER' | 'GOLD';

export type CommissionTier = {
  code: CommissionTierCode;
  name: string;
  /** Cận dưới (gồm). */
  minMonthlyRevenue: bigint;
  /** Cận trên (không gồm). null = không giới hạn trên. */
  maxMonthlyRevenue: bigint | null;
  /** Tỷ lệ % — số nguyên 0–50. */
  ratePercent: number;
  sortOrder: number;
};

/** Tỷ lệ % hợp lệ. Ngoài khoảng này bị loại. */
export const MIN_TIER_RATE_PERCENT = 0;
export const MAX_TIER_RATE_PERCENT = 50;

/**
 * Sắp xếp bậc theo ngưỡng tăng dần. Bậc đầu tiên min = 0.
 * Bản đảm bảo đã sắp xếp (dùng cho tìm kiếm tuyến tính).
 */
export function sortTiers(tiers: CommissionTier[]): CommissionTier[] {
  return [...tiers].sort((a, b) => {
    if (a.minMonthlyRevenue !== b.minMonthlyRevenue) {
      return a.minMonthlyRevenue < b.minMonthlyRevenue ? -1 : 1;
    }
    return a.sortOrder - b.sortOrder;
  });
}

/**
 * Bậc đạt được cho doanh số `revenue`.
 * Bậc cuối cùng (max = null) là bậc không giới hạn trên.
 * Trả null khi không có bậc nào khớp (chính sách rỗng).
 */
export function resolveTier(
  tiers: CommissionTier[],
  revenue: bigint,
): CommissionTier | null {
  if (tiers.length === 0) return null;
  const sorted = sortTiers(tiers);
  // Bậc cuối cùng không giới hạn trên → luôn là fallback.
  let fallback: CommissionTier | null = null;
  for (const tier of sorted) {
    if (tier.maxMonthlyRevenue === null) {
      fallback = tier;
      if (revenue >= tier.minMonthlyRevenue) return tier;
      continue;
    }
    // Cận dưới gồm, cận trên không gồm.
    if (revenue >= tier.minMonthlyRevenue && revenue < tier.maxMonthlyRevenue) {
      return tier;
    }
  }
  // Doanh số dưới ngưỡng bậc đầu tiên → vẫn dùng bậc đầu tiên (Cơ bản).
  if (sorted[0].minMonthlyRevenue > 0n && revenue < sorted[0].minMonthlyRevenue) {
    return sorted[0];
  }
  return fallback;
}

/**
 * Hoa hồng = doanh thu × tỷ lệ / 100. Làm tròn nửa lên.
 * Tỷ lệ ngoài 0–50 hoặc không phải số nguyên → 0 (không âm, không vượt trần).
 */
export function tierCommissionVnd(revenue: bigint, ratePercent: number): bigint {
  if (revenue <= 0n) return 0n;
  if (!Number.isInteger(ratePercent)) return 0n;
  if (ratePercent < MIN_TIER_RATE_PERCENT || ratePercent > MAX_TIER_RATE_PERCENT) return 0n;
  if (ratePercent === 0) return 0n;
  return (revenue * BigInt(ratePercent) + 50n) / 100n;
}

/** Bậc kế tiếp sau bậc hiện tại (theo ngưỡng tăng dần). Null khi đã đạt bậc cao nhất. */
export function nextTier(tiers: CommissionTier[], current: CommissionTier | null): CommissionTier | null {
  if (tiers.length === 0) return null;
  const sorted = sortTiers(tiers);
  if (!current) return sorted[0] ?? null;
  const index = sorted.findIndex((tier) => tier.code === current.code);
  if (index === -1) return sorted[0] ?? null;
  return sorted[index + 1] ?? null;
}

/**
 * Doanh số cần thêm để lên bậc kế tiếp. 0 khi đã đạt bậc cao nhất.
 */
export function revenueToNextTier(
  tiers: CommissionTier[],
  revenue: bigint,
): { tier: CommissionTier | null; missing: bigint; threshold: bigint | null } {
  const current = resolveTier(tiers, revenue);
  const upcoming = nextTier(tiers, current);
  if (!upcoming) return { tier: null, missing: 0n, threshold: null };
  const threshold = upcoming.minMonthlyRevenue;
  const missing = revenue >= threshold ? 0n : threshold - revenue;
  return { tier: upcoming, missing, threshold };
}

/**
 * Kiểm tra dải ngưỡng của các bậc: liên tục, không chồng chéo, không đứt quãng.
 *
 * Quy tắc:
 *  - Bậc đầu tiên phải có min = 0.
 *  - max của bậc i phải bằng min của bậc i+1 (liên tục, không chồng chéo).
 *  - Bậc cuối cùng phải có max = null (không giới hạn trên).
 *  - Tỷ lệ % trong khoảng 0–50.
 *
 * Trả về danh sách lỗi (rỗng = hợp lệ).
 */
export function validateTiers(tiers: CommissionTier[]): string[] {
  const errors: string[] = [];
  if (tiers.length === 0) {
    errors.push('Cần ít nhất một cấp bậc.');
    return errors;
  }
  const sorted = sortTiers(tiers);

  if (sorted[0].minMonthlyRevenue !== 0n) {
    errors.push('Cấp bậc đầu tiên phải bắt đầu từ 0đ.');
  }

  for (const tier of sorted) {
    if (tier.maxMonthlyRevenue !== null && tier.maxMonthlyRevenue <= tier.minMonthlyRevenue) {
      errors.push(
        `Cấp bậc ${tier.name}: ngưỡng trên phải lớn hơn ngưỡng dưới.`,
      );
    }
    if (!Number.isInteger(tier.ratePercent)) {
      errors.push(`Cấp bậc ${tier.name}: tỷ lệ phải là số nguyên.`);
    } else if (tier.ratePercent < MIN_TIER_RATE_PERCENT || tier.ratePercent > MAX_TIER_RATE_PERCENT) {
      errors.push(
        `Cấp bậc ${tier.name}: tỷ lệ phải từ ${MIN_TIER_RATE_PERCENT}% đến ${MAX_TIER_RATE_PERCENT}%.`,
      );
    }
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const upcoming = sorted[i + 1];
    if (current.maxMonthlyRevenue === null) {
      errors.push(
        `Cấp bậc ${current.name} không giới hạn trên nhưng còn cấp bậc ${upcoming.name} phía sau.`,
      );
      continue;
    }
    if (current.maxMonthlyRevenue !== upcoming.minMonthlyRevenue) {
      errors.push(
        `Khoảng doanh số không liên tục giữa ${current.name} và ${upcoming.name}: ` +
          `trên của ${current.name} phải bằng dưới của ${upcoming.name}.`,
      );
    }
  }

  if (sorted[sorted.length - 1].maxMonthlyRevenue !== null) {
    errors.push('Cấp bậc cuối cùng phải không giới hạn trên (ngưỡng trên = không xác định).');
  }

  return errors;
}

/** Parse chuỗi VND sang bigint. Trả null khi không hợp lệ. */
export function parseVnd(raw: string | number | null | undefined): bigint | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().replace(/[.\s]/g, '');
  if (!/^\d+$/.test(text)) return null;
  try {
    return BigInt(text);
  } catch {
    return null;
  }
}
