'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CrmEmpty } from '@/components/crm-frame';
import { formatVnd } from '@/components/crm/format';
import { fetchCrmQuote } from '@/lib/crm';

export function CrmQuoteSheet({ quoteId }: { quoteId: string }) {
  const quote = useQuery({ queryKey: ['crm-quote', quoteId], queryFn: () => fetchCrmQuote(quoteId) });
  const row = quote.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/crm/quotes" className="text-sm font-semibold text-[#4c3ec9]">
          Về danh sách
        </Link>
        <button
          type="button"
          className="rounded-xl bg-[#072348] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => window.print()}
        >
          Xuất PDF
        </button>
      </div>
      {quote.isLoading ? <CrmEmpty>Đang tải báo giá…</CrmEmpty> : null}
      {quote.isError ? <CrmEmpty>Không tải được báo giá.</CrmEmpty> : null}
      {row ? (
        <article className="rounded-[22px] bg-white p-8 text-slate-800 crm-surface print:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c3ec9]">inlink</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Bảng chào giá</h1>
          <p className="mt-1 text-sm text-slate-500">{row.quoteCode} · {showDay(row.quotedOn)} · {row.status === 'sent' ? 'Đã gửi' : 'Bản thảo'} · {row.ownerName}</p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Khách hàng</dt>
              <dd className="mt-1 font-semibold">{row.companyName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Liên hệ</dt>
              <dd className="mt-1 font-semibold">{row.contactName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Mã số thuế</dt>
              <dd className="mt-1">{row.taxCode ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Địa chỉ</dt>
              <dd className="mt-1">{row.address ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Hiệu lực đến ngày</dt>
              <dd className="mt-1">{showDay(row.validUntil)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Cơ hội</dt>
              <dd className="mt-1">{row.dealTitle ? `${row.dealTitle} · ${row.dealCode}` : '—'}</dd>
            </div>
          </dl>
          <table className="mt-6 w-full text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2">STT</th>
                <th className="py-2">Gói</th>
                <th className="py-2">Đơn vị</th>
                <th className="py-2">Số lượng</th>
                <th className="py-2">Đơn giá</th>
                <th className="py-2">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <SheetLine index={1} name={row.option1Name} kind={row.option1Kind} price={row.option1PriceVnd} />
              {row.option2Name && row.option2PriceVnd ? (
                <SheetLine index={2} name={row.option2Name} kind={row.option2Kind ?? 'platform'} price={row.option2PriceVnd} />
              ) : null}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">Hai dòng là hai phương án. Khách chọn một. Không cộng hai thành tiền.</p>
          {row.note ? <p className="mt-6 text-sm leading-relaxed text-slate-600">{row.note}</p> : null}
          <p className="mt-4 text-sm text-slate-600">Người thực hiện: {row.ownerName}</p>
          <p className="mt-6 text-sm text-slate-500">
            {row.vatPercent == null
              ? 'Giá niêm yết chưa gồm VAT. Thuế suất chưa đặt.'
              : `Giá niêm yết chưa gồm VAT ${row.vatPercent}%. Thuế chưa cộng vào số trên tờ.`}
            {' '}Khách thanh toán trên inlink. Tờ này không bật gói.
          </p>
        </article>
      ) : null}
    </div>
  );
}

function SheetLine({
  index,
  name,
  kind,
  price,
}: {
  index: number;
  name: string;
  kind: 'platform' | 'sourcing';
  price: string;
}) {
  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 text-slate-500">{index}</td>
      <td className="py-2">
        <span className="font-semibold text-slate-900">{name}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}</span>
      </td>
      <td className="py-2 text-slate-500">Gói</td>
      <td className="py-2 text-slate-500">1</td>
      <td className="py-2">{formatVnd(price)}</td>
      <td className="py-2 font-semibold text-[#072348]">{formatVnd(price)}</td>
    </tr>
  );
}

function showDay(value: string | null): string {
  if (!value) return '—';
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}/${month}/${year}` : value;
}
