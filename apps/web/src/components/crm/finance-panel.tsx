'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmPaidOrderInvoiceView } from '@industriallink/contracts';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { fetchCrmInvoices, issueCrmOrderInvoice } from '@/lib/crm';

export function CrmFinancePanel({ initialQuery = '' }: { initialQuery?: string }) {
  const ledger = useQuery({ queryKey: ['crm-invoices'], queryFn: fetchCrmInvoices });
  const [query, setQuery] = useState(initialQuery);
  const orders = (ledger.data?.orders ?? []).filter((order) =>
    matchesQuery(query, [order.companyName, order.planName, order.planCode, order.invoiceNumber]),
  );
  const missing = orders.filter((order) => !order.invoiceNumber).length;

  return (
    <CrmFrame
      kicker="Chứng từ của đơn đã thanh toán trên inlink"
      title="Hóa đơn"
      description="Chỉ đơn gói tin và gói Săn đã trả tiền. Giá là số đã thanh toán, chưa VAT. Ghi số không thu thêm và không bật gói."
      placeholder="Tìm nhà tuyển dụng, gói hoặc số hóa đơn"
      search={{ value: query, onChange: setQuery }}
      footnote="Chưa tính thuế suất. Không có công nợ."
    >
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
          <section className="rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Đơn chưa ghi số</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-[#4c3ec9]">{missing}</p>
            <p className="mt-2 text-sm text-slate-500">{orders.length} đơn đang hiện. Đây là chứng từ, không phải khoản phải thu.</p>
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
    <article className="rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
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
          <dt className="text-xs text-slate-400">Đã thanh toán</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatVnd(order.paidAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Thanh toán lúc</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatWhen(order.paidAt)}</dd>
        </div>
      </dl>
      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        {order.invoiceIssuedAt ? (
          <p className="text-[11px] text-emerald-700">Đã ghi {formatWhen(order.invoiceIssuedAt)}</p>
        ) : (
          <p className="text-[11px] text-slate-400">Nhập số hóa đơn đã xuất cho đơn này</p>
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
