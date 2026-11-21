'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarClock, ClipboardList, Loader2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { formatVnd, formatWhen } from '@/components/crm/format';
import { fetchMyPartner } from '@/lib/crm';

type Tab = 'periods' | 'statement';

export default function CtvPayoutsPage() {
  const mine = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const [tab, setTab] = useState<Tab>('periods');

  const partner = mine.data?.partner ?? null;
  const periods = mine.data?.payoutPeriods ?? [];
  const txns = mine.data?.walletTxns ?? [];
  const payoutDay = mine.data?.payoutDay ?? 10;

  const totalReceived = periods
    .filter((period) => period.status === 'paid')
    .reduce((sum, period) => sum + BigInt(period.netPaidAmountVnd || '0'), 0n);
  const held = periods
    .filter((period) => period.status === 'held')
    .reduce((sum, period) => sum + BigInt(period.netPaidAmountVnd || '0'), 0n);

  return (
    <div className="space-y-5">
      {/* Tóm tắt số dư ví */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium leading-snug text-slate-500">Khả dụng chờ chi</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-[#0F2440]">
            {formatVnd(partner?.walletBalanceVnd ?? '0')}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Số dư hiện có trên ví Inlink của bạn.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium leading-snug text-slate-500">Tổng đã nhận</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-emerald-700">
            {formatVnd(totalReceived.toString())}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Tổng thực nhận sau khấu trừ thuế TNCN.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium leading-snug text-slate-500">Kỳ chi trả kế tiếp</p>
          <p className="mt-1.5 flex items-center gap-2 text-2xl font-bold tracking-tight text-[#0F2440]">
            <CalendarClock className="h-5 w-5 text-slate-400" />
            Ngày {payoutDay}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            {held > 0n
              ? `${formatVnd(held.toString())} đang tạm giữ chờ xác thực CCCD.`
              : 'Chuyển khoản ngân hàng tự động hàng tháng.'}
          </p>
        </div>
      </section>

      {/* 2 tab */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 border-b border-slate-100 px-5 py-3">
          {(
            [
              ['periods', 'Kỳ chi trả hàng tháng'],
              ['statement', 'Sao kê biến động ví'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={clsx(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                tab === id
                  ? 'bg-[#0F2440] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mine.isLoading ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải dữ liệu ví…
          </p>
        ) : tab === 'periods' ? (
          periods.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">
              Chưa có kỳ chi trả nào. Kỳ chi trả được ghi sau khi tháng đóng và kế toán cho phép chi.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Kỳ tháng</th>
                    <th className="px-5 py-3">Tổng trước thuế</th>
                    <th className="px-5 py-3">Thuế TNCN 10%</th>
                    <th className="px-5 py-3">Thực nhận</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3">Mã giao dịch / UNC</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr
                      key={period.periodId}
                      className="border-t border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {formatPeriodMonth(period.periodMonth)}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-700">
                        {formatVnd(period.grossAmountVnd)}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-700">
                        {BigInt(period.pitTaxAmountVnd || '0') > 0n ? (
                          <>
                            −{formatVnd(period.pitTaxAmountVnd)}
                            <span className="ml-1 text-[11px] text-slate-400">(10%)</span>
                          </>
                        ) : (
                          <span className="text-slate-400">0đ</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-bold tabular-nums text-[#0F2440]">
                        {formatVnd(period.netPaidAmountVnd)}
                      </td>
                      <td className="px-5 py-3">
                        {period.status === 'paid' ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            Đã chi
                          </span>
                        ) : period.kycStatus === 'VERIFIED' ? (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
                            Chờ chi trả ngày {payoutDay}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                            Tạm giữ do chưa KYC
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">
                        {period.transferRef ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : txns.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Chưa có dòng biến động nào trong ví.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Thời gian</th>
                  <th className="px-5 py-3">Nội dung</th>
                  <th className="px-5 py-3">Phát sinh</th>
                  <th className="px-5 py-3">Số dư sau dòng</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-xs text-slate-500">{formatWhen(row.createdAt)}</td>
                    <td className="px-5 py-3 text-slate-800">{row.label}</td>
                    <td
                      className={clsx(
                        'px-5 py-3 font-semibold tabular-nums',
                        row.kind === 'debit' ? 'text-rose-700' : 'text-emerald-700',
                      )}
                    >
                      {row.kind === 'debit' ? '−' : '+'}
                      {formatVnd(row.amountVnd)}
                    </td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-800">
                      {formatVnd(row.balanceAfterVnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#0F2440]">Sao kê ví hoa hồng</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Tự động cộng khi khách hàng thanh toán gói và đối soát chuyển khoản ngân hàng vào
              ngày 10 hàng tháng.
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs leading-snug text-slate-500">
              <Wallet className="h-3.5 w-3.5" />
              Số dư trên Inlink, không phải ví MoMo. Số dư nằm ở đây cho tới khi kế toán ghi đã
              chi.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatPeriodMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  return `Tháng ${Number(month)}/${year}`;
}
