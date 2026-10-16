import { DEFAULT_PAYOUT_DAY, payoutDayOrDefault } from './commission-payout-day';

describe('payoutDayOrDefault', () => {
  it('giữ ngày hợp lệ trong tháng ngắn nhất', () => {
    expect(payoutDayOrDefault(1)).toBe(1);
    expect(payoutDayOrDefault(10)).toBe(10);
    expect(payoutDayOrDefault(28)).toBe(28);
  });

  it('về mùng 10 khi chưa đặt hoặc ngày không có ở mọi tháng', () => {
    expect(payoutDayOrDefault(null)).toBe(DEFAULT_PAYOUT_DAY);
    expect(payoutDayOrDefault(undefined)).toBe(DEFAULT_PAYOUT_DAY);
    expect(payoutDayOrDefault(0)).toBe(DEFAULT_PAYOUT_DAY);
    expect(payoutDayOrDefault(29)).toBe(DEFAULT_PAYOUT_DAY);
    expect(payoutDayOrDefault(31)).toBe(DEFAULT_PAYOUT_DAY);
    expect(payoutDayOrDefault(10.5)).toBe(DEFAULT_PAYOUT_DAY);
  });
});
