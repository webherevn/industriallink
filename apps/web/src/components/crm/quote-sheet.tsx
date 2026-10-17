'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { CrmEmpty, crmButtonClass } from '@/components/crm-frame';
import { errorText, formatVnd } from '@/components/crm/format';
import { acceptCrmQuote, collectCrmInstallment, fetchCrmQuote } from '@/lib/crm';

export function CrmQuoteSheet({ quoteId }: { quoteId: string }) {
  const qc = useQueryClient();
  const quote = useQuery({ queryKey: ['crm-quote', quoteId], queryFn: () => fetchCrmQuote(quoteId) });
  const [error, setError] = useState<string | null>(null);
  const row = quote.data;
  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['crm-quote', quoteId] });
    await qc.invalidateQueries({ queryKey: ['crm-quotes'] });
    await qc.invalidateQueries({ queryKey: ['crm-receivables'] });
    await qc.invalidateQueries({ queryKey: ['crm-workspace'] });
  };
  const accept = useMutation({
    mutationFn: () => acceptCrmQuote(quoteId),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err, 'Không chốt được hợp đồng')),
  });
  const collect = useMutation({
    mutationFn: (installmentId: string) => collectCrmInstallment(quoteId, installmentId),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err, 'Không ghi được đợt đã thu')),
  });

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
          <p className="mt-1 text-sm text-slate-500">{row.quoteCode} · {showDay(row.quotedOn)} · {sheetStatus(row.status)} · {row.ownerName}</p>
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
          {row.quoteKind === 'enterprise' ? (
            <EnterpriseSchedule row={row} pendingId={collect.isPending ? collect.variables ?? null : null} onCollect={(id) => collect.mutate(id)} />
          ) : (
          <>
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
          </>
          )}
          {row.quoteKind === 'enterprise' && row.status !== 'accepted' ? (
            <div className="mt-4 print:hidden">
              <button type="button" className={crmButtonClass} disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending ? 'Đang chốt…' : 'Chốt hợp đồng'}
              </button>
              <p className="mt-2 text-xs text-slate-500">Chốt tờ thì các đợt thành công nợ. Không tạo đơn và không bật gói.</p>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm text-rose-600 print:hidden">{error}</p> : null}
          {row.note ? <p className="mt-6 text-sm leading-relaxed text-slate-600">{row.note}</p> : null}
          <p className="mt-4 text-sm text-slate-600">Người thực hiện: {row.ownerName}</p>
          <p className="mt-6 text-sm text-slate-500">
            {row.vatPercent == null
              ? 'Giá niêm yết chưa gồm VAT. Thuế suất chưa đặt.'
              : `Giá niêm yết chưa gồm VAT ${row.vatPercent}%. Thuế chưa cộng vào số trên tờ.`}
            {row.quoteKind === 'enterprise'
              ? ' Giá trị hợp đồng chưa gồm VAT. Ghi đã thu không bật gói. SuperAdmin kích hoạt Enterprise sau.'
              : ' Khách thanh toán trên inlink. Tờ này không bật gói.'}
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

function EnterpriseSchedule({
  row,
  pendingId,
  onCollect,
}: {
  row: { option1Name: string; option1PriceVnd: string; receivableVnd: string; collectedVnd: string; status: string; installments: Array<{ id: string; label: string; percent: number; amountVnd: string; dueOn: string; status: string }> };
  pendingId: string | null;
  onCollect: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-slate-900">{row.option1Name}</p>
      <p className="mt-1 text-sm text-slate-500">Giá trị hợp đồng {formatVnd(row.option1PriceVnd)} · Đã thu {formatVnd(row.collectedVnd)} · Còn phải thu {formatVnd(row.receivableVnd)}</p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-2">Đợt</th>
            <th className="py-2">Tỉ lệ</th>
            <th className="py-2">Hạn</th>
            <th className="py-2">Số tiền</th>
            <th className="py-2">Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          {row.installments.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="py-2 font-medium text-slate-800">{line.label}</td>
              <td className="py-2 text-slate-600">{line.percent}%</td>
              <td className="py-2 text-slate-600">{showDay(line.dueOn)}</td>
              <td className="py-2 font-semibold text-[#072348]">{formatVnd(line.amountVnd)}</td>
              <td className="py-2 text-slate-600">
                {line.status === 'collected' ? 'Đã thu' : line.status === 'open' ? 'Còn phải thu' : 'Chưa chốt'}
                {line.status === 'open' ? (
                  <button type="button" className="ml-3 text-xs font-semibold text-[#4c3ec9] print:hidden" disabled={pendingId === line.id} onClick={() => onCollect(line.id)}>
                    {pendingId === line.id ? 'Đang ghi…' : 'Ghi đã thu'}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sheetStatus(status: string): string {
  if (status === 'accepted') return 'Đã chốt hợp đồng';
  if (status === 'sent') return 'Đã gửi';
  return 'Bản thảo';
}

function showDay(value: string | null): string {
  if (!value) return '—';
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}/${month}/${year}` : value;
}
