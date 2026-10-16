'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CrmEmpty } from '@/components/crm-frame';
import { formatVnd, formatWhen } from '@/components/crm/format';
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
        <article className="rounded-[22px] bg-white p-8 text-slate-800 shadow-[0_10px_28px_rgba(91,76,219,0.07)] print:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c3ec9]">inlink</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Bảng chào giá</h1>
          <p className="mt-1 text-sm text-slate-500">{row.quoteCode} · {formatWhen(row.createdAt)} · {row.ownerName}</p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Công ty</dt>
              <dd className="mt-1 font-semibold">{row.companyName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Người nhận</dt>
              <dd className="mt-1 font-semibold">{row.contactName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Mã số thuế</dt>
              <dd className="mt-1">{row.taxCode ?? '—'}</dd>
            </div>
          </dl>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <OptionBox index={1} name={row.option1Name} kind={row.option1Kind} price={row.option1PriceVnd} />
            {row.option2Name && row.option2PriceVnd ? (
              <OptionBox index={2} name={row.option2Name} kind={row.option2Kind ?? 'platform'} price={row.option2PriceVnd} />
            ) : null}
          </div>
          {row.note ? <p className="mt-6 text-sm leading-relaxed text-slate-600">{row.note}</p> : null}
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

function OptionBox({
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
    <section className="rounded-2xl border border-[#e4defc] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#4c3ec9]">Phương án {index}</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">{name}</h2>
      <p className="mt-1 text-sm text-slate-500">{kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}</p>
      <p className="mt-3 text-xl font-bold text-[#072348]">{formatVnd(price)}</p>
    </section>
  );
}
