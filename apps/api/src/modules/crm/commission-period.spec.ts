import {
  groupCommissionClose,
  previousVietnamPeriodMonth,
  vietnamMonthBounds,
  vietnamPeriodMonth,
} from './commission-period';

describe('commission period month', () => {
  it('tháng 10 tính từ 00:00 ngày 1 đến trước 00:00 ngày 1 tháng sau, giờ Việt Nam', () => {
    const bounds = vietnamMonthBounds('2026-10');
    expect(bounds?.start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(bounds?.end.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(vietnamPeriodMonth(new Date('2026-10-31T16:59:59.000Z'))).toBe('2026-10');
    expect(vietnamPeriodMonth(new Date('2026-10-31T17:00:00.000Z'))).toBe('2026-11');
  });

  it('tháng 2 nhuận kết thúc ngày 29', () => {
    const bounds = vietnamMonthBounds('2024-02');
    expect(bounds?.start.toISOString()).toBe('2024-01-31T17:00:00.000Z');
    expect(bounds?.end.toISOString()).toBe('2024-02-29T17:00:00.000Z');
  });

  it('bỏ tháng không hợp lệ', () => {
    expect(vietnamMonthBounds('2026-13')).toBeNull();
    expect(vietnamMonthBounds('10-2026')).toBeNull();
  });

  it('tháng liền trước tính theo giờ Việt Nam', () => {
    expect(previousVietnamPeriodMonth(new Date('2026-10-01T00:00:00.000Z'))).toBe('2026-09');
    expect(previousVietnamPeriodMonth(new Date('2026-02-28T17:00:00.000Z'))).toBe('2026-02');
  });

  it('cộng riêng từng cộng tác viên', () => {
    const groups = groupCommissionClose([
      { id: 'a', partnerId: 'p1', paidAmountVnd: 100n, commissionVnd: 25n },
      { id: 'b', partnerId: 'p1', paidAmountVnd: 40n, commissionVnd: 10n },
      { id: 'c', partnerId: 'p2', paidAmountVnd: 80n, commissionVnd: 20n },
    ]);
    expect(groups).toEqual([
      { partnerId: 'p1', ids: ['a', 'b'], paidAmountVnd: 140n, commissionVnd: 35n, entryCount: 2 },
      { partnerId: 'p2', ids: ['c'], paidAmountVnd: 80n, commissionVnd: 20n, entryCount: 1 },
    ]);
  });
});
