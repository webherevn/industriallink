'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Briefcase,
  Eye,
  MapPin,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { JobStatus, type JobListItem } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  EMPLOYMENT_LABEL,
  formatJobLevel,
  formatSalary,
} from '@/lib/format';
import {
  deleteJob,
  listMyJobs,
  publishJob,
  updateJobStatus,
} from '@/lib/jobs';

const STATUS_LABEL: Record<JobStatus, string> = {
  [JobStatus.Draft]: 'Nháp',
  [JobStatus.Published]: 'Đang tuyển',
  [JobStatus.Paused]: 'Tạm dừng',
  [JobStatus.Closed]: 'Đã đóng',
};

function statusTone(status: JobStatus): 'green' | 'slate' | 'amber' | 'red' {
  if (status === JobStatus.Published) return 'green';
  if (status === JobStatus.Paused) return 'amber';
  if (status === JobStatus.Closed) return 'red';
  return 'slate';
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: JobStatus.Published, label: 'Đang tuyển' },
  { value: JobStatus.Draft, label: 'Nháp' },
  { value: JobStatus.Paused, label: 'Tạm dừng' },
  { value: JobStatus.Closed, label: 'Đã đóng' },
];

export default function ManageJobsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');

  const { data: jobs, isLoading, isError, error } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-jobs'] });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishJob(id),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      updateJobStatus(
        id,
        status as
          | JobStatus.Published
          | JobStatus.Paused
          | JobStatus.Closed
          | JobStatus.Draft,
      ),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: invalidate,
  });

  const busy =
    publishMutation.isPending || statusMutation.isPending || deleteMutation.isPending;

  const stats = useMemo(() => {
    const list = jobs ?? [];
    return {
      total: list.length,
      published: list.filter((j) => j.status === JobStatus.Published).length,
      draft: list.filter((j) => j.status === JobStatus.Draft).length,
      paused: list.filter((j) => j.status === JobStatus.Paused).length,
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    let list = jobs ?? [];
    if (statusFilter !== 'all') {
      list = list.filter((j) => j.status === statusFilter);
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((j) => {
        const hay = [j.title, j.code, j.location ?? '', j.industry ?? '', ...j.skills]
          .join(' ')
          .toLowerCase();
        return hay.includes(query);
      });
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [jobs, statusFilter, q]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="brand-accent-dot" />
            Tuyển dụng
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Tin tuyển dụng
          </h1>
          <div className="brand-accent-bar mt-2" />
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Quản lý tin đăng, xem chi tiết và theo dõi ứng viên ứng tuyển.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button className="bg-brand-600 hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Đăng tin mới
            <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent-400" aria-hidden />
          </Button>
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng tin" value={stats.total} tone="navy" />
        <StatCard label="Đang tuyển" value={stats.published} tone="green" />
        <StatCard label="Bản nháp" value={stats.draft} tone="accent" />
        <StatCard label="Tạm dừng" value={stats.paused} tone="amber" />
      </div>

      <div className="brand-panel mt-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên tin, mã JOB, địa điểm, kỹ năng..."
              className="border-accent-200 bg-[#FFFBF7] pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
                    active
                      ? 'bg-brand-600 text-white shadow-sm ring-2 ring-accent-300/70'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {isLoading ? 'Đang tải…' : `${filtered.length} tin`}
        </p>
      </div>

      {isError && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">
            {error instanceof ApiError && error.status === 403
              ? 'Bạn cần tạo hồ sơ công ty trước.'
              : 'Không tải được danh sách tin.'}
          </p>
          <Link href="/company">
            <Button className="mt-4" variant="outline">
              Tới trang Công ty
            </Button>
          </Link>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-brand-500" />
          <p className="mt-3 text-base font-semibold text-slate-800">
            {jobs?.length === 0 ? 'Chưa có tin tuyển dụng nào' : 'Không có tin khớp bộ lọc'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {jobs?.length === 0
              ? 'Đăng tin đầu tiên để bắt đầu nhận hồ sơ ứng viên.'
              : 'Thử đổi trạng thái hoặc xoá từ khoá tìm kiếm.'}
          </p>
          {jobs?.length === 0 && (
            <Link href="/jobs/new" className="mt-4 inline-block">
              <Button>Đăng tin đầu tiên</Button>
            </Link>
          )}
        </div>
      )}

      <div className="mt-3 space-y-3">
        {isLoading &&
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80"
            />
          ))}

        {filtered.map((job) => (
          <JobManageCard
            key={job.id}
            job={job}
            busy={busy}
            onPublish={() => publishMutation.mutate(job.id)}
            onPause={() =>
              statusMutation.mutate({ id: job.id, status: JobStatus.Paused })
            }
            onResume={() =>
              statusMutation.mutate({ id: job.id, status: JobStatus.Published })
            }
            onClose={() =>
              statusMutation.mutate({ id: job.id, status: JobStatus.Closed })
            }
            onDelete={() => {
              if (
                window.confirm(
                  `Xoá tin «${job.title}»? Thao tác không hoàn tác từ danh sách.`,
                )
              ) {
                deleteMutation.mutate(job.id);
              }
            }}
          />
        ))}
      </div>
    </AppShell>
  );
}

function JobManageCard({
  job,
  busy,
  onPublish,
  onPause,
  onResume,
  onClose,
  onDelete,
}: {
  job: JobListItem;
  busy: boolean;
  onPublish: () => void;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const created = new Date(job.createdAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <article className="brand-panel brand-card-accent group p-4 transition hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/jobs/${job.id}/detail`}
            className="text-[15px] font-semibold text-slate-900 hover:text-brand-700"
          >
            {job.title}
          </Link>
          <Badge tone={statusTone(job.status)}>{STATUS_LABEL[job.status]}</Badge>
          {job.isNew && <Badge tone="accent">Mới</Badge>}
        </div>

        <p className="mt-1.5 text-[12px] font-medium text-slate-400">{job.code}</p>

        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-slate-600">
          {job.jobLevel && (
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              {formatJobLevel(job.jobLevel)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {job.location ?? 'Chưa rõ địa điểm'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-slate-400" />
            {formatSalary(job.salaryMin, job.salaryMax)}
          </span>
          {job.employmentType && (
            <span className="text-slate-500">
              {EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType}
            </span>
          )}
        </div>

        {job.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.skills.slice(0, 5).map((s) => (
              <Badge key={s} tone="green">
                {s}
              </Badge>
            ))}
            {job.skills.length > 5 && (
              <span className="text-[11px] font-medium text-slate-400">
                +{job.skills.length - 5}
              </span>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] text-slate-400">Tạo ngày {created}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
        <Link href={`/jobs/${job.id}/detail`}>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-accent-500/20 transition hover:bg-accent-600">
            <Eye className="h-3.5 w-3.5" />
            Xem
          </span>
        </Link>
        <Link href={`/jobs/${job.id}/edit`}>
          <ActionChip>
            <Pencil className="h-3.5 w-3.5" />
            Sửa
          </ActionChip>
        </Link>
        <Link href={`/jobs/${job.id}/applicants`}>
          <ActionChip>
            <Users className="h-3.5 w-3.5" />
            Ứng viên
          </ActionChip>
        </Link>

        <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:inline-block" aria-hidden />

        {job.status === JobStatus.Draft && (
          <ActionChip onClick={onPublish} disabled={busy}>
            <Play className="h-3.5 w-3.5" />
            Đăng tin
          </ActionChip>
        )}
        {job.status === JobStatus.Published && (
          <ActionChip onClick={onPause} disabled={busy}>
            <Pause className="h-3.5 w-3.5" />
            Tạm dừng
          </ActionChip>
        )}
        {job.status === JobStatus.Paused && (
          <ActionChip onClick={onResume} disabled={busy}>
            <Play className="h-3.5 w-3.5" />
            Mở lại
          </ActionChip>
        )}
        {(job.status === JobStatus.Published || job.status === JobStatus.Paused) && (
          <ActionChip onClick={onClose} disabled={busy}>
            <XCircle className="h-3.5 w-3.5" />
            Đóng tin
          </ActionChip>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          title="Xoá tin"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function ActionChip({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className =
    'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-accent-200 hover:bg-accent-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
    );
  }

  return <span className={className}>{children}</span>;
}

const STAT_TONE = {
  navy: 'bg-brand-50 text-brand-700',
  green: 'bg-[#D1FAE5] text-[#059669]',
  accent: 'bg-accent-50 text-accent-700',
  amber: 'bg-accent-100 text-accent-700',
} as const;

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <div className="brand-panel p-4">
      <span
        className={clsx(
          'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
          STAT_TONE[tone],
        )}
      >
        {label}
      </span>
      <p className="mt-3 text-[1.5rem] font-extrabold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
