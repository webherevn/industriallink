'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  Eye,
  Languages,
  Loader2,
  MapPin,
  Plane,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  Wallet,
  X,
  Zap,
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
import { CopilotRobot } from '@/components/copilot-robot';
import { ProfileOpenLink } from '@/components/starter-profile-lock';
import { ApiError } from '@/lib/api';
import { addCandidateShortlist, removeCandidateShortlist } from '@/lib/candidate';
import { EMPLOYMENT_LABEL, formatSalary } from '@/lib/format';
import { listMyJobs } from '@/lib/jobs';
import { candidatesForJob } from '@/lib/matching';
import {
  MATCH_RING_TRACK_COLOR,
  formatMatchPct,
  matchRingColor,
  matchScoreTextColor,
} from '@/lib/match-percent';
import { matchFitLabel } from '@/lib/match-fit-label';
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

type LocationRefine = 'off' | 'exact' | 'nearest';

function locationFit(result: CandidateSearchResult): number | null {
  const row = result.criteria?.find(
    (c) => c.key === 'jd04' || c.key === 'tech.jd03' || c.label === 'Địa điểm làm việc',
  );
  if (!row || row.score == null) return null;
  return row.score;
}

function refineMatchResults(
  results: CandidateSearchResult[],
  sortByScore: boolean,
  locationMode: LocationRefine,
): CandidateSearchResult[] {
  if (locationMode === 'off' && !sortByScore) return results;
  const rows =
    locationMode === 'exact'
      ? results.filter((row) => (locationFit(row) ?? 0) >= 0.99)
      : results;
  const ranked = [...rows];
  ranked.sort((a, b) => {
    if (locationMode === 'nearest' || locationMode === 'exact') {
      const da = locationFit(a) ?? -1;
      const db = locationFit(b) ?? -1;
      if (db !== da) return db - da;
    }
    if (sortByScore) return b.score - a.score;
    return 0;
  });
  return ranked;
}

function refineCaption(sortByScore: boolean, locationMode: LocationRefine): string {
  if (locationMode === 'exact' && sortByScore) return 'chỉ đúng địa điểm JD · điểm cao trước';
  if (locationMode === 'exact') return 'chỉ đúng địa điểm JD';
  if (locationMode === 'nearest' && sortByScore) return 'địa điểm gần JD trước · rồi điểm phù hợp';
  if (locationMode === 'nearest') return 'địa điểm gần JD trước';
  if (sortByScore) return 'sắp xếp theo điểm phù hợp';
  return 'thứ tự gợi ý của tin';
}

function matchToResult(row: CandidateMatchView): CandidateSearchResult {
  return {
    candidateId: row.candidateId,
    code: '',
    displayName: row.displayName,
    currentPosition: row.currentPosition,
    industry: row.industry,
    location: row.location,
    summary: row.summary ?? null,
    score: Math.max(0, Math.min(1, row.match.score / 100)),
    reason: row.match.reason,
    matchedSkills: row.match.matchedSkills,
    criteria: row.match.criteria,
    applied: row.applied,
    viewed: row.viewed,
    isShortlisted: row.isShortlisted,
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

function formatPersonName(raw?: string | null): string {
  const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Ứng viên';
  return trimmed
    .split(' ')
    .map((word) => {
      if (!word) return '';
      const lower = word.toLocaleLowerCase('vi-VN');
      return lower.charAt(0).toLocaleUpperCase('vi-VN') + lower.slice(1);
    })
    .join(' ');
}

function ScoreRing({ scorePct }: { scorePct: number }) {
  const pct = formatMatchPct(scorePct);
  const r = 18;
  const c = 2 * Math.PI * r;
  const safe = Math.min(1, Math.max(0, scorePct / 100));
  const offset = c * (1 - safe);
  const ringColor = matchRingColor(scorePct);
  const textColor = matchScoreTextColor(scorePct);
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={MATCH_RING_TRACK_COLOR}
          strokeWidth="3.5"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-soft"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[12px] font-extrabold leading-none tracking-tight tabular-nums"
          style={{ color: textColor }}
        >
          {pct}
          <span className="text-[9px] font-bold opacity-80">%</span>
        </span>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  index,
  shortlisted,
  shortlistBusy,
  onToggleShortlist,
}: {
  result: CandidateSearchResult;
  index: number;
  shortlisted: boolean;
  shortlistBusy: boolean;
  onToggleShortlist: (candidateId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const criteria = (result.criteria ?? []).filter((c) => c.score != null);
  const scorePct = Math.max(0, Math.min(100, result.score * 100));
  const creditCost = scorePct >= 80 ? 2 : 1;
  const displayName = formatPersonName(result.displayName);
  const matchedSkills = result.matchedSkills ?? [];
  const visibleSkills = matchedSkills.slice(0, 4);
  const extraSkills = Math.max(0, matchedSkills.length - visibleSkills.length);
  const isUnlockedOrFree = Boolean(result.viewed || result.applied);
  // ⭐ Ngưỡng chuẩn toàn sàn (>=80 Rất phù hợp / >=60 Khá phù hợp /
  // >=40 Cân nhắc / <40 Độ phù hợp thấp) — sửa lỗi 18.4% bị ghi "Phù hợp".
  const fitLabel = matchFitLabel(scorePct);

  // (1) Không lộ trọng số — sắp xếp theo điểm tiêu chí thuần.
  const strongCriteria = criteria
    .filter((c) => (c.score ?? 0) >= 0.65)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);
  const weakCriteria = criteria
    .filter((c) => (c.score ?? 0) < 0.55)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3);
  const showWeakBox = scorePct < 65 && weakCriteria.length > 0;
  const highlightCriteria = showWeakBox ? weakCriteria : strongCriteria;

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(7,35,72,0.04)] transition duration-200 hover:border-slate-300 hover:shadow-[0_10px_26px_-16px_rgba(7,35,72,0.18)] animate-soft-rise sm:p-5"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Cột 1 + 2: ScoreRing + Thông tin ứng viên */}
        <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:gap-4">
          <div className="flex shrink-0 flex-col items-center">
            <ScoreRing scorePct={scorePct} />
            <span
              className={clsx(
                'mt-1 text-center text-[10.5px] font-semibold',
                scorePct >= 75 ? 'text-emerald-700' : 'text-amber-700',
              )}
            >
              {fitLabel}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15.5px] font-bold text-[#072348]">
                {displayName}
              </h3>

              {result.viewed ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  Đã mở hồ sơ
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  Chưa mở hồ sơ
                </span>
              )}

              {result.applied && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/80">
                  Đã ứng tuyển
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="font-medium text-slate-700">
                  {result.currentPosition
                    ? formatJobTitle(result.currentPosition)
                    : 'Chưa cập nhật vị trí'}
                </span>
                {result.industry ? (
                  <>
                    <span className="text-slate-300">–</span>
                    <span>{result.industry}</span>
                  </>
                ) : null}
              </span>

              <span className="inline-flex items-center gap-1 text-slate-600">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                {result.location ?? 'Chưa có địa điểm'}
              </span>
            </div>

            {result.summary ? (
              <p
                className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-slate-500"
                title={result.summary}
              >
                {result.summary}
              </p>
            ) : (
              <p className="mt-1.5 text-[12.5px] italic text-slate-400">
                Chưa cập nhật tóm tắt chuyên môn
              </p>
            )}

            {visibleSkills.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {visibleSkills.slice(0, 3).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
                {matchedSkills.length > 3 && (
                  <span
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500"
                    title={matchedSkills.slice(3).join(', ')}
                  >
                    +{matchedSkills.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cột 3: Vì sao phù hợp? / Điểm cần cân nhắc */}
        <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-3.5 py-3 lg:w-[19.5rem] lg:shrink-0">
          <button
            type="button"
            onClick={() => criteria.length > 0 && setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-[12px] font-bold text-[#072348]">
              {showWeakBox ? 'Điểm cần cân nhắc' : 'Vì sao phù hợp?'}
            </span>
            {criteria.length > 0 && (
              <ChevronDown
                className={clsx(
                  'h-3.5 w-3.5 text-slate-400 transition-transform',
                  expanded && 'rotate-180 text-[#072348]',
                )}
              />
            )}
          </button>

          {highlightCriteria.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {highlightCriteria.map((c) => (
                <li
                  key={c.key}
                  className="flex items-start gap-1.5 text-[11.5px] leading-snug text-slate-700"
                >
                  {showWeakBox ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                  <span className="line-clamp-1">
                    {c.label}
                    {c.score != null && (
                      <span className="ml-1 text-slate-400">({Math.round(c.score * 100)}%)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-slate-600">
              {result.reason || 'Hồ sơ có mức độ tương đồng tốt với yêu cầu tuyển dụng.'}
            </p>
          )}
        </div>

        {/* Cột 4: 2 nút hành động xếp dọc */}
        <div className="flex shrink-0 flex-row items-center gap-2 lg:w-36 lg:flex-col lg:items-stretch">
          <button
            type="button"
            disabled={shortlistBusy}
            onClick={() => onToggleShortlist(result.candidateId)}
            className={clsx(
              'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition disabled:opacity-60 lg:flex-initial',
              shortlisted
                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {shortlisted ? (
              <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" />
            ) : (
              <Bookmark className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span>{shortlisted ? 'Đã Shortlist' : 'Shortlist'}</span>
          </button>

          {isUnlockedOrFree ? (
            <ProfileOpenLink
              href={`/candidates/${result.candidateId}?match=${formatMatchPct(scorePct)}`}
              potential={!result.applied}
              ariaLabel={`Xem hồ sơ ${displayName}`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0d356c] lg:flex-initial"
            >
              <span>Xem hồ sơ</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </ProfileOpenLink>
          ) : (
            <ProfileOpenLink
              href={`/candidates/${result.candidateId}?match=${formatMatchPct(scorePct)}`}
              potential={!result.applied}
              ariaLabel={`Mở hồ sơ ${displayName} (${creditCost} Credit)`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0d356c] lg:flex-initial"
            >
              <span>Xem hồ sơ</span>
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#FFD0A3]"
                title={
                  creditCost === 2
                    ? 'Mở hồ sơ ứng viên này tính 2 Credit (Matching ≥ 80%)'
                    : 'Mở hồ sơ ứng viên này tính 1 Credit (Matching < 80%)'
                }
              >
                <Coins className="h-2.5 w-2.5 text-[#FFB366]" />
                {creditCost}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </ProfileOpenLink>
          )}
        </div>
      </div>

      {/* Chi tiết tiêu chí matching (mở rộng khi click hộp Vì sao phù hợp) */}
      {criteria.length > 0 && expanded && (
        <div className="mt-3.5 grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {criteria.slice(0, 8).map((c) => {
            const pct = Math.round((c.score ?? 0) * 100);
            return (
              <div key={c.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-medium text-slate-600" title={c.note}>
                    {c.label}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-slate-800">
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full origin-left rounded-full bg-[#E8872A] animate-bar-grow"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

type ResultStatusFilter = 'all' | 'unviewed' | 'viewed' | 'applied' | 'shortlisted';

const RESULT_PAGE_SIZE = 10;

function ResultList({
  results,
  loading,
  emptyTitle,
  emptyHint,
  leftToolbar,
  rightToolbar,
  shortlistOverrides,
  shortlistBusyIds,
  onToggleShortlist,
}: {
  results: CandidateSearchResult[];
  loading: boolean;
  emptyTitle: string;
  emptyHint: string;
  leftToolbar?: ReactNode;
  rightToolbar?: ReactNode;
  shortlistOverrides: Record<string, boolean>;
  shortlistBusyIds: Record<string, boolean>;
  onToggleShortlist: (candidateId: string, currentShortlisted: boolean) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);

  const isRowShortlisted = useCallback(
    (row: CandidateSearchResult) =>
      shortlistOverrides[row.candidateId] ?? Boolean(row.isShortlisted),
    [shortlistOverrides],
  );

  useEffect(() => {
    setStatusFilter('all');
    setPage(1);
  }, [results]);

  const counts = useMemo(() => {
    let unviewed = 0;
    let viewed = 0;
    let applied = 0;
    let shortlisted = 0;
    for (const r of results) {
      if (r.viewed) viewed += 1;
      else unviewed += 1;
      if (r.applied) applied += 1;
      if (isRowShortlisted(r)) shortlisted += 1;
    }
    return {
      all: results.length,
      unviewed,
      viewed,
      applied,
      shortlisted,
    };
  }, [results, isRowShortlisted]);

  const filteredResults = useMemo(() => {
    switch (statusFilter) {
      case 'unviewed':
        return results.filter((r) => !r.viewed);
      case 'viewed':
        return results.filter((r) => Boolean(r.viewed));
      case 'applied':
        return results.filter((r) => Boolean(r.applied));
      case 'shortlisted':
        return results.filter((r) => isRowShortlisted(r));
      default:
        return results;
    }
  }, [results, statusFilter, isRowShortlisted]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedResults = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, safePage, pageSize]);

  const statusTabs: { key: ResultStatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tất cả', count: counts.all },
    { key: 'unviewed', label: 'Chưa mở hồ sơ', count: counts.unviewed },
    { key: 'viewed', label: 'Đã mở hồ sơ', count: counts.viewed },
    { key: 'shortlisted', label: 'Shortlist', count: counts.shortlisted },
    { key: 'applied', label: 'Đã ứng tuyển', count: counts.applied },
  ];

  return (
    <div className="space-y-3">
      {(leftToolbar || rightToolbar || results.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {results.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {statusTabs.map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.key);
                      setPage(1);
                    }}
                    className={clsx(
                      'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition',
                      active
                        ? 'bg-[#072348] text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="tabular-nums opacity-85">({tab.count})</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {leftToolbar}
            {rightToolbar}
          </div>
        </div>
      )}

      {loading && results.length === 0 && (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-slate-100 bg-[linear-gradient(110deg,#f1f5f9_8%,#e2e8f0_18%,#f1f5f9_33%)] bg-[length:200%_100%] animate-search-shimmer"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center animate-soft-rise">
          <p className="text-sm font-semibold text-slate-700">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-400">{emptyHint}</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          {filteredResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Chưa có ứng viên ở mục «{statusTabs.find((t) => t.key === statusFilter)?.label}»
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setPage(1);
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline"
              >
                Xem tất cả {counts.all} ứng viên
              </button>
            </div>
          ) : (
            <div className={clsx('space-y-3', loading && 'opacity-70')}>
              {pagedResults.map((r, i) => {
                const shortlisted = isRowShortlisted(r);
                return (
                  <ResultCard
                    key={r.candidateId}
                    result={r}
                    index={i}
                    shortlisted={shortlisted}
                    shortlistBusy={Boolean(shortlistBusyIds[r.candidateId])}
                    onToggleShortlist={(cid) => onToggleShortlist(cid, shortlisted)}
                  />
                );
              })}
            </div>
          )}

          {filteredResults.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-500">
              <span>
                Hiển thị{' '}
                <strong className="font-semibold text-slate-700">
                  {(safePage - 1) * pageSize + 1} –{' '}
                  {Math.min(safePage * pageSize, filteredResults.length)}
                </strong>{' '}
                trên <strong className="font-semibold text-slate-700">{filteredResults.length}</strong>{' '}
                ứng viên
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .slice(Math.max(0, safePage - 3), Math.max(5, safePage + 2))
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={clsx(
                          'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition',
                          p === safePage
                            ? 'bg-[#072348] text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang sau"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                <span>Số dòng/trang:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value) as 10 | 20 | 50);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#072348] outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchRefineBar({
  sortByScore,
  locationMode,
  jobLocation,
  onSortByScore,
  onLocationMode,
}: {
  sortByScore: boolean;
  locationMode: LocationRefine;
  jobLocation: string | null;
  onSortByScore: (value: boolean) => void;
  onLocationMode: (value: LocationRefine) => void;
}) {
  const place = jobLocation?.trim() || null;

  function locationButton(mode: 'exact' | 'nearest', label: string) {
    const on = locationMode === mode;
    return (
      <button
        type="button"
        disabled={!place}
        aria-pressed={on}
        onClick={() => onLocationMode(on ? 'off' : mode)}
        className={clsx(
          'h-6 shrink-0 whitespace-nowrap rounded-full px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 lg:h-7 xl:px-2.5 xl:text-[12px]',
          on ? 'bg-[#E8872A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:flex-nowrap xl:gap-2">
      <button
        type="button"
        aria-pressed={sortByScore}
        onClick={() => onSortByScore(!sortByScore)}
        className={clsx(
          'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-semibold shadow-sm transition lg:h-9 xl:gap-2 xl:px-3 xl:text-[12px]',
          sortByScore
            ? 'border-[#072348] bg-[#072348] text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
        )}
      >
        <ArrowDownWideNarrow className="h-3.5 w-3.5 shrink-0" />
        Tỷ lệ matching
        <span
          className={clsx(
            'inline font-medium md:hidden xl:inline',
            sortByScore ? 'text-white/70' : 'text-slate-400',
          )}
        >
          cao tới thấp
        </span>
      </button>

      <div
        className={clsx(
          'inline-flex h-8 min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-white pl-2.5 pr-1 shadow-sm lg:h-9 xl:pl-3',
          !place && 'opacity-60',
        )}
        title={place ? `Lọc theo địa điểm trên JD: ${place}` : 'Tin này chưa có địa điểm làm việc'}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
        <span className="shrink-0 pr-0.5 text-[11.5px] font-semibold text-slate-700 xl:text-[12px]">
          Địa điểm
        </span>
        {place ? (
          <span className="min-w-0 max-w-[10rem] truncate pr-1 text-[11.5px] font-medium text-slate-400 md:max-w-[6rem] lg:max-w-[9rem] xl:max-w-[13rem] xl:text-[12px]">
            {place}
          </span>
        ) : null}
        {locationButton('exact', 'Chính xác')}
        {locationButton('nearest', 'Gần nhất')}
      </div>
    </div>
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
  const [sortByScore, setSortByScore] = useState(true);
  const [locationMode, setLocationMode] = useState<LocationRefine>('off');

  const [filters, setFilters] = useState<FilterState>({ ...EMPTY, q: initialQ });
  const [searchMode, setSearchMode] = useState<'auto' | 'filter'>(
    initialQ.trim() ? 'filter' : 'auto',
  );
  const [filtersOpen, setFiltersOpen] = useState(Boolean(initialQ.trim()));
  const filterAnchorRef = useRef<HTMLElement | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [filterResults, setFilterResults] = useState<CandidateSearchResult[]>([]);
  const [hasFilterSearched, setHasFilterSearched] = useState(false);
  const [shortlistOverrides, setShortlistOverrides] = useState<Record<string, boolean>>({});
  const [shortlistBusyIds, setShortlistBusyIds] = useState<Record<string, boolean>>({});
  const [promptIndex, setPromptIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipLiveRef = useRef(true);
  const autoMatchRef = useRef(Boolean(initialJobId));
  const matchAnchorRef = useRef<HTMLElement | null>(null);

  const handleToggleShortlist = useCallback(
    async (candidateId: string, currentShortlisted: boolean) => {
      const next = !currentShortlisted;
      setShortlistOverrides((prev) => ({ ...prev, [candidateId]: next }));
      setShortlistBusyIds((prev) => ({ ...prev, [candidateId]: true }));
      try {
        if (next) await addCandidateShortlist(candidateId);
        else await removeCandidateShortlist(candidateId);
      } catch {
        setShortlistOverrides((prev) => ({ ...prev, [candidateId]: currentShortlisted }));
      } finally {
        setShortlistBusyIds((prev) => ({ ...prev, [candidateId]: false }));
      }
    },
    [],
  );

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
    setSortByScore(true);
    setLocationMode('off');
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

  const shownMatches = useMemo(
    () => refineMatchResults(matchResults, sortByScore, locationMode),
    [matchResults, sortByScore, locationMode],
  );
  const matching = matchMutation.isPending;
  const filtering = filterMutation.isPending;
  const showFilterResults = hasFilterSearched && hasOptionalSignal(filters);
  const jobsForbidden = jobsQuery.error instanceof ApiError && jobsQuery.error.status === 403;

  const selectJob = useCallback(
    (jobId: string) => {
      if (jobId !== selectedJobId) {
        setMatchResults([]);
        setHasMatched(false);
        setSortByScore(true);
        setLocationMode('off');
      }
      setSelectedJobId(jobId);
      writeUrl({ jobId });
    },
    [selectedJobId, writeUrl],
  );

  const stepTwoActive = hasMatched || matching || hasFilterSearched || searchMode === 'filter';
  const showResultsDashboard = hasMatched || matching;

  const matchKpis = useMemo(() => {
    let highest = 0;
    let unviewed = 0;
    let viewed = 0;
    let applied = 0;
    for (const r of matchResults) {
      const pct = Math.max(0, Math.min(100, r.score * 100));
      if (pct > highest) highest = pct;
      if (r.viewed) viewed += 1;
      else unviewed += 1;
      if (r.applied) applied += 1;
    }
    return {
      total: matchResults.length,
      highest: Math.round(highest),
      unviewed,
      viewed,
      applied,
    };
  }, [matchResults]);

  const [refineOpen, setRefineOpen] = useState(false);

  return (
    <AppShell>
      <div className="animate-soft-rise space-y-4 pb-24 lg:pb-10">
        {/* Banner Tìm ứng viên AI */}
        <header className="relative overflow-hidden rounded-2xl border border-[#0B468C]/20 bg-gradient-to-r from-[#072348] via-[#0B468C] to-[#1354a6] px-5 py-6 text-white shadow-[0_12px_32px_-12px_rgba(7,35,72,0.35)] sm:px-6">
          <div className="pointer-events-none absolute -right-2 bottom-0 top-0 hidden w-44 items-end justify-center lg:flex">
            <CopilotRobot className="w-36 drop-shadow-[0_8px_20px_rgba(0,0,0,0.25)]" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 top-0 h-44 w-60 rounded-full bg-sky-400/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-48 rounded-full bg-accent-400/15 blur-2xl"
          />
          <div className="relative max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-300">
              <span className="h-3.5 w-1 rounded-full bg-accent-400" />
              Tìm ứng viên AI
              {matching && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 normal-case tracking-normal text-amber-200">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  đang chấm matching
                </span>
              )}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.75rem] sm:leading-snug">
              {showResultsDashboard ? (
                'Tìm và kết quả ứng viên phù hợp'
              ) : (
                <>
                  Tìm ứng viên phù hợp với{' '}
                  <span className="text-accent-300">nhu cầu tuyển dụng</span>
                </>
              )}
            </h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-sky-100/90">
              {showResultsDashboard
                ? 'Chọn tin tuyển dụng, lựa chọn cách tìm và xem ngay danh sách ứng viên được AI xếp hạng.'
                : 'Chọn tin tuyển dụng, sau đó tìm ngay bằng AI hoặc tùy chỉnh bộ lọc theo nhu cầu.'}
            </p>
          </div>
        </header>

        {/* Thanh 2 bước (chỉ hiện khi chưa xem kết quả matching) */}
        {!showResultsDashboard && (
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#072348] to-[#0B468C] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm shadow-sky-900/15">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-accent-300">
                <ClipboardList className="h-3.5 w-3.5" />
              </span>
              <span>1</span>
              <span>Chọn tin tuyển dụng</span>
            </div>
            <div className="flex items-center">
              <span className="h-[2px] w-10 rounded-full bg-gradient-to-r from-[#0B468C] to-accent-400 sm:w-16" />
              <ArrowRight className="-ml-1 h-3.5 w-3.5 text-accent-500" />
            </div>
            <button
              type="button"
              onClick={() => {
                if (searchMode === 'auto' && selectedJobId) {
                  runMatch(selectedJobId);
                } else {
                  setFiltersOpen(true);
                  filterAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold transition',
                stepTwoActive
                  ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-sm shadow-accent-500/20'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-[#0B468C]',
              )}
            >
              <span
                className={clsx(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  stepTwoActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                <Search className="h-3.5 w-3.5" />
              </span>
              <span>2</span>
              <span>Tìm ứng viên</span>
            </button>
          </div>
        )}

        {/* Khối 1: Chọn tin tuyển dụng (khi chưa bấm Tìm) */}
        {!showResultsDashboard && (
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
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_-10px_rgba(7,35,72,0.07)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#072348] to-[#0B468C] text-xs font-bold text-white shadow-xs">
                    1
                  </span>
                  <div>
                    <h2 id="jd-heading" className="text-[15px] font-bold text-[#072348]">
                      Chọn tin tuyển dụng
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-slate-500">
                      AI sẽ sử dụng tiêu chí trong JD của tin đã chọn để tìm và xếp hạng ứng viên phù hợp.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {jdList.length > 4 && (
                    <div className="relative w-full sm:w-52">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={jobQuery}
                        onChange={(e) => setJobQuery(e.target.value)}
                        placeholder="Lọc tên tin, mã…"
                        className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[12.5px] outline-none transition focus:border-[#0B468C] focus:bg-white focus:ring-2 focus:ring-sky-500/15"
                      />
                    </div>
                  )}
                  <span className="rounded-full border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 px-3 py-1 text-[12px] font-semibold text-[#0B468C]">
                    {jdList.length} tin tuyển dụng
                  </span>
                </div>
              </div>

              {jobsQuery.isLoading && (
                <div className="mt-3 space-y-2.5">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-50" />
                  ))}
                </div>
              )}

              {visibleJobs.length > 0 && (
                <div
                  role="radiogroup"
                  aria-labelledby="jd-heading"
                  className="mt-3.5 max-h-[min(22rem,52vh)] space-y-2.5 overflow-y-auto overscroll-contain pr-0.5"
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
                          'group flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
                          selected
                            ? 'border-[#0B468C] bg-gradient-to-r from-sky-50/85 via-[#F8FBFF] to-indigo-50/35 ring-2 ring-[#0B468C]/15 shadow-sm'
                            : 'border-slate-200/90 bg-white hover:border-sky-200 hover:bg-sky-50/25',
                        )}
                      >
                        {/* Radio circle */}
                        <span
                          className={clsx(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition',
                            selected ? 'border-[#0B468C]' : 'border-slate-300 group-hover:border-sky-400',
                          )}
                          aria-hidden
                        >
                          {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#0B468C]" />}
                        </span>

                        {/* Icon */}
                        <span
                          className={clsx(
                            'hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors sm:flex',
                            selected
                              ? 'border-transparent bg-gradient-to-br from-[#072348] to-[#0B468C] text-white shadow-sm'
                              : 'border-slate-200 bg-slate-50 text-slate-500 group-hover:border-sky-200 group-hover:bg-sky-50 group-hover:text-[#0B468C]',
                          )}
                          aria-hidden
                        >
                          <Briefcase className="h-4.5 w-4.5" />
                        </span>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[14.5px] font-bold text-[#072348]">
                              {job.title}
                            </span>
                            <span
                              className={clsx(
                                'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                job.status === JobStatus.Published
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border border-amber-200 bg-amber-50 text-amber-700',
                              )}
                            >
                              {job.status === JobStatus.Published ? 'Đang tuyển' : 'Tạm dừng'}
                            </span>
                            {job.isSourcingActive && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FFD0A3] bg-[#FFF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#C25E12]">
                                <Sparkles className="h-3 w-3 text-[#E8872A]" />
                                Đang hoạt động săn tin
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11.5px] text-slate-400">
                            {job.code}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
                            {track && (
                              <span className="inline-flex items-center gap-1">
                                <Briefcase className="h-3.5 w-3.5 text-[#0B468C]/70" />
                                {formatJobTrack(track)}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-sky-600/75" />
                              {job.location ?? '—'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Wallet className="h-3.5 w-3.5 text-emerald-600/80" />
                              {formatSalary(job.salaryMin, job.salaryMax)}
                            </span>
                            {job.employmentType && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-accent-500/80" />
                                {EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType}
                              </span>
                            )}
                          </div>
                        </div>

                        {selected && (
                          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#072348] to-[#0B468C] px-3 py-1 text-[12px] font-semibold text-white shadow-xs sm:inline-flex">
                            <CheckCircle2 className="h-3.5 w-3.5 text-accent-300" />
                            Đang được chọn
                          </span>
                        )}
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
        )}

        {/* Khối 2: Chọn cách tìm ứng viên (khi chưa bấm Tìm) */}
        {!showResultsDashboard && !jobsForbidden && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_-10px_rgba(7,35,72,0.07)] sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-accent-600 text-xs font-bold text-white shadow-xs">
                2
              </span>
              <h2 className="text-[15px] font-bold text-[#072348]">Chọn cách tìm ứng viên</h2>
            </div>

            <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
              {/* Cách 1: Tìm ngay (tự động) */}
              <button
                type="button"
                onClick={() => {
                  setSearchMode('auto');
                  setFiltersOpen(false);
                }}
                className={clsx(
                  'group flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                  searchMode === 'auto'
                    ? 'border-[#0B468C] bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40 ring-2 ring-[#0B468C]/15 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/20',
                )}
              >
                <span
                  className={clsx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    searchMode === 'auto' ? 'border-[#0B468C]' : 'border-slate-300',
                  )}
                >
                  {searchMode === 'auto' && <span className="h-2.5 w-2.5 rounded-full bg-[#0B468C]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                      <Zap className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] font-bold text-[#072348]">
                      Tìm ngay (tự động)
                    </span>
                    <span className="rounded-full bg-gradient-to-r from-accent-500 to-accent-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
                    AI tự phân tích toàn bộ JD và tìm, xếp hạng ứng viên phù hợp nhất. Nhanh và đơn giản.
                  </p>
                </div>
              </button>

              {/* Cách 2: Tìm bằng bộ lọc (tùy chọn) */}
              <button
                type="button"
                onClick={() => {
                  setSearchMode('filter');
                  setFiltersOpen(true);
                  setTimeout(() => {
                    filterAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
                className={clsx(
                  'group flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                  searchMode === 'filter'
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/40 ring-2 ring-indigo-500/15 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/20',
                )}
              >
                <span
                  className={clsx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    searchMode === 'filter' ? 'border-indigo-600' : 'border-slate-300',
                  )}
                >
                  {searchMode === 'filter' && <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] font-bold text-[#072348]">
                      Tìm bằng bộ lọc (tùy chọn)
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
                    Tự điều chỉnh thêm tiêu chí (địa điểm, ngành nghề, kinh nghiệm, mức lương, sẵn sàng nhận việc...).
                  </p>
                </div>
              </button>
            </div>

            {/* Thanh AI sẽ giúp bạn */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-accent-200/80 bg-gradient-to-r from-accent-50/75 via-amber-50/40 to-sky-50/40 px-4 py-3 text-[12.5px] text-slate-700">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#072348]">
                <Sparkles className="h-4 w-4 text-accent-500" />
                AI sẽ giúp bạn:
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Phân tích JD và hiểu đúng yêu cầu
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Tìm đúng ứng viên phù hợp
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Xếp hạng theo mức độ phù hợp
              </span>
            </div>

            {/* Nút Tìm ứng viên ngay */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={searchMode === 'auto' ? !selectedJobId || matching : false}
                onClick={() => {
                  if (searchMode === 'auto') {
                    if (selectedJobId) runMatch(selectedJobId);
                  } else {
                    setFiltersOpen(true);
                    if (hasOptionalSignal(filters)) {
                      runFilterSearch(filters);
                    }
                    filterAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#072348] via-[#0B468C] to-[#1258ad] px-6 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-[#072348]/25 transition-all hover:shadow-lg hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {matching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-accent-300" />
                )}
                {matching ? 'Đang tìm ứng viên…' : 'Tìm ứng viên ngay'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {(hasMatched || matching) && (
          <section
            ref={matchAnchorRef}
            id="ket-qua-matching"
            aria-labelledby="match-heading"
            className="space-y-4 scroll-mt-24"
          >
            {/* Thanh điều khiển gọn 1 hàng */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Tin tuyển dụng
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      aria-label="Chọn tin tuyển dụng"
                      value={selectedJobId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        selectJob(nextId);
                        if (nextId) runMatch(nextId);
                      }}
                      className="h-10 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#072348] outline-none transition focus:border-brand-400"
                    >
                      {jdList.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title} ({j.code}) · {j.status === JobStatus.Published ? 'Đang tuyển' : 'Tạm dừng'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Cách tìm ứng viên
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSearchMode('auto')}
                        className={clsx(
                          'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
                          searchMode === 'auto'
                            ? 'border-[#1D4ED8] bg-[#F8FBFF] text-[#072348]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        <span>Tìm ngay (tự động)</span>
                        <span className="rounded-full bg-[#e8f0fe] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                          Khuyên dùng
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSearchMode('filter');
                          setFiltersOpen(true);
                          setTimeout(() => {
                            filterAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }}
                        className={clsx(
                          'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
                          searchMode === 'filter'
                            ? 'border-[#1D4ED8] bg-[#F8FBFF] text-[#072348]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-[#1D4ED8]" />
                        <span>Tìm bằng bộ lọc</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedJobId || matching}
                    onClick={() => runMatch(selectedJobId)}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#072348] px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0d356c] disabled:opacity-45"
                  >
                    <RefreshCw className={clsx('h-3.5 w-3.5', matching && 'animate-spin')} />
                    {matching ? 'Đang tìm…' : 'Tìm lại'}
                  </button>
                </div>
              </div>
            </div>

            {/* 5 thẻ KPI tóm tắt kết quả */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0B468C]">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none text-[#072348]">
                    {matchKpis.total}
                  </p>
                  <p className="mt-1 text-[11.5px] font-medium text-slate-500">Ứng viên phù hợp</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#1D4ED8]">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none text-[#072348]">
                    {matchKpis.highest}%
                  </p>
                  <p className="mt-1 text-[11.5px] font-medium text-slate-500">Điểm phù hợp cao nhất</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Eye className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none text-[#072348]">
                    {matchKpis.unviewed}
                  </p>
                  <p className="mt-1 text-[11.5px] font-medium text-slate-500">Chưa mở hồ sơ</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Bookmark className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none text-[#072348]">
                    {matchKpis.viewed}
                  </p>
                  <p className="mt-1 text-[11.5px] font-medium text-slate-500">Đã mở hồ sơ</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Briefcase className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none text-[#072348]">
                    {matchKpis.applied}
                  </p>
                  <p className="mt-1 text-[11.5px] font-medium text-slate-500">Đã ứng tuyển</p>
                </div>
              </div>
            </div>

            <ResultList
              results={shownMatches}
              loading={matching}
              rightToolbar={
                hasMatched && matchResults.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <span>Sắp xếp:</span>
                      <select
                        value={sortByScore ? 'desc' : 'asc'}
                        onChange={(e) => setSortByScore(e.target.value === 'desc')}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#072348] outline-none"
                      >
                        <option value="desc">Tỷ lệ matching: cao → thấp</option>
                        <option value="asc">Tỷ lệ matching: thấp → cao</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setRefineOpen((v) => !v)}
                      className={clsx(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition',
                        refineOpen || locationMode !== 'off'
                          ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Lọc nâng cao
                    </button>
                  </div>
                ) : undefined
              }
              leftToolbar={
                refineOpen && hasMatched && matchResults.length > 0 ? (
                  <MatchRefineBar
                    sortByScore={sortByScore}
                    locationMode={locationMode}
                    jobLocation={selectedJob?.location ?? null}
                    onSortByScore={setSortByScore}
                    onLocationMode={setLocationMode}
                  />
                ) : undefined
              }
              shortlistOverrides={shortlistOverrides}
              shortlistBusyIds={shortlistBusyIds}
              onToggleShortlist={handleToggleShortlist}
              emptyTitle={
                locationMode === 'exact' && matchResults.length > 0
                  ? 'Không có ứng viên đúng địa điểm của tin'
                  : 'Chưa thấy ứng viên khớp tin này'
              }
              emptyHint={
                locationMode === 'exact' && matchResults.length > 0
                  ? 'Chọn Gần nhất để xem hồ sơ cùng miền với địa điểm trên JD.'
                  : 'Engine Sales/Kỹ thuật chưa tìm thấy hồ sơ đủ tiêu chí JD. Kiểm tra Inbox hoặc bổ sung dữ liệu hồ sơ ứng viên.'
              }
            />
          </section>
        )}

        <section ref={filterAnchorRef} aria-labelledby="optional-filter-heading" className="space-y-2 scroll-mt-24">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_32px_-16px_rgba(7,35,72,0.35)] sm:px-5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="optional-filter-heading" className="text-sm font-semibold text-brand-800">
                Bộ lọc tuỳ chọn
              </h2>
              <p className="text-xs text-slate-500">
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
                shortlistOverrides={shortlistOverrides}
                shortlistBusyIds={shortlistBusyIds}
                onToggleShortlist={handleToggleShortlist}
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
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700 active:scale-95 disabled:opacity-40"
          >
            {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Tìm ngay
          </button>
        </div>
      </div>
    </AppShell>
  );
}
