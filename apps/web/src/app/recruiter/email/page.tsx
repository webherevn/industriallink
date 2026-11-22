'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ExternalLink,
  History,
  Mail,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ApplicationStatus, formatJobTitle, JobStatus } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { BroadcastEmailForm } from '@/components/broadcast-email-modal';
import {
  listApplicants,
  listBroadcastEmailHistory,
  listMyJobs,
} from '@/lib/jobs';

const JOB_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: 'Đang tuyển', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  draft: { label: 'Nháp', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  paused: { label: 'Tạm dừng', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  closed: { label: 'Đã đóng', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

/** Khóa sessionStorage lưu danh sách applicationIds khi danh sách quá dài cho query. */
const STORAGE_KEY = 'inlink:broadcast:applicationIds';

export default function RecruiterBroadcastEmailPage() {
  const searchParams = useSearchParams();
  const [jobId, setJobId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [prefillIds, setPrefillIds] = useState<string[] | null>(null);

  // Tham số ngữ cảnh đến từ Hộp thư ứng viên / Kanban.
  const paramJobId = searchParams.get('jobId');
  const paramStage = searchParams.get('stage');
  const paramReturnUrl = searchParams.get('returnUrl');
  const paramApplicationIds = searchParams.get('applicationIds');
  const paramApplicationIdsCount = searchParams.get('applicationIdsCount');

  const { data: jobs, isLoading: loadingJobs } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
  });

  // Đọc danh sách applicationIds: ưu tiên sessionStorage (danh sách dài), fallback query param.
  useEffect(() => {
    if (!paramApplicationIds) {
      setPrefillIds(null);
      return;
    }
    let ids: string[] = [];
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          ids = parsed.filter((v): v is string => typeof v === 'string');
        }
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      ids = [];
    }
    if (ids.length === 0 && paramApplicationIds) {
      ids = paramApplicationIds
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    setPrefillIds(ids.length > 0 ? ids : null);
  }, [paramApplicationIds]);

  // Chọn sẵn tin tuyển dụng theo ngữ cảnh, fallback tin đang tuyển đầu tiên.
  useEffect(() => {
    if (paramJobId) {
      setJobId(paramJobId);
      return;
    }
    if (!jobId && jobs && jobs.length > 0) {
      const firstPublished =
        jobs.find((j) => j.status === JobStatus.Published) ?? jobs[0];
      if (firstPublished) {
        setJobId(firstPublished.id);
      }
    }
  }, [jobId, jobs, paramJobId]);

  // Chọn sẵn bước quy trình theo ngữ cảnh.
  useEffect(() => {
    if (paramStage) setStageFilter(paramStage);
  }, [paramStage]);

  const { data: applicants, isLoading: loadingApplicants } = useQuery({
    queryKey: ['applicants', jobId],
    queryFn: () => listApplicants(jobId),
    enabled: Boolean(jobId),
  });

  const { data: history } = useQuery({
    queryKey: ['broadcast-email-history', jobId],
    queryFn: () => listBroadcastEmailHistory(jobId),
    enabled: Boolean(jobId),
  });

  const selectedJob = useMemo(
    () => jobs?.find((job) => job.id === jobId) ?? null,
    [jobs, jobId],
  );

  /**
   * Kiểm tra điều kiện gửi hợp lệ TRƯỚC khi gửi:
   * - Ứng viên phải có email hợp lệ.
   * - Ứng viên phải thuộc quyền liên hệ (tự ứng tuyển hoặc đã mở khóa bằng Credit).
   * Ứng viên bị lọc bỏ sẽ được cảnh báo rõ ràng.
   */
  const eligibility = useMemo(() => {
    const list = applicants ?? [];
    const valid = list.filter(
      (a) => a.canContact !== false && Boolean(a.email && a.email.includes('@')),
    );
    const missingEmail = list.filter((a) => !a.email || !a.email.includes('@'));
    const locked = list.filter((a) => a.canContact === false);
    return { valid, missingEmail, locked, all: list };
  }, [applicants]);

  /**
   * Danh sách ứng viên đưa vào form:
   * - Nếu có applicationIds từ Hộp thư → chỉ chọn đúng những hồ sơ đó.
   * - Nếu chỉ có jobId/stage → lọc theo bước quy trình đang chọn.
   */
  const formApplicants = useMemo(() => {
    const list = eligibility.valid;
    if (prefillIds && prefillIds.length > 0) {
      const wanted = new Set(prefillIds);
      return list.filter((a) => wanted.has(a.applicationId));
    }
    if (stageFilter && stageFilter !== 'all') {
      const filtered = list.filter((a) => a.status === stageFilter);
      if (filtered.length > 0) return filtered;
    }
    return list;
  }, [eligibility.valid, prefillIds, stageFilter]);

  /** Cảnh báo các ứng viên bị bỏ qua trước khi gửi. */
  const skipWarning = useMemo(() => {
    const parts: string[] = [];
    const missing = eligibility.missingEmail.length;
    const locked = eligibility.locked.length;
    if (missing > 0) {
      parts.push(
        `Đã bỏ qua ${missing} ứng viên chưa cập nhật địa chỉ email`,
      );
    }
    if (locked > 0) {
      parts.push(
        `Đã bỏ qua ${locked} ứng viên chưa mở khóa hồ sơ (cần dùng Credit để mở khóa)`,
      );
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [eligibility.missingEmail.length, eligibility.locked.length]);

  useEffect(() => {
    if (skipWarning) setWarning(skipWarning);
  }, [skipWarning]);

  const stats = useMemo(() => {
    const list = eligibility.all;
    const total = list.length;
    const applied = list.filter((a) => a.status === ApplicationStatus.Applied).length;
    const inProgress = list.filter(
      (a) =>
        a.status === ApplicationStatus.Screening ||
        a.status === ApplicationStatus.Interview ||
        a.status === ApplicationStatus.Offer,
    ).length;
    const highMatch = list.filter((a) => {
      if (a.matchScore == null) return false;
      return a.matchScore >= 70;
    }).length;
    return { total, applied, inProgress, highMatch };
  }, [eligibility.all]);

  const statusInfo = selectedJob
    ? (JOB_STATUS_BADGE[selectedJob.status] ?? {
        label: selectedJob.status,
        className: 'bg-slate-100 text-slate-600 ring-slate-200',
      })
    : null;

  const backHref =
    paramReturnUrl &&
    paramReturnUrl.startsWith('/') &&
    !paramReturnUrl.startsWith('//') &&
    !paramReturnUrl.includes('\\')
      ? paramReturnUrl
      : '/recruiter/inbox';

  return (
    <AppShell>
      <div className="w-full space-y-5 pb-10">
        {/* Banner đầu trang đồng bộ chuẩn inLink */}
        <header className="brand-hero-surface relative overflow-hidden rounded-3xl px-5 py-6 sm:px-7">
          <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#E8872A] via-amber-200 to-transparent" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/90 transition hover:bg-white/20"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Quay lại
                </Link>
                <span className="text-white/40">/</span>
                <span>Chăm sóc & Phản hồi ứng viên</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Gửi email hàng loạt
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/80">
                Chọn chiến dịch tuyển dụng, lọc ứng viên theo trạng thái hoặc độ phù hợp AI và gửi thông báo cá nhân hóa.
              </p>
            </div>

            {selectedJob ? (
              <Link
                href={`/jobs/${selectedJob.id}/applicants`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25"
              >
                <span>Quản lý hồ sơ vị trí này</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </header>

        {/* Thanh chọn Tin tuyển dụng + Thống kê nhanh ứng viên của tin */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Chiến dịch / Tin tuyển dụng đang chọn
                </label>
                {selectedJob && statusInfo ? (
                  <span
                    className={clsx(
                      'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1',
                      statusInfo.className,
                    )}
                  >
                    {statusInfo.label}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="relative min-w-0 flex-1">
                  <select
                    value={jobId}
                    disabled={loadingJobs}
                    onChange={(e) => {
                      setJobId(e.target.value);
                      setNotice(null);
                      setWarning(null);
                    }}
                    className="h-10 w-full truncate rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm font-semibold text-[#072348] shadow-2xs transition hover:border-[#0B468C]/40 focus:border-[#0B468C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B468C]/15"
                  >
                    <option value="">
                      {loadingJobs ? 'Đang tải danh sách tin...' : '— Chọn tin tuyển dụng —'}
                    </option>
                    {(jobs ?? []).map((job) => (
                      <option key={job.id} value={job.id}>
                        {formatJobTitle(job.title)} · {job.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bước quy trình — chọn sẵn theo ngữ cảnh từ Hộp thư / Kanban */}
              {paramStage && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Bước quy trình
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-[#0B468C] ring-1 ring-sky-200">
                    {paramStage}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStageFilter('all')}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                  >
                    Bỏ lọc bước
                  </button>
                </div>
              )}

              {/* Danh sách ứng viên được chọn sẵn từ Hộp thư */}
              {prefillIds && prefillIds.length > 0 && (
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <Users className="h-3.5 w-3.5" />
                  Đã chọn sẵn {formApplicants.length} ứng viên từ Hộp thư
                  {paramApplicationIdsCount &&
                    Number(paramApplicationIdsCount) !== prefillIds.length
                    ? ` (${paramApplicationIdsCount} ứng viên được chọn)`
                    : ''}
                </p>
              )}
            </div>

            {/* 4 Thẻ tóm tắt nhanh ứng viên của tin */}
            {jobId ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-slate-500">Tổng ứng viên</p>
                  <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[#E8872A]">
                    {stats.total}
                  </p>
                </div>
                <div className="rounded-xl border border-sky-200/70 bg-sky-50/50 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-[#0B468C]">Mới ứng tuyển</p>
                  <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[#E8872A]">
                    {stats.applied}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-emerald-700">Đang xử lý</p>
                  <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[#E8872A]">
                    {stats.inProgress}
                  </p>
                </div>
                <div className="rounded-xl border border-[#FFD0A3] bg-[#FFF8F1] px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-[#C25E12]">Khớp AI ≥ 70%</p>
                  <p className="mt-1 text-xl font-bold tabular-nums leading-none text-[#E8872A]">
                    {stats.highMatch}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Cảnh báo ứng viên bị bỏ qua */}
        {warning && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-900 shadow-2xs">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <span>{warning}</span>
          </div>
        )}

        {/* Thông báo kết quả gửi email */}
        {notice && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-900 shadow-2xs">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}

        {jobId && loadingApplicants ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Đang tải danh sách ứng viên của vị trí tuyển dụng...
          </div>
        ) : null}

        {!loadingJobs && (jobs ?? []).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 text-base font-bold text-slate-800">
              Bạn chưa có tin tuyển dụng nào
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Hãy tạo tin tuyển dụng trước để nhận hồ sơ và gửi email hàng loạt cho ứng viên.
            </p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Đăng tin tuyển dụng mới →
            </Link>
          </div>
        ) : null}

        {/* Khung Soạn & Gửi Email Hàng Loạt */}
        {jobId && applicants ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
            <BroadcastEmailForm
              key={`${jobId}:${stageFilter}:${prefillIds?.join(',') ?? ''}`}
              jobId={jobId}
              jobTitle={selectedJob?.title}
              companyName={selectedJob?.companyName}
              applicants={formApplicants}
              initialStatusFilter={stageFilter}
              onSent={(result) => {
                setNotice(
                  `Đã gửi thành công ${result.sent}/${result.recipients} email tới ứng viên` +
                    (result.failed ? ` (${result.failed} hồ sơ thiếu hoặc lỗi email)` : '.'),
                );
                const skipped = (result.skippedMissingEmail ?? 0) + (result.skippedByPaywall ?? 0);
                if (skipped > 0) {
                  setWarning(
                    `Đã bỏ qua ${result.skippedMissingEmail ?? 0} ứng viên chưa cập nhật địa chỉ email` +
                      (result.skippedByPaywall
                        ? ` và ${result.skippedByPaywall} ứng viên chưa mở khóa hồ sơ`
                        : ''),
                  );
                }
              }}
            />
          </div>
        ) : null}

        {/* Khối Lịch sử gửi Email hàng loạt gần đây của tin */}
        {jobId && history && history.length > 0 ? (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <History className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-brand-800">
                    Lịch sử gửi email của vị trí này
                  </h2>
                  <p className="text-xs text-slate-500">
                    Các đợt gửi thông báo hàng loạt gần đây đã được ghi nhận trên hồ sơ ứng viên.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {history.length} đợt gửi gần nhất
              </span>
            </div>

            <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-2">
              <table className="min-w-full text-left text-xs sm:text-sm">
                <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Thời gian gửi</th>
                    <th className="py-2 px-3">Tiêu đề thư</th>
                    <th className="py-2 px-3">Ứng viên nhận</th>
                    <th className="py-2 pl-3 text-right">Số lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {new Date(batch.sentAt).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-brand-800">
                        {batch.subject}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">
                        {batch.recipientNames.join(', ')}
                        {batch.recipientsCount > batch.recipientNames.length
                          ? ` (+${batch.recipientsCount - batch.recipientNames.length} người khác)`
                          : ''}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-3 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                          <Mail className="h-3 w-3" />
                          {batch.recipientsCount} thư
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
