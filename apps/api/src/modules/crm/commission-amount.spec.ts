import { commissionVnd } from './commission-amount';

describe('commissionVnd', () => {
  it('nhân tỷ lệ và làm tròn nửa lên', () => {
    expect(commissionVnd(1_000_000n, 10)).toBe(100_000n);
    expect(commissionVnd(150n, 1)).toBe(2n);
    expect(commissionVnd(149n, 1)).toBe(1n);
  });

  it('bỏ qua khi chưa có tỷ lệ, tỷ lệ 0, hoặc đơn 0 đồng', () => {
    expect(commissionVnd(1_000_000n, 0)).toBe(0n);
    expect(commissionVnd(1_000_000n, 31)).toBe(0n);
    expect(commissionVnd(0n, 10)).toBe(0n);
    expect(commissionVnd(-1n, 10)).toBe(0n);
  });
});
