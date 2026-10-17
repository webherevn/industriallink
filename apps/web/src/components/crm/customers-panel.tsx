'use client';

import { useQuery } from '@tanstack/react-query';
import type { CrmCustomerStanding, CrmCustomerView } from '@industriallink/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CrmEmpty, CrmFrame, crmActionClass } from '@/components/crm-frame';
import { ColumnPicker, RowCheck, crmTableClass, crmTd, filterChipClass, SortableTh, sortRows, stickyCell, stickyCheck, stickyIndex, useColumnSort, useRowSelection, useVisibleColumns } from '@/components/crm/table';
import { fetchCrmCustomers } from '@/lib/crm';

const CUSTOMER_COLUMNS = [
  { key: 'company', label: 'Công ty' },
  { key: 'contact', label: 'Người liên hệ' },
  { key: 'department', label: 'Bộ phận' },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'email', label: 'Email' },
  { key: 'field', label: 'Lĩnh vực' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'tax', label: 'Mã số thuế' },
  { key: 'standing', label: 'Trạng thái' },
  { key: 'plan', label: 'Gói đang dùng' },
  { key: 'owner', label: 'Phụ trách' },
] as const;

type CustomerColumn = (typeof CUSTOMER_COLUMNS)[number]['key'];

const FILTERS: { id: 'all' | CrmCustomerStanding; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang dùng' },
  { id: 'lapsed', label: 'Hết hạn' },
  { id: 'prospect', label: 'Chưa mua' },
];

export function CrmCustomersPanel() {
  const [query, setQuery] = useState('');
  const [needle, setNeedle] = useState('');
  const [standing, setStanding] = useState<(typeof FILTERS)[number]['id']>('all');
  useEffect(() => {
    const timer = window.setTimeout(() => setNeedle(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const customers = useQuery({ queryKey: ['crm-customers', needle], queryFn: () => fetchCrmCustomers(needle) });
  const sort = useColumnSort<'company' | 'contact' | 'department' | 'phone' | 'email' | 'field' | 'tax' | 'standing' | 'owner'>('company');
  const rows = sortRows(
    (customers.data ?? []).filter((row) => standing === 'all' || row.standing === standing),
    sort.dir,
    (row) => {
      if (sort.key === 'company') return row.companyName;
      if (sort.key === 'contact') return row.contactName;
      if (sort.key === 'department') return row.department;
      if (sort.key === 'phone') return row.contactPhone;
      if (sort.key === 'email') return row.contactEmail;
      if (sort.key === 'field') return row.orgField;
      if (sort.key === 'tax') return row.taxCode;
      if (sort.key === 'standing') return standingLabel(row.standing);
      return row.ownerName;
    },
  );
  const columns = useVisibleColumns<CustomerColumn>('crm-cols-customers', CUSTOMER_COLUMNS.map((column) => column.key));
  const pick = useRowSelection();
  const ids = rows.map((row) => row.companyId);
  const selectedCount = ids.filter((id) => pick.has(id)).length;
  const allChecked = ids.length > 0 && selectedCount === ids.length;

  return (
    <CrmFrame
      kicker="Công ty nhà tuyển dụng"
      title="Sổ khách hàng"
      description="Đang dùng, hết hạn hoặc chưa mua. Bấm hồ sơ để xem gói, credit và đơn đã trả. Sổ này không gán gói."
      placeholder="Tìm tên công ty, mã số thuế, người liên hệ hoặc số điện thoại"
      search={{ value: query, onChange: setQuery }}
      footnote="Sale chỉ thấy công ty mình phụ trách. Khách chưa gắn công ty vẫn nằm ở Tiềm năng."
    >
      <div className="flex flex-wrap justify-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filterChipClass(standing === item.id)}
            onClick={() => setStanding(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {customers.isLoading ? <CrmEmpty>Đang tải sổ khách…</CrmEmpty> : null}
      {customers.isError ? <CrmEmpty>Không tải được sổ khách.</CrmEmpty> : null}
      {customers.data && customers.data.length === 0 ? <CrmEmpty>Chưa có công ty trong sổ.</CrmEmpty> : null}
      {customers.data && customers.data.length > 0 && rows.length === 0 ? <CrmEmpty>Không có khách khớp bộ lọc.</CrmEmpty> : null}
      {rows.length > 0 ? (
        <>
          <ColumnPicker columns={CUSTOMER_COLUMNS} shown={columns.shown} onToggle={columns.toggle} onShowAll={columns.showAll} selectedCount={selectedCount} />
          <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
            <div className="overflow-x-auto">
              <table className={crmTableClass}>
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className={stickyCheck}>
                      <RowCheck checked={allChecked} mixed={!allChecked && selectedCount > 0} onChange={() => pick.toggleVisible(ids)} label="Chọn tất cả khách hàng" />
                    </th>
                    <th className={stickyIndex}>STT</th>
                    {columns.shown('company') ? <SortableTh className="sticky left-[6.25rem] z-20 bg-slate-50 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]" label="Công ty" active={sort.key === 'company'} dir={sort.dir} onClick={() => sort.toggle('company')} /> : null}
                    {columns.shown('contact') ? <SortableTh label="Người liên hệ" active={sort.key === 'contact'} dir={sort.dir} onClick={() => sort.toggle('contact')} /> : null}
                    {columns.shown('department') ? <SortableTh label="Bộ phận" active={sort.key === 'department'} dir={sort.dir} onClick={() => sort.toggle('department')} /> : null}
                    {columns.shown('phone') ? <SortableTh label="Điện thoại" active={sort.key === 'phone'} dir={sort.dir} onClick={() => sort.toggle('phone')} /> : null}
                    {columns.shown('email') ? <SortableTh label="Email" active={sort.key === 'email'} dir={sort.dir} onClick={() => sort.toggle('email')} /> : null}
                    {columns.shown('field') ? <SortableTh label="Lĩnh vực" active={sort.key === 'field'} dir={sort.dir} onClick={() => sort.toggle('field')} /> : null}
                    {columns.shown('address') ? <th className="whitespace-nowrap px-4 py-3">Địa chỉ</th> : null}
                    {columns.shown('tax') ? <SortableTh label="Mã số thuế" active={sort.key === 'tax'} dir={sort.dir} onClick={() => sort.toggle('tax')} /> : null}
                    {columns.shown('standing') ? <SortableTh label="Trạng thái" active={sort.key === 'standing'} dir={sort.dir} onClick={() => sort.toggle('standing')} /> : null}
                    {columns.shown('plan') ? <th className="whitespace-nowrap px-4 py-3">Gói đang dùng</th> : null}
                    {columns.shown('owner') ? <SortableTh label="Phụ trách" active={sort.key === 'owner'} dir={sort.dir} onClick={() => sort.toggle('owner')} /> : null}
                    <th className="whitespace-nowrap px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <CustomerRow key={row.companyId} row={row} index={index + 1} picked={pick.has(row.companyId)} shown={columns.shown} onToggle={() => pick.toggle(row.companyId)} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </CrmFrame>
  );
}

function CustomerRow({
  row,
  index,
  picked,
  shown,
  onToggle,
}: {
  row: CrmCustomerView;
  index: number;
  picked: boolean;
  shown: (key: CustomerColumn) => boolean;
  onToggle: () => void;
}) {
  const plans = [row.platformPlanName, row.sourcingPlanName].filter(Boolean).join(' · ');
  return (
    <tr className={`border-t border-slate-100 ${picked ? 'bg-[#f6f4ff]' : ''}`}>
      <td className={stickyCell(picked, 'check')}>
        <RowCheck checked={picked} onChange={onToggle} label={`Chọn ${row.companyName}`} />
      </td>
      <td className={stickyCell(picked, 'index')}>{index}</td>
      {shown('company') ? <td className={`${crmTd} font-medium text-slate-900 ${stickyCell(picked, 'name')}`}>{row.companyName}</td> : null}
      {shown('contact') ? <td className={`${crmTd} text-slate-700`}>{row.contactName ?? '—'}</td> : null}
      {shown('department') ? <td className={`${crmTd} text-slate-600`}>{row.department ?? '—'}</td> : null}
      {shown('phone') ? <td className={`${crmTd} text-slate-600`}>{row.contactPhone ?? '—'}</td> : null}
      {shown('email') ? <td className={`${crmTd} text-slate-600`}>{row.contactEmail ?? '—'}</td> : null}
      {shown('field') ? <td className={`${crmTd} text-slate-600`}>{row.orgField ?? '—'}</td> : null}
      {shown('address') ? <td className={`${crmTd} text-slate-600`}>{row.address ?? '—'}</td> : null}
      {shown('tax') ? <td className={`${crmTd} text-slate-600`}>{row.taxCode ?? '—'}</td> : null}
      {shown('standing') ? (
        <td className={crmTd}>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${standingClass(row.standing)}`}>{standingLabel(row.standing)}</span>
        </td>
      ) : null}
      {shown('plan') ? <td className={`${crmTd} text-slate-600`}>{plans || '—'}</td> : null}
      {shown('owner') ? <td className={`${crmTd} text-slate-600`}>{row.ownerName ?? 'Chưa có'}</td> : null}
      <td className={`${crmTd} text-right`}>
        <Link href={`/crm/companies/${row.companyId}`} className={`${crmActionClass} !whitespace-nowrap`}>Hồ sơ</Link>
      </td>
    </tr>
  );
}

function standingLabel(standing: CrmCustomerStanding): string {
  if (standing === 'active') return 'Đang dùng';
  if (standing === 'lapsed') return 'Hết hạn';
  return 'Chưa mua';
}

function standingClass(standing: CrmCustomerStanding): string {
  if (standing === 'active') return 'bg-emerald-50 text-emerald-800';
  if (standing === 'lapsed') return 'bg-amber-50 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}
