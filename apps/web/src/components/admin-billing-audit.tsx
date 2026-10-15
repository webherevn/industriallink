'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Banknote, ChevronDown, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { Fragment, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Card } from '@/components/ui';
import { fetchAdminBillingAudit } from '@/lib/admin-billing';

const ENTITY_LABEL: Record<string, string> = {
  platform_plan: 'Gói nền tảng',
  sourcing_plan: 'Gói Săn',
  credit_topup: 'Top-up Credit',
  credit_policy: 'Policy',
  currency_config: 'Tiền tệ',
  credit_ledger: 'Credit Ledger',
};

const ACTION_META: Record<string, { color: string; label: string }> = {
  create: { color: 'bg-emerald-100 text-emerald-700', label: 'Tạo' },
  update: { color: 'bg-amber-100 text-amber-700', label: 'Sửa' },
  delete: { color: 'bg-rose-100 text-rose-700', label: 'Xoá' },
  deactivate: { color: 'bg-slate-200 text-slate-700', label: 'Tắt' },
  activate: { color: 'bg-emerald-100 text-emerald-700', label: 'Bật' },
  manual_grant: { color: 'bg-emerald-100 text-emerald-700', label: 'Cấp thêm' },
  manual_adjust: { color: 'bg-rose-100 text-rose-700', label: 'Trừ bớt' },
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(iso)
  );
}

function diffSummary(diff: Record<string, unknown>): string {
  const before = (diff.before ?? {}) as Record<string, unknown>;
  const after = (diff.after ?? {}) as Record<string, unknown>;
  const changes: string[] = [];
  for (const k of Object.keys(after)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changes.push(k);
    }
  }
  if (changes.length === 0) return '—';
  return changes.slice(0, 4).join(', ') + (changes.length > 4 ? ` +${changes.length - 4}` : '');
}

export function AdminBillingAudit() {
  const [entity, setEntity] = useState<string>('');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-billing-audit', entity, page],
    queryFn: () =>
      fetchAdminBillingAudit({
        entity: entity || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
              Pricing · Audit
            </p>
            <h1 className="cms-page-title mt-1.5">Lịch sử thay đổi</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              Mọi thao tác tạo/sửa/tắt đều ghi log: actor + before/after diff + timestamp.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Làm mới
          </button>
        </div>

        {/* Filter */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Lọc entity:</span>
            {[
              ['', 'Tất cả'],
              ['platform_plan', 'Gói nền tảng'],
              ['sourcing_plan', 'Gói Săn'],
              ['credit_topup', 'Top-up'],
              ['credit_policy', 'Policy'],
              ['currency_config', 'Tiền tệ'],
              ['credit_ledger', 'Credit Ledger'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setEntity(id);
                  setPage(0);
                  setExpandedId(null);
                }}
                className={clsx(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                  entity === id
                    ? 'bg-[#072348] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="admin-dash-skel h-14" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-500">
            <Banknote className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Chưa có thay đổi nào được ghi.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500">
              <span>
                Hiển thị {data!.items.length}/{data?.total ?? 0} mục
                {entity ? ` · lọc: ${ENTITY_LABEL[entity] ?? entity}` : ''}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-4 py-2 text-left">Thời gian</th>
                  <th className="px-4 py-2 text-left">Entity</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">Key</th>
                  <th className="px-4 py-2 text-left">Thay đổi</th>
                  <th className="px-4 py-2 text-left">Actor</th>
                </tr>
              </thead>
              <tbody>
                {data!.items.map((it) => {
                  const meta = ACTION_META[it.action] ?? {
                    color: 'bg-slate-100 text-slate-700',
                    label: it.action,
                  };
                  const isOpen = expandedId === it.id;
                  const diffObj = (it.diff ?? {}) as Record<string, unknown>;
                  const reason =
                    typeof diffObj.reason === 'string' ? diffObj.reason : null;
                  const creditDelta =
                    typeof diffObj.creditDelta === 'number' ? diffObj.creditDelta : null;
                  return (
                    <Fragment key={it.id}>
                      <tr
                        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/50"
                        onClick={() => setExpandedId(isOpen ? null : it.id)}
                      >
                        <td className="px-2 py-2 text-slate-400">
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-[11px] text-slate-500">
                          {fmt(it.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-xs font-semibold text-slate-700">
                          {ENTITY_LABEL[it.entity] ?? it.entity}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={clsx(
                              'rounded px-1.5 py-0.5 text-[10px] font-bold',
                              meta.color
                            )}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                            {it.entityKey.length > 14
                              ? `${it.entityKey.slice(0, 8)}…${it.entityKey.slice(-4)}`
                              : it.entityKey}
                          </code>
                        </td>
                        <td className="px-4 py-2 text-[11px] text-slate-600">
                          {creditDelta !== null ? (
                            <span
                              className={clsx(
                                'font-bold',
                                creditDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                              )}
                            >
                              {creditDelta > 0 ? '+' : ''}
                              {creditDelta} credit
                            </span>
                          ) : (
                            diffSummary(it.diff)
                          )}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-slate-500">
                          {it.actorEmail ?? <em className="text-slate-400">system</em>}
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-t border-slate-100 bg-slate-50/30">
                          <td colSpan={7} className="px-6 py-3">
                            {reason ? (
                              <div className="mb-2 text-xs text-slate-700">
                                <span className="font-semibold">Lý do:</span>{' '}
                                <span className="italic">{reason}</span>
                              </div>
                            ) : null}
                            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[10px] leading-relaxed text-slate-100">
                              {JSON.stringify(it.diff, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-4 py-2 text-[11px] text-slate-500">
                <span>
                  Trang {page + 1} / {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Trước
                  </button>
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
            ) : null}
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
