'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Ban,
  Check,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  JobModerationDecision,
  JobModerationStatus,
  type JobModerationQueueItem,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { decideJobModeration, fetchJobModerationQueue } from '@/lib/admin-moderation';

const TABS: Array<{ status: JobModerationStatus; label: string }> = [
  { status: JobModerationStatus.NeedsManualReview, label: 'Cần duyệt tay' },
  { status: JobModerationStatus.Pending, label: 'Đang trong hàng đợi' },
  { status: JobModerationStatus.RejectedAuto, label: 'AI đã chặn' },
  { status: JobModerationStatus.ApprovedAuto, label: 'AI đã duyệt' },
];

/** Màu theo điểm rủi ro: Cam 40–70, Đỏ 70–100, Xanh < 40. */
function riskTone(score: number | null): {
  wrap: string;
  text: string;
  label: string;
} {
  if (score == null) {
    return { wrap: 'bg-slate-100 ring-slate-200', text: 'text-slate-600', label: '—' };
  }
  if (score >= 70) {
    return {
      wrap: 'bg-rose-50 ring-rose-200',
      text: 'text-rose-700',
      label: 'Nguy hiểm',
    };
  }
  if (score >= 40) {
    return {
      wrap: 'bg-amber-50 ring-amber-200',
      text: 'text-amber-700',
      label: 'Cần soát',
    };
  }
  return {
    wrap: 'bg-emerald-50 ring-emerald-200',
    text: 'text-emerald-700',
    label: 'An toàn',
  };
}

function trustTone(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

export function AdminJobModerationPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<JobModerationStatus>(
    JobModerationStatus.NeedsManualReview,
  );
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-job-moderation', tab],
    queryFn: () => fetchJobModerationQueue({ status: tab, limit: 100 }),
    refetchInterval: 20_000,
  });

  const decideMutation = useMutation({
    mutationFn: (vars: {
      jobId: string;
      decision: JobModerationDecision;
      note?: string;
    }) =>
      decideJobModeration(vars.jobId, {
        decision: vars.decision,
        note: vars.note,
      }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-job-moderation'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    },
  });

  const counts = data?.counts;
  const items = data?.items ?? [];

  function act(
    item: JobModerationQueueItem,
    decision: JobModerationDecision,
  ) {
    if (decision === JobModerationDecision.BanUser) {
      const ok = window.confirm(
        `Khoá tài khoản người đăng "${item.submittedByEmail ?? item.companyName}" và từ chối tin này?`,
      );
      if (!ok) return;
    }
    if (decision === JobModerationDecision.Reject) {
      const ok = window.confirm(`Từ chối tin "${item.title}"?`);
      if (!ok) return;
    }
    decideMutation.mutate({ jobId: item.id, decision });
  }

  const pendingId = decideMutation.isPending
    ? decideMutation.variables?.jobId
    : undefined;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            Duyệt tin tuyển dụng
          </h1>
          <p className="cms-page-subtitle">
            Hàng đợi được AI (Gemini) lọc trước. Chỉ các tin gắn cờ “cần duyệt
            tay” mới cần bạn quyết định — đọc lý do, chọn hành động trong 3 giây.
          </p>
        </div>
      </div>

      {/* Thẻ thống kê nhanh */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Cần duyệt tay"
          value={counts?.needsManualReview}
          tone="amber"
        />
        <StatCard label="Đang trong hàng đợi" value={counts?.pending} tone="slate" />
        <StatCard label="AI đã chặn" value={counts?.rejectedAuto} tone="rose" />
        <StatCard label="AI đã duyệt" value={counts?.approvedAuto} tone="emerald" />
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            onClick={() => setTab(t.status)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors',
              tab === t.status
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Đang tải hàng đợi…</p>
      ) : items.length === 0 ? (
        <Card className="mt-5 p-8 text-center text-sm text-slate-500">
          Không có tin nào trong mục này. 🎉
        </Card>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => {
            const tone = riskTone(item.aiRiskScore);
            const canAct =
              item.moderationStatus === JobModerationStatus.NeedsManualReview ||
              item.moderationStatus === JobModerationStatus.RejectedAuto;
            const busy = pendingId === item.id;
            return (
              <Card key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row">
                  {/* Điểm rủi ro */}
                  <div
                    className={clsx(
                      'flex w-full shrink-0 flex-row items-center gap-3 rounded-xl px-4 py-3 ring-1 lg:w-40 lg:flex-col lg:justify-center lg:text-center',
                      tone.wrap,
                    )}
                  >
                    <div className={clsx('text-3xl font-black leading-none', tone.text)}>
                      {item.aiRiskScore ?? '—'}
                    </div>
                    <div>
                      <p className={clsx('text-[11px] font-bold uppercase tracking-wide', tone.text)}>
                        {tone.label}
                      </p>
                      <p className="text-[11px] text-slate-500">Điểm rủi ro /100</p>
                    </div>
                  </div>

                  {/* Nội dung */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                        {item.code}
                      </span>
                      {item.aiIsB2b === false ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100">
                          <AlertTriangle className="h-3 w-3" /> Không giống B2B
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[13px] text-slate-500">
                      {item.companyName} · Tín nhiệm:{' '}
                      <span className={clsx('font-bold', trustTone(item.companyTrustScore))}>
                        {item.companyTrustScore}
                      </span>
                      {item.submittedByEmail ? ` · ${item.submittedByEmail}` : ''}
                    </p>

                    {item.aiReason ? (
                      <div className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Lý do AI đánh cờ
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold text-slate-800">
                          {item.aiReason}
                        </p>
                      </div>
                    ) : null}

                    {item.moderationNote ? (
                      <p className="mt-2 text-[12px] text-amber-700">
                        ⚠ {item.moderationNote}
                      </p>
                    ) : null}

                    <details className="mt-2 text-[13px] text-slate-600">
                      <summary className="cursor-pointer select-none text-[12px] font-semibold text-brand-600">
                        Xem mô tả tin
                      </summary>
                      <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-slate-100 bg-white p-3 text-[13px] leading-relaxed text-slate-700">
                        {item.description}
                      </p>
                    </details>
                  </div>

                  {/* Hành động nhanh */}
                  <div className="flex shrink-0 flex-row gap-2 lg:w-40 lg:flex-col">
                    <Button
                      type="button"
                      className="flex-1 justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      disabled={busy || !canAct}
                      onClick={() => act(item, JobModerationDecision.Approve)}
                    >
                      <Check className="h-4 w-4" /> Duyệt
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 justify-center gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                      disabled={busy || !canAct}
                      onClick={() => act(item, JobModerationDecision.Reject)}
                    >
                      <X className="h-4 w-4" /> Từ chối
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 justify-center gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
                      disabled={busy || !item.submittedByUserId}
                      onClick={() => act(item, JobModerationDecision.BanUser)}
                    >
                      <Ban className="h-4 w-4" /> Khoá TK
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: 'amber' | 'rose' | 'emerald' | 'slate';
}) {
  const toneCls = {
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
    slate: 'text-slate-700',
  }[tone];
  return (
    <Card className="px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={clsx('mt-0.5 text-2xl font-black', toneCls)}>{value ?? '—'}</p>
    </Card>
  );
}
