'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Briefcase,
  Car,
  ChevronDown,
  Languages,
  Loader2,
  MapPin,
  Plane,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  B2B_EXPERIENCE_BAND_LABEL,
  B2bExperienceBand,
  CUSTOMER_DEV_STYLE_LABEL,
  CUSTOMER_SEGMENTS,
  CustomerDevStyle,
  DEAL_TYPE_LABEL,
  DEAL_TYPE_OPTIONS,
  JOB_READINESS_LABEL,
  JobReadiness,
  JobStatus,
  LANGUAGE_OPTIONS,
  MARKET_REGIONS,
  PRODUCTS_SOLD,
  SALES_INDUSTRY_OPTIONS,
  formatJobTitle,
  formatJobTrack,
  type CandidateMatchView,
  type CandidateSearchResult,
  type JobListItem,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { ApiError } from '@/lib/api';
import { listMyJobs } from '@/lib/jobs';
import { candidatesForJob } from '@/lib/matching';
import { searchCandidates, type CandidateSearchFilters } from '@/lib/search';

type FilterState = {
  q: string;
  industries: string[];
  products: string[];
  customerSegments: string[];
  b2bExperience: string;
  regions: string[];
  customerDevStyle: string;
  dealType: string;
  jobReadiness: string;
  languages: string[];
  requireB2License: boolean;
  requireTravel: boolean;
  expectedSalaryMin: string;
  expectedSalaryMax: string;
};

const EMPTY: FilterState = {
  q: '',
  industries: [],
  products: [],
  customerSegments: [],
  b2bExperience: '',
  regions: [],
  customerDevStyle: '',
  dealType: '',
  jobReadiness: '',
  languages: [],
  requireB2License: false,
  requireTravel: false,
  expectedSalaryMin: '',
  expectedSalaryMax: '',
};

const QUICK_PROMPTS = [
  'Kỹ sư kinh doanh HVAC, khách FDI miền Bắc, 3–5 năm',
  'Chuyên tìm khách mới: bán PLC/Robot cho nhà thầu EPC',
  'Kinh doanh kỹ thuật dầu nhớt / MRO, miền Nam',
  'Chuyên viên khách hàng lớn máy nén khí, sẵn sàng nghe cơ hội',
] as const;

function toApiFilters(f: FilterState): CandidateSearchFilters {
  return {
    q: f.q.trim() || undefined,
    industries: f.industries.length ? f.industries : undefined,
    products: f.products.length ? f.products : undefined,
    customerSegments: f.customerSegments.length ? f.customerSegments : undefined,
    b2bExperience: f.b2bExperience || undefined,
    regions: f.regions.length ? f.regions : undefined,
    customerDevStyle: f.customerDevStyle || undefined,
    dealType: f.dealType || undefined,
    jobReadiness: f.jobReadiness ? [f.jobReadiness] : undefined,
    languages: f.languages.length ? f.languages : undefined,
    requireB2License: f.requireB2License || undefined,
    requireTravel: f.requireTravel || undefined,
    expectedSalaryMin: f.expectedSalaryMin ? Number(f.expectedSalaryMin) : undefined,
    expectedSalaryMax: f.expectedSalaryMax ? Number(f.expectedSalaryMax) : undefined,
  };
}

function hasOptionalSignal(f: FilterState): boolean {
  return (
    f.q.trim().length >= 2 ||
    f.industries.length > 0 ||
    f.products.length > 0 ||
    f.customerSegments.length > 0 ||
    Boolean(f.b2bExperience) ||
    f.regions.length > 0 ||
    Boolean(f.customerDevStyle) ||
    Boolean(f.dealType) ||
    Boolean(f.jobReadiness) ||
    f.languages.length > 0 ||
    f.requireB2License ||
    f.requireTravel ||
    Boolean(f.expectedSalaryMin) ||
    Boolean(f.expectedSalaryMax)
  );
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function postedJobs(jobs: JobListItem[]): JobListItem[] {
  return jobs
    .filter((j) => j.status === JobStatus.Published || j.status === JobStatus.Paused)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === JobStatus.Published ? -1 : 1;
      const ta = new Date(a.publishedAt ?? a.createdAt).getTime();
      const tb = new Date(b.publishedAt ?? b.createdAt).getTime();
      return tb - ta;
    });
}

function inferTrack(job: JobListItem): 'sales' | 'technical' | null {
  if (job.jobTrack === 'sales' || job.jobTrack === 'technical') return job.jobTrack;
  if (job.jobLevel?.startsWith('technical.')) return 'technical';
  if (job.jobLevel?.startsWith('sales.')) return 'sales';
  return null;
}

function engineLabel(job: JobListItem | null): string {
  const track = job ? inferTrack(job) : null;
  if (track === 'technical') return 'Matching Kỹ thuật · 19 trường';
  if (track === 'sales') return 'Matching Kinh doanh · 16 trường';
  return 'Matching theo tin';
}

function matchToResult(row: CandidateMatchView): CandidateSearchResult {
  return {
    candidateId: row.candidateId,
    code: '',
    displayName: row.displayName,
    currentPosition: row.currentPosition,
    industry: row.industry,
    score: Math.max(0, Math.min(1, row.match.score / 100)),
    reason: row.match.reason,
    matchedSkills: row.match.matchedSkills,
    criteria: row.match.criteria,
  };
}

function Chip({
  active,
  onClick,
  children,
  compact,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded-lg border text-left font-medium transition-all duration-200 ease-soft',
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        active
          ? 'border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-500/25 scale-[1.02]'
          : 'border-slate-200/90 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/60 hover:text-amber-800',
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({
  title,
  hint,
  children,
  defaultOpen = true,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-soft',
            open && 'rotate-180 text-amber-500',
          )}
        />
      </button>
      <div
        className={clsx(
          'grid transition-all duration-300 ease-soft',
          open ? 'grid-rows-[1fr] opacity-100 pb-3' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, score)));
  const tone = pct >= 75 ? 'text-amber-600' : pct >= 50 ? 'text-amber-500' : 'text-slate-500';
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#fde68a" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={clsx(tone, 'transition-[stroke-dashoffset] duration-700 ease-soft')}
        />
      </svg>
      <span className={clsx('text-xs font-bold tabular-nums', tone)}>{pct}</span>
    </div>
  );
}

function ResultCard({
  result,
  index,
}: {
  result: CandidateSearchResult;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const criteria = (result.criteria ?? []).filter((c) => c.score != null);

  return (
    <article
      className="progress-card group relative p-4 animate-soft-rise sm:p-5"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <Link
        href={`/candidates/${result.candidateId}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Xem hồ sơ ${result.displayName}`}
      />
      <div className="relative z-10 pointer-events-none flex items-start gap-3 sm:gap-4">
        <ScoreRing score={result.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900 transition group-hover:text-amber-800">
                {result.displayName}
                <span className="ml-2 text-xs font-semibold text-amber-600 opacity-0 transition group-hover:opacity-100">
                  Xem hồ sơ →
                </span>
              </h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
                <span>
                  {result.currentPosition
                    ? formatJobTitle(result.currentPosition)
                    : 'Chưa cập nhật vị trí'}
                </span>
                {result.industry && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {result.industry}
                    </span>
                  </>
                )}
                {result.code ? (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-xs text-slate-400">{result.code}</span>
                  </>
                ) : null}
              </p>
            </div>
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100">
              Phù hợp {Math.round(result.score * 100)}%
            </span>
          </div>

          {result.reason && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
              {result.reason}
            </p>
          )}

          {result.matchedSkills?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {result.matchedSkills.map((skill) => (
                <span
                  key={skill}
                  className="animate-chip-pop rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {criteria.length > 0 && (
            <div className="mt-3 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Chi tiết tiêu chí matching
                <ChevronDown
                  className={clsx('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')}
                />
              </button>
              <div
                className={clsx(
                  'grid transition-all duration-300 ease-soft',
                  expanded ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden space-y-2">
                  {criteria.slice(0, 8).map((c) => {
                    const pct = Math.round((c.score ?? 0) * 100);
                    return (
                      <div key={c.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-medium text-slate-600" title={c.note}>
                            {c.label}
                            <span className="ml-1 font-normal text-slate-400">
                              · {Math.round(c.weight * 100)}%
                            </span>
                          </span>
                          <span className="tabular-nums font-semibold text-slate-800">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full origin-left rounded-full bg-amber-500 animate-bar-grow"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ResultList({
  results,
  loading,
  emptyTitle,
  emptyHint,
}: {
  results: CandidateSearchResult[];
  loading: boolean;
  emptyTitle: string;
  emptyHint: string;
}) {
  return (
    <>
      {loading && results.length === 0 && (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-100 bg-[linear-gradient(110deg,#f1f5f9_8%,#e2e8f0_18%,#f1f5f9_33%)] bg-[length:200%_100%] animate-search-shimmer"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center animate-soft-rise">
          <p className="text-sm font-semibold text-slate-700">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-400">{emptyHint}</p>
        </div>
      )}

      <div className={clsx('space-y-3', loading && results.length > 0 && 'opacity-70')}>
        {results.map((r, i) => (
          <ResultCard key={r.candidateId} result={r} index={i} />
        ))}
      </div>
    </>
  );
}

export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const initialJobId = searchParams.get('jobId') ?? '';

  const [selectedJobId, setSelectedJobId] = useState(initialJobId);
  const [jobQuery, setJobQuery] = useState('');
  const [matchResults, setMatchResults] = useState<CandidateSearchResult[]>([]);
  const [hasMatched, setHasMatched] = useState(false);

  const [filters, setFilters] = useState<FilterState>({ ...EMPTY, q: initialQ });
  const [filtersOpen, setFiltersOpen] = useState(Boolean(initialQ.trim()));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [filterResults, setFilterResults] = useState<CandidateSearchResult[]>([]);
  const [hasFilterSearched, setHasFilterSearched] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipLiveRef = useRef(true);
  const autoMatchRef = useRef(Boolean(initialJobId));
  const matchAnchorRef = useRef<HTMLElement | null>(null);

  const jobsQuery = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    retry: false,
  });

  const jdList = useMemo(() => postedJobs(jobsQuery.data ?? []), [jobsQuery.data]);
  const visibleJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    if (!q) return jdList;
    return jdList.filter((j) => {
      const hay = [j.title, j.code, j.location ?? '', j.industry ?? '', ...j.skills]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [jdList, jobQuery]);

  const selectedJob = useMemo(
    () => jdList.find((j) => j.id === selectedJobId) ?? null,
    [jdList, selectedJobId],
  );

  useEffect(() => {
    if (!selectedJobId && jdList.length === 1) {
      setSelectedJobId(jdList[0].id);
    }
  }, [jdList, selectedJobId]);

  const writeUrl = useCallback(
    (next: { jobId?: string; q?: string }) => {
      const params = new URLSearchParams();
      const jobId = next.jobId ?? selectedJobId;
      const q = next.q ?? filters.q;
      if (jobId) params.set('jobId', jobId);
      if (q.trim()) params.set('q', q.trim());
      const suffix = params.toString();
      router.replace(suffix ? `/search?${suffix}` : '/search', { scroll: false });
    },
    [filters.q, router, selectedJobId],
  );

  const matchMutation = useMutation({
    mutationFn: (jobId: string) => candidatesForJob(jobId),
    onSuccess: (data) => {
      setMatchResults(data.map(matchToResult));
      setHasMatched(true);
      requestAnimationFrame(() => {
        matchAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
  });

  const filterMutation = useMutation({
    mutationFn: (f: FilterState) => searchCandidates(toApiFilters(f)),
    onSuccess: (data) => {
      setFilterResults(data);
      setHasFilterSearched(true);
    },
  });

  const mutateFilterRef = useRef(filterMutation.mutate);
  mutateFilterRef.current = filterMutation.mutate;

  const runFilterSearch = useCallback((f: FilterState) => {
    if (!hasOptionalSignal(f)) {
      setFilterResults([]);
      setHasFilterSearched(false);
      return;
    }
    mutateFilterRef.current(f);
  }, []);

  function runMatch(jobId: string) {
    if (!jobId) return;
    writeUrl({ jobId });
    setMatchResults([]);
    matchMutation.mutate(jobId);
  }

  useEffect(() => {
    if (!autoMatchRef.current) return;
    if (!initialJobId) return;
    if (!jdList.some((j) => j.id === initialJobId)) return;
    autoMatchRef.current = false;
    matchMutation.mutate(initialJobId);
    // Chỉ auto-chạy khi vào trang với ?jobId=
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId, jdList]);

  useEffect(() => {
    if (initialQ.trim()) {
      skipLiveRef.current = true;
      runFilterSearch({ ...EMPTY, q: initialQ.trim() });
    }
  }, [initialQ, runFilterSearch]);

  useEffect(() => {
    const id = setInterval(() => {
      setPromptIndex((i) => (i + 1) % QUICK_PROMPTS.length);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (skipLiveRef.current) {
      skipLiveRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (hasOptionalSignal(filters)) runFilterSearch(filters);
      else {
        setFilterResults([]);
        setHasFilterSearched(false);
      }
    }, 380);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, runFilterSearch]);

  const patch = useCallback((partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  function onOptionalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    writeUrl({ q: filters.q });
    runFilterSearch(filters);
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    for (const v of filters.industries) {
      chips.push({
        key: `ind-${v}`,
        label: v,
        clear: () => patch({ industries: filters.industries.filter((x) => x !== v) }),
      });
    }
    for (const v of filters.products) {
      chips.push({
        key: `prod-${v}`,
        label: v,
        clear: () => patch({ products: filters.products.filter((x) => x !== v) }),
      });
    }
    for (const v of filters.customerSegments) {
      chips.push({
        key: `seg-${v}`,
        label: v,
        clear: () =>
          patch({ customerSegments: filters.customerSegments.filter((x) => x !== v) }),
      });
    }
    if (filters.b2bExperience) {
      chips.push({
        key: 'exp',
        label: B2B_EXPERIENCE_BAND_LABEL[filters.b2bExperience as B2bExperienceBand] ?? filters.b2bExperience,
        clear: () => patch({ b2bExperience: '' }),
      });
    }
    for (const v of filters.regions) {
      chips.push({
        key: `reg-${v}`,
        label: v,
        clear: () => patch({ regions: filters.regions.filter((x) => x !== v) }),
      });
    }
    if (filters.customerDevStyle) {
      chips.push({
        key: 'dev',
        label: CUSTOMER_DEV_STYLE_LABEL[filters.customerDevStyle as CustomerDevStyle] ?? filters.customerDevStyle,
        clear: () => patch({ customerDevStyle: '' }),
      });
    }
    if (filters.dealType) {
      chips.push({
        key: 'deal',
        label: DEAL_TYPE_LABEL[filters.dealType as keyof typeof DEAL_TYPE_LABEL] ?? filters.dealType,
        clear: () => patch({ dealType: '' }),
      });
    }
    if (filters.jobReadiness) {
      chips.push({
        key: 'ready',
        label: JOB_READINESS_LABEL[filters.jobReadiness as JobReadiness] ?? filters.jobReadiness,
        clear: () => patch({ jobReadiness: '' }),
      });
    }
    for (const v of filters.languages) {
      chips.push({
        key: `lang-${v}`,
        label: v,
        clear: () => patch({ languages: filters.languages.filter((x) => x !== v) }),
      });
    }
    if (filters.requireB2License) {
      chips.push({ key: 'b2', label: 'Bằng B2', clear: () => patch({ requireB2License: false }) });
    }
    if (filters.requireTravel) {
      chips.push({
        key: 'travel',
        label: 'Đi công tác',
        clear: () => patch({ requireTravel: false }),
      });
    }
    return chips;
  }, [filters, patch]);

  const matching = matchMutation.isPending;
  const filtering = filterMutation.isPending;
  const showFilterResults = hasFilterSearched && hasOptionalSignal(filters);
  const jobsForbidden = jobsQuery.error instanceof ApiError && jobsQuery.error.status === 403;

  const selectJob = useCallback(
    (jobId: string) => {
      if (jobId !== selectedJobId) {
        setMatchResults([]);
        setHasMatched(false);
      }
      setSelectedJobId(jobId);
      writeUrl({ jobId });
    },
    [selectedJobId, writeUrl],
  );

  return (
    <AppShell>
      <div className="animate-soft-rise space-y-4 pb-24 lg:pb-10">
        <header>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="brand-accent-dot" />
            Tìm ứng viên AI
            {matching && (
              <span className="inline-flex items-center gap-1 normal-case tracking-normal text-amber-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                đang chấm matching
              </span>
            )}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-[1.35rem]">
            Tìm kiếm ứng viên thông minh theo nhu cầu doanh nghiệp
          </h1>
          <div className="brand-accent-bar mt-2" />
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-slate-500">
            Chọn tin, bấm Tìm ngay — xếp ứng viên theo engine Kinh doanh hoặc Kỹ thuật của đúng tin đó.
          </p>
        </header>

        <section aria-labelledby="jd-heading">
          {jobsForbidden && (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">Bạn cần hồ sơ công ty để xem tin đã đăng.</p>
              <Link href="/company" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
                Tới trang Công ty →
              </Link>
            </div>
          )}

          {!jobsQuery.isLoading && !jobsForbidden && jdList.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <Briefcase className="mx-auto h-9 w-9 text-brand-500" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Chưa có tin đã đăng</p>
              <p className="mt-1 text-xs text-slate-500">
                Đăng tin Kinh doanh hoặc Kỹ thuật trước — matching mới có tiêu chí chuẩn.
              </p>
              <Link
                href="/jobs/new"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
              >
                <Plus className="h-4 w-4" />
                Đăng tin mới
              </Link>
            </div>
          )}

          {(jobsQuery.isLoading || jdList.length > 0) && !jobsForbidden && (
            <div className="relative overflow-hidden rounded-2xl border border-[#FFD0A3]/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-400/80 via-[#E8872A] to-amber-300/70" />
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100/80 px-4 pb-3 pt-4 sm:px-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF8F1] text-[#E8872A]">
                  <Target className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="jd-heading" className="text-[15px] font-semibold tracking-tight text-slate-900">
                    Chọn tin để tìm kiếm ứng viên phù hợp nhất
                  </h2>
                  <p className="mt-0.5 text-[12px] text-slate-400">
                    {jobsQuery.isLoading
                      ? 'Đang tải tin…'
                      : `${jdList.length} tin đã đăng · engine theo khối của tin`}
                  </p>
                </div>
                {jdList.length > 4 && (
                  <div className="relative w-full sm:w-52">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={jobQuery}
                      onChange={(e) => setJobQuery(e.target.value)}
                      placeholder="Lọc tên tin, mã…"
                      className="w-full rounded-lg border border-slate-200/80 bg-[#F8FAFC] py-1.5 pl-8 pr-2.5 text-[13px] outline-none focus:border-[#E8872A]/40 focus:bg-white focus:ring-2 focus:ring-[#E8872A]/10"
                    />
                  </div>
                )}
                <button
                  type="button"
                  disabled={!selectedJobId || matching}
                  onClick={() => runMatch(selectedJobId)}
                  className="hidden shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#072348] px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-[#0b3164] active:scale-[0.98] disabled:opacity-40 sm:inline-flex"
                >
                  {matching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {matching ? 'Đang khớp…' : 'Tìm ngay'}
                </button>
              </div>

              {jobsQuery.isLoading && (
                <div className="divide-y divide-slate-100/80">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse bg-slate-50/70" />
                  ))}
                </div>
              )}

              {visibleJobs.length > 0 && (
                <div
                  role="radiogroup"
                  aria-labelledby="jd-heading"
                  className="max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain"
                >
                  {visibleJobs.map((job) => {
                    const selected = selectedJobId === job.id;
                    const track = inferTrack(job);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => selectJob(job.id)}
                        className={clsx(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition sm:px-5',
                          selected ? 'bg-[#FFF8F1]' : 'hover:bg-slate-50/80',
                        )}
                      >
                        <span
                          className={clsx(
                            'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition',
                            selected
                              ? 'border-[#E8872A] bg-[#E8872A]'
                              : 'border-slate-300 bg-white',
                          )}
                          aria-hidden
                        >
                          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span
                              className={clsx(
                                'truncate text-[13px] tracking-tight',
                                selected ? 'font-semibold text-slate-900' : 'font-medium text-slate-700',
                              )}
                            >
                              {job.title}
                            </span>
                            <span className="hidden shrink-0 font-mono text-[11px] text-slate-400 sm:inline">
                              {job.code}
                            </span>
                          </span>
                        </span>
                        {track && (
                          <span className="hidden shrink-0 text-[11px] font-medium text-slate-500 sm:inline">
                            {formatJobTrack(track)}
                          </span>
                        )}
                        <span className="hidden min-w-0 max-w-[7.5rem] truncate text-[12px] text-slate-400 md:inline">
                          {job.location ?? '—'}
                        </span>
                        <span
                          className={clsx(
                            'shrink-0 text-[11px] font-medium',
                            job.status === JobStatus.Published
                              ? 'text-emerald-600'
                              : 'text-amber-600',
                          )}
                        >
                          {job.status === JobStatus.Published ? 'Đang tuyển' : 'Tạm dừng'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!jobsQuery.isLoading && jdList.length > 0 && visibleJobs.length === 0 && (
                <p className="px-5 py-6 text-center text-[13px] text-slate-400">Không có tin khớp từ khoá lọc.</p>
              )}
            </div>
          )}
        </section>

        {(hasMatched || matching) && (
          <section
            ref={matchAnchorRef}
            id="ket-qua-matching"
            aria-labelledby="match-heading"
            className="space-y-3 scroll-mt-24"
          >
            <div>
              <h2 id="match-heading" className="text-sm font-bold text-slate-900">
                {hasMatched
                  ? `${matchResults.length} ứng viên khớp «${selectedJob?.title ?? 'tin đã chọn'}»`
                  : 'Đang chấm matching'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {matching
                  ? 'Đang đối chiếu tiêu chí chuẩn của tin…'
                  : `${engineLabel(selectedJob)} · sắp xếp theo điểm phù hợp`}
              </p>
            </div>
            <ResultList
              results={matchResults}
              loading={matching}
              emptyTitle="Chưa thấy ứng viên khớp tin này"
              emptyHint="Engine Sales/Kỹ thuật chưa tìm thấy hồ sơ đủ tiêu chí JD. Kiểm tra Inbox hoặc bổ sung dữ liệu hồ sơ ứng viên."
            />
          </section>
        )}

        <section aria-labelledby="optional-filter-heading" className="space-y-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-left transition hover:bg-slate-50 sm:px-3.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200/80">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="optional-filter-heading" className="text-[13px] font-medium text-slate-600">
                Bộ lọc tuỳ chọn
              </h2>
              <p className="text-[11px] text-slate-400">
                Tìm toàn mạng lưới — chỉ hiện kết quả khi chọn điều kiện
              </p>
            </div>
            <ChevronDown
              className={clsx(
                'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                filtersOpen && 'rotate-180',
              )}
            />
          </button>

          {filtersOpen && (
            <form onSubmit={onOptionalSubmit} className="space-y-2.5 animate-soft-rise">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={filters.q}
                      onChange={(e) => patch({ q: e.target.value })}
                      placeholder={QUICK_PROMPTS[promptIndex]}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-[13px] outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={filtering || !hasOptionalSignal(filters)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-700 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50"
                  >
                    {filtering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    {filtering ? 'Đang lọc…' : 'Lọc ứng viên'}
                  </button>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        skipLiveRef.current = true;
                        const next = { ...filters, q: p };
                        setFilters(next);
                        writeUrl({ q: p });
                        runFilterSearch(next);
                      }}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                    >
                      {p.length > 42 ? `${p.slice(0, 40)}…` : p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 sm:px-4">
                <FilterSection
                  title="Điều kiện lọc"
                  hint="Chọn ngành · sản phẩm · tệp KH · kinh nghiệm · khu vực"
                >
                  <div className="w-full space-y-4">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        1. Ngành đã làm
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SALES_INDUSTRY_OPTIONS.map((o) => (
                          <Chip
                            key={o}
                            active={filters.industries.includes(o)}
                            onClick={() => patch({ industries: toggleInList(filters.industries, o) })}
                          >
                            {o}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        2. Sản phẩm đã bán
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {PRODUCTS_SOLD.filter((p) => p !== 'Thiết bị công nghiệp khác').map((o) => (
                          <Chip
                            key={o}
                            compact
                            active={filters.products.includes(o)}
                            onClick={() => patch({ products: toggleInList(filters.products, o) })}
                          >
                            {o}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        3. Tệp khách hàng
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {CUSTOMER_SEGMENTS.filter((p) => p !== 'Khác').map((o) => (
                          <Chip
                            key={o}
                            active={filters.customerSegments.includes(o)}
                            onClick={() =>
                              patch({ customerSegments: toggleInList(filters.customerSegments, o) })
                            }
                          >
                            {o}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        4. Kinh nghiệm kinh doanh B2B
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.values(B2bExperienceBand).map((v) => (
                          <Chip
                            key={v}
                            active={filters.b2bExperience === v}
                            onClick={() =>
                              patch({ b2bExperience: filters.b2bExperience === v ? '' : v })
                            }
                          >
                            {B2B_EXPERIENCE_BAND_LABEL[v]}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        5. Khu vực / thị trường
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {MARKET_REGIONS.map((o) => (
                          <Chip
                            key={o}
                            compact
                            active={filters.regions.includes(o)}
                            onClick={() => patch({ regions: toggleInList(filters.regions, o) })}
                          >
                            {o}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>
                </FilterSection>

                <div className="flex flex-wrap items-center gap-2 py-3">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200',
                      advancedOpen
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Bộ lọc nâng cao
                    <ChevronDown
                      className={clsx('h-3.5 w-3.5 transition-transform', advancedOpen && 'rotate-180')}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtrasOpen((v) => !v)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200',
                      extrasOpen
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    )}
                  >
                    Điều kiện bổ sung
                    <ChevronDown
                      className={clsx('h-3.5 w-3.5 transition-transform', extrasOpen && 'rotate-180')}
                    />
                  </button>
                  {activeChips.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        skipLiveRef.current = true;
                        setFilters({ ...EMPTY, q: filters.q });
                        setFilterResults([]);
                        setHasFilterSearched(false);
                      }}
                      className="ml-auto text-xs font-semibold text-slate-400 transition hover:text-rose-600"
                    >
                      Xóa tất cả lọc
                    </button>
                  )}
                </div>

                <div
                  className={clsx(
                    'grid transition-all duration-300 ease-soft',
                    advancedOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="mb-4 space-y-4 rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Đánh giá nâng cao
                      </p>
                      <div>
                        <p className="mb-2 text-xs font-semibold text-slate-600">Tìm khách mới</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.values(CustomerDevStyle).map((v) => (
                            <Chip
                              key={v}
                              active={filters.customerDevStyle === v}
                              onClick={() =>
                                patch({
                                  customerDevStyle: filters.customerDevStyle === v ? '' : v,
                                })
                              }
                            >
                              {CUSTOMER_DEV_STYLE_LABEL[v]}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold text-slate-600">Loại hình bán hàng</p>
                        <div className="flex flex-wrap gap-2">
                          {DEAL_TYPE_OPTIONS.map((v) => (
                            <Chip
                              key={v}
                              active={filters.dealType === v}
                              onClick={() =>
                                patch({ dealType: filters.dealType === v ? '' : v })
                              }
                            >
                              {DEAL_TYPE_LABEL[v]}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold text-slate-600">Sẵn sàng chuyển việc</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.values(JobReadiness).map((v) => (
                            <Chip
                              key={v}
                              active={filters.jobReadiness === v}
                              onClick={() =>
                                patch({ jobReadiness: filters.jobReadiness === v ? '' : v })
                              }
                            >
                              {JOB_READINESS_LABEL[v]}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={clsx(
                    'grid transition-all duration-300 ease-soft',
                    extrasOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="mb-4 space-y-4 rounded-xl border border-dashed border-slate-200 p-4">
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <Languages className="h-3.5 w-3.5" />
                          Ngoại ngữ
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {LANGUAGE_OPTIONS.map((o) => (
                            <Chip
                              key={o}
                              compact
                              active={filters.languages.includes(o)}
                              onClick={() => patch({ languages: toggleInList(filters.languages, o) })}
                            >
                              {o}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Chip
                          active={filters.requireB2License}
                          onClick={() => patch({ requireB2License: !filters.requireB2License })}
                        >
                          <Car className="h-3.5 w-3.5" />
                          Bằng lái B2
                        </Chip>
                        <Chip
                          active={filters.requireTravel}
                          onClick={() => patch({ requireTravel: !filters.requireTravel })}
                        >
                          <Plane className="h-3.5 w-3.5" />
                          Đi công tác
                        </Chip>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                            <Wallet className="h-3.5 w-3.5" />
                            Thu nhập kỳ vọng min
                          </span>
                          <input
                            type="number"
                            value={filters.expectedSalaryMin}
                            onChange={(e) => patch({ expectedSalaryMin: e.target.value })}
                            placeholder="15.000.000"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-slate-600">
                            Thu nhập kỳ vọng max
                          </span>
                          <input
                            type="number"
                            value={filters.expectedSalaryMax}
                            onChange={(e) => patch({ expectedSalaryMax: e.target.value })}
                            placeholder="25.000.000"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 animate-soft-rise">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Đang lọc
                  </span>
                  {activeChips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={c.clear}
                      className="animate-chip-pop inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-500 hover:text-white"
                    >
                      {c.label}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
            </form>
          )}

          {filtersOpen && showFilterResults && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {filterResults.length} ứng viên theo bộ lọc tuỳ chọn
                </h3>
                <p className="text-[11px] text-slate-400">
                  {filtering
                    ? 'Đang lọc toàn mạng lưới…'
                    : 'Không gắn với một tin cụ thể — chỉ dùng khi cần rà tất cả ứng viên'}
                </p>
              </div>
              <ResultList
                results={filterResults}
                loading={filtering}
                emptyTitle="Không thấy ứng viên khớp bộ lọc"
                emptyHint="Thử bỏ bớt điều kiện hoặc dùng gợi ý nhanh phía trên."
              />
            </div>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:hidden">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
            {selectedJob ? selectedJob.title : 'Chọn tin để tìm'}
          </p>
          <button
            type="button"
            disabled={!selectedJobId || matching}
            onClick={() => runMatch(selectedJobId)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#072348] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Tìm ngay
          </button>
        </div>
      </div>
    </AppShell>
  );
}
