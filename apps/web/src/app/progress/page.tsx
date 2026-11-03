'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Gift,
  MapPin,
  Target,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ApplicationStatus,
  InterviewStatus,
  OfferStatus,
  OnboardingStatus,
  type ApplicationView,
  type InterviewView,
  type OfferView,
  type OnboardingView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { PaginationBar } from '@/components/pagination-bar';
import { fetchMe } from '@/lib/auth';
import { myApplications } from '@/lib/applications';
import { getMyCandidate } from '@/lib/candidate';
import { APPLICATION_STATUS_LABEL, formatSalary, formatVndAmount, INTERVIEW_TYPE_LABEL } from '@/lib/format';
import { listMyInterviews } from '@/lib/interviews';
import { listMyOffers, respondToOffer } from '@/lib/offers';
import { listMyOnboardings } from '@/lib/onboarding';

type FilterTab = 'all' | 'processing' | 'interview' | 'offer' | 'hired' | 'rejected';
type SortMode = 'newest' | 'oldest';

const PAGE_SIZE = 5;

const PIPELINE: ApplicationStatus[] = [
  ApplicationStatus.Applied,
  ApplicationStatus.Screening,
  ApplicationStatus.Interview,
  ApplicationStatus.Offer,
  ApplicationStatus.Hired,
];

const PIPELINE_SHORT: Record<string, string> = {
  [ApplicationStatus.Applied]: 'Đã ứng tuyển',
  [ApplicationStatus.Screening]: 'Sàng lọc',
  [ApplicationStatus.Interview]: 'Phỏng vấn',
  [ApplicationStatus.Offer]: 'Đề nghị',
  [ApplicationStatus.Hired]: 'Nhận việc',
};

/** Màu từng bước: navy, cam và xanh hoàn tất. */
const STEP_TONE: Record<
  string,
  { done: string; active: string; line: string; pulse: string }
> = {
  [ApplicationStatus.Applied]: {
    done: 'bg-emerald-500 text-white',
    active: 'bg-emerald-500 text-white',
    line: 'bg-emerald-400',
    pulse: 'shadow-[0_0_0_4px_rgba(16,185,129,0.2)]',
  },
  [ApplicationStatus.Screening]: {
    done: 'bg-brand-500 text-white',
    active: 'bg-brand-600 text-white',
    line: 'bg-brand-400',
    pulse: 'shadow-[0_0_0_4px_rgba(7,35,72,0.16)]',
  },
  [ApplicationStatus.Interview]: {
    done: 'bg-brand-600 text-white',
    active: 'bg-brand-700 text-white',
    line: 'bg-brand-500',
    pulse: 'shadow-[0_0_0_4px_rgba(7,35,72,0.18)]',
  },
  [ApplicationStatus.Offer]: {
    done: 'bg-accent-500 text-white',
    active: 'bg-accent-500 text-white',
    line: 'bg-accent-400',
    pulse: 'shadow-[0_0_0_4px_rgba(232,135,42,0.25)]',
  },
  [ApplicationStatus.Hired]: {
    done: 'bg-emerald-500 text-white',
    active: 'bg-emerald-500 text-white',
    line: 'bg-emerald-400',
    pulse: 'shadow-[0_0_0_4px_rgba(16,185,129,0.2)]',
  },
};

const DEFAULT_ONBOARDING_STEPS = [
  'Ký hợp đồng lao động',
  'Nộp hồ sơ nhân sự',
  'Khám sức khỏe',
  'Nhận việc',
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

function formatInterviewDay(iso: string): { weekday: string; day: string; month: string } {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'short' });
  const day = d.toLocaleDateString('vi-VN', { day: '2-digit' });
  const month = `THÁNG ${d.getMonth() + 1}`;
  return { weekday, day, month };
}

function formatTimeRange(iso: string, durationMinutes: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const fmt = (x: Date) =>
    x.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatOfferSalary(n: number, currency: string): string {
  if (currency === 'VND' || !currency) {
    return formatVndAmount(n);
  }
  return `${n.toLocaleString('vi-VN')} ${currency}`;
}

function pipelineIndex(status: ApplicationStatus): number {
  return PIPELINE.indexOf(status);
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

function parseChecklist(raw: string | null): { label: string; done: boolean }[] {
  if (!raw?.trim()) {
    return DEFAULT_ONBOARDING_STEPS.map((label) => ({ label, done: false }));
  }
  const lines = raw
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return DEFAULT_ONBOARDING_STEPS.map((label) => ({ label, done: false }));
  }
  return lines.map((line) => {
    const done = /^(\[x\]|✓|✔|done:|hoàn)/i.test(line);
    const label = line.replace(/^(\[x\]|\[\s*\]|✓|✔|done:|chưa:)\s*/i, '').trim() || line;
    return { label, done };
  });
}

export default function ProgressPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [page, setPage] = useState(1);
  const [offerFocusId, setOfferFocusId] = useState<string | null>(null);
  const [offerExpandedId, setOfferExpandedId] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
  });
  const { data: interviews } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: listMyInterviews,
    retry: false,
  });
  const { data: offers } = useQuery({
    queryKey: ['my-offers'],
    queryFn: listMyOffers,
    retry: false,
  });
  const { data: onboardings } = useQuery({
    queryKey: ['my-onboardings'],
    queryFn: listMyOnboardings,
    retry: false,
  });

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToOffer(id, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-offers'] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['my-onboardings'] });
      setOfferExpandedId(null);
    },
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
      processing: apps.filter((a) =>
        (
          [
            ApplicationStatus.Applied,
            ApplicationStatus.Screening,
            ApplicationStatus.Interview,
            ApplicationStatus.Offer,
          ] as ApplicationStatus[]
        ).includes(a.status),
      ).length,
    };
  }, [apps]);

  const filtered = useMemo(() => {
    let list = [...apps];
    switch (tab) {
      case 'processing':
        list = list.filter((a) =>
          (
            [
              ApplicationStatus.Applied,
              ApplicationStatus.Screening,
              ApplicationStatus.Interview,
              ApplicationStatus.Offer,
            ] as ApplicationStatus[]
          ).includes(a.status),
        );
        break;
      case 'interview':
        list = list.filter((a) => a.status === ApplicationStatus.Interview);
        break;
      case 'offer':
        list = list.filter((a) => a.status === ApplicationStatus.Offer);
        break;
      case 'hired':
        list = list.filter((a) => a.status === ApplicationStatus.Hired);
        break;
      case 'rejected':
        list = list.filter(
          (a) =>
            a.status === ApplicationStatus.Rejected ||
            a.status === ApplicationStatus.Withdrawn,
        );
        break;
      default:
        break;
    }
    list.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === 'newest' ? db - da : da - db;
    });
    return list;
  }, [apps, tab, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const upcomingInterviews = useMemo(() => {
    const now = Date.now();
    return (interviews ?? [])
      .filter(
        (i) =>
          i.status === InterviewStatus.Scheduled &&
          new Date(i.scheduledAt).getTime() >= now - 60 * 60 * 1000,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      )
      .slice(0, 3);
  }, [interviews]);

  const pendingOffers = useMemo(
    () => (offers ?? []).filter((o) => o.status === OfferStatus.Pending).slice(0, 2),
    [offers],
  );

  const activeOnboarding = useMemo(() => {
    const list = onboardings ?? [];
    return (
      list.find((o) => o.status === OnboardingStatus.InProgress) ??
      list.find((o) => o.status === OnboardingStatus.Pending) ??
      list[0] ??
      null
    );
  }, [onboardings]);

  const interviewByApp = useMemo(() => {
    const map = new Map<string, InterviewView>();
    for (const i of interviews ?? []) {
      if (!map.has(i.applicationId)) map.set(i.applicationId, i);
    }
    return map;
  }, [interviews]);

  const offerByApp = useMemo(() => {
    const map = new Map<string, OfferView>();
    for (const o of offers ?? []) {
      if (!map.has(o.applicationId)) map.set(o.applicationId, o);
    }
    return map;
  }, [offers]);

  const distTotal =
    counts.applied +
      counts.screening +
      counts.interview +
      counts.offer +
      counts.hired || 1;

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

        {/* Center */}
        <section className="min-w-0 animate-soft-rise [animation-delay:60ms]">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
            <Link
              href="/dashboard"
              className="transition-colors duration-200 hover:text-brand-600"
            >
              Trang chủ
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>Tiến trình</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-600">Tiến trình của tôi</span>
          </nav>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-brand-800">
                  Tiến trình của tôi
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Theo dõi toàn bộ quá trình ứng tuyển của bạn.
                </p>
              </div>
            </div>
            <div className="relative hidden h-16 w-28 shrink-0 sm:block" aria-hidden>
              <span className="absolute right-1 top-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-accent-100">
                <CalendarDays className="h-6 w-6 text-accent-500" />
              </span>
              <span className="absolute bottom-1 left-2 h-1.5 w-10 rounded-full bg-accent-200" />
              <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-white">
                <Target className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="progress-card mt-5 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-2">
              <StatCell
                icon={<Briefcase className="h-4 w-4" />}
                iconClass="bg-brand-50 text-brand-600"
                label="Đã ứng tuyển"
                value={counts.total}
              />
              <StatCell
                icon={<ClipboardList className="h-4 w-4" />}
                iconClass="bg-accent-50 text-accent-600"
                label="Sàng lọc"
                value={counts.screening}
              />
              <StatCell
                icon={<Users className="h-4 w-4" />}
                iconClass="bg-brand-50 text-brand-700"
                label="Phỏng vấn"
                value={counts.interview}
              />
              <StatCell
                icon={<Gift className="h-4 w-4" />}
                iconClass="bg-accent-50 text-accent-700"
                label="Đề nghị làm việc"
                value={counts.offer}
              />
              <StatCell
                icon={<CheckCircle2 className="h-4 w-4" />}
                iconClass="bg-emerald-50 text-emerald-600"
                label="Đã nhận việc"
                value={counts.hired}
              />
            </div>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
              {(
                [
                  { n: counts.applied, c: 'bg-brand-300' },
                  { n: counts.screening, c: 'bg-brand-500' },
                  { n: counts.interview, c: 'bg-brand-600' },
                  { n: counts.offer, c: 'bg-accent-500' },
                  { n: counts.hired, c: 'bg-emerald-500' },
                ] as const
              ).map((seg, i) =>
                seg.n > 0 ? (
                  <div
                    key={i}
                    className={clsx(
                      'h-full transition-all duration-500 ease-soft first:rounded-l-full last:rounded-r-full',
                      seg.c,
                    )}
                    style={{ width: `${(seg.n / distTotal) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1">
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
                  'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200',
                  tab === t.id
                    ? 'bg-accent-500 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                )}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          <div className="relative mt-3 w-fit">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortMode);
                setPage(1);
              }}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-medium text-slate-600 transition-colors duration-200 hover:border-brand-200 hover:bg-slate-50 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Application list */}
          <ul className="mt-4 space-y-3">
            {appsLoading && (
              <li className="progress-card p-10 text-center text-sm text-slate-500">
                Đang tải tiến trình...
              </li>
            )}
            {!appsLoading && filtered.length === 0 && (
              <li className="progress-card border-dashed p-12 text-center">
                <Target className="mx-auto h-10 w-10 text-brand-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {apps.length === 0
                    ? 'Bạn chưa có đơn ứng tuyển nào'
                    : 'Không có hồ sơ trong bộ lọc này'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ứng tuyển việc phù hợp để theo dõi tiến trình tại đây.
                </p>
                <Link
                  href="/viec-lam"
                  className="progress-btn mt-4 bg-brand-600 text-white hover:bg-brand-700"
                >
                  Tìm việc làm
                </Link>
              </li>
            )}
            {pageItems.map((app, idx) => (
              <ApplicationCard
                key={app.id}
                app={app}
                index={idx}
                hasInterview={interviewByApp.has(app.id)}
                hasOffer={offerByApp.has(app.id)}
                onViewOffer={() => {
                  const o = offerByApp.get(app.id);
                  if (o) {
                    setOfferFocusId(o.id);
                    setOfferExpandedId(o.id);
                    document
                      .getElementById('offers')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            ))}
          </ul>

          {!appsLoading && filtered.length > 0 && (
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              itemLabel="hồ sơ"
              onChange={goToPage}
            />
          )}

          {apps.length > 0 && (
            <div className="mt-4 text-center">
              <Link
                href="/applications"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700"
              >
                Xem danh sách đơn ứng tuyển
                <ChevronDown className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>

        {/* Right */}
        <aside className="space-y-4 animate-soft-rise [animation-delay:120ms]">
          <div id="interviews" className="progress-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                <CalendarDays className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">Lịch phỏng vấn sắp tới</h2>
            </div>
            {upcomingInterviews.length === 0 ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  Chưa có lịch phỏng vấn sắp tới.
                </p>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-400">
                  <CalendarDays className="h-6 w-6" />
                </span>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {upcomingInterviews.map((i) => (
                  <UpcomingInterviewCard key={i.id} interview={i} />
                ))}
              </ul>
            )}
          </div>

          <div id="offers" className="progress-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                <Gift className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">Đề nghị làm việc</h2>
            </div>
            {pendingOffers.length === 0 ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  Chưa có đề nghị đang chờ phản hồi.
                </p>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-400">
                  <Gift className="h-6 w-6" />
                </span>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {pendingOffers.map((o) => (
                  <OfferWidget
                    key={o.id}
                    offer={o}
                    highlighted={offerFocusId === o.id}
                    expanded={offerExpandedId === o.id}
                    busy={respond.isPending && respond.variables?.id === o.id}
                    onToggle={() =>
                      setOfferExpandedId((cur) => (cur === o.id ? null : o.id))
                    }
                    onAccept={() => respond.mutate({ id: o.id, accept: true })}
                    onDecline={() => respond.mutate({ id: o.id, accept: false })}
                  />
                ))}
              </ul>
            )}
          </div>

          <div id="onboarding" className="progress-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <UserPlus className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">Quá trình nhận việc</h2>
            </div>
            {!activeOnboarding ? (
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  Chưa có quá trình nhận việc. Khi bạn chấp nhận đề nghị, checklist sẽ hiện tại đây.
                </p>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-400">
                  <ClipboardList className="h-6 w-6" />
                </span>
              </div>
            ) : (
              <OnboardingWidget item={activeOnboarding} />
            )}
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
    <div className="group flex min-w-0 items-center gap-2 rounded-xl px-0.5 py-1 transition-colors duration-200 hover:bg-slate-50/80">
      <div
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 ease-soft group-hover:scale-105',
          iconClass,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] leading-tight text-slate-500">{label}</p>
        <p className="text-xl font-bold tabular-nums tracking-tight text-brand-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function ApplicationCard({
  app,
  index,
  hasInterview,
  hasOffer,
  onViewOffer,
}: {
  app: ApplicationView;
  index: number;
  hasInterview: boolean;
  hasOffer: boolean;
  onViewOffer: () => void;
}) {
  const rejected =
    app.status === ApplicationStatus.Rejected ||
    app.status === ApplicationStatus.Withdrawn;
  const currentIdx = rejected ? -1 : pipelineIndex(app.status);
  const failAt = rejected ? 1 : -1;

  return (
    <li
      className="progress-card border-l-[3px] border-l-accent-400 p-4 sm:p-5"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-sm font-bold text-brand-700 sm:h-[52px] sm:w-[52px]">
          {companyInitials(app.companyName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/jobs/${app.jobId}`}
                className="text-[15px] font-bold text-brand-800 transition-colors duration-200 hover:text-brand-600"
              >
                {app.jobTitle}
              </Link>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{app.companyName}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
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
                Ứng tuyển: {formatAppliedDate(app.createdAt)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className={clsx(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition-opacity duration-200 hover:opacity-90',
                  statusBadgeClass(app.status),
                )}
              >
                {APPLICATION_STATUS_LABEL[app.status] ?? app.status}
              </span>
              <div className="hidden flex-col items-end gap-1.5 sm:flex">
                <Link
                  href="/applications"
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700"
                >
                  Xem chi tiết
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                {hasInterview && app.status === ApplicationStatus.Interview && (
                  <a
                    href="#interviews"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 transition-colors duration-200 hover:text-brand-800"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Lịch phỏng vấn
                  </a>
                )}
                {hasOffer && app.status === ApplicationStatus.Offer && (
                  <button
                    type="button"
                    onClick={onViewOffer}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 transition-colors duration-200 hover:text-accent-800"
                  >
                    <Gift className="h-3.5 w-3.5" />
                    Xem đề nghị
                  </button>
                )}
              </div>
            </div>
          </div>

          <PipelineStepper
            currentIdx={currentIdx}
            failAt={failAt}
            rejected={rejected}
            appliedAt={formatAppliedDate(app.createdAt)}
          />

          <div className="mt-3 flex flex-wrap gap-2 sm:hidden">
            <Link
              href="/applications"
              className="progress-btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Xem chi tiết
            </Link>
            {hasInterview && app.status === ApplicationStatus.Interview && (
              <a
                href="#interviews"
                className="progress-btn bg-brand-50 text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Lịch phỏng vấn
              </a>
            )}
            {hasOffer && app.status === ApplicationStatus.Offer && (
              <button
                type="button"
                onClick={onViewOffer}
                className="progress-btn bg-accent-50 text-accent-700 ring-1 ring-accent-100 hover:bg-accent-100"
              >
                <Gift className="h-3.5 w-3.5" />
                Xem đề nghị
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function PipelineStepper({
  currentIdx,
  failAt,
  rejected,
  appliedAt,
}: {
  currentIdx: number;
  failAt: number;
  rejected: boolean;
  appliedAt?: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto pb-0.5">
      <div className="flex min-w-[420px] items-start px-0.5">
        {PIPELINE.map((step, idx) => {
          const tone = STEP_TONE[step];
          const done = !rejected && currentIdx >= 0 && idx < currentIdx;
          const active = !rejected && idx === currentIdx;
          const failed = rejected && idx === failAt;
          const reached = done || active || (rejected && idx < failAt);

          return (
            <div key={step} className="flex flex-1 items-start last:flex-none last:w-auto">
              <div className="flex w-[4.75rem] flex-col items-center sm:w-[5.25rem]">
                <div
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ease-soft',
                    done && tone.done,
                    active && [tone.active, tone.pulse, 'animate-step-pulse scale-110'],
                    failed && 'bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.18)]',
                    !done &&
                      !active &&
                      !failed &&
                      'border-2 border-slate-200 bg-white text-slate-300',
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : failed ? (
                    <X className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : active ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </div>
                <span
                  className={clsx(
                    'mt-1.5 text-center text-[10px] font-medium leading-tight transition-colors duration-200',
                    active || done
                      ? 'text-slate-700'
                      : failed
                        ? 'text-rose-600'
                        : 'text-slate-400',
                  )}
                >
                  {PIPELINE_SHORT[step]}
                </span>
                {step === ApplicationStatus.Applied && (done || active) && appliedAt && (
                  <span className="mt-0.5 text-center text-[9px] text-slate-400">{appliedAt}</span>
                )}
              </div>
              {idx < PIPELINE.length - 1 && (
                <div className="relative mx-0 mt-3 h-0.5 min-w-[10px] flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={clsx(
                      'absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-soft',
                      reached
                        ? STEP_TONE[PIPELINE[idx]]?.line ?? 'bg-emerald-400'
                        : 'bg-transparent',
                    )}
                    style={{ width: done || (rejected && idx < failAt) ? '100%' : active ? '55%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingInterviewCard({ interview }: { interview: InterviewView }) {
  const { weekday, day, month } = formatInterviewDay(interview.scheduledAt);
  const isOnline = Boolean(interview.meetingLink);
  const place = isOnline
    ? 'Online (Google Meet)'
    : interview.location || 'Địa điểm cập nhật sau';

  return (
    <li className="group rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-accent-200 hover:bg-white hover:shadow-sm">
      <div className="flex gap-3">
        <div className="flex w-[52px] shrink-0 flex-col items-center justify-center rounded-lg bg-white px-1 py-2 shadow-sm ring-1 ring-accent-100 transition-shadow duration-200 group-hover:shadow-md">
          <p className="text-[10px] font-medium capitalize text-slate-500">{weekday}</p>
          <p className="text-[22px] font-bold leading-none text-accent-600">{day}</p>
          <p className="mt-0.5 text-[9px] font-semibold tracking-wide text-slate-400">
            {month}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{interview.jobTitle}</p>
          <p className="text-[11px] font-semibold text-brand-700">
            {INTERVIEW_TYPE_LABEL[interview.type] ?? interview.type}
          </p>
          <p className="truncate text-xs text-slate-500">{interview.companyName}</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-700">
            {formatTimeRange(interview.scheduledAt, interview.durationMinutes)}
          </p>
          {interview.interviewerName && (
            <p className="mt-0.5 text-[11px] text-slate-500">{interview.interviewerName}</p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span
              className={clsx(
                'h-1.5 w-1.5 rounded-full',
                isOnline ? 'bg-emerald-500' : 'bg-brand-500',
              )}
            />
            <span className="truncate">{place}</span>
          </p>
          <Link
            href={`/jobs/${interview.jobId}`}
            className="progress-btn mt-2.5 w-full border border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
    </li>
  );
}

function OfferWidget({
  offer,
  highlighted,
  expanded,
  busy,
  onToggle,
  onAccept,
  onDecline,
}: {
  offer: OfferView;
  highlighted: boolean;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <li
      className={clsx(
        'rounded-xl border p-3 transition-all duration-200 ease-soft',
        highlighted
          ? 'border-accent-300 bg-accent-50/60 shadow-sm ring-2 ring-accent-100'
          : 'border-slate-100 bg-slate-50 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-sm',
      )}
    >
      <div className="flex gap-2.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white text-xs font-bold text-slate-500">
          {companyInitials(offer.companyName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{offer.jobTitle}</p>
          <p className="truncate text-xs text-slate-500">{offer.companyName}</p>
          <p className="mt-1 text-sm font-bold text-emerald-600">
            {formatOfferSalary(offer.salary, offer.currency)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Gửi: {formatAppliedDate(offer.createdAt)}
          </p>

          {!expanded ? (
            <button
              type="button"
              onClick={onToggle}
              className="progress-btn mt-2.5 w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Xem đề nghị
            </button>
          ) : (
            <div className="mt-2.5 space-y-1.5 animate-soft-rise">
              {offer.benefits && (
                <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                  {offer.benefits}
                </p>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onAccept}
                  className="progress-btn flex-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Chấp nhận
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDecline}
                  className="progress-btn flex-1 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Từ chối
                </button>
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="w-full text-center text-[11px] text-slate-400 transition-colors hover:text-slate-600"
              >
                Thu gọn
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function OnboardingWidget({ item }: { item: OnboardingView }) {
  const steps = useMemo(() => {
    const parsed = parseChecklist(item.checklist);
    if (item.status === OnboardingStatus.Completed) {
      return parsed.map((s) => ({ ...s, done: true }));
    }
    return parsed;
  }, [item.checklist, item.status]);

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <p className="truncate font-semibold text-slate-800">{item.jobTitle}</p>
        <span className="shrink-0 font-bold text-brand-600">
          {doneCount}/{steps.length} hoàn thành
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">{item.companyName}</p>
      <ul className="mt-3 space-y-2">
        {steps.slice(0, 6).map((step) => (
          <li
            key={step.label}
            className="group flex items-center gap-2 rounded-lg px-1 py-0.5 text-xs transition-colors duration-200 hover:bg-slate-50"
          >
            <span
              className={clsx(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                step.done
                  ? 'bg-emerald-500 text-white'
                  : 'border border-slate-300 bg-white group-hover:border-brand-300',
              )}
            >
              {step.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className="flex-1 text-slate-700">{step.label}</span>
            <span className="text-[10px] text-slate-400">
              {step.done ? 'Hoàn tất' : 'Chưa bắt đầu'}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={`/jobs/${item.jobId}`}
        className="mt-3 block text-center text-xs font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline"
      >
        Xem chi tiết quá trình
      </Link>
    </div>
  );
}
