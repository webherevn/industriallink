'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bookmark,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  CAREER_LADDERS,
  ExperienceBand,
  INDUSTRY_GROUPS,
  JOB_LEVEL_LABEL,
  JOB_TRACK_LABEL,
  JobLevelCode,
  JobTrack,
  POPULAR_JOB_KEYWORDS,
  SALARY_BANDS_VND,
  SALARY_PRESETS,
  type ApplicationView,
  type JobListItem,
  type JobMatchView,
  type ListPublishedJobsQuery,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { LocationPicker } from '@/components/location-picker';
import { Badge, Button, Input, Select } from '@/components/ui';
import { myApplications } from '@/lib/applications';
import {
  APPLICATION_STATUS_LABEL,
  EXPERIENCE_LABEL,
  formatJobLevel,
  formatSalary,
  statusTone,
} from '@/lib/format';
import {
  addJobBookmark,
  listBookmarkedJobs,
  listPublishedJobs,
  removeJobBookmark,
} from '@/lib/jobs';
import { recommendedJobs } from '@/lib/matching';

type TabId = 'all' | 'saved' | 'applied';

/** Số tin mỗi trang — giữ cột giữa cân với sidebar. */
const PAGE_SIZE = 5;

/** Nhãn kinh nghiệm trên bộ lọc — khớp mockup, giá trị DB vẫn đồng bộ ExperienceBand. */
const FILTER_EXPERIENCE_LABEL: Record<ExperienceBand, string> = {
  [ExperienceBand.None]: 'Chưa có kinh nghiệm',
  [ExperienceBand.Under1]: 'Dưới 1 năm',
  [ExperienceBand.From1To3]: '1 - 3 năm',
  [ExperienceBand.From3To5]: '3 - 5 năm',
  [ExperienceBand.Over5]: 'Trên 5 năm',
};

const EXPERIENCE_OPTIONS = Object.values(ExperienceBand);

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function shortIndustry(industry: string | null): string {
  if (!industry) return '';
  const head = industry.split('/')[0]?.trim();
  return head || industry;
}

/** Chữ viết tắt công ty — tránh slice(0,2) với tên tiếng Việt (vd. "Công" → "Cô"). */
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

function JobsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [draftKeyword, setDraftKeyword] = useState(searchParams.get('keyword') ?? '');

  const tab = (searchParams.get('tab') as TabId) || 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const industry = searchParams.get('industry') ?? '';
  const locations = useMemo(() => {
    const multi = parseList(searchParams.get('locations'));
    if (multi.length) return multi;
    const single = searchParams.get('location')?.trim();
    return single ? [single] : [];
  }, [searchParams]);
  const jobLevels = parseList(searchParams.get('jobLevel'));
  const experienceBands = parseList(searchParams.get('experienceBand'));
  const salaryPreset = searchParams.get('salary') ?? '';
  const salaryPresetObj = SALARY_PRESETS.find((p) => p.label === salaryPreset);
  const pageRaw = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const listQuery: ListPublishedJobsQuery = useMemo(() => {
    const q: ListPublishedJobsQuery = {};
    if (keyword) q.keyword = keyword;
    if (industry) q.industry = industry;
    if (locations.length) q.locations = locations;
    if (jobLevels.length) q.jobLevel = jobLevels.join(',');
    if (experienceBands.length) q.experienceBand = experienceBands.join(',');
    if (salaryPresetObj?.min && salaryPresetObj.min !== '__custom__') {
      q.salaryMin = Number(salaryPresetObj.min);
      q.salaryMax = Number(salaryPresetObj.max);
    }
    return q;
  }, [keyword, industry, locations, jobLevels, experienceBands, salaryPresetObj]);

  const setParams = useCallback(
    (patch: Record<string, string | null>, replace = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = () => {
    setDraftKeyword('');
    setParams({
      keyword: null,
      industry: null,
      location: null,
      locations: null,
      jobLevel: null,
      experienceBand: null,
      salary: null,
      page: null,
    });
  };

  /** Đổi bộ lọc / tab thì về trang 1. */
  const setFilterParams = useCallback(
    (patch: Record<string, string | null>) => {
      setParams({ ...patch, page: null });
    },
    [setParams],
  );

  const hasActiveFilters = Boolean(
    keyword || industry || locations.length || jobLevels.length || experienceBands.length || salaryPreset,
  );

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', listQuery],
    queryFn: () => listPublishedJobs(listQuery),
  });

  const { data: bookmarks, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['job-bookmarks'],
    queryFn: listBookmarkedJobs,
    retry: false,
    enabled: tab === 'saved',
  });

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
    enabled: tab === 'applied',
  });

  const { data: matches } = useQuery({
    queryKey: ['jobs-match-preview'],
    queryFn: recommendedJobs,
    retry: false,
  });

  const matchByJobId = useMemo(() => {
    const map = new Map<string, JobMatchView>();
    matches?.forEach((m) => map.set(m.jobId, m));
    return map;
  }, [matches]);

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await removeJobBookmark(id);
      else await addJobBookmark(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-bookmarks'] });
    },
  });

  const toggleLevel = (code: JobLevelCode) => {
    const next = jobLevels.includes(code)
      ? jobLevels.filter((l) => l !== code)
      : [...jobLevels, code];
    setFilterParams({ jobLevel: next.length ? next.join(',') : null, tab: 'all' });
  };

  const toggleExperience = (band: ExperienceBand) => {
    const next = experienceBands.includes(band)
      ? experienceBands.filter((b) => b !== band)
      : [...experienceBands, band];
    setFilterParams({ experienceBand: next.length ? next.join(',') : null, tab: 'all' });
  };

  const topPositions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs ?? []) {
      const key = job.jobLevel || job.title;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({
        label: JOB_LEVEL_LABEL[key as JobLevelCode] ?? key,
        count,
      }));
  }, [jobs]);

  const salaryHighlight = useMemo(() => {
    const level = JobLevelCode.SalesStaff;
    const band = SALARY_BANDS_VND[level];
    const median = Math.round((band.min + band.max) / 2 / 100_000) / 10;
    return {
      title: JOB_LEVEL_LABEL[level],
      median,
      range: formatSalary(band.min, band.max),
    };
  }, []);

  const allJobs: JobListItem[] =
    tab === 'saved' ? (bookmarks ?? []) : tab === 'all' ? (jobs ?? []) : [];
  const allApplications = applications ?? [];

  const totalItems = tab === 'applied' ? allApplications.length : allJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE) || 1);
  const currentPage = Math.min(page, totalPages);
  const pageOffset = (currentPage - 1) * PAGE_SIZE;
  const displayJobs = allJobs.slice(pageOffset, pageOffset + PAGE_SIZE);
  const displayApplications = allApplications.slice(pageOffset, pageOffset + PAGE_SIZE);

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    setParams({ page: clamped <= 1 ? null : String(clamped) });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const loading =
    (tab === 'all' && isLoading) ||
    (tab === 'saved' && bookmarksLoading) ||
    (tab === 'applied' && appsLoading);

  return (
    <AppShell wide flush>
      {/* Hero — full-bleed trong vùng content */}
      <section className="relative mt-4 overflow-hidden rounded-2xl border border-sky-100/80 bg-[#E8F1FB]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 85% 40%, rgba(7,35,72,0.14), transparent 55%), radial-gradient(circle at 12% 78%, rgba(245,158,11,0.14), transparent 42%), radial-gradient(circle at 70% 10%, rgba(14,165,233,0.1), transparent 40%)',
          }}
        />
        {/* Mô típ công nghiệp nhẹ bằng CSS */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.12]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23072348' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="max-w-xl">
            <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">
              Tìm đúng cơ hội trong{' '}
              <span className="text-brand-500">ngành công nghiệp</span>
            </h1>
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-600">
              Hàng nghìn cơ hội việc làm từ các doanh nghiệp uy tín trong lĩnh vực kỹ thuật, sản
              xuất, vận hành và kinh doanh B2B.
            </p>
          </div>

          {/* Search card */}
          <form
            className="relative z-20 mt-6 flex flex-col gap-0 overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 sm:flex-row sm:items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              setFilterParams({ keyword: draftKeyword.trim() || null, tab: 'all' });
            }}
          >
            <div className="relative min-w-0 flex-1 border-b border-slate-100 sm:border-b-0 sm:border-r">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                placeholder="Nhập vị trí, kỹ năng, công ty..."
                className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="border-b border-slate-100 sm:w-[200px] sm:border-b-0 sm:border-r">
              <select
                value={industry}
                onChange={(e) => setFilterParams({ industry: e.target.value || null })}
                className="h-12 w-full appearance-none bg-transparent px-3.5 text-sm text-slate-700 outline-none"
              >
                <option value="">Tất cả ngành nghề</option>
                {INDUSTRY_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative border-b border-slate-100 sm:w-[200px] sm:border-b-0 sm:border-r">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <LocationPicker
                variant="bar"
                value={locations}
                placeholder="Tất cả địa điểm"
                onChange={(next) =>
                  setFilterParams({
                    locations: next.length ? next.join(',') : null,
                    location: null,
                  })
                }
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 bg-brand-500 px-7 text-sm font-semibold text-white transition hover:bg-brand-600 sm:rounded-none"
            >
              Tìm việc
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Từ khóa phổ biến:</span>
            {POPULAR_JOB_KEYWORDS.map((kw) => (
              <button
                key={kw}
                type="button"
                className="rounded-full border border-amber-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50"
                onClick={() => {
                  setDraftKeyword(kw);
                  setFilterParams({ keyword: kw, tab: 'all' });
                }}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3 cột */}
      <div className="mt-6 grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
        {/* Filters */}
        <aside>
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <Button
              variant="outline"
              className="text-sm"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Bộ lọc
            </Button>
            {hasActiveFilters && (
              <button type="button" className="text-sm text-amber-600 hover:text-amber-700" onClick={clearFilters}>
                Xóa tất cả
              </button>
            )}
          </div>

          <div
            className={clsx(
              'rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm',
              !filtersOpen && 'hidden lg:block',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">Bộ lọc tìm kiếm</h2>
              <button
                type="button"
                className={clsx(
                  'text-xs font-medium text-amber-600 hover:underline',
                  !hasActiveFilters && 'invisible lg:visible lg:opacity-40',
                )}
                onClick={clearFilters}
              >
                Xóa tất cả
              </button>
            </div>

            <FieldLabel>Ngành nghề</FieldLabel>
            <Select
              value={industry}
              onChange={(e) => setFilterParams({ industry: e.target.value || null, tab: 'all' })}
              className="mb-3 h-10 py-2 text-sm"
            >
              <option value="">Chọn ngành nghề</option>
              {INDUSTRY_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>

            <FieldLabel>Vị trí công việc</FieldLabel>
            <Select
              value={jobLevels.length === 1 ? jobLevels[0] : ''}
              onChange={(e) => setFilterParams({ jobLevel: e.target.value || null, tab: 'all' })}
              className="mb-4 h-10 py-2 text-sm"
            >
              <option value="">Chọn vị trí</option>
              {Object.values(JobLevelCode).map((code) => (
                <option key={code} value={code}>
                  {JOB_LEVEL_LABEL[code]}
                </option>
              ))}
            </Select>

            <SectionTitle>Nhóm ngành</SectionTitle>
            {Object.values(JobTrack).map((track) => (
              <details key={track} open className="group mb-1">
                <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 text-sm font-medium text-slate-800">
                  {JOB_TRACK_LABEL[track]}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <ul className="mb-2 space-y-1.5 pl-0.5">
                  {CAREER_LADDERS[track].map((code) => (
                    <li key={code}>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-600">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                          checked={jobLevels.includes(code)}
                          onChange={() => toggleLevel(code)}
                        />
                        {JOB_LEVEL_LABEL[code]}
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            ))}

            <SectionTitle className="mt-3">Kinh nghiệm</SectionTitle>
            <ul className="space-y-1.5">
              {EXPERIENCE_OPTIONS.map((band) => (
                <li key={band}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-600">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                      checked={experienceBands.includes(band)}
                      onChange={() => toggleExperience(band)}
                    />
                    {FILTER_EXPERIENCE_LABEL[band]}
                  </label>
                </li>
              ))}
            </ul>

            <SectionTitle className="mt-3">Mức lương</SectionTitle>
            <Select
              value={salaryPreset}
              onChange={(e) => setFilterParams({ salary: e.target.value || null, tab: 'all' })}
              className="h-10 py-2 text-sm"
            >
              <option value="">Chọn mức lương</option>
              {SALARY_PRESETS.filter((p) => p.label !== 'Tuỳ chỉnh').map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        </aside>

        {/* List */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200">
            <div className="flex gap-0 overflow-x-auto">
              {(
                [
                  {
                    id: 'all' as const,
                    label: 'Tất cả việc làm',
                    count: jobs?.length,
                  },
                  { id: 'saved' as const, label: 'Việc làm đã lưu', count: undefined },
                  {
                    id: 'applied' as const,
                    label: 'Việc làm đã ứng tuyển',
                    count: applications?.length,
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterParams({ tab: t.id })}
                  className={clsx(
                    'relative whitespace-nowrap px-3 pb-3 pt-1 text-sm font-medium transition',
                    tab === t.id ? 'text-amber-700' : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  {t.label}
                  {typeof t.count === 'number' && (
                    <span
                      className={clsx(
                        'ml-1.5 text-xs font-normal',
                        tab === t.id ? 'text-amber-600' : 'text-slate-400',
                      )}
                    >
                      {t.count.toLocaleString('vi-VN')}
                    </span>
                  )}
                  {tab === t.id && (
                    <span className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-amber-500" />
                  )}
                </button>
              ))}
            </div>
            <div className="pb-2.5">
              <select className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 outline-none">
                <option>Mới nhất</option>
              </select>
            </div>
          </div>

          {loading && <p className="mt-8 text-center text-sm text-slate-500">Đang tải...</p>}

          {!loading && tab === 'applied' && (
            <>
              <ul className="mt-4 space-y-3">
                {allApplications.length === 0 && (
                  <EmptyState text="Bạn chưa ứng tuyển việc làm nào." />
                )}
                {displayApplications.map((app) => (
                  <AppliedCard key={app.id} app={app} />
                ))}
              </ul>
              {allApplications.length > 0 && (
                <PaginationBar
                  page={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={PAGE_SIZE}
                  onChange={goToPage}
                />
              )}
            </>
          )}

          {!loading && tab !== 'applied' && (
            <>
              <ul className="mt-4 space-y-3">
                {allJobs.length === 0 && (
                  <EmptyState
                    text={
                      tab === 'saved'
                        ? 'Chưa có việc làm đã lưu.'
                        : 'Chưa có tin tuyển dụng phù hợp bộ lọc.'
                    }
                  />
                )}
                {displayJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    match={matchByJobId.get(job.id)}
                    busy={bookmarkMutation.isPending}
                    onToggleBookmark={() =>
                      bookmarkMutation.mutate({
                        id: job.id,
                        saved: Boolean(job.isBookmarked) || tab === 'saved',
                      })
                    }
                  />
                ))}
              </ul>
              {allJobs.length > 0 && (
                <PaginationBar
                  page={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={PAGE_SIZE}
                  onChange={goToPage}
                />
              )}
            </>
          )}
        </section>

        {/* Right widgets */}
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-amber-100/90 bg-gradient-to-br from-amber-50/50 via-white to-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-amber-400 text-white shadow-md shadow-amber-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  AI Gợi ý việc làm phù hợp
                </p>
                <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                  Beta
                </span>
              </div>
            </div>
            {(matches?.length ?? 0) > 0 ? (
              <ul className="mt-3 space-y-2">
                {matches!.slice(0, 3).map((m) => (
                  <li key={m.jobId}>
                    <Link
                      href={`/jobs/${m.jobId}`}
                      className="block rounded-lg bg-slate-50 px-3 py-2 transition hover:bg-amber-50/80"
                    >
                      <p className="line-clamp-1 text-sm font-medium text-slate-800">{m.title}</p>
                      <p className="text-xs font-medium text-amber-600">Phù hợp {m.match.score}%</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Đăng nhập và cập nhật hồ sơ để nhận gợi ý cá nhân hóa từ AI.
              </p>
            )}
            <Link
              href={(matches?.length ?? 0) > 0 ? '/recommended' : '/upload'}
              className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              {(matches?.length ?? 0) > 0 ? 'Xem gợi ý AI' : 'Nhận gợi ý cá nhân hóa'}
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Top vị trí được tìm kiếm</p>
            <ol className="mt-3 space-y-3">
              {topPositions.length === 0 && (
                <li className="text-xs text-slate-400">Chưa có dữ liệu.</li>
              )}
              {topPositions.map((item, idx) => (
                <li key={item.label} className="flex items-start gap-2.5">
                  <span
                    className={clsx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold',
                      idx === 0
                        ? 'bg-amber-500 text-white'
                        : idx === 1
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.count.toLocaleString('vi-VN')} việc làm
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Báo cáo lương 2026</p>
            <p className="mt-1 text-xs text-slate-500">{salaryHighlight.title}</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-2xl font-bold tracking-tight text-slate-900">
                {salaryHighlight.median} triệu
              </p>
              <span className="mb-1 text-xs font-semibold text-emerald-600">+8%</span>
            </div>
            <svg viewBox="0 0 120 36" className="mt-2 h-9 w-full text-amber-400" aria-hidden>
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                points="0,28 20,24 40,26 60,16 80,18 100,8 120,12"
              />
              <polyline
                fill="url(#salaryFill)"
                stroke="none"
                points="0,36 0,28 20,24 40,26 60,16 80,18 100,8 120,12 120,36"
                opacity="0.15"
              />
              <defs>
                <linearGradient id="salaryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <p className="mt-1 text-[11px] text-slate-400">{salaryHighlight.range} · khung thị trường</p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-amber-50/70 via-white to-brand-50/40 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Nhận việc làm mới mỗi ngày</p>
            <p className="mt-1 text-xs text-slate-500">Gửi tin phù hợp vào email của bạn.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setNewsletterEmail('');
              }}
            >
              <Input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Email của bạn"
                className="h-9 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="h-9 shrink-0 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Đăng ký
              </button>
            </form>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-slate-500">{children}</p>;
}

function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        'mb-2 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-800',
        className,
      )}
    >
      {children}
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
      <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="mt-4 text-center text-xs text-slate-400">
        Hiển thị {totalItems} việc làm
      </p>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
      <p className="text-xs text-slate-500">
        Hiển thị <span className="font-medium text-slate-700">{from}–{to}</span> / {totalItems} việc
        làm
      </p>
      <nav className="flex items-center gap-1" aria-label="Phân trang">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers(page, totalPages).map((item, idx) =>
          item === '…' ? (
            <span key={`e-${idx}`} className="px-1 text-sm text-slate-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={clsx(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition',
                item === page
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Trang sau"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

function JobCard({
  job,
  match,
  busy,
  onToggleBookmark,
}: {
  job: JobListItem;
  match?: JobMatchView;
  busy: boolean;
  onToggleBookmark: () => void;
}) {
  const saved = Boolean(job.isBookmarked);
  const industryTag = shortIndustry(job.industry);

  return (
    <li>
      <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md">
        <div className="flex gap-3.5">
          {/* Logo */}
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm font-bold text-slate-500">
            {companyInitials(job.companyName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-[15px] font-semibold text-slate-900 hover:text-brand-500"
                  >
                    {job.title}
                  </Link>
                  {industryTag && (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
                      {industryTag}
                    </span>
                  )}
                  {match && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Phù hợp {match.match.score}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {job.companyId ? (
                    <Link
                      href={`/companies/${job.companyId}`}
                      className="transition hover:text-amber-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {job.companyName}
                    </Link>
                  ) : (
                    job.companyName
                  )}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {job.isNew && (
                  <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Mới
                  </span>
                )}
                <span className="text-[11px] text-slate-400">
                  {formatRelativeTime(job.publishedAt ?? job.createdAt)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'}
                  onClick={onToggleBookmark}
                  className={clsx(
                    'rounded-md p-1 transition',
                    saved
                      ? 'text-amber-500'
                      : 'text-slate-300 hover:text-amber-500',
                  )}
                >
                  <Bookmark className={clsx('h-4 w-4', saved && 'fill-current')} />
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {job.location ?? 'Linh hoạt'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-slate-400">₫</span>
                {formatSalary(job.salaryMin, job.salaryMax)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                {job.experienceBand
                  ? FILTER_EXPERIENCE_LABEL[job.experienceBand as ExperienceBand] ??
                    EXPERIENCE_LABEL[job.experienceBand as ExperienceBand] ??
                    job.experienceBand
                  : 'Không yêu cầu'}
              </span>
            </div>

            {((job.skills?.length ?? 0) > 0 || job.jobLevel) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {job.jobLevel && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {formatJobLevel(job.jobLevel)}
                  </span>
                )}
                {(job.skills ?? []).slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

function AppliedCard({ app }: { app: ApplicationView }) {
  return (
    <li>
      <Link href="/applications">
        <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-amber-200">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">{app.jobTitle}</p>
              <p className="mt-0.5 text-sm text-slate-500">{app.companyName}</p>
            </div>
            <Badge tone={statusTone(app.status)}>
              {APPLICATION_STATUS_LABEL[app.status] ?? app.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Nộp lúc {new Date(app.createdAt).toLocaleString('vi-VN')}
            {app.matchScore != null ? ` · Phù hợp ${app.matchScore}%` : ''}
          </p>
        </article>
      </Link>
    </li>
  );
}

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <AppShell wide>
          <p className="py-16 text-center text-slate-500">Đang tải...</p>
        </AppShell>
      }
    >
      <JobsPageInner />
    </Suspense>
  );
}
