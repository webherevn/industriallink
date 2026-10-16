/** Deal đã tồn tại lúc khách trả tiền. Deal tạo sau không nhận đơn cũ. */
export type DealPaymentSlot = {
  id: string;
  companyId: string | null;
  planKind: string | null;
  planCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  stageCode: string;
};

export type PaidOrderSlot = {
  id: string;
  companyId: string;
  kind: string;
  planCode: string | null;
  paidAt: Date;
};

/** Deal không mất, cập nhật gần nhất. Không có thì nhận deal còn lại. */
export function pickDealForPayment<T extends { id: string; updatedAt: Date; stageCode: string }>(
  deals: T[],
): T | undefined {
  if (deals.length === 0) return undefined;
  const sorted = [...deals].sort((a, b) => {
    const time = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (time !== 0) return time;
    return a.id < b.id ? -1 : 1;
  });
  return sorted.find((deal) => deal.stageCode !== 'lost') ?? sorted[0];
}

/**
 * Mỗi đơn gắn một deal. Nhật ký đã ghi thì giữ đúng deal đó.
 * Đơn chưa có nhật ký chỉ gắn deal đã mở trước hoặc đúng lúc thanh toán.
 */
export function assignPaidOrders<T extends PaidOrderSlot>(input: {
  deals: DealPaymentSlot[];
  orders: T[];
  linkedDealIdByOrderId: ReadonlyMap<string, string>;
}): Map<string, T> {
  const result = new Map<string, T>();
  const orders = [...input.orders].sort((a, b) => {
    const time = b.paidAt.getTime() - a.paidAt.getTime();
    if (time !== 0) return time;
    return a.id < b.id ? -1 : 1;
  });
  for (const order of orders) {
    if (!order.planCode) continue;
    const linked = input.linkedDealIdByOrderId.get(order.id);
    if (linked) {
      if (!result.has(linked)) result.set(linked, order);
      continue;
    }
    const open = input.deals.filter(
      (deal) =>
        deal.companyId === order.companyId &&
        deal.planKind === order.kind &&
        deal.planCode === order.planCode &&
        deal.createdAt.getTime() <= order.paidAt.getTime(),
    );
    const target = pickDealForPayment(open);
    if (!target || result.has(target.id)) continue;
    result.set(target.id, order);
  }
  return result;
}
