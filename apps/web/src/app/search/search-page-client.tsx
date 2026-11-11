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
  Building2,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
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
import { CopilotRobot } from '@/components/copilot-robot';
import { ProfileOpenLink } from '@/components/starter-profile-lock';
import { ApiError } from '@/lib/api';
import { addCandidateShortlist, removeCandidateShortlist } from '@/lib/candidate';
import { listMyJobs } from '@/lib/jobs';
import { candidatesForJob } from '@/lib/matching';
import { formatMatchPct, matchRingColor } from '@/lib/match-percent';
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

type ParsedAiReason = {
  background: string | null;
  missingItems: string[];
  note: string | null;
};

function parseAiReason(reason?: string | null): ParsedAiReason {
  if (!reason) return { background: null, missingItems: [], note: null };
  let text = reason
    .trim()
    .replace(/^(?:Độ|Tỉ lệ|Tỷ lệ)\s+phù\s+hợp\s+[\d.,]+%\s*(?:\([^)]*\))?\.?\s*/i, '')
    .trim();

  if (!text) return { background: null, missingItems: [], note: null };

  let missingItems: string[] = [];
  const missingMatch = text.match(/Khoảng thiếu:\s*([^.]+)\.?/i);
  if (missingMatch) {
    missingItems = missingMatch[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    text = text.replace(missingMatch[0], '').trim();
  }

  let background: string | null = null;
  let note: string | null = null;

  const bgPrefix = text.match(/^(?:Nền tảng|Nền):\s*(.+)$/i);
  if (bgPrefix) {
    const rest = bgPrefix[1].replace(/\.\s*$/, '').trim();
    const extraSplit = rest.match(/^(.+?)\.\s+((?:Điểm mạnh|Khớp|Phù hợp|Ưu điểm):?\s*.+)$/i);
    if (extraSplit) {
      background = extraSplit[1].trim() || null;
      note = extraSplit[2].replace(/\.\s*$/, '').trim() || null;
    } else {
      background = rest || null;
    }
  } else {
    const cleaned = text.replace(/\.\s*$/, '').trim();
    note = cleaned || null;
  }

  return { background, missingItems, note };
}

function ScoreRing({ scorePct }: { scorePct: number }) {
  const pct = formatMatchPct(scorePct);
  const r = 18;
  const c = 2 * Math.PI * r;
  const safe = Math.min(1, Math.max(0, scorePct / 100));
  const offset = c * (1 - safe);
  const ringColor = matchRingColor(scorePct);
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#fde68a"
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
          style={{ color: ringColor }}
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
  const parsedReason = useMemo(() => parseAiReason(result.reason), [result.reason]);
  const matchedSkills = result.matchedSkills ?? [];
  const visibleSkills = matchedSkills.slice(0, 4);
  const extraSkills = Math.max(0, matchedSkills.length - visibleSkills.length);
  const visibleMissing = parsedReason.missingItems.slice(0, 2);
  const extraMissing = Math.max(0, parsedReason.missingItems.length - visibleMissing.length);
  const isUnlockedOrFree = Boolean(result.viewed || result.applied);

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(7,35,72,0.04)] transition duration-200 hover:border-slate-300 hover:shadow-[0_10px_26px_-16px_rgba(7,35,72,0.2)] animate-soft-rise"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      {/* Tầng 1: Thông tin ứng viên & nhận xét AI dễ quét */}
      <div className="px-4 pt-4 pb-3.5 sm:px-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <ScoreRing scorePct={scorePct} />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="truncate text-[15px] font-bold text-[#072348] sm:text-base">
                  {displayName}
                </h3>

                {result.viewed ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    Đã xem
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/70">
                    Chưa xem
                  </span>
                )}

                {result.applied && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/80">
                    Đã ứng tuyển
                  </span>
                )}

                {result.code ? (
                  <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">
                    {result.code}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                disabled={shortlistBusy}
                onClick={() => onToggleShortlist(result.candidateId)}
                className={clsx(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-60',
                  shortlisted
                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-[#072348]',
                )}
                title={
                  shortlisted
                    ? 'Bỏ lưu khỏi danh sách Shortlist theo dõi'
                    : 'Lưu ứng viên vào Shortlist để cân nhắc mở hồ sơ sau'
                }
              >
                {shortlisted ? (
                  <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <span>{shortlisted ? 'Đã Shortlist' : 'Shortlist'}</span>
              </button>
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="font-medium text-slate-700">
                  {result.currentPosition
                    ? formatJobTitle(result.currentPosition)
                    : 'Chưa cập nhật vị trí'}
                </span>
                {result.industry ? (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{result.industry}</span>
                  </>
                ) : null}
              </span>

              <span
                className={clsx(
                  'inline-flex items-center gap-1 font-medium',
                  result.location ? 'text-slate-700' : 'text-slate-400',
                )}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                {result.location ?? 'Chưa có địa điểm'}
              </span>
            </p>

            {parsedReason.background && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-slate-500">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="line-clamp-1">
                  <span className="text-slate-400">Nền tảng:</span>{' '}
                  <span className="font-medium text-slate-700">{parsedReason.background}</span>
                </span>
              </p>
            )}

            {parsedReason.note && (
              <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-slate-600">
                {parsedReason.note}
              </p>
            )}

            {(visibleSkills.length > 0 || visibleMissing.length > 0) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {visibleSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-50/70 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200/60"
                  >
                    <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                    {skill}
                  </span>
                ))}
                {extraSkills > 0 && (
                  <span
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500"
                    title={matchedSkills.slice(4).join(', ')}
                  >
                    +{extraSkills}
                  </span>
                )}
                {visibleMissing.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-amber-50/80 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200/70"
                    title={`Cần kiểm tra thêm khi phỏng vấn: ${parsedReason.missingItems.join(', ')}`}
                  >
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                    <span>
                      Thiếu: {visibleMissing.join(', ')}
                      {extraMissing > 0 ? ` +${extraMissing}` : ''}
                    </span>
                  </span>
                )}
              </div>
            )}

            {criteria.length > 0 && (
              <div
                className={clsx(
                  'grid transition-all duration-300 ease-soft',
                  expanded ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <div className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2">
                    {criteria.slice(0, 8).map((c) => {
                      const pct = Math.round((c.score ?? 0) * 100);
                      return (
                        <div key={c.key} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate font-medium text-slate-600" title={c.note}>
                              {c.label}
                              <span className="ml-1 font-normal text-slate-400">
                                · {Math.round(c.weight * 100)}%
                              </span>
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tầng 2: Thanh hành động chân thẻ đồng bộ chuẩn B2B */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 bg-slate-50/55 px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          {criteria.length > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={clsx(
                '-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition',
                expanded
                  ? 'bg-amber-50 text-[#C86D18]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#072348]',
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-[#E8872A]" />
              <span>Chi tiết tiêu chí matching</span>
              <ChevronDown
                className={clsx(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-[#E8872A]" />
              Gợi ý bởi AI Inlink
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isUnlockedOrFree ? (
            <>
              {result.applied && !result.viewed && (
                <span className="hidden text-[11px] font-medium text-emerald-700 sm:inline">
                  Miễn phí mở
                </span>
              )}
              <ProfileOpenLink
                href={`/candidates/${result.candidateId}?match=${formatMatchPct(scorePct)}`}
                potential={!result.applied}
                ariaLabel={`Xem hồ sơ ${displayName}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#072348]/20 bg-white px-4 text-xs font-bold text-[#072348] shadow-2xs transition hover:border-[#072348]/40 hover:bg-[#072348]/[0.04]"
              >
                <span>Xem hồ sơ</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </ProfileOpenLink>
            </>
          ) : (
            <ProfileOpenLink
              href={`/candidates/${result.candidateId}?match=${formatMatchPct(scorePct)}`}
              potential={!result.applied}
              ariaLabel={`Mở hồ sơ ${displayName} (${creditCost} Credit)`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#072348] pl-4 pr-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d356c]"
            >
              <span>Mở hồ sơ</span>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#FFD0A3]"
                title={
                  creditCost === 2
                    ? 'Mở hồ sơ ứng viên này tính 2 Credit (Matching ≥ 80%)'
                    : 'Mở hồ sơ ứng viên này tính 1 Credit (Matching < 80%)'
                }
              >
                <Coins className="h-3 w-3 shrink-0 text-[#FFB366]" />
                {creditCost} Credit
              </span>
            </ProfileOpenLink>
          )}
        </div>
      </div>
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
  shortlistOverrides,
  shortlistBusyIds,
  onToggleShortlist,
}: {
  results: CandidateSearchResult[];
  loading: boolean;
  emptyTitle: string;
  emptyHint: string;
  leftToolbar?: ReactNode;
  shortlistOverrides: Record<string, boolean>;
  shortlistBusyIds: Record<string, boolean>;
  onToggleShortlist: (candidateId: string, currentShortlisted: boolean) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>('all');
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / RESULT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedResults = useMemo(() => {
    const start = (safePage - 1) * RESULT_PAGE_SIZE;
    return filteredResults.slice(start, start + RESULT_PAGE_SIZE);
  }, [filteredResults, safePage]);

  const statusTabs: { key: ResultStatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tất cả', count: counts.all },
    { key: 'unviewed', label: 'Chưa xem', count: counts.unviewed },
    { key: 'viewed', label: 'Đã xem', count: counts.viewed },
    { key: 'applied', label: 'Đã ứng tuyển', count: counts.applied },
    { key: 'shortlisted', label: 'Shortlist', count: counts.shortlisted },
  ];

  return (
    <div className="space-y-3">
      {(leftToolbar || results.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 md:flex-nowrap xl:gap-x-3">
          {leftToolbar}
          {results.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1 md:shrink-0 md:flex-nowrap xl:gap-1.5">
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
                      'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold transition lg:h-9 xl:gap-1.5 xl:px-3 xl:text-xs',
                      active
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] ring-1 ring-[#BFDBFE]'
                        : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70 hover:text-slate-800',
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={clsx(
                        'tabular-nums text-[10.5px] font-bold xl:text-[11px]',
                        active ? 'text-[#1D4ED8]' : 'text-slate-400',
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs text-slate-500">
              <span>
                Hiển thị{' '}
                <strong className="font-semibold text-slate-700">
                  {(safePage - 1) * RESULT_PAGE_SIZE + 1}–
                  {Math.min(safePage * RESULT_PAGE_SIZE, filteredResults.length)}
                </strong>{' '}
                trên <strong className="font-semibold text-slate-700">{filteredResults.length}</strong>{' '}
                ứng viên
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="px-2 font-semibold tabular-nums text-slate-700">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
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
  const [filtersOpen, setFiltersOpen] = useState(Boolean(initialQ.trim()));
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

  return (
    <AppShell>
      <div className="animate-soft-rise space-y-4 pb-24 lg:pb-10">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_16px_36px_-20px_rgba(7,35,72,0.28)] sm:px-6">
          <div className="pointer-events-none absolute -right-2 bottom-0 top-0 hidden w-44 items-end justify-center lg:flex">
            <CopilotRobot className="w-36" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 top-0 h-40 w-56 rounded-full bg-accent-100/70 blur-3xl"
          />
          <div className="relative max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
              <span className="h-4 w-1 rounded-full bg-accent-500" />
              Tìm ứng viên AI
              {matching && (
                <span className="inline-flex items-center gap-1 normal-case tracking-normal text-amber-700">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  đang chấm matching
                </span>
              )}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-800 sm:text-[1.7rem] sm:leading-snug">
              Tìm kiếm ứng viên thông minh theo nhu cầu doanh nghiệp
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
              Chọn tin, bấm Tìm ngay — xếp ứng viên theo engine Kinh doanh hoặc Kỹ thuật của đúng tin đó.
            </p>
          </div>
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
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(7,35,72,0.04),0_16px_36px_-20px_rgba(7,35,72,0.28)]">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                  <Target className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="jd-heading" className="text-sm font-semibold tracking-tight text-brand-800 sm:text-[15px]">
                    Chọn tin để tìm kiếm ứng viên phù hợp nhất
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
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
                      className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[13px] outline-none transition focus:border-accent-300 focus:bg-white focus:ring-2 focus:ring-accent-100"
                    />
                  </div>
                )}
                <button
                  type="button"
                  disabled={!selectedJobId || matching}
                  onClick={() => runMatch(selectedJobId)}
                  className="hidden shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700 active:scale-95 disabled:opacity-40 sm:inline-flex"
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
                          'group flex w-full items-center gap-3 px-4 py-3 text-left transition duration-200 sm:px-5',
                          selected ? 'bg-accent-50' : 'hover:bg-slate-50',
                        )}
                      >
                        <span
                          className={clsx(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition duration-200',
                            selected
                              ? 'bg-accent-500 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-accent-50 group-hover:text-accent-600',
                          )}
                          aria-hidden
                        >
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span
                              className={clsx(
                                'truncate text-sm tracking-tight',
                                selected ? 'font-semibold text-brand-800' : 'font-medium text-slate-700',
                              )}
                            >
                              {job.title}
                            </span>
                            <span className="hidden shrink-0 font-mono text-[11px] text-slate-400 sm:inline">
                              {job.code}
                            </span>
                            {job.isSourcingActive && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FFD0A3] bg-[#FFF8F1] px-2 py-0.5 text-[10px] font-bold text-[#072348]">
                                <Sparkles className="h-2.5 w-2.5 text-[#E8872A]" />
                                Đang hoạt động săn tin
                              </span>
                            )}
                          </span>
                        </span>
                        {track && (
                          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 md:inline-flex">
                            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                            {formatJobTrack(track)}
                          </span>
                        )}
                        <span className="hidden min-w-0 max-w-[9rem] items-center gap-1.5 truncate text-xs text-slate-500 lg:inline-flex">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{job.location ?? '—'}</span>
                        </span>
                        <span
                          className={clsx(
                            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                            job.status === JobStatus.Published
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700',
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
                  ? `${shownMatches.length} ứng viên khớp «${selectedJob?.title ?? 'tin đã chọn'}»`
                  : 'Đang chấm matching'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {matching
                  ? 'Đang đối chiếu tiêu chí chuẩn của tin…'
                  : `${engineLabel(selectedJob)} · ${refineCaption(sortByScore, locationMode)}`}
              </p>
            </div>
            <ResultList
              results={shownMatches}
              loading={matching}
              leftToolbar={
                hasMatched && matchResults.length > 0 ? (
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

        <section aria-labelledby="optional-filter-heading" className="space-y-2">
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
