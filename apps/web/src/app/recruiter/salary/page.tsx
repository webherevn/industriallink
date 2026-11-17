'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Factory,
  Layers,
  MapPin,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  CAREER_LADDERS,
  INDUSTRY_GROUPS_WEB,
  JOB_LEVEL_LABEL,
  JOB_TRACK_LABEL,
  JobLevelCode,
  JobTrack,
  trackOfLevel,
  VN_PROVINCES_2025,
  type SalaryEstimateView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { estimateSalary } from '@/lib/career';

const COMPARE_LOCATIONS = ['Hà Nội', 'TP. Hồ Chí Minh', 'Bình Dương', 'Bắc Ninh'] as const;

const LOCATION_COLORS = ['#072348', '#1D4ED8', '#0EA5E9', '#38BDF8', '#CBD5E1'] as const;

function trieu(n: number) {
  const v = n / 1_000_000;
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
  return text.replace('.', ',');
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
  const [titleDraft, setTitleDraft] = useState('');
  const [titleApplied, setTitleApplied] = useState('');

  const levels = CAREER_LADDERS[track];
  const yearsOfExperience = yearsOrUndefined(years);
  const titleText = titleApplied.trim();
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

  // So sánh mức lương P50 thật giữa các tỉnh/thành công nghiệp trọng điểm
  const locationCompare = useQuery({
    queryKey: ['market-salary-locations', level, industry, yearsOfExperience ?? '', titleText],
    queryFn: async () => {
      const baseFilters = {
        jobLevel: level,
        industry: industry || undefined,
        yearsOfExperience,
        title: titleText.length >= 2 ? titleText : undefined,
      };
      const [national, ...cities] = await Promise.all([
        estimateSalary(baseFilters),
        ...COMPARE_LOCATIONS.map((loc) => estimateSalary({ ...baseFilters, location: loc })),
      ]);
      return {
        national,
        cities: COMPARE_LOCATIONS.map((loc, idx) => ({
          name: loc,
          data: cities[idx]!,
        })),
      };
    },
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

  function chooseTrack(next: JobTrack) {
    setTrack(next);
    setLevel(CAREER_LADDERS[next][0]);
  }

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    setTitleApplied(titleDraft);
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
            <span className="h-3.5 w-1 rounded-full bg-accent-500" />
            Báo cáo thị trường
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#072348]">
            Lương thị trường
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Khung lương tham khảo cho từng vị trí, ngành và địa điểm dựa trên dữ liệu tuyển dụng thực tế của Inlink.
          </p>
        </div>

        <Link
          href="/jobs/new"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#FFD0A3] bg-[#FFF8F1] px-4 text-xs font-bold text-[#072348] shadow-2xs transition hover:border-[#E8872A] hover:bg-[#FFEEDB]"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#E8872A]" />
          Viết JD từ dữ liệu lương
        </Link>
      </div>

      {/* 2 thẻ chọn khối */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <TrackCard
          active={track === JobTrack.Technical}
          title="Kỹ thuật"
          hint="Vận hành, tự động hoá, bảo trì"
          icon={<Wrench className="h-5 w-5" />}
          onClick={() => chooseTrack(JobTrack.Technical)}
        />
        <TrackCard
          active={track === JobTrack.Sales}
          title="Kinh doanh"
          hint="Bán hàng B2B, phát triển thị trường"
          icon={<Briefcase className="h-5 w-5" />}
          onClick={() => chooseTrack(JobTrack.Sales)}
        />
      </div>

      {/* Thanh 5 bộ lọc + Áp dụng */}
      <form
        onSubmit={handleApplyFilters}
        className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.9fr_1.1fr_auto] lg:items-end">
          <FilterField label="Nhóm ngành" icon={<Factory className="h-3.5 w-3.5 text-[#E8872A]" />}>
            <Select value={industry} onChange={(e) => setIndustry(e.target.value)} size="sm">
              <option value="">Tất cả ngành</option>
              {INDUSTRY_GROUPS_WEB.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Địa điểm" icon={<MapPin className="h-3.5 w-3.5 text-[#E8872A]" />}>
            <Select value={location} onChange={(e) => setLocation(e.target.value)} size="sm">
              <option value="">Toàn quốc</option>
              {VN_PROVINCES_2025.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Cấp bậc" icon={<Layers className="h-3.5 w-3.5 text-[#E8872A]" />}>
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value as JobLevelCode)}
              size="sm"
            >
              {levels.map((lv) => (
                <option key={lv} value={lv}>
                  {JOB_LEVEL_LABEL[lv] ?? lv}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField
            label="Số năm kinh nghiệm"
            icon={<TrendingUp className="h-3.5 w-3.5 text-[#E8872A]" />}
          >
            <Input
              type="number"
              min={0}
              max={40}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="Ví dụ 5 năm"
              size="sm"
            />
          </FilterField>

          <FilterField
            label="Chức danh / Vị trí"
            icon={<Search className="h-3.5 w-3.5 text-[#E8872A]" />}
          >
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="Ví dụ: Kỹ sư HVAC"
              size="sm"
            />
          </FilterField>

          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#072348] px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#0c3266]"
          >
            Áp dụng
          </button>
        </div>
      </form>

      {ladder.isLoading && !focus ? (
        <div className="mt-4 h-44 animate-pulse rounded-2xl bg-gradient-to-r from-brand-100 via-white to-accent-100" />
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không lấy được lương thị trường.'}
        </p>
      ) : null}

      {/* Banner xanh navy tổng quan */}
      {focus ? (
        <section
          className={clsx(
            'brand-hero-surface mt-4 rounded-2xl p-5 sm:p-6',
            (ladder.isFetching || titled.isFetching) && 'opacity-85',
          )}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/25">
                  {JOB_TRACK_LABEL[track]}
                </span>
                <span className="text-sm font-semibold text-white/95">{focus.jobLevelLabel}</span>
                {location ? (
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-200">
                    {location}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                <span className="text-[#E8872A]">
                  {trieu(focus.salaryMin)} – {trieu(focus.salaryMax)}
                </span>{' '}
                <span className="text-lg font-semibold text-white/80">triệu/tháng</span>
              </p>

              <p className="mt-2 text-xs text-white/75">
                {previous
                  ? `Cao hơn ${previous.jobLevelLabel} khoảng ${trieu(Math.max(0, focus.median - previous.median))} triệu/tháng ở mức giữa.`
                  : `Bậc khởi đầu của lộ trình ${JOB_TRACK_LABEL[track]} · Độ tin cậy ${Math.round(focus.confidence * 100)}%.`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 p-3.5 ring-1 ring-white/15">
                <p className="text-[11px] font-medium text-white/70">Cận dưới</p>
                <p className="mt-1 text-xl font-bold text-white">{trieu(focus.salaryMin)} triệu</p>
                <p className="mt-1 text-[10.5px] text-white/60">
                  P25 — 25% ứng viên nhận ≤ mức này
                </p>
              </div>

              <div className="rounded-xl bg-amber-500/20 p-3.5 ring-1 ring-amber-300/40">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
                  <Target className="h-3.5 w-3.5" />
                  <span>Mức giữa (phổ biến)</span>
                </div>
                <p className="mt-1 text-xl font-bold text-[#FFB366]">{trieu(focus.median)} triệu</p>
                <p className="mt-1 text-[10.5px] text-white/70">
                  P50 — mức được trả phổ biến nhất
                </p>
              </div>

              <div className="rounded-xl bg-white/10 p-3.5 ring-1 ring-white/15">
                <p className="text-[11px] font-medium text-white/70">Cận trên</p>
                <p className="mt-1 text-xl font-bold text-white">{trieu(focus.salaryMax)} triệu</p>
                <p className="mt-1 text-[10.5px] text-white/60">
                  P75 — 25% ứng viên nhận ≥ mức này
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Hàng giữa: Biểu đồ khung lương theo cấp bậc + So sánh theo địa điểm */}
      {rows.length > 0 ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          {/* Biểu đồ khung lương 4 cấp bậc */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-7">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#E8872A]" />
              <div>
                <h2 className="text-[15px] font-bold text-[#072348]">
                  Phổ lương theo cấp bậc ({JOB_TRACK_LABEL[track]})
                </h2>
                <p className="text-xs text-slate-500">
                  Khoảng Min – P50 – Max (triệu/tháng). Bấm vào từng bậc để xem chi tiết.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 items-end gap-3 pt-4">
              {rows.map((row) => {
                const active = row.jobLevel === level;
                const heightPct = Math.max(18, Math.round((row.median / scale) * 100));
                return (
                  <button
                    key={row.jobLevel}
                    type="button"
                    onClick={() => setLevel(row.jobLevel)}
                    className="group flex flex-col items-center text-center"
                  >
                    <span
                      className={clsx(
                        'mb-1.5 text-xs font-bold tabular-nums',
                        active ? 'text-[#E8872A]' : 'text-slate-600',
                      )}
                    >
                      {trieu(row.median)} tr
                    </span>
                    <div className="flex h-36 w-full max-w-[56px] items-end justify-center rounded-xl bg-slate-100/80 p-1">
                      <div
                        className={clsx(
                          'w-full rounded-lg transition-all duration-300',
                          active
                            ? 'bg-gradient-to-t from-[#E8872A] to-amber-400 shadow-sm'
                            : 'bg-[#CBD5E1] group-hover:bg-brand-300',
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span
                      className={clsx(
                        'mt-2 line-clamp-2 text-[11.5px] leading-tight',
                        active ? 'font-bold text-[#072348]' : 'font-medium text-slate-600',
                      )}
                    >
                      {row.jobLevelLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* So sánh theo địa điểm */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#E8872A]" />
              <div>
                <h2 className="text-[15px] font-bold text-[#072348]">So sánh theo địa điểm</h2>
                <p className="text-xs text-slate-500">
                  Mức lương phổ biến (P50) tại các khu vực trọng điểm.
                </p>
              </div>
            </div>

            {locationCompare.data ? (
              <div className="mt-4 flex flex-wrap items-center gap-5 sm:flex-nowrap">
                {/* Donut P50 */}
                <div className="relative mx-auto h-28 w-28 shrink-0">
                  <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
                    <circle cx="55" cy="55" r={42} fill="none" stroke="#e2e8f0" strokeWidth="14" />
                    <circle
                      cx="55"
                      cy="55"
                      r={42}
                      fill="none"
                      stroke="#0B468C"
                      strokeWidth="14"
                      strokeDasharray={`${2 * Math.PI * 42 * 0.72} ${2 * Math.PI * 42}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-extrabold text-[#072348]">
                      {trieu(locationCompare.data.national.median)} tr
                    </span>
                    <span className="text-[10px] text-slate-500">Toàn quốc</span>
                  </div>
                </div>

                <ul className="min-w-0 flex-1 space-y-2 text-xs">
                  {locationCompare.data.cities.map((c, idx) => {
                    const base = locationCompare.data!.national.median;
                    const diffPct =
                      base > 0 ? Math.round(((c.data.median - base) / base) * 100) : 0;
                    return (
                      <li key={c.name} className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 truncate text-slate-700">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: LOCATION_COLORS[idx] }}
                          />
                          <span className="truncate font-medium">{c.name}</span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-[#072348]">
                          {trieu(c.data.median)} triệu
                          {diffPct !== 0 && (
                            <span
                              className={clsx(
                                'ml-1 text-[11px] font-semibold',
                                diffPct > 0 ? 'text-emerald-600' : 'text-slate-400',
                              )}
                            >
                              ({diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`})
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-100" />
            )}
          </div>
        </div>
      ) : null}

      {/* Hàng dưới: Bảng Mức lương tham khảo theo cấp bậc + Nhận định & gợi ý */}
      {rows.length > 0 && focus ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          {/* Bảng cấp bậc */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-7">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#0B468C]" />
              <h2 className="text-[15px] font-bold text-[#072348]">
                Mức lương tham khảo theo cấp bậc
              </h2>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11.5px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Cấp bậc</th>
                    <th className="px-3 py-2.5 text-center">Khoảng lương (triệu/tháng)</th>
                    <th className="px-3 py-2.5 text-center">Mức phổ biến (P50)</th>
                    <th className="py-2.5 pl-3 text-right">Độ tin cậy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const active = row.jobLevel === level;
                    return (
                      <tr
                        key={row.jobLevel}
                        onClick={() => setLevel(row.jobLevel)}
                        className={clsx(
                          'cursor-pointer transition',
                          active ? 'bg-sky-50/70 font-semibold' : 'hover:bg-slate-50',
                        )}
                      >
                        <td className="py-3 pr-3 text-[#072348]">{row.jobLevelLabel}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-700">
                          {trieu(row.salaryMin)} – {trieu(row.salaryMax)}
                        </td>
                        <td className="px-3 py-3 text-center font-bold tabular-nums text-[#072348]">
                          {trieu(row.median)}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {Math.round(row.confidence * 100)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nhận định & gợi ý */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs lg:col-span-5">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#E8872A]" />
                <h2 className="text-[15px] font-bold text-[#072348]">Nhận định &amp; gợi ý</h2>
              </div>

              <div className="mt-3.5 space-y-3">
                <div className="rounded-xl bg-slate-50/90 p-3.5">
                  <p className="text-xs font-bold text-[#072348]">{focus.jobLevelLabel}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{focus.notes}</p>
                </div>

                {focus.factors.length > 0 && (
                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3.5">
                    <p className="text-xs font-bold text-[#072348]">Yếu tố ảnh hưởng &amp; Gợi ý</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                      {focus.factors.slice(0, 3).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8872A]" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Link
                href="/jobs/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0c3266]"
              >
                Áp dụng vào tin tuyển dụng
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
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
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3.5 rounded-2xl border p-4 text-left transition',
        active
          ? 'brand-hero-surface border-transparent text-white shadow-md'
          : 'border-slate-200 bg-white text-[#072348] hover:border-slate-300',
      )}
    >
      <span
        className={clsx(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-[15px] font-bold">{title}</p>
        <p className={clsx('mt-0.5 text-xs', active ? 'text-white/75' : 'text-slate-500')}>
          {hint}
        </p>
      </div>
    </button>
  );
}

function FilterField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {children}
    </label>
  );
}
