'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Coins,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  adjustAdminCredit,
  fetchAdminCreditAccounts,
  fetchAdminCreditLedger,
  fetchAdminCreditSummary,
} from '@/lib/admin-billing';
import type { AdminCreditAdjustRequest, BillingCreditAccountView } from '@industriallink/contracts';

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

const TYPE_LABEL: Record<string, string> = {
  deduct: 'Trừ',
  grant: 'Cấp',
  topup: 'Nạp',
  refund: 'Hoàn',
  adjustment: 'Điều chỉnh',
};

const TYPE_COLOR: Record<string, string> = {
  deduct: 'bg-rose-100 text-rose-700',
  grant: 'bg-emerald-100 text-emerald-700',
  topup: 'bg-blue-100 text-blue-700',
  refund: 'bg-amber-100 text-amber-700',
  adjustment: 'bg-teal-100 text-teal-700',
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(iso),
  );
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(iso));
}

function fmtCredit(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function AdminBillingCreditLedger() {
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState('');
  const [type, setType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const LIMIT = 50;

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['admin-billing-credit-summary'],
    queryFn: () => import('@/lib/admin-billing').then((m) => m.fetchAdminCreditSummary()),
    staleTime: 30_000,
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-billing-credit-ledger', companyId, type, action, page],
    queryFn: () =>
      import('@/lib/admin-billing').then((m) =>
        m.fetchAdminCreditLedger({
          companyId: companyId || undefined,
          type: type || undefined,
          action: action || undefined,
          limit: LIMIT,
          offset: page * LIMIT,
        }),
      ),
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  const adjustM = useMutation({
    mutationFn: (body: AdminCreditAdjustRequest) => adjustAdminCredit(body),
    onSuccess: (res) => {
      setBanner({ tone: 'ok', text: res.message || 'Đã điều chỉnh credit.' });
      setAdjustOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-billing-credit-summary'] });
      qc.invalidateQueries({ queryKey: ['admin-billing-credit-ledger'] });
      qc.invalidateQueries({ queryKey: ['admin-billing-credit-accounts'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Điều chỉnh thất bại' }),
  });

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        {/* Header */}
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
              Billing · Credit Ledger
            </p>
            <h1 className="cms-page-title mt-1.5">Nhật ký Credit</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              Ghi nhận mọi thao tác trừ/cấp credit (chế độ LOG-ONLY — chưa trừ thật).
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => setAdjustOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Cấp thêm credit
            </Button>
            <button
              type="button"
              onClick={() => void refetchSummary()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', summaryLoading && 'animate-spin')} />
              Tóm tắt
            </button>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </button>
          </div>
        </div>

        {banner ? (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
              banner.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800',
            )}
          >
            {banner.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {banner.text}
            <button type="button" className="ml-auto" onClick={() => setBanner(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <Card className="p-3">
              <p className="text-[11px] font-semibold text-slate-500">Tài khoản</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{fmtCredit(summary.totalAccounts)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[11px] font-semibold text-slate-500">Tổng dư</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">
                {fmtCredit(summary.totalBalance)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-[11px] font-semibold text-slate-500">Hôm nay</p>
              <p className="mt-1 text-xl font-bold text-rose-600">
                <TrendingDown className="mr-1 inline h-4 w-4" />
                {fmtCredit(summary.totalConsumedToday)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-[11px] font-semibold text-slate-500">7 ngày</p>
              <p className="mt-1 text-xl font-bold text-rose-600">
                <TrendingDown className="mr-1 inline h-4 w-4" />
                {fmtCredit(summary.totalConsumedLast7d)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-[11px] font-semibold text-slate-500">30 ngày</p>
              <p className="mt-1 text-xl font-bold text-rose-600">
                <TrendingDown className="mr-1 inline h-4 w-4" />
                {fmtCredit(summary.totalConsumedLast30d)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-[11px] font-semibold text-slate-500">All-time tiêu thụ</p>
              <p className="mt-1 text-xl font-bold text-slate-700">
                <TrendingDown className="mr-1 inline h-4 w-4" />
                {fmtCredit(summary.totalConsumedAllTime)}
              </p>
            </Card>
          </div>
        )}

        {/* Filter */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Company ID"
              value={companyId}
              onChange={(e) => { setCompanyId(e.target.value); setPage(0); }}
              className="h-8 w-48 rounded-lg border border-slate-200 px-2 text-xs placeholder-slate-400 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
            />
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(0); }}
              className="h-8 rounded-lg border border-slate-200 px-2 text-xs focus:border-accent-400 focus:outline-none"
            >
              <option value="">Tất cả loại</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(0); }}
              className="h-8 rounded-lg border border-slate-200 px-2 text-xs focus:border-accent-400 focus:outline-none"
            >
              <option value="">Tất cả hành động</option>
              {Object.entries(ACTION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="admin-dash-skel h-14" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-500">
            <Coins className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Chưa có giao dịch nào.
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Thời gian</th>
                    <th className="px-4 py-2 text-left">Loại</th>
                    <th className="px-4 py-2 text-left">Hành động</th>
                    <th className="px-4 py-2 text-left">Delta</th>
                    <th className="px-4 py-2 text-left">Dư sau</th>
                    <th className="px-4 py-2 text-left">Cost/unit</th>
                    <th className="px-4 py-2 text-left">Ứng viên</th>
                    <th className="px-4 py-2 text-left">Actor</th>
                    <th className="px-4 py-2 text-left">Enforced</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((tx) => {
                    const isPositive = tx.creditDelta > 0;
                    const typeMeta = TYPE_COLOR[tx.type] ?? 'bg-slate-100 text-slate-700';
                    const actionMeta = ACTION_COLOR[tx.action] ?? 'bg-slate-100 text-slate-700';
                    return (
                      <tr key={tx.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-[11px] text-slate-500">{fmt(tx.createdAt)}</td>
                        <td className="px-4 py-2">
                          <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', typeMeta)}>
                            {TYPE_LABEL[tx.type] ?? tx.type}
                          </span>
                        </td>
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
                        <td className="px-4 py-2 text-xs font-semibold text-slate-700">
                          {fmtCredit(tx.balanceAfter)}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-slate-500">
                          {tx.costPerUnit > 0 ? fmtCredit(tx.costPerUnit) : '—'}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-slate-500">
                          {tx.candidateId ? (
                            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
                              {tx.candidateId.slice(0, 8)}…
                            </code>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-slate-500">
                          {tx.actorEmail ?? 'system'}
                        </td>
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
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Tổng {data!.total} giao dịch · Trang {page + 1}/{totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Trước
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
                          pg === page
                            ? 'bg-[#072348] text-white'
                            : 'text-slate-700 hover:bg-slate-100',
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
                    Sau →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {adjustOpen ? (
          <AdjustCreditModal
            onClose={() => setAdjustOpen(false)}
            onSubmit={(body) => adjustM.mutate(body)}
            saving={adjustM.isPending}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

/**
 * Modal điều chỉnh credit: chọn công ty (có sẵn tài khoản), nhập số (+ hoặc -) và lý do.
 * - delta > 0 → cấp thêm (manual_grant)
 * - delta < 0 → trừ bớt (manual_adjust)
 */
function AdjustCreditModal({
  onClose,
  onSubmit,
  saving,
}: {
  onClose: () => void;
  onSubmit: (body: AdminCreditAdjustRequest) => void;
  saving: boolean;
}) {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [manualCompanyId, setManualCompanyId] = useState('');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['admin-billing-credit-accounts'],
    queryFn: () => fetchAdminCreditAccounts(),
    staleTime: 30_000,
  });

  const deltaNum = Number(delta);
  const isGrant = deltaNum > 0;
  const isDeduct = deltaNum < 0;
  // Có 2 cách chọn company: từ dropdown (account có sẵn) hoặc paste UUID thủ công
  const finalCompanyId = selectedCompany || manualCompanyId.trim();
  const isValid =
    finalCompanyId.length > 0 &&
    Number.isFinite(deltaNum) &&
    deltaNum !== 0 &&
    reason.trim().length >= 3;

  const submit = () => {
    if (!isValid) return;
    onSubmit({ companyId: finalCompanyId, creditDelta: deltaNum, reason: reason.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[#072348]">Điều chỉnh credit</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cấp thêm hoặc trừ bớt credit cho một công ty. Hành động sẽ ghi nhật ký ngay.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Field
            label="Công ty *"
            description="Chọn từ danh sách tài khoản đã có, hoặc paste UUID thủ công cho công ty mới."
          >
            {accountsLoading ? (
              <div className="flex h-9 items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải danh sách...
              </div>
            ) : (accounts?.items.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Chưa có công ty nào có tài khoản. Hãy nhập UUID thủ công bên dưới.
              </p>
            ) : (
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  if (e.target.value) setManualCompanyId('');
                }}
                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400"
                disabled={saving}
              >
                <option value="">— Chọn từ danh sách —</option>
                {accounts!.items.map((acc: BillingCreditAccountView) => (
                  <option key={acc.companyId} value={acc.companyId}>
                    {acc.companyId.slice(0, 8)}… · Dư {fmtCredit(acc.balance)} · Đã cấp{' '}
                    {fmtCredit(acc.lifetimeGranted)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="-mt-2 pl-1 text-[11px] text-slate-500">
            Hoặc nhập Company ID thủ công:
            <Input
              type="text"
              value={manualCompanyId}
              onChange={(e) => {
                setManualCompanyId(e.target.value);
                if (e.target.value) setSelectedCompany('');
              }}
              placeholder="UUID (vd: 3fb27c96-a779-41f0-a0b0-60e96dc74d24)"
              className="mt-1 h-9 font-mono text-xs"
              disabled={saving}
            />
          </div>

          <Field
            label="Số credit thay đổi *"
            description="Dương = cấp thêm, Âm = trừ bớt. Ví dụ: 50 hoặc -20"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="50"
                className="h-9 flex-1"
                disabled={saving}
              />
              {isGrant ? (
                <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                  <TrendingUp className="h-3.5 w-3.5" /> Cấp thêm
                </span>
              ) : isDeduct ? (
                <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700">
                  <TrendingDown className="h-3.5 w-3.5" /> Trừ bớt
                </span>
              ) : null}
            </div>
          </Field>

          <Field label="Lý do *" description="Tối thiểu 3 ký tự, sẽ lưu vào nhật ký audit">
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Khuyến mãi tháng 10 / Đối tác VIP / Bù sai số..."
              className="h-9"
              disabled={saving}
            />
          </Field>

          {finalCompanyId ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Sẽ ghi cho: <code className="font-mono">{finalCompanyId}</code>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="button" onClick={submit} disabled={!isValid || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
            {isGrant ? 'Cấp thêm' : isDeduct ? 'Trừ bớt' : 'Xác nhận'}
          </Button>
        </div>
      </div>
    </div>
  );
}
