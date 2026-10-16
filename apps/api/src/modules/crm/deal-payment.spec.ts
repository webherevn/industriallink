import { assignPaidOrders, type DealPaymentSlot, type PaidOrderSlot } from './deal-payment';

const paidAt = new Date('2026-10-01T10:00:00.000Z');

function deal(partial: Partial<DealPaymentSlot> & Pick<DealPaymentSlot, 'id' | 'createdAt'>): DealPaymentSlot {
  return {
    companyId: 'co',
    planKind: 'platform',
    planCode: 'TIN_DANG',
    updatedAt: partial.createdAt,
    stageCode: 'new',
    ...partial,
  };
}

function order(partial: Partial<PaidOrderSlot> & Pick<PaidOrderSlot, 'id' | 'paidAt'>): PaidOrderSlot {
  return {
    companyId: 'co',
    kind: 'platform',
    planCode: 'TIN_DANG',
    ...partial,
  };
}

describe('assign paid orders to deals', () => {
  it('không gán đơn cũ cho deal gia hạn tạo sau', () => {
    const first = deal({ id: 'a', createdAt: new Date('2026-09-01T00:00:00.000Z') });
    const renewal = deal({ id: 'b', createdAt: new Date('2026-10-10T00:00:00.000Z'), updatedAt: new Date('2026-10-10T00:00:00.000Z') });
    const assigned = assignPaidOrders({
      deals: [first, renewal],
      orders: [order({ id: 'o1', paidAt })],
      linkedDealIdByOrderId: new Map(),
    });
    expect(assigned.get('a')?.id).toBe('o1');
    expect(assigned.has('b')).toBe(false);
  });

  it('gắn vào deal chưa mất được cập nhật gần nhất', () => {
    const older = deal({ id: 'a', createdAt: new Date('2026-09-01T00:00:00.000Z'), updatedAt: new Date('2026-09-02T00:00:00.000Z') });
    const newer = deal({ id: 'b', createdAt: new Date('2026-09-15T00:00:00.000Z'), updatedAt: new Date('2026-09-20T00:00:00.000Z') });
    const assigned = assignPaidOrders({
      deals: [older, newer],
      orders: [order({ id: 'o1', paidAt })],
      linkedDealIdByOrderId: new Map(),
    });
    expect(assigned.get('b')?.id).toBe('o1');
    expect(assigned.has('a')).toBe(false);
  });

  it('giữ deal đã ghi trong nhật ký dù deal khác vừa được sửa', () => {
    const logged = deal({ id: 'a', createdAt: new Date('2026-09-01T00:00:00.000Z'), updatedAt: new Date('2026-09-02T00:00:00.000Z') });
    const touched = deal({ id: 'b', createdAt: new Date('2026-09-15T00:00:00.000Z'), updatedAt: new Date('2026-10-16T00:00:00.000Z') });
    const assigned = assignPaidOrders({
      deals: [logged, touched],
      orders: [order({ id: 'o1', paidAt })],
      linkedDealIdByOrderId: new Map([['o1', 'a']]),
    });
    expect(assigned.get('a')?.id).toBe('o1');
    expect(assigned.has('b')).toBe(false);
  });

  it('một deal giữ đơn trả gần nhất', () => {
    const first = deal({ id: 'a', createdAt: new Date('2026-09-01T00:00:00.000Z') });
    const assigned = assignPaidOrders({
      deals: [first],
      orders: [
        order({ id: 'old', paidAt: new Date('2026-09-20T00:00:00.000Z') }),
        order({ id: 'new', paidAt }),
      ],
      linkedDealIdByOrderId: new Map(),
    });
    expect(assigned.get('a')?.id).toBe('new');
  });
});
