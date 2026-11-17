'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  Gift,
  Lightbulb,
  MapPin,
  Search,
  Sparkles,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ApplicationStatus,
  InterviewStatus,
  OfferStatus,
  type ApplicationView,
  type InterviewView,
  type OfferView,
  type OnboardingView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { PaginationBar } from '@/components/pagination-bar';
import { Select } from '@/components/ui';
import { fetchMe } from '@/lib/auth';
import { getApplicationDetail, myApplications } from '@/lib/applications';
import { getMyCandidate } from '@/lib/candidate';
import {
  APPLICATION_STATUS_LABEL,
  formatJobTitle,
  formatSalary,
  formatVndAmount,
  INTERVIEW_TYPE_LABEL,
} from '@/lib/format';
import { listMyInterviews } from '@/lib/interviews';
import { formatMatchPct } from '@/lib/match-percent';
import { listMyOffers, respondToOffer } from '@/lib/offers';
import { listMyOnboardings } from '@/lib/onboarding';

type FilterTab = 'all' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
type SortMode = 'newest' | 'oldest' | 'match';

const PAGE_SIZE = 6;

const PIPELINE_STEPS: { status: ApplicationStatus; label: string }[] = [
  { status: ApplicationStatus.Applied, label: 'Đã nộp' },
  { status: ApplicationStatus.Screening, label: 'Sàng lọc' },
  { status: ApplicationStatus.Interview, label: 'Phỏng vấn' },
  { status: ApplicationStatus.Offer, label: 'Đề nghị' },
  { status: ApplicationStatus.Hired, label: 'Nhận việc' },
];

function stepIndexOf(status: ApplicationStatus): number {
  const idx = PIPELINE_STEPS.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
}

function formatShortDayMonth(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatTimeRange(iso: string): string {
  try {
    const d = new Date(iso);
    const weekday = d.toLocaleDateString('vi-VN', { weekday: 'short' });
    const dm = formatShortDayMonth(iso);
    const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${weekday} ${dm} · ${hm}`;
  } catch {
    return iso;
  }
}

function statusPillMeta(status: ApplicationStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case ApplicationStatus.Offer:
      return {
        label: 'Đề nghị làm việc',
        className: 'bg-amber-50 text-[#b45309] ring-1 ring-amber-200/80',
      };
    case ApplicationStatus.Interview:
      return {
        label: 'Phỏng vấn',
        className: 'bg-sky-50 text-brand-700 ring-1 ring-sky-200/80',
      };
    case ApplicationStatus.Screening:
      return {
        label: 'Sàng lọc',
        className: 'bg-amber-50/70 text-amber-700 ring-1 ring-amber-200/60',
      };
    case ApplicationStatus.Hired:
      return {
        label: 'Đã nhận việc',
        className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
      };
    case ApplicationStatus.Rejected:
    case ApplicationStatus.Withdrawn:
      return {
        label: APPLICATION_STATUS_LABEL[status] ?? 'Đã từ chối',
        className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
      };
    default:
      return {
        label: 'Đã nộp',
        className: 'bg-sky-50 text-brand-700 ring-1 ring-sky-200/70',
      };
  }
}

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>('all');
  const [statusSelect, setStatusSelect] = useState<string>('all');
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

  const respondOfferMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondToOffer(id, accept),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-offers'] });
      void queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      void queryClient.invalidateQueries({ queryKey: ['my-onboardings'] });
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
          a.status === ApplicationStatus.Rejected || a.status === ApplicationStatus.Withdrawn,
      ).length,
    };
  }, [apps]);

  const upcomingInterviews = useMemo(() => {
    const now = Date.now() - 60 * 60 * 1000;
    return [...(interviews ?? [])]
      .filter(
        (row) =>
          row.status === InterviewStatus.Scheduled && new Date(row.scheduledAt).getTime() >= now,
      )
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [interviews]);

  const pendingOffers = useMemo(
    () => (offers ?? []).filter((o) => o.status === OfferStatus.Pending),
    [offers],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = apps.filter((a) => {
      if (
        needle &&
        !a.jobTitle.toLowerCase().includes(needle) &&
        !a.companyName.toLowerCase().includes(needle) &&
        !a.code.toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (statusSelect !== 'all' && a.status !== statusSelect) return false;
      switch (tab) {
        case 'screening':
          return a.status === ApplicationStatus.Screening;
        case 'interview':
          return a.status === ApplicationStatus.Interview;
        case 'offer':
          return a.status === ApplicationStatus.Offer;
        case 'hired':
          return a.status === ApplicationStatus.Hired;
        case 'rejected':
          return (
            a.status === ApplicationStatus.Rejected ||
            a.status === ApplicationStatus.Withdrawn
          );
        default:
          return true;
      }
    });

    list = [...list].sort((a, b) => {
      if (sort === 'match') return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === 'newest' ? db - da : da - db;
    });
    return list;
  }, [apps, tab, statusSelect, sort, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Mặc định mở thẻ đầu tiên để hiển thị trực quan thanh tiến trình 5 bước như mẫu
  const effectiveExpandedId = expandedId ?? pageItems[0]?.id ?? null;

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
    setExpandedId(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const displayName = (candidate?.displayName ?? me?.displayName ?? 'Ứng viên').replace(/\r/g, '');
  const todoCount = pendingOffers.length + upcomingInterviews.length;

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)_285px]">
        <CandidateSidebar
          displayName={displayName}
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
        />

        {/* Cột giữa: Đơn ứng tuyển + Tiến trình */}
        <section className="min-w-0 space-y-4">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link href="/dashboard" className="hover:text-slate-600">
              Trang chủ
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-600">Đơn ứng tuyển</span>
          </nav>

          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[#072348]">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-[#E8872A]">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span>Đơn ứng tuyển của tôi</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý tất cả đơn ứng tuyển, theo dõi tiến trình phỏng vấn, đề nghị và nhận việc.
            </p>
          </div>

          {/* 5 KPI Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <StatCell
              active={tab === 'all'}
              onClick={() => {
                setTab('all');
                setPage(1);
              }}
              icon={<ClipboardList className="h-4 w-4" />}
              iconClass="bg-amber-100/80 text-[#E8872A]"
              label="Tổng đơn"
              value={counts.total}
              tint="bg-gradient-to-br from-amber-50/70 to-white border-amber-200/70"
            />
            <StatCell
              active={tab === 'screening'}
              onClick={() => {
                setTab('screening');
                setPage(1);
              }}
              icon={<Filter className="h-4 w-4" />}
              iconClass="bg-sky-50 text-sky-600"
              label="Sàng lọc"
              value={counts.screening}
            />
            <StatCell
              active={tab === 'interview'}
              onClick={() => {
                setTab('interview');
                setPage(1);
              }}
              icon={<CalendarDays className="h-4 w-4" />}
              iconClass="bg-indigo-50 text-brand-700"
              label="Phỏng vấn"
              value={counts.interview}
            />
            <StatCell
              active={tab === 'offer'}
              onClick={() => {
                setTab('offer');
                setPage(1);
              }}
              icon={<Briefcase className="h-4 w-4" />}
              iconClass="bg-amber-50 text-amber-600"
              label="Đề nghị"
              value={counts.offer}
            />
            <StatCell
              active={tab === 'hired'}
              onClick={() => {
                setTab('hired');
                setPage(1);
              }}
              icon={<CheckCircle2 className="h-4 w-4" />}
              iconClass="bg-emerald-50 text-emerald-600"
              label="Nhận việc"
              value={counts.hired}
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `Tất cả (${counts.total})` },
                { id: 'screening', label: `Sàng lọc (${counts.screening})` },
                { id: 'interview', label: `Phỏng vấn (${counts.interview})` },
                { id: 'offer', label: `Đề nghị (${counts.offer})` },
                { id: 'hired', label: `Nhận việc (${counts.hired})` },
                { id: 'rejected', label: `Đã từ chối (${counts.rejected})` },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setPage(1);
                  }}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    active
                      ? 'bg-[#E8872A] text-white shadow-2xs'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Search + Time + Status Select */}
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo vị trí, công ty..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-brand-500"
              />
            </div>

            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="!h-10 !rounded-xl !border-slate-200 !text-xs !text-slate-700"
            >
              <option value="newest">Thời gian: Mới nhất</option>
              <option value="oldest">Thời gian: Cũ nhất</option>
              <option value="match">Phù hợp AI cao nhất</option>
            </Select>

            <Select
              value={statusSelect}
              onChange={(e) => {
                setStatusSelect(e.target.value);
                setPage(1);
              }}
              className="!h-10 !rounded-xl !border-slate-200 !text-xs !text-slate-700"
            >
              <option value="all">Trạng thái: Tất cả</option>
              <option value={ApplicationStatus.Applied}>Đã nộp</option>
              <option value={ApplicationStatus.Screening}>Sàng lọc</option>
              <option value={ApplicationStatus.Interview}>Phỏng vấn</option>
              <option value={ApplicationStatus.Offer}>Đề nghị</option>
              <option value={ApplicationStatus.Hired}>Nhận việc</option>
              <option value={ApplicationStatus.Rejected}>Đã từ chối</option>
            </Select>
          </div>

          {/* Danh sách đơn ứng tuyển */}
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-white"
                />
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2.5 text-sm font-semibold text-slate-700">
                {apps.length === 0
                  ? 'Bạn chưa có đơn ứng tuyển nào.'
                  : 'Không tìm thấy đơn phù hợp bộ lọc.'}
              </p>
              <Link
                href="/viec-lam"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3468]"
              >
                <span>Khám phá việc làm</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {pageItems.map((app) => {
                const isExpanded = effectiveExpandedId === app.id;
                const appInterviews = (interviews ?? []).filter(
                  (iv) => iv.applicationId === app.id,
                );
                const appOffers = (offers ?? []).filter((of) => of.applicationId === app.id);
                const appOnboardings = (onboardings ?? []).filter(
                  (ob) => ob.applicationId === app.id,
                );

                return (
                  <ApplicationProgressCard
                    key={app.id}
                    app={app}
                    expanded={isExpanded}
                    interviews={appInterviews}
                    offers={appOffers}
                    onboardings={appOnboardings}
                    offerRespondPending={respondOfferMutation.isPending}
                    onRespondOffer={(id, accept) => respondOfferMutation.mutate({ id, accept })}
                    onToggle={() =>
                      setExpandedId((cur) => (cur === app.id ? '__none__' : app.id))
                    }
                  />
                );
              })}
            </ul>
          )}

          {filtered.length > PAGE_SIZE && (
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={goToPage}
            />
          )}
        </section>

        {/* Cột phải: Việc cần làm · Lịch sắp tới · Gợi ý tiếp theo */}
        <aside className="space-y-4">
          {/* 1. Việc cần làm */}
          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#072348]">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Việc cần làm ({todoCount})</span>
            </h2>

            {todoCount === 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                Hiện không có đề nghị hay lịch phỏng vấn nào cần xử lý gấp.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pendingOffers.map((offer) => (
                  <li key={offer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('offer');
                        setExpandedId(offer.applicationId);
                      }}
                      className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5 text-left transition hover:bg-amber-50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[#c96a12]">
                          <Gift className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#072348]">
                            Phản hồi đề nghị làm việc
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-600">
                            {formatJobTitle(offer.jobTitle)} – {offer.companyName}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  </li>
                ))}

                {upcomingInterviews.slice(0, 2).map((iv) => (
                  <li key={iv.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('interview');
                        setExpandedId(iv.applicationId);
                      }}
                      className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5 text-left transition hover:bg-sky-50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-brand-700">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#072348]">
                            Lịch phỏng vấn sắp tới
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-600">
                            {formatJobTitle(iv.jobTitle)} · {formatTimeRange(iv.scheduledAt)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 2. Lịch sắp tới */}
          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#072348]">
              <Calendar className="h-4 w-4 text-brand-600" />
              <span>Lịch sắp tới</span>
            </h2>

            {upcomingInterviews.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">Chưa có lịch phỏng vấn nào được hẹn.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {upcomingInterviews.slice(0, 3).map((iv) => {
                  const d = new Date(iv.scheduledAt);
                  const wk = d.toLocaleDateString('vi-VN', { weekday: 'short' });
                  const dm = formatShortDayMonth(iv.scheduledAt);
                  const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <li
                      key={iv.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-2.5"
                    >
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-center shadow-2xs ring-1 ring-slate-200/70">
                        <span className="text-[10px] font-bold uppercase text-brand-600">{wk}</span>
                        <span className="text-xs font-extrabold text-[#072348]">{dm}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#072348]">Phỏng vấn</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600">
                          {formatJobTitle(iv.jobTitle)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">🕒 {hm}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {upcomingInterviews.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTab('interview');
                  setPage(1);
                }}
                className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                <span>Xem toàn bộ lịch</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 3. Gợi ý tiếp theo */}
          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#072348]">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>Gợi ý tiếp theo</span>
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#072348]" />
                <span>Chuẩn bị kỹ câu chuyện doanh số hoặc dự án tiêu biểu trước buổi phỏng vấn.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#072348]" />
                <span>Theo dõi và phản hồi đề nghị làm việc đúng hạn để giữ uy tín hồ sơ.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#072348]" />
                <span>Cập nhật CV thường xuyên để AI gợi ý thêm nhiều vị trí phù hợp.</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function StatCell({
  active,
  onClick,
  icon,
  iconClass,
  label,
  value,
  tint,
}: {
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm',
        tint ?? 'border-[#dce6f4] bg-white',
        active && 'ring-2 ring-[#072348]/20',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', iconClass)}>
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-slate-600">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-[#072348]">
        {value}
      </p>
    </button>
  );
}

function ApplicationProgressCard({
  app,
  expanded,
  interviews,
  offers,
  onboardings,
  offerRespondPending,
  onRespondOffer,
  onToggle,
}: {
  app: ApplicationView;
  expanded: boolean;
  interviews: InterviewView[];
  offers: OfferView[];
  onboardings: OnboardingView[];
  offerRespondPending: boolean;
  onRespondOffer: (id: string, accept: boolean) => void;
  onToggle: () => void;
}) {
  const pill = statusPillMeta(app.status);
  const currentStep = stepIndexOf(app.status);
  const isRejected =
    app.status === ApplicationStatus.Rejected || app.status === ApplicationStatus.Withdrawn;

  const { data: detail } = useQuery({
    queryKey: ['application', app.id],
    queryFn: () => getApplicationDetail(app.id),
    enabled: expanded,
    retry: false,
  });

  const stepDates = useMemo(() => {
    const map = new Map<ApplicationStatus, string>();
    map.set(ApplicationStatus.Applied, formatShortDayMonth(app.createdAt));
    for (const ev of detail?.timeline ?? []) {
      const dateStr = formatShortDayMonth(ev.occurredAt);
      const t = ev.type.toUpperCase();
      if (t.includes('SCREEN') || t.includes('SHORTLIST')) {
        map.set(ApplicationStatus.Screening, dateStr);
      }
      else if (t.includes('INTERVIEW')) map.set(ApplicationStatus.Interview, dateStr);
      else if (t.includes('OFFER')) map.set(ApplicationStatus.Offer, dateStr);
      else if (t.includes('HIRED') || t.includes('ONBOARD')) map.set(ApplicationStatus.Hired, dateStr);
    }
    if (!map.has(ApplicationStatus.Interview) && interviews[0]?.scheduledAt) {
      map.set(ApplicationStatus.Interview, formatShortDayMonth(interviews[0].scheduledAt));
    }
    if (!map.has(ApplicationStatus.Offer) && offers[0]?.createdAt) {
      map.set(ApplicationStatus.Offer, formatShortDayMonth(offers[0].createdAt));
    }
    return map;
  }, [app.createdAt, detail?.timeline, interviews, offers]);

  return (
    <li
      className={clsx(
        'overflow-hidden rounded-2xl border bg-white transition',
        expanded
          ? 'border-amber-300/90 shadow-sm ring-1 ring-amber-200/50'
          : 'border-[#dce6f4] hover:border-brand-200 hover:shadow-xs',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-[#072348]">
            {companyInitials(app.companyName)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#072348]">
              {formatJobTitle(app.jobTitle)}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{app.companyName}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Ứng tuyển: {formatDate(app.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {app.location || 'Thỏa thuận'}
              </span>
              {app.matchScore != null && (
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                  <Sparkles className="h-3 w-3 text-sky-500" />
                  Phù hợp {formatMatchPct(app.matchScore)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={clsx('rounded-full px-3 py-1 text-[11px] font-semibold', pill.className)}>
            {pill.label}
          </span>
          <ChevronDown
            className={clsx(
              'h-4 w-4 text-slate-400 transition-transform duration-200',
              expanded && 'rotate-180 text-[#072348]',
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-[#FAFBFD] px-4 pb-4 pt-3.5">
          {/* Thanh tiến trình 5 bước */}
          {!isRejected ? (
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-[440px] items-start justify-between">
                {PIPELINE_STEPS.map((st, idx) => {
                  const done = idx < currentStep || app.status === ApplicationStatus.Hired;
                  const current = idx === currentStep && app.status !== ApplicationStatus.Hired;
                  const dateTxt = stepDates.get(st.status);
                  const isOfferCurrent = current && st.status === ApplicationStatus.Offer;

                  // Màu node theo từng bước & trạng thái giống mẫu
                  const circleClass = (() => {
                    if (done) {
                      if (st.status === ApplicationStatus.Interview) {
                        return 'bg-[#0B468C] text-white';
                      }
                      return 'bg-emerald-500 text-white';
                    }
                    if (current) {
                      if (st.status === ApplicationStatus.Offer || st.status === ApplicationStatus.Screening) {
                        return 'bg-[#F97316] text-white ring-4 ring-orange-100';
                      }
                      if (st.status === ApplicationStatus.Interview) {
                        return 'bg-[#0B468C] text-white ring-4 ring-sky-100';
                      }
                      return 'bg-emerald-500 text-white ring-4 ring-emerald-100';
                    }
                    return 'border-2 border-slate-300 bg-white text-transparent';
                  })();

                  // Màu đường nối tới bước tiếp theo
                  const renderConnector = () => {
                    if (idx >= PIPELINE_STEPS.length - 1) return null;
                    const isCompletedLink = idx < currentStep || app.status === ApplicationStatus.Hired;
                    const isPartialCurrent = idx === currentStep && app.status !== ApplicationStatus.Hired;

                    if (isCompletedLink) {
                      const isBlueLink = st.status === ApplicationStatus.Interview;
                      return (
                        <div className="mt-3.5 flex flex-1 items-center px-1.5">
                          <div
                            className={clsx(
                              'h-[2px] flex-1 rounded-full',
                              isBlueLink ? 'bg-[#0B468C]' : 'bg-emerald-500',
                            )}
                          />
                          <span
                            className={clsx(
                              '-ml-1 h-0 w-0 border-y-[3.5px] border-l-[5px] border-y-transparent',
                              isBlueLink ? 'border-l-[#0B468C]' : 'border-l-emerald-500',
                            )}
                          />
                        </div>
                      );
                    }

                    if (isPartialCurrent) {
                      const activeBarColor =
                        st.status === ApplicationStatus.Offer || st.status === ApplicationStatus.Screening
                          ? 'bg-[#F97316]'
                          : st.status === ApplicationStatus.Interview
                            ? 'bg-[#0B468C]'
                            : 'bg-emerald-500';
                      return (
                        <div className="mt-3.5 flex flex-1 items-center px-1.5">
                          <div className={clsx('h-[2px] w-2/5 rounded-l-full', activeBarColor)} />
                          <div className="h-[2px] flex-1 rounded-r-full bg-slate-200" />
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3.5 flex flex-1 items-center px-1.5">
                        <div className="h-[2px] flex-1 rounded-full bg-slate-200" />
                      </div>
                    );
                  };

                  return (
                    <div
                      key={st.status}
                      className={clsx(
                        'flex items-start',
                        idx < PIPELINE_STEPS.length - 1 ? 'flex-1' : 'shrink-0',
                      )}
                    >
                      <div className="flex min-w-[68px] flex-col items-center text-center">
                        <span
                          className={clsx(
                            'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                            circleClass,
                          )}
                        >
                          {done ? (
                            <Check className="h-3.5 w-3.5 stroke-[2.75]" />
                          ) : current ? (
                            <span className="h-2.5 w-2.5 rounded-full bg-white" />
                          ) : null}
                        </span>
                        <span
                          className={clsx(
                            'mt-1.5 text-[11px] font-semibold',
                            done || current ? 'text-[#072348]' : 'text-slate-400',
                          )}
                        >
                          {st.label}
                        </span>
                        <span
                          className={clsx(
                            'mt-0.5 text-[10px]',
                            isOfferCurrent
                              ? 'font-medium text-[#EA580C]'
                              : current && st.status === ApplicationStatus.Screening
                                ? 'font-medium text-[#EA580C]'
                                : 'text-slate-500',
                          )}
                        >
                          {isOfferCurrent ? 'Chờ phản hồi' : dateTxt || '—'}
                        </span>
                      </div>
                      {renderConnector()}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Đơn ứng tuyển này đã kết thúc ({APPLICATION_STATUS_LABEL[app.status]}).
            </p>
          )}

          {/* Chi tiết Lịch phỏng vấn / Đề nghị / Nhận việc thuộc đơn này */}
          {(interviews.length > 0 || offers.length > 0 || onboardings.length > 0) && (
            <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
              {interviews.map((iv) => (
                <div
                  key={iv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-100 bg-white px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#072348]">
                      📅 {INTERVIEW_TYPE_LABEL[iv.type] ?? 'Phỏng vấn'} · {formatTimeRange(iv.scheduledAt)}
                    </p>
                    {(iv.meetingLink || iv.location) && (
                      <p className="mt-0.5 text-slate-600">
                        Địa điểm / Link: {iv.meetingLink ?? iv.location}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                    {iv.status === InterviewStatus.Scheduled ? 'Đã lên lịch' : iv.status}
                  </span>
                </div>
              ))}

              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#072348]">
                      🎁 Đề nghị làm việc · Mức lương:{' '}
                      <span className="text-[#c96a12]">
                        {offer.salary != null
                          ? formatVndAmount(offer.salary)
                          : formatSalary(app.salaryMin, app.salaryMax)}
                      </span>
                    </p>
                    {offer.startDate && (
                      <p className="mt-0.5 text-slate-600">
                        Ngày dự kiến nhận việc: {formatDate(offer.startDate)}
                      </p>
                    )}
                  </div>

                  {offer.status === OfferStatus.Pending ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={offerRespondPending}
                        onClick={() => onRespondOffer(offer.id, false)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Từ chối</span>
                      </button>
                      <button
                        type="button"
                        disabled={offerRespondPending}
                        onClick={() => onRespondOffer(offer.id, true)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#072348] px-3 text-xs font-bold text-white hover:bg-[#0d3468] disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Đồng ý nhận việc</span>
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {offer.status === OfferStatus.Accepted ? 'Đã đồng ý' : 'Đã từ chối'}
                    </span>
                  )}
                </div>
              ))}

              {onboardings.map((ob) => (
                <div
                  key={ob.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-[#072348]">
                      Quá trình nhận việc (Onboarding)
                    </span>
                    {ob.startDate && (
                      <span className="text-slate-500">· Bắt đầu {formatDate(ob.startDate)}</span>
                    )}
                  </div>
                  <Link
                    href="/progress#onboarding"
                    className="font-semibold text-brand-600 hover:underline"
                  >
                    Xem checklist →
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400">Mã đơn: {app.code}</span>
            <Link
              href={`/jobs/${app.jobId}`}
              className="font-semibold text-brand-600 hover:underline"
            >
              Xem tin tuyển dụng →
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
