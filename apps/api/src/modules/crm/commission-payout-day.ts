export const PAYOUT_DAY_MIN = 1;
export const PAYOUT_DAY_MAX = 28;
export const DEFAULT_PAYOUT_DAY = 10;

/** Ngày 1–28 để tháng nào cũng có, kể cả tháng 2. Ngoài khoảng thì dùng mùng 10. */
export function payoutDayOrDefault(day: number | null | undefined): number {
  if (typeof day === 'number' && Number.isInteger(day) && day >= PAYOUT_DAY_MIN && day <= PAYOUT_DAY_MAX) {
    return day;
  }
  return DEFAULT_PAYOUT_DAY;
}
