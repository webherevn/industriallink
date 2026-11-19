'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Info,
  Laptop,
  Lock,
  MapPin,
  MoreHorizontal,
  Package,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { JobModerationStatus, JobStatus, type JobListItem } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import {
  JobPackageList,
  JobPostingResourcePanel,
} from '@/components/recruiter-job-posting-resources';
import { JobRepostPackageModal } from '@/components/job-repost-package-modal';
import { Badge, Button, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { EMPLOYMENT_LABEL, formatJobLevel, formatSalary } from '@/lib/format';
import { deleteJob, listMyJobs, publishJob, updateJobStatus } from '@/lib/jobs';
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

function jobBadge(job: JobListItem): {
  label: string;
  tone: 'green' | 'slate' | 'amber' | 'red';
  dotClass: string;
} {
  if (isModerating(job)) {
    return { label: 'Đang kiểm duyệt', tone: 'amber', dotClass: 'bg-amber-500' };
  }
  if (isAwaitingAdmin(job)) {
    return { label: 'Chờ Admin duyệt', tone: 'amber', dotClass: 'bg-amber-500' };
  }
  if (isRejected(job)) {
    return { label: 'Bị từ chối', tone: 'red', dotClass: 'bg-rose-500' };
  }
  const tone = statusTone(job.status);
  const dotClass =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'red'
          ? 'bg-rose-500'
          : 'bg-slate-400';
  return { label: STATUS_LABEL[job.status], tone, dotClass };
}

function getDeadlineBadge(deadline: string | null | undefined): {
  text: string;
  className: string;
} {
  if (!deadline) {
    return {
      text: 'Không giới hạn',
      className: 'bg-slate-100 text-slate-600',
    };
  }
  const end = new Date(deadline);
  const now = new Date();
  end.setHours(23, 59, 59, 999);
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) {
    return {
      text: `còn ${diffDays} ngày`,
      className: 'bg-emerald-50 text-emerald-700',
    };
  }
  if (diffDays === 1 || diffDays === 0) {
    return {
      text: diffDays === 1 ? 'còn 1 ngày' : 'Hết hạn hôm nay',
      className: 'bg-amber-50 text-amber-700',
    };
  }
  return {
    text: 'Đã hết hạn',
    className: 'bg-rose-50 text-rose-600',
  };
}

const MODERATION_POLL_MS = 3000;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: JobStatus.Published, label: 'Đang tuyển' },
  { value: JobStatus.Draft, label: 'Nháp' },
  { value: JobStatus.Paused, label: 'Tạm dừng' },
  { value: JobStatus.Closed, label: 'Đã đóng' },
];

type TimeFilter = 'all' | '7d' | '30d' | '90d';

export default function ManageJobsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const [q, setQ] = useState('');
  /** Lọc danh sách tin theo gói (từ nút "Xem tin đã gắn" của card gói). */
  const [packageFilterId, setPackageFilterId] = useState<string | null>(null);

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
    if (packageFilterId) {
      list = list.filter((j) => j.jobPackageId === packageFilterId);
    }
    if (timeFilter !== 'all') {
      const days = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      list = list.filter((j) => new Date(j.createdAt).getTime() >= cutoff);
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
  }, [jobs, statusFilter, timeFilter, q, sort, packageFilterId]);

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

      {/* Phần 1 — Hiển thị tài nguyên tin đăng */}
      <div className="mt-5">
        <JobPostingResourcePanel />
      </div>

      {/* Phần 2 — Danh sách gói tin đăng của tôi */}
      <div className="mt-3.5">
        <JobPackageList onFilterJobs={setPackageFilterId} />
      </div>

      {/* Phần 3 — Danh sách tin đăng */}
      <h2 id="recruiter-job-list" className="mt-5 scroll-mt-4 text-[15px] font-bold text-[#072348]">
        Danh sách tin đăng
        <span className="ml-1.5 text-slate-400">({stats.total})</span>
      </h2>

      {packageFilterId ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5">
          <p className="text-[12.5px] font-medium text-[#072348]">
            Đang lọc danh sách tin theo gói đã chọn ({filtered.length} tin).
          </p>
          <button
            type="button"
            onClick={() => setPackageFilterId(null)}
            className="text-[12.5px] font-semibold text-[#E8872A] hover:text-[#d6761b]"
          >
            Bỏ lọc
          </button>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Tổng tin"
          value={stats.total}
          tone="bg-brand-50 text-brand-700"
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <StatCard
          icon={<UserCheck className="h-4 w-4" />}
          label="Đang tuyển"
          value={stats.published}
          tone="bg-emerald-50 text-emerald-700"
          active={statusFilter === JobStatus.Published}
          onClick={() => setStatusFilter(JobStatus.Published)}
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Bản nháp"
          value={stats.draft}
          tone="bg-accent-50 text-accent-700"
          active={statusFilter === JobStatus.Draft}
          onClick={() => setStatusFilter(JobStatus.Draft)}
        />
        <StatCard
          icon={<Pause className="h-4 w-4" />}
          label="Tạm dừng"
          value={stats.paused}
          tone="bg-amber-50 text-amber-700"
          active={statusFilter === JobStatus.Paused}
          onClick={() => setStatusFilter(JobStatus.Paused)}
        />
      </div>

      {/* Thanh tìm kiếm, lọc trạng thái, lọc thời gian & sắp xếp */}
      <div className="brand-panel mt-5 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="relative min-w-0 flex-1 2xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên tin, mã JOB, địa điểm, kỹ năng..."
              className="h-10 w-full rounded-xl border-slate-200 bg-white pl-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    className={clsx(
                      'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition',
                      active
                        ? 'bg-[#072348] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="min-w-[168px] shrink-0">
                <Select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                  className="h-9 w-full whitespace-nowrap rounded-xl border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-700"
                >
                  <option value="all">Tất cả thời gian</option>
                  <option value="7d">7 ngày qua</option>
                  <option value="30d">30 ngày qua</option>
                  <option value="90d">90 ngày qua</option>
                </Select>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="whitespace-nowrap text-xs text-slate-500">Sắp xếp:</span>
                <div className="min-w-[132px]">
                  <Select
                    value={sort}
                    onChange={(e) => setSort(e.target.value === 'old' ? 'old' : 'new')}
                    className="h-9 w-full whitespace-nowrap rounded-xl border-slate-200 bg-white pl-3 pr-8 text-xs font-semibold text-[#072348]"
                  >
                    <option value="new">Mới nhất</option>
                    <option value="old">Cũ nhất</option>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
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
              : 'Thử đổi trạng thái, khoảng thời gian hoặc xoá từ khoá tìm kiếm.'}
          </p>
          {jobs?.length === 0 && (
            <Link href="/jobs/new" className="mt-4 inline-block">
              <Button>Đăng tin đầu tiên</Button>
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3.5">
        {isLoading &&
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80"
            />
          ))}

        {filtered.map((job) => (
          <JobManageCard
            key={job.id}
            job={job}
            busy={busy}
            onPublish={() => publishMutation.mutate(job.id)}
            onPause={() => statusMutation.mutate({ id: job.id, status: JobStatus.Paused })}
            onResume={() => statusMutation.mutate({ id: job.id, status: JobStatus.Published })}
            onClose={() => statusMutation.mutate({ id: job.id, status: JobStatus.Closed })}
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const badge = jobBadge(job);
  const inReview = isModerating(job) || isAwaitingAdmin(job);
  const created = new Date(job.createdAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const deadlineInfo = getDeadlineBadge(job.deadline);
  const result = job.recruitment ?? {
    applications: 0,
    screening: 0,
    interviews: 0,
    offers: 0,
    hires: 0,
  };

  const cleanSkills = job.skills.map((s) => plainLabel(s)).filter(Boolean);
  const visibleSkills = cleanSkills.slice(0, 4);
  const extraSkillCount = Math.max(0, cleanSkills.length - visibleSkills.length);

  // Tin đã đóng, đã hết hạn hoặc đang dùng gói Khám phá → được đăng lại bằng gói trả phí.
  const deadlinePassed =
    !!job.deadline && new Date(job.deadline).getTime() < Date.now();
  const canRepost =
    !job.isSourcingActive &&
    (job.status === JobStatus.Closed ||
      (job.status === JobStatus.Published && deadlinePassed) ||
      (job.status === JobStatus.Draft && !inReview && !isRejected(job)));

  return (
    <article className="brand-panel group relative p-4 transition duration-200 hover:border-brand-200 hover:shadow-[0_12px_30px_-16px_rgba(7,35,72,0.28)] sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Cột trái: Thông tin tin tuyển dụng */}
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <JobThumb job={job} />

          <div className="min-w-0 flex-1">
            {/* Tiêu đề + Trạng thái + Tin săn */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/jobs/${job.id}/detail`}
                className="text-[15.5px] font-bold text-[#072348] hover:text-brand-600"
              >
                {job.title}
              </Link>

              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  badge.tone === 'green' && 'bg-emerald-50 text-emerald-700',
                  badge.tone === 'amber' && 'bg-amber-50 text-amber-700',
                  badge.tone === 'red' && 'bg-rose-50 text-rose-700',
                  badge.tone === 'slate' && 'bg-slate-100 text-slate-600',
                )}
              >
                <span className={clsx('h-1.5 w-1.5 rounded-full', badge.dotClass)} />
                {badge.label}
              </span>

              {job.isSourcingActive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#FFD0A3] bg-[#FFF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#C25E12]">
                  <Settings className="h-3 w-3 text-[#E8872A]" />
                  Tin săn: Đang hoạt động
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <Settings className="h-3 w-3 text-slate-400" />
                  Tin săn: Chưa tạo
                </span>
              )}

              {job.jobPackageName ? (
                <span
                  title={
                    job.jobPackageCode
                      ? `Dùng lượt đăng từ gói ${job.jobPackageCode}`
                      : undefined
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-[#FFD0A3] bg-[#FFF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#C25E12]"
                >
                  <Package className="h-3 w-3 text-[#E8872A]" />
                  Từ gói: {job.jobPackageName}
                  {job.jobPackageCode ? (
                    <span className="font-medium text-[#E8872A]"> · {job.jobPackageCode}</span>
                  ) : null}
                </span>
              ) : null}

              {job.isNew && <Badge tone="accent">Mới</Badge>}
            </div>

            <p className="mt-1 text-[12px] font-medium text-slate-400">{job.code}</p>

            {/* Hàng metadata vị trí / địa điểm / lương / hình thức */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-slate-600">
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
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType}
                </span>
              )}
            </div>

            {/* Tag kỹ năng */}
            {visibleSkills.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {visibleSkills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    {s}
                  </span>
                ))}
                {extraSkillCount > 0 && (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    +{extraSkillCount} kỹ năng
                  </span>
                )}
              </div>
            )}

            {/* Ngày tạo · Thời hạn đăng · Số lượt xem */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-slate-500">
              <span>Tạo ngày {created}</span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span>Thời hạn đăng:</span>
                <span className={clsx('rounded px-1.5 py-0.5 text-[11px] font-semibold', deadlineInfo.className)}>
                  {deadlineInfo.text}
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-gradient-to-r from-sky-50 to-indigo-50/70 px-2.5 py-0.5 text-[11px] font-medium text-[#0B468C]">
                <Eye className="h-3.5 w-3.5 text-[#0B468C]" />
                <span>
                  <strong className="font-bold text-[#072348]">{job.viewCount ?? 0}</strong> lượt xem tin
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Cột phải: Tiến độ tuyển dụng + Hàng nút hành động */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3.5 lg:w-[27rem] lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-[#072348]">Tiến độ tuyển dụng</p>
              <span
                title="Thống kê số lượng hồ sơ ứng viên đang ở từng giai đoạn của tin tuyển dụng này"
                className="text-slate-400"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="mt-2 grid grid-cols-5 gap-1.5">
              <ResultStat icon={<Users className="h-3.5 w-3.5" />} label="Hồ sơ" value={result.applications} />
              <ResultStat icon={<Search className="h-3.5 w-3.5" />} label="Sàng lọc" value={result.screening} />
              <ResultStat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Phỏng vấn" value={result.interviews} />
              <ResultStat icon={<FileText className="h-3.5 w-3.5" />} label="Đề nghị" value={result.offers} />
              <ResultStat icon={<UserCheck className="h-3.5 w-3.5" />} label="Nhận việc" value={result.hires} hired />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/jobs/${job.id}/detail`}>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#E8872A] px-3.5 text-[12.5px] font-semibold text-white shadow-xs transition hover:bg-[#d6761b]">
                <Eye className="h-3.5 w-3.5" />
                Xem tin
              </span>
            </Link>

            <Link href={`/jobs/${job.id}/applicants`}>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-[#072348] transition hover:border-brand-300 hover:bg-slate-50">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                Ứng viên
              </span>
            </Link>

            <Link href="/recruiter/sourcing" className="flex-1 sm:flex-initial">
              <span
                className={clsx(
                  'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-semibold transition sm:w-auto',
                  job.isSourcingActive
                    ? 'border-[#FFD0A3] bg-[#FFF8F1] text-[#072348] hover:border-[#E8872A] hover:bg-[#FFEEDB]'
                    : 'border-slate-200 bg-slate-50 text-[#072348] hover:border-brand-300 hover:bg-slate-100',
                )}
              >
                <Settings
                  className={clsx(
                    'h-3.5 w-3.5',
                    job.isSourcingActive ? 'text-[#E8872A]' : 'text-brand-600',
                  )}
                />
                {job.isSourcingActive ? 'Quản lý Tin săn' : 'Tạo Tin săn'}
              </span>
            </Link>

            {/* Tin đã đóng / hết hạn → đăng lại bằng gói tin đăng. */}
            {canRepost ? (
              <button
                type="button"
                onClick={() => setRepostOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#FFD0A3] bg-[#FFF8F1] px-3 text-[12.5px] font-semibold text-[#C25E12] transition hover:border-[#E8872A] hover:bg-[#FFEEDB]"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#E8872A]" />
                Đăng lại tin
              </button>
            ) : null}

            {/* Menu 3 chấm */}
            <div ref={menuRef} className="relative ml-auto">
              <button
                type="button"
                aria-label="Thao tác khác"
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-[#072348]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  {job.isSourcingActive ? (
                    <span
                      title="Tin đang hoạt động săn tin nên không thể sửa tại đây"
                      className="flex cursor-not-allowed items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-400"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Đã khoá sửa tin
                    </span>
                  ) : (
                    <Link
                      href={`/jobs/${job.id}/edit`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-400" />
                      Sửa tin
                    </Link>
                  )}

                  <Link
                    href={`/jobs/new?from=${job.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    Copy tin đăng
                  </Link>

                  {!job.isSourcingActive && (
                    <>
                      {job.status === JobStatus.Draft && !inReview && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setMenuOpen(false);
                            onPublish();
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5 text-slate-400" />
                          Đăng tin
                        </button>
                      )}

                      {job.status === JobStatus.Published && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setMenuOpen(false);
                            onPause();
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <PauseCircle className="h-3.5 w-3.5 text-slate-400" />
                          Tạm dừng tin
                        </button>
                      )}

                      {job.status === JobStatus.Paused && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setMenuOpen(false);
                            onResume();
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5 text-slate-400" />
                          Mở lại tin
                        </button>
                      )}

                      {(job.status === JobStatus.Published || job.status === JobStatus.Paused) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setMenuOpen(false);
                            onClose();
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                          Đóng tin
                        </button>
                      )}

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xoá tin
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {repostOpen && (
        <JobRepostPackageModal
          jobId={job.id}
          jobTitle={job.title}
          onClose={() => setRepostOpen(false)}
        />
      )}
    </article>
  );
}

function JobThumb({ job }: { job: JobListItem }) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(job.companyHasLogo && job.companyId && !failed);
  return (
    <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 sm:block">
      {showLogo ? (
        <img
          src={`${apiPublicBase()}/companies/${job.companyId}/logo`}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[#072348]">
          <Building2 className="h-6 w-6" strokeWidth={1.6} />
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
    <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-1.5 py-2 text-center">
      <span className="mx-auto flex h-5 w-5 items-center justify-center text-slate-600">
        {icon}
      </span>
      <p
        className={clsx(
          'mt-1 text-base font-bold tabular-nums leading-none',
          hired ? 'text-emerald-600' : 'text-[#E8872A]',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10.5px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.28)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200',
        active ? 'border-brand-300 ring-1 ring-brand-200/70' : 'border-slate-200/80',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={clsx(
            'flex h-9 w-9 items-center justify-center rounded-xl transition duration-200 group-hover:scale-105',
            tone,
          )}
        >
          {icon}
        </span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[#E8872A]">{value}</p>
    </button>
  );
}
