import { payableVnd, vatAmountVnd, type BillingCurrencyDisplay } from '@industriallink/contracts';
import { formatPriceVnd } from '@/lib/format-billing';

export function VatPayLines({
  priceVnd,
  percent,
  currency,
}: {
  priceVnd: string;
  percent: number | null | undefined;
  currency?: BillingCurrencyDisplay;
}) {
  const money = (value: string) => (currency ? formatPriceVnd(value, currency) : `${Number(value).toLocaleString('vi-VN')}đ`);
  if (percent == null) {
    return <p className="mt-1 text-xs text-slate-500">Thuế suất chưa đặt. Thanh toán bằng giá niêm yết.</p>;
  }
  return (
    <div className="mt-2 space-y-0.5 text-xs text-slate-500">
      <p>Chưa VAT {money(priceVnd)}</p>
      <p>VAT {percent}% {money(vatAmountVnd(priceVnd, percent).toString())}</p>
      <p className="font-semibold text-[#072348]">Thanh toán {money(payableVnd(priceVnd, percent).toString())}</p>
    </div>
  );
}
