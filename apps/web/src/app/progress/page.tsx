'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgeCheck,
  Bell,
  Bookmark,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Gift,
  Headphones,
  LayoutDashboard,
  MapPin,
  Settings2,
  Sparkles,
  Target,
  UserPlus,
  UserRound,
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
import { PaginationBar } from '@/components/pagination-bar';
import { fetchMe, logout } from '@/lib/auth';
import { myApplications } from '@/lib/applications';
import { getMyCandidate } from '@/lib/candidate';
import { APPLICATION_STATUS_LABEL, formatSalary, formatVndAmount } from '@/lib/format';
import { listMyInterviews } from '@/lib/interviews';
import { listMyOffers, respondToOffer } from '@/lib/offers';
import { listMyOnboardings } from '@/lib/onboarding';
import { useRouter } from 'next/navigation';

type FilterTab = 'all' | 'processing' | 'interview' | 'offer' | 'rejected';
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

/** Màu từng bước pipeline theo mockup. */
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
    done: 'bg-sky-500 text-white',
    active: 'bg-sky-500 text-white',
    line: 'bg-sky-400',
    pulse: 'shadow-[0_0_0_4px_rgba(14,165,233,0.22)]',
  },
  [ApplicationStatus.Interview]: {
    done: 'bg-violet-500 text-white',
    active: 'bg-violet-500 text-white',
    line: 'bg-violet-400',
    pulse: 'shadow-[0_0_0_4px_rgba(139,92,246,0.25)]',
  },
  [ApplicationStatus.Offer]: {
    done: 'bg-orange-500 text-white',
    active: 'bg-orange-500 text-white',
    line: 'bg-orange-400',
    pulse: 'shadow-[0_0_0_4px_rgba(249,115,22,0.22)]',
  },
  [ApplicationStatus.Hired]: {
    done: 'bg-teal-500 text-white',
    active: 'bg-teal-500 text-white',
    line: 'bg-teal-400',
    pulse: 'shadow-[0_0_0_4px_rgba(20,184,166,0.22)]',
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
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case ApplicationStatus.Screening:
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case ApplicationStatus.Interview:
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    case ApplicationStatus.Offer:
      return 'bg-orange-50 text-orange-700 ring-orange-200';
    case ApplicationStatus.Hired:
      return 'bg-teal-50 text-teal-700 ring-teal-200';
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

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
  badgeTone = 'brand',
}: {
  href: string;
  label: string;
  icon: typeof Target;
  active?: boolean;
  badge?: string;
  badgeTone?: 'brand' | 'red';
}) {
  return (
    <Link
      href={href}
      className={clsx('progress-nav-item', active && 'progress-nav-item-active')}
    >
      <Icon
        className={clsx(
          'h-4 w-4 shrink-0 transition-colors duration-200',
          active ? 'text-brand-500' : 'text-slate-400 group-hover:text-slate-500',
        )}
        strokeWidth={1.75}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span
          className={clsx(
            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
            badgeTone === 'red'
              ? 'bg-rose-500 text-white'
              : 'bg-amber-500 text-white',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function ProgressPage() {
  const router = useRouter();
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
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Left */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-3 animate-soft-rise">
            <div className="progress-card p-5">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-sky-400 text-lg font-bold text-white shadow-md ring-4 ring-brand-50 transition-transform duration-300 hover:scale-105">
                    {initials}
                  </div>
                </div>
                <p className="mt-3 text-[15px] font-bold text-slate-900">{displayName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {candidate?.profile?.currentPosition ?? 'Chưa cập nhật vị trí'}
                </p>
              </div>
              {typeof candidate?.profileCompletion === 'number' && (
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Hoàn thiện hồ sơ</span>
                    <span className="font-bold text-brand-600">
                      {candidate.profileCompletion}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-soft"
                      style={{ width: `${candidate.profileCompletion}%` }}
                    />
                  </div>
                </div>
              )}
              <Link
                href="/dashboard"
                className="progress-btn mt-4 w-full border border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                Xem hồ sơ của tôi
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="progress-card p-3">
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Cá nhân
              </p>
              <nav className="space-y-0.5">
                <NavItem href="/dashboard" label="Tổng quan" icon={LayoutDashboard} />
                <NavItem href="/dashboard" label="Hồ sơ của tôi" icon={UserRound} />
                <NavItem href="/upload" label="CV & Thư xin việc" icon={FileText} />
                <NavItem href="/dashboard" label="Kỹ năng & Chứng chỉ" icon={BadgeCheck} />
                <NavItem href="/jobs?tab=saved" label="Việc làm đã lưu" icon={Bookmark} />
              </nav>

              <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Hoạt động
              </p>
              <nav className="space-y-0.5">
                <NavItem href="/applications" label="Đơn ứng tuyển" icon={ClipboardList} />
                <NavItem href="/progress" label="Tiến trình" icon={Target} active />
                <NavItem href="/progress#interviews" label="Lịch phỏng vấn" icon={CalendarDays} />
                <NavItem href="/progress#offers" label="Đề nghị làm việc" icon={Gift} />
                <NavItem
                  href="/progress#onboarding"
                  label="Quá trình nhận việc"
                  icon={UserPlus}
                />
              </nav>

              <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-3">
                <NavItem
                  href="/recommended"
                  label="Gợi ý việc làm AI"
                  icon={Sparkles}
                  badge="NEW"
                />
                <NavItem href="/notifications" label="Thông báo" icon={Bell} />
              </div>

              <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Cài đặt
              </p>
              <nav className="space-y-0.5">
                <NavItem href="/account" label="Tài khoản & Bảo mật" icon={Settings2} />
                <NavItem href="/account" label="Cài đặt thông báo" icon={Bell} />
              </nav>

              <button
                type="button"
                onClick={onLogout}
                className="progress-nav-item mt-1 w-full text-left text-slate-500"
              >
                Đăng xuất
              </button>
            </div>

            <div className="progress-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <Headphones className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Bạn cần hỗ trợ?</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Đội ngũ IndustrialLink sẵn sàng hỗ trợ bạn theo dõi tiến trình ứng tuyển.
                  </p>
                </div>
              </div>
              <a
                href="mailto:support@industriallink.vn"
                className="progress-btn mt-3 w-full border border-brand-200 bg-white text-brand-600 hover:bg-brand-50"
              >
                Liên hệ hỗ trợ
              </a>
            </div>
          </div>
        </aside>

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

          <h1 className="mt-2 text-[26px] font-bold tracking-tight text-slate-900">
            Tiến trình của tôi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi toàn bộ quá trình ứng tuyển của bạn
          </p>

          {/* Stats */}
          <div className="progress-card mt-5 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-2">
              <StatCell
                icon={<Briefcase className="h-4 w-4" />}
                iconClass="bg-emerald-50 text-emerald-600"
                label="Đã ứng tuyển"
                value={counts.total}
              />
              <StatCell
                icon={<ClipboardList className="h-4 w-4" />}
                iconClass="bg-sky-50 text-sky-600"
                label="Sàng lọc hồ sơ"
                value={counts.screening}
              />
              <StatCell
                icon={<Users className="h-4 w-4" />}
                iconClass="bg-violet-50 text-violet-600"
                label="Phỏng vấn"
                value={counts.interview}
              />
              <StatCell
                icon={<UserPlus className="h-4 w-4" />}
                iconClass="bg-orange-50 text-orange-600"
                label="Đề nghị làm việc"
                value={counts.offer}
              />
              <StatCell
                icon={<CheckCircle2 className="h-4 w-4" />}
                iconClass="bg-teal-50 text-teal-600"
                label="Đã nhận việc"
                value={counts.hired}
              />
            </div>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
              {(
                [
                  { n: counts.applied, c: 'bg-emerald-400' },
                  { n: counts.screening, c: 'bg-sky-400' },
                  { n: counts.interview, c: 'bg-violet-400' },
                  { n: counts.offer, c: 'bg-orange-400' },
                  { n: counts.hired, c: 'bg-teal-400' },
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

          {/* Tabs — underline style như mockup */}
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
            <div className="flex flex-wrap gap-0.5">
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
                    tab === t.id
                      ? 'text-amber-700'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  {t.label} ({t.count})
                  <span
                    className={clsx(
                      'absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-amber-500 transition-all duration-200 ease-soft',
                      tab === t.id ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50',
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="relative mb-1.5">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortMode);
                setPage(1);
              }}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-600 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
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
                  href="/jobs"
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
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-all duration-200 hover:gap-1.5 hover:text-brand-700"
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Lịch phỏng vấn sắp tới</h2>
              <CalendarDays className="h-4 w-4 text-amber-500" />
            </div>
            {upcomingInterviews.length === 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Chưa có lịch phỏng vấn sắp tới.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {upcomingInterviews.map((i) => (
                  <UpcomingInterviewCard key={i.id} interview={i} />
                ))}
              </ul>
            )}
          </div>

          <div id="offers" className="progress-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Đề nghị làm việc</h2>
              <Gift className="h-4 w-4 text-orange-500" />
            </div>
            {pendingOffers.length === 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Chưa có đề nghị đang chờ phản hồi.
              </p>
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Quá trình nhận việc</h2>
              <UserPlus className="h-4 w-4 text-teal-500" />
            </div>
            {!activeOnboarding ? (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Chưa có quá trình nhận việc. Khi bạn chấp nhận đề nghị, checklist sẽ hiện tại đây.
              </p>
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
    <div className="group flex items-center gap-2.5 rounded-xl px-1 py-1 transition-colors duration-200 hover:bg-slate-50/80">
      <div
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ease-soft group-hover:scale-105',
          iconClass,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] leading-tight text-slate-500">{label}</p>
        <p className="text-xl font-bold tabular-nums tracking-tight text-slate-900">
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
      className="progress-card p-4 sm:p-5"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-500 transition-transform duration-200 hover:scale-105 sm:h-[52px] sm:w-[52px]">
          {companyInitials(app.companyName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/jobs/${app.jobId}`}
                className="text-[15px] font-bold text-slate-900 transition-colors duration-200 hover:text-amber-700"
              >
                {app.jobTitle}
              </Link>
              <p className="mt-0.5 text-sm text-slate-500">{app.companyName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {app.location || 'Thỏa thuận'}
                </span>
                <span className="hidden text-slate-300 sm:inline">|</span>
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
                  className="text-xs font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline"
                >
                  Xem chi tiết
                </Link>
                {hasInterview && app.status === ApplicationStatus.Interview && (
                  <a
                    href="#interviews"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 transition-colors duration-200 hover:text-violet-700 hover:underline"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Lịch phỏng vấn
                  </a>
                )}
                {hasOffer && app.status === ApplicationStatus.Offer && (
                  <button
                    type="button"
                    onClick={onViewOffer}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 transition-colors duration-200 hover:text-orange-700 hover:underline"
                  >
                    <Gift className="h-3.5 w-3.5" />
                    Xem đề nghị
                  </button>
                )}
              </div>
            </div>
          </div>

          <PipelineStepper currentIdx={currentIdx} failAt={failAt} rejected={rejected} />

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
                className="progress-btn bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Lịch phỏng vấn
              </a>
            )}
            {hasOffer && app.status === ApplicationStatus.Offer && (
              <button
                type="button"
                onClick={onViewOffer}
                className="progress-btn bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100"
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
}: {
  currentIdx: number;
  failAt: number;
  rejected: boolean;
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
    <li className="group rounded-xl border border-slate-100 bg-[#F8FAFC] p-3 transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-amber-200 hover:bg-white hover:shadow-sm">
      <div className="flex gap-3">
        <div className="flex w-[52px] shrink-0 flex-col items-center justify-center rounded-lg bg-white px-1 py-2 shadow-sm ring-1 ring-amber-100/80 transition-shadow duration-200 group-hover:shadow-md">
          <p className="text-[10px] font-medium capitalize text-slate-500">{weekday}</p>
          <p className="text-[22px] font-bold leading-none text-amber-600">{day}</p>
          <p className="mt-0.5 text-[9px] font-semibold tracking-wide text-slate-400">
            {month}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{interview.jobTitle}</p>
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
                isOnline ? 'bg-emerald-500' : 'bg-sky-500',
              )}
            />
            <span className="truncate">{place}</span>
          </p>
          <Link
            href={`/jobs/${interview.jobId}`}
            className="progress-btn mt-2.5 w-full border border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
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
          ? 'border-orange-300 bg-orange-50/40 shadow-sm ring-2 ring-orange-100'
          : 'border-slate-100 bg-[#F8FAFC] hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-sm',
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
