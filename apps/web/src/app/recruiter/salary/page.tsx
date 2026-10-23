'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUpRight, Briefcase, Factory, MapPin, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  CAREER_LADDERS,
  INDUSTRY_GROUPS_WEB,
  JOB_TRACK_LABEL,
  JobLevelCode,
  JobTrack,
  trackOfLevel,
  VN_PROVINCES_2025,
  type SalaryEstimateView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Button, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { estimateSalary } from '@/lib/career';

const LEVEL_TONE = [
  {
    bar: 'from-brand-300 to-brand-500',
    soft: 'bg-brand-50 text-brand-700 ring-brand-200',
    glow: 'shadow-brand-600/15',
  },
  {
    bar: 'from-brand-400 to-brand-600',
    soft: 'bg-brand-50 text-brand-800 ring-brand-200',
    glow: 'shadow-brand-600/15',
  },
  {
    bar: 'from-brand-500 to-brand-700',
    soft: 'bg-brand-50 text-brand-800 ring-brand-200',
    glow: 'shadow-brand-700/20',
  },
  {
    bar: 'from-accent-400 to-accent-600',
    soft: 'bg-accent-50 text-accent-800 ring-accent-200',
    glow: 'shadow-accent-500/20',
  },
] as const;

function trieu(n: number) {
  const v = n / 1_000_000;
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
  return text.replace('.', ',');
}

function vnd(n: number) {
  return `${n.toLocaleString('vi-VN')} đ`;
}

function yearsOrUndefined(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

export default function MarketSalaryPage() {
  const [track, setTrack] = useState<JobTrack>(JobTrack.Technical);
  const [level, setLevel] = useState<JobLevelCode>(CAREER_LADDERS[JobTrack.Technical][0]);
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [years, setYears] = useState('');
  const [title, setTitle] = useState('');

  const levels = CAREER_LADDERS[track];
  const yearsOfExperience = yearsOrUndefined(years);
  const titleText = title.trim();
  const filters = {
    industry: industry || undefined,
    location: location || undefined,
    yearsOfExperience,
  };

  const ladder = useQuery({
    queryKey: ['market-salary', track, industry, location, yearsOfExperience ?? ''],
    queryFn: () => Promise.all(levels.map((jobLevel) => estimateSalary({ jobLevel, ...filters }))),
    placeholderData: (previous) => {
      const first = previous?.[0];
      if (!first || trackOfLevel(first.jobLevel) !== track) return undefined;
      return previous;
    },
  });

  const titled = useQuery({
    queryKey: ['market-salary-title', level, industry, location, yearsOfExperience ?? '', titleText],
    queryFn: () => estimateSalary({ jobLevel: level, ...filters, title: titleText }),
    enabled: titleText.length >= 2,
    placeholderData: keepPreviousData,
  });

  const rows = ladder.data ?? [];
  const focus =
    (titleText.length >= 2 ? titled.data : undefined) ??
    rows.find((row) => row.jobLevel === level) ??
    null;
  const scale = Math.max(1, ...rows.map((row) => row.salaryMax));
  const focusIndex = rows.findIndex((row) => row.jobLevel === level);
  const previous = focusIndex > 0 ? rows[focusIndex - 1] : null;
  const error = ladder.error ?? titled.error;
  const tone = LEVEL_TONE[Math.max(0, focusIndex)] ?? LEVEL_TONE[0];

  function chooseTrack(next: JobTrack) {
    setTrack(next);
    setLevel(CAREER_LADDERS[next][0]);
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="brand-accent-dot" />
            Báo cáo
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Lương thị trường</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Khung lương cứng mỗi tháng cho khối kinh doanh và kỹ thuật. Đổi bậc, ngành hoặc địa điểm để thấy khung dịch chuyển.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>
            Viết JD
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <TrackCard
          active={track === JobTrack.Technical}
          title="Kỹ thuật"
          hint="Vận hành, tự động hoá, bảo trì"
          icon={<Wrench className="h-5 w-5" />}
          activeClass="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white shadow-lg shadow-brand-700/25"
          onClick={() => chooseTrack(JobTrack.Technical)}
        />
        <TrackCard
          active={track === JobTrack.Sales}
          title="Kinh doanh"
          hint="Bán hàng B2B, chưa gồm thưởng KPI"
          icon={<Briefcase className="h-5 w-5" />}
          activeClass="bg-gradient-to-br from-accent-400 via-accent-500 to-accent-600 text-white shadow-lg shadow-accent-500/25"
          onClick={() => chooseTrack(JobTrack.Sales)}
        />
      </div>

      <div className="brand-panel mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nhóm ngành" icon={<Factory className="h-3.5 w-3.5" />}>
          <Select value={industry} onChange={(e) => setIndustry(e.target.value)} size="sm">
            <option value="">Tất cả ngành</option>
            {INDUSTRY_GROUPS_WEB.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Địa điểm" icon={<MapPin className="h-3.5 w-3.5" />}>
          <Select value={location} onChange={(e) => setLocation(e.target.value)} size="sm">
            <option value="">Toàn quốc</option>
            {VN_PROVINCES_2025.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Số năm kinh nghiệm" icon={<TrendingUp className="h-3.5 w-3.5" />}>
          <Input
            type="number"
            min={0}
            max={40}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="Ví dụ 5"
            size="sm"
          />
        </Field>
        <Field label="Chức danh" icon={<Sparkles className="h-3.5 w-3.5" />}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ Kỹ sư HVAC"
            size="sm"
          />
        </Field>
      </div>

      {ladder.isLoading && !focus ? (
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-gradient-to-r from-brand-100 via-white to-accent-100" />
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không lấy được lương thị trường.'}
        </p>
      ) : null}

      {focus ? (
        <section
          key={`${focus.jobLevel}-${focus.salaryMin}-${focus.salaryMax}-${focus.factors.join('|')}`}
          className={clsx(
            'relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 p-5 text-white shadow-xl sm:p-6',
            ladder.isFetching && 'opacity-80',
          )}
        >
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-accent-400/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-8 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="relative animate-soft-rise">
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx('rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-white/30', 'bg-white/15')}>
                {JOB_TRACK_LABEL[track]}
              </span>
              <span className="text-sm font-semibold text-white/90">{focus.jobLevelLabel}</span>
              {location ? <span className="text-xs text-accent-100">{location}</span> : null}
            </div>
            <p className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              {trieu(focus.salaryMin)}
              <span className="mx-1 text-white/50">–</span>
              {trieu(focus.salaryMax)}
              <span className="ml-2 text-lg font-semibold text-white/70">triệu/tháng</span>
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Stat label="Cận dưới" value={`${trieu(focus.salaryMin)} tr`} hint={vnd(focus.salaryMin)} tone="bg-white/10" />
              <Stat label="Mức giữa" value={`${trieu(focus.median)} tr`} hint="Điểm cân bằng của khung" tone="bg-accent-400/30" />
              <Stat label="Cận trên" value={`${trieu(focus.salaryMax)} tr`} hint={vnd(focus.salaryMax)} tone="bg-white/10" />
            </div>
            <div className="mt-5">
              <RangeBar row={focus} scale={scale} active onDark tone={tone.bar} />
            </div>
            {previous ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-accent-100">
                <TrendingUp className="h-3.5 w-3.5" />
                Cao hơn {previous.jobLevelLabel} khoảng {trieu(Math.max(0, focus.median - previous.median))} triệu ở mức giữa
              </p>
            ) : (
              <p className="mt-3 text-xs text-white/70">Bậc khởi đầu của lộ trình {JOB_TRACK_LABEL[track]}.</p>
            )}
          </div>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-2">
            {rows.map((row, index) => {
              const active = row.jobLevel === level;
              const paint = LEVEL_TONE[index] ?? LEVEL_TONE[0];
              return (
                <button
                  key={row.jobLevel}
                  type="button"
                  onClick={() => setLevel(row.jobLevel)}
                  className={clsx(
                    'grid w-full gap-3 rounded-2xl border bg-white p-4 text-left transition duration-300 hover:-translate-y-0.5 sm:grid-cols-[auto_1fr_auto] sm:items-center',
                    active
                      ? clsx('border-transparent shadow-lg', paint.glow, 'ring-2 ring-accent-400 ring-offset-2 ring-offset-[#F5F7FB]')
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <span className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ring-1', paint.soft)}>
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{row.jobLevelLabel}</span>
                    <span className="mt-2 block">
                      <RangeBar row={row} scale={scale} active={active} tone={paint.bar} />
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800 sm:text-right">
                    {trieu(row.salaryMin)}–{trieu(row.salaryMax)}
                    <span className="block text-[11px] font-medium text-slate-400">triệu/tháng</span>
                  </span>
                </button>
              );
            })}
          </div>

          {focus ? (
            <aside className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Vì sao khung này</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {focus.factors.map((factor, index) => (
                  <li
                    key={factor}
                    className={clsx(
                      'animate-chip-pop rounded-full px-2.5 py-1 text-[12px] font-medium ring-1',
                      index % 2 === 0 && 'bg-brand-50 text-brand-800 ring-brand-200',
                      index % 2 === 1 && 'bg-accent-50 text-accent-800 ring-accent-200',
                    )}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    {factor}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">{focus.notes}</p>
              <p className="mt-3 text-[11px] font-semibold text-slate-400">
                Độ tin cậy tham chiếu {Math.round(focus.confidence * 100)}%
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={clsx('h-full origin-left rounded-full bg-gradient-to-r animate-bar-grow', tone.bar)}
                  style={{ width: `${Math.round(focus.confidence * 100)}%` }}
                />
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}

function TrackCard({
  active,
  title,
  hint,
  icon,
  activeClass,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  icon: ReactNode;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5',
        active ? activeClass : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
      )}
    >
      <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', active ? 'bg-white/20' : 'bg-slate-100 text-slate-600')}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className={clsx('mt-0.5 block text-xs', active ? 'text-white/80' : 'text-slate-500')}>{hint}</span>
      </span>
    </button>
  );
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-[12px] font-semibold text-slate-500">
      <span className="mb-1.5 flex items-center gap-1.5">
        <span className="text-accent-600">{icon}</span>
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className={clsx('rounded-xl px-3 py-2.5 backdrop-blur-sm', tone)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-white/70">{hint}</p>
    </div>
  );
}

function RangeBar({
  row,
  scale,
  active,
  onDark = false,
  tone,
}: {
  row: SalaryEstimateView;
  scale: number;
  active: boolean;
  onDark?: boolean;
  tone: string;
}) {
  const left = (row.salaryMin / scale) * 100;
  const width = Math.max(8, ((row.salaryMax - row.salaryMin) / scale) * 100);
  const median = (row.median / scale) * 100;
  return (
    <div className={clsx('relative h-2.5 rounded-full', onDark ? 'bg-white/15' : 'bg-slate-100')}>
      <div
        className={clsx(
          'absolute top-0 h-2.5 rounded-full bg-gradient-to-r transition-all duration-700 ease-soft',
          tone,
          active ? 'opacity-100' : 'opacity-70',
        )}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
      <span
        className={clsx(
          'absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full shadow transition-all duration-700 ease-soft',
          onDark ? 'bg-accent-200' : 'bg-brand-700',
        )}
        style={{ left: `${median}%` }}
        title={`Mức giữa ${trieu(row.median)} triệu`}
      />
    </div>
  );
}
