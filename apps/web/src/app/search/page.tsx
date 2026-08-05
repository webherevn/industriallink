'use client';

import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Car,
  ChevronDown,
  Languages,
  Loader2,
  MapPin,
  Plane,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Suspense,
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
  LANGUAGE_OPTIONS,
  MARKET_REGIONS,
  PRODUCTS_SOLD,
  SALES_INDUSTRY_OPTIONS,
  formatJobTitle,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { searchCandidates, type CandidateSearchFilters, type CandidateSearchResult } from '@/lib/search';

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

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
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
  const tone =
    pct >= 75 ? 'text-amber-600' : pct >= 50 ? 'text-amber-500' : 'text-slate-500';
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
  const criteria = (result.criteria ?? []).filter(
    (c) => c.score != null,
  );

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
                <span className="text-slate-300">·</span>
                <span className="font-mono text-xs text-slate-400">{result.code}</span>
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
                Chi tiết tiêu chí AI
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

function SearchPageInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY, q: initialQ });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [results, setResults] = useState<CandidateSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipLiveRef = useRef(true);

  const mutation = useMutation({
    mutationFn: (f: FilterState) => searchCandidates(toApiFilters(f)),
    onSuccess: (data) => {
      setResults(data);
      setHasSearched(true);
    },
  });

  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const runSearch = useCallback((f: FilterState) => {
    mutateRef.current(f);
  }, []);

  useEffect(() => {
    if (initialQ.trim()) {
      skipLiveRef.current = true;
      runSearch({ ...EMPTY, q: initialQ.trim() });
    }
  }, [initialQ, runSearch]);

  // Gợi ý xoay vòng trên placeholder
  useEffect(() => {
    const id = setInterval(() => {
      setPromptIndex((i) => (i + 1) % QUICK_PROMPTS.length);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  // Live search khi đổi bộ lọc (debounce)
  useEffect(() => {
    if (skipLiveRef.current) {
      skipLiveRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const hasSignal =
        filters.q.trim().length >= 2 ||
        filters.industries.length > 0 ||
        filters.products.length > 0 ||
        filters.customerSegments.length > 0 ||
        Boolean(filters.b2bExperience) ||
        filters.regions.length > 0 ||
        Boolean(filters.customerDevStyle) ||
        Boolean(filters.dealType) ||
        Boolean(filters.jobReadiness) ||
        filters.languages.length > 0 ||
        filters.requireB2License ||
        filters.requireTravel;
      if (hasSignal) runSearch(filters);
    }, 380);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, runSearch]);

  const patch = useCallback((partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(filters);
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

  const searching = mutation.isPending;

  return (
    <AppShell>
      <div className="animate-soft-rise space-y-5 pb-10">
        <header className="relative overflow-hidden rounded-2xl border border-amber-100/80 bg-gradient-to-br from-amber-50/80 via-white to-brand-50/40 px-5 py-6 sm:px-7">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-brand-400/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-100">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              AI đối sánh · Kinh doanh B2B
              {searching && (
                <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  đang phân tích
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Tìm đúng kỹ sư kinh doanh trong vài giây
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Chạm chọn ngành · sản phẩm · tệp KH · kinh nghiệm · khu vực — AI chấm điểm ngay khi bạn
              điều chỉnh bộ lọc.
            </p>
          </div>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="progress-card p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={filters.q}
                  onChange={(e) => patch({ q: e.target.value })}
                  placeholder={QUICK_PROMPTS[promptIndex]}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {searching ? 'Đang khớp…' : 'Tìm ngay'}
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
                    runSearch(next);
                  }}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                >
                  {p.length > 42 ? `${p.slice(0, 40)}…` : p}
                </button>
              ))}
            </div>
          </div>

          <div className="progress-card overflow-hidden px-4 sm:px-5">
            <FilterSection
              title="Bộ lọc chính"
              hint="Chọn nhiều giá trị — kết quả cập nhật tự động"
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
                    {PRODUCTS_SOLD.filter((p) => p !== 'Khác').map((o) => (
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
                    setResults([]);
                    setHasSearched(false);
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
                    Đánh giá nâng cao · Matching & Headhunt
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

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {hasSearched
                  ? `${results.length} ứng viên phù hợp`
                  : 'Kết quả sẽ hiện ở đây'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {searching
                  ? 'AI đang đối chiếu tiêu chí kinh doanh B2B…'
                  : hasSearched
                    ? 'Sắp xếp theo điểm phù hợp · bấm “Chi tiết tiêu chí AI” để xem breakdown'
                    : 'Chọn chip hoặc nhập mô tả để bắt đầu'}
              </p>
            </div>
          </div>

          {searching && results.length === 0 && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl border border-slate-100 bg-[linear-gradient(110deg,#f1f5f9_8%,#e2e8f0_18%,#f1f5f9_33%)] bg-[length:200%_100%] animate-search-shimmer"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          )}

          {!searching && hasSearched && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center animate-soft-rise">
              <p className="text-sm font-semibold text-slate-700">Không thấy ứng viên khớp</p>
              <p className="mt-1 text-xs text-slate-400">
                Thử bỏ bớt điều kiện hoặc dùng gợi ý nhanh phía trên.
              </p>
            </div>
          )}

          <div className={clsx('space-y-3', searching && results.length > 0 && 'opacity-70')}>
            {results.map((r, i) => (
              <ResultCard key={r.candidateId} result={r} index={i} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="py-16 text-center text-slate-500">Đang tải...</p>
        </AppShell>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
