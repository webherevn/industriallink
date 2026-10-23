'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Minus,
  Target,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { formatJobTitle, type RecruitmentReportView } from '@industriallink/contracts';
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
  'bg-brand-400',
  'bg-accent-500',
  'bg-emerald-500',
];

export default function RecruiterReportPage() {
  const [days, setDays] = useState<number>(30);
  const report = useQuery({
    queryKey: ['recruiter', 'recruitment-report', days],
    queryFn: () => getRecruitmentReport(days),
    placeholderData: keepPreviousData,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
              Báo cáo
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-800">
              Báo cáo tuyển dụng
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Hồ sơ nhận trong kỳ, phễu trạng thái hiện tại và hiệu suất từng tin.
            </p>
          </div>
          <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {PERIODS.map((period) => (
              <button
                key={period.days}
                type="button"
                onClick={() => setDays(period.days)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  days === period.days
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {period.label}
              </button>
            ))}
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
          <ReportBody report={report.data} refreshing={report.isFetching} />
        ) : null}
      </div>
    </AppShell>
  );
}

function ReportBody({
  report,
  refreshing,
}: {
  report: RecruitmentReportView;
  refreshing: boolean;
}) {
  const updated = new Date(report.generatedAt).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
  const funnelMax = Math.max(1, ...report.funnel.map((step) => step.count));
  const inPipeline = report.screening + report.interviews + report.offers;

  return (
    <div className={clsx('mt-5 space-y-4', refreshing && 'opacity-80')}>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 p-5 text-white shadow-xl shadow-brand-700/20 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-accent-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="relative animate-soft-rise">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white/80">
              {report.companyName ?? 'Công ty'} · {report.days === 365 ? '12 tháng' : `${report.days} ngày`} qua
            </p>
            <p className="text-xs text-white/60">Cập nhật {updated}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat
              label="Tỷ lệ nhận việc"
              value={report.conversionPct == null ? '—' : `${formatNum(report.conversionPct)}%`}
              hint={
                report.applications
                  ? `${report.hires} / ${report.applications} hồ sơ mới`
                  : 'Chưa có hồ sơ mới'
              }
            />
            <HeroStat
              label="Thời gian tuyển"
              value={report.avgTimeToHireDays == null ? '—' : `${formatNum(report.avgTimeToHireDays)} ngày`}
              hint="Từ lúc nộp đến lúc chốt trong kỳ"
            />
            <HeroStat
              label="Điểm khớp trung bình"
              value={report.avgMatchScore == null ? '—' : `${formatNum(report.avgMatchScore)}%`}
              hint="Hồ sơ mới có điểm khớp"
            />
            <HeroStat
              label="Tin đang mở"
              value={String(report.openJobs)}
              hint="Tin đang tuyển lúc này"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Hồ sơ mới"
          value={report.applications}
          hint={<Delta current={report.applications} previous={report.applicationsPrev} />}
          delay="0ms"
        />
        <Kpi
          icon={<FileText className="h-4 w-4" />}
          label="Đang xử lý"
          value={inPipeline}
          hint={<span>Sàng lọc, phỏng vấn và đề nghị</span>}
          delay="60ms"
        />
        <Kpi
          icon={<CalendarDays className="h-4 w-4" />}
          label="Lịch phỏng vấn"
          value={report.interviewSessions}
          hint={<span>{report.interviews} hồ sơ đang ở bước phỏng vấn</span>}
          delay="120ms"
        />
        <Kpi
          icon={<Briefcase className="h-4 w-4" />}
          label="Đề nghị"
          value={report.offers}
          hint={<span>{report.offersSent} đề nghị đã gửi trong kỳ</span>}
          delay="180ms"
        />
        <Kpi
          icon={<UserCheck className="h-4 w-4" />}
          label="Nhận việc"
          value={report.hires}
          hint={<span>Hồ sơ mới đã chuyển sang nhận việc</span>}
          delay="240ms"
        />
        <Kpi
          icon={<Clock className="h-4 w-4" />}
          label="Từ chối / rút"
          value={report.rejected + report.withdrawn}
          hint={
            <span>
              {report.rejected} từ chối · {report.withdrawn} rút hồ sơ
            </span>
          }
          delay="300ms"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel className="p-5" delay="80ms">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-brand-800">Phễu hồ sơ</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Trạng thái hiện tại của hồ sơ nộp trong kỳ.
              </p>
            </div>
            <Target className="h-4 w-4 text-accent-500" />
          </div>
          <ol className="mt-5 space-y-3.5">
            {report.funnel.map((step, index) => {
              const share = report.applications
                ? Math.round((step.count / report.applications) * 100)
                : 0;
              return (
                <li key={step.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">{step.label}</span>
                    <span className="tabular-nums text-slate-500">
                      <span className="font-semibold text-brand-800">{step.count}</span>
                      <span className="ml-1 text-xs">{share}%</span>
                    </span>
                  </div>
                  <GrowBar
                    pct={report.applications ? (step.count / funnelMax) * 100 : 0}
                    className={FUNNEL_BAR[index] ?? 'bg-brand-600'}
                    delay={index * 70}
                  />
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel className="p-5" delay="140ms">
          <div>
            <h2 className="text-base font-bold text-brand-800">Hồ sơ theo thời gian</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Hồ sơ mới theo ngày nộp. Nhận việc theo ngày chốt.
            </p>
          </div>
          <TrendChart points={report.trend} />
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              Hồ sơ mới
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-500" />
              Nhận việc
            </span>
          </div>
        </Panel>
      </section>

      <Panel className="overflow-hidden" delay="180ms">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-brand-800">Hiệu suất theo tin</h2>
            <p className="mt-0.5 text-xs text-slate-500">Tối đa 12 tin có nhiều hồ sơ mới nhất trong kỳ.</p>
          </div>
          <Link href="/jobs/manage" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
            Quản lý tin
          </Link>
        </div>
        {report.jobs.length === 0 ? (
          <p className="border-t border-slate-100 px-5 py-10 text-center text-sm text-slate-500">
            Chưa có hồ sơ mới trong kỳ này.
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
                  <th className="px-5 py-2.5 text-right font-semibold">Khớp</th>
                </tr>
              </thead>
              <tbody>
                {report.jobs.map((job) => (
                  <tr key={job.jobId} className="border-t border-slate-100 transition hover:bg-brand-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/jobs/${job.jobId}/applicants`} className="font-semibold text-brand-800 hover:underline">
                        {formatJobTitle(job.title)}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {JOB_STATUS_LABEL[job.status] ?? job.status}
                        {job.location ? ` · ${job.location}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {job.applications}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{job.screening}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{job.interviews}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{job.offers}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">
                      {job.hires}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                      {job.avgMatchScore == null ? '—' : `${formatNum(job.avgMatchScore)}%`}
                    </td>
                  </tr>
                ))}
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
        'animate-soft-rise rounded-xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
      style={delay ? { animationDelay: delay } : undefined}
    >
      {children}
    </div>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-white/65">{hint}</p>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  delay,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: ReactNode;
  delay: string;
}) {
  return (
    <Panel className="p-4" delay={delay}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-brand-800">
        <RisingNumber value={value} />
      </p>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
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
        className={clsx('h-full rounded-full transition-all duration-700 ease-out', className)}
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
  const height = 176;
  const padL = 32;
  const padR = 8;
  const padT = 14;
  const padB = 24;
  const max = Math.max(1, ...points.map((point) => Math.max(point.applications, point.hires)));
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (index: number) =>
    points.length <= 1 ? padL + innerW / 2 : padL + (index / (points.length - 1)) * innerW;
  const yAt = (count: number) => padT + innerH - (count / max) * innerH;
  const line = (field: 'applications' | 'hires') =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(1)} ${yAt(point[field]).toFixed(1)}`)
      .join(' ');
  const area = `${line('applications')} L ${xAt(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const showDots = points.length <= 16;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-48 w-full" role="img" aria-label="Biểu đồ hồ sơ theo thời gian">
      <style>{'@keyframes report-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }'}</style>
      {[0, 0.5, 1].map((tick) => {
        const y = yAt(max * tick);
        return (
          <g key={tick}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="10">
              {axisTickLabel(max * tick)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#report-fill)" opacity="0.9" />
      <defs>
        <linearGradient id="report-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#072348" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#072348" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        key={`${points[0]?.key ?? 'start'}-${points[points.length - 1]?.key ?? 'end'}-hires`}
        d={line('hires')}
        fill="none"
        stroke="#E8872A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ animation: 'report-draw 1s ease-out forwards' }}
      />
      <path
        key={`${points[0]?.key ?? 'start'}-${points[points.length - 1]?.key ?? 'end'}-apps`}
        d={line('applications')}
        fill="none"
        stroke="#072348"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ animation: 'report-draw 0.9s ease-out forwards' }}
      />
      {showDots
        ? points.map((point, index) => (
            <g key={point.key}>
              <circle cx={xAt(index)} cy={yAt(point.applications)} r="3" fill="#072348" />
              {point.hires > 0 ? (
                <circle cx={xAt(index)} cy={yAt(point.hires)} r="3" fill="#E8872A" />
              ) : null}
            </g>
          ))
        : null}
      {points.map((point, index) =>
        index % labelStep === 0 || index === points.length - 1 ? (
          <text
            key={`${point.key}-label`}
            x={xAt(index)}
            y={height - 4}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            fill="#94a3b8"
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
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}
