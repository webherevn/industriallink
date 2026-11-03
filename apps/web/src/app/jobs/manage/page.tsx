'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Briefcase,
  Building2,
  CalendarDays,
  Copy,
  Eye,
  FileText,
  Laptop,
  MapPin,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { JobModerationStatus, JobStatus, type JobListItem } from '@industriallink/contracts';
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
import { plainLabel } from '@/lib/plain-label';
import { apiPublicBase } from '@/lib/public-paths';

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

/** Tin nháp đã bấm "Đăng tin" và đang chờ worker kiểm duyệt (vài giây). */
function isModerating(job: JobListItem): boolean {
  return job.status === JobStatus.Draft && job.moderationStatus === JobModerationStatus.Pending;
}

function isAwaitingAdmin(job: JobListItem): boolean {
  return (
    job.status === JobStatus.Draft &&
    job.moderationStatus === JobModerationStatus.NeedsManualReview
  );
}

function isRejected(job: JobListItem): boolean {
  return (
    job.status === JobStatus.Draft &&
    (job.moderationStatus === JobModerationStatus.RejectedAuto ||
      job.moderationStatus === JobModerationStatus.RejectedManual)
  );
}

function jobBadge(job: JobListItem): { label: string; tone: 'green' | 'slate' | 'amber' | 'red' } {
  if (isModerating(job)) return { label: 'Đang kiểm duyệt', tone: 'amber' };
  if (isAwaitingAdmin(job)) return { label: 'Chờ Admin duyệt', tone: 'amber' };
  if (isRejected(job)) return { label: 'Bị từ chối', tone: 'red' };
  return { label: STATUS_LABEL[job.status], tone: statusTone(job.status) };
}

const MODERATION_POLL_MS = 3000;

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
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const [q, setQ] = useState('');

  const { data: jobs, isLoading, isError, error } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some(isModerating) ? MODERATION_POLL_MS : false,
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
      draft: list.filter(
        (j) => j.status === JobStatus.Draft && !isModerating(j) && !isAwaitingAdmin(j),
      ).length,
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
    return [...list].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === 'new' ? diff : -diff;
    });
  }, [jobs, statusFilter, q, sort]);

  return (
    <AppShell>
      <section className="brand-hero-surface relative rounded-2xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-2 bottom-0 top-0 hidden w-52 items-center justify-end pr-8 opacity-20 lg:flex">
          <Laptop className="h-28 w-28" strokeWidth={1.1} />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Tuyển dụng
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Tin tuyển dụng</h1>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Quản lý tin đăng, xem chi tiết và theo dõi kết quả tuyển dụng từng tin.
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-accent-600 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Đăng tin mới
          </Link>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Tổng tin" value={stats.total} tone="bg-brand-50 text-brand-700" />
        <StatCard icon={<UserCheck className="h-4 w-4" />} label="Đang tuyển" value={stats.published} tone="bg-emerald-50 text-emerald-700" />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Bản nháp" value={stats.draft} tone="bg-accent-50 text-accent-700" />
        <StatCard icon={<Pause className="h-4 w-4" />} label="Tạm dừng" value={stats.paused} tone="bg-amber-50 text-amber-700" />
      </div>

      <div className="brand-panel mt-5 p-4">
        <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên tin, mã JOB, địa điểm, kỹ năng..."
              className="w-full border-accent-200 bg-[#FFFBF7] pl-9"
            />
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">
          {isLoading ? 'Đang tải…' : `${filtered.length} tin tuyển dụng`}
        </p>
        <label className="inline-flex items-center gap-2 text-sm text-slate-500">
          Sắp xếp
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value === 'old' ? 'old' : 'new')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-brand-800"
          >
            <option value="new">Mới nhất</option>
            <option value="old">Cũ nhất</option>
          </select>
        </label>
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
  const badge = jobBadge(job);
  const inReview = isModerating(job) || isAwaitingAdmin(job);
  const created = new Date(job.createdAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const result = job.recruitment ?? {
    applications: 0,
    screening: 0,
    interviews: 0,
    offers: 0,
    hires: 0,
  };

  return (
    <article className="brand-panel group p-4 transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_32px_-16px_rgba(7,35,72,0.35)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <JobThumb job={job} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/jobs/${job.id}/detail`}
              className="text-[15px] font-semibold text-brand-800 hover:text-brand-600"
            >
              {job.title}
            </Link>
            <Badge tone={badge.tone}>{badge.label}</Badge>
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
              {job.skills
                .map((s) => plainLabel(s))
                .filter(Boolean)
                .slice(0, 5)
                .map((s) => (
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

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-5 lg:w-[22rem] lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <ResultStat icon={<Users className="h-3.5 w-3.5" />} label="Hồ sơ" value={result.applications} />
          <ResultStat icon={<Search className="h-3.5 w-3.5" />} label="Sàng lọc" value={result.screening} />
          <ResultStat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Phỏng vấn" value={result.interviews} />
          <ResultStat icon={<FileText className="h-3.5 w-3.5" />} label="Đề nghị" value={result.offers} />
          <ResultStat icon={<UserCheck className="h-3.5 w-3.5" />} label="Nhận việc" value={result.hires} hired />
        </div>
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
        <Link href={`/jobs/new?from=${job.id}`}>
          <ActionChip>
            <Copy className="h-3.5 w-3.5" />
            Copy tin đăng
          </ActionChip>
        </Link>

        <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:inline-block" aria-hidden />

        {job.status === JobStatus.Draft && !inReview && (
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

function JobThumb({ job }: { job: JobListItem }) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(job.companyHasLogo && job.companyId && !failed);
  return (
    <div className="hidden h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-brand-50 ring-1 ring-brand-100 sm:block">
      {showLogo ? (
        <img
          src={`${apiPublicBase()}/companies/${job.companyId}/logo`}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-brand-600">
          <Building2 className="h-6 w-6" />
        </span>
      )}
    </div>
  );
}

function ResultStat({
  icon,
  label,
  value,
  hired,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hired?: boolean;
}) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <p className={clsx('mt-1.5 text-lg font-bold tabular-nums', hired ? 'text-emerald-700' : 'text-[#E8872A]')}>
        {value}
      </p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
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

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_32px_-16px_rgba(7,35,72,0.4)]">
      <div className="flex items-center gap-2.5">
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110', tone)}>
          {icon}
        </span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[#E8872A]">{value}</p>
    </div>
  );
}
