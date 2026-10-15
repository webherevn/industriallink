'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Coins, RefreshCw, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Card } from '@/components/ui';
import {
  fetchRecruiterCreditBalance,
  fetchRecruiterCreditSummary,
  fetchRecruiterCreditTransactions,
} from '@/lib/recruiter-billing';

const ACTION_LABEL: Record<string, string> = {
  view_profile: 'Mở hồ sơ',
  reopen_profile: 'Mở lại',
  view_applicant: 'Xem ứng viên',
  contact_potential: 'Liên hệ tiềm năng',
  contact_applicant: 'Liên hệ ứng viên',
  view_match_summary: 'Xem matching',
  manual_grant: 'Cấp thêm',
  manual_adjust: 'Điều chỉnh',
  plan_grant: 'Tặng gói',
};

const ACTION_COLOR: Record<string, string> = {
  view_profile: 'bg-blue-100 text-blue-700',
  reopen_profile: 'bg-amber-100 text-amber-700',
  view_applicant: 'bg-indigo-100 text-indigo-700',
  contact_potential: 'bg-purple-100 text-purple-700',
  contact_applicant: 'bg-violet-100 text-violet-700',
  view_match_summary: 'bg-cyan-100 text-cyan-700',
  manual_grant: 'bg-emerald-100 text-emerald-700',
  manual_adjust: 'bg-teal-100 text-teal-700',
  plan_grant: 'bg-lime-100 text-lime-700',
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(iso),
  );
}

function fmtCredit(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export default function RecruiterBillingCreditsPage() {
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['recruiter-credit-balance'],
    queryFn: fetchRecruiterCreditBalance,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['recruiter-credit-summary'],
    queryFn: fetchRecruiterCreditSummary,
    enabled: Boolean(balance),
  });

  const { data: transactions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['recruiter-credit-transactions', page],
    queryFn: () => fetchRecruiterCreditTransactions({ limit: LIMIT, offset: page * LIMIT }),
  });

  const totalPages = transactions ? Math.ceil(transactions.total / LIMIT) : 0;

  return (
    <RecruiterShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-accent-600" />
              <h1 className="text-xl font-bold text-slate-900">Credit của tôi</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi số dư và lịch sử sử dụng credit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetchBalance()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', balanceLoading && 'animate-spin')} />
            Làm mới
          </button>
        </div>

        {/* Balance hero */}
        <Card className="bg-gradient-to-br from-[#072348] to-[#1a4a7a] p-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Số dư Credit
          </p>
          <p className="mt-2 text-5xl font-bold tracking-tight">
            {balanceLoading ? '—' : fmtCredit(balance?.balance ?? 0)}
          </p>
          <p className="mt-1 text-sm text-white/70">credit</p>
          {!balanceLoading && (
            <div className="mt-4 flex flex-wrap gap-6 border-t border-white/20 pt-4">
              <div>
                <p className="text-[11px] text-white/50">Đã cấp</p>
                <p className="text-sm font-semibold">{fmtCredit(balance?.lifetimeGranted ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] text-white/50">Đã tiêu</p>
                <p className="text-sm font-semibold text-rose-300">
                  <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                  {fmtCredit(balance?.lifetimeConsumed ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-white/50">Đã hoàn</p>
                <p className="text-sm font-semibold text-emerald-300">
                  {fmtCredit(balance?.lifetimeRefunded ?? 0)}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3">
              <p className="text-[11px] font-semibold text-slate-500">30 ngày qua</p>
              <p className="mt-1 text-lg font-bold text-rose-600">
                <TrendingDown className="mr-1 inline h-4 w-4" />
                {fmtCredit(summary.totalConsumed30d)}
              </p>
            </Card>
            {summary.byAction.slice(0, 3).map((item) => (
              <Card key={item.action} className="p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  {ACTION_LABEL[item.action] ?? item.action}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-800">{fmtCredit(item.total)}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Mini 7-day chart */}
        {summary && summary.dailySeries.length > 0 && (
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-500">Biểu đồ 7 ngày gần nhất</p>
            <div className="mt-3 flex items-end gap-1" style={{ height: 60 }}>
              {summary.dailySeries.map((day) => {
                const max = Math.max(...summary.dailySeries.map((d) => d.total), 1);
                const heightPct = (day.total / max) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${day.date}: ${fmtCredit(day.total)} credit`}
                  >
                    <div
                      className="w-full max-w-8 rounded-t bg-accent-400"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                    <p className="text-[9px] text-slate-400">
                      {new Date(day.date).toLocaleDateString('vi-VN', { weekday: 'short' })}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Transaction history */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Lịch sử giao dịch</h2>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <RefreshCw className={clsx('h-3 w-3', isFetching && 'animate-spin')} />
              Làm mới
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="admin-dash-skel h-12" />
              ))}
            </div>
          ) : (transactions?.items.length ?? 0) === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              <Coins className="mx-auto mb-2 h-7 w-7 text-slate-300" />
              Chưa có giao dịch nào.
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Thời gian</th>
                      <th className="px-4 py-2 text-left">Hành động</th>
                      <th className="px-4 py-2 text-left">Credit</th>
                      <th className="px-4 py-2 text-left">Dư sau</th>
                      <th className="px-4 py-2 text-left">Enforced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions!.items.map((tx) => {
                      const isPositive = tx.creditDelta > 0;
                      const actionMeta = ACTION_COLOR[tx.action] ?? 'bg-slate-100 text-slate-700';
                      return (
                        <tr key={tx.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-[11px] text-slate-500">{fmt(tx.createdAt)}</td>
                          <td className="px-4 py-2">
                            <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-semibold', actionMeta)}>
                              {ACTION_LABEL[tx.action] ?? tx.action}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs font-bold">
                            <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                              {isPositive ? '+' : ''}{fmtCredit(tx.creditDelta)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-600">{fmtCredit(tx.balanceAfter)}</td>
                          <td className="px-4 py-2">
                            <span
                              className={clsx(
                                'rounded px-1.5 py-0.5 text-[10px] font-bold',
                                tx.enforced
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-400',
                              )}
                            >
                              {tx.enforced ? 'YES' : 'NO'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Tổng {transactions!.total} giao dịch · Trang {page + 1}/{totalPages}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ←
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pg = Math.max(0, page - 2) + i;
                      if (pg >= totalPages) return null;
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setPage(pg)}
                          className={clsx(
                            'rounded-lg px-3 py-1.5 text-xs font-semibold',
                            pg === page ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100',
                          )}
                        >
                          {pg + 1}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RecruiterShell>
  );
}
