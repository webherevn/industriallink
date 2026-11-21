'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bookmark,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Factory,
  FileText,
  Info,
  MapPin,
  Package,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  TrendingUp,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ExperienceBand,
  SkillLevel,
  trackOfLevel,
  JOB_TRACK_LABEL,
  SALES_MATCH_FIELD_LABEL,
  TECH_MATCH_FIELD_LABEL,
  isJobLevelCode,
  type CandidateView,
  type JobMatchView,
} from '@industriallink/contracts';
import { plainLabel } from '@/lib/plain-label';
import { locationMatchesProvince } from '@/lib/profile-province';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { companyPublicPath, jobPublicPath, apiPublicBase } from '@/lib/public-paths';
import { ApiError } from '@/lib/api';
import { CopilotRobot } from '@/components/copilot-robot';
import { fetchMe } from '@/lib/auth';
import { myApplications } from '@/lib/applications';
import { getMyCandidate } from '@/lib/candidate';
import {
  EXPERIENCE_LABEL,
  formatJobLevel,
  formatSalary,
} from '@/lib/format';
import {
  addJobBookmark,
  applyToJob,
  listBookmarkedJobs,
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
import { MATCH_LEVEL_THRESHOLD, matchFitLabel, matchLevelOf } from '@/lib/match-fit-label';

type FilterTab = 'all' | 'high' | 'medium' | 'new';

const PAGE_SIZE = 5;
/** ⭐ Ngưỡng chuẩn toàn sàn — đồng bộ với `match-fit-label.ts` (80 / 60). */
const HIGH_MATCH = MATCH_LEVEL_THRESHOLD.high;
const MEDIUM_MATCH = MATCH_LEVEL_THRESHOLD.medium;

/** Ánh xạ cấp kỹ năng (enum) → % thanh hiển thị — không phải số hardcode hồ sơ. */
const SKILL_LEVEL_PCT: Record<SkillLevel, number> = {
  [SkillLevel.Beginner]: 35,
  [SkillLevel.Intermediate]: 60,
  [SkillLevel.Advanced]: 82,
  [SkillLevel.Expert]: 95,
};

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

function isNewJob(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 48 * 60 * 60 * 1000;
}

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

function matchLabel(score: number): { text: string; tone: 'high' | 'medium' | 'low' } {
  // ⭐ Ngưỡng chuẩn toàn sàn (>=80 Rất phù hợp / >=60 Khá phù hợp /
  // >=40 Cân nhắc / <40 Độ phù hợp thấp).
  const level = matchLevelOf(score);
  const tone = level === 'high' ? 'high' : level === 'poor' ? 'low' : 'medium';
  return { text: matchFitLabel(score), tone };
}

function matchRingLabel(score: number): string {
  // ⭐ Ngưỡng chuẩn toàn sàn (>=80 Rất phù hợp / >=60 Khá phù hợp /
  // >=40 Cân nhắc / <40 Độ phù hợp thấp).
  return matchFitLabel(score);
}

function avgScoreLabel(avg: number): string {
  if (avg >= 85) return 'Rất cao';
  if (avg >= HIGH_MATCH) return 'Cao';
  if (avg >= MEDIUM_MATCH) return 'Trung bình';
  return 'Cần cải thiện';
}

function buildInsights(candidate: CandidateView | undefined, jobs: JobMatchView[]): string[] {
  const insights: string[] = [];
  if (!candidate) return insights;

  const skillCounts = new Map<string, number>();
  for (const j of jobs) {
    for (const s of j.match.matchedSkills) {
      skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1);
    }
  }
  const topSkill = [...skillCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSkill) {
    insights.push(
      `Kỹ năng «${topSkill[0]}» đang khớp với ${topSkill[1]} tin gợi ý — đây là điểm mạnh trên hồ sơ của bạn.`,
    );
  } else if (candidate.skills[0]) {
    insights.push(
      `Hồ sơ có kỹ năng «${candidate.skills[0].name}». Bổ sung thêm kỹ năng liên quan sẽ tăng độ khớp AI.`,
    );
  }

  const missingCounts = new Map<string, number>();
  for (const j of jobs) {
    for (const s of j.match.missingSkills) {
      missingCounts.set(s, (missingCounts.get(s) ?? 0) + 1);
    }
  }
  const topMissing = [...missingCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topMissing) {
    insights.push(
      `Nhiều tin đang yêu cầu «${topMissing[0]}» — bổ sung kỹ năng này có thể mở thêm cơ hội.`,
    );
  }

  if (candidate.aiProfile?.strengths?.[0]) {
    insights.push(`AI nhận định điểm mạnh: ${candidate.aiProfile.strengths[0]}.`);
  }

  if (candidate.profileCompletion < 100) {
    insights.push(
      `Hồ sơ đang hoàn thiện ${candidate.profileCompletion}%. Cập nhật thêm để AI gợi ý chính xác hơn.`,
    );
  }

  return insights.slice(0, 3);
}

function toNaturalPhrase(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '';
  // Giữ nguyên nếu viết tắt/tên riêng bắt đầu bằng nhiều chữ hoa (OTE, B2B, PLC...)
  if (/^[A-Z0-9]{2,}/.test(trimmed)) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function joinNaturalVi(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} và ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`;
}

function buildCandidateAiSuggestion(job: JobMatchView): string | null {
  const { match } = job;
  if (!match) return null;

  if (match.salesMatch?.dat_loc_cung === false || match.technicalMatch?.dat_loc_cung === false) {
    return match.reason || null;
  }

  const bestCompany =
    match.salesMatch?.cong_ty_tot_nhat?.ten?.trim() ||
    match.technicalMatch?.cong_ty_tot_nhat?.ten?.trim() ||
    null;

  const topCriteria = (match.criteria ?? [])
    .filter((c): c is typeof c & { score: number } => c.score != null && c.score >= 0.65 && c.label.trim().length > 0)
    .sort((a, b) => b.score * (b.weight || 0.05) - a.score * (a.weight || 0.05))
    .slice(0, 3)
    .map((c) => toNaturalPhrase(c.label));

  const strengthLabels =
    topCriteria.length > 0
      ? topCriteria
      : match.matchedSkills.slice(0, 3).map((s) => s.trim()).filter(Boolean);

  const rawGaps = match.salesMatch
    ? match.salesMatch.khoang_thieu.map((k) => SALES_MATCH_FIELD_LABEL[k]).filter(Boolean)
    : match.technicalMatch
      ? match.technicalMatch.khoang_thieu.map((k) => TECH_MATCH_FIELD_LABEL[k]).filter(Boolean)
      : match.missingSkills;

  const gapLabels = Array.from(new Set(rawGaps.map(toNaturalPhrase).filter(Boolean))).slice(0, 2);

  const sentences: string[] = [];

  if (bestCompany && strengthLabels.length > 0) {
    sentences.push(
      `Kinh nghiệm tại ${bestCompany} khớp tốt về ${joinNaturalVi(strengthLabels)}.`,
    );
  } else if (strengthLabels.length > 0) {
    sentences.push(`Hồ sơ của bạn khớp tốt về ${joinNaturalVi(strengthLabels)}.`);
  } else if (bestCompany) {
    sentences.push(`Kinh nghiệm tại ${bestCompany} có nhiều điểm tương đồng với vị trí này.`);
  }

  if (gapLabels.length > 0) {
    sentences.push(
      sentences.length > 0
        ? `Bạn chỉ cần cân nhắc thêm về ${joinNaturalVi(gapLabels)}.`
        : `Cần cân nhắc thêm về ${joinNaturalVi(gapLabels)} khi ứng tuyển.`,
    );
  } else if (match.score >= 80 && sentences.length > 0) {
    sentences.push('Rất phù hợp để bạn ứng tuyển ngay.');
  }

  if (sentences.length > 0) {
    return sentences.join(' ');
  }

  return match.reason || null;
}

function bestFitGroup(jobs: JobMatchView[], candidate: CandidateView | undefined): string {
  const votes = new Map<string, number>();
  for (const j of jobs.slice(0, 8)) {
    if (j.industry) votes.set(j.industry, (votes.get(j.industry) ?? 0) + j.match.score);
    if (j.jobLevel && isJobLevelCode(j.jobLevel)) {
      const track = trackOfLevel(j.jobLevel);
      const label = JOB_TRACK_LABEL[track];
      votes.set(label, (votes.get(label) ?? 0) + j.match.score * 0.5);
    }
  }
  if (candidate?.profile?.industry) {
    votes.set(
      candidate.profile.industry,
      (votes.get(candidate.profile.industry) ?? 0) + 40,
    );
  }
  const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? candidate?.profile?.specialization ?? 'Công nghiệp B2B';
}

type RecommendSort = 'newest' | 'salary' | 'score';

function recommendPosted(job: JobMatchView): number {
  const time = new Date(job.publishedAt || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

function recommendSalary(job: JobMatchView): number {
  const values = [job.salaryMin, job.salaryMax].filter((n): n is number => n != null && n > 0);
  return values.length ? Math.max(...values) : -1;
}

export default function RecommendedPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<RecommendSort>('newest');
  const [place, setPlace] = useState('');
  const [page, setPage] = useState(1);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const {
    data: candidate,
    dataUpdatedAt: candidateUpdatedAt,
  } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const {
    data: jobs,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: recommendedJobs,
    retry: false,
  });
  const { data: applications } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
  });
  const { data: bookmarks } = useQuery({
    queryKey: ['job-bookmarks'],
    queryFn: listBookmarkedJobs,
    retry: false,
  });

  const bookmarkedIds = useMemo(
    () => new Set((bookmarks ?? []).map((b) => b.id)),
    [bookmarks],
  );
  const appliedIds = useMemo(
    () => new Set((applications ?? []).map((a) => a.jobId)),
    [applications],
  );

  const [applyFeedback, setApplyFeedback] = useState<{ jobId: string; tone: 'ok' | 'err'; text: string } | null>(null);
  const applyMutation = useMutation({
    mutationFn: async (jobId: string) => applyToJob(jobId, {}),
    onSuccess: (_data, jobId) => {
      setApplyFeedback({ jobId, tone: 'ok', text: 'Đã gửi hồ sơ ứng tuyển thành công!' });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-jobs'] });
    },
    onError: (err, jobId) => {
      setApplyFeedback({
        jobId,
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không gửi được hồ sơ ứng tuyển',
      });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await removeJobBookmark(id);
      else await addJobBookmark(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const allJobs = useMemo(() => jobs ?? [], [jobs]);
  const highJobs = useMemo(
    () => allJobs.filter((j) => j.match.score >= HIGH_MATCH),
    [allJobs],
  );
  const mediumJobs = useMemo(
    () =>
      allJobs.filter((j) => j.match.score >= MEDIUM_MATCH && j.match.score < HIGH_MATCH),
    [allJobs],
  );
  const newJobs = useMemo(
    () => allJobs.filter((j) => isNewJob(j.publishedAt)),
    [allJobs],
  );

  const places = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of candidate?.profile?.sales?.desiredLocations ?? []) {
      const name = raw.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      list.push(name);
    }
    return list;
  }, [candidate]);

  const filtered = useMemo(() => {
    const rows =
      filter === 'high'
        ? highJobs
        : filter === 'medium'
          ? mediumJobs
          : filter === 'new'
            ? newJobs
            : allJobs;
    const located = place
      ? rows.filter((job) => locationMatchesProvince(job.location, place))
      : rows;
    return located.slice().sort((a, b) => {
      if (sort === 'salary') {
        return recommendSalary(b) - recommendSalary(a) || recommendPosted(b) - recommendPosted(a);
      }
      if (sort === 'score') {
        return b.match.score - a.match.score || recommendPosted(b) - recommendPosted(a);
      }
      return recommendPosted(b) - recommendPosted(a);
    });
  }, [filter, sort, place, allJobs, highJobs, mediumJobs, newJobs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const avgScore =
    allJobs.length > 0
      ? Math.round(allJobs.reduce((s, j) => s + j.match.score, 0) / allJobs.length)
      : 0;

  const insights = useMemo(() => buildInsights(candidate, allJobs), [candidate, allJobs]);
  const fitGroup = useMemo(() => bestFitGroup(allJobs, candidate), [allJobs, candidate]);
  const matchedSkillCount = useMemo(() => {
    const set = new Set<string>();
    allJobs.forEach((j) => j.match.matchedSkills.forEach((s) => set.add(s)));
    return set.size;
  }, [allJobs]);

  const updatedAt = dataUpdatedAt || candidateUpdatedAt;
  const updatedLabel = updatedAt
    ? `Cập nhật lần cuối: ${new Date(updatedAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })}`
    : 'Chưa cập nhật';

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_260px]">
        <CandidateSidebar
          displayName={candidate?.displayName ?? me?.displayName ?? 'Ứng viên'}
          email={me?.email}
          hasAvatar={Boolean(candidate?.hasAvatar)}
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
        />

        {/* Center */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                Gợi ý việc làm AI
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                AI phân tích hồ sơ và kỹ năng để đề xuất cơ hội phù hợp nhất.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              {updatedLabel}
            </button>
          </div>

          {/* AI banner — 3 cột cân: điểm số | nhận định | robot */}
          <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#061f3d] via-[#0a3566] to-[#1a4d82] text-white shadow-lg shadow-slate-900/10">
            <div
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  'radial-gradient(ellipse 50% 80% at 12% 50%, rgba(245,158,11,0.22), transparent 55%), radial-gradient(ellipse 40% 60% at 92% 70%, rgba(56,189,248,0.12), transparent 50%)',
              }}
            />

            <div className="relative z-10 grid min-h-[220px] grid-cols-1 sm:min-h-[240px] lg:grid-cols-[minmax(200px,0.9fr)_minmax(0,1.4fr)_minmax(140px,0.7fr)] lg:items-stretch">
              {/* Cột 1 — điểm số */}
              <div className="flex flex-col justify-center border-b border-white/10 px-6 py-8 sm:px-8 sm:py-9 lg:border-b-0 lg:border-r lg:border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/85">
                  Độ phù hợp trung bình
                </p>
                <p className="mt-3 text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
                  {allJobs.length ? `${avgScore}%` : '—'}
                </p>
                {allJobs.length > 0 && (
                  <span className="mt-3 inline-flex w-fit items-center rounded-md bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap text-amber-100 ring-1 ring-inset ring-amber-300/40">
                    {avgScoreLabel(avgScore)}
                  </span>
                )}
                <p className="mt-3 text-sm text-sky-100/75">
                  Từ {allJobs.length} tin AI đã phân tích
                </p>
              </div>

              {/* Cột 2 — nhận định */}
              <div className="flex flex-col justify-center px-6 py-8 sm:px-8 sm:py-9">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/70">
                  Nhóm phù hợp nhất
                </p>
                <p className="mt-2 text-xl font-bold leading-snug text-amber-200 sm:text-2xl">
                  {fitGroup}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-sky-100/80">
                  AI đánh giá hồ sơ của bạn dựa trên{' '}
                  {matchedSkillCount || candidate?.skills?.length || 0} kỹ năng nổi bật
                  {candidate?.aiProfile?.strengths?.length
                    ? ` và ${candidate.aiProfile.strengths.length} điểm mạnh`
                    : ''}
                  .
                </p>
                <div className="mt-5">
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-amber-50"
                  >
                    Xem phân tích chi tiết
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>

              {/* Cột 3 — robot (cột thật, không absolute) */}
              <div className="relative hidden min-h-[160px] items-end justify-center overflow-hidden lg:flex">
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 50% 85%, rgba(255,255,255,0.12), transparent 55%)',
                  }}
                />
                <CopilotRobot className="relative z-[1] mb-1 h-[168px] w-auto drop-shadow-2xl xl:h-[184px]" />
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all' as const, label: 'Tất cả gợi ý', count: allJobs.length },
                  { id: 'high' as const, label: 'Phù hợp cao', count: highJobs.length },
                  { id: 'medium' as const, label: 'Phù hợp trung bình', count: mediumJobs.length },
                  { id: 'new' as const, label: 'Mới đăng', count: newJobs.length },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setFilter(t.id);
                    setPage(1);
                  }}
                  className={clsx(
                    'rounded-full px-3.5 py-1.5 text-xs font-medium transition sm:text-[13px]',
                    filter === t.id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sort}
                onChange={(e) => {
                  const value = e.target.value;
                  setSort(value === 'salary' ? 'salary' : value === 'score' ? 'score' : 'newest');
                  setPage(1);
                }}
                aria-label="Sắp xếp gợi ý"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 outline-none"
              >
                <option value="newest">Mới nhất</option>
                <option value="salary">Lương cao nhất</option>
                <option value="score">Điểm cao nhất</option>
              </select>
              {places.length > 0 && (
                <select
                  value={places.includes(place) ? place : ''}
                  onChange={(e) => {
                    setPlace(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Địa điểm"
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 outline-none"
                >
                  <option value="">Địa điểm</option>
                  {places.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600"
              >
                <Settings2 className="h-3.5 w-3.5" /> Tùy chỉnh gợi ý
              </Link>
            </div>
          </div>

          {/* Job list */}
          <ul className="mt-4 space-y-3">
            {isLoading && (
              <li className="rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
                AI đang phân tích hồ sơ...
              </li>
            )}
            {!isLoading && filtered.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
                <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  Chưa có gợi ý. Hãy tải CV và đảm bảo có tin tuyển dụng đang mở.
                </p>
                <Link
                  href="/upload"
                  className="mt-3 inline-block text-sm font-medium text-amber-600 hover:underline"
                >
                  Tải CV ngay
                </Link>
              </li>
            )}
            {pageItems.map((job) => (
              <MatchJobCard
                key={job.jobId}
                job={job}
                saved={bookmarkedIds.has(job.jobId)}
                applied={appliedIds.has(job.jobId)}
                busy={bookmarkMutation.isPending}
                applying={applyMutation.isPending && applyMutation.variables === job.jobId}
                applyFeedback={applyFeedback?.jobId === job.jobId ? applyFeedback : null}
                onToggleBookmark={() =>
                  bookmarkMutation.mutate({
                    id: job.jobId,
                    saved: bookmarkedIds.has(job.jobId),
                  })
                }
                onApply={() => applyMutation.mutate(job.jobId)}
              />
            ))}
          </ul>

          {filtered.length > 0 && (
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </section>

        {/* Right widgets — full width dưới nội dung trên tablet; cột riêng từ xl */}
        <aside className="min-w-0 space-y-4 lg:col-span-2 xl:col-span-1">
          <div className="rounded-2xl border border-amber-100/80 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" /> AI Insight cho bạn
            </p>
            <ul className="mt-3 space-y-3">
              {insights.length === 0 && (
                <li className="text-xs text-slate-400">
                  Chưa đủ dữ liệu insight. Tải CV để AI phân tích.
                </li>
              )}
              {insights.map((text) => (
                <li key={text} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  {text}
                </li>
              ))}
            </ul>
            {typeof candidate?.profileCompletion === 'number' && (
              <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Hoàn thiện hồ sơ</span>
                  <span className="font-semibold text-slate-700">
                    {candidate.profileCompletion}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-400"
                    style={{ width: `${candidate.profileCompletion}%` }}
                  />
                </div>
                <Link
                  href="/profile/edit"
                  className="mt-2 inline-block text-[11px] font-semibold text-amber-600 hover:underline"
                >
                  Hoàn thiện ngay →
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Kỹ năng của bạn</p>
              <Link href="/profile?tab=skills" className="text-[11px] font-medium text-amber-600 hover:underline">
                Xem chi tiết
              </Link>
            </div>
            <ul className="mt-3 space-y-2.5">
              {(candidate?.skills ?? []).length === 0 && (
                <li className="text-xs text-slate-400">Chưa có kỹ năng trên hồ sơ.</li>
              )}
              {(candidate?.skills ?? []).slice(0, 6).map((s) => {
                const pct = SKILL_LEVEL_PCT[s.level] ?? 50;
                return (
                  <li key={s.name}>
                    <div className="flex justify-between text-[12px]">
                      <span className="font-medium text-slate-700">{s.name}</span>
                      <span className="text-slate-400">{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Hoạt động tìm việc</p>
              <Link
                href="/applications"
                className="text-[11px] font-medium text-amber-600 hover:underline"
              >
                Xem lịch sử
              </Link>
            </div>
            <ul className="mt-3 space-y-2.5 text-[13px] text-slate-600">
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <Eye className="h-3.5 w-3.5" />
                </span>
                <span>
                  <strong className="text-slate-900">{allJobs.length}</strong> việc AI gợi ý
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Bookmark className="h-3.5 w-3.5" />
                </span>
                <span>
                  <strong className="text-slate-900">{bookmarks?.length ?? 0}</strong> việc đã lưu
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Send className="h-3.5 w-3.5" />
                </span>
                <span>
                  <strong className="text-slate-900">{applications?.length ?? 0}</strong> việc đã
                  ứng tuyển
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <span>
                  <strong className="text-slate-900">{candidate?.skills?.length ?? 0}</strong> kỹ
                  năng trên hồ sơ
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50/80 via-white to-brand-50/50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Nhận gợi ý chính xác hơn</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Cập nhật CV và kỹ năng để AI hiểu đúng năng lực công nghiệp của bạn.
            </p>
            <Link
              href="/profile/edit"
              className="mt-3 flex h-9 items-center justify-center rounded-lg bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Cập nhật hồ sơ ngay
            </Link>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function splitBenefitTags(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n•;,]+/)
    .map((s) => s.replace(/^[\-\*\s]+/, '').trim())
    .filter((s) => s.length >= 2 && s.length <= 40)
    .slice(0, 4);
}

function MatchJobCard({
  job,
  saved,
  applied,
  busy,
  applying,
  applyFeedback,
  onToggleBookmark,
  onApply,
}: {
  job: JobMatchView;
  saved: boolean;
  applied: boolean;
  busy: boolean;
  applying: boolean;
  applyFeedback: { tone: 'ok' | 'err'; text: string } | null;
  onToggleBookmark: () => void;
  onApply: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const label = matchLabel(job.match.score);
  const showLogo = Boolean(job.companyHasLogo && job.companyId && !logoFailed);
  const productsText =
    job.products && job.products.length > 0
      ? job.products.join(', ')
      : job.subIndustry?.trim() || null;
  const expText = job.experienceBand
    ? EXPERIENCE_LABEL[job.experienceBand as ExperienceBand] ?? job.experienceBand
    : 'Không yêu cầu';

  return (
    <li>
      <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          {/* Khối trái: Logo + Nội dung chi tiết */}
          <div className="flex min-w-0 flex-1 gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-600">
              {showLogo ? (
                <img
                  src={`${apiPublicBase()}/companies/${job.companyId}/logo`}
                  alt={job.companyName}
                  className="h-full w-full object-contain p-1"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                companyInitials(job.companyName)
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* Hàng 1: Badge mốc phù hợp (giữ đồng bộ tone cũ) + Mới + Thời gian + Bookmark */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={clsx(
                      'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                      matchBadgeTone(job.match.score),
                    )}
                  >
                    {label.text}
                  </span>
                  {isNewJob(job.publishedAt) && (
                    <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10.5px] font-bold text-white">
                      Mới
                    </span>
                  )}
                  <span className="text-[11.5px] text-slate-400">
                    {formatRelativeTime(job.publishedAt)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'}
                  onClick={onToggleBookmark}
                  className={clsx(
                    'shrink-0 rounded-md p-1 transition',
                    saved ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500',
                  )}
                >
                  <Bookmark className={clsx('h-4 w-4', saved && 'fill-current')} />
                </button>
              </div>

              {/* Hàng 2: Tên vị trí + Tên công ty + Tích xanh xác minh */}
              <div className="mt-1.5">
                <Link
                  href={jobPublicPath(job)}
                  className="block text-[16px] font-bold leading-snug text-slate-900 hover:text-brand-600"
                >
                  {job.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13.5px] text-slate-600">
                  {job.companyId ? (
                    <Link
                      href={companyPublicPath(job)}
                      className="hover:text-amber-700 hover:underline"
                    >
                      {job.companyName}
                    </Link>
                  ) : (
                    <span>{job.companyName}</span>
                  )}
                  {job.companyVerified ? (
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 fill-[#1D9BF0] text-white"
                      aria-label="Công ty đã xác minh"
                    />
                  ) : null}
                </p>
              </div>

              {/* Hàng 3: Ngành & Sản phẩm */}
              {(job.industry || productsText) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  {job.industry && (
                    <span className="inline-flex items-center gap-1.5">
                      <Factory className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>
                        <strong className="font-semibold text-slate-700">Ngành:</strong> {job.industry}
                      </span>
                    </span>
                  )}
                  {job.industry && productsText && (
                    <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" aria-hidden />
                  )}
                  {productsText && (
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>
                        <strong className="font-semibold text-slate-700">Sản phẩm:</strong> {productsText}
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Hàng 4: Địa điểm, Mức lương, Kinh nghiệm */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {job.location ?? 'Linh hoạt'}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                  <Banknote className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  {formatSalary(job.salaryMin, job.salaryMax)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {expText}
                </span>
              </div>

              {/* Hàng 6: Hộp AI gợi ý */}
              {(() => {
                const aiSuggestion = buildCandidateAiSuggestion(job);
                if (!aiSuggestion) return null;
                return (
                  <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-emerald-50/75 px-3 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-emerald-100/80">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <p className="line-clamp-2">
                      <strong className="font-semibold text-slate-900">AI gợi ý:</strong>{' '}
                      {aiSuggestion}
                    </p>
                  </div>
                );
              })()}

              {applyFeedback && (
                <p
                  className={clsx(
                    'mt-2 text-xs font-medium',
                    applyFeedback.tone === 'ok' ? 'text-emerald-700' : 'text-rose-600',
                  )}
                >
                  {applyFeedback.text}
                </p>
              )}
            </div>
          </div>

          {/* Khối phải: Vòng tròn % phù hợp (đồng bộ màu cũ) + Nút Ứng tuyển & Xem chi tiết */}
          <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:w-[164px] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <div className="flex flex-col items-center">
              <div className="relative h-16 w-16">
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
                    stroke={matchRingColor(job.match.score)}
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={
                      2 * Math.PI * 26 * (1 - Math.min(1, Math.max(0, job.match.score / 100)))
                    }
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-[14px] font-extrabold leading-none tracking-tight tabular-nums"
                    style={{ color: matchScoreTextColor(job.match.score) }}
                  >
                    {formatMatchPct(job.match.score)}
                    <span className="text-[10px] font-bold">%</span>
                  </span>
                </span>
              </div>
              <span
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-700"
                title={matchRingLabel(job.match.score)}
              >
                Mức độ phù hợp
                <Info className="h-3.5 w-3.5 text-slate-400" />
              </span>
            </div>

            <div className="flex w-full flex-col gap-2">
              {applied ? (
                <span className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Đã ứng tuyển
                </span>
              ) : (
                <button
                  type="button"
                  disabled={applying}
                  onClick={onApply}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#E8872A] px-3 text-xs font-bold text-white shadow-2xs transition hover:bg-[#d4761d] disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5 shrink-0" />
                  {applying ? 'Đang gửi...' : 'Ứng tuyển'}
                </button>
              )}
              <Link
                href={jobPublicPath(job)}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span>Xem chi tiết</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </li>
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
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
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
                'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium',
                item === page
                  ? 'bg-brand-500 text-white'
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
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
