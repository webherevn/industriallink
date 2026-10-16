/** Dòng nhật ký khi đơn gói đã thanh toán. Không mô tả bước phễu. */
export function paidActivitySummary(order: {
  kind: string;
  planName: string | null;
  planCode: string | null;
  priceVndSnapshot: bigint;
  paidAt: Date;
}): string {
  const kind = order.kind === 'sourcing' ? 'Gói Săn' : 'Gói tin';
  const plan = order.planName?.trim() || order.planCode || 'gói';
  const amount = order.priceVndSnapshot.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const when = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(order.paidAt);
  return `Khách đã thanh toán ${kind} · ${plan}, ${amount}đ, lúc ${when}.`;
}
