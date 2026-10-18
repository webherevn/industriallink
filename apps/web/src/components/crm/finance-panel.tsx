'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmPaidOrderInvoiceView } from '@industriallink/contracts';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { downloadCsv, errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { collectCrmInstallment, fetchCrmInvoices, fetchCrmReceivables, fetchCrmVat, issueCrmOrderInvoice } from '@/lib/crm';

export function CrmFinancePanel({ initialQuery = '' }: { initialQuery?: string }) {
  const ledger = useQuery({ queryKey: ['crm-invoices'], queryFn: fetchCrmInvoices });
  const vat = useQuery({ queryKey: ['crm-vat'], queryFn: fetchCrmVat });
  const receivables = useQuery({ queryKey: ['crm-receivables'], queryFn: fetchCrmReceivables });
  const vatNote = vat.data?.percent == null
    ? 'Thuế suất chưa đặt. Đơn mới thu đúng giá niêm yết. Công nợ Enterprise ghi phần chưa VAT.'
    : `Thuế suất đang đặt ${vat.data.percent}%. Đơn tạo sau mốc này cộng VAT vào số khách trả. Doanh số vẫn là giá chưa VAT. Công nợ ghi phần chưa VAT.`;
  const [query, setQuery] = useState(initialQuery);
  const orders = (ledger.data?.orders ?? []).filter((order) =>
    matchesQuery(query, [order.companyName, order.planName, order.planCode, order.invoiceNumber]),
  );
  const missing = orders.filter((order) => !order.invoiceNumber).length;

  return (
    <CrmFrame
      kicker="Chứng từ của đơn đã thanh toán trên inlink"
      title="Hóa đơn"
      description="Đơn gói tin và gói Săn đã trả tiền nằm ở sổ hóa đơn. Công nợ là các đợt Enterprise đã chốt, chưa ghi thu. Ghi đã thu không bật gói."
      placeholder="Tìm nhà tuyển dụng, gói hoặc số hóa đơn"
      search={{ value: query, onChange: setQuery }}
      footnote={vatNote}
    >
      <ReceivableBlock rows={receivables.data?.rows ?? []} total={receivables.data?.receivableVnd ?? '0'} loading={receivables.isLoading} />
      {ledger.isLoading ? <CrmEmpty>Đang tải đơn đã thanh toán…</CrmEmpty> : null}
      {ledger.isError ? <CrmEmpty>Không tải được sổ hóa đơn.</CrmEmpty> : null}
      {ledger.data && ledger.data.orders.length === 0 ? (
        <CrmEmpty>Chưa có đơn gói đã thanh toán trong phạm vi bạn xem.</CrmEmpty>
      ) : null}
      {ledger.data && ledger.data.orders.length > 0 && orders.length === 0 ? (
        <CrmEmpty>Không có đơn khớp từ khóa.</CrmEmpty>
      ) : null}
      {ledger.data && orders.length > 0 ? (
        <div className="space-y-4">
          <section className="rounded-[22px] bg-white p-5 crm-surface">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Đơn chưa ghi số</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-[#4c3ec9]">{missing}</p>
                <p className="mt-2 text-sm text-slate-500">{orders.length} đơn đang hiện. Đây là chứng từ, không phải khoản phải thu.</p>
              </div>
              <button type="button" className={crmButtonClass} onClick={() => downloadInvoiceCsv(ledger.data?.orders ?? [])}>
                Tải sổ
              </button>
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            {orders.map((order) => (
              <InvoiceCard key={order.billingOrderId} order={order} />
            ))}
          </div>
        </div>
      ) : null}
    </CrmFrame>
  );
}

function downloadInvoiceCsv(orders: CrmPaidOrderInvoiceView[]) {
  downloadCsv('so-hoa-don.csv', [
    ['Nhà tuyển dụng', 'Loại', 'Gói', 'Chưa VAT', 'VAT %', 'Tiền VAT', 'Khách đã trả', 'Thanh toán lúc', 'Số hóa đơn', 'Ghi lúc'],
    ...orders.map((order) => [
      order.companyName,
      order.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin',
      order.planName ?? order.planCode ?? '',
      order.paidAmountVnd,
      order.vatPercent == null ? 'chưa đặt' : String(order.vatPercent),
      order.vatAmountVnd,
      order.payableVnd,
      order.paidAt,
      order.invoiceNumber ?? '',
      order.invoiceIssuedAt ?? '',
    ]),
  ]);
}

function ReceivableBlock({ rows, total, loading }: { rows: Array<{ id: string; quoteId: string; quoteCode: string; companyName: string; ownerName: string; label: string; percent: number; amountVnd: string; dueOn: string }>; total: string; loading: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const collect = useMutation({
    mutationFn: (row: { quoteId: string; id: string }) => collectCrmInstallment(row.quoteId, row.id),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['crm-receivables'] });
      await qc.invalidateQueries({ queryKey: ['crm-workspace'] });
      await qc.invalidateQueries({ queryKey: ['crm-quotes'] });
    },
    onError: (err) => setError(errorText(err, 'Không ghi được đợt đã thu')),
  });
  return (
    <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
      <div className="border-b border-slate-100 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Công nợ Enterprise</h2>
        <p className="mt-1 text-xs text-slate-400">Còn phải thu {formatVnd(total)}. Ghi đã thu không bật gói.</p>
      </div>
      {loading ? <p className="px-4 py-6 text-sm text-slate-500">Đang tải công nợ…</p> : null}
      {!loading && rows.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Chưa có đợt phải thu.</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Khách hàng</th>
                <th className="whitespace-nowrap px-4 py-3">Báo giá</th>
                <th className="whitespace-nowrap px-4 py-3">Đợt</th>
                <th className="whitespace-nowrap px-4 py-3">Hạn</th>
                <th className="whitespace-nowrap px-4 py-3">Số tiền</th>
                <th className="whitespace-nowrap px-4 py-3">Người phụ trách</th>
                <th className="whitespace-nowrap px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.companyName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#4c3ec9]">{row.quoteCode}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.label} · {row.percent}%</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.dueOn.split('-').reverse().join('/')}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#9a3412]">{formatVnd(row.amountVnd)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.ownerName}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button type="button" className="text-xs font-semibold text-[#4c3ec9]" disabled={collect.isPending} onClick={() => collect.mutate(row)}>Ghi đã thu</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {error ? <p className="px-4 pb-4 text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}

function InvoiceCard({ order }: { order: CrmPaidOrderInvoiceView }) {
  const queryClient = useQueryClient();
  const [number, setNumber] = useState(order.invoiceNumber ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => issueCrmOrderInvoice(order.billingOrderId, { invoiceNumber: number }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['crm-invoices'] });
    },
    onError: (err) => setError(errorText(err, 'Không lưu được số hóa đơn')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <article className="rounded-[22px] bg-white p-5 crm-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{order.companyName}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {order.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}
            {order.planName ? ` · ${order.planName}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            order.invoiceNumber ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {order.invoiceNumber ? 'Đã ghi số' : 'Chưa ghi số'}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Chưa VAT</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatVnd(order.paidAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">{order.vatPercent == null ? 'VAT' : `VAT ${order.vatPercent}%`}</dt>
          <dd className="mt-1 font-medium text-slate-800">{order.vatPercent == null ? 'Chưa đặt' : formatVnd(order.vatAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Khách đã trả</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatVnd(order.payableVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Thanh toán lúc</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatWhen(order.paidAt)}</dd>
        </div>
      </dl>
      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        {order.invoiceIssuedAt ? (
          <p className="text-[11px] text-emerald-700">
            Đã ghi {formatWhen(order.invoiceIssuedAt)}. VAT trên đơn là mức lúc thanh toán.
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">Nhập số hóa đơn đã xuất. Mức VAT giữ theo lúc khách trả, không lấy lại mức đang đặt.</p>
        )}
        <input
          className={crmFieldClass}
          value={number}
          maxLength={64}
          placeholder="Số hóa đơn"
          onChange={(event) => setNumber(event.target.value)}
          required
        />
        <button type="submit" className={crmButtonClass} disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : order.invoiceNumber ? 'Cập nhật số' : 'Ghi hóa đơn'}
        </button>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </form>
    </article>
  );
}
