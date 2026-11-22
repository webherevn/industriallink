'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bookmark,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  Info,
  MapPin,
  Package,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CAREER_LADDERS,
  DESIRED_POSITIONS,
  ExperienceBand,
  JOB_LEVEL_LABEL,
  JOB_TRACK_LABEL,
  JobLevelCode,
  JobStatus,
  JobTrack,
  SALARY_BANDS_VND,
  SALARY_PRESETS,
  TECHNICAL_DESIRED_POSITIONS,
  type ApplicationView,
  type JobListItem,
  type JobMatchView,
  type ListPublishedJobsQuery,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { IndustryPicker } from '@/components/industry-picker';
import { LocationPicker } from '@/components/location-picker';
import { Badge, Input, Select } from '@/components/ui';
import { myApplications } from '@/lib/applications';
import { ApiError, tokenStore } from '@/lib/api';
import { getMyCandidate } from '@/lib/candidate';
import { apiPublicBase, companyPublicPath, jobPublicPath } from '@/lib/public-paths';
import {
  APPLICATION_STATUS_LABEL,
  EXPERIENCE_LABEL,
  formatJobLevel,
  formatSalary,
  statusTone,
} from '@/lib/format';
import {
  addJobBookmark,
  applyToJob,
  listBookmarkedJobs,
  listPublishedJobs,
  fetchJobPositionStats,
  removeJobBookmark,
} from '@/lib/jobs';
import { recommendedJobs } from '@/lib/matching';
import {
  MATCH_RING_TRACK_COLOR,
  formatMatchPct,
  matchBadgeTone,
  matchRingColor,
  matchScoreTextColor,
} from '@/lib/match-percent';
import { matchFitLabel } from '@/lib/match-fit-label';
import { composeJobBoard, LISTING_ROTATE_MS, listingTier } from '@/lib/job-listing-board';
import { locationMatchesProfile, profileProvinces } from '@/lib/profile-province';

type TabId = 'all' | 'saved' | 'applied';

/** Số tin mỗi trang — giữ cột giữa cân với sidebar. */
const APPLIED_PAGE_SIZE = 5;
const JOB_PAGE_SIZE = 12;

/** Nhãn kinh nghiệm trên bộ lọc — khớp mockup, giá trị DB vẫn đồng bộ ExperienceBand. */
const FILTER_EXPERIENCE_LABEL: Record<ExperienceBand, string> = {
  [ExperienceBand.None]: 'Chưa có kinh nghiệm',
  [ExperienceBand.Under1]: 'Dưới 1 năm',
  [ExperienceBand.From1To3]: '1 - 3 năm',
  [ExperienceBand.From3To5]: '3 - 5 năm',
  [ExperienceBand.Over5]: 'Trên 5 năm',
};

const EXPERIENCE_OPTIONS = Object.values(ExperienceBand);

type ListingSort = 'newest' | 'salary';

function postedTime(publishedAt: string | null, createdAt?: string): number {
  const time = new Date(publishedAt || createdAt || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Mức trần của khung lương. Tin không ghi lương xếp cuối khi sắp theo lương. */
function salaryHigh(min: number | null, max: number | null): number {
  const values = [min, max].filter((n): n is number => n != null && n > 0);
  return values.length ? Math.max(...values) : -1;
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

function renderHeroHeading(heading: string, accent: string | null | undefined) {
  const accentText = accent?.trim();
  if (!accentText) return heading;
  const idx = heading.toLowerCase().indexOf(accentText.toLowerCase());
  if (idx < 0) return heading;
  const before = heading.slice(0, idx);
  const match = heading.slice(idx, idx + accentText.length);
  const after = heading.slice(idx + accentText.length);
  return (
    <>
      {before}
      <span className="text-brand-500">{match}</span>
      {after}
    </>
  );
}

/** Cuộn xuống khối kết quả (tránh sticky header che mất). */
function scrollToJobResults() {
  requestAnimationFrame(() => {
    document.getElementById('job-results')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}

/** Tin AI gợi ý không đủ field của thẻ danh sách — ghép với tin đã tải nếu có. */
function matchToJob(match: JobMatchView, known?: JobListItem): JobListItem {
  if (known) return known;
  return {
    id: match.jobId,
    slug: match.slug,
    code: match.code,
    title: match.title,
    companyId: match.companyId,
    companySlug: match.companySlug,
    companyName: match.companyName,
    companyHasLogo: match.companyHasLogo,
    companyVerified: match.companyVerified,
    industry: match.industry,
    subIndustry: match.subIndustry ?? null,
    jobLevel: match.jobLevel,
    location: match.location,
    employmentType: null,
    experienceBand: match.experienceBand,
    salaryMin: match.salaryMin,
    salaryMax: match.salaryMax,
    status: JobStatus.Published,
    jobTrack: null,
    products: match.products,
    skills: match.skills ?? [],
    createdAt: match.publishedAt ?? '',
    publishedAt: match.publishedAt,
    isNew: match.publishedAt
      ? Date.now() - new Date(match.publishedAt).getTime() < 48 * 60 * 60 * 1000
      : false,
  };
}

type FilterMode = 'regular' | 'ai';

function JobsPageInner({
  initialJobs,
  forcedIndustry,
  heroHeading,
  heroHeadingAccent,
  heroSubtitle,
  leading,
  trailing,
}: {
  initialJobs?: JobListItem[];
  forcedIndustry?: string;
  heroHeading?: string;
  heroHeadingAccent?: string | null;
  heroSubtitle?: string | null;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [filterMode, setFilterMode] = useState<FilterMode>('regular');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listAi, setListAi] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [draftKeyword, setDraftKeyword] = useState(searchParams.get('keyword') ?? '');

  const tab = (searchParams.get('tab') as TabId) || 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const industry = forcedIndustry || searchParams.get('industry') || '';
  const subIndustry = searchParams.get('subIndustry') ?? '';
  const roleFilter = searchParams.get('role') ?? '';
  const desiredPosition = searchParams.get('desiredPosition') ?? '';
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
  const sort: ListingSort = searchParams.get('sort') === 'salary' ? 'salary' : 'newest';
  const byPlace = searchParams.get('place') === '1';
  const pageRaw = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => setNow(new Date());
    tick();
    const arm = () => {
      const delay = LISTING_ROTATE_MS - (Date.now() % LISTING_ROTATE_MS);
      timer = window.setTimeout(() => {
        tick();
        arm();
      }, delay);
    };
    arm();
    return () => window.clearTimeout(timer);
  }, []);
  const boardNow = useMemo(() => now ?? new Date(0), [now]);

  const listQuery: ListPublishedJobsQuery = useMemo(() => {
    const q: ListPublishedJobsQuery = {};
    if (keyword) q.keyword = keyword;
    if (industry) q.industry = industry;
    if (subIndustry) q.subIndustry = subIndustry;
    if (roleFilter) q.role = roleFilter;
    if (locations.length) q.locations = locations;
    if (jobLevels.length) q.jobLevel = jobLevels.join(',');
    if (experienceBands.length) q.experienceBand = experienceBands.join(',');
    if (salaryPresetObj?.min && salaryPresetObj.min !== '__custom__') {
      q.salaryMin = Number(salaryPresetObj.min);
      q.salaryMax = Number(salaryPresetObj.max);
    }
    // desiredPosition → dùng lại param 'role' để backend filter CONTAINS trên title
    if (desiredPosition) q.role = desiredPosition;
    return q;
  }, [
    keyword,
    industry,
    subIndustry,
    roleFilter,
    locations,
    jobLevels,
    experienceBands,
    salaryPresetObj,
    desiredPosition,
  ]);

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
      subIndustry: null,
      role: null,
      desiredPosition: null,
      location: null,
      locations: null,
      jobLevel: null,
      experienceBand: null,
      salary: null,
      sort: null,
      province: null,
      place: null,
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
    keyword ||
      industry ||
      subIndustry ||
      roleFilter ||
      desiredPosition ||
      locations.length ||
      jobLevels.length ||
      experienceBands.length ||
      salaryPreset ||
      sort === 'salary' ||
      byPlace,
  );

  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    enabled: typeof window !== 'undefined' && Boolean(tokenStore.get()),
    retry: false,
  });
  const provinces = useMemo(
    () => profileProvinces(candidate?.profile?.sales?.desiredLocations),
    [candidate],
  );

  const hasServerQueryFilters = Object.keys(listQuery).length > (forcedIndustry ? 1 : 0);
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs', listQuery],
    queryFn: () => listPublishedJobs(listQuery),
    initialData: hasServerQueryFilters ? undefined : initialJobs,
  });

  const { data: positionStats } = useQuery({
    queryKey: ['job-position-stats'],
    queryFn: fetchJobPositionStats,
    staleTime: 60_000,
  });

  const loggedIn = typeof window !== 'undefined' && Boolean(tokenStore.get());

  const { data: bookmarks, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['job-bookmarks'],
    queryFn: listBookmarkedJobs,
    retry: false,
    enabled: loggedIn,
  });

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
    enabled: loggedIn,
  });

  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ['jobs-match-preview'],
    queryFn: recommendedJobs,
    retry: false,
  });

  const matchByJobId = useMemo(() => {
    const map = new Map<string, JobMatchView>();
    matches?.forEach((m) => map.set(m.jobId, m));
    return map;
  }, [matches]);

  const jobById = useMemo(() => {
    const map = new Map<string, JobListItem>();
    for (const job of initialJobs ?? []) map.set(job.id, job);
    for (const job of jobs ?? []) map.set(job.id, job);
    return map;
  }, [initialJobs, jobs]);

  const rankedAi = useMemo(() => {
    const list = [...(matches ?? [])]
      .map((match) => matchToJob(match, jobById.get(match.jobId)))
      .filter((job) => !byPlace || locationMatchesProfile(job.location, provinces));
    list.sort((a, b) =>
      sort === 'salary'
        ? salaryHigh(b.salaryMin, b.salaryMax) - salaryHigh(a.salaryMin, a.salaryMax) ||
          postedTime(b.publishedAt, b.createdAt) - postedTime(a.publishedAt, a.createdAt)
        : postedTime(b.publishedAt, b.createdAt) - postedTime(a.publishedAt, a.createdAt),
    );
    return list;
  }, [matches, jobById, sort, byPlace, provinces]);

  const savedIdSet = useMemo(
    () => new Set((bookmarks ?? []).map((job) => job.id)),
    [bookmarks],
  );
  const appliedIdSet = useMemo(
    () => new Set((applications ?? []).map((a) => a.jobId)),
    [applications],
  );
  const [applyFeedback, setApplyFeedback] = useState<{ jobId: string; tone: 'ok' | 'err'; text: string } | null>(null);
  const applyMutation = useMutation({
    mutationFn: async (jobId: string) => applyToJob(jobId, {}),
    onSuccess: (_data, jobId) => {
      setApplyFeedback({ jobId, tone: 'ok', text: 'Đã gửi hồ sơ ứng tuyển!' });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-match-preview'] });
    },
    onError: (err, jobId) => {
      setApplyFeedback({
        jobId,
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không gửi được hồ sơ',
      });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await removeJobBookmark(id);
      else await addJobBookmark(id);
    },
    onMutate: async ({ id, saved }) => {
      await queryClient.cancelQueries({ queryKey: ['job-bookmarks'] });
      const previous = queryClient.getQueryData<JobListItem[]>(['job-bookmarks']);
      queryClient.setQueryData<JobListItem[]>(['job-bookmarks'], (current) => {
        const list = current ?? [];
        if (saved) return list.filter((job) => job.id !== id);
        if (list.some((job) => job.id === id)) return list;
        const job = jobById.get(id);
        return job ? [{ ...job, isBookmarked: true }, ...list] : list;
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['job-bookmarks'], context.previous);
    },
    onSettled: () => {
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
    const fromStats = positionStats?.popular ?? [];
    if (fromStats.length > 0) {
      return fromStats.slice(0, 5).map((p) => ({ label: p.title, count: p.count }));
    }
    const counts = new Map<string, number>();
    for (const job of jobs ?? []) {
      const key = job.title;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));
  }, [jobs, positionStats]);
  const popularKeywords = positionStats?.keywords ?? [];

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

  const allJobs: JobListItem[] = (
    tab === 'saved' ? (bookmarks ?? []) : tab === 'all' ? (jobs ?? []) : []
  )
    .slice()
    .sort((a, b) =>
      sort === 'salary'
        ? salaryHigh(b.salaryMin, b.salaryMax) - salaryHigh(a.salaryMin, a.salaryMax) ||
          (b.salaryMin ?? -1) - (a.salaryMin ?? -1) ||
          postedTime(b.publishedAt, b.createdAt) - postedTime(a.publishedAt, a.createdAt)
        : postedTime(b.publishedAt, b.createdAt) - postedTime(a.publishedAt, a.createdAt),
    )
    .filter((job) => !byPlace || locationMatchesProfile(job.location, provinces));
  const allApplications = (applications ?? []).slice().sort((a, b) =>
    sort === 'salary'
      ? salaryHigh(b.salaryMin, b.salaryMax) - salaryHigh(a.salaryMin, a.salaryMax) ||
        (b.salaryMin ?? -1) - (a.salaryMin ?? -1) ||
        postedTime(b.createdAt) - postedTime(a.createdAt)
      : postedTime(b.createdAt) - postedTime(a.createdAt),
  );

  const usingAi = filterMode === 'ai';
  const boardLeaving = usingAi !== listAi;
  useEffect(() => {
    if (!boardLeaving) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setListAi(usingAi), reduce ? 0 : 240);
    return () => window.clearTimeout(timer);
  }, [boardLeaving, usingAi]);
  const isAiAllTab = listAi && tab === 'all';
  const isSearchOrSorted =
    Boolean(
      keyword.trim() ||
        industry ||
        subIndustry ||
        roleFilter ||
        desiredPosition ||
        locations.length > 0 ||
        jobLevels.length > 0 ||
        experienceBands.length > 0 ||
        salaryPreset ||
        byPlace,
    ) || sort === 'salary';
  const useDynamicBoard = tab === 'all' && !listAi && !isSearchOrSorted;
  const activeJobSource = isAiAllTab ? rankedAi : allJobs;
  const jobBoard = useMemo(
    () => (useDynamicBoard ? composeJobBoard(allJobs, page - 1, boardNow) : null),
    [useDynamicBoard, allJobs, page, boardNow],
  );
  const pageSize = tab === 'applied' ? APPLIED_PAGE_SIZE : JOB_PAGE_SIZE;
  const totalItems =
    tab === 'applied' ? allApplications.length : activeJobSource.length;
  const totalPages =
    useDynamicBoard
      ? (jobBoard?.totalPages ?? 1)
      : Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);
  const pageOffset = (currentPage - 1) * pageSize;
  const displayJobs = isAiAllTab
    ? rankedAi.slice(pageOffset, pageOffset + pageSize)
    : useDynamicBoard
      ? (jobBoard && currentPage === page ? jobBoard.page : composeJobBoard(allJobs, currentPage - 1, boardNow).page)
      : allJobs.slice(pageOffset, pageOffset + pageSize);
  const displayApplications = allApplications.slice(
    (currentPage - 1) * APPLIED_PAGE_SIZE,
    currentPage * APPLIED_PAGE_SIZE,
  );

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    setParams({ page: clamped <= 1 ? null : String(clamped) });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const loading =
    (isAiAllTab && matchesLoading && rankedAi.length === 0) ||
    (tab === 'all' && !listAi && isLoading) ||
    (tab === 'saved' && bookmarksLoading) ||
    (tab === 'applied' && appsLoading);

  return (
    <AppShell wide flush allowGuest bleed={Boolean(leading)}>
      {leading}
      <div className={leading ? 'mx-auto w-full max-w-[1280px] px-4 sm:px-6' : 'contents'}>
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
            {leading ? (
              <h2 className="text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">
                {renderHeroHeading(
                  heroHeading || 'Tìm đúng cơ hội trong ngành công nghiệp',
                  heroHeadingAccent ?? 'ngành công nghiệp',
                )}
              </h2>
            ) : (
              <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">
                {renderHeroHeading(
                  heroHeading || 'Tìm đúng cơ hội trong ngành công nghiệp',
                  heroHeadingAccent ?? 'ngành công nghiệp',
                )}
              </h1>
            )}
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-600">
              {heroSubtitle ??
                'Hàng nghìn cơ hội việc làm từ các doanh nghiệp uy tín trong lĩnh vực kỹ thuật, sản xuất, vận hành và kinh doanh B2B.'}
            </p>
          </div>

          {/* Search card */}
          <form
            className="relative z-20 mt-6 flex flex-col gap-0 overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 sm:flex-row sm:items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              setFilterMode('regular');
              setFilterParams({ keyword: draftKeyword.trim() || null, tab: 'all' });
              scrollToJobResults();
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
            <div className="relative z-30 border-b border-slate-100 sm:w-[220px] sm:border-b-0 sm:border-r">
              <IndustryPicker
                variant="bar"
                value={{ industry, subIndustry, role: roleFilter }}
                onChange={(next) => {
                  setFilterMode('regular');
                  setFilterParams({
                    industry: next.industry || null,
                    subIndustry: next.subIndustry || null,
                    role: next.role || null,
                    tab: 'all',
                  });
                }}
              />
            </div>
            <div className="relative border-b border-slate-100 sm:w-[200px] sm:border-b-0 sm:border-r">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <LocationPicker
                variant="bar"
                value={locations}
                placeholder="Tất cả địa điểm"
                onChange={(next) => {
                  setFilterMode('regular');
                  setFilterParams({
                    locations: next.length ? next.join(',') : null,
                    location: null,
                  });
                }}
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 bg-brand-500 px-7 text-sm font-semibold text-white transition hover:bg-brand-600 sm:rounded-none"
            >
              Tìm việc
            </button>
          </form>

          {popularKeywords.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Từ khóa phổ biến:</span>
            {popularKeywords.map((kw) => (
              <button
                key={kw}
                type="button"
                className="rounded-full border border-amber-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50"
                onClick={() => {
                  setFilterMode('regular');
                  setDraftKeyword(kw);
                  setFilterParams({ keyword: kw, tab: 'all' });
                  scrollToJobResults();
                }}
              >
                {kw}
              </button>
            ))}
          </div>
          )}
        </div>
      </section>

      {/* Lọc thường xổ bộ lọc. Lọc AI thu bộ lọc. Cả hai trượt, không nhảy. */}
      <div className="mt-6 flex min-w-0 flex-col gap-5 pb-10 lg:flex-row lg:items-start">
        <aside
          aria-hidden={!filtersOpen}
          className={clsx(
            'order-1 min-w-0 shrink-0 overflow-hidden transition-[width,max-height,opacity,margin] duration-500 ease-soft motion-reduce:transition-none lg:max-h-none',
            filtersOpen
              ? 'max-h-[2400px] opacity-100 lg:w-[288px]'
              : 'pointer-events-none -mb-5 max-h-0 opacity-0 lg:mb-0 lg:-mr-5 lg:w-0',
          )}
        >
        <div className="w-full lg:w-[288px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="mb-3.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-[#072348]">Bộ lọc tìm kiếm</h2>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[#E8872A] hover:underline"
                  onClick={clearFilters}
                >
                  Xóa tất cả
                </button>
              ) : null}
            </div>

            <FieldLabel>Ngành nghề</FieldLabel>
            <IndustryPicker
              variant="field"
              className="mb-3"
              triggerClassName="!h-9 !rounded-lg !border-slate-300 !bg-white !px-3 !py-0 !text-[13px] !leading-5"
              value={{ industry, subIndustry, role: roleFilter }}
              onChange={(next) =>
                setFilterParams({
                  industry: next.industry || null,
                  subIndustry: next.subIndustry || null,
                  role: next.role || null,
                  tab: 'all',
                })
              }
            />
            {(subIndustry || roleFilter) && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {subIndustry && (
                  <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">
                    {subIndustry}
                  </span>
                )}
                {roleFilter && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    {roleFilter}
                  </span>
                )}
              </div>
            )}

            <FieldLabel>Vị trí ứng tuyển</FieldLabel>
            <Select
              size="sm"
              value={desiredPosition}
              onChange={(e) =>
                setFilterParams({ desiredPosition: e.target.value || null, tab: 'all' })
              }
            >
              <option value="">Chọn vị trí</option>
              <optgroup label="Khối Kinh doanh">
                {DESIRED_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Khối Kỹ thuật">
                {TECHNICAL_DESIRED_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </optgroup>
            </Select>

            <SectionTitle>Khối / cấp bậc</SectionTitle>
            <div className="rounded-xl bg-slate-50 p-1">
            {Object.values(JobTrack).map((track) => {
              const selected = CAREER_LADDERS[track].filter((code) => jobLevels.includes(code)).length;
              return (
              <details key={track} open className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#072348] hover:bg-white [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{JOB_TRACK_LABEL[track]}</span>
                  {selected > 0 ? (
                    <span className="rounded-full bg-[#072348] px-1.5 text-[10px] font-semibold leading-4 text-white">
                      {selected}
                    </span>
                  ) : null}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition duration-300 group-open:rotate-180" />
                </summary>
                <ul className="space-y-0.5 pb-1">
                  {CAREER_LADDERS[track].map((code) => (
                    <li key={code}>
                      <FilterCheck
                        checked={jobLevels.includes(code)}
                        label={JOB_LEVEL_LABEL[code]}
                        onChange={() => toggleLevel(code)}
                      />
                    </li>
                  ))}
                </ul>
              </details>
              );
            })}
            </div>

            <SectionTitle>Kinh nghiệm</SectionTitle>
            <ul className="space-y-0.5 rounded-xl bg-slate-50 p-1">
              {EXPERIENCE_OPTIONS.map((band) => (
                <li key={band}>
                  <FilterCheck
                    checked={experienceBands.includes(band)}
                    label={FILTER_EXPERIENCE_LABEL[band]}
                    onChange={() => toggleExperience(band)}
                  />
                </li>
              ))}
            </ul>

            <SectionTitle>Mức lương</SectionTitle>
            <Select
              size="sm"
              value={salaryPreset}
              onChange={(e) => setFilterParams({ salary: e.target.value || null, tab: 'all' })}
            >
              <option value="">Chọn mức lương</option>
              {SALARY_PRESETS.filter((p) => p.label !== 'Tuỳ chỉnh').map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        </aside>

        {/* List */}
        <section id="job-results" className="order-2 min-w-0 flex-1 scroll-mt-24 lg:order-2">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-slate-200">
            <div className="flex min-w-0 flex-wrap items-end gap-2">
              <div className="relative mb-2 grid shrink-0 grid-cols-2 rounded-xl bg-white p-1 ring-1 ring-slate-200">
                <span
                  aria-hidden
                  className={clsx(
                    'pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-lg bg-[#072348] shadow-sm transition-transform duration-500 ease-soft motion-reduce:transition-none',
                    filterMode === 'ai' && 'translate-x-full',
                  )}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (filterMode === 'regular') {
                      setFiltersOpen((open) => !open);
                      return;
                    }
                    setFilterMode('regular');
                    setFiltersOpen(true);
                    setParams({ page: null });
                  }}
                  className={clsx(
                    'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300 ease-soft',
                    filterMode === 'regular' ? 'text-white' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Lọc thường
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (filterMode === 'ai') return;
                    setFilterMode('ai');
                    setFiltersOpen(false);
                    setFilterParams({ tab: 'all' });
                  }}
                  className={clsx(
                    'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300 ease-soft',
                    filterMode === 'ai' ? 'text-white' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Lọc bằng AI
                </button>
              </div>
            <div className="flex gap-0 overflow-x-auto">
              {(
                [
                  {
                    id: 'all' as const,
                    label: 'Tất cả việc làm',
                    count: filterMode === 'ai' ? rankedAi.length : jobs?.length,
                  },
                  {
                    id: 'saved' as const,
                    label: 'Việc làm đã lưu',
                    count: bookmarks?.length ?? 0,
                  },
                  {
                    id: 'applied' as const,
                    label: 'Việc làm đã ứng tuyển',
                    count: applications?.length ?? 0,
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
            </div>
            <div className="flex items-center gap-2 pb-2.5">
              <select
                value={byPlace ? 'place' : sort}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'place') {
                    setFilterParams({ place: '1', province: null, sort: null });
                  } else {
                    setFilterParams({
                      place: null,
                      province: null,
                      sort: value === 'salary' ? 'salary' : null,
                    });
                  }
                }}
                aria-label="Sắp xếp và lọc việc làm"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 outline-none"
              >
                <option value="newest">Mới nhất</option>
                <option value="salary">Lương cao nhất</option>
                {provinces.length > 0 && <option value="place">Địa điểm</option>}
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
                  pageSize={APPLIED_PAGE_SIZE}
                  onChange={goToPage}
                />
              )}
            </>
          )}

          {!loading && tab !== 'applied' && (
            <div
              className={clsx(
                'transition-[opacity,transform] duration-500 ease-soft motion-reduce:transition-none',
                boardLeaving
                  ? 'pointer-events-none translate-y-2 opacity-0'
                  : 'translate-y-0 opacity-100',
              )}
            >
              {isAiAllTab && rankedAi.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  {byPlace
                    ? 'Việc làm AI khớp hồ sơ, trong địa điểm bạn đã chọn.'
                    : sort === 'salary'
                      ? 'Việc làm AI khớp hồ sơ, xếp theo lương cao nhất.'
                      : 'Việc làm AI khớp hồ sơ, xếp theo tin mới nhất.'}
                </p>
              )}
              <ul
                className={clsx(
                  'mt-4 grid grid-cols-1 items-stretch gap-3 rounded-2xl bg-[#eef3f8] p-3 ring-1 ring-slate-200/80 transition-[padding,gap] duration-500 ease-soft motion-reduce:transition-none sm:grid-cols-2',
                  activeJobSource.length > 0 && 'sm:auto-rows-fr',
                  !filtersOpen && 'sm:gap-4 sm:p-4',
                )}
              >
                {activeJobSource.length === 0 && (
                  <li className="col-span-full">
                    <EmptyState
                      text={
                        isAiAllTab
                          ? byPlace && (matches?.length ?? 0) > 0
                            ? 'Chưa có việc làm AI gợi ý đúng địa điểm hồ sơ của bạn.'
                            : 'Chưa có việc làm AI gợi ý. Đăng nhập và cập nhật hồ sơ để xem tin khớp với bạn.'
                          : tab === 'saved'
                            ? 'Chưa có việc làm đã lưu.'
                            : 'Chưa có tin tuyển dụng phù hợp bộ lọc.'
                      }
                    />
                  </li>
                )}
                {displayJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    spacious={!filtersOpen}
                    saved={bookmarks ? savedIdSet.has(job.id) : Boolean(job.isBookmarked)}
                    applied={appliedIdSet.has(job.id)}
                    match={matchByJobId.get(job.id)}
                    matchRing={listAi}
                    busy={bookmarkMutation.isPending}
                    applying={applyMutation.isPending && applyMutation.variables === job.id}
                    applyFeedback={applyFeedback?.jobId === job.id ? applyFeedback : null}
                    onToggleBookmark={() =>
                      bookmarkMutation.mutate({
                        id: job.id,
                        saved: bookmarks ? savedIdSet.has(job.id) : Boolean(job.isBookmarked),
                      })
                    }
                    onApply={() => applyMutation.mutate(job.id)}
                  />
                ))}
              </ul>
              {activeJobSource.length > 0 && (
                <PaginationBar
                  page={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={JOB_PAGE_SIZE}
                  caption={
                    tab === 'all'
                      ? `Trang ${currentPage}/${totalPages} · ${totalItems} việc làm`
                      : undefined
                  }
                  onChange={goToPage}
                />
              )}
            </div>
          )}
        </section>

        {/* Right widgets */}
        <aside
          className={clsx(
            'order-3 w-full min-w-0 shrink-0 space-y-4 transition-[width] duration-500 ease-soft motion-reduce:transition-none lg:w-[280px]',
            filtersOpen && 'lg:w-[260px]',
          )}
        >
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
                      href={jobPublicPath(m)}
                      className="block rounded-lg bg-slate-50 px-3 py-2 transition hover:bg-amber-50/80"
                    >
                      <p className="line-clamp-1 text-sm font-medium text-slate-800">{m.title}</p>
                      <p className="text-xs font-medium text-amber-600">Phù hợp {formatMatchPct(m.match.score)}%</p>
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

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Top vị trí được tìm kiếm</p>
            <ol className="mt-3 space-y-3">
              {topPositions.length === 0 && (
                <li className="text-xs text-slate-400">Chưa có dữ liệu.</li>
              )}
              {topPositions.map((item, idx) => (
                <li key={item.label} className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold',
                      idx === 0
                        ? 'bg-amber-500 text-white'
                        : idx === 1
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <button
                      type="button"
                      className="block w-full break-words text-left text-[13px] font-medium leading-snug text-slate-800 hover:text-brand-700"
                      onClick={() =>
                        setFilterParams({ role: item.label, tab: 'all' })
                      }
                    >
                      {item.label}
                    </button>
                    <p className="mt-0.5 text-[11px] text-slate-400">
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
      </div>
      {trailing}
    </AppShell>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

function FilterCheck({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-5 transition',
        checked ? 'bg-white font-medium text-[#072348] shadow-sm' : 'text-slate-600 hover:bg-white/80',
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden
        className={clsx(
          'flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition',
          checked ? 'border-[#072348] bg-[#072348] text-white' : 'border-slate-300 bg-white',
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </label>
  );
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
        'mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400',
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
  caption,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
  caption?: string;
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
  const rangeLabel = caption ?? `Hiển thị ${from}–${to} / ${totalItems} việc làm`;

  return (
    <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
      <p className="text-xs text-slate-500">{rangeLabel}</p>
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

const TIER_STYLE = {
  spotlight: {
    card: 'border-accent-200 bg-gradient-to-br from-accent-50 via-white to-white shadow-md shadow-accent-100/80 hover:border-accent-300',
    mark: 'border-accent-100 bg-accent-50 text-accent-700',
    badge: 'Nổi bật',
    badgeClass: 'bg-accent-500 text-white',
    salary: 'bg-accent-100 text-accent-800',
  },
  paid: {
    card: 'border-brand-100 bg-white shadow-md shadow-brand-100/80 hover:border-brand-300',
    mark: 'border-brand-100 bg-brand-50 text-brand-700',
    badge: 'Ưu tiên',
    badgeClass: 'bg-brand-600 text-white',
    salary: 'bg-brand-50 text-brand-700',
  },
  starter: {
    card: 'border-slate-200 bg-white shadow-md shadow-slate-200/90 hover:border-slate-300',
    mark: 'border-slate-200 bg-slate-50 text-brand-700',
    badge: '',
    badgeClass: '',
    salary: 'bg-accent-50 text-accent-700',
  },
} as const;

function CompanyMark({ job, markClass }: { job: JobListItem; markClass: string }) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(job.companyHasLogo && job.companyId && !failed);
  return (
    <div
      className={clsx(
        'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white',
        markClass,
      )}
    >
      {showLogo ? (
        <img
          src={`${apiPublicBase()}/companies/${job.companyId}/logo`}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[11px] font-bold">{companyInitials(job.companyName)}</span>
      )}
    </div>
  );
}

function matchRingLabel(score: number): string {
  // ⭐ Ngưỡng chuẩn toàn sàn.
  return matchFitLabel(score);
}

/** Vòng tỉ lệ giống thẻ Gợi ý AI, thu vừa cột tin. */
function MatchPctRing({ score }: { score: number }) {
  const radius = 18;
  const turn = 2 * Math.PI * radius;
  const filled = Math.min(1, Math.max(0, score / 100));
  const color = matchRingColor(score);
  const textColor = matchScoreTextColor(score);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center self-center">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="relative h-11 w-11 rounded-full bg-white p-px shadow-sm ring-1 ring-slate-200/80">
          <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
            <circle cx="22" cy="22" r={radius} fill="none" stroke={MATCH_RING_TRACK_COLOR} strokeWidth="4.5" />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={turn}
              strokeDashoffset={turn * (1 - filled)}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold leading-none tracking-tight"
            style={{ color: textColor }}
          >
            {formatMatchPct(score)}
            <span className="text-[8px] font-bold">%</span>
          </span>
        </div>
      </div>
      <p className="mt-0.5 text-center text-[9px] font-semibold leading-tight" style={{ color: textColor }}>
        {matchRingLabel(score)}
      </p>
    </div>
  );
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function listingMatchLabel(score: number): string {
  // ⭐ Ngưỡng chuẩn toàn sàn (dùng chung match-fit-label.ts).
  return matchFitLabel(score);
}

function JobCard({
  job,
  match,
  busy,
  saved,
  applied = false,
  applying = false,
  applyFeedback = null,
  spacious = false,
  matchRing = false,
  onToggleBookmark,
  onApply,
}: {
  job: JobListItem;
  match?: JobMatchView;
  busy: boolean;
  saved: boolean;
  applied?: boolean;
  applying?: boolean;
  applyFeedback?: { tone: 'ok' | 'err'; text: string } | null;
  spacious?: boolean;
  matchRing?: boolean;
  onToggleBookmark: () => void;
  onApply?: () => void;
}) {
  const tone = TIER_STYLE[listingTier(job.planCode)];
  const productsText =
    job.products && job.products.length > 0
      ? job.products.join(', ')
      : job.subIndustry?.trim() || null;
  const expText = job.experienceBand
    ? EXPERIENCE_LABEL[job.experienceBand as ExperienceBand] ?? job.experienceBand
    : 'Không yêu cầu';
  const postedLabel = formatRelativeTime(job.publishedAt || job.createdAt);
  const showAiPanel = Boolean(match && matchRing);

  return (
    <li className="flex min-w-0">
      <article
        className={clsx(
          'flex h-full w-full flex-col rounded-2xl border transition-[padding,gap,transform,box-shadow] duration-500 ease-soft hover:-translate-y-0.5 hover:shadow-lg hover:duration-200 motion-reduce:transition-none',
          spacious ? 'p-4' : 'p-3.5',
          tone.card,
        )}
      >
        <div
          className={clsx(
            'flex min-w-0 flex-1 flex-col gap-3',
            showAiPanel && (spacious ? 'md:flex-row md:items-stretch' : '2xl:flex-row 2xl:items-stretch'),
          )}
        >
          <div className="flex min-w-0 flex-1 gap-3">
            <CompanyMark job={job} markClass={tone.mark} />

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Hàng 1: Badge (AI match nếu có / gói Nổi bật-Ưu tiên ở lọc thường) + Mới + Thời gian + Bookmark */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {match ? (
                    <span
                      className={clsx(
                        'rounded-md px-2 py-0.5 text-[10.5px] font-semibold',
                        matchBadgeTone(match.match.score),
                      )}
                    >
                      {listingMatchLabel(match.match.score)}
                    </span>
                  ) : tone.badge ? (
                    <span
                      className={clsx(
                        'shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-semibold',
                        tone.badgeClass,
                      )}
                    >
                      {tone.badge}
                    </span>
                  ) : null}
                  {job.isNew && (
                    <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Mới
                    </span>
                  )}
                  {postedLabel && (
                    <span className="text-[11px] text-slate-400">{postedLabel}</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'}
                  onClick={onToggleBookmark}
                  className={clsx(
                    '-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition',
                    saved
                      ? 'text-amber-500 hover:bg-amber-50'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-amber-500',
                  )}
                >
                  <Bookmark className={clsx('h-4 w-4', saved && 'fill-current')} strokeWidth={1.75} />
                </button>
              </div>

              {/* Hàng 2: Tên vị trí + Tên công ty + Tích xanh xác minh */}
              <div className="mt-1">
                <Link
                  href={jobPublicPath(job)}
                  className={clsx(
                    'line-clamp-2 font-bold leading-snug text-slate-900 hover:text-brand-600',
                    spacious ? 'text-[15px]' : 'text-[14px]',
                  )}
                >
                  {job.title}
                </Link>
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12.5px] font-medium text-slate-600">
                  {job.companyId ? (
                    <Link
                      href={companyPublicPath(job)}
                      className="truncate hover:text-brand-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {job.companyName}
                    </Link>
                  ) : (
                    <span className="truncate">{job.companyName}</span>
                  )}
                  {job.companyVerified ? (
                    <BadgeCheck
                      className="h-3.5 w-3.5 shrink-0 fill-[#1D9BF0] text-white"
                      aria-label="Công ty đã xác minh"
                    />
                  ) : null}
                </p>
              </div>

              {/* Hàng 3: Ngành & Sản phẩm */}
              {(job.industry || productsText) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-slate-600">
                  {job.industry && (
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                      <Factory className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        <strong className="font-semibold text-slate-700">Ngành:</strong> {job.industry}
                      </span>
                    </span>
                  )}
                  {job.industry && productsText && (
                    <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" aria-hidden />
                  )}
                  {productsText && (
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                      <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        <strong className="font-semibold text-slate-700">Sản phẩm:</strong> {productsText}
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Hàng 4: Địa điểm, Mức lương, Kinh nghiệm */}
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 text-[12px] text-slate-600">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{job.location ?? 'Linh hoạt'}</span>
                </span>
                <span className="sr-only"> · </span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                  <Banknote className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  {formatSalary(job.salaryMin, job.salaryMax)}
                </span>
                <span className="sr-only"> · </span>
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {expText}
                </span>
              </div>

              {applyFeedback && (
                <p
                  className={clsx(
                    'mt-2 text-[11.5px] font-medium',
                    applyFeedback.tone === 'ok' ? 'text-emerald-700' : 'text-rose-600',
                  )}
                >
                  {applyFeedback.text}
                </p>
              )}
            </div>
          </div>

          {/* Khối AI bên phải (responsive: cột dọc khi đủ rộng, hàng ngang gọn khi hẹp/mobile) */}
          {showAiPanel && match ? (
            <div
              className={clsx(
                'flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3',
                spacious
                  ? 'md:w-[144px] md:flex-col md:justify-center md:gap-3.5 md:border-l md:border-t-0 md:pl-3.5 md:pt-0'
                  : '2xl:w-[138px] 2xl:flex-col 2xl:justify-center 2xl:gap-3.5 2xl:border-l 2xl:border-t-0 2xl:pl-3 2xl:pt-0',
              )}
            >
              <div className="flex flex-col items-center">
                <div className="relative h-14 w-14">
                  <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke={MATCH_RING_TRACK_COLOR}
                      strokeWidth="5.5"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke={matchRingColor(match.match.score)}
                      strokeWidth="5.5"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={
                        2 * Math.PI * 26 * (1 - Math.min(1, Math.max(0, match.match.score / 100)))
                      }
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="text-[13px] font-extrabold leading-none tracking-tight tabular-nums"
                      style={{ color: matchScoreTextColor(match.match.score) }}
                    >
                      {formatMatchPct(match.match.score)}
                      <span className="text-[9.5px] font-bold">%</span>
                    </span>
                  </span>
                </div>
                <span
                  className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-slate-700"
                  title={matchRingLabel(match.match.score)}
                >
                  Mức độ phù hợp
                  <Info className="h-3 w-3 shrink-0 text-slate-400" />
                </span>
              </div>

              <div
                className={clsx(
                  'flex flex-1 flex-col gap-1.5',
                  spacious ? 'md:w-full md:flex-none' : '2xl:w-full 2xl:flex-none',
                )}
              >
                {applied ? (
                  <span className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-xl bg-emerald-50 px-2.5 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Đã ứng tuyển
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={applying}
                    onClick={onApply}
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-[#E8872A] px-2.5 text-[11.5px] font-bold text-white shadow-2xs transition hover:bg-[#d4761d] disabled:opacity-60"
                  >
                    <Send className="h-3 w-3 shrink-0" />
                    {applying ? 'Đang gửi...' : 'Ứng tuyển'}
                  </button>
                )}
                <Link
                  href={jobPublicPath(job)}
                  className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11.5px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span>Xem chi tiết</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                </Link>
              </div>
            </div>
          ) : null}
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

export function JobsListingClient({
  initialJobs,
  forcedIndustry,
  heroHeading,
  heroHeadingAccent,
  heroSubtitle,
  leading,
  trailing,
}: {
  initialJobs?: JobListItem[];
  forcedIndustry?: string;
  heroHeading?: string;
  heroHeadingAccent?: string | null;
  heroSubtitle?: string | null;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <AppShell wide allowGuest>
          <p className="py-16 text-center text-slate-500">Đang tải...</p>
        </AppShell>
      }
    >
      <JobsPageInner
        initialJobs={initialJobs}
        forcedIndustry={forcedIndustry}
        heroHeading={heroHeading}
        heroHeadingAccent={heroHeadingAccent}
        heroSubtitle={heroSubtitle}
        leading={leading}
        trailing={trailing}
      />
    </Suspense>
  );
}
