'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { fetchCrmCommissionPeriods } from '@/lib/crm';

export function CrmAccountingPanel() {
  const periods = useQuery({ queryKey: ['crm-commission-periods'], queryFn: fetchCrmCommissionPeriods });
  const [query, setQuery] = useState('');
  const payable = (periods.data?.periods ?? []).filter((period) => period.status === 'payable');
  const rows = payable.filter((period) =>
    matchesQuery(query, [period.partnerName, period.partnerCode, period.periodMonth, formatPeriodLabel(period.periodMonth)]),
  );

  return (
    <CrmFrame
      kicker="Kỳ đã được phép chi"
      title="Kế toán"
      description="SuperAdmin đã cho phép chi các kỳ này. Số dư ví trên inlink chưa trừ. Kế toán xử lý chi trả bên ngoài sổ này."
      placeholder="Tìm cộng tác viên hoặc tháng"
      search={{ value: query, onChange: setQuery }}
      footnote="Danh sách này là hàng chờ chi. Chưa ghi nhận đã chuyển khoản."
    >
      {periods.isLoading ? <CrmEmpty>Đang tải kỳ chờ chi…</CrmEmpty> : null}
      {periods.isError ? <CrmEmpty>Không tải được danh sách kế toán.</CrmEmpty> : null}
      {periods.data && payable.length === 0 ? (
        <CrmEmpty>Chưa có kỳ nào được phép chi. Cho phép chi từ mục Kỳ chốt.</CrmEmpty>
      ) : null}
      {periods.data && payable.length > 0 && rows.length === 0 ? (
        <CrmEmpty>Không có kỳ khớp từ khóa.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((period) => (
            <article key={period.id} className="rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900">{period.partnerName}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {period.partnerCode} · {formatPeriodLabel(period.periodMonth)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Chờ chi</span>
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight text-[#4c3ec9]">{formatVnd(period.commissionVnd)}</p>
              <p className="mt-1 text-sm text-slate-500">Khách đã trả {formatVnd(period.paidAmountVnd)} · {period.entryCount} khoản</p>
              <p className="mt-4 text-xs text-slate-400">
                Cho phép chi {period.approvedAt ? formatWhen(period.approvedAt) : '—'}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </CrmFrame>
  );
}

function formatPeriodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  if (!year || !month) return periodMonth;
  return `tháng ${Number(month)}/${year}`;
}
