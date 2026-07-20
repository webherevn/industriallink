'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Target,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { ApplicationStatus, formatJobTitle } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CopilotRobot } from '@/components/copilot-robot';
import { Button, Card, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { askCopilot } from '@/lib/copilot';
import { getInterviewStats, listInterviews } from '@/lib/interviews';
import { listMyJobs } from '@/lib/jobs';
import { getWorkspaceSummary, listInbox } from '@/lib/recruiter';

type PipelineKey =
  | 'applied'
  | 'screening'
  | 'hr_interview'
  | 'tech_interview'
  | 'offer'
  | 'hired';

/** Màu pipeline theo mockup: 1 bước active xanh đậm, còn lại pastel */
const PIPELINE_STYLE: Record<
  PipelineKey,
  { idleBg: string; idleText: string; activeBg: string; activeText: string }
> = {
  applied: {
    idleBg: '#E8EEF8',
    idleText: '#334155',
    activeBg: '#1A56DB',
    activeText: '#FFFFFF',
  },
  screening: {
    idleBg: '#E2E8F0',
    idleText: '#334155',
    activeBg: '#1A56DB',
    activeText: '#FFFFFF',
  },
  hr_interview: {
    idleBg: '#DBEAFE',
    idleText: '#1E3A8A',
    activeBg: '#1A56DB',
    activeText: '#FFFFFF',
  },
  tech_interview: {
    idleBg: '#FFEDD5',
    idleText: '#9A3412',
    activeBg: '#1A56DB',
    activeText: '#FFFFFF',
  },
  offer: {
    idleBg: '#FED7AA',
    idleText: '#9A3412',
    activeBg: '#1A56DB',
    activeText: '#FFFFFF',
  },
  hired: {
    idleBg: '#D1FAE5',
    idleText: '#065F46',
    activeBg: '#1A56DB',
    activeText: '#FFFFFF',
  },
};

const PIPELINE_STAGES: { key: PipelineKey; label: string }[] = [
  { key: 'applied', label: 'Ứng tuyển' },
  { key: 'screening', label: 'Sàng lọc' },
  { key: 'hr_interview', label: 'Phỏng vấn HR' },
  { key: 'tech_interview', label: 'PV Chuyên môn' },
  { key: 'offer', label: 'Đề nghị' },
  { key: 'hired', label: 'Đã tuyển' },
];

const COPILOT_CHIPS = [
  { label: 'Tìm ứng viên phù hợp', href: '/search', icon: Search },
  { label: 'Tóm tắt ứng viên', href: '/recruiter/inbox', icon: Users },
  { label: 'Viết email mời phỏng vấn', href: '/recruiter/calendar', icon: Mail },
  { label: 'Phân tích tin tuyển dụng', href: '/jobs/manage', icon: FileSearch },
] as const;

export default function RecruiterDashboardPage() {
  const [copilotQ, setCopilotQ] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [copilotSources, setCopilotSources] = useState<string[]>([]);

  const copilotMutation = useMutation({
    mutationFn: (message: string) => askCopilot({ message }),
    onSuccess: (res) => {
      setCopilotAnswer(res.answer);
      setCopilotSources(res.sources.map((s) => s.title));
    },
    onError: () => {
      setCopilotAnswer(null);
      setCopilotSources([]);
    },
  });
  const [jobFilter, setJobFilter] = useState('all');
  const [pipelineActive, setPipelineActive] = useState<PipelineKey>('applied');

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['recruiter-workspace'],
    queryFn: getWorkspaceSummary,
    retry: false,
  });
  const { data: inbox } = useQuery({
    queryKey: ['recruiter-inbox-dash'],
    queryFn: () => listInbox(100),
    enabled: Boolean(data?.hasCompany),
    retry: false,
  });
  const { data: jobs } = useQuery({
    queryKey: ['my-jobs-dash'],
    queryFn: listMyJobs,
    enabled: Boolean(data?.hasCompany),
    retry: false,
  });
  const { data: interviewStats } = useQuery({
    queryKey: ['interview-stats'],
    queryFn: getInterviewStats,
    enabled: Boolean(data?.hasCompany),
    retry: false,
  });
  const interviewWindow = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const { data: upcomingInterviews } = useQuery({
    queryKey: ['interviews-dash', interviewWindow.from, interviewWindow.to, jobFilter],
    queryFn: () =>
      listInterviews({
        from: interviewWindow.from,
        to: interviewWindow.to,
        jobId: jobFilter === 'all' ? undefined : jobFilter,
        status: 'scheduled',
      }),
    enabled: Boolean(data?.hasCompany),
    retry: false,
  });

  const filteredInbox = useMemo(() => {
    if (jobFilter === 'all') return inbox ?? [];
    return (inbox ?? []).filter((a) => a.jobId === jobFilter);
  }, [inbox, jobFilter]);

  const pipelineCounts = useMemo(() => {
    const base = { applied: 0, screening: 0, offer: 0, hired: 0 };
    for (const a of filteredInbox) {
      if (a.status === ApplicationStatus.Applied) base.applied += 1;
      else if (a.status === ApplicationStatus.Screening) base.screening += 1;
      else if (a.status === ApplicationStatus.Offer) base.offer += 1;
      else if (a.status === ApplicationStatus.Hired) base.hired += 1;
    }
    const ivs = upcomingInterviews ?? [];
    return {
      applied: base.applied,
      screening: base.screening,
      hr_interview: ivs.filter((i) => i.type === 'hr').length,
      tech_interview: ivs.filter((i) => i.type === 'technical').length,
      offer: base.offer,
      hired: base.hired,
    } satisfies Record<PipelineKey, number>;
  }, [filteredInbox, upcomingInterviews]);

  const topCandidates = useMemo(() => {
    return [...(inbox ?? [])]
      .filter((a) => a.matchScore != null)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      .slice(0, 5);
  }, [inbox]);

  const trendPoints = useMemo(() => buildTrend(inbox ?? [], 30), [inbox]);

  const avgMatch = useMemo(() => {
    const scored = (inbox ?? []).filter((a) => a.matchScore != null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, a) => s + (a.matchScore ?? 0), 0) / scored.length);
  }, [inbox]);

  const avgMatchDelta = useMemo(() => computeMatchScoreDelta(inbox ?? []), [inbox]);

  const firstName = (me?.displayName ?? 'bạn').split(' ').slice(-1)[0];
  const honorificName = me?.displayName?.includes(' ')
    ? `Anh ${firstName}`
    : firstName === 'bạn'
      ? 'bạn'
      : `Anh ${firstName}`;

  const suggestions = useMemo(() => {
    const n = data?.newApplicationCount ?? 0;
    const top = topCandidates[0];
    return [
      {
        icon: 'users' as const,
        title:
          n > 0
            ? `Có ${n} ứng viên mới phù hợp với tin đang mở — cần sàng lọc hôm nay`
            : 'Có ứng viên mới cho vị trí kỹ sư kinh doanh HVAC — mở Tìm ứng viên AI để tìm thêm',
        cta: 'Xem ngay',
        href: n > 0 ? '/recruiter/inbox' : '/search',
      },
      {
        icon: 'file' as const,
        title:
          'Tin «Bảo trì điện» đã 15 ngày chưa có ứng viên — AI gợi ý tối ưu JD ngay',
        cta: 'Tối ưu ngay',
        href: '/jobs/new',
      },
      {
        icon: 'check' as const,
        title: top
          ? `${top.displayName} khớp ${top.matchScore}% với tin «${top.jobTitle}»`
          : 'Kỹ sư PLC đạt độ khớp cao — dùng AI xếp hạng để ưu tiên hồ sơ',
        cta: 'Xem hồ sơ',
        href: top ? `/jobs/${top.jobId}/applicants` : '/search',
      },
      {
        icon: 'wallet' as const,
        title: 'Báo cáo lương thị trường HVAC / kỹ thuật — tham chiếu khi đăng tin mới',
        cta: 'Xem báo cáo',
        href: '/jobs/new',
      },
    ];
  }, [data, topCandidates]);

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-slate-500">Đang tải bảng điều khiển...</p>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell>
        <Card className="text-center">
          <p className="text-slate-600">
            {error instanceof ApiError ? error.message : 'Không tải được dashboard.'}
          </p>
        </Card>
      </AppShell>
    );
  }

  if (!data?.hasCompany) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg text-center">
          <Building2 className="mx-auto h-12 w-12 text-brand-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Chào mừng đến iLink</h1>
          <p className="mt-2 text-slate-500">
            Tạo hồ sơ công ty để mở dashboard tuyển dụng đầy đủ.
          </p>
          <Link href="/company">
            <Button className="mt-6">Tạo hồ sơ công ty</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const interviewToday = interviewStats?.todayCount ?? 0;
  const interviewNext2h = interviewStats?.next2hCount ?? 0;
  const offerCount = pipelineCounts.offer;

  return (
    <AppShell>
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Tin tuyển dụng đang mở"
          value={data.publishedJobCount}
          delta={formatWeekDelta(data.publishedJobCount - data.publishedJobCount7dAgo)}
          tone="violet"
          icon={<Briefcase className="h-[18px] w-[18px]" strokeWidth={2} />}
        />
        <KpiCard
          label="Ứng viên mới"
          value={data.newApplicationCount}
          delta={formatDayDelta(data.newApplicationsToday - data.newApplicationsYesterday)}
          tone="blue"
          icon={<Users className="h-[18px] w-[18px]" strokeWidth={2} />}
        />
        <KpiCard
          label="Phỏng vấn hôm nay"
          value={interviewToday}
          delta={
            interviewNext2h > 0
              ? `${interviewNext2h} cuộc trong 2 giờ tới`
              : interviewToday > 0
                ? 'Không có buổi trong 2 giờ tới'
                : 'Lịch trống hôm nay'
          }
          tone="green"
          icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={2} />}
        />
        <KpiCard
          label="Đề nghị làm việc"
          value={offerCount}
          delta={offerCount > 0 ? `${offerCount} đang chờ phản hồi` : 'Chưa có đề nghị'}
          tone="orange"
          icon={<UserPlus className="h-[18px] w-[18px]" strokeWidth={2} />}
        />
        <KpiCard
          label="Thời gian tuyển trung bình"
          value={
            data.avgTimeToHireDays != null ? `${Math.round(data.avgTimeToHireDays)} ngày` : '—'
          }
          delta={
            data.avgTimeToHireDays == null
              ? 'Chưa có dữ liệu'
              : data.avgTimeToHireDeltaDays == null
                ? 'Chưa đủ dữ liệu so sánh'
                : formatDeltaDays(data.avgTimeToHireDeltaDays)
          }
          tone="violet"
          icon={<Clock className="h-[18px] w-[18px]" strokeWidth={2} />}
        />
        <KpiCard
          label="Điểm phù hợp AI trung bình"
          value={avgMatch != null ? `${avgMatch}%` : '—'}
          delta={avgMatch == null ? 'Chưa có hồ sơ' : formatMatchDelta(avgMatchDelta)}
          tone="teal"
          icon={<Target className="h-[18px] w-[18px]" strokeWidth={2} />}
        />
      </div>

      {/* Copilot + Suggestions */}
      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1B4D] via-[#152A6B] to-[#1E40AF] p-6 text-white shadow-[0_12px_40px_-12px_rgba(15,40,120,0.55)] xl:col-span-3">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="pointer-events-none absolute -right-16 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#6366F1]/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="relative flex gap-4">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
                <Sparkles className="h-4 w-4 text-amber-300" fill="currentColor" />
                Trợ lý AI
              </p>
              <h2 className="mt-2.5 text-[1.65rem] font-bold leading-snug tracking-tight sm:text-[1.85rem]">
                Tôi có thể giúp gì cho bạn, {honorificName}?
              </h2>

              <form
                className="mt-5 flex items-center gap-2 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-lg"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = copilotQ.trim();
                  if (!q || copilotMutation.isPending) return;
                  copilotMutation.mutate(q);
                }}
              >
                <Input
                  value={copilotQ}
                  onChange={(e) => setCopilotQ(e.target.value)}
                  placeholder="Ví dụ: Tìm kỹ sư kinh doanh ngành HVAC tại Hà Nội, lương 20-25 triệu..."
                  className="border-0 bg-transparent px-0 py-2 text-[13px] text-slate-800 shadow-none placeholder:text-slate-400 focus:ring-0"
                  disabled={copilotMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={copilotMutation.isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-md transition hover:bg-[#6D28D9] disabled:opacity-60"
                  aria-label="Gửi"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              {copilotMutation.isPending && (
                <p className="mt-3 text-[12px] text-white/80">Đang phân tích dữ liệu tuyển dụng…</p>
              )}
              {copilotMutation.isError && (
                <p className="mt-3 text-[12px] text-amber-200">
                  {copilotMutation.error instanceof ApiError
                    ? copilotMutation.error.message
                    : 'Không gọi được Copilot'}
                </p>
              )}
              {copilotAnswer && (
                <div className="mt-3 rounded-xl border border-white/20 bg-white/10 p-3 text-[13px] leading-relaxed text-white/95 backdrop-blur-sm">
                  <p className="whitespace-pre-wrap">{copilotAnswer}</p>
                  {copilotSources.length > 0 && (
                    <p className="mt-2 text-[11px] text-white/60">
                      Nguồn: {copilotSources.join(' · ')}
                    </p>
                  )}
                  <Link
                    href={
                      copilotQ.trim()
                        ? `/search?q=${encodeURIComponent(copilotQ.trim())}`
                        : '/search'
                    }
                    className="mt-2 inline-block text-[11px] font-semibold text-amber-200 hover:underline"
                  >
                    Tìm ứng viên AI →
                  </Link>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {COPILOT_CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <Link
                      key={chip.label}
                      href={chip.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-2 text-[12px] font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                      <Icon className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
                      {chip.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="relative hidden w-[140px] shrink-0 self-center sm:block lg:w-[168px]">
              <CopilotRobot className="h-auto w-full" />
            </div>
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-[#2563EB]" />
              AI gợi ý hôm nay
            </h3>
            <Link
              href="/recruiter/inbox"
              className="shrink-0 text-[12px] font-medium text-[#2563EB] hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>
          <ul className="mt-4 flex-1 space-y-2.5">
            {suggestions.map((s) => (
              <li
                key={s.title}
                className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] px-3 py-2.5"
              >
                <SuggestionIcon type={s.icon} />
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-slate-700">{s.title}</p>
                <Link
                  href={s.href}
                  className="shrink-0 rounded-lg bg-[#EEF2FF] px-2.5 py-1.5 text-[11px] font-semibold text-[#4338CA] transition hover:bg-[#E0E7FF]"
                >
                  {s.cta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Quy trình + Top candidates */}
      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-slate-900">Quy trình tuyển dụng</h3>
            <div className="flex items-center gap-3">
              <Select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="max-w-[200px] rounded-xl border-slate-200 bg-[#F8FAFC] py-2 text-[13px]"
              >
                <option value="all">Tất cả tin đang mở</option>
                {(jobs ?? [])
                  .filter((j) => j.status === 'published' || j.status === 'draft')
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
              </Select>
              <Link
                href="/jobs/manage"
                className="text-[13px] font-medium text-[#2563EB] hover:underline"
              >
                Xem chi tiết →
              </Link>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-[560px]">
              {PIPELINE_STAGES.map((stage, i) => {
                const count = pipelineCounts[stage.key];
                const active = pipelineActive === stage.key;
                const style = PIPELINE_STYLE[stage.key];
                const bg = active ? style.activeBg : style.idleBg;
                const color = active ? style.activeText : style.idleText;
                const n = PIPELINE_STAGES.length;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => setPipelineActive(stage.key)}
                    className="relative h-[72px] min-w-0 flex-1 transition"
                    style={{
                      marginLeft: i === 0 ? 0 : -14,
                      zIndex: active ? n + 1 : n - i,
                    }}
                    aria-pressed={active}
                  >
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox="0 0 140 72"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <path d={chevronPath(i, n)} fill={bg} />
                    </svg>
                    <div
                      className="relative z-10 flex h-full flex-col items-start justify-center px-5 pl-6"
                      style={{ color, paddingLeft: i === 0 ? 16 : 22 }}
                    >
                      <span className="truncate text-[10px] font-semibold opacity-90">
                        {stage.label}
                      </span>
                      <span className="text-[1.35rem] font-bold leading-none tracking-tight">
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[14px] font-semibold text-slate-800">
                  Tiến độ tuyển dụng theo thời gian
                </p>
                <p className="mt-0.5 text-[12px] text-slate-400">Theo ngày nộp hồ sơ</p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] font-medium text-slate-600">
                30 ngày qua
              </span>
            </div>
            <TrendChart points={trendPoints} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Ứng viên phù hợp nhất hôm nay
            </h3>
            <Link
              href="/recruiter/inbox"
              className="shrink-0 text-[13px] font-medium text-[#2563EB] hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {topCandidates.length === 0 && (
              <li className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                Chưa có điểm khớp AI. Khi ứng viên nộp hồ sơ, xếp hạng sẽ hiện tại đây.
              </li>
            )}
            {topCandidates.map((a, idx) => (
              <li key={a.applicationId} className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                  {idx + 1}
                </span>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] text-[11px] font-bold text-[#1D4ED8]">
                  {initials(a.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{a.displayName}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {a.currentPosition
                      ? formatJobTitle(a.currentPosition)
                      : a.jobTitle
                        ? formatJobTitle(a.jobTitle)
                        : '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.matchScore != null && (
                    <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
                      Phù hợp {a.matchScore}%
                    </span>
                  )}
                  <Link
                    href={`/jobs/${a.jobId}/applicants`}
                    className="text-[12px] font-semibold text-[#2563EB] hover:underline"
                  >
                    Xem hồ sơ
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Quick actions */}
      <div className="mt-5">
        <h3 className="mb-3 text-[15px] font-semibold text-slate-900">Thao tác nhanh</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <QuickOutline
            href="/jobs/new"
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            label="Tạo tin tuyển dụng mới"
            iconClass="bg-blue-50 text-[#2563EB]"
          />
          <QuickOutline
            href="/search"
            icon={<FileSearch className="h-4 w-4" strokeWidth={2} />}
            label="Tìm ứng viên AI"
            iconClass="bg-blue-50 text-[#2563EB]"
          />
          <QuickOutline
            href="/jobs/new"
            icon={<FileText className="h-4 w-4" strokeWidth={2} />}
            label="AI viết JD"
            iconClass="bg-blue-50 text-[#2563EB]"
          />
          <QuickOutline
            href="/recruiter/inbox"
            icon={<Send className="h-4 w-4" strokeWidth={2} />}
            label="Gửi email hàng loạt"
            iconClass="bg-violet-50 text-[#7C3AED]"
          />
          <QuickOutline
            href="/jobs/manage"
            icon={<BarChart3 className="h-4 w-4" strokeWidth={2} />}
            label="Báo cáo nhanh"
            iconClass="bg-blue-50 text-[#2563EB]"
          />
        </div>
      </div>
    </AppShell>
  );
}

/** Path chevron pipeline (viewBox 140×72): đầu phẳng, giữa + cuối có khía mũi tên. */
function chevronPath(index: number, total: number): string {
  const tip = 18;
  if (index === 0) {
    return `M0,0 L${140 - tip},0 L140,36 L${140 - tip},72 L0,72 Z`;
  }
  if (index === total - 1) {
    return `M0,0 L140,0 L140,72 L0,72 L${tip},36 Z`;
  }
  return `M0,0 L${140 - tip},0 L140,36 L${140 - tip},72 L0,72 L${tip},36 Z`;
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SUGGESTION_ICON = {
  users: { bg: 'bg-[#DBEAFE] text-[#2563EB]', icon: Users },
  file: { bg: 'bg-[#FFEDD5] text-[#EA580C]', icon: ClipboardList },
  check: { bg: 'bg-[#D1FAE5] text-[#059669]', icon: CheckCircle2 },
  wallet: { bg: 'bg-[#EDE9FE] text-[#7C3AED]', icon: Wallet },
} as const;

function SuggestionIcon({ type }: { type: keyof typeof SUGGESTION_ICON }) {
  const m = SUGGESTION_ICON[type];
  const Icon = m.icon;
  return (
    <span
      className={clsx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        m.bg,
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

const KPI_TONE = {
  violet: 'bg-[#EDE9FE] text-[#7C3AED]',
  blue: 'bg-[#DBEAFE] text-[#2563EB]',
  green: 'bg-[#D1FAE5] text-[#059669]',
  orange: 'bg-[#FFEDD5] text-[#EA580C]',
  teal: 'bg-[#CCFBF1] text-[#0D9488]',
} as const;

function KpiCard({
  label,
  value,
  delta,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  delta: string;
  tone: keyof typeof KPI_TONE;
  icon: React.ReactNode;
}) {
  const isOrange = tone === 'orange';
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <span
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            KPI_TONE[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[12px] font-medium leading-snug text-slate-500">{label}</p>
      <p className="mt-1 text-[1.65rem] font-extrabold tracking-tight text-slate-900">{value}</p>
      <p
        className={clsx(
          'mt-1 text-[11px] font-medium',
          isOrange ? 'text-[#EA580C]' : 'text-[#059669]',
        )}
      >
        {delta}
      </p>
    </div>
  );
}

function QuickOutline({
  href,
  icon,
  label,
  iconClass,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  iconClass: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          iconClass,
        )}
      >
        {icon}
      </span>
      <span className="text-[13px] font-semibold leading-snug text-slate-800">{label}</span>
    </Link>
  );
}

function buildTrend(
  inbox: { createdAt: string }[],
  days: number,
): { day: string; count: number }[] {
  const map = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const a of inbox) {
    const key = a.createdAt.slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([day, count]) => ({ day, count }));
}

function formatWeekDelta(delta: number): string {
  if (delta === 0) return 'Không đổi so với tuần trước';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} so với tuần trước`;
}

function formatDayDelta(delta: number): string {
  if (delta === 0) return 'Không đổi so với hôm qua';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} so với hôm qua`;
}

function formatDeltaDays(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return 'Không đổi so với 30 ngày trước';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded} ngày so với 30 ngày trước`;
}

function formatMatchDelta(delta: number | null): string {
  if (delta == null) return 'Chưa đủ dữ liệu so sánh';
  if (delta === 0) return 'Không đổi so với 7 ngày trước';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}% so với 7 ngày trước`;
}

function computeMatchScoreDelta(
  inbox: { createdAt: string; matchScore?: number | null }[],
): number | null {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const last7 = inbox.filter(
    (a) => a.matchScore != null && now - new Date(a.createdAt).getTime() <= 7 * DAY,
  );
  const prev7 = inbox.filter((a) => {
    if (a.matchScore == null) return false;
    const age = now - new Date(a.createdAt).getTime();
    return age > 7 * DAY && age <= 14 * DAY;
  });
  if (last7.length === 0 || prev7.length === 0) return null;
  const avg = (list: typeof last7) =>
    list.reduce((s, a) => s + (a.matchScore ?? 0), 0) / list.length;
  return Math.round(avg(last7) - avg(prev7));
}

function TrendChart({ points }: { points: { day: string; count: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const w = 640;
  const h = 148;
  const pad = 14;
  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - (p.count / max) * (h - pad * 2);
    return { x, y, ...p };
  });
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${pad},${h - pad} ${polyline} ${w - pad},${h - pad}`;
  const tipIdx = Math.min(coords.length - 1, Math.floor(coords.length * 0.58));
  const tip = coords[tipIdx];
  const tipCount = tip?.count || Math.max(...points.map((p) => p.count), 1);

  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[132px] w-full">
        <defs>
          <linearGradient id="ilTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={pad}
            x2={w - pad}
            y1={pad + g * (h - pad * 2)}
            y2={pad + g * (h - pad * 2)}
            stroke="#E2E8F0"
            strokeWidth="1"
          />
        ))}
        <polygon points={area} fill="url(#ilTrendFill)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.75"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {tip && (
          <>
            <circle cx={tip.x} cy={tip.y} r="8" fill="#2563EB" fillOpacity="0.18" />
            <circle cx={tip.x} cy={tip.y} r="4" fill="#2563EB" />
          </>
        )}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-medium text-white shadow-lg"
          style={{
            left: `${Math.min(88, Math.max(12, (tip.x / w) * 100))}%`,
            top: 10,
            transform: 'translateX(-50%)',
          }}
        >
          {(tip.day.slice(8) + '/' + tip.day.slice(5, 7))} · Ứng viên: {tipCount}
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{points[0]?.day?.slice(5)?.replace('-', '/') ?? ''}</span>
        <span>{points[points.length - 1]?.day?.slice(5)?.replace('-', '/') ?? ''}</span>
      </div>
    </div>
  );
}
