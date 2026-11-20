'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApplicationStatus,
  formatJobTitle,
  type ApplicationSource,
  type InboxApplicantView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui';
import {
  APPLICATION_SOURCE_LABEL,
  APPLICATION_STATUS_LABEL,
  interviewMarkText,
  relativeTime,
  statusTone,
  toTitleCase,
} from '@/lib/format';
import { formatMatchPct, matchRingColor } from '@/lib/match-percent';
import { listInbox } from '@/lib/recruiter';
import { updateApplicationStatus } from '@/lib/applications';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: ApplicationStatus.Applied, label: 'Mới ứng tuyển' },
  { value: ApplicationStatus.Screening, label: 'Sàng lọc' },
  { value: ApplicationStatus.Interview, label: 'Phỏng vấn' },
  { value: ApplicationStatus.Offer, label: 'Đề nghị' },
  { value: ApplicationStatus.Hired, label: 'Đã nhận việc' },
  { value: ApplicationStatus.Rejected, label: 'Đã từ chối' },
];

const SOURCE_FILTERS: { value: ApplicationSource | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả nguồn' },
  { value: 'self_applied', label: 'Tự ứng tuyển' },
  { value: 'hunt', label: 'Tin săn nhân sự' },
  { value: 'ai_suggested', label: 'AI gợi ý' },
];

type InboxSort = 'match' | 'new';

/** Các bước có thể chuyển nhanh từ Hộp thư (không tính trạng thái hiện tại). */
const QUICK_STAGES: { value: ApplicationStatus; label: string }[] = [
  { value: ApplicationStatus.Applied, label: 'Mới ứng tuyển' },
  { value: ApplicationStatus.Screening, label: 'Sàng lọc' },
  { value: ApplicationStatus.Interview, label: 'Phỏng vấn' },
  { value: ApplicationStatus.Offer, label: 'Đề nghị' },
  { value: ApplicationStatus.Hired, label: 'Đã nhận việc' },
  { value: ApplicationStatus.Rejected, label: 'Đã từ chối' },
];

export default function RecruiterInboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<ApplicationSource | 'all'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<InboxSort>('match');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkStage, setBulkStage] = useState<ApplicationStatus | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-inbox'],
    queryFn: () => listInbox(100),
    retry: false,
  });

  // Đọc bộ lọc điều hướng từ /recruiter/email (quay lại) hoặc từ trang khác.
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    const stage = searchParams.get('stage');
    if (jobId) setJobFilter(jobId);
    if (stage) setStatusFilter(stage);
  }, [searchParams]);

  const stats = useMemo(() => {
    const list = data ?? [];
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      total: list.length,
      applied: list.filter((a) => a.status === ApplicationStatus.Applied).length,
      screening: list.filter((a) => a.status === ApplicationStatus.Screening).length,
      interview: list.filter((a) => a.status === ApplicationStatus.Interview).length,
      offer: list.filter((a) => a.status === ApplicationStatus.Offer).length,
      hired: list.filter((a) => a.status === ApplicationStatus.Hired).length,
      rejected: list.filter((a) => a.status === ApplicationStatus.Rejected).length,
      newToday: list.filter((a) => new Date(a.createdAt).getTime() >= dayAgo).length,
      highMatch: list.filter((a) => (a.matchScore ?? 0) >= 60).length,
    };
  }, [data]);

  const countByFilter: Record<string, number> = {
    all: stats.total,
    [ApplicationStatus.Applied]: stats.applied,
    [ApplicationStatus.Screening]: stats.screening,
    [ApplicationStatus.Interview]: stats.interview,
    [ApplicationStatus.Offer]: stats.offer,
    [ApplicationStatus.Hired]: stats.hired,
    [ApplicationStatus.Rejected]: stats.rejected,
  };

  /** Danh sách tin tuyển dụng có hồ sơ — nguồn cho dropdown "Tất cả vị trí tuyển dụng". */
  const jobsWithApplicants = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const a of data ?? []) {
      const row = map.get(a.jobId);
      if (row) row.count += 1;
      else map.set(a.jobId, { id: a.jobId, title: a.jobTitle, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [data]);

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (jobFilter !== 'all') {
      list = list.filter((a) => a.jobId === jobFilter);
    }
    if (sourceFilter !== 'all') {
      list = list.filter((a) => (a.source ?? 'self_applied') === sourceFilter);
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((a) => {
        const hay = [
          a.displayName,
          a.jobTitle,
          a.currentPosition ?? '',
          a.industry ?? '',
          ...a.matchedSkills,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(query);
      });
    }
    return [...list].sort((a, b) => {
      if (sort === 'new') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      const scoreDiff = (b.matchScore ?? -1) - (a.matchScore ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data, statusFilter, jobFilter, sourceFilter, q, sort]);

  const visibleIds = useMemo(() => filtered.map((a) => a.applicationId), [filtered]);
  const selectedIds = useMemo(
    () => visibleIds.filter((id) => selected[id]),
    [visibleIds, selected],
  );
  const allVisibleChecked =
    visibleIds.length > 0 && visibleIds.every((id) => selected[id]);

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAll(on: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of visibleIds) next[id] = on;
      return next;
    });
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      updateApplicationStatus(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recruiter-inbox'] });
    },
  });

  function moveSelected(status: ApplicationStatus) {
    for (const id of selectedIds) {
      statusMutation.mutate({ id, status });
    }
    setSelected({});
    setBulkStage('');
  }

  /** Điều hướng sang trang gửi email hàng loạt, mang theo ngữ cảnh đầy đủ. */
  const goToBulkEmail = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedIds.length > 0) {
      // Danh sách dài → lưu sessionStorage, truyền qua query param rút gọn.
      window.sessionStorage.setItem(
        'inlink:broadcast:applicationIds',
        JSON.stringify(selectedIds),
      );
      params.set('applicationIds', selectedIds.slice(0, 20).join(','));
      params.set('applicationIdsCount', String(selectedIds.length));
    } else {
      if (jobFilter !== 'all') params.set('jobId', jobFilter);
      if (statusFilter !== 'all') params.set('stage', statusFilter);
    }
    params.set('returnUrl', '/recruiter/inbox');
    router.push(`/recruiter/email?${params.toString()}`);
  }, [router, selectedIds, jobFilter, statusFilter]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
            <span className="h-4 w-1 rounded-full bg-accent-500" />
            Tuyển dụng
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-800">
            Hộp thư ứng viên
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Theo dõi và xử lý toàn bộ hồ sơ ứng tuyển — ưu tiên điểm phù hợp AI cao.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goToBulkEmail}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-sm transition duration-200 hover:border-brand-200 hover:bg-brand-50"
          >
            <Mail className="h-4 w-4" />
            Gửi email hàng loạt
          </button>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" />
            Tìm ứng viên AI
          </Link>
        </div>
      </div>

      {/* Thanh lọc: tìm kiếm + vị trí + nguồn + dải trạng thái */}
      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(7,35,72,0.04)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 xl:max-w-md xl:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên, tin tuyển dụng, kỹ năng..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="inbox-job-filter">
              Lọc theo vị trí tuyển dụng
            </label>
            <select
              id="inbox-job-filter"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="h-10 max-w-[260px] truncate rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-brand-800 outline-none transition focus:border-brand-500"
            >
              <option value="all">Tất cả vị trí tuyển dụng</option>
              {jobsWithApplicants.map((j) => (
                <option key={j.id} value={j.id}>
                  {formatJobTitle(j.title)} ({j.count})
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="inbox-source-filter">
              Lọc theo nguồn hồ sơ
            </label>
            <select
              id="inbox-source-filter"
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as ApplicationSource | 'all')
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-brand-800 outline-none transition focus:border-brand-500"
            >
              {SOURCE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition duration-200',
                  active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {f.label} ({countByFilter[f.value] ?? 0})
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5 text-sm font-medium text-slate-500">
          <span>{isLoading ? 'Đang tải…' : `${filtered.length} hồ sơ`}</span>
          {!isLoading && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <Clock3 className="h-3 w-3" />
                {stats.newToday} mới 24h
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <Sparkles className="h-3 w-3" />
                {stats.highMatch} phù hợp ≥ 60%
              </span>
            </>
          )}
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
          Sắp xếp theo
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as InboxSort)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800"
          >
            <option value="match">Độ phù hợp AI</option>
            <option value="new">Mới nhất</option>
          </select>
        </label>
      </div>

      {/* Thanh thao tác hàng loạt — hiện khi tích chọn >= 1 ứng viên */}
      {selectedIds.length > 0 && (
        <div className="sticky top-[72px] z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/95 px-3.5 py-2.5 shadow-[0_8px_24px_-12px_rgba(7,35,72,0.35)] backdrop-blur sm:px-4">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-800">
            <CheckCircle2 className="h-4 w-4 text-brand-600" />
            Đã chọn {selectedIds.length}
          </span>
          <span className="hidden h-5 w-px bg-brand-200 sm:block" />
          <button
            type="button"
            onClick={goToBulkEmail}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-700"
          >
            <Mail className="h-3.5 w-3.5" />
            Gửi email ({selectedIds.length})
          </button>
          <label className="inline-flex items-center gap-1.5">
            <span className="sr-only">Chuyển trạng thái</span>
            <select
              value={bulkStage}
              onChange={(e) => {
                const value = e.target.value as ApplicationStatus | '';
                setBulkStage(value);
                if (value) moveSelected(value);
              }}
              className="h-8 rounded-lg border border-brand-200 bg-white px-2.5 text-[13px] font-semibold text-brand-800 outline-none focus:border-brand-500"
            >
              <option value="">Chuyển trạng thái</option>
              {QUICK_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => moveSelected(ApplicationStatus.Rejected)}
            disabled={statusMutation.isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Từ chối
          </button>
          <button
            type="button"
            onClick={() => setSelected({})}
            className="ml-auto text-[13px] font-semibold text-slate-500 transition hover:text-slate-800"
          >
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      <div className="mt-3 space-y-3 pb-6">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80"
              />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <Inbox className="mx-auto h-10 w-10 text-brand-500" />
            <p className="mt-3 text-base font-semibold text-slate-800">
              Chưa có hồ sơ phù hợp bộ lọc
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Thử đổi trạng thái, xoá từ khoá, hoặc tìm thêm ứng viên bằng AI.
            </p>
            <Link href="/search" className="mt-4 inline-block">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <Sparkles className="h-4 w-4" /> Tìm ứng viên AI
              </span>
            </Link>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center gap-2.5 px-1">
            <input
              type="checkbox"
              aria-label="Chọn tất cả"
              checked={allVisibleChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-[13px] font-medium text-slate-500">
              Chọn tất cả ({visibleIds.length})
            </span>
          </div>
        )}

        {filtered.map((a) => (
          <ApplicantRow
            key={a.applicationId}
            applicant={a}
            checked={Boolean(selected[a.applicationId])}
            onToggle={() => toggleOne(a.applicationId)}
            onMove={(status) =>
              statusMutation.mutate({ id: a.applicationId, status })
            }
            pending={statusMutation.isPending}
          />
        ))}
      </div>
    </AppShell>
  );
}

function ScoreRing({ score }: { score: number | null | undefined }) {
  const numeric = scoreValue(score);
  const safe = Math.min(1, Math.max(0, numeric / 100));
  const pct = formatMatchPct(score ?? 0);
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - safe);
  const ringColor = matchRingColor(score ?? 0);
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#fde68a" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-soft"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[12px] font-extrabold leading-none tracking-tight tabular-nums"
          style={{ color: ringColor }}
        >
          {pct}
          <span className="text-[9px] font-bold opacity-80">%</span>
        </span>
      </div>
    </div>
  );
}

function ApplicantRow({
  applicant: a,
  checked,
  onToggle,
  onMove,
  pending,
}: {
  applicant: InboxApplicantView;
  checked: boolean;
  onToggle: () => void;
  onMove: (status: ApplicationStatus) => void;
  pending: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const source = (a.source ?? 'self_applied') as ApplicationSource;
  const timeLabel = relativeTime(a.createdAt);

  return (
    <article
      className={clsx(
        'rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 sm:p-5',
        checked ? 'border-brand-300 ring-2 ring-brand-200/70' : 'border-slate-200/80',
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <input
            type="checkbox"
            aria-label={`Chọn ${a.displayName}`}
            checked={checked}
            onChange={onToggle}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />

          <ScoreRing score={a.matchScore} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[15px] font-bold tracking-wide text-brand-800">
                {toTitleCase(a.displayName)}
              </h2>
              <Badge tone={statusTone(a.status)}>{APPLICATION_STATUS_LABEL[a.status]}</Badge>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {APPLICATION_SOURCE_LABEL[source]}
              </span>
              {a.interviews.map((mark, index) => (
                <Badge key={`${mark.type}-${mark.scheduledAt}-${index}`} tone="amber">
                  {interviewMarkText(mark)}
                </Badge>
              ))}
            </div>

            {/* Dòng phụ: chức danh hiện tại · vị trí đang ứng tuyển */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
              <span className="truncate">
                {a.currentPosition ? formatJobTitle(a.currentPosition) : 'Chưa cập nhật chức danh'}
              </span>
              <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
                Ứng tuyển: {formatJobTitle(a.jobTitle)}
              </span>
            </div>

            {a.matchedSkills.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {a.matchedSkills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                  >
                    {s}
                  </span>
                ))}
                {a.matchedSkills.length > 4 && (
                  <span className="text-[11px] font-medium text-slate-400">
                    +{a.matchedSkills.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {timeLabel && (
            <p className="mr-1 text-[12px] text-slate-400">{timeLabel}</p>
          )}
          <Link
            href={`/candidates/${a.candidateId}${a.matchScore != null ? `?match=${formatMatchPct(a.matchScore)}` : ''}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-700"
          >
            <UserRound className="h-4 w-4" />
            Xem hồ sơ
          </Link>
          <Link
            href={`/jobs/${a.jobId}/applicants?highlightCandidateId=${a.candidateId}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-brand-800 transition hover:border-brand-200 hover:bg-brand-50"
          >
            Quy trình
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          {/* Menu thao tác nhanh: chuyển bước / từ chối / nhắn tin */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Thao tác nhanh"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-lg">
                <p className="px-3.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Chuyển trạng thái
                </p>
                {QUICK_STAGES.filter((s) => s.value !== a.status).map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setMenuOpen(false);
                      onMove(s.value);
                    }}
                    className="block w-full px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {s.label}
                  </button>
                ))}
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    window.dispatchEvent(
                      new CustomEvent('inlink-open-chat', { detail: a.candidateId }),
                    );
                  }}
                  className="flex w-full items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Nhắn tin
                </button>
                <Link
                  href={`/jobs/${a.jobId}/applicants?highlightCandidateId=${a.candidateId}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Users className="h-3.5 w-3.5" />
                  Xem trong Quy trình
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function scoreValue(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
