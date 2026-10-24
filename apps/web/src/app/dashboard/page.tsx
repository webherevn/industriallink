'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bookmark,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Gift,
  MapPin,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import {
  ApplicationStatus,
  InterviewStatus,
  InterviewType,
  OfferStatus,
  jobPublicPath,
  type ApplicationView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { myApplications } from '@/lib/applications';
import { fetchMe } from '@/lib/auth';
import { getMyCandidate } from '@/lib/candidate';
import { APPLICATION_STATUS_LABEL, formatJobTitle, formatSalary } from '@/lib/format';
import { listMyInterviews } from '@/lib/interviews';
import { listBookmarkedJobs } from '@/lib/jobs';
import { formatMatchPct } from '@/lib/match-percent';
import { recommendedJobs } from '@/lib/matching';
import { listNotifications } from '@/lib/notifications';
import { listMyOffers } from '@/lib/offers';

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

  const displayName = (candidate?.displayName ?? me?.displayName ?? 'bạn').replace(/\r/g, '');
  const apps = useMemo(() => applications ?? [], [applications]);
  const counts = useMemo(() => {
    const by = (status: ApplicationStatus) => apps.filter((row) => row.status === status).length;
    return {
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

  const recentApps = useMemo(
    () =>
      [...apps]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [apps],
  );

  const checklist = useMemo(() => {
    const profile = candidate?.profile;
    const sales = profile?.sales;
    return [
      { done: Boolean(profile?.currentPosition), label: 'Vị trí hiện tại', href: '/profile/edit' },
      {
        done: Boolean(profile?.summary || candidate?.aiProfile?.summary),
        label: 'Giới thiệu bản thân',
        href: '/profile/edit',
      },
      { done: (candidate?.skills?.length ?? 0) > 0, label: 'Kỹ năng', href: '/profile?tab=skills' },
      {
        done: (candidate?.experiences?.length ?? 0) > 0,
        label: 'Kinh nghiệm',
        href: '/profile?tab=experience',
      },
      {
        done: (sales?.desiredLocations?.length ?? 0) > 0,
        label: 'Địa điểm mong muốn',
        href: '/profile/edit',
      },
      { done: Boolean(candidate?.hasAvatar), label: 'Ảnh đại diện', href: '/profile/edit' },
    ];
  }, [candidate]);

  const doneSteps = checklist.filter((step) => step.done).length;
  const pipelineMax = Math.max(1, ...counts.pipeline.map((step) => step.count));

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
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 p-5 text-white shadow-xl shadow-brand-700/15 sm:p-6">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-accent-400/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-wrap items-end justify-between gap-4 animate-soft-rise">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Tổng quan
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {greeting()}, {firstName(displayName)}
                </h1>
                <p className="mt-1 max-w-xl text-sm text-white/75">
                  {candidate?.profile?.currentPosition
                    ? `${candidate.profile.currentPosition} · theo dõi đơn, lịch và việc phù hợp.`
                    : 'Theo dõi đơn ứng tuyển, lịch phỏng vấn và việc làm phù hợp.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/viec-lam"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-brand-800 transition hover:bg-accent-50"
                >
                  <Briefcase className="h-4 w-4" />
                  Tìm việc
                </Link>
                <Link
                  href="/recommended"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
                >
                  <Sparkles className="h-4 w-4" />
                  Gợi ý AI
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              href="/applications"
              icon={<ClipboardList className="h-4 w-4" />}
              label="Đơn đang xử lý"
              value={counts.open}
              hint={`${apps.length} đơn đã nộp`}
              delay="0ms"
            />
            <Stat
              href="/progress#interviews"
              icon={<CalendarDays className="h-4 w-4" />}
              label="Phỏng vấn sắp tới"
              value={upcoming.length}
              hint="Lịch còn hiệu lực"
              delay="60ms"
            />
            <Stat
              href="/progress#offers"
              icon={<Gift className="h-4 w-4" />}
              label="Đề nghị chờ trả lời"
              value={pendingOffers.length}
              hint="Cần phản hồi"
              delay="120ms"
            />
            <Stat
              href="/viec-lam?tab=saved"
              icon={<Bookmark className="h-4 w-4" />}
              label="Việc đã lưu"
              value={bookmarks?.length ?? 0}
              hint={`${notifications?.unreadCount ?? 0} thông báo chưa đọc`}
              delay="180ms"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="space-y-4">
              <Panel
                title="Việc làm phù hợp"
                hint="Ba tin AI xếp điểm cao nhất."
                href="/recommended"
                action="Xem tất cả"
                delay="80ms"
              >
                {suggestions.length === 0 ? (
                  <Empty
                    text="Chưa có gợi ý. Hoàn thiện hồ sơ để AI chọn việc sát hơn."
                    href="/profile/edit"
                    action="Cập nhật hồ sơ"
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {suggestions.map((job) => (
                      <li key={job.jobId}>
                        <Link
                          href={jobPublicPath(job)}
                          className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-brand-800">
                              {formatJobTitle(job.title)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {job.companyName}
                              {job.location ? ` · ${job.location}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-accent-100">
                            {formatMatchPct(job.match.score)}%
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Đơn gần đây"
                hint="Trạng thái mới nhất của hồ sơ đã nộp."
                href="/applications"
                action="Theo dõi đơn"
                delay="140ms"
              >
                {recentApps.length === 0 ? (
                  <Empty
                    text="Bạn chưa nộp đơn nào."
                    href="/viec-lam"
                    action="Xem việc làm"
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {recentApps.map((app) => (
                      <ApplicationRow key={app.id} app={app} />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel title="Hồ sơ" hint={`${doneSteps}/${checklist.length} mục đã có`} delay="100ms">
                <div className="px-5 pb-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Mức hoàn thiện</span>
                    <span className="font-bold text-brand-700">
                      {candidate?.profileCompletion ?? 0}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all duration-700"
                      style={{ width: `${candidate?.profileCompletion ?? 0}%` }}
                    />
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-slate-100">
                  {checklist.map((step) => (
                    <li key={step.label}>
                      <Link
                        href={step.href}
                        className="flex items-center gap-2.5 px-5 py-2.5 text-sm transition hover:bg-slate-50"
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                        )}
                        <span className={step.done ? 'text-slate-700' : 'text-slate-500'}>
                          {step.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="px-5 py-3">
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-800"
                  >
                    <UserRound className="h-4 w-4" />
                    Xem hồ sơ
                  </Link>
                </div>
              </Panel>

              <Panel title="Lịch sắp tới" href="/progress#interviews" action="Xem tiến trình" delay="160ms">
                {upcoming.length === 0 && pendingOffers.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-500">Chưa có lịch phỏng vấn hay đề nghị mới.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {upcoming.map((item) => (
                      <li key={item.id} className="px-5 py-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {formatJobTitle(item.jobTitle)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {interviewTypeLabel(item.type)} · {item.companyName}
                        </p>
                        <p className="mt-1 text-xs font-medium text-brand-700">
                          {formatWhen(item.scheduledAt)}
                        </p>
                      </li>
                    ))}
                    {pendingOffers.map((offer) => (
                      <li key={offer.id} className="px-5 py-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {formatJobTitle(offer.jobTitle)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Đề nghị · {offer.companyName} · {formatSalary(offer.salary, offer.salary)}
                        </p>
                        <Link
                          href="/progress#offers"
                          className="mt-1 inline-flex text-xs font-semibold text-accent-700 hover:underline"
                        >
                          Phản hồi đề nghị
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </section>

          <section
            className="animate-soft-rise rounded-xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            style={{ animationDelay: '200ms' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-brand-800">Hành trình ứng tuyển</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {counts.rejected > 0
                    ? `${counts.rejected} đơn đã đóng hoặc đã rút.`
                    : 'Số đơn đang đứng ở từng bước.'}
                </p>
              </div>
              <Link href="/progress" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
                Tiến trình
              </Link>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-5">
              {counts.pipeline.map((step) => (
                <li key={step.status}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{step.label}</span>
                    <span className="font-semibold tabular-nums text-brand-800">{step.count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={clsx('h-full origin-left animate-bar-grow rounded-full', step.bar)}
                      style={{ width: apps.length ? `${(step.count / pipelineMax) * 100}%` : '0%' }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  href,
  icon,
  label,
  value,
  hint,
  delay,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  delay: string;
}) {
  return (
    <Link
      href={href}
      className="progress-card animate-soft-rise p-4"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-brand-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Link>
  );
}

function Panel({
  title,
  hint,
  href,
  action,
  delay,
  children,
}: {
  title: string;
  hint?: string;
  href?: string;
  action?: string;
  delay?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="animate-soft-rise overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      style={delay ? { animationDelay: delay } : undefined}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-brand-800">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {href && action ? (
          <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600 hover:text-brand-800">
            {action}
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ApplicationRow({ app }: { app: ApplicationView }) {
  return (
    <li>
      <Link href="/applications" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{formatJobTitle(app.jobTitle)}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            {app.companyName}
            {app.location ? ` · ${app.location}` : ''}
          </p>
        </div>
        <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', statusClass(app.status))}>
          {APPLICATION_STATUS_LABEL[app.status] ?? app.status}
        </span>
      </Link>
    </li>
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

function statusClass(status: ApplicationStatus): string {
  switch (status) {
    case ApplicationStatus.Interview:
      return 'bg-violet-50 text-violet-700';
    case ApplicationStatus.Offer:
      return 'bg-accent-50 text-accent-700';
    case ApplicationStatus.Hired:
      return 'bg-emerald-50 text-emerald-700';
    case ApplicationStatus.Rejected:
    case ApplicationStatus.Withdrawn:
      return 'bg-slate-100 text-slate-600';
    case ApplicationStatus.Screening:
      return 'bg-sky-50 text-sky-700';
    default:
      return 'bg-brand-50 text-brand-700';
  }
}

function interviewTypeLabel(type: InterviewType): string {
  if (type === InterviewType.Hr) return 'Phỏng vấn HR';
  if (type === InterviewType.Technical) return 'Phỏng vấn chuyên môn';
  return 'Phỏng vấn';
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function firstName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || 'bạn';
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
