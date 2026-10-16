'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CrmCommissionPeriodView } from '@industriallink/contracts';
import { CrmEmpty, CrmFrame, crmButtonClass } from '@/components/crm-frame';
import { errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { fetchCrmCommissionPeriods, fetchCrmPayoutDay, markCrmCommissionPaid } from '@/lib/crm';

export function CrmAccountingPanel() {
  const periods = useQuery({ queryKey: ['crm-commission-periods'], queryFn: fetchCrmCommissionPeriods });
  const payout = useQuery({ queryKey: ['crm-payout-day'], queryFn: fetchCrmPayoutDay });
  const [query, setQuery] = useState('');
  const all = periods.data?.periods ?? [];
  const payable = all.filter((period) => period.status === 'payable');
  const paid = all.filter((period) => period.status === 'paid');
  const waiting = payable.filter((period) => matches(query, period));
  const settled = paid.filter((period) => matches(query, period));
  const rows = [...waiting, ...settled];

  return (
    <CrmFrame
      kicker="Kỳ đã được phép chi"
      title="Kế toán"
      description="Bảng kê để chuyển khoản bằng tay. Ghi đã chi thì trừ đúng số hoa hồng của kỳ khỏi ví trên inlink. Không gửi lệnh sang ngân hàng."
      placeholder="Tìm cộng tác viên hoặc tháng"
      search={{ value: query, onChange: setQuery }}
      footnote="Bảng kê không phải lệnh chuyển khoản. Đã chi chỉ ghi trên sổ và trừ ví."
    >
      {payout.data ? (
        <p className="text-center text-sm text-slate-500">
          Ngày chi đang đặt: ngày {payout.data.day} hàng tháng. Đến ngày đó kế toán ghi đã chi. Ví không tự trừ.
        </p>
      ) : null}
      {periods.isLoading ? <CrmEmpty>Đang tải kỳ chờ chi…</CrmEmpty> : null}
      {periods.isError ? <CrmEmpty>Không tải được danh sách kế toán.</CrmEmpty> : null}
      {periods.data && payable.length === 0 && paid.length === 0 ? (
        <CrmEmpty>Chưa có kỳ nào được phép chi. Cho phép chi từ mục Kỳ chốt.</CrmEmpty>
      ) : null}
      {periods.data && (payable.length > 0 || paid.length > 0) && waiting.length === 0 && settled.length === 0 ? (
        <CrmEmpty>Không có kỳ khớp từ khóa.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? <Register rows={rows} canPay={Boolean(periods.data?.canClose)} /> : null}
    </CrmFrame>
  );
}

function Register({ rows, canPay }: { rows: CrmCommissionPeriodView[]; canPay: boolean }) {
  const waitingTotal = rows
    .filter((period) => period.status === 'payable')
    .reduce((sum, period) => sum + BigInt(period.commissionVnd || '0'), 0n);
  return (
    <section className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
      <div className="border-b border-slate-100 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900">Bảng kê</h2>
        <p className="mt-1 text-sm text-slate-500">
          Chờ chi {formatVnd(waitingTotal.toString())}. Dùng bảng này để chuyển khoản bên ngoài. Nút Đã chi chỉ trừ ví trên inlink.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Cộng tác viên</th>
              <th className="px-4 py-3">Tháng</th>
              <th className="px-4 py-3">Hoa hồng</th>
              <th className="px-4 py-3">Khách đã trả</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thời điểm</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((period) => (
              <RegisterRow key={period.id} period={period} canPay={canPay} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RegisterRow({ period, canPay }: { period: CrmCommissionPeriodView; canPay: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const pay = useMutation({
    mutationFn: () => markCrmCommissionPaid(period.id),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['crm-commission-periods'] });
      await qc.invalidateQueries({ queryKey: ['crm-partners'] });
    },
    onError: (err) => setError(errorText(err, 'Không ghi được đã chi')),
  });

  const paid = period.status === 'paid';
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{period.partnerName}</p>
        <p className="mt-0.5 text-xs text-slate-400">{period.partnerCode}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{formatPeriodLabel(period.periodMonth)}</td>
      <td className="px-4 py-3 font-semibold text-[#4c3ec9]">{formatVnd(period.commissionVnd)}</td>
      <td className="px-4 py-3 text-slate-700">{formatVnd(period.paidAmountVnd)}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paid ? 'bg-[#efeaff] text-[#4c3ec9]' : 'bg-emerald-50 text-emerald-800'}`}>
          {paid ? 'Đã chi' : 'Chờ chi'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {paid ? `Đã chi ${period.paidAt ? formatWhen(period.paidAt) : '—'}` : `Cho phép chi ${period.approvedAt ? formatWhen(period.approvedAt) : '—'}`}
      </td>
      <td className="px-4 py-3">
        {canPay && !paid ? (
          <button type="button" className={crmButtonClass} disabled={pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending ? 'Đang ghi…' : 'Đã chi'}
          </button>
        ) : null}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      </td>
    </tr>
  );
}

function matches(query: string, period: CrmCommissionPeriodView): boolean {
  return matchesQuery(query, [period.partnerName, period.partnerCode, period.periodMonth, formatPeriodLabel(period.periodMonth)]);
}

function formatPeriodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  if (!year || !month) return periodMonth;
  return `tháng ${Number(month)}/${year}`;
}
