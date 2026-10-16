import { paidActivitySummary } from './paid-activity';

describe('paid activity summary', () => {
  it('ghi gói, số tiền và giờ Việt Nam', () => {
    const text = paidActivitySummary({
      kind: 'platform',
      planName: 'Tin đăng',
      planCode: 'TIN_DANG',
      priceVndSnapshot: 1225000n,
      paidAt: new Date('2026-10-16T11:00:00.000Z'),
    });
    expect(text).toContain('Gói tin · Tin đăng');
    expect(text).toContain('1.225.000đ');
    expect(text).toContain('18:00');
    expect(text).toContain('16/10/2026');
  });
});
