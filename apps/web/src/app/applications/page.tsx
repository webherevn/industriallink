'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Eye,
  FileText,
  MapPin,
  Percent,
  Search,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ApplicationStatus,
  type ApplicationView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { PaginationBar } from '@/components/pagination-bar';
import { fetchMe } from '@/lib/auth';
import { getApplicationDetail, myApplications } from '@/lib/applications';
import { getMyCandidate } from '@/lib/candidate';
import { APPLICATION_STATUS_LABEL, formatSalary } from '@/lib/format';
import { formatMatchPct } from '@/lib/match-percent';

type FilterTab = 'all' | 'processing' | 'interview' | 'offer' | 'rejected' | 'hired';
type SortMode = 'newest' | 'oldest' | 'match';

const PAGE_SIZE = 5;

const PROCESSING: ApplicationStatus[] = [
  ApplicationStatus.Applied,
  ApplicationStatus.Screening,
  ApplicationStatus.Interview,
  ApplicationStatus.Offer,
];

function companyInitials(name: string): string {
  const parts = name
    .replace(/^(công ty|cty|chi nhánh)\s+/i, '')
    .split(/[\s\-_/]+/)
    .filter((w) => w.length > 0 && !/^(cổ|phần|tnhh|cp|mtv)$/i.test(w));
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return (parts[0] ?? name).slice(0, 2).toUpperCase();
}

function formatAppliedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case ApplicationStatus.Applied:
      return 'bg-brand-50 text-brand-700 ring-brand-100';
    case ApplicationStatus.Screening:
      return 'bg-accent-50 text-accent-700 ring-accent-100';
    case ApplicationStatus.Interview:
      return 'bg-brand-50 text-brand-700 ring-brand-100';
    case ApplicationStatus.Offer:
      return 'bg-accent-50 text-accent-700 ring-accent-100';
    case ApplicationStatus.Hired:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case ApplicationStatus.Rejected:
    case ApplicationStatus.Withdrawn:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
}

export default function ApplicationsPage() {
  const [tab, setTab] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: applications, isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
  });

  const apps = useMemo(() => applications ?? [], [applications]);

  const counts = useMemo(() => {
    const by = (s: ApplicationStatus) => apps.filter((a) => a.status === s).length;
    return {
      total: apps.length,
      applied: by(ApplicationStatus.Applied),
      screening: by(ApplicationStatus.Screening),
      interview: by(ApplicationStatus.Interview),
      offer: by(ApplicationStatus.Offer),
      hired: by(ApplicationStatus.Hired),
      rejected: apps.filter(
        (a) =>
          a.status === ApplicationStatus.Rejected ||
          a.status === ApplicationStatus.Withdrawn,
      ).length,
      processing: apps.filter((a) => PROCESSING.includes(a.status)).length,
    };
  }, [apps]);

  const avgMatch = useMemo(() => {
    const scored = apps.filter((a) => a.matchScore != null);
    if (!scored.length) return null;
    return Math.round(
      scored.reduce((s, a) => s + (a.matchScore ?? 0), 0) / scored.length,
    );
  }, [apps]);

  const needsAttention = useMemo(
    () =>
      apps
        .filter(
          (a) =>
            a.status === ApplicationStatus.Interview ||
            a.status === ApplicationStatus.Offer,
        )
        .slice(0, 4),
    [apps],
  );

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    let list = apps.filter((a) => {
      if (keyword) {
        const hay = `${a.jobTitle} ${a.companyName} ${a.code}`.toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      switch (tab) {
        case 'processing':
          return PROCESSING.includes(a.status);
        case 'interview':
          return a.status === ApplicationStatus.Interview;
        case 'offer':
          return a.status === ApplicationStatus.Offer;
        case 'rejected':
          return (
            a.status === ApplicationStatus.Rejected ||
            a.status === ApplicationStatus.Withdrawn
          );
        case 'hired':
          return a.status === ApplicationStatus.Hired;
        default:
          return true;
      }
    });

    list = [...list].sort((a, b) => {
      if (sort === 'match') {
        return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      }
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === 'newest' ? db - da : da - db;
    });
    return list;
  }, [apps, tab, sort, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
    setExpandedId(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const displayName = candidate?.displayName ?? me?.displayName ?? 'Ứng viên';

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <CandidateSidebar
          displayName={displayName}
          email={me?.email}
          hasAvatar={Boolean(candidate?.hasAvatar)}
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
        />

        {/* Center — danh sách đơn + lịch sử */}
        <section className="min-w-0 animate-soft-rise [animation-delay:60ms]">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
            <Link
              href="/dashboard"
              className="transition-colors duration-200 hover:text-brand-600"
            >
              Trang chủ
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>Hoạt động</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-600">Đơn ứng tuyển</span>
          </nav>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-brand-800">Đơn ứng tuyển của tôi</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Quản lý hồ sơ đã nộp, mã đơn và lịch sử trạng thái từng vị trí.
                </p>
              </div>
            </div>
            <Link
              href="/progress"
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm font-semibold text-accent-700 transition hover:bg-accent-100"
            >
              <Target className="h-3.5 w-3.5" />
              Xem tiến trình
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell icon={<ClipboardList className="h-4 w-4" />} iconClass="bg-accent-50 text-accent-700" label="Tổng đơn" value={counts.total} />
            <StatCell icon={<Briefcase className="h-4 w-4" />} iconClass="bg-brand-50 text-brand-700" label="Đang xử lý" value={counts.processing} />
            <StatCell icon={<AlertCircle className="h-4 w-4" />} iconClass="bg-accent-50 text-accent-700" label="Cần theo dõi" value={counts.interview + counts.offer} />
            <StatCell icon={<CheckCircle2 className="h-4 w-4" />} iconClass="bg-emerald-50 text-emerald-700" label="Đã nhận việc" value={counts.hired} />
          </div>

          {/* Search + tabs */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo vị trí, công ty hoặc mã đơn…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-brand-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortMode);
                  setPage(1);
                }}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="match">Độ phù hợp cao</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-0.5 border-b border-slate-200">
            {(
              [
                { id: 'all' as const, label: 'Tất cả', count: counts.total },
                {
                  id: 'processing' as const,
                  label: 'Đang xử lý',
                  count: counts.processing,
                },
                {
                  id: 'interview' as const,
                  label: 'Phỏng vấn',
                  count: counts.interview,
                },
                { id: 'offer' as const, label: 'Đề nghị', count: counts.offer },
                { id: 'hired' as const, label: 'Nhận việc', count: counts.hired },
                {
                  id: 'rejected' as const,
                  label: 'Đã từ chối',
                  count: counts.rejected,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={clsx(
                  'relative px-3.5 py-2.5 text-[13px] font-semibold transition-colors duration-200',
                  tab === t.id ? 'text-accent-600' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {t.label} ({t.count})
                <span
                  className={clsx(
                    'absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-accent-500 transition-all duration-200',
                    tab === t.id ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0',
                  )}
                />
              </button>
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {isLoading && (
              <li className="progress-card p-10 text-center text-sm text-slate-500">
                Đang tải đơn ứng tuyển...
              </li>
            )}
            {!isLoading && filtered.length === 0 && (
              <li className="progress-card border-dashed p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-brand-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {apps.length === 0
                    ? 'Bạn chưa có đơn ứng tuyển nào'
                    : 'Không tìm thấy đơn phù hợp bộ lọc'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {apps.length === 0
                    ? 'Ứng tuyển việc phù hợp — đơn sẽ xuất hiện tại đây kèm mã và lịch sử.'
                    : 'Thử đổi từ khóa hoặc chọn tab khác.'}
                </p>
                {apps.length === 0 && (
                  <Link
                    href="/viec-lam"
                    className="progress-btn mt-4 bg-brand-600 text-white hover:bg-brand-700"
                  >
                    Tìm việc làm
                  </Link>
                )}
              </li>
            )}
            {pageItems.map((app, idx) => (
              <ApplicationRecordCard
                key={app.id}
                app={app}
                index={idx}
                expanded={expandedId === app.id}
                onToggleHistory={() =>
                  setExpandedId((cur) => (cur === app.id ? null : app.id))
                }
              />
            ))}
          </ul>

          {!isLoading && filtered.length > 0 && (
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              itemLabel="đơn"
              onChange={goToPage}
            />
          )}
        </section>

        {/* Right — ngữ cảnh & CTA */}
        <aside className="space-y-4 animate-soft-rise [animation-delay:120ms]">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-accent-500 to-[#d06f18] p-4 text-white shadow-[0_12px_28px_-16px_rgba(232,135,42,0.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-white/80">Độ phù hợp AI trung bình</p>
                <p className="mt-1 text-4xl font-bold tracking-tight">
                  {avgMatch != null ? `${avgMatch}%` : '—'}
                </p>
                <p className="mt-1 text-[11px] text-white/80">
                  Trên {apps.filter((a) => a.matchScore != null).length} đơn có điểm khớp
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Target className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <Link
                href="/recommended"
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-800 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Xem gợi ý AI
              </Link>
              <Link
                href="/viec-lam"
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/40 bg-white/15 text-sm font-semibold text-white transition hover:bg-white/25"
              >
                <Search className="h-3.5 w-3.5" />
                Tìm thêm việc
              </Link>
            </div>
          </div>

          <div className="progress-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Cần chú ý</h2>
              <Eye className="h-4 w-4 text-brand-500" />
            </div>
            {needsAttention.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Không có đơn ở bước phỏng vấn hoặc đề nghị. Khi NTD cập nhật, sẽ hiện tại đây.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {needsAttention.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTab(
                          a.status === ApplicationStatus.Offer ? 'offer' : 'interview',
                        );
                        setPage(1);
                        setExpandedId(a.id);
                        window.setTimeout(() => {
                          document
                            .getElementById(`app-${a.id}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 50);
                      }}
                      className="group flex w-full items-start gap-2.5 rounded-xl border border-slate-100 bg-[#F8FAFC] p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white text-[11px] font-bold text-slate-500">
                        {companyInitials(a.companyName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-900 group-hover:text-amber-700">
                          {a.jobTitle}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{a.companyName}</p>
                        <span
                          className={clsx(
                            'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                            statusBadgeClass(a.status),
                          )}
                        >
                          {APPLICATION_STATUS_LABEL[a.status]}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/progress"
              className="mt-3 block text-center text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline"
            >
              Theo dõi trên Tiến trình →
            </Link>
          </div>

          <div className="progress-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Gợi ý sử dụng</h2>
              <Percent className="h-4 w-4 text-slate-400" />
            </div>
            <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-slate-600">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Mở <strong className="font-semibold text-slate-800">Lịch sử</strong> để xem
                từng mốc NTD đã cập nhật.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                Dùng mã đơn khi liên hệ hỗ trợ hoặc nhà tuyển dụng.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                Đơn ở bước Phỏng vấn / Đề nghị nên theo dõi thêm tại{' '}
                <Link href="/progress" className="font-semibold text-brand-600 hover:underline">
                  Tiến trình
                </Link>
                .
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function StatCell({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(7,35,72,0.04)]">
      <div className={clsx('flex h-9 w-9 items-center justify-center rounded-xl', iconClass)}>{icon}</div>
      <p className="mt-2 truncate text-[12px] text-slate-500">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight text-brand-800">{value}</p>
    </div>
  );
}

function ApplicationRecordCard({
  app,
  index,
  expanded,
  onToggleHistory,
}: {
  app: ApplicationView;
  index: number;
  expanded: boolean;
  onToggleHistory: () => void;
}) {
  return (
    <li
      id={`app-${app.id}`}
      className="progress-card overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-500 transition-transform duration-200 hover:scale-105 sm:h-[52px] sm:w-[52px]">
            {companyInitials(app.companyName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/jobs/${app.jobId}`}
                    className="text-[15px] font-bold text-slate-900 transition-colors hover:text-amber-700"
                  >
                    {app.jobTitle}
                  </Link>
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                      statusBadgeClass(app.status),
                    )}
                  >
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{app.companyName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                    <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                    {app.code}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {app.location || 'Thỏa thuận'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-slate-400" />
                    {formatSalary(app.salaryMin, app.salaryMax)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Nộp đơn: {formatAppliedDate(app.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {app.matchScore != null ? (
                  <div className="rounded-xl bg-accent-50 px-3 py-2 text-right">
                    <p className="text-[10px] font-medium text-slate-500">Phù hợp AI</p>
                    <p className="text-lg font-bold tabular-nums text-[#E8872A]">
                      {formatMatchPct(app.matchScore)}%
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Chưa có điểm khớp</p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/jobs/${app.jobId}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-700"
              >
                <Eye className="h-3.5 w-3.5" />
                Xem tin tuyển dụng
              </Link>
              <Link
                href="/progress"
                className="progress-btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Target className="h-3.5 w-3.5" />
                Tiến trình
              </Link>
              <button
                type="button"
                onClick={onToggleHistory}
                className={clsx(
                  'progress-btn',
                  expanded
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100',
                )}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" /> Thu gọn lịch sử
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" /> Lịch sử trạng thái
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-[#F8FAFC] px-4 py-4 sm:px-5 animate-soft-rise">
          <ApplicationTimelinePanel applicationId={app.id} />
        </div>
      )}
    </li>
  );
}

function ApplicationTimelinePanel({ applicationId }: { applicationId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['application-detail', applicationId],
    queryFn: () => getApplicationDetail(applicationId),
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải lịch sử trạng thái...</p>;
  }
  if (isError || !data) {
    return <p className="text-sm text-rose-600">Không tải được lịch sử đơn này.</p>;
  }

  if (data.timeline.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Chưa có mốc trạng thái. Khi nhà tuyển dụng cập nhật, lịch sử sẽ hiện tại đây.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Lịch sử trạng thái
        </p>
        {data.coverLetter && (
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-brand-600 hover:underline">
              Xem thư xin việc
            </summary>
            <p className="mt-2 max-w-xl whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-slate-600">
              {data.coverLetter}
            </p>
          </details>
        )}
      </div>
      <ol className="relative space-y-0 pl-1">
        {data.timeline.map((item, idx) => {
          const isLast = idx === data.timeline.length - 1;
          return (
            <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="flex w-4 flex-col items-center">
                <span
                  className={clsx(
                    'mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4',
                    isLast
                      ? 'bg-brand-500 ring-brand-100'
                      : 'bg-slate-300 ring-slate-100',
                  )}
                />
                {!isLast && <span className="mt-1 w-px flex-1 bg-slate-200" />}
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm transition-shadow duration-200 hover:shadow-md">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">
                    {item.description}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {formatDateTime(item.occurredAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
