'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bookmark,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ExperienceBand,
  SkillLevel,
  trackOfLevel,
  JOB_TRACK_LABEL,
  isJobLevelCode,
  type CandidateView,
  type JobMatchView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CopilotRobot } from '@/components/copilot-robot';
import { fetchMe, logout } from '@/lib/auth';
import { myApplications } from '@/lib/applications';
import { getMyCandidate } from '@/lib/candidate';
import {
  EXPERIENCE_LABEL,
  formatJobLevel,
  formatSalary,
} from '@/lib/format';
import {
  addJobBookmark,
  listBookmarkedJobs,
  removeJobBookmark,
} from '@/lib/jobs';
import { recommendedJobs } from '@/lib/matching';
import { useRouter } from 'next/navigation';

type FilterTab = 'all' | 'high' | 'medium' | 'new';

const PAGE_SIZE = 5;
const HIGH_MATCH = 80;
const MEDIUM_MATCH = 55;

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
  if (score >= HIGH_MATCH) return { text: 'Phù hợp cao', tone: 'high' };
  if (score >= MEDIUM_MATCH) return { text: 'Phù hợp trung bình', tone: 'medium' };
  return { text: 'Gợi ý thêm', tone: 'low' };
}

function matchRingLabel(score: number): string {
  if (score >= 90) return 'Rất phù hợp';
  if (score >= HIGH_MATCH) return 'Phù hợp cao';
  if (score >= MEDIUM_MATCH) return 'Phù hợp';
  return 'Cân nhắc';
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

export default function RecommendedPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('all');
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

  const filtered = useMemo(() => {
    switch (filter) {
      case 'high':
        return highJobs;
      case 'medium':
        return mediumJobs;
      case 'new':
        return newJobs;
      default:
        return allJobs;
    }
  }, [filter, allJobs, highJobs, mediumJobs, newJobs]);

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

  const navMain = [
    { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/dashboard', label: 'Hồ sơ của tôi', icon: UserRound },
    { href: '/jobs?tab=applied', label: 'Việc đã ứng tuyển', icon: Send },
    { href: '/jobs?tab=saved', label: 'Việc đã lưu', icon: Bookmark },
    { href: '/recommended', label: 'Gợi ý việc làm AI', icon: Sparkles, active: true, badge: 'NEW' },
    { href: '/applications', label: 'Theo dõi đơn', icon: Eye },
    { href: '/progress', label: 'Tiến trình', icon: Target },
  ];

  const navTools = [
    { href: '/dashboard', label: 'Lộ trình & lương' },
    { href: '/upload', label: 'Phân tích CV AI' },
    { href: '/search', label: 'Tìm kiếm AI' },
  ];

  const navSettings = [
    { href: '/account', label: 'Thông tin tài khoản' },
    { href: '/account', label: 'Bảo mật & MFA' },
  ];

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        {/* Left sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-amber-400 text-sm font-bold text-white">
                {(candidate?.displayName ?? me?.displayName ?? 'U')
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {candidate?.displayName ?? me?.displayName ?? 'Ứng viên'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {candidate?.profile?.currentPosition ?? 'Chưa cập nhật vị trí'}
                </p>
              </div>
            </div>
            {typeof candidate?.profileCompletion === 'number' && (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Hồ sơ đầy đủ</span>
                  <span className="font-semibold text-slate-700">
                    {candidate.profileCompletion}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${candidate.profileCompletion}%` }}
                  />
                </div>
              </div>
            )}

            <nav className="mt-5 space-y-0.5">
              {navMain.map((item) => (
                <Link
                  key={item.label + item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
                    item.active
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            <p className="mb-1.5 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Công cụ
            </p>
            <nav className="space-y-0.5">
              {navTools.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block rounded-lg px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <p className="mb-1.5 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Cài đặt
            </p>
            <nav className="space-y-0.5">
              {navSettings.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block rounded-lg px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={onLogout}
              className="mt-4 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </aside>

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

          {/* AI banner — robot trang trí absolute, không chiếm cột layout */}
          <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#072348] via-[#0B3A6E] to-[#1e4a7a] px-4 py-5 text-white sm:px-6 sm:py-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 18% 45%, rgba(245,158,11,0.28), transparent 42%), radial-gradient(circle at 88% 20%, rgba(255,255,255,0.1), transparent 35%), linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.05) 41%, transparent 42%)',
              }}
            />
            <div className="pointer-events-none absolute -bottom-1 -right-1 hidden opacity-90 sm:block md:-right-2 md:bottom-0">
              <CopilotRobot className="h-20 w-auto drop-shadow-xl md:h-24 xl:h-28" />
            </div>

            <div className="relative z-10 flex flex-col gap-4 pr-0 sm:pr-24 md:pr-28 xl:flex-row xl:items-center xl:gap-8 xl:pr-32">
              <div className="shrink-0">
                <p className="text-xs font-medium text-amber-200/90">Độ phù hợp trung bình</p>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                    {allJobs.length ? `${avgScore}%` : '—'}
                  </span>
                  {allJobs.length > 0 && (
                    <span className="mb-1.5 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/40">
                      {avgScoreLabel(avgScore)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-sky-100/80">
                  Từ {allJobs.length} tin AI đã phân tích
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-relaxed sm:text-[15px]">
                  AI đánh giá bạn phù hợp nhất với nhóm{' '}
                  <span className="font-bold text-amber-200">{fitGroup}</span>
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-sky-100/80">
                  Dựa trên {matchedSkillCount || candidate?.skills?.length || 0} kỹ năng nổi bật
                  {candidate?.aiProfile?.strengths?.length
                    ? ` và ${candidate.aiProfile.strengths.length} điểm mạnh AI`
                    : ''}
                  .
                </p>
                <Link
                  href="/dashboard"
                  className="mt-3 inline-flex max-w-full items-center whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-700 shadow-sm hover:bg-amber-50"
                >
                  Xem phân tích chi tiết →
                </Link>
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
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600"
            >
              <Settings2 className="h-3.5 w-3.5" /> Tùy chỉnh gợi ý
            </Link>
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
                busy={bookmarkMutation.isPending}
                onToggleBookmark={() =>
                  bookmarkMutation.mutate({
                    id: job.jobId,
                    saved: bookmarkedIds.has(job.jobId),
                  })
                }
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
              <Link href="/dashboard" className="text-[11px] font-medium text-amber-600 hover:underline">
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

function MatchJobCard({
  job,
  saved,
  busy,
  onToggleBookmark,
}: {
  job: JobMatchView;
  saved: boolean;
  busy: boolean;
  onToggleBookmark: () => void;
}) {
  const label = matchLabel(job.match.score);

  return (
    <li>
      <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md">
        <div className="flex gap-3.5">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm font-bold text-slate-500">
            {companyInitials(job.companyName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'rounded px-2 py-0.5 text-[11px] font-semibold',
                  label.tone === 'high' && 'bg-emerald-50 text-emerald-700',
                  label.tone === 'medium' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
                  label.tone === 'low' && 'bg-slate-100 text-slate-600',
                )}
              >
                {label.text}
              </span>
              {isNewJob(job.publishedAt) && (
                <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  Mới
                </span>
              )}
              <span className="text-[11px] text-slate-400">
                {formatRelativeTime(job.publishedAt)}
              </span>
            </div>

            <div className="mt-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/jobs/${job.jobId}`}
                  className="text-[15px] font-semibold text-slate-900 hover:text-brand-500"
                >
                  {job.title}
                </Link>
                <p className="mt-0.5 text-sm text-slate-500">
                  {job.companyId ? (
                    <Link
                      href={`/companies/${job.companyId}`}
                      className="hover:text-amber-700 hover:underline"
                    >
                      {job.companyName}
                    </Link>
                  ) : (
                    job.companyName
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                aria-label={saved ? 'Bỏ lưu' : 'Lưu tin'}
                onClick={onToggleBookmark}
                className={clsx(
                  'rounded-md p-1',
                  saved ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500',
                )}
              >
                <Bookmark className={clsx('h-4 w-4', saved && 'fill-current')} />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {job.location ?? 'Linh hoạt'}
              </span>
              <span>{formatSalary(job.salaryMin, job.salaryMax)}</span>
              <span>
                {job.experienceBand
                  ? EXPERIENCE_LABEL[job.experienceBand as ExperienceBand] ?? job.experienceBand
                  : 'Không yêu cầu'}
              </span>
              {job.jobLevel && <span>{formatJobLevel(job.jobLevel)}</span>}
            </div>

            {(job.skills?.length ?? 0) > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(job.skills ?? []).slice(0, 5).map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {job.match.reason && (
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{job.match.reason}</p>
            )}
          </div>

          {/* Match ring — điểm nhấn cam ILink */}
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <div className="relative flex h-[72px] w-[72px] items-center justify-center">
              <div
                className="pointer-events-none absolute inset-0 rounded-full bg-amber-400/25 blur-[10px]"
                aria-hidden
              />
              <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-amber-50 to-white p-0.5 shadow-sm ring-1 ring-amber-200/80">
                <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="none"
                    stroke="#fde68a"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="none"
                    stroke={
                      job.match.score >= HIGH_MATCH
                        ? '#f59e0b'
                        : job.match.score >= MEDIUM_MATCH
                          ? '#fbbf24'
                          : '#d97706'
                    }
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(job.match.score / 100) * (2 * Math.PI * 26)} ${2 * Math.PI * 26}`}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[15px] font-extrabold leading-none tracking-tight text-amber-600">
                    {job.match.score}
                    <span className="text-[10px] font-bold">%</span>
                  </span>
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[10px] font-semibold text-amber-700">
              {matchRingLabel(job.match.score)}
            </p>
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
