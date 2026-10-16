'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass } from '@/components/crm-frame';
import { CrmMonthField } from '@/components/crm/fields';
import { errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import type { CrmCommissionPeriodView } from '@industriallink/contracts';
import { allowCrmCommissionPayout, closeCrmCommissionMonth, fetchCrmCommissionPeriods } from '@/lib/crm';

export function CrmPeriodsPanel() {
  const qc = useQueryClient();
  const periods = useQuery({ queryKey: ['crm-commission-periods'], queryFn: fetchCrmCommissionPeriods });
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(previousVietnamPeriodMonth);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const rows = (periods.data?.periods ?? []).filter((period) =>
    matchesQuery(query, [period.partnerName, period.partnerCode, period.periodMonth, formatPeriodLabel(period.periodMonth)]),
  );

  const closeMonth = useMutation({
    mutationFn: () => closeCrmCommissionMonth({ periodMonth: month }),
    onSuccess: async (result) => {
      setError(null);
      setNotice(`Đã chốt ${result.closedCount} cộng tác viên cho ${formatPeriodLabel(month)}.`);
      qc.setQueryData(['crm-commission-periods'], { periods: result.periods, canClose: result.canClose });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['crm-commissions'] }),
        qc.invalidateQueries({ queryKey: ['crm-partners'] }),
      ]);
    },
    onError: (err) => {
      setNotice(null);
      setError(errorText(err, 'Không chốt được kỳ'));
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    closeMonth.mutate();
  }

  return (
    <CrmFrame
      kicker="Hoa hồng theo tháng"
      title="Kỳ chốt"
      description="Hệ thống tự chốt sau 00:00 ngày kế tiếp, giờ Việt Nam, nên ngày cuối tháng vẫn nằm trong kỳ. SuperAdmin chốt tay được nếu cần."
      placeholder="Tìm cộng tác viên hoặc tháng"
      search={{ value: query, onChange: setQuery }}
      footnote="Cho phép chi không trừ ví. Kế toán ghi đã chi mới trừ số của kỳ khỏi ví."
    >
      {periods.data?.canClose ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-[22px] bg-white p-4 crm-surface sm:flex-row sm:items-end">
          <div className="block w-full text-sm text-slate-600 sm:w-56">
            Tháng cần chốt
            <CrmMonthField value={month} max={previousVietnamPeriodMonth()} onChange={setMonth} />
          </div>
          <button type="submit" className={crmButtonClass} disabled={closeMonth.isPending}>
            {closeMonth.isPending ? 'Đang chốt…' : 'Chốt tháng'}
          </button>
        </form>
      ) : null}
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {notice ? <p className="text-center text-sm text-emerald-700">{notice}</p> : null}
      {periods.isLoading ? <CrmEmpty>Đang tải kỳ chốt…</CrmEmpty> : null}
      {periods.isError ? <CrmEmpty>Không tải được kỳ chốt.</CrmEmpty> : null}
      {periods.data && periods.data.periods.length === 0 ? (
        <CrmEmpty>Chưa có kỳ nào. Chốt một tháng đã kết thúc khi trong tháng đó có hoa hồng chờ đối soát.</CrmEmpty>
      ) : null}
      {periods.data && periods.data.periods.length > 0 && rows.length === 0 ? (
        <CrmEmpty>Không có kỳ khớp từ khóa.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((period) => (
            <PeriodCard key={period.id} period={period} canApprove={Boolean(periods.data?.canClose)} />
          ))}
        </div>
      ) : null}
    </CrmFrame>
  );
}

function PeriodCard({ period, canApprove }: { period: CrmCommissionPeriodView; canApprove: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const approve = useMutation({
    mutationFn: () => allowCrmCommissionPayout(period.id),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['crm-commission-periods'] });
    },
    onError: (err) => setError(errorText(err, 'Không chuyển được kỳ sang kế toán')),
  });
  const payable = period.status === 'payable';
  const paid = period.status === 'paid';

  return (
    <article className="rounded-[22px] bg-white p-5 crm-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{period.partnerName}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {period.partnerCode} · {formatPeriodLabel(period.periodMonth)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${paid ? 'bg-[#efeaff] text-[#4c3ec9]' : payable ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
          {paid ? 'Đã chi' : payable ? 'Chờ kế toán' : 'Chờ cho phép chi'}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-400">Khách đã trả</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatVnd(period.paidAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Hoa hồng</dt>
          <dd className="mt-1 font-semibold text-[#4c3ec9]">{formatVnd(period.commissionVnd)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-slate-400">
        {period.entryCount} khoản · {period.autoClosed ? 'hệ thống tự chốt' : 'chốt'} {formatWhen(period.closedAt)}
        {period.approvedAt ? ` · cho phép chi ${formatWhen(period.approvedAt)}` : ''}
        {period.paidAt ? ` · đã chi ${formatWhen(period.paidAt)}` : ''}
      </p>
      {canApprove && period.status === 'closed' ? (
        <button type="button" className={`${crmButtonClass} mt-4`} disabled={approve.isPending} onClick={() => approve.mutate()}>
          {approve.isPending ? 'Đang chuyển…' : 'Cho phép chi'}
        </button>
      ) : null}
      {payable || paid ? (
        <Link href="/crm/finance/accounting" className="mt-4 inline-block text-xs font-medium text-[#4c3ec9] underline">
          Xem ở kế toán
        </Link>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </article>
  );
}

function formatPeriodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  if (!year || !month) return periodMonth;
  return `tháng ${Number(month)}/${year}`;
}

function previousVietnamPeriodMonth(now = new Date()): string {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}
