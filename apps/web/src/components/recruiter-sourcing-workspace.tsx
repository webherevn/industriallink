'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  ListChecks,
  Loader2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  SOURCING_QUOTA_LABELS,
  type RecruiterSourcingEntitlements,
  type SourcingQuotaKind,
} from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { listMyJobs } from '@/lib/jobs';
import { consumeRecruiterSourcing, fetchRecruiterSourcing } from '@/lib/recruiter-billing';

function fmtQuota(used: number, quota: number | null, remaining: number | null) {
  if (quota == null) return `${used} / không giới hạn`;
  return `${used} / ${quota} · còn ${remaining ?? 0}`;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Mới mở',
  in_progress: 'Đang tìm',
  shortlisted: 'Đã shortlist',
  closed: 'Đã đóng',
};

export function RecruiterSourcingWorkspace() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [jobId, setJobId] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['recruiter-sourcing'],
    queryFn: fetchRecruiterSourcing,
  });
  const { data: jobs } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    staleTime: 60_000,
  });

  const consume = useMutation({
    mutationFn: consumeRecruiterSourcing,
    onSuccess: (ws, vars) => {
      setBanner({
        tone: 'ok',
        text: `Đã ghi ${SOURCING_QUOTA_LABELS[vars.kind].toLowerCase()}.`,
      });
      void qc.setQueryData(['recruiter-sourcing'], ws);
      void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      if (vars.kind === 'position') {
        setTitle('');
        setJobId('');
        const newest = ws.engagements[0]?.id;
        if (newest) setActiveId(newest);
      }
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Không trừ được hạn mức' }),
  });

  const e = data?.entitlements;
  const hasPlan = Boolean(e?.assignment?.isActive);
  const selected = activeId ?? data?.engagements[0]?.id ?? null;

  return (
    <RecruiterShell>
      <div className="recruiter-dash space-y-6">
        <div className="recruiter-dash-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            Săn nhân sự
          </p>
          <h1 className="cms-page-title mt-1.5">Gói Săn & hạn mức</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Hạn mức lấy đúng số SuperAdmin đang set. Credit mua riêng qua Top-up — gói Săn không tặng Credit.
          </p>
        </div>

        {banner ? (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              banner.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800',
            )}
          >
            {banner.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {banner.text}
          </div>
        ) : null}

        {isLoading ? (
          <div className="recruiter-dash-skel h-40" />
        ) : isError ? (
          <Card className="p-5">
            <p className="font-semibold text-slate-800">Không tải được gói Săn</p>
            <p className="mt-1 text-sm text-slate-500">
              {error instanceof ApiError ? error.message : 'Thử lại sau.'}
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-accent-700 hover:underline"
              onClick={() => void refetch()}
            >
              Thử lại
            </button>
          </Card>
        ) : !hasPlan ? (
          <Card className="p-6">
            <p className="text-lg font-semibold text-slate-800">Chưa gán gói Săn</p>
            <p className="mt-1 text-sm text-slate-500">
              Chọn gói trên bảng giá. Sau khi kích hoạt, hạn mức vị trí / đợt tìm / shortlist / điều chỉnh
              lấy đúng số SuperAdmin.
            </p>
            <Link
              href="/recruiter/pricing"
              className="mt-4 inline-flex text-sm font-semibold text-accent-700 hover:underline"
            >
              Xem gói Săn nhân sự
            </Link>
          </Card>
        ) : (
          <>
            <QuotaGrid entitlements={e!} />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Mở vị trí Săn
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Trừ 1 lượt vị trí theo hạn SuperAdmin ({fmtQuota(e!.positionsUsed, e!.positionQuota, e!.positionsRemaining)}).
                </p>
                <Input
                  className="mt-3 border-slate-200"
                  placeholder="Tên vị trí cần Săn"
                  value={title}
                  onChange={(ev) => setTitle(ev.target.value)}
                />
                <Select
                  className="mt-2 border-slate-200"
                  value={jobId}
                  onChange={(ev) => setJobId(ev.target.value)}
                  size="sm"
                >
                  <option value="">Không gắn tin đăng</option>
                  {(jobs ?? []).map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </Select>
                <Button
                  className="mt-3 w-full"
                  disabled={consume.isPending || (e!.positionsRemaining !== null && e!.positionsRemaining <= 0)}
                  onClick={() =>
                    consume.mutate({
                      kind: 'position',
                      title: title.trim() || undefined,
                      jobId: jobId || undefined,
                    })
                  }
                >
                  {consume.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Mở vị trí
                </Button>
              </Card>

              <Card className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Ghi nhận sử dụng
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Chọn vị trí đang mở rồi trừ đợt tìm / shortlist / điều chỉnh.
                </p>
                <div className="mt-3 space-y-2">
                  {(data?.engagements ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa có vị trí. Mở vị trí ở cột bên trái.</p>
                  ) : (
                    (data?.engagements ?? []).map((eng) => (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => setActiveId(eng.id)}
                        className={clsx(
                          'w-full rounded-lg border px-3 py-2 text-left text-sm',
                          selected === eng.id
                            ? 'border-accent-400 bg-accent-50'
                            : 'border-slate-200 hover:bg-slate-50',
                        )}
                      >
                        <span className="font-semibold text-slate-800">{eng.title}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {STATUS_LABEL[eng.status] ?? eng.status}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <UseBtn
                    kind="search_round"
                    icon={FileSearch}
                    disabled={!selected || consume.isPending}
                    remaining={e!.searchRoundsRemaining}
                    onClick={() => selected && consume.mutate({ kind: 'search_round', engagementId: selected })}
                  />
                  <UseBtn
                    kind="shortlist"
                    icon={ListChecks}
                    disabled={!selected || consume.isPending}
                    remaining={e!.shortlistsRemaining}
                    onClick={() => selected && consume.mutate({ kind: 'shortlist', engagementId: selected })}
                  />
                  <UseBtn
                    kind="revision"
                    icon={RefreshCw}
                    disabled={!selected || consume.isPending}
                    remaining={e!.revisionsRemaining}
                    onClick={() => selected && consume.mutate({ kind: 'revision', engagementId: selected })}
                  />
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Lịch sử trừ hạn mức
              </p>
              {(data?.usages ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Chưa có lần sử dụng.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {(data?.usages ?? []).map((u) => (
                    <li key={u.id} className="flex items-center justify-between py-2">
                      <span>
                        <strong>{SOURCING_QUOTA_LABELS[u.kind] ?? u.kind}</strong>
                        {u.note ? <span className="text-slate-500"> · {u.note}</span> : null}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                          new Date(u.createdAt),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </RecruiterShell>
  );
}

function QuotaGrid({ entitlements: e }: { entitlements: RecruiterSourcingEntitlements }) {
  const rows: { label: string; used: number; quota: number | null; remaining: number | null }[] = [
    { label: 'Vị trí', used: e.positionsUsed, quota: e.positionQuota, remaining: e.positionsRemaining },
    { label: 'Đợt tìm', used: e.searchRoundsUsed, quota: e.searchRoundQuota, remaining: e.searchRoundsRemaining },
    { label: 'Shortlist', used: e.shortlistsUsed, quota: e.shortlistQuota, remaining: e.shortlistsRemaining },
    { label: 'Điều chỉnh', used: e.revisionsUsed, quota: e.revisionQuota, remaining: e.revisionsRemaining },
  ];
  return (
    <Card className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {e.planName} · hạn mức SuperAdmin
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">{r.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#072348]">{fmtQuota(r.used, r.quota, r.remaining)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UseBtn({
  kind,
  icon: Icon,
  disabled,
  remaining,
  onClick,
}: {
  kind: SourcingQuotaKind;
  icon: typeof FileSearch;
  disabled: boolean;
  remaining: number | null;
  onClick: () => void;
}) {
  const out = remaining !== null && remaining <= 0;
  return (
    <button
      type="button"
      disabled={disabled || out}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
      {SOURCING_QUOTA_LABELS[kind]}
      {out ? ' · hết' : remaining != null ? ` · ${remaining}` : ''}
    </button>
  );
}
