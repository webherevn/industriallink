'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Mail,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
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

export default function RecruiterBroadcastEmailPage() {
  const [jobId, setJobId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const { data: jobs, isLoading: loadingJobs } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
  });

  // Tự động chọn tin tuyển dụng đang mở đầu tiên ngay khi tải xong danh sách tin
  useEffect(() => {
    if (!jobId && jobs && jobs.length > 0) {
      const firstPublished =
        jobs.find((j) => j.status === JobStatus.Published) ?? jobs[0];
      if (firstPublished) {
        setJobId(firstPublished.id);
      }
    }
  }, [jobId, jobs]);

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

  const stats = useMemo(() => {
    const list = applicants ?? [];
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
  }, [applicants]);

  const statusInfo = selectedJob
    ? (JOB_STATUS_BADGE[selectedJob.status] ?? {
        label: selectedJob.status,
        className: 'bg-slate-100 text-slate-600 ring-slate-200',
      })
    : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header & Bộ chọn chiến dịch tuyển dụng */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
              Chăm sóc & Phản hồi ứng viên
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-800">
              Gửi email hàng loạt
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Chọn chiến dịch tuyển dụng, lọc ứng viên theo trạng thái hoặc độ phù hợp AI và gửi thông báo cá nhân hóa.
            </p>
          </div>

          {selectedJob ? (
            <Link
              href={`/jobs/${selectedJob.id}/applicants`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-brand-700 shadow-xs ring-1 ring-slate-200 transition hover:bg-brand-50"
            >
              <span>Quản lý hồ sơ vị trí này</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </header>

        {/* Thanh chọn Tin tuyển dụng + Thống kê nhanh ứng viên của tin */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                Chiến dịch / Tin tuyển dụng đang chọn
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[280px] flex-1">
                  <select
                    value={jobId}
                    disabled={loadingJobs}
                    onChange={(e) => {
                      setJobId(e.target.value);
                      setNotice(null);
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm font-semibold text-brand-800 shadow-2xs transition hover:border-brand-300 focus:border-brand-500 focus:bg-white focus:outline-none"
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

                {selectedJob && statusInfo ? (
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                      statusInfo.className,
                    )}
                  >
                    {statusInfo.label}
                  </span>
                ) : null}
              </div>
            </div>

            {/* 4 Thẻ tóm tắt nhanh ứng viên của tin */}
            {jobId ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                  <p className="text-[11px] font-medium text-slate-500">Tổng ứng viên</p>
                  <p className="mt-0.5 text-lg font-bold text-brand-800">{stats.total}</p>
                </div>
                <div className="rounded-xl bg-brand-50/60 px-3 py-2 ring-1 ring-brand-200/60">
                  <p className="text-[11px] font-medium text-brand-700">Mới ứng tuyển</p>
                  <p className="mt-0.5 text-lg font-bold text-brand-800">{stats.applied}</p>
                </div>
                <div className="rounded-xl bg-sky-50/70 px-3 py-2 ring-1 ring-sky-200/70">
                  <p className="text-[11px] font-medium text-sky-700">Đang xử lý</p>
                  <p className="mt-0.5 text-lg font-bold text-sky-900">{stats.inProgress}</p>
                </div>
                <div className="rounded-xl bg-amber-50/70 px-3 py-2 ring-1 ring-amber-200/80">
                  <p className="text-[11px] font-medium text-amber-800">Khớp AI ≥70%</p>
                  <p className="mt-0.5 text-lg font-bold text-[#E8872A]">{stats.highMatch}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

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
              key={jobId}
              jobId={jobId}
              jobTitle={selectedJob?.title}
              companyName={selectedJob?.companyName}
              applicants={applicants}
              onSent={(result) => {
                setNotice(
                  `Đã gửi thành công ${result.sent}/${result.recipients} email tới ứng viên` +
                    (result.failed ? ` (${result.failed} hồ sơ thiếu hoặc lỗi email)` : '.'),
                );
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
