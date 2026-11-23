'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Bookmark,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Filter,
  Gift,
  Heart,
  MapPin,
  Sparkles,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ApplicationStatus,
  ExperienceBand,
  InterviewStatus,
  OfferStatus,
  jobPublicPath,
  type ApplicationView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { CopilotRobot } from '@/components/copilot-robot';
import { myApplications } from '@/lib/applications';
import { ApiError } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { getMyCandidate } from '@/lib/candidate';
import { EXPERIENCE_LABEL, formatJobTitle, formatSalary } from '@/lib/format';
import { listMyInterviews } from '@/lib/interviews';
import {
  addJobBookmark,
  applyToJob,
  listBookmarkedJobs,
  removeJobBookmark,
} from '@/lib/jobs';
import { formatMatchPct, matchBadgeTone } from '@/lib/match-percent';
import { recommendedJobs } from '@/lib/matching';
import { listNotifications } from '@/lib/notifications';
import { listMyOffers } from '@/lib/offers';
import { apiPublicBase } from '@/lib/public-paths';

const PIPELINE: { status: ApplicationStatus; label: string; bar: string }[] = [
  { status: ApplicationStatus.Applied, label: 'Đã nộp', bar: 'bg-brand-700' },
  { status: ApplicationStatus.Screening, label: 'Sàng lọc', bar: 'bg-brand-500' },
  { status: ApplicationStatus.Interview, label: 'Phỏng vấn', bar: 'bg-brand-400' },
  { status: ApplicationStatus.Offer, label: 'Đề nghị', bar: 'bg-accent-500' },
  { status: ApplicationStatus.Hired, label: 'Nhận việc', bar: 'bg-emerald-500' },
];

const OPEN_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.Applied,
  ApplicationStatus.Screening,
  ApplicationStatus.Interview,
  ApplicationStatus.Offer,
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate, isLoading } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: applications } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
  });
  const { data: jobs } = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: recommendedJobs,
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
  const { data: bookmarks } = useQuery({
    queryKey: ['job-bookmarks'],
    queryFn: listBookmarkedJobs,
    retry: false,
  });
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
    retry: false,
  });

  const bookmarkedIds = useMemo(
    () => new Set((bookmarks ?? []).map((b) => b.id)),
    [bookmarks],
  );
  const appliedIds = useMemo(
    () => new Set((applications ?? []).map((a) => a.jobId)),
    [applications],
  );
  const [applyFeedback, setApplyFeedback] = useState<{ jobId: string; tone: 'ok' | 'err'; text: string } | null>(null);

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await removeJobBookmark(id);
      else await addJobBookmark(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['job-bookmarks'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (jobId: string) => applyToJob(jobId, {}),
    onSuccess: (_data, jobId) => {
      setApplyFeedback({ jobId, tone: 'ok', text: 'Đã gửi hồ sơ ứng tuyển thành công!' });
      void queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      void queryClient.invalidateQueries({ queryKey: ['recommended-jobs'] });
    },
    onError: (err, jobId) => {
      setApplyFeedback({
        jobId,
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không gửi được hồ sơ ứng tuyển',
      });
    },
  });

  const displayName = (candidate?.displayName ?? me?.displayName ?? 'bạn').replace(/\r/g, '');
  const apps = useMemo(() => applications ?? [], [applications]);
  const counts = useMemo(() => {
    const by = (status: ApplicationStatus) => apps.filter((row) => row.status === status).length;
    return {
      total: apps.length,
      open: apps.filter((row) => OPEN_STATUSES.includes(row.status)).length,
      rejected: apps.filter(
        (row) =>
          row.status === ApplicationStatus.Rejected ||
          row.status === ApplicationStatus.Withdrawn,
      ).length,
      pipeline: PIPELINE.map((step) => ({ ...step, count: by(step.status) })),
    };
  }, [apps]);

  const upcoming = useMemo(() => {
    const now = Date.now() - 60 * 60 * 1000;
    return [...(interviews ?? [])]
      .filter(
        (row) =>
          row.status === InterviewStatus.Scheduled && new Date(row.scheduledAt).getTime() >= now,
      )
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 3);
  }, [interviews]);

  const upcoming7DaysCount = useMemo(() => {
    const now = Date.now() - 60 * 60 * 1000;
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
    return (interviews ?? []).filter((row) => {
      const t = new Date(row.scheduledAt).getTime();
      return row.status === InterviewStatus.Scheduled && t >= now && t <= sevenDays;
    }).length;
  }, [interviews]);

  const pendingOffers = useMemo(
    () => (offers ?? []).filter((row) => row.status === OfferStatus.Pending).slice(0, 3),
    [offers],
  );

  const suggestions = useMemo(
    () =>
      [...(jobs ?? [])]
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, 3),
    [jobs],
  );

  const checklist = useMemo(() => {
    const profile = candidate?.profile;
    const sales = profile?.sales;
    return [
      { done: Boolean(profile?.currentPosition), label: 'Cập nhật vị trí hiện tại', href: '/profile/edit' },
      {
        done: Boolean(profile?.summary || candidate?.aiProfile?.summary),
        label: 'Thêm giới thiệu bản thân',
        href: '/profile/edit',
      },
      { done: (candidate?.skills?.length ?? 0) > 0, label: 'Thêm kỹ năng chuyên môn', href: '/profile?tab=skills' },
      {
        done: (candidate?.experiences?.length ?? 0) > 0,
        label: 'Thêm kinh nghiệm làm việc',
        href: '/profile?tab=experience',
      },
      {
        done: (sales?.desiredLocations?.length ?? 0) > 0,
        label: 'Cập nhật địa điểm mong muốn',
        href: '/profile/edit',
      },
      { done: Boolean(candidate?.hasAvatar), label: 'Cập nhật ảnh đại diện', href: '/profile/edit' },
    ];
  }, [candidate]);

  const missingSteps = useMemo(() => checklist.filter((step) => !step.done), [checklist]);
  const completionPct = Math.max(0, Math.min(100, candidate?.profileCompletion ?? 0));
  const weekDelta = useMemo(() => applicationWeekDelta(apps), [apps]);

  if (isLoading && !candidate) {
    return (
      <AppShell wide>
        <div className="h-56 animate-pulse rounded-2xl bg-gradient-to-r from-brand-100 via-white to-accent-100" />
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CandidateSidebar
          displayName={candidate?.displayName ?? me?.displayName ?? 'Ứng viên'}
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
          showProfileCard={false}
        />

        <div className="min-w-0 space-y-4">
          {/* Lời chào */}
          <section className="pt-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#072348] sm:text-[26px]">
              {greeting()}, {displayName}! <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cùng Inlink tìm công việc phù hợp và phát triển sự nghiệp trong lĩnh vực công nghiệp.
            </p>
          </section>

          {/* Hero Card: Hoàn thiện hồ sơ + Checklist + Robot Copilot */}
          <section className="relative overflow-hidden rounded-2xl border border-[#dce6f4] bg-gradient-to-r from-white via-[#F8FBFF] to-[#EEF5FF] p-5 shadow-xs sm:p-6">
            <div className="flex flex-col items-center gap-6 md:flex-row">
              {/* Vòng tròn % hoàn thiện hồ sơ */}
              <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 * (1 - completionPct / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold leading-none text-[#072348] tabular-nums">
                    {completionPct}%
                  </span>
                  <span className="mt-1 text-[11px] font-medium leading-tight text-slate-500">
                    Hoàn thiện
                    <br />
                    hồ sơ
                  </span>
                </div>
              </div>

              {/* Danh sách mục còn thiếu + CTA */}
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold text-[#072348]">
                  {completionPct >= 100
                    ? 'Hồ sơ của bạn đã hoàn thiện!'
                    : completionPct >= 60
                      ? 'Hồ sơ của bạn gần hoàn thiện!'
                      : 'Hoàn thiện hồ sơ để AI gợi ý việc chuẩn hơn'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {missingSteps.length > 0
                    ? `Còn ${missingSteps.length} mục để tăng cơ hội được nhà tuyển dụng chú ý.`
                    : 'Hồ sơ của bạn đã sẵn sàng để AI gợi ý và nhà tuyển dụng tiếp cận.'}
                </p>

                {missingSteps.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {missingSteps.slice(0, 2).map((step, idx) => (
                      <li key={step.label}>
                        <Link
                          href={step.href}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/40"
                        >
                          <span className="flex items-center gap-2.5 truncate">
                            {idx === 0 ? (
                              <Briefcase className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                            ) : (
                              <Heart className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                            )}
                            <span className="truncate">{step.label}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3.5">
                  <Link
                    href="/profile/edit"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#072348] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d3468] sm:w-auto sm:min-w-[240px]"
                  >
                    <span>{completionPct >= 100 ? 'Xem & cập nhật hồ sơ' : 'Hoàn thiện hồ sơ'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Robot Copilot minh họa bên phải */}
              <div className="hidden w-36 shrink-0 lg:block" aria-hidden>
                <CopilotRobot />
              </div>
            </div>
          </section>

          {/* 4 Thẻ KPI Tổng quan */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              href="/applications"
              icon={<ClipboardList className="h-4 w-4" />}
              iconTone="bg-amber-50 text-[#E8872A]"
              label="Đơn ứng tuyển"
              value={counts.total}
              badge={
                weekDelta > 0
                  ? {
                      text: `↑ +${weekDelta} so với tuần trước`,
                      tone: 'bg-emerald-50 text-emerald-700',
                    }
                  : undefined
              }
              hint={weekDelta <= 0 ? weekDeltaHint(weekDelta) : undefined}
            />
            <StatCard
              href="/progress#interviews"
              icon={<CalendarDays className="h-4 w-4" />}
              iconTone="bg-sky-50 text-sky-600"
              label="Lịch phỏng vấn"
              value={upcoming.length}
              hint={upcoming7DaysCount > 0 ? `${upcoming7DaysCount} lịch trong 7 ngày tới` : 'Trong 7 ngày tới'}
            />
            <StatCard
              href="/progress#offers"
              icon={<Gift className="h-4 w-4" />}
              iconTone="bg-amber-50 text-amber-600"
              label="Đề nghị làm việc"
              value={pendingOffers.length}
              badge={
                pendingOffers.length > 0
                  ? { text: 'Cần phản hồi ›', tone: 'bg-amber-50 text-[#c96a12]' }
                  : undefined
              }
              hint={pendingOffers.length === 0 ? 'Chưa có đề nghị chờ' : undefined}
            />
            <StatCard
              href="/saved-jobs"
              icon={<Bookmark className="h-4 w-4" />}
              iconTone="bg-indigo-50 text-brand-700"
              label="Việc đã lưu"
              value={bookmarks?.length ?? 0}
              hint={(bookmarks?.length ?? 0) > 0 ? 'Xem việc làm đã lưu ›' : 'Chưa lưu việc làm nào'}
            />
          </section>

          {/* Lưới 2 cột: Trái (Việc làm phù hợp) | Phải (Trạng thái ứng tuyển + Hành động tiếp theo) */}
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(310px,0.95fr)]">
            {/* Cột trái: Việc làm phù hợp với bạn */}
            <div className="rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-[#072348]">
                    <Sparkles className="h-4 w-4 text-sky-500" />
                    <span>Việc làm phù hợp với bạn</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Gợi ý từ AI dựa trên hồ sơ, kỹ năng và kinh nghiệm của bạn.
                  </p>
                </div>
                <Link
                  href="/recommended"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {suggestions.length === 0 ? (
                <Empty
                  text="Chưa có gợi ý. Hoàn thiện hồ sơ để AI chọn việc sát hơn."
                  href="/profile/edit"
                  action="Cập nhật hồ sơ"
                />
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {suggestions.map((job) => {
                    const isSaved = bookmarkedIds.has(job.jobId);
                    const isApplied = appliedIds.has(job.jobId);
                    const isApplying =
                      applyMutation.isPending && applyMutation.variables === job.jobId;
                    const fb = applyFeedback?.jobId === job.jobId ? applyFeedback : null;
                    const expLabel = job.experienceBand
                      ? EXPERIENCE_LABEL[job.experienceBand as ExperienceBand] ?? job.experienceBand
                      : 'Không yêu cầu';

                    return (
                      <li key={job.jobId} className="py-3.5 first:pt-1 last:pb-1">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-brand-700">
                            {job.companyHasLogo ? (
                              <img
                                src={`${apiPublicBase()}/companies/${job.companyId}/logo`}
                                alt={job.companyName}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              companyMark(job.companyName)
                            )}
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-stretch">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={jobPublicPath(job)}
                                className="line-clamp-1 text-[14.5px] font-bold text-[#072348] hover:text-brand-600"
                              >
                                {formatJobTitle(job.title)}
                              </Link>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {job.companyName}
                                {job.location ? ` · ${job.location}` : ''}
                              </p>

                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                                  <Banknote className="h-3 w-3 text-slate-500" />
                                  {formatSalary(job.salaryMin, job.salaryMax)}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                                  <Briefcase className="h-3 w-3 text-slate-500" />
                                  Kinh nghiệm {expLabel}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                                  <MapPin className="h-3 w-3 text-slate-500" />
                                  {job.location ?? 'Linh hoạt'}
                                </span>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-between">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={clsx(
                                    'rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
                                    matchBadgeTone(job.match.score),
                                  )}
                                >
                                  {formatMatchPct(job.match.score)}% phù hợp
                                </span>
                                <button
                                  type="button"
                                  disabled={bookmarkMutation.isPending}
                                  aria-label={isSaved ? 'Bỏ lưu' : 'Lưu tin'}
                                  onClick={() =>
                                    bookmarkMutation.mutate({ id: job.jobId, saved: isSaved })
                                  }
                                  className={clsx(
                                    'rounded-md p-1 transition',
                                    isSaved
                                      ? 'text-amber-500 hover:bg-amber-50'
                                      : 'text-slate-400 hover:bg-slate-100 hover:text-amber-500',
                                  )}
                                >
                                  <Bookmark
                                    className={clsx('h-4 w-4', isSaved && 'fill-current')}
                                  />
                                </button>
                              </div>

                              {isApplied ? (
                                <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Đã ứng tuyển
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isApplying}
                                  onClick={() => applyMutation.mutate(job.jobId)}
                                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#072348] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#0d3468] disabled:opacity-60"
                                >
                                  {isApplying ? 'Đang gửi...' : 'Ứng tuyển ngay'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {fb && (
                          <p
                            className={clsx(
                              'mt-1.5 pl-14 text-[11.5px] font-medium',
                              fb.tone === 'ok' ? 'text-emerald-700' : 'text-rose-600',
                            )}
                          >
                            {fb.text}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Cột phải: Trạng thái ứng tuyển + Hành động tiếp theo */}
            <div className="space-y-4">
              {/* Trạng thái ứng tuyển (5 bước ngang) */}
              <div className="rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-bold text-[#072348]">
                    <BarChart3 className="h-4 w-4 text-brand-600" />
                    <span>Trạng thái ứng tuyển</span>
                  </h2>
                  <Link
                    href="/applications"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="mt-4 flex items-start justify-between gap-1">
                  {counts.pipeline.map((step, idx) => {
                    const isOfferActive = step.status === ApplicationStatus.Offer && step.count > 0;
                    const stepIcons = [
                      <Check key="0" className="h-3.5 w-3.5" />,
                      <Filter key="1" className="h-3.5 w-3.5" />,
                      <CalendarDays key="2" className="h-3.5 w-3.5" />,
                      <Briefcase key="3" className="h-3.5 w-3.5" />,
                      <CheckCircle2 key="4" className="h-3.5 w-3.5" />,
                    ];
                    return (
                      <div key={step.status} className="flex flex-1 items-start">
                        <div className="flex flex-1 flex-col items-center text-center">
                          <span
                            className={clsx(
                              'flex h-8 w-8 items-center justify-center rounded-full',
                              idx === 0 && step.count > 0
                                ? 'bg-blue-600 text-white'
                                : isOfferActive
                                  ? 'bg-amber-100 text-[#E8872A]'
                                  : step.count > 0
                                    ? 'bg-sky-50 text-brand-700 ring-1 ring-brand-200'
                                    : 'bg-slate-100 text-slate-400',
                            )}
                          >
                            {stepIcons[idx]}
                          </span>
                          <span className="mt-1.5 text-[11px] font-medium text-slate-600">
                            {step.label}
                          </span>
                          <span
                            className={clsx(
                              'mt-0.5 text-sm font-extrabold tabular-nums',
                              isOfferActive ? 'text-[#E8872A]' : 'text-[#072348]',
                            )}
                          >
                            {step.count}
                          </span>
                        </div>
                        {idx < counts.pipeline.length - 1 && (
                          <ArrowRight className="mt-2.5 h-3 w-3 shrink-0 text-slate-300" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hành động tiếp theo */}
              <div className="rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-xs">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#072348]">
                  <Target className="h-4 w-4 text-brand-600" />
                  <span>Hành động tiếp theo</span>
                </h2>

                <ul className="mt-3 space-y-2.5">
                  {upcoming.slice(0, 1).map((item) => (
                    <li key={item.id}>
                      <Link
                        href="/progress#interviews"
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-3.5 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                            <CalendarDays className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#072348]">
                              Tham gia phỏng vấn
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              {formatJobTitle(item.jobTitle)} – {item.companyName}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-right">
                          <span className="text-[11px] font-medium text-slate-600">
                            {formatWhen(item.scheduledAt)}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </Link>
                    </li>
                  ))}

                  {pendingOffers.slice(0, 1).map((offer) => (
                    <li key={offer.id}>
                      <Link
                        href="/progress#offers"
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-3.5 py-2.5 transition hover:border-amber-200 hover:bg-amber-50/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[#E8872A]">
                            <Briefcase className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#072348]">
                              Phản hồi đề nghị làm việc
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              {formatJobTitle(offer.jobTitle)} – {offer.companyName}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold text-[#b45309]">
                            Cần phản hồi
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                      </Link>
                    </li>
                  ))}

                  {missingSteps.length > 0 && (
                    <li>
                      <Link
                        href="/profile/edit"
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-3.5 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-600">
                            <Sparkles className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#072348]">
                              Hoàn thiện hồ sơ ({missingSteps.length} mục còn thiếu)
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              {missingSteps.slice(0, 2).map((s) => s.label).join(', ')}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  )}

                  {upcoming.length === 0 && pendingOffers.length === 0 && missingSteps.length === 0 && (
                    <li>
                      <Link
                        href="/recommended"
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-3.5 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <Sparkles className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#072348]">
                              Khám phá thêm việc làm AI gợi ý
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              Xem toàn bộ danh sách tin tuyển dụng phù hợp hồ sơ của bạn
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  href,
  icon,
  iconTone,
  label,
  value,
  badge,
  hint,
}: {
  href: string;
  icon: ReactNode;
  iconTone: string;
  label: string;
  value: number;
  badge?: { text: string; tone: string };
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3.5 rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      <span
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105',
          iconTone,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold leading-tight tracking-tight text-[#072348] tabular-nums">
          {value}
        </p>
        {badge ? (
          <span
            className={clsx(
              'mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
              badge.tone,
            )}
          >
            {badge.text}
          </span>
        ) : hint ? (
          <p className="mt-1 truncate text-[11px] text-slate-500">{hint}</p>
        ) : null}
      </div>
    </Link>
  );
}

function Empty({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-slate-500">{text}</p>
      <Link href={href} className="mt-2 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-800">
        {action}
      </Link>
    </div>
  );
}

function companyMark(name: string): string {
  const words = name.trim().split(/\s+/).filter((part) => part.length > 1);
  const letters = words.slice(0, 2).map((part) => part[0]).join('');
  return (letters || name.slice(0, 2)).toUpperCase();
}

function applicationWeekDelta(apps: ApplicationView[]): number {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = apps.filter((row) => now - new Date(row.createdAt).getTime() < week).length;
  const prevWeek = apps.filter((row) => {
    const age = now - new Date(row.createdAt).getTime();
    return age >= week && age < week * 2;
  }).length;
  return thisWeek - prevWeek;
}

function weekDeltaHint(delta: number): string {
  if (delta > 0) return `+${delta} so với tuần trước`;
  if (delta < 0) return `${delta} so với tuần trước`;
  return 'Không đổi so với tuần trước';
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}
