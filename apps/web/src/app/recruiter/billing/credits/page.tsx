'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarDays, Check, Clock3, Coins, Folder, Plus, RefreshCw, Star, TrendingDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Card } from '@/components/ui';
import {
  fetchRecruiterCreditBalance,
  fetchRecruiterCreditSummary,
  fetchRecruiterCreditTransactions,
} from '@/lib/recruiter-billing';

const ACTION_LABEL: Record<string, string> = {
  view_profile: 'Mở hồ sơ (<80%)',
  view_profile_high_match: 'Mở hồ sơ (≥80%)',
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
  view_profile: 'bg-brand-50 text-brand-700',
  view_profile_high_match: 'bg-accent-50 text-accent-700',
  reopen_profile: 'bg-accent-50 text-accent-700',
  view_applicant: 'bg-brand-50 text-brand-700',
  contact_potential: 'bg-accent-50 text-accent-700',
  contact_applicant: 'bg-accent-50 text-accent-700',
  view_match_summary: 'bg-slate-100 text-slate-700',
  manual_grant: 'bg-emerald-50 text-emerald-700',
  manual_adjust: 'bg-slate-100 text-slate-700',
  plan_grant: 'bg-emerald-50 text-emerald-700',
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

  const { data: summary } = useQuery({
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
              <Coins className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-800">Credit của tôi</h1>
              <p className="mt-1 text-sm text-slate-500">Theo dõi số dư và lịch sử dùng credit.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetchBalance()}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-brand-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-brand-50"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', balanceLoading && 'animate-spin')} />
            Làm mới
          </button>
        </div>

        <section className="brand-hero-surface relative rounded-2xl p-5 sm:p-6">
          <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,16rem)_1px_minmax(0,1fr)_auto]">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-sm">
                <Coins className="h-7 w-7" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Số dư Credit</p>
                <p className="mt-1 text-5xl font-bold tracking-tight text-[#E8872A]">
                  {balanceLoading ? '—' : fmtCredit(balance?.balance ?? 0)}
                </p>
                <p className="text-sm text-white/70">credit</p>
              </div>
            </div>
            <div className="hidden h-16 bg-white/20 lg:block" />
            {!balanceLoading && (
              <div className="flex flex-wrap gap-6">
                <HeroStat icon={<Coins className="h-4 w-4" />} label="Đã cấp" value={fmtCredit(balance?.lifetimeGranted ?? 0)} valueClass="text-[#E8872A]" />
                <HeroStat icon={<TrendingDown className="h-4 w-4" />} label="Đã tiêu" value={fmtCredit(balance?.lifetimeConsumed ?? 0)} valueClass="text-rose-300" />
                <HeroStat icon={<Check className="h-4 w-4" />} label="Đã hoàn" value={fmtCredit(balance?.lifetimeRefunded ?? 0)} valueClass="text-emerald-300" />
              </div>
            )}
            <CreditMark />
          </div>
        </section>

        {summary && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              icon={<CalendarDays className="h-5 w-5" />}
              tone="bg-rose-50 text-rose-600"
              wave="bg-rose-100/80"
              label="30 ngày qua"
              value={summary.totalConsumed30d > 0 ? `-${fmtCredit(summary.totalConsumed30d)}` : '0'}
              valueClass="text-rose-500"
            />
            {summary.byAction.slice(0, 3).map((item) => (
              <SummaryCard
                key={item.action}
                icon={<Folder className="h-5 w-5" />}
                tone="bg-accent-50 text-accent-700"
                wave="bg-accent-100/80"
                label={ACTION_LABEL[item.action] ?? item.action}
                value={fmtCredit(item.total)}
                valueClass="text-[#E8872A]"
              />
            ))}
          </div>
        )}

        {summary && summary.dailySeries.length > 0 && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04)]">
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
          </section>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-brand-800">
              <Clock3 className="h-5 w-5 text-accent-600" />
              Lịch sử giao dịch
            </h2>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-brand-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-brand-50"
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
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(7,35,72,0.04)]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Thời gian</th>
                      <th className="px-4 py-3 text-left">Hành động</th>
                      <th className="px-4 py-3 text-left">Credit</th>
                      <th className="px-4 py-3 text-left">Dư sau</th>
                      <th className="px-4 py-3 text-left">Enforced</th>
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
                            <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', actionMeta)}>
                              {isPositive ? <Plus className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                              {ACTION_LABEL[tx.action] ?? tx.action}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs font-bold">
                            <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                              {isPositive ? '+' : ''}{fmtCredit(tx.creditDelta)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs font-semibold text-[#E8872A]">{fmtCredit(tx.balanceAfter)}</td>
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
              </div>

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

function HeroStat({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center gap-2 text-white">
      <span className="text-white/70">{icon}</span>
      <div>
        <p className="text-[11px] text-white/60">{label}</p>
        <p className={clsx('text-lg font-bold', valueClass)}>{value}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  wave,
  label,
  value,
  valueClass,
}: {
  icon: ReactNode;
  tone: string;
  wave: string;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04)]">
      <div className="flex items-center gap-2">
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl', tone)}>{icon}</span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className={clsx('mt-3 text-3xl font-bold tabular-nums', valueClass)}>{value}</p>
      <span aria-hidden className={clsx('pointer-events-none absolute -bottom-6 -right-2 h-14 w-28 rounded-full', wave)} />
    </div>
  );
}

function CreditMark() {
  return (
    <div aria-hidden className="relative hidden h-24 w-40 shrink-0 lg:block">
      <span className="absolute right-2 top-2 flex h-16 w-28 items-center justify-center rounded-2xl bg-white/95 text-brand-800 shadow-lg">
        <span className="text-sm font-black tracking-tight">iL Credit</span>
      </span>
      <Coins className="absolute bottom-1 right-6 h-7 w-7 text-accent-300" />
      <span className="absolute bottom-2 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-white">
        <Star className="h-4 w-4" />
      </span>
    </div>
  );
}
