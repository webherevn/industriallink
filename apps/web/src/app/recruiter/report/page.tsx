'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  FileText,
  Filter,
  Headphones,
  Minus,
  Printer,
  Search,
  Sparkles,
  Target,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import {
  formatJobTitle,
  type RecruitmentReportFunnelStep,
  type RecruitmentReportJobRow,
  type RecruitmentReportView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getRecruitmentReport } from '@/lib/recruiter';

const PERIODS = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
  { days: 365, label: '12 tháng' },
] as const;

const JOB_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đang tuyển',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
};

const FUNNEL_BAR = [
  'bg-brand-700',
  'bg-brand-600',
  'bg-sky-500',
  'bg-accent-500',
  'bg-emerald-500',
];

export default function RecruiterReportPage() {
  const [days, setDays] = useState<number>(30);
  const [selectedJobId, setSelectedJobId] = useState<string>('all');

  const report = useQuery({
    queryKey: ['recruiter', 'recruitment-report', days],
    queryFn: () => getRecruitmentReport(days),
    placeholderData: keepPreviousData,
  });

  const jobsList = report.data?.jobs ?? [];

  useEffect(() => {
    if (selectedJobId !== 'all' && !jobsList.some((j) => j.jobId === selectedJobId)) {
      setSelectedJobId('all');
    }
  }, [jobsList, selectedJobId]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
              Báo cáo điều hành & HR
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-800">
              Báo cáo tuyển dụng
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Tổng hợp hiệu quả phễu chuyển đổi, nguồn ứng viên Săn nhân sự AI, chi phí Credit và hiệu suất từng vị trí.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {jobsList.length > 0 ? (
              <div className="relative">
                <select
                  aria-label="Lọc theo vị trí tuyển dụng"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="h-9 rounded-full border border-slate-200 bg-white pl-3.5 pr-8 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 focus:border-brand-500 focus:outline-none"
                >
                  <option value="all">Tất cả vị trí ({jobsList.length})</option>
                  {jobsList.map((job) => (
                    <option key={job.jobId} value={job.jobId}>
                      {formatJobTitle(job.title)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
              {PERIODS.map((period) => (
                <button
                  key={period.days}
                  type="button"
                  onClick={() => setDays(period.days)}
                  className={clsx(
                    'rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition duration-200 active:scale-95',
                    days === period.days
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {report.data?.hasCompany ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportRecruitmentCsv(report.data!, selectedJobId)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-slate-50 active:scale-95"
                  title="Tải file Excel (.csv) báo cáo tuyển dụng"
                >
                  <Download className="h-3.5 w-3.5 text-brand-600" />
                  <span>Xuất Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => openExecutivePrintReport(report.data!, selectedJobId)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-700 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-95"
                  title="Mở bản báo cáo chuẩn A4 để in hoặc lưu PDF trình Sếp"
                >
                  <Printer className="h-3.5 w-3.5 text-[#E8872A]" />
                  <span>Xuất PDF trình Sếp</span>
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {report.isLoading && !report.data ? <ReportSkeleton /> : null}
        {report.isError && !report.data ? (
          <Card className="mt-5">
            <p className="text-sm text-red-600">
              {report.error instanceof ApiError
                ? report.error.message
                : 'Không tải được báo cáo tuyển dụng.'}
            </p>
          </Card>
        ) : null}

        {report.data && !report.data.hasCompany ? <NoCompany /> : null}
        {report.data?.hasCompany ? (
          <ReportBody
            report={report.data}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            refreshing={report.isFetching}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function ReportBody({
  report,
  selectedJobId,
  onSelectJob,
  refreshing,
}: {
  report: RecruitmentReportView;
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  refreshing: boolean;
}) {
  const [funnelMode, setFunnelMode] = useState<'cumulative' | 'current'>('cumulative');

  const updated = new Date(report.generatedAt).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  const selectedJob = useMemo(
    () =>
      selectedJobId === 'all'
        ? null
        : (report.jobs.find((j) => j.jobId === selectedJobId) ?? null),
    [report.jobs, selectedJobId],
  );

  // Số liệu hiển thị linh hoạt theo bộ lọc (Tất cả vị trí hoặc 1 vị trí cụ thể)
  const appsCount = selectedJob ? selectedJob.applications : report.applications;
  const screeningCount = selectedJob ? selectedJob.screening : report.screening;
  const interviewsCount = selectedJob ? selectedJob.interviews : report.interviews;
  const offersCount = selectedJob ? selectedJob.offers : report.offers;
  const hiresCount = selectedJob ? selectedJob.hires : report.hires;
  const avgMatch = selectedJob ? selectedJob.avgMatchScore : report.avgMatchScore;
  const topMatch = selectedJob
    ? (selectedJob.topMatchScore ?? selectedJob.avgMatchScore)
    : (report.topMatchScore ?? report.avgMatchScore);
  const highMatchCount = selectedJob
    ? (selectedJob.highMatchCount ?? 0)
    : (report.highMatchCount ?? 0);

  const inPipeline = screeningCount + interviewsCount + offersCount;
  const conversionPct =
    appsCount > 0 ? Math.round((hiresCount / appsCount) * 1000) / 10 : null;

  const sourcing = report.sourcing ?? {
    planName: null,
    activeEngagements: 0,
    scanRoundsInPeriod: 0,
    scannedCandidatesCount: 0,
    shortlistedCount: 0,
    outreachCount: 0,
    outreachQuota: 0,
    connectionsSent: 0,
    connectionsAccepted: 0,
  };
  const credits = report.credits ?? {
    balance: 0,
    consumedInPeriod: 0,
    profilesUnlockedInPeriod: 0,
  };

  const activeFunnelSteps = useMemo<RecruitmentReportFunnelStep[]>(() => {
    if (!selectedJob) return report.funnel;
    const total = selectedJob.applications;
    const appliedCurr = Math.max(
      0,
      total -
        selectedJob.screening -
        selectedJob.interviews -
        selectedJob.offers -
        selectedJob.hires,
    );
    const cumScreening =
      selectedJob.screening +
      selectedJob.interviews +
      selectedJob.offers +
      selectedJob.hires;
    const cumInterview =
      selectedJob.interviews + selectedJob.offers + selectedJob.hires;
    const cumOffer = selectedJob.offers + selectedJob.hires;
    const cumHired = selectedJob.hires;

    const raw = [
      { key: 'applied', label: 'Ứng tuyển', currentCount: appliedCurr, cumulativeCount: total },
      { key: 'screening', label: 'Sàng lọc', currentCount: selectedJob.screening, cumulativeCount: cumScreening },
      { key: 'interview', label: 'Phỏng vấn', currentCount: selectedJob.interviews, cumulativeCount: cumInterview },
      { key: 'offer', label: 'Đề nghị', currentCount: selectedJob.offers, cumulativeCount: cumOffer },
      { key: 'hired', label: 'Nhận việc', currentCount: selectedJob.hires, cumulativeCount: cumHired },
    ];
    return raw.map((s, idx) => {
      const prev = idx === 0 ? total : raw[idx - 1]!.cumulativeCount;
      return {
        key: s.key,
        label: s.label,
        count: s.currentCount,
        currentCount: s.currentCount,
        cumulativeCount: s.cumulativeCount,
        conversionFromStartPct: total > 0 ? Math.round((s.cumulativeCount / total) * 100) : 0,
        stepPassRatePct:
          idx === 0
            ? total > 0
              ? 100
              : 0
            : prev > 0
              ? Math.min(100, Math.round((s.cumulativeCount / prev) * 100))
              : 0,
      };
    });
  }, [report.funnel, selectedJob]);

  const getStepDisplayCount = (step: RecruitmentReportFunnelStep) =>
    funnelMode === 'cumulative' ? (step.cumulativeCount ?? step.count) : (step.currentCount ?? step.count);

  const funnelMax = Math.max(
    1,
    appsCount,
    ...activeFunnelSteps.map((step) => getStepDisplayCount(step)),
  );

  const interviewHeadline = selectedJob
    ? selectedJob.interviews
    : Math.max(report.interviewSessions, report.interviews);
  const offerHeadline = selectedJob
    ? selectedJob.offers
    : Math.max(report.offers, report.offersSent);

  const outboundCandidatesTotal = selectedJob
    ? (selectedJob.shortlisted ?? 0) + (selectedJob.outreachCount ?? 0)
    : Math.max(
        sourcing.scannedCandidatesCount,
        sourcing.shortlistedCount + sourcing.outreachCount + credits.profilesUnlockedInPeriod,
      );

  const insights = useMemo(
    () =>
      buildActionableInsights({
        report,
        selectedJob,
        appsCount,
        screeningCount,
        interviewsCount,
        offersCount,
        hiresCount,
        sourcing,
        credits,
      }),
    [
      report,
      selectedJob,
      appsCount,
      screeningCount,
      interviewsCount,
      offersCount,
      hiresCount,
      sourcing,
      credits,
    ],
  );

  return (
    <div className={clsx('mt-5 space-y-4', refreshing && 'opacity-80')}>
      {/* 1. EXECUTIVE BANNER */}
      <section className="group brand-hero-surface relative rounded-2xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-2 bottom-0 top-0 hidden w-56 items-center justify-end pr-6 opacity-[0.18] transition duration-700 ease-out group-hover:scale-110 group-hover:opacity-30 lg:flex">
          <Search className="h-36 w-36" strokeWidth={1.1} />
        </div>
        <div className="relative animate-soft-rise">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">{report.companyName ?? 'Công ty'}</p>
                  {sourcing.planName ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-white/20">
                      <Sparkles className="h-3 w-3" />
                      {sourcing.planName}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-white/65">
                  Báo cáo trong {report.days === 365 ? '12 tháng' : `${report.days} ngày`} qua
                  {selectedJob ? ` · Vị trí: ${formatJobTitle(selectedJob.title)}` : ' · Toàn công ty'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedJob ? (
                <button
                  type="button"
                  onClick={() => onSelectJob('all')}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/25"
                >
                  Xem toàn công ty ×
                </button>
              ) : null}
              <p className="text-xs text-white/60">Cập nhật {updated}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat
              icon={<UserCheck className="h-4 w-4" />}
              label="Tỷ lệ nhận việc"
              value={conversionPct == null ? '—' : `${formatNum(conversionPct)}%`}
              hint={
                appsCount
                  ? `${hiresCount} nhận việc / ${appsCount} hồ sơ ứng tuyển`
                  : 'Chưa có hồ sơ ứng tuyển trong kỳ'
              }
            />
            <HeroStat
              icon={<Clock className="h-4 w-4" />}
              label="Thời gian tuyển TB"
              value={
                report.avgTimeToHireDays != null
                  ? `${formatNum(report.avgTimeToHireDays)} ngày`
                  : inPipeline > 0
                    ? 'Đang xử lý'
                    : '—'
              }
              hint={
                report.avgTimeToHireDays != null
                  ? 'Từ lúc nộp đến lúc chốt nhận việc'
                  : inPipeline > 0
                    ? `${inPipeline} hồ sơ đang trong quy trình đánh giá`
                    : 'Tính khi có ứng viên chốt nhận việc'
              }
            />
            <HeroStat
              icon={<Target className="h-4 w-4" />}
              label="Chất lượng nguồn AI"
              value={
                topMatch != null
                  ? `Top ${formatNum(topMatch)}%`
                  : avgMatch != null
                    ? `${formatNum(avgMatch)}%`
                    : '—'
              }
              hint={
                avgMatch != null
                  ? `TB ${formatNum(avgMatch)}% · ${highMatchCount} hồ sơ khớp cao (≥70%)`
                  : 'Chưa có điểm đối chiếu AI'
              }
            />
            <HeroStat
              icon={<Briefcase className="h-4 w-4" />}
              label="Quy mô chiến dịch"
              value={`${report.openJobs} tin mở`}
              hint={
                sourcing.activeEngagements > 0
                  ? `${sourcing.activeEngagements} tin săn AI · ${sourcing.scanRoundsInPeriod} đợt quét`
                  : 'Tin đang mở nhận hồ sơ lúc này'
              }
            />
          </div>
        </div>
      </section>

      {/* 2. 6 THẺ KPI QUY TRÌNH & NGUỒN CHỦ ĐỘNG */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          tone="bg-brand-50 text-brand-700"
          label="Hồ sơ ứng tuyển (Inbound)"
          value={appsCount}
          hint={
            selectedJob ? (
              <span>{highMatchCount} hồ sơ đạt độ khớp cao ≥70%</span>
            ) : (
              <Delta current={report.applications} previous={report.applicationsPrev} />
            )
          }
          delay="0ms"
        />
        <Kpi
          icon={<Sparkles className="h-4 w-4" />}
          tone="bg-amber-50 text-amber-700"
          label="Ứng viên Săn AI (Outbound)"
          value={outboundCandidatesTotal}
          hint={
            <span>
              {sourcing.scanRoundsInPeriod} đợt quét · {sourcing.shortlistedCount} Shortlist ·{' '}
              {sourcing.outreachCount} giao Inlink
            </span>
          }
          delay="60ms"
        />
        <Kpi
          icon={<FileText className="h-4 w-4" />}
          tone="bg-[#e7eef8] text-brand-600"
          label="Đang xử lý trong phễu"
          value={inPipeline}
          hint={
            <span>
              {screeningCount} sàng lọc · {interviewsCount} phỏng vấn · {offersCount} đề nghị
            </span>
          }
          delay="120ms"
        />
        <Kpi
          icon={<CalendarDays className="h-4 w-4" />}
          tone="bg-sky-50 text-sky-700"
          label="Phỏng vấn"
          value={interviewHeadline}
          hint={
            <span>
              {report.interviewSessions} buổi lịch hẹn · {interviewsCount} hồ sơ đang ở bước PV
            </span>
          }
          delay="180ms"
        />
        <Kpi
          icon={<Briefcase className="h-4 w-4" />}
          tone="bg-accent-100 text-accent-700"
          label="Đề nghị (Offer)"
          value={offerHeadline}
          hint={
            <span>
              {offersCount} hồ sơ ở bước Đề nghị · {report.offersSent} thư Offer đã tạo
            </span>
          }
          delay="240ms"
        />
        <Kpi
          icon={<UserCheck className="h-4 w-4" />}
          tone="bg-emerald-50 text-emerald-700"
          label="Nhận việc & Kết thúc"
          value={hiresCount}
          hint={
            <span>
              {hiresCount} nhận việc · {report.rejected} từ chối · {report.withdrawn} rút hồ sơ
            </span>
          }
          delay="300ms"
        />
      </section>

      {/* 3. CẶP BIỂU ĐỒ TRUNG TÂM: PHỄU CHUYỂN ĐỔI LŨY KẾ + BIỂU ĐỒ XU HƯỚNG MƯỢT */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Panel
          className="flex flex-col justify-between p-5 transition duration-300 hover:shadow-[0_16px_36px_-18px_rgba(7,35,72,0.42)]"
          delay="80ms"
        >
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Filter className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-brand-800">Phễu chuyển đổi hồ sơ</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {funnelMode === 'cumulative'
                      ? 'Số lượng & tỷ lệ hồ sơ vượt qua từng vòng tuyển dụng.'
                      : 'Số lượng hồ sơ hiện đang dừng ở từng trạng thái.'}
                  </p>
                </div>
              </div>

              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setFunnelMode('cumulative')}
                  className={clsx(
                    'rounded-md px-2.5 py-1 transition',
                    funnelMode === 'cumulative'
                      ? 'bg-white text-brand-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  Phễu lũy kế
                </button>
                <button
                  type="button"
                  onClick={() => setFunnelMode('current')}
                  className={clsx(
                    'rounded-md px-2.5 py-1 transition',
                    funnelMode === 'current'
                      ? 'bg-white text-brand-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  Đang ở bước
                </button>
              </div>
            </div>

            <ol className="mt-4 space-y-2.5">
              {activeFunnelSteps.map((step, index) => {
                const val = getStepDisplayCount(step);
                const currVal = step.currentCount ?? step.count;
                const share = appsCount ? Math.round((val / appsCount) * 100) : 0;
                return (
                  <li
                    key={step.key}
                    className="group -mx-2 rounded-xl px-2 py-1.5 transition duration-200 hover:bg-slate-50"
                  >
                    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                      <div>
                        <span className="text-sm font-medium text-slate-700">{step.label}</span>
                        {funnelMode === 'cumulative' && currVal > 0 ? (
                          <span className="block text-[10px] text-slate-400">
                            Đang ở bước: {currVal}
                          </span>
                        ) : null}
                      </div>
                      <GrowBar
                        pct={appsCount ? (val / funnelMax) * 100 : 0}
                        className={FUNNEL_BAR[index] ?? 'bg-brand-600'}
                        delay={index * 70}
                      />
                      <span className="text-right text-sm tabular-nums text-slate-500">
                        <span className="font-bold text-brand-800">{val}</span>
                        <span className="ml-1 text-xs font-medium text-[#E8872A]">({share}%)</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Cơ cấu nguồn ứng viên (Inbound vs Outbound AI) */}
          <div className="mt-5 border-t border-slate-100 pt-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Cơ cấu nguồn tiếp cận ứng viên</span>
              <span className="text-slate-500">
                Tổng nguồn:{' '}
                <strong className="text-brand-800">{appsCount + outboundCandidatesTotal}</strong> ứng viên
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">Tự ứng tuyển (Inbound)</span>
                  <span className="text-xs font-bold text-brand-800">{appsCount}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {highMatchCount} hồ sơ khớp ≥70%
                </p>
              </div>
              <div className="rounded-xl bg-amber-50/60 px-3 py-2 ring-1 ring-amber-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-amber-900">Săn nhân sự AI (Outbound)</span>
                  <span className="text-xs font-bold text-[#E8872A]">{outboundCandidatesTotal}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-amber-800/80">
                  {credits.profilesUnlockedInPeriod} mở khóa · {sourcing.outreachCount} giao Inlink
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          className="flex flex-col justify-between p-5 transition duration-300 hover:shadow-[0_16px_36px_-18px_rgba(232,135,42,0.28)]"
          delay="140ms"
        >
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-brand-800">Hồ sơ theo thời gian</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Biểu đồ đường cong mượt (số nguyên) theo ngày nộp & ngày chốt nhận việc.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  Hồ sơ mới ({report.applications})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-500" />
                  Nhận việc ({report.hires})
                </span>
              </div>
            </div>
            <TrendChart points={report.trend} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="text-[11px] text-slate-500">Đỉnh nhận hồ sơ</p>
              <p className="mt-0.5 font-bold text-brand-800">
                {Math.max(0, ...report.trend.map((p) => p.applications))} hồ sơ/mốc
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="text-[11px] text-slate-500">Đợt quét AI tự động</p>
              <p className="mt-0.5 font-bold text-brand-800">{sourcing.scanRoundsInPeriod} đợt</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="text-[11px] text-slate-500">Lời mời kết nối</p>
              <p className="mt-0.5 font-bold text-brand-800">
                {sourcing.connectionsAccepted}/{sourcing.connectionsSent} đồng ý
              </p>
            </div>
          </div>
        </Panel>
      </section>

      {/* 4. KHỐI CHẨN ĐOÁN ĐIỂM NGHẼN (HR INSIGHTS) & HIỆU QUẢ ĐẦU TƯ GÓI SĂN / CREDIT */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Panel className="p-5" delay="160ms">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-brand-800">
                  Chẩn đoán điểm nghẽn & Đề xuất hành động
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hệ thống tự động phân tích phễu tuyển dụng để gợi ý bước xử lý tiếp theo cho HR.
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {insights.map((item, idx) => (
              <li
                key={idx}
                className={clsx(
                  'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs transition',
                  item.tone === 'warn'
                    ? 'border-amber-200/90 bg-amber-50/60 text-amber-950'
                    : item.tone === 'good'
                      ? 'border-emerald-200/80 bg-emerald-50/50 text-emerald-950'
                      : 'border-slate-200/80 bg-slate-50/80 text-slate-700',
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      item.tone === 'warn'
                        ? 'bg-amber-200/80 text-amber-900'
                        : item.tone === 'good'
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : 'bg-brand-100 text-brand-800',
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-[11px] opacity-85">{item.desc}</p>
                  </div>
                </div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-brand-700 shadow-xs ring-1 ring-slate-200 transition hover:bg-brand-600 hover:text-white"
                  >
                    {item.ctaLabel} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5" delay="170ms">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Coins className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-brand-800">
                  Hiệu quả Gói dịch vụ & Credit
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Mức độ khai thác gói Săn nhân sự và ngân sách mở hồ sơ.
                </p>
              </div>
            </div>
            <Link
              href="/recruiter/sourcing"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              Săn nhân sự →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <p className="text-[11px] font-medium text-slate-500">Số dư Credit hiện tại</p>
              <p className="mt-1 text-xl font-bold text-brand-800">
                {credits.balance.toLocaleString('vi-VN')} <span className="text-xs font-medium text-slate-500">Credit</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Đã dùng {credits.consumedInPeriod} Credit trong kỳ
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
              <p className="text-[11px] font-medium text-slate-500">Hồ sơ đã mở khóa</p>
              <p className="mt-1 text-xl font-bold text-[#E8872A]">
                {credits.profilesUnlockedInPeriod} <span className="text-xs font-medium text-slate-500">hồ sơ</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {sourcing.shortlistedCount} ứng viên đã lưu Shortlist
              </p>
            </div>

            <div className="col-span-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-950">
                    Đội CSKH Inlink hỗ trợ liên hệ ứng viên
                  </span>
                </div>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {sourcing.outreachQuota > 0
                    ? `${sourcing.outreachCount} / ${sourcing.outreachQuota} ứng viên`
                    : `${sourcing.outreachCount} ứng viên`}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-900/80">
                {sourcing.outreachQuota > 0
                  ? `Gói ${sourcing.planName ?? 'Săn nhân sự'} còn ${Math.max(0, sourcing.outreachQuota - sourcing.outreachCount)} lượt giao Inlink liên hệ trực tiếp ứng viên tiềm năng.`
                  : 'Sử dụng tính năng Giao Inlink liên hệ ở mục Săn nhân sự để đội ngũ CSKH kết nối giúp bạn.'}
              </p>
            </div>
          </div>
        </Panel>
      </section>

      {/* 5. BẢNG HIỆU SUẤT CHI TIẾT THEO TỪNG TIN TUYỂN DỤNG */}
      <Panel className="overflow-hidden" delay="180ms">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-brand-800">Hiệu suất theo tin tuyển dụng</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                So sánh số lượng ứng tuyển, tiến độ xử lý phễu, nguồn Săn AI và điểm khớp theo từng vị trí.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/recruiter/sourcing"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              Săn ứng viên AI →
            </Link>
            <Link
              href="/jobs/manage"
              className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition duration-200 hover:text-brand-800"
            >
              Quản lý tin
              <span className="transition duration-200 group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
        {report.jobs.length === 0 ? (
          <p className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
            Chưa có tin tuyển dụng hoặc hồ sơ mới trong kỳ này.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Tin tuyển dụng</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Hồ sơ</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Sàng lọc</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Phỏng vấn</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Đề nghị</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Nhận việc</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Nguồn Săn AI</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Độ khớp AI</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {report.jobs.map((job) => {
                  const isSelected = selectedJobId === job.jobId;
                  const matchBadgeTone =
                    job.avgMatchScore == null
                      ? 'bg-slate-100 text-slate-500'
                      : job.avgMatchScore >= 70
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : job.avgMatchScore >= 45
                          ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                          : 'bg-slate-100 text-slate-700';

                  return (
                    <tr
                      key={job.jobId}
                      className={clsx(
                        'group border-t border-slate-100 transition duration-200 hover:bg-brand-50/60',
                        isSelected && 'bg-brand-50/80',
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition duration-200 group-hover:scale-110 group-hover:bg-brand-100">
                            <Briefcase className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/jobs/${job.jobId}/applicants`}
                              className="font-semibold text-brand-800 hover:underline"
                            >
                              {formatJobTitle(job.title)}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">
                              <span
                                className={clsx(
                                  'inline-block rounded-full px-1.5 py-0.2 text-[10px] font-semibold',
                                  job.status === 'published'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600',
                                )}
                              >
                                {JOB_STATUS_LABEL[job.status] ?? job.status}
                              </span>
                              {job.location ? ` · ${job.location}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-brand-800">
                        {job.applications}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-sky-700">
                        {job.screening}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-indigo-700">
                        {job.interviews}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#E8872A]">
                        {job.offers}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">
                        {job.hires}
                      </td>
                      <td className="px-3 py-3 text-right text-xs tabular-nums text-slate-600">
                        {(job.sourcingScans ?? 0) > 0 || (job.outreachCount ?? 0) > 0 ? (
                          <div>
                            <span className="font-semibold text-brand-700">
                              {job.sourcingScans ?? 0} đợt quét
                            </span>
                            {(job.outreachCount ?? 0) > 0 ? (
                              <span className="block text-[10px] text-emerald-700">
                                {job.outreachCount} giao Inlink
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {job.avgMatchScore == null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="inline-flex flex-col items-end">
                            <span
                              className={clsx(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold',
                                matchBadgeTone,
                              )}
                            >
                              TB {formatNum(job.avgMatchScore)}%
                            </span>
                            {job.topMatchScore != null && job.topMatchScore > job.avgMatchScore ? (
                              <span className="mt-0.5 text-[10px] font-medium text-emerald-700">
                                Cao nhất: {formatNum(job.topMatchScore)}%
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectJob(isSelected ? 'all' : job.jobId)
                            }
                            className={clsx(
                              'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                              isSelected
                                ? 'bg-brand-700 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            )}
                          >
                            {isSelected ? 'Đang lọc' : 'Lọc phễu'}
                          </button>
                          <Link
                            href={`/jobs/${job.jobId}/applicants`}
                            className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-600 hover:text-white"
                          >
                            Ứng viên →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  className,
  delay,
  children,
}: {
  className?: string;
  delay?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'animate-soft-rise rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.28)]',
        className,
      )}
      style={delay ? { animationDelay: delay } : undefined}
    >
      {children}
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="group/stat -mx-2 flex gap-3 rounded-xl px-2 py-2 transition duration-300 hover:bg-white/10">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80 ring-1 ring-white/10 transition duration-300 group-hover/stat:scale-110 group-hover/stat:bg-white/20 group-hover/stat:text-white">
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium text-white/70">{label}</p>
        <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#E8872A]">{value}</p>
        <p className="mt-1 text-xs text-white/65">{hint}</p>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  hint,
  delay,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: number;
  hint: ReactNode;
  delay: string;
}) {
  return (
    <Panel
      className="group relative overflow-hidden p-4 transition duration-300 hover:border-brand-200 hover:shadow-[0_14px_32px_-16px_rgba(7,35,72,0.45)]"
      delay={delay}
    >
      <div className="flex items-center gap-2.5">
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110', tone)}>{icon}</span>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[#E8872A]">
        <RisingNumber value={value} />
      </p>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-4 h-16 w-24 rounded-full bg-brand-50/80 transition duration-500 ease-out group-hover:scale-125 group-hover:bg-accent-50"
      />
    </Panel>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-500">
        <Minus className="h-3.5 w-3.5" />
        Bằng kỳ trước
      </span>
    );
  }
  const up = diff > 0;
  const pct = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : null;
  return (
    <span className={clsx('inline-flex items-center gap-1 font-medium', up ? 'text-emerald-700' : 'text-rose-600')}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? '+' : '−'}
      {Math.abs(diff)}
      {pct == null ? '' : ` (${pct}%)`} so với kỳ trước
    </span>
  );
}

function RisingNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString('vi-VN')}</>;
}

function GrowBar({ pct, className, delay }: { pct: number; className: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setWidth(Math.max(0, Math.min(100, pct))), 40 + delay);
    return () => window.clearTimeout(id);
  }, [pct, delay]);
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className={clsx('h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110', className)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function TrendChart({ points }: { points: RecruitmentReportView['trend'] }) {
  if (points.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">Chưa có dữ liệu trong kỳ này.</p>;
  }
  const width = 640;
  const height = 184;
  const padL = 34;
  const padR = 12;
  const padT = 16;
  const padB = 26;

  // Đảm bảo trục Y luôn chia mốc số nguyên (không bao giờ hiện 0,5 người)
  const rawMax = Math.max(1, ...points.map((point) => Math.max(point.applications, point.hires)));
  const max = rawMax <= 3 ? Math.max(2, rawMax) : Math.ceil(rawMax / 2) * 2;
  const yTicks =
    max <= 3
      ? Array.from({ length: max + 1 }, (_, i) => i)
      : [0, Math.round(max / 2), max];

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (index: number) =>
    points.length <= 1 ? padL + innerW / 2 : padL + (index / (points.length - 1)) * innerW;
  const yAt = (count: number) => padT + innerH - (count / max) * innerH;

  // Đường cong mượt Cubic Bezier (monotone horizontal) không vượt dưới trục 0
  const smoothPath = (field: 'applications' | 'hires') => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${xAt(0).toFixed(1)} ${yAt(points[0]![field]).toFixed(1)}`;
    }
    const coords = points.map((p, idx) => ({ x: xAt(idx), y: yAt(p[field]) }));
    let d = `M ${coords[0]!.x.toFixed(1)} ${coords[0]!.y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i]!;
      const p1 = coords[i + 1]!;
      const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
      const cpx2 = p1.x - (p1.x - p0.x) * 0.45;
      d += ` C ${cpx1.toFixed(1)} ${p0.y.toFixed(1)}, ${cpx2.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const appsLine = smoothPath('applications');
  const hiresLine = smoothPath('hires');
  const area = `${appsLine} L ${xAt(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-48 w-full" role="img" aria-label="Biểu đồ hồ sơ theo thời gian">
      <style>{'@keyframes report-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }'}</style>
      {yTicks.map((tickVal) => {
        const y = yAt(tickVal);
        return (
          <g key={tickVal}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray={tickVal === 0 ? undefined : '3 3'}
            />
            <text x={padL - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontWeight="500">
              {axisTickLabel(tickVal)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#report-fill)" opacity="0.9" />
      <defs>
        <linearGradient id="report-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#072348" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#072348" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path
        key={`${points[0]?.key ?? 'start'}-${points[points.length - 1]?.key ?? 'end'}-hires`}
        d={hiresLine}
        fill="none"
        stroke="#E8872A"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ animation: 'report-draw 1s ease-out forwards' }}
      />
      <path
        key={`${points[0]?.key ?? 'start'}-${points[points.length - 1]?.key ?? 'end'}-apps`}
        d={appsLine}
        fill="none"
        stroke="#072348"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ animation: 'report-draw 0.9s ease-out forwards' }}
      />
      {points.map((point, index) => {
        const showPoint = point.applications > 0 || point.hires > 0 || points.length <= 14;
        if (!showPoint) return null;
        return (
          <g key={point.key}>
            <circle
              cx={xAt(index)}
              cy={yAt(point.applications)}
              r={point.applications > 0 ? '3.5' : '2.2'}
              fill={point.applications > 0 ? '#072348' : '#cbd5e1'}
              stroke="#ffffff"
              strokeWidth="1.2"
              className="origin-center transition-transform duration-200 hover:scale-150"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              <title>{`${point.label}: ${point.applications} hồ sơ mới`}</title>
            </circle>
            {point.hires > 0 ? (
              <circle
                cx={xAt(index)}
                cy={yAt(point.hires)}
                r="3.5"
                fill="#E8872A"
                stroke="#ffffff"
                strokeWidth="1.2"
                className="origin-center transition-transform duration-200 hover:scale-150"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                <title>{`${point.label}: ${point.hires} nhận việc`}</title>
              </circle>
            ) : null}
          </g>
        );
      })}
      {points.map((point, index) =>
        index % labelStep === 0 || index === points.length - 1 ? (
          <text
            key={`${point.key}-label`}
            x={xAt(index)}
            y={height - 5}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            fill="#64748b"
            fontSize="10"
          >
            {point.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function NoCompany() {
  return (
    <div className="mx-auto mt-16 max-w-lg text-center">
      <Building2 className="mx-auto h-12 w-12 text-brand-500" />
      <h2 className="mt-4 text-2xl font-bold text-slate-900">Chưa có hồ sơ công ty</h2>
      <p className="mt-2 text-slate-500">Tạo hồ sơ công ty để xem báo cáo tuyển dụng.</p>
      <Link href="/company">
        <Button className="mt-6">Tạo hồ sơ công ty</Button>
      </Link>
    </div>
  );
}

function ReportSkeleton() {
  return <div className="mt-5 h-56 animate-pulse rounded-2xl bg-gradient-to-r from-brand-100 via-white to-accent-100" />;
}

function formatNum(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

function axisTickLabel(value: number): string {
  return String(Math.round(value));
}

interface ActionableInsight {
  tone: 'warn' | 'good' | 'info';
  title: string;
  desc: string;
  href?: string;
  ctaLabel?: string;
}

function buildActionableInsights({
  report,
  selectedJob,
  appsCount,
  screeningCount,
  interviewsCount,
  offersCount,
  hiresCount,
  sourcing,
  credits,
}: {
  report: RecruitmentReportView;
  selectedJob: RecruitmentReportJobRow | null;
  appsCount: number;
  screeningCount: number;
  interviewsCount: number;
  offersCount: number;
  hiresCount: number;
  sourcing: NonNullable<RecruitmentReportView['sourcing']>;
  credits: NonNullable<RecruitmentReportView['credits']>;
}): ActionableInsight[] {
  const list: ActionableInsight[] = [];

  if (offersCount > report.offersSent) {
    list.push({
      tone: 'warn',
      title: `Có ${offersCount} hồ sơ đang ở bước Đề nghị nhưng chưa lập thư Offer chính thức`,
      desc: 'Hãy tạo và gửi thư Đề nghị nhận việc (Offer Letter) ngay để chốt ứng viên trước khi ứng viên nhận lời mời khác.',
      href: '/recruiter/offers',
      ctaLabel: 'Tạo đề nghị',
    });
  }

  if (screeningCount > 0 && report.interviewSessions === 0 && interviewsCount === 0) {
    list.push({
      tone: 'warn',
      title: `Có ${screeningCount} ứng viên đang ở bước Sàng lọc nhưng chưa có lịch phỏng vấn`,
      desc: 'Đặt lịch phỏng vấn sớm cho các ứng viên có độ phù hợp cao (≥70%) để rút ngắn thời gian tuyển dụng.',
      href: '/recruiter/interviews',
      ctaLabel: 'Đặt lịch PV',
    });
  }

  if (appsCount < 5 && sourcing.outreachQuota > sourcing.outreachCount) {
    const remain = sourcing.outreachQuota - sourcing.outreachCount;
    list.push({
      tone: 'info',
      title: `Tận dụng ${remain} lượt «Giao Inlink liên hệ» trong gói ${sourcing.planName ?? 'Săn nhân sự'}`,
      desc: 'Số lượng hồ sơ tự nộp còn ít. Hãy chọn ứng viên tiềm năng AI khớp cao và giao đội CSKH Inlink kết nối trực tiếp.',
      href: '/recruiter/sourcing',
      ctaLabel: 'Giao Inlink săn',
    });
  } else if (appsCount < 5) {
    list.push({
      tone: 'info',
      title: 'Nguồn ứng viên tự nộp đơn còn mỏng — Nên kết hợp Tìm ứng viên AI chủ động',
      desc: `Hiện có ${appsCount} hồ sơ tự ứng tuyển. Hãy mở kho Tìm ứng viên AI để chủ động mời các ứng viên đúng chuyên ngành.`,
      href: '/search',
      ctaLabel: 'Tìm ứng viên AI',
    });
  }

  if ((report.highMatchCount ?? 0) > 0) {
    list.push({
      tone: 'good',
      title: `Phát hiện ${report.highMatchCount} hồ sơ ứng viên đạt độ phù hợp AI cao (≥70%)`,
      desc: `Điểm khớp cao nhất đạt ${formatNum(report.topMatchScore ?? report.avgMatchScore ?? 0)}%. Ưu tiên liên hệ sớm nhóm ứng viên này.`,
      href: selectedJob ? `/jobs/${selectedJob.jobId}/applicants` : '/recruiter/inbox',
      ctaLabel: 'Xem hồ sơ',
    });
  }

  if (hiresCount > 0) {
    list.push({
      tone: 'good',
      title: `Đã tuyển thành công ${hiresCount} nhân sự trong kỳ báo cáo`,
      desc: 'Theo dõi quy trình hội nhập (Onboarding) để đảm bảo nhân sự mới gắn bó lâu dài.',
      href: '/recruiter/onboarding',
      ctaLabel: 'Xem nhận việc',
    });
  }

  if (list.length === 0) {
    list.push({
      tone: 'info',
      title: 'Quy trình tuyển dụng đang vận hành ổn định',
      desc: `Số dư hiện tại: ${credits.balance} Credit. Tiếp tục theo dõi hộp thư ứng viên và các đợt quét AI định kỳ.`,
      href: '/recruiter/inbox',
      ctaLabel: 'Hộp thư ứng viên',
    });
  }

  return list.slice(0, 4);
}

/** Xuất file Excel (.csv UTF-8 BOM) chuẩn báo cáo cho HR/Sếp. */
function exportRecruitmentCsv(report: RecruitmentReportView, selectedJobId: string) {
  const periodLabel = report.days === 365 ? '12 tháng' : `${report.days} ngày`;
  const sourcing = report.sourcing;
  const credits = report.credits;
  const lines: string[] = [
    `BÁO CÁO TUYỂN DỤNG ĐIỀU HÀNH - ${(report.companyName ?? 'DOANH NGHIỆP').toUpperCase()}`,
    `Kỳ báo cáo:,Trong ${periodLabel} qua,Ngày xuất:,${new Date(report.generatedAt).toLocaleString('vi-VN')}`,
    '',
    'I. CHỈ SỐ TỔNG QUAN (KPIs)',
    'Chỉ số,Giá trị,Ghi chú',
    `Tin đang mở tuyển,${report.openJobs},Tin đang hiển thị công khai`,
    `Hồ sơ ứng tuyển mới (Inbound),${report.applications},Kỳ liền trước: ${report.applicationsPrev} hồ sơ`,
    `Ứng viên Săn AI đã quét (Outbound),${sourcing?.scannedCandidatesCount ?? 0},${sourcing?.scanRoundsInPeriod ?? 0} đợt quét tự động`,
    `Ứng viên đã Shortlist,${sourcing?.shortlistedCount ?? 0},Lưu theo dõi chuyên sâu`,
    `Ứng viên đã giao Inlink liên hệ,${sourcing?.outreachCount ?? 0},Hạn mức gói: ${sourcing?.outreachQuota ?? 0}`,
    `Số hồ sơ đã mở khóa (Credit),${credits?.profilesUnlockedInPeriod ?? 0},Đã dùng ${credits?.consumedInPeriod ?? 0} Credit (Còn dư ${credits?.balance ?? 0})`,
    `Hồ sơ đang Sàng lọc,${report.screening},`,
    `Lịch phỏng vấn / Hồ sơ bước PV,${report.interviewSessions} buổi,${report.interviews} hồ sơ đang ở bước PV`,
    `Đề nghị nhận việc (Offer),${report.offers} hồ sơ,${report.offersSent} thư Offer đã lập`,
    `Nhận việc thành công (Hired),${report.hires},Tỷ lệ chuyển đổi: ${report.conversionPct ?? 0}%`,
    `Từ chối / Rút hồ sơ,${report.rejected + report.withdrawn},${report.rejected} từ chối - ${report.withdrawn} rút`,
    `Điểm khớp AI trung bình,${report.avgMatchScore ?? 0}%,Cao nhất: ${report.topMatchScore ?? 0}% (${report.highMatchCount ?? 0} hồ sơ >=70%)`,
    '',
    'II. PHỄU CHUYỂN ĐỔI TUYỂN DỤNG',
    'Giai đoạn,Số lượng lũy kế qua vòng,Đang đứng ở bước này,Tỷ lệ chuyển đổi (%)',
    ...report.funnel.map(
      (s) =>
        `"${s.label}",${s.cumulativeCount ?? s.count},${s.currentCount ?? s.count},${s.conversionFromStartPct ?? 0}%`,
    ),
    '',
    'III. HIỆU SUẤT CHI TIẾT THEO VỊ TRÍ TUYỂN DỤNG',
    'Vị trí tuyển dụng,Trạng thái,Địa điểm,Hồ sơ nộp,Sàng lọc,Phỏng vấn,Đề nghị,Nhận việc,Đợt quét Săn AI,Giao Inlink,Điểm khớp TB (%),Điểm khớp Cao nhất (%)',
    ...report.jobs
      .filter((j) => selectedJobId === 'all' || j.jobId === selectedJobId)
      .map(
        (j) =>
          `"${formatJobTitle(j.title).replace(/"/g, '""')}","${JOB_STATUS_LABEL[j.status] ?? j.status}","${(j.location ?? '').replace(/"/g, '""')}",${j.applications},${j.screening},${j.interviews},${j.offers},${j.hires},${j.sourcingScans ?? 0},${j.outreachCount ?? 0},${j.avgMatchScore ?? ''},${j.topMatchScore ?? ''}`,
      ),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bao-cao-tuyen-dung-${report.days}ngay-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Mở cửa sổ in / lưu PDF chuẩn A4 trình Sếp. */
function openExecutivePrintReport(report: RecruitmentReportView, selectedJobId: string) {
  const win = window.open('', '_blank', 'width=1024,height=800');
  if (!win) return;

  const periodLabel = report.days === 365 ? '12 tháng' : `${report.days} ngày`;
  const sourcing = report.sourcing;
  const credits = report.credits;
  const jobs = report.jobs.filter((j) => selectedJobId === 'all' || j.jobId === selectedJobId);
  const dateStr = new Date(report.generatedAt).toLocaleString('vi-VN');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Báo cáo tuyển dụng - ${report.companyName ?? 'Doanh nghiệp'}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }
  body { margin: 0; color: #0f172a; font-size: 12px; line-height: 1.45; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #072348; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-size: 11px; font-weight: 700; color: #E8872A; text-transform: uppercase; letter-spacing: 0.08em; }
  .title { font-size: 20px; font-weight: 800; color: #072348; margin: 4px 0; }
  .subtitle { font-size: 12px; color: #475569; }
  .meta { text-align: right; font-size: 11px; color: #475569; }
  .section-title { font-size: 13px; font-weight: 700; color: #072348; text-transform: uppercase; margin: 16px 0 8px; border-left: 4px solid #E8872A; padding-left: 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
  .kpi-label { font-size: 11px; color: #64748b; font-weight: 600; }
  .kpi-val { font-size: 20px; font-weight: 800; color: #072348; margin: 4px 0 2px; }
  .kpi-sub { font-size: 10px; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; }
  th { background: #072348; color: #fff; font-weight: 600; font-size: 11px; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #f8fafc; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; text-align: center; }
  .sign-box { padding-top: 4px; }
  .sign-note { font-size: 10px; color: #64748b; font-style: italic; margin-bottom: 54px; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
  <div class="no-print" style="background:#072348;color:#fff;padding:10px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-radius:8px;">
    <span>Bản xem trước Báo cáo Tuyển dụng chuẩn A4 trình Ban Giám đốc</span>
    <button onclick="window.print()" style="background:#E8872A;color:#fff;border:none;padding:7px 16px;border-radius:6px;font-weight:700;cursor:pointer;">In / Lưu PDF ngay</button>
  </div>

  <div class="header">
    <div>
      <div class="brand">Hệ thống Tuyển dụng Công nghiệp Inlink</div>
      <div class="title">BÁO CÁO HIỆU QUẢ TUYỂN DỤNG NHÂN SỰ</div>
      <div class="subtitle">Đơn vị: <strong>${report.companyName ?? 'Doanh nghiệp'}</strong> ${sourcing?.planName ? `· Gói dịch vụ: <strong>${sourcing.planName}</strong>` : ''}</div>
    </div>
    <div class="meta">
      <div>Kỳ báo cáo: <strong>${periodLabel} qua</strong></div>
      <div>Thời điểm trích xuất: ${dateStr}</div>
    </div>
  </div>

  <div class="section-title">1. Chỉ số tổng quan điều hành (Executive Summary)</div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Hồ sơ ứng tuyển (Inbound)</div>
      <div class="kpi-val">${report.applications}</div>
      <div class="kpi-sub">Kỳ trước: ${report.applicationsPrev} hồ sơ · Khớp ≥70%: ${report.highMatchCount ?? 0}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Nguồn Săn AI (Outbound)</div>
      <div class="kpi-val">${Math.max(sourcing?.scannedCandidatesCount ?? 0, (sourcing?.shortlistedCount ?? 0) + (sourcing?.outreachCount ?? 0))}</div>
      <div class="kpi-sub">${sourcing?.scanRoundsInPeriod ?? 0} đợt quét · ${sourcing?.outreachCount ?? 0} giao Inlink</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Phỏng vấn & Đề nghị</div>
      <div class="kpi-val">${Math.max(report.interviewSessions, report.interviews)} PV / ${Math.max(report.offers, report.offersSent)} Offer</div>
      <div class="kpi-sub">${report.screening} hồ sơ đang sàng lọc</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Nhận việc & Độ khớp AI</div>
      <div class="kpi-val">${report.hires} (${report.conversionPct ?? 0}%)</div>
      <div class="kpi-sub">Độ khớp cao nhất: ${report.topMatchScore ?? report.avgMatchScore ?? 0}%</div>
    </div>
  </div>

  <div class="section-title">2. Phễu chuyển đổi tuyển dụng & Khai thác ngân sách</div>
  <table>
    <thead>
      <tr>
        <th>Giai đoạn quy trình</th>
        <th class="num">Số lượng lũy kế qua vòng</th>
        <th class="num">Đang xử lý tại bước</th>
        <th class="num">Tỷ lệ chuyển đổi so với đầu vào</th>
        <th class="num">Tỷ lệ qua vòng liền trước</th>
      </tr>
    </thead>
    <tbody>
      ${report.funnel
        .map(
          (step) => `<tr>
        <td><strong>${step.label}</strong></td>
        <td class="num"><strong>${step.cumulativeCount ?? step.count}</strong></td>
        <td class="num">${step.currentCount ?? step.count}</td>
        <td class="num">${step.conversionFromStartPct ?? 0}%</td>
        <td class="num">${step.stepPassRatePct ?? 0}%</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <div class="section-title">3. Hiệu suất chi tiết theo từng vị trí tuyển dụng</div>
  <table>
    <thead>
      <tr>
        <th>Vị trí tuyển dụng</th>
        <th>Trạng thái</th>
        <th class="num">Hồ sơ nộp</th>
        <th class="num">Sàng lọc</th>
        <th class="num">Phỏng vấn</th>
        <th class="num">Đề nghị</th>
        <th class="num">Nhận việc</th>
        <th class="num">Quét AI / Giao Inlink</th>
        <th class="num">Độ khớp TB / Top</th>
      </tr>
    </thead>
    <tbody>
      ${jobs
        .map(
          (j) => `<tr>
        <td><strong>${formatJobTitle(j.title)}</strong>${j.location ? `<br/><span style="font-size:10px;color:#64748b;">${j.location}</span>` : ''}</td>
        <td>${JOB_STATUS_LABEL[j.status] ?? j.status}</td>
        <td class="num"><strong>${j.applications}</strong></td>
        <td class="num">${j.screening}</td>
        <td class="num">${j.interviews}</td>
        <td class="num">${j.offers}</td>
        <td class="num"><strong>${j.hires}</strong></td>
        <td class="num">${j.sourcingScans ?? 0} đợt / ${j.outreachCount ?? 0} UV</td>
        <td class="num">${j.avgMatchScore != null ? `${j.avgMatchScore}% (Top ${j.topMatchScore ?? j.avgMatchScore}%)` : '—'}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <div class="sign-grid">
    <div class="sign-box">
      <strong>NGƯỜI LẬP BÁO CÁO (HR / TUYỂN DỤNG)</strong>
      <div class="sign-note">(Ký và ghi rõ họ tên)</div>
    </div>
    <div class="sign-box">
      <strong>PHÊ DUYỆT CỦA BAN GIÁM ĐỐC</strong>
      <div class="sign-note">(Ký và ghi rõ họ tên)</div>
    </div>
  </div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
