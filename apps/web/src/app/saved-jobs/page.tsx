'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bookmark,
  Briefcase,
  Check,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  MapPin,
  MoreHorizontal,
  Search,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { JobListItem, JobMatchView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { Select } from '@/components/ui';
import { myApplications } from '@/lib/applications';
import { ApiError } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { getMyCandidate } from '@/lib/candidate';
import { formatJobTitle, formatSalary } from '@/lib/format';
import { listingTier } from '@/lib/job-listing-board';
import { applyToJob, listBookmarkedJobs, removeJobBookmark } from '@/lib/jobs';
import { formatMatchPct } from '@/lib/match-percent';
import { recommendedJobs } from '@/lib/matching';
import { apiPublicBase, companyPublicPath, jobPublicPath } from '@/lib/public-paths';

type StatusTab = 'all' | 'unapplied' | 'applied';
type SortMode = 'recent' | 'match' | 'salary';

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

function salaryHigh(min: number | null, max: number | null): number {
  const values = [min, max].filter((n): n is number => n != null && n > 0);
  return values.length ? Math.max(...values) : -1;
}

export default function SavedJobsPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [tab, setTab] = useState<StatusTab>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<{
    jobId: string;
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ['job-bookmarks'],
    queryFn: listBookmarkedJobs,
    retry: false,
  });
  const { data: applications } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
  });
  const { data: matches } = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: recommendedJobs,
    retry: false,
  });

  const removeMutation = useMutation({
    mutationFn: (jobId: string) => removeJobBookmark(jobId),
    onMutate: async (jobId) => {
      await queryClient.cancelQueries({ queryKey: ['job-bookmarks'] });
      const prev = queryClient.getQueryData<JobListItem[]>(['job-bookmarks']);
      queryClient.setQueryData<JobListItem[]>(['job-bookmarks'], (cur) =>
        (cur ?? []).filter((j) => j.id !== jobId),
      );
      return { prev };
    },
    onError: (_err, _jobId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['job-bookmarks'], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['job-bookmarks'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (jobId: string) => applyToJob(jobId, {}),
    onSuccess: (_data, jobId) => {
      setApplyFeedback({ jobId, tone: 'ok', text: 'Đã gửi hồ sơ ứng tuyển thành công!' });
      void queryClient.invalidateQueries({ queryKey: ['my-applications'] });
    },
    onError: (err, jobId) => {
      setApplyFeedback({
        jobId,
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không gửi được hồ sơ ứng tuyển',
      });
    },
  });

  const savedJobs = useMemo(() => bookmarks ?? [], [bookmarks]);
  const appliedIds = useMemo(
    () => new Set((applications ?? []).map((a) => a.jobId)),
    [applications],
  );
  const matchByJobId = useMemo(() => {
    const map = new Map<string, JobMatchView>();
    for (const m of matches ?? []) map.set(m.jobId, m);
    return map;
  }, [matches]);

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const j of savedJobs) {
      if (j.industry?.trim()) set.add(j.industry.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [savedJobs]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const j of savedJobs) {
      if (j.location?.trim()) set.add(j.location.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [savedJobs]);

  const baseFiltered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return savedJobs.filter((j) => {
      if (
        kw &&
        !j.title.toLowerCase().includes(kw) &&
        !j.companyName.toLowerCase().includes(kw)
      ) {
        return false;
      }
      if (industryFilter && (j.industry?.trim() || '') !== industryFilter) {
        return false;
      }
      if (locationFilter && (j.location?.trim() || '') !== locationFilter) {
        return false;
      }
      return true;
    });
  }, [savedJobs, keyword, industryFilter, locationFilter]);

  const unappliedCount = useMemo(
    () => baseFiltered.filter((j) => !appliedIds.has(j.id)).length,
    [baseFiltered, appliedIds],
  );
  const appliedCount = useMemo(
    () => baseFiltered.filter((j) => appliedIds.has(j.id)).length,
    [baseFiltered, appliedIds],
  );

  const visibleJobs = useMemo(() => {
    const list = baseFiltered.filter((j) => {
      if (tab === 'applied') return appliedIds.has(j.id);
      if (tab === 'unapplied') return !appliedIds.has(j.id);
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === 'match') {
        const sa = matchByJobId.get(a.id)?.match.score ?? -1;
        const sb = matchByJobId.get(b.id)?.match.score ?? -1;
        return sb - sa;
      }
      if (sort === 'salary') {
        return salaryHigh(b.salaryMin, b.salaryMax) - salaryHigh(a.salaryMin, a.salaryMax);
      }
      return 0;
    });
  }, [baseFiltered, tab, sort, appliedIds, matchByJobId]);

  const displayName = (candidate?.displayName ?? me?.displayName ?? 'Ứng viên').replace(/\r/g, '');
  const topSuggestions = useMemo(
    () => [...(matches ?? [])].sort((a, b) => b.match.score - a.match.score).slice(0, 3),
    [matches],
  );

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <CandidateSidebar
          displayName={displayName}
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
          showProfileCard={false}
        />

        {/* Cột giữa: Danh sách việc làm đã lưu */}
        <section className="min-w-0 space-y-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#072348]">
              <Bookmark className="h-5 w-5 text-[#072348]" />
              <span>Việc làm đã lưu</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Danh sách việc làm bạn đã lưu để xem lại và ứng tuyển sau.
            </p>
          </div>

          {/* Thanh tìm kiếm & lọc */}
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Nhập vị trí, công ty..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-brand-500"
              />
            </div>

            <Select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="!h-10 !rounded-xl !border-slate-200 !text-xs !text-slate-700"
            >
              <option value="">Tất cả ngành nghề</option>
              {industryOptions.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </Select>

            <Select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="!h-10 !rounded-xl !border-slate-200 !text-xs !text-slate-700"
            >
              <option value="">Tất cả địa điểm</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>
          </div>

          {/* Tabs trạng thái & Sắp xếp */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
            <div className="flex items-center gap-5">
              {(
                [
                  { id: 'all', label: `Tất cả (${baseFiltered.length})` },
                  { id: 'unapplied', label: `Chưa ứng tuyển (${unappliedCount})` },
                  { id: 'applied', label: `Đã ứng tuyển (${appliedCount})` },
                ] as const
              ).map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      'relative pb-2.5 text-xs font-semibold transition sm:text-[13px]',
                      active ? 'text-[#072348]' : 'text-slate-500 hover:text-slate-800',
                    )}
                  >
                    {t.label}
                    {active && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#E8872A]" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 pb-2 text-xs text-slate-500">
              <span className="shrink-0">Sắp xếp:</span>
              <Select
                size="sm"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="!h-7 !min-w-[140px] !border-transparent !bg-transparent !px-2 !py-0 !text-xs !font-semibold !text-[#072348] !shadow-none hover:!bg-slate-100/70"
              >
                <option value="recent">Mới lưu nhất</option>
                <option value="match">Mức độ phù hợp</option>
                <option value="salary">Mức lương cao nhất</option>
              </Select>
            </div>
          </div>

          {/* Danh sách thẻ việc làm */}
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-white"
                />
              ))}
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2.5 text-sm font-semibold text-slate-700">
                {savedJobs.length === 0
                  ? 'Bạn chưa lưu việc làm nào.'
                  : 'Không tìm thấy việc làm phù hợp bộ lọc.'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Khám phá danh sách tin tuyển dụng công nghiệp và bấm biểu tượng lưu để theo dõi tại đây.
              </p>
              <Link
                href="/viec-lam"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3468]"
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>Tìm việc ngay</span>
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleJobs.map((job) => {
                const tier = listingTier(job.planCode);
                const match = matchByJobId.get(job.id);
                const isApplied = appliedIds.has(job.id);
                const menuOpen = openMenuId === job.id;
                const isApplying = applyMutation.isPending && applyMutation.variables === job.id;
                const fb = applyFeedback?.jobId === job.id ? applyFeedback : null;

                return (
                  <li
                    key={job.id}
                    className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-2xs transition hover:border-brand-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-[#072348]">
                          {job.companyHasLogo ? (
                            <img
                              src={`${apiPublicBase()}/companies/${job.companyId}/logo`}
                              alt={job.companyName}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            companyInitials(job.companyName)
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={jobPublicPath(job)}
                            className="line-clamp-1 text-[15px] font-bold text-[#072348] hover:text-brand-600"
                          >
                            {formatJobTitle(job.title)}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {job.companyId ? (
                              <Link
                                href={companyPublicPath(job)}
                                className="hover:text-brand-600 hover:underline"
                              >
                                {job.companyName}
                              </Link>
                            ) : (
                              job.companyName
                            )}
                          </p>

                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#b45309] ring-1 ring-amber-200/70">
                              {formatSalary(job.salaryMin, job.salaryMax)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {job.location ?? 'Linh hoạt'}
                            </span>
                            {match ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                                <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                                Phù hợp {formatMatchPct(match.match.score)}%
                              </span>
                            ) : null}
                            {isApplied ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Đã ứng tuyển
                              </span>
                            ) : null}
                          </div>

                          {fb ? (
                            <p
                              className={clsx(
                                'mt-2 text-[11.5px] font-medium',
                                fb.tone === 'ok' ? 'text-emerald-700' : 'text-rose-600',
                              )}
                            >
                              {fb.text}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* Cột phải: Badge gói + Bookmark + Menu ... */}
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {tier === 'spotlight' ? (
                          <span className="rounded-md bg-[#E8872A] px-2 py-0.5 text-[10.5px] font-bold text-white">
                            Nổi bật
                          </span>
                        ) : tier === 'paid' ? (
                          <span className="rounded-md bg-[#072348] px-2 py-0.5 text-[10.5px] font-bold text-white">
                            Ưu tiên
                          </span>
                        ) : null}

                        <div className="relative flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate(job.id)}
                            title="Bỏ lưu việc làm này"
                            aria-label="Bỏ lưu"
                            className="rounded-lg p-1.5 text-[#072348] transition hover:bg-slate-100"
                          >
                            <Bookmark className="h-4 w-4 fill-current" />
                          </button>

                          <button
                            type="button"
                            aria-label="Tác vụ"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((prev) => (prev === job.id ? null : job.id));
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {menuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                            >
                              {!isApplied && (
                                <button
                                  type="button"
                                  disabled={isApplying}
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    applyMutation.mutate(job.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#072348] hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <Send className="h-3.5 w-3.5 text-[#E8872A]" />
                                  <span>{isApplying ? 'Đang gửi...' : 'Ứng tuyển ngay'}</span>
                                </button>
                              )}
                              <Link
                                href={jobPublicPath(job)}
                                onClick={() => setOpenMenuId(null)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                <span>Xem chi tiết tin</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  removeMutation.mutate(job.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Bỏ lưu tin</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Cột phải: Gợi ý việc làm phù hợp + Mẹo tìm việc hiệu quả */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#072348] to-amber-500 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-[#072348]">Gợi ý việc làm phù hợp</p>
                <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#c96a12] ring-1 ring-amber-200/70">
                  Beta
                </span>
              </div>
            </div>

            {topSuggestions.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {topSuggestions.map((m) => (
                  <li key={m.jobId}>
                    <Link
                      href={jobPublicPath(m)}
                      className="block rounded-xl bg-slate-50 px-3 py-2.5 transition hover:bg-amber-50/70"
                    >
                      <p className="line-clamp-2 text-xs font-semibold text-[#072348]">
                        {formatJobTitle(m.title)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-[#c96a12]">
                        Phù hợp {formatMatchPct(m.match.score)}%
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Cập nhật hồ sơ để AI gợi ý các công việc phù hợp nhất.
              </p>
            )}

            <Link
              href="/recommended"
              className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#072348] text-xs font-bold text-white shadow-2xs transition hover:bg-[#0d3468]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Xem gợi ý AI</span>
            </Link>
          </div>

          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#072348]">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>Mẹo tìm việc hiệu quả</span>
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>Lưu các công việc phù hợp để so sánh</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>Ứng tuyển sớm để tăng cơ hội</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>Cập nhật CV và hồ sơ thường xuyên</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
