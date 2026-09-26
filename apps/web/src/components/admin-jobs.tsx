'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Eye, EyeOff, RotateCcw, Search, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AdminJobAction,
  JobModerationStatus,
  JobStatus,
  jobPublicPath,
  type AdminJobListItem,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { actAdminJob, fetchAdminJobs } from '@/lib/admin-jobs';
import { siteUrl } from '@/lib/public-paths';

const STATUS_TABS: Array<{ value: JobStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: JobStatus.Published, label: 'Đang đăng' },
  { value: JobStatus.Paused, label: 'Đang ẩn' },
  { value: JobStatus.Draft, label: 'Nháp' },
  { value: JobStatus.Closed, label: 'Đã đóng' },
];

const STATUS_LABEL: Record<JobStatus, string> = {
  [JobStatus.Draft]: 'Nháp',
  [JobStatus.Published]: 'Đang đăng',
  [JobStatus.Paused]: 'Đang ẩn',
  [JobStatus.Closed]: 'Đã đóng',
};

const MOD_LABEL: Record<JobModerationStatus, string> = {
  [JobModerationStatus.Draft]: 'Chưa gửi duyệt',
  [JobModerationStatus.Pending]: 'Đang chờ AI',
  [JobModerationStatus.ApprovedAuto]: 'AI duyệt',
  [JobModerationStatus.NeedsManualReview]: 'Cần duyệt tay',
  [JobModerationStatus.RejectedAuto]: 'AI chặn',
  [JobModerationStatus.ApprovedManual]: 'Duyệt tay',
  [JobModerationStatus.RejectedManual]: 'Từ chối tay',
};

function statusBadge(status: JobStatus): string {
  switch (status) {
    case JobStatus.Published:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case JobStatus.Paused:
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    case JobStatus.Closed:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    default:
      return 'bg-sky-50 text-sky-700 ring-sky-100';
  }
}

function modBadge(status: JobModerationStatus): string {
  switch (status) {
    case JobModerationStatus.ApprovedAuto:
    case JobModerationStatus.ApprovedManual:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case JobModerationStatus.NeedsManualReview:
      return 'bg-amber-50 text-amber-800 ring-amber-100';
    case JobModerationStatus.RejectedAuto:
    case JobModerationStatus.RejectedManual:
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    case JobModerationStatus.Pending:
      return 'bg-violet-50 text-violet-700 ring-violet-100';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
}

export function AdminJobsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [moderationStatus, setModerationStatus] = useState<JobModerationStatus | ''>('');
  const [companyId, setCompanyId] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      status: status || undefined,
      moderationStatus: moderationStatus || undefined,
      companyId: companyId || undefined,
      q: q || undefined,
      page,
      limit: 50,
    }),
    [status, moderationStatus, companyId, q, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs', query],
    queryFn: () => fetchAdminJobs(query),
    refetchInterval: 30_000,
  });

  const actMutation = useMutation({
    mutationFn: (vars: { jobId: string; action: AdminJobAction }) =>
      actAdminJob(vars.jobId, { action: vars.action }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-jobs'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    },
  });

  const counts = data?.counts;
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const pendingId = actMutation.isPending ? actMutation.variables?.jobId : undefined;

  function run(item: AdminJobListItem, action: AdminJobAction) {
    const labels: Record<AdminJobAction, string> = {
      [AdminJobAction.Hide]: `Ẩn tin "${item.title}" khỏi trang công khai?`,
      [AdminJobAction.Unhide]: `Hiện lại tin "${item.title}"?`,
      [AdminJobAction.Close]: `Đóng tin "${item.title}"? Tin sẽ không nhận ứng viên.`,
      [AdminJobAction.Requeue]: `Đẩy "${item.title}" lại hàng đợi kiểm duyệt? Tin sẽ gỡ khỏi trang công khai.`,
    };
    if (!window.confirm(labels[action])) return;
    actMutation.mutate({ jobId: item.id, action });
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  }

  return (
    <AdminShell>
      <div className="admin-dash-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Nền tảng</p>
        <h1 className="cms-page-title mt-1.5">Tất cả tin tuyển dụng</h1>
        <div className="brand-accent-bar mt-2" />
        <p className="cms-page-subtitle max-w-2xl">
          Toàn bộ tin trên nền tảng — lọc theo trạng thái, kiểm duyệt, công ty.
          Ẩn / đóng / đẩy lại hàng đợi. Hàng duyệt tay nằm ở{' '}
          <Link href="/admin/moderation" className="font-semibold text-[#E8872A] hover:underline">
            Duyệt tin
          </Link>
          .
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Tổng" value={counts?.total} />
        <Stat label="Đang đăng" value={counts?.published} tone="emerald" />
        <Stat label="Đang ẩn" value={counts?.paused} tone="amber" />
        <Stat label="Nháp" value={counts?.draft} />
        <Stat label="Đã đóng" value={counts?.closed} />
        <Stat label="Cần duyệt tay" value={counts?.needsManualReview} tone="rose" />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
            className={clsx(
              'rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors',
              status === t.value
                ? 'bg-[#072348] text-white shadow-[0_10px_20px_-12px_rgba(7,35,72,0.9)]'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:text-[#072348]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={applySearch} className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm tiêu đề, mã tin, công ty…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <Select
          value={moderationStatus}
          onChange={(e) => {
            setModerationStatus(e.target.value as JobModerationStatus | '');
            setPage(1);
          }}
        >
          <option value="">Mọi kiểm duyệt</option>
          {Object.values(JobModerationStatus).map((s) => (
            <option key={s} value={s}>
              {MOD_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi công ty</option>
          {(data?.companies ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" className="!rounded-xl hover:!border-[#FFD0A3] hover:!bg-[#FFF8F1]">
          Lọc
        </Button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-6 space-y-2">
          <div className="admin-dash-skel h-12 rounded-xl" />
          <div className="admin-dash-skel h-12 rounded-xl" />
          <div className="admin-dash-skel h-12 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-[1.15rem] border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-10 text-center text-sm text-slate-500">
          Không có tin khớp bộ lọc.
        </div>
      ) : (
        <div className="admin-dash-card mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Tin</th>
                <th className="px-3 py-2.5">Công ty</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5">Kiểm duyệt</th>
                <th className="px-3 py-2.5">Risk</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => {
                const busy = pendingId === item.id;
                const href =
                  item.status === JobStatus.Published && item.slug
                    ? `${siteUrl()}${jobPublicPath(item)}`
                    : null;
                return (
                  <tr key={item.id} className="admin-dash-row align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#072348]">
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer" className="hover:text-[#E8872A]">
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {item.code}
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-slate-800">{item.companyName}</p>
                      <p className="text-[11px] text-slate-400">
                        Tín nhiệm {item.companyTrustScore}
                        {item.submittedByEmail ? ` · ${item.submittedByEmail}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={clsx(
                          'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1',
                          statusBadge(item.status),
                        )}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={clsx(
                          'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1',
                          modBadge(item.moderationStatus),
                        )}
                      >
                        {MOD_LABEL[item.moderationStatus]}
                      </span>
                      {item.aiReason ? (
                        <p className="mt-1 max-w-[220px] text-[11px] text-slate-500 line-clamp-2">
                          {item.aiReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-[13px] text-slate-600">
                      {item.aiRiskScore ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {item.status === JobStatus.Published ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="px-2.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => run(item, AdminJobAction.Hide)}
                          >
                            <EyeOff className="h-3.5 w-3.5" /> Ẩn
                          </Button>
                        ) : null}
                        {item.status === JobStatus.Paused ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="px-2.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => run(item, AdminJobAction.Unhide)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Hiện
                          </Button>
                        ) : null}
                        {item.status !== JobStatus.Closed ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="px-2.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => run(item, AdminJobAction.Close)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Đóng
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="px-2.5 py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => run(item, AdminJobAction.Requeue)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Đẩy duyệt
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.limit ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            {data.total} tin · trang {data.page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value?: number;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose';
}) {
  const num = {
    slate: 'text-[#072348]',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  }[tone];
  return (
    <Card className="admin-dash-card px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={clsx('mt-0.5 text-xl font-bold', num)}>{value ?? '—'}</p>
    </Card>
  );
}
