'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Info,
  Lock,
  Mail,
  MoreHorizontal,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApplicationStatus,
  JobStatus,
  type ApplicantView,
  formatJobTitle,
  formatJobTrack,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { BroadcastEmailModal } from '@/components/broadcast-email-modal';
import { Badge, Button, Card, Field, Textarea } from '@/components/ui';
import { KanbanBoard } from '@/components/kanban-board';
import { ScheduleInterviewModal } from '@/components/schedule-interview-modal';
import { SendOfferModal } from '@/components/send-offer-modal';
import { StartOnboardingModal } from '@/components/start-onboarding-modal';
import { updateApplicationStatus } from '@/lib/applications';
import {
  APPLICATION_STATUS_LABEL,
  PIPELINE_STEPS,
  relativeTime,
  toTitleCase,
} from '@/lib/format';
import { getJob, listApplicants, listMyJobs } from '@/lib/jobs';
import { candidatesForJob } from '@/lib/matching';
import { formatMatchPct, matchBadgeTone } from '@/lib/match-percent';

type Tab = 'pipeline' | 'suggested' | 'rejected';

type PendingMove = {
  id: string;
  status: ApplicationStatus;
  name: string;
};

/** Badge trạng thái thực của tin tuyển dụng — tránh nhầm với tin cũ đã đóng. */
const JOB_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  [JobStatus.Published]: {
    label: 'Đang tuyển',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  [JobStatus.Paused]: {
    label: 'Tạm dừng',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  [JobStatus.Closed]: {
    label: 'Đã đóng',
    className: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  [JobStatus.Draft]: {
    label: 'Nháp',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
};

/** Lý do từ chối ngắn gọn — dùng cho modal Từ chối. */
const REJECT_REASONS = [
  'Không đáp ứng yêu cầu kinh nghiệm',
  'Thiếu kỹ năng chuyên môn cần thiết',
  'Mức lương không phù hợp',
  'Hồ sơ không đủ thông tin',
  'Vị trí đã tuyển đủ',
  'Không liên hệ được ứng viên',
];

export default function ApplicantsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = params.id;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pipeline');
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState<PendingMove | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [scheduleFor, setScheduleFor] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [offerFor, setOfferFor] = useState<{ id: string; name: string } | null>(null);
  const [onboardFor, setOnboardFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [jobSwitchOpen, setJobSwitchOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const jobSwitchRef = useRef<HTMLDivElement>(null);

  const highlightCandidateId = searchParams.get('highlightCandidateId');

  useEffect(() => {
    if (!moreOpen) return;
    function handleOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [moreOpen]);

  useEffect(() => {
    if (!jobSwitchOpen) return;
    function handleOutside(e: MouseEvent) {
      if (jobSwitchRef.current && !jobSwitchRef.current.contains(e.target as Node)) {
        setJobSwitchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [jobSwitchOpen]);

  const applicantsKey = ['applicants', jobId] as const;

  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => getJob(jobId) });
  const { data: myJobs } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    retry: false,
  });
  const { data: applicants, isLoading: loadingApplicants } = useQuery({
    queryKey: applicantsKey,
    queryFn: () => listApplicants(jobId),
  });
  const { data: suggested, isLoading: loadingSuggested } = useQuery({
    queryKey: ['suggested', jobId],
    queryFn: () => candidatesForJob(jobId),
    enabled: tab === 'suggested',
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      note: moveNote,
    }: {
      id: string;
      status: ApplicationStatus;
      note?: string;
    }) => updateApplicationStatus(id, { status, note: moveNote || undefined }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKey });
      const previous = queryClient.getQueryData<ApplicantView[]>(applicantsKey);
      queryClient.setQueryData<ApplicantView[]>(applicantsKey, (old) =>
        (old ?? []).map((a) => (a.applicationId === id ? { ...a, status } : a)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(applicantsKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: applicantsKey }),
  });

  function requestMove(id: string, status: ApplicationStatus) {
    const card = applicants?.find((a) => a.applicationId === id);
    setPending({ id, status, name: card?.displayName ?? 'Ứng viên' });
    setNote('');
  }

  function confirmMove() {
    if (!pending) return;
    statusMutation.mutate({
      id: pending.id,
      status: pending.status,
      note: note.trim() || undefined,
    });
    setPending(null);
    setNote('');
  }

  function requestReject(id: string) {
    const card = applicants?.find((a) => a.applicationId === id);
    setRejecting({ id, status: ApplicationStatus.Rejected, name: card?.displayName ?? 'Ứng viên' });
    setRejectReason('');
  }

  function confirmReject() {
    if (!rejecting) return;
    statusMutation.mutate({
      id: rejecting.id,
      status: ApplicationStatus.Rejected,
      note: rejectReason.trim() || undefined,
    });
    setRejecting(null);
    setRejectReason('');
  }

  /** Khôi phục ứng viên từ "Đã từ chối" về lại bước Sàng lọc. */
  function restore(applicant: ApplicantView) {
    statusMutation.mutate({
      id: applicant.applicationId,
      status: ApplicationStatus.Screening,
      note: 'Khôi phục từ danh sách Đã từ chối',
    });
  }

  const rejectedApplicants = useMemo(
    () => (applicants ?? []).filter((a) => a.status === ApplicationStatus.Rejected),
    [applicants],
  );
  const pipelineApplicants = useMemo(
    () =>
      (applicants ?? []).filter((a) => a.status !== ApplicationStatus.Rejected),
    [applicants],
  );

  const kpiCounts = useMemo(() => {
    const list = applicants ?? [];
    return {
      total: list.length,
      screening: list.filter((a) => a.status === ApplicationStatus.Screening).length,
      offer: list.filter((a) => a.status === ApplicationStatus.Offer).length,
    };
  }, [applicants]);

  const statusInfo = job
    ? (JOB_STATUS_BADGE[job.status] ?? {
        label: job.status,
        className: 'bg-slate-100 text-slate-600 ring-slate-200',
      })
    : null;

  return (
    <AppShell>
      {/* Quay lại Hộp thư ứng viên */}
      <div className="mb-3">
        <Link
          href="/recruiter/inbox"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1D4ED8] hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Quay lại Hộp thư ứng viên
        </Link>
      </div>

      {/* Header vị trí tuyển dụng — Job Switcher Dropdown + badge trạng thái */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#E8872A] ring-1 ring-amber-200/70">
            <Briefcase className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div ref={jobSwitchRef} className="relative">
              <button
                type="button"
                onClick={() => setJobSwitchOpen((v) => !v)}
                aria-expanded={jobSwitchOpen}
                aria-haspopup="listbox"
                className="group flex max-w-full items-center gap-1.5 text-left"
              >
                <h1 className="truncate text-xl font-bold text-[#072348] sm:text-2xl">
                  {job ? formatJobTitle(job.title) : 'Tin tuyển dụng'}
                </h1>
                <ChevronDown
                  className={clsx(
                    'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                    jobSwitchOpen && 'rotate-180 text-brand-600',
                  )}
                />
              </button>

              {jobSwitchOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 top-full z-40 mt-1.5 max-h-[320px] w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
                >
                  {(myJobs ?? []).length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-slate-400">
                      Chưa có tin tuyển dụng nào.
                    </p>
                  ) : (
                    (myJobs ?? []).map((j) => {
                      const badge = JOB_STATUS_BADGE[j.status];
                      const active = j.id === jobId;
                      return (
                        <button
                          key={j.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setJobSwitchOpen(false);
                            if (j.id !== jobId) router.push(`/jobs/${j.id}/applicants`);
                          }}
                          className={clsx(
                            'flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left transition hover:bg-slate-50',
                            active && 'bg-brand-50',
                          )}
                        >
                          <span className="min-w-0">
                            <span
                              className={clsx(
                                'block truncate text-[13px] font-semibold',
                                active ? 'text-brand-700' : 'text-slate-800',
                              )}
                            >
                              {formatJobTitle(j.title)}
                            </span>
                            <span className="block truncate text-[11px] text-slate-400">
                              {j.code}
                              {j.location ? ` · ${j.location}` : ''}
                            </span>
                          </span>
                          {badge && (
                            <span
                              className={clsx(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-[12.5px] text-slate-500">
                {[
                  job?.code,
                  job?.jobTrack ? formatJobTrack(job.jobTrack) : null,
                  job?.location,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {statusInfo && (
                <span
                  className={clsx(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1',
                    statusInfo.className,
                  )}
                >
                  {statusInfo.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(applicants?.length ?? 0) > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/recruiter/email?jobId=${jobId}&returnUrl=${encodeURIComponent(
                    `/jobs/${jobId}/applicants`,
                  )}`,
                )
              }
              className="rounded-xl"
            >
              <Mail className="h-4 w-4" />
              Gửi email hàng loạt
            </Button>
          )}
          <div ref={moreRef} className="relative">
            <button
              type="button"
              aria-label="Thao tác khác"
              onClick={() => setMoreOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                <Link
                  href={`/jobs/${jobId}/detail`}
                  onClick={() => setMoreOpen(false)}
                  className="block px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Xem chi tiết tin
                </Link>
                <Link
                  href="/jobs/manage"
                  onClick={() => setMoreOpen(false)}
                  className="block px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Danh sách tin tuyển dụng
                </Link>
                <Link
                  href="/recruiter/inbox"
                  onClick={() => setMoreOpen(false)}
                  className="block px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hộp thư ứng viên
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {broadcastResult && (
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{broadcastResult}</p>
      )}

      {/* Tab bar + 3 KPI tóm tắt */}
      <div className="mt-5 flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-1">
          <TabButton active={tab === 'pipeline'} onClick={() => setTab('pipeline')}>
            Quy trình ({pipelineApplicants.length})
          </TabButton>
          <TabButton active={tab === 'suggested'} onClick={() => setTab('suggested')}>
            <Sparkles className="mr-1 inline h-4 w-4" /> AI gợi ý ứng viên
          </TabButton>
          <TabButton active={tab === 'rejected'} onClick={() => setTab('rejected')}>
            <Trash2 className="mr-1 inline h-4 w-4" /> Đã từ chối ({rejectedApplicants.length})
          </TabButton>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:w-auto">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <p className="text-base font-bold tabular-nums leading-none text-[#072348]">
                {kpiCounts.total}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Tổng ứng viên</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0B468C]">
              <Search className="h-4 w-4" />
            </span>
            <div>
              <p className="text-base font-bold tabular-nums leading-none text-[#072348]">
                {kpiCounts.screening}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Đang sàng lọc</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <p className="text-base font-bold tabular-nums leading-none text-[#072348]">
                {kpiCounts.offer}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Đề nghị làm việc</p>
            </div>
          </div>
        </div>
      </div>

      {tab === 'pipeline' && (
        <div className="mt-4">
          {loadingApplicants && <p className="text-slate-500">Đang tải...</p>}
          {applicants && applicants.length === 0 && (
            <p className="text-sm text-slate-400">Chưa có ứng viên nào ứng tuyển.</p>
          )}
          {applicants && applicants.length > 0 && (
            <>
              <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-sky-100 bg-[#F4F8FF] px-3.5 py-2.5 text-[12.5px] text-slate-600">
                <Info className="h-4 w-4 shrink-0 text-[#1D4ED8]" />
                <span>
                  Quy trình tuyển dụng cho vị trí này. Kéo và thả ứng viên để chuyển bước, hoặc dùng nhanh các thao tác trên từng hồ sơ.
                </span>
              </div>
              <KanbanBoard
                applicants={pipelineApplicants}
                highlightCandidateId={highlightCandidateId}
                onMove={requestMove}
                onSchedule={(id, name) => setScheduleFor({ id, name })}
                onOffer={(id, name) => setOfferFor({ id, name })}
                onOnboard={(id, name) => setOnboardFor({ id, name })}
                onReject={requestReject}
                onMessage={(id, name) => {
                  void id;
                  void name;
                  window.dispatchEvent(new CustomEvent('inlink-open-chat'));
                }}
                onNote={(id, name) => {
                  requestMove(id, ApplicationStatus.Screening);
                  void name;
                }}
              />
            </>
          )}
        </div>
      )}

      {tab === 'rejected' && (
        <div className="mt-4">
          <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 text-[12.5px] text-slate-600">
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Ứng viên đã bị từ chối. Xem lý do và khôi phục về quy trình nếu từ chối nhầm.
            </span>
          </div>

          {rejectedApplicants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <Trash2 className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Chưa có ứng viên nào bị từ chối
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Khi bạn từ chối ứng viên, họ sẽ xuất hiện ở đây kèm lý do.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {rejectedApplicants.map((a) => (
                <li
                  key={a.applicationId}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[14px] font-bold text-[#072348]">
                        {toTitleCase(a.displayName)}
                      </p>
                      <Badge tone="red">{APPLICATION_STATUS_LABEL[a.status]}</Badge>
                      {a.matchScore != null && (
                        <span
                          className={clsx(
                            'rounded px-1.5 py-0.5 text-[10.5px] font-semibold ring-1',
                            matchBadgeTone(a.matchScore),
                          )}
                        >
                          {formatMatchPct(a.matchScore)}%
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-slate-400">
                        {relativeTime(a.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[12.5px] text-slate-500">
                      {a.currentPosition ? formatJobTitle(a.currentPosition) : 'Chưa rõ vị trí'}
                    </p>
                    {a.rejectionReason && (
                      <p className="mt-1.5 inline-block rounded-lg bg-rose-50 px-2 py-1 text-[12px] font-medium text-rose-700">
                        Lý do: {a.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => restore(a)}
                      disabled={statusMutation.isPending}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#072348] transition hover:border-brand-300 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Khôi phục
                    </button>
                    <Link
                      href={`/candidates/${a.candidateId}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700"
                    >
                      Xem hồ sơ
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {scheduleFor && (
        <ScheduleInterviewModal
          applicationId={scheduleFor.id}
          candidateName={scheduleFor.name}
          onClose={() => setScheduleFor(null)}
          onScheduled={() => {
            queryClient.invalidateQueries({ queryKey: applicantsKey });
            queryClient.invalidateQueries({ queryKey: ['interviews'] });
            queryClient.invalidateQueries({ queryKey: ['interview-stats'] });
          }}
        />
      )}

      {offerFor && (
        <SendOfferModal
          applicationId={offerFor.id}
          candidateName={offerFor.name}
          onClose={() => setOfferFor(null)}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: applicantsKey });
            queryClient.invalidateQueries({ queryKey: ['offers'] });
          }}
        />
      )}

      {onboardFor && (
        <StartOnboardingModal
          applicationId={onboardFor.id}
          candidateName={onboardFor.name}
          onClose={() => setOnboardFor(null)}
          onStarted={() => {
            queryClient.invalidateQueries({ queryKey: applicantsKey });
            queryClient.invalidateQueries({ queryKey: ['onboardings'] });
          }}
        />
      )}

      {broadcastOpen && (
        <BroadcastEmailModal
          jobId={jobId}
          applicants={applicants ?? []}
          onClose={() => setBroadcastOpen(false)}
          onSent={(r) => {
            setBroadcastResult(
              `Đã gửi ${r.sent}/${r.recipients} email` +
                (r.failed ? ` (${r.failed} lỗi)` : ''),
            );
          }}
        />
      )}

      {tab === 'suggested' && (
        <div className="mt-6 space-y-3">
          {loadingSuggested && <p className="text-slate-500">AI đang phân tích...</p>}
          {suggested && suggested.length === 0 && (
            <p className="text-sm text-slate-400">Chưa tìm thấy ứng viên phù hợp trong hệ thống.</p>
          )}
          {suggested?.map((c) => {
            // Ứng viên AI gợi ý chưa có hồ sơ ứng tuyển → mọi hành động chuyển bước
            // đều bị khóa cho tới khi NTD mở khóa hồ sơ bằng Credit.
            const locked = !c.viewed && !c.applied;
            return (
              <Card
                key={c.candidateId}
                className={clsx(
                  'transition',
                  locked
                    ? 'border-slate-200 bg-slate-50/60'
                    : 'hover:border-brand-200 hover:shadow-md',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {toTitleCase(c.displayName)}
                      </p>
                      <span
                        className={clsx(
                          'rounded px-2 py-0.5 text-[11px] font-semibold ring-1',
                          matchBadgeTone(c.match.score),
                        )}
                      >
                        Phù hợp {formatMatchPct(c.match.score)}%
                      </span>
                      <Badge tone="brand">AI gợi ý</Badge>
                      {c.applied && <Badge tone="green">Đã ứng tuyển</Badge>}
                      {locked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 ring-1 ring-amber-200">
                          <Lock className="h-3 w-3" />
                          Chưa mở khóa hồ sơ
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {c.currentPosition
                        ? formatJobTitle(c.currentPosition)
                        : 'Chưa cập nhật'}{' '}
                      · {c.industry ?? 'Chưa cập nhật'}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{c.match.reason}</p>
                    {c.match.matchedSkills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.match.matchedSkills.map((s) => (
                          <Badge key={s} tone="green">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/candidates/${c.candidateId}?match=${formatMatchPct(c.match.score)}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-brand-800 transition hover:border-brand-200 hover:bg-brand-50"
                    >
                      Xem hồ sơ
                    </Link>
                    {locked ? (
                      <button
                        type="button"
                        disabled
                        title="Cần mở khóa hồ sơ bằng Credit trước khi chuyển bước"
                        className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full bg-slate-200 px-3.5 text-[13px] font-semibold text-slate-500"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Mở khóa bằng Credit
                      </button>
                    ) : (
                      <Link
                        href={`/jobs/${jobId}/applicants`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-700"
                      >
                        Chuyển vào quy trình
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Xác nhận chuyển trạng thái</h2>
            <p className="mt-2 text-sm text-slate-600">
              Chuyển <span className="font-medium">{pending.name}</span> sang{' '}
              <span className="font-medium">{APPLICATION_STATUS_LABEL[pending.status]}</span>.
            </p>
            <div className="mt-4">
              <Field label="Ghi chú (tuỳ chọn)">
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Đã gọi điện, hẹn PV thứ 3..."
                  maxLength={1000}
                />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPending(null);
                  setNote('');
                }}
              >
                Huỷ
              </Button>
              <Button onClick={confirmMove} disabled={statusMutation.isPending}>
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Từ chối ứng viên</h2>
            <p className="mt-2 text-sm text-slate-600">
              Từ chối <span className="font-medium">{rejecting.name}</span>. Lý do sẽ được
              lưu và hiển thị ở tab &quot;Đã từ chối&quot;.
            </p>
            <div className="mt-4">
              <Field label="Lý do từ chối">
                <Textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Chọn lý do bên dưới hoặc nhập tự do..."
                  maxLength={500}
                />
              </Field>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REJECT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setRejecting(null);
                  setRejectReason('');
                }}
              >
                Huỷ
              </Button>
              <Button
                onClick={confirmReject}
                disabled={statusMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700"
              >
                Từ chối ứng viên
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'border-b-2 border-brand-600 px-4 py-2 text-sm font-medium text-brand-700'
          : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'
      }
    >
      {children}
    </button>
  );
}
