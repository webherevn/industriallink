'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { ColumnPicker, RowCheck, crmTableClass, crmTd, filterChipClass, SortableTh, sortRows, stickyCell, stickyCheck, stickyIndex, useColumnSort, useRowSelection, useVisibleColumns } from '@/components/crm/table';
import { fetchCrmInvoices } from '@/lib/crm';

const ORDER_COLUMNS = [
  { key: 'company', label: 'Công ty' },
  { key: 'kind', label: 'Loại' },
  { key: 'plan', label: 'Gói' },
  { key: 'amount', label: 'Số tiền' },
  { key: 'paid', label: 'Ngày trả' },
] as const;

type OrderColumn = (typeof ORDER_COLUMNS)[number]['key'];

export function CrmOrdersPanel() {
  const ledger = useQuery({ queryKey: ['crm-invoices'], queryFn: fetchCrmInvoices });
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'platform' | 'sourcing'>('all');
  const sort = useColumnSort<OrderColumn>('paid', 'desc');
  const columns = useVisibleColumns<OrderColumn>('crm-cols-orders', ORDER_COLUMNS.map((column) => column.key));
  const pick = useRowSelection();
  const orders = sortRows(
    (ledger.data?.orders ?? []).filter((order) => kind === 'all' || order.orderKind === kind).filter((order) =>
      matchesQuery(query, [order.companyName, order.planName, order.planCode]),
    ),
    sort.dir,
    (order) => {
      if (sort.key === 'company') return order.companyName;
      if (sort.key === 'kind') return order.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin';
      if (sort.key === 'plan') return order.planName ?? order.planCode;
      if (sort.key === 'amount') return Number(order.paidAmountVnd);
      return order.paidAt;
    },
  );

  return (
    <CrmFrame
      kicker="Đơn khách đã thanh toán trên inlink"
      title="Đơn hàng"
      description="Gói tin và gói Săn đã trả, giá lớn hơn 0, chưa VAT. CRM không lập đơn này."
      placeholder="Tìm nhà tuyển dụng hoặc tên gói"
      search={{ value: query, onChange: setQuery }}
      footnote="Số hóa đơn ghi ở mục Hóa đơn. Đơn này không bật gói và không ghi hoa hồng."
    >
      {ledger.isLoading ? <CrmEmpty>Đang tải đơn hàng…</CrmEmpty> : null}
      {ledger.isError ? <CrmEmpty>Không tải được đơn hàng.</CrmEmpty> : null}
      {ledger.data && ledger.data.orders.length === 0 ? <CrmEmpty>Chưa có đơn đã thanh toán trong phạm vi bạn xem.</CrmEmpty> : null}
      {ledger.data && ledger.data.orders.length > 0 && orders.length === 0 ? <CrmEmpty>Không có đơn khớp từ khóa.</CrmEmpty> : null}
      {ledger.data && ledger.data.orders.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {([['all', 'Tất cả'], ['platform', 'Gói tin'], ['sourcing', 'Gói Săn']] as const).map(([id, label]) => (
            <button key={id} type="button" className={filterChipClass(kind === id)} onClick={() => setKind(id)}>{label}</button>
          ))}
        </div>
      ) : null}
      {orders.length > 0 ? (
        <>
          <ColumnPicker
            columns={ORDER_COLUMNS}
            shown={columns.shown}
            onToggle={columns.toggle}
            onShowAll={columns.showAll}
            selectedCount={orders.filter((order) => pick.has(order.billingOrderId)).length}
          />
          <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
            <div className="overflow-x-auto">
              <table className={crmTableClass}>
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className={stickyCheck}>
                      <RowCheck
                        checked={orders.every((order) => pick.has(order.billingOrderId))}
                        mixed={orders.some((order) => pick.has(order.billingOrderId)) && !orders.every((order) => pick.has(order.billingOrderId))}
                        onChange={() => pick.toggleVisible(orders.map((order) => order.billingOrderId))}
                        label="Chọn tất cả đơn hàng"
                      />
                    </th>
                    <th className={stickyIndex}>STT</th>
                    {columns.shown('company') ? <SortableTh className="sticky left-[6.25rem] z-20 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]" label="Công ty" active={sort.key === 'company'} dir={sort.dir} onClick={() => sort.toggle('company')} /> : null}
                    {columns.shown('kind') ? <SortableTh label="Loại" active={sort.key === 'kind'} dir={sort.dir} onClick={() => sort.toggle('kind')} /> : null}
                    {columns.shown('plan') ? <SortableTh label="Gói" active={sort.key === 'plan'} dir={sort.dir} onClick={() => sort.toggle('plan')} /> : null}
                    {columns.shown('amount') ? <SortableTh label="Số tiền" active={sort.key === 'amount'} dir={sort.dir} onClick={() => sort.toggle('amount')} /> : null}
                    {columns.shown('paid') ? <SortableTh label="Ngày trả" active={sort.key === 'paid'} dir={sort.dir} onClick={() => sort.toggle('paid')} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const picked = pick.has(order.billingOrderId);
                    return (
                      <tr key={order.billingOrderId} className={picked ? 'bg-[#f6f4ff]' : ''}>
                        <td className={stickyCell(picked, 'check')}><RowCheck checked={picked} onChange={() => pick.toggle(order.billingOrderId)} label={`Chọn ${order.companyName}`} /></td>
                        <td className={stickyCell(picked, 'index')}>{index + 1}</td>
                        {columns.shown('company') ? <td className={`${crmTd} font-medium ${stickyCell(picked, 'name')}`}><Link href={`/crm/companies/${order.companyId}`} className="text-[#4c3ec9]">{order.companyName}</Link></td> : null}
                        {columns.shown('kind') ? <td className={`${crmTd} text-slate-600`}>{order.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}</td> : null}
                        {columns.shown('plan') ? <td className={`${crmTd} text-slate-700`}>{order.planName ?? order.planCode ?? 'Gói'}</td> : null}
                        {columns.shown('amount') ? <td className={`${crmTd} text-slate-700`}>{formatVnd(order.paidAmountVnd)}</td> : null}
                        {columns.shown('paid') ? <td className={`${crmTd} text-slate-600`}>{formatWhen(order.paidAt)}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </CrmFrame>
  );
}
