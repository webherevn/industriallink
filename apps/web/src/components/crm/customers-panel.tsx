'use client';

import { useQuery } from '@tanstack/react-query';
import type { CrmCustomerStanding, CrmCustomerView } from '@industriallink/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CrmEmpty, CrmFrame, crmActionClass } from '@/components/crm-frame';
import { fetchCrmCustomers } from '@/lib/crm';

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
  const rows = (customers.data ?? []).filter((row) => standing === 'all' || row.standing === standing);

  return (
    <CrmFrame
      kicker="Công ty nhà tuyển dụng"
      title="Sổ khách hàng"
      description="Đang dùng, hết hạn hoặc chưa mua. Bấm hồ sơ để xem gói, credit và đơn đã trả. Sổ này không gán gói."
      placeholder="Tìm tên công ty hoặc mã số thuế"
      search={{ value: query, onChange: setQuery }}
      footnote="Sale chỉ thấy công ty mình phụ trách. Khách chưa gắn công ty vẫn nằm ở Lead."
    >
      <div className="flex flex-wrap justify-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              standing === item.id ? 'bg-[#efeaff] text-[#4c3ec9]' : 'bg-white text-slate-600'
            }`}
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
        <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Công ty</th>
                  <th className="px-4 py-3">Mã số thuế</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Gói đang dùng</th>
                  <th className="px-4 py-3">Phụ trách</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <CustomerRow key={row.companyId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </CrmFrame>
  );
}

function CustomerRow({ row }: { row: CrmCustomerView }) {
  const plans = [row.platformPlanName, row.sourcingPlanName].filter(Boolean).join(' · ');
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-900">{row.companyName}</td>
      <td className="px-4 py-3 text-slate-600">{row.taxCode ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${standingClass(row.standing)}`}>
          {standingLabel(row.standing)}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{plans || '—'}</td>
      <td className="px-4 py-3 text-slate-600">{row.ownerName ?? 'Chưa có'}</td>
      <td className="px-4 py-3 text-right">
        <Link href={`/crm/companies/${row.companyId}`} className={crmActionClass}>
          Hồ sơ
        </Link>
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
