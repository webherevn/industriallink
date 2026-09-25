'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bookmark,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Factory,
  Layers,
  MapPin,
  Share2,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExperienceBand, JobStatus, looksLikeUuid } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { ApiError } from '@/lib/api';
import {
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  formatJobLevel,
  formatSalary,
} from '@/lib/format';
import {
  addJobBookmark,
  applyToJob,
  getJob,
  listBookmarkedJobs,
  listPublishedJobs,
  removeJobBookmark,
} from '@/lib/jobs';
import { companyPublicPath, jobListingPath, jobPublicPath } from '@/lib/public-paths';

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string | null): string | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const diff = Math.ceil((end - Date.now()) / 86_400_000);
  if (diff < 0) return 'Đã hết hạn';
  if (diff === 0) return 'Hết hạn hôm nay';
  if (diff === 1) return 'Còn 1 ngày';
  return `Còn ${diff} ngày`;
}

function experienceLabel(band: string | null): string {
  if (!band) return 'Không yêu cầu';
  return EXPERIENCE_LABEL[band as ExperienceBand] ?? band;
}

function splitLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export function JobDetailClient({
  initialJob,
  jobRef,
}: {
  initialJob?: import('@industriallink/contracts').JobView | null;
  jobRef: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [coverLetter, setCoverLetter] = useState('');
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobRef],
    queryFn: () => getJob(jobRef),
    retry: false,
    initialData: initialJob ?? undefined,
  });

  const { data: bookmarks } = useQuery({
    queryKey: ['job-bookmarks'],
    queryFn: listBookmarkedJobs,
    retry: false,
  });

  const { data: relatedJobs } = useQuery({
    queryKey: ['related-jobs', job?.companyId],
    queryFn: () => listPublishedJobs({ keyword: job?.companyName ?? undefined }),
    enabled: Boolean(job?.companyId),
    retry: false,
  });

  useEffect(() => {
    if (!job?.slug) return;
    if (looksLikeUuid(jobRef) && job.slug !== jobRef) {
      router.replace(jobPublicPath(job));
    }
  }, [job, jobRef, router]);

  useEffect(() => {
    if (!bookmarks || !job) return;
    setBookmarked(bookmarks.some((b) => b.id === job.id));
  }, [bookmarks, job]);

  useEffect(() => {
    if (!shareHint) return;
    const t = window.setTimeout(() => setShareHint(null), 2000);
    return () => window.clearTimeout(t);
  }, [shareHint]);

  const applyMutation = useMutation({
    mutationFn: () => applyToJob(job!.id, { coverLetter: coverLetter || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job', jobRef] }),
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      const id = job!.id;
      if (bookmarked) {
        await removeJobBookmark(id);
        return false;
      }
      await addJobBookmark(id);
      return true;
    },
    onSuccess: (next) => {
      setBookmarked(next);
      queryClient.invalidateQueries({ queryKey: ['job-bookmarks'] });
    },
  });

  const related = useMemo(() => {
    if (!job || !relatedJobs) return [];
    return relatedJobs
      .filter((j) => j.companyId === job.companyId && j.id !== job.id)
      .slice(0, 4);
  }, [job, relatedJobs]);

  if (isLoading) {
    return (
      <AppShell wide allowGuest>
        <div className="animate-pulse space-y-4 py-8">
          <div className="h-8 w-2/3 rounded-lg bg-slate-200" />
          <div className="h-40 rounded-2xl bg-slate-100" />
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell wide allowGuest>
        <div className="job-detail-card mx-auto max-w-lg p-10 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            Không tìm thấy tin tuyển dụng.
          </p>
          <Link
            href={jobListingPath()}
            className="mt-4 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Quay lại tìm việc
          </Link>
        </div>
      </AppShell>
    );
  }

  const applied = job.hasApplied || applyMutation.isSuccess;
  const deadlineHint = daysUntil(job.deadline);
  const reqLines = splitLines(job.requirements);
  const benefitLines = splitLines(job.benefits);
  const descLines = splitLines(job.description);
  const useDescBullets = descLines.length > 1 && job.description.includes('\n');
  const jobTitle = job.title;
  const companyName = job.companyName;
  const jobCode = job.code;

  async function onShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: jobTitle, text: companyName, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareHint('Đã sao chép liên kết');
      }
    } catch {
      setShareHint('Không chia sẻ được');
    }
  }

  async function onCopyCode() {
    try {
      await navigator.clipboard.writeText(jobCode);
      setShareHint('Đã sao chép mã tin');
    } catch {
      setShareHint('Không sao chép được');
    }
  }

  const infoRows = [
    { label: 'Mã tin', value: job.code },
    { label: 'Ngành', value: job.industry },
    { label: 'Ngành chi tiết', value: job.subIndustry },
    { label: 'Phòng ban', value: job.department },
    {
      label: 'Loại hình',
      value: job.employmentType ? EMPLOYMENT_LABEL[job.employmentType] : null,
    },
    { label: 'Cấp bậc', value: job.jobLevel ? formatJobLevel(job.jobLevel) : null },
    { label: 'Kinh nghiệm', value: experienceLabel(job.experienceBand) },
    { label: 'Số lượng', value: job.headcount != null ? `${job.headcount} người` : null },
    { label: 'Hạn nộp', value: job.deadline ? formatDate(job.deadline) : null },
    { label: 'Ngày đăng', value: formatDate(job.createdAt) },
  ].filter((r) => r.value);

  const showApplyCta =
    job.status === JobStatus.Published && !applied;

  return (
    <AppShell wide allowGuest>
      <div className="min-w-0 overflow-x-hidden pb-24 lg:pb-12">
        {/* Breadcrumb */}
        <nav className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-slate-400">
          <Link href={jobListingPath()} className="shrink-0 transition hover:text-amber-700">
            Việc làm
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Link
            href={companyPublicPath(job)}
            className="min-w-0 truncate transition hover:text-amber-700"
          >
            {job.companyName}
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate font-medium text-slate-600">{job.title}</span>
        </nav>

        {/* Hero */}
        <header className="job-detail-card mt-3 overflow-hidden p-0 sm:mt-4">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-brand-500" />
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white text-sm font-extrabold text-amber-700 shadow-sm sm:h-16 sm:w-16 sm:text-lg">
                  {companyInitials(job.companyName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <h1 className="break-words text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {job.title}
                    </h1>
                    {job.status === JobStatus.Published && (
                      <span className="w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                        Đang tuyển
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-col gap-1.5 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5">
                    <Link
                      href={companyPublicPath(job)}
                      className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-slate-700 transition hover:text-amber-700"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="break-words">{job.companyName}</span>
                    </Link>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {job.location ?? 'Linh hoạt'}
                    </span>
                    <button
                      type="button"
                      onClick={onCopyCode}
                      className="inline-flex w-fit items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-amber-50 hover:text-amber-700"
                      title="Sao chép mã tin"
                    >
                      <Copy className="h-3 w-3" />
                      {job.code}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {job.employmentType && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {EMPLOYMENT_LABEL[job.employmentType]}
                      </span>
                    )}
                    {job.jobLevel && (
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
                        {formatJobLevel(job.jobLevel)}
                      </span>
                    )}
                    {job.industry && (
                      <span className="max-w-full break-words rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                        {job.industry}
                      </span>
                    )}
                    {job.department && (
                      <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100">
                        {job.department}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap lg:flex-col lg:items-stretch">
                <button
                  type="button"
                  onClick={() => bookmarkMutation.mutate()}
                  disabled={bookmarkMutation.isPending}
                  className={clsx(
                    'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] sm:px-4',
                    bookmarked
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/60 hover:text-amber-800',
                  )}
                >
                  <Bookmark
                    className={clsx('h-4 w-4', bookmarked && 'fill-amber-500 text-amber-500')}
                  />
                  {bookmarked ? 'Đã lưu' : 'Lưu tin'}
                </button>
                <button
                  type="button"
                  onClick={onShare}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/50 active:scale-[0.98] sm:px-4"
                >
                  <Share2 className="h-4 w-4" />
                  Chia sẻ
                </button>
                {shareHint && (
                  <p className="col-span-2 text-center text-[11px] font-medium text-emerald-600 lg:text-left">
                    {shareHint}
                  </p>
                )}
              </div>
            </div>

            {/* Quick facts */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4">
              <FactTile
                icon={<Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                label="Mức lương"
                value={formatSalary(job.salaryMin, job.salaryMax)}
                accent
              />
              <FactTile
                icon={<Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                label="Kinh nghiệm"
                value={experienceLabel(job.experienceBand)}
              />
              <FactTile
                icon={<Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                label="Số lượng"
                value={job.headcount != null ? `${job.headcount} vị trí` : 'Theo nhu cầu'}
              />
              <FactTile
                icon={<CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                label="Hạn nộp HS"
                value={job.deadline ? formatDate(job.deadline) : 'Đến khi tuyển đủ'}
                hint={deadlineHint}
              />
            </div>
          </div>
        </header>

        <div className="mt-4 grid min-w-0 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          {/* Sidebar — trên mobile hiện ngay sau hero để không lệch / phải cuộn quá dài */}
          <aside className="order-1 min-w-0 space-y-3 sm:space-y-4 lg:order-2 lg:sticky lg:top-20 lg:self-start">
            <div id="job-apply" className="job-detail-card overflow-hidden p-0 shadow-md scroll-mt-24">
              <div className="bg-gradient-to-br from-amber-50 via-white to-brand-50/40 px-4 py-3.5 sm:px-5 sm:py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Mức lương
                </p>
                <p className="mt-1 break-words text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  {formatSalary(job.salaryMin, job.salaryMax)}
                </p>
                {deadlineHint && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100">
                    <Clock3 className="h-3 w-3" />
                    {deadlineHint}
                  </p>
                )}
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                {job.status !== JobStatus.Published ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    Tin này chưa mở nhận hồ sơ.
                  </p>
                ) : applied ? (
                  <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-800 ring-1 ring-emerald-100">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="font-semibold">Bạn đã ứng tuyển vị trí này</p>
                      <Link
                        href="/applications"
                        className="mt-1 inline-block text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Xem đơn ứng tuyển →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600">
                        Thư giới thiệu{' '}
                        <span className="font-normal text-slate-400">(không bắt buộc)</span>
                      </span>
                      <textarea
                        rows={4}
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        placeholder="Giới thiệu ngắn về kinh nghiệm phù hợp với vị trí…"
                        className="mt-1.5 w-full max-w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 hover:border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                    {applyMutation.isError && (
                      <p className="break-words text-sm text-red-600">
                        {applyMutation.error instanceof ApiError
                          ? applyMutation.error.message
                          : 'Có lỗi xảy ra'}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => applyMutation.mutate()}
                      disabled={applyMutation.isPending}
                      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
                    >
                      {applyMutation.isPending ? 'Đang gửi…' : 'Ứng tuyển ngay'}
                    </button>
                    <p className="text-center text-[11px] leading-relaxed text-slate-400">
                      Hồ sơ inlink sẽ được gửi tới nhà tuyển dụng.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="job-detail-card p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-sm font-bold text-amber-700">
                  {companyInitials(job.companyName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{job.companyName}</p>
                  <p className="text-[11px] text-slate-500">Nhà tuyển dụng</p>
                </div>
              </div>
              <Link
                href={companyPublicPath(job)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                Xem thông tin công ty
              </Link>
            </div>

            <div className="rounded-2xl border border-dashed border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white p-4">
              <p className="text-sm font-bold text-slate-900">Mẹo ứng tuyển</p>
              <ul className="mt-2.5 space-y-2 text-[12px] leading-relaxed text-slate-600">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>Cập nhật hồ sơ và kỹ năng B2B trước khi nộp.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>Thư giới thiệu ngắn, nêu đúng kinh nghiệm khớp JD.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    Theo dõi tiến trình tại{' '}
                    <Link href="/progress" className="font-semibold text-amber-700 hover:underline">
                      Tiến trình
                    </Link>
                    .
                  </span>
                </li>
              </ul>
            </div>
          </aside>

          {/* Main content */}
          <div className="order-2 min-w-0 space-y-4 sm:space-y-5 lg:order-1">
            <ContentSection title="Mô tả công việc" icon={<Briefcase className="h-4 w-4" />}>
              {useDescBullets ? (
                <ul className="space-y-2">
                  {descLines.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="min-w-0 break-words whitespace-pre-wrap">{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="break-words whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {job.description}
                </p>
              )}
            </ContentSection>

            {(reqLines.length > 0 || job.requirements) && (
              <ContentSection title="Yêu cầu ứng viên" icon={<CheckCircle2 className="h-4 w-4" />}>
                {reqLines.length > 1 ? (
                  <ul className="space-y-2">
                    {reqLines.map((line) => (
                      <li
                        key={line}
                        className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <span className="min-w-0 break-words">{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="break-words whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {job.requirements}
                  </p>
                )}
              </ContentSection>
            )}

            {(benefitLines.length > 0 || job.benefits) && (
              <ContentSection title="Quyền lợi & phúc lợi" icon={<Wallet className="h-4 w-4" />}>
                {benefitLines.length > 1 ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {benefitLines.map((line) => (
                      <li
                        key={line}
                        className="flex min-w-0 gap-2 rounded-xl bg-amber-50/50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-amber-100/80"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span className="min-w-0 break-words">{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="break-words whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {job.benefits}
                  </p>
                )}
              </ContentSection>
            )}

            {job.skills.length > 0 && (
              <ContentSection title="Kỹ năng cần có" icon={<Factory className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((s) => (
                    <span
                      key={`${s.skillId ?? s.name}-${s.name}`}
                      className={clsx(
                        'inline-flex max-w-full items-center gap-1 break-words rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                        s.required
                          ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {s.name}
                      {s.required && (
                        <span className="shrink-0 text-[10px] font-bold uppercase text-amber-600">
                          Bắt buộc
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </ContentSection>
            )}

            <ContentSection title="Thông tin chung" icon={<Clock3 className="h-4 w-4" />}>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {infoRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex min-w-0 flex-col gap-0.5 border-b border-slate-100 pb-2.5 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:last:border-b"
                  >
                    <dt className="shrink-0 text-sm text-slate-400">{row.label}</dt>
                    <dd className="break-words text-sm font-semibold text-slate-800 sm:text-right">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </ContentSection>

            {related.length > 0 && (
              <ContentSection
                title="Việc khác từ công ty"
                icon={<Building2 className="h-4 w-4" />}
                action={
                  <Link
                    href={companyPublicPath(job)}
                    className="shrink-0 text-xs font-semibold text-amber-700 hover:underline"
                  >
                    Xem công ty
                  </Link>
                }
              >
                <ul className="divide-y divide-slate-100">
                  {related.map((j) => (
                    <li key={j.id}>
                      <Link
                        href={jobPublicPath(j)}
                        className="group flex min-w-0 items-start justify-between gap-3 rounded-xl px-1 py-3 transition hover:bg-amber-50/40"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-slate-900 group-hover:text-amber-800">
                            {j.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {[j.location, formatSalary(j.salaryMin, j.salaryMax)]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-amber-500" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </ContentSection>
            )}
          </div>
        </div>
      </div>

      {/* Sticky apply bar — mobile only */}
      {showApplyCta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-[1280px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">
                Mức lương
              </p>
              <p className="truncate text-sm font-bold text-slate-900">
                {formatSalary(job.salaryMin, job.salaryMax)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                document.getElementById('job-apply')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }}
              className="shrink-0 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
            >
              Ứng tuyển
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function FactTile({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string | null;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        'min-w-0 rounded-xl px-2.5 py-2.5 ring-1 sm:px-3 sm:py-3',
        accent
          ? 'bg-gradient-to-br from-amber-50 to-white ring-amber-200/80'
          : 'bg-slate-50/80 ring-slate-100',
      )}
    >
      <div
        className={clsx(
          'flex items-center gap-1 text-[10px] font-medium sm:gap-1.5 sm:text-[11px]',
          accent ? 'text-amber-700' : 'text-slate-500',
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p
        className={clsx(
          'mt-1 break-words text-[13px] font-bold leading-snug sm:text-sm',
          accent ? 'text-amber-900' : 'text-slate-800',
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 break-words text-[10px] font-medium text-amber-600">{hint}</p>
      )}
    </div>
  );
}

function ContentSection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="job-detail-card min-w-0 p-4 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-slate-100 pb-3 sm:mb-4 sm:items-center sm:gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-slate-900 sm:text-base">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100 sm:h-8 sm:w-8">
            {icon}
          </span>
          <span className="break-words">{title}</span>
        </h2>
        {action}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
