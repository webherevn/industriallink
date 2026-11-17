'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  Info,
  Mail,
  MoreHorizontal,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApplicationStatus, type ApplicantView, formatJobTitle, formatJobTrack } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { BroadcastEmailModal } from '@/components/broadcast-email-modal';
import { Badge, Button, Card, Field, Textarea } from '@/components/ui';
import { KanbanBoard } from '@/components/kanban-board';
import { ScheduleInterviewModal } from '@/components/schedule-interview-modal';
import { SendOfferModal } from '@/components/send-offer-modal';
import { StartOnboardingModal } from '@/components/start-onboarding-modal';
import { updateApplicationStatus } from '@/lib/applications';
import { APPLICATION_STATUS_LABEL } from '@/lib/format';
import { getJob, listApplicants } from '@/lib/jobs';
import { candidatesForJob } from '@/lib/matching';
import { formatMatchPct, matchBadgeTone } from '@/lib/match-percent';

type Tab = 'pipeline' | 'suggested';

type PendingMove = {
  id: string;
  status: ApplicationStatus;
  name: string;
};

export default function ApplicantsPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pipeline');
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [note, setNote] = useState('');
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
  const moreRef = useRef<HTMLDivElement>(null);

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

  const applicantsKey = ['applicants', jobId] as const;

  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => getJob(jobId) });
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

  const kpiCounts = useMemo(() => {
    const list = applicants ?? [];
    return {
      total: list.length,
      screening: list.filter((a) => a.status === ApplicationStatus.Screening).length,
      offer: list.filter((a) => a.status === ApplicationStatus.Offer).length,
    };
  }, [applicants]);

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

      {/* Header vị trí tuyển dụng */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#E8872A] ring-1 ring-amber-200/70">
            <Briefcase className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-[#072348] sm:text-2xl">
              {job?.title ?? 'Tin tuyển dụng'}
            </h1>
            <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
              {[
                job?.code,
                job?.jobTrack ? formatJobTrack(job.jobTrack) : null,
                job?.location,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(applicants?.length ?? 0) > 0 && (
            <Button variant="outline" onClick={() => setBroadcastOpen(true)} className="rounded-xl">
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
        <div className="flex gap-1">
          <TabButton active={tab === 'pipeline'} onClick={() => setTab('pipeline')}>
            Quy trình ({applicants?.length ?? 0})
          </TabButton>
          <TabButton active={tab === 'suggested'} onClick={() => setTab('suggested')}>
            <Sparkles className="mr-1 inline h-4 w-4" /> AI gợi ý ứng viên
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
                applicants={applicants}
                onMove={requestMove}
                onSchedule={(id, name) => setScheduleFor({ id, name })}
                onOffer={(id, name) => setOfferFor({ id, name })}
                onOnboard={(id, name) => setOnboardFor({ id, name })}
              />
            </>
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
          {suggested?.map((c) => (
            <Link key={c.candidateId} href={`/candidates/${c.candidateId}?match=${formatMatchPct(c.match.score)}`} className="block">
              <Card className="transition hover:border-brand-200 hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 hover:text-brand-700">
                      {c.displayName}
                      <span className="ml-2 text-xs font-semibold text-brand-500">Xem hồ sơ →</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {c.currentPosition
                        ? formatJobTitle(c.currentPosition)
                        : 'Chưa cập nhật'}{' '}
                      · {c.industry ?? 'Chưa cập nhật'}
                    </p>
                  </div>
                  <span className={clsx('rounded px-2 py-0.5 text-[11px] font-semibold ring-1', matchBadgeTone(c.match.score))}>
                    Phù hợp {formatMatchPct(c.match.score)}%
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{c.match.reason}</p>
                {c.match.matchedSkills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.match.matchedSkills.map((s) => (
                      <Badge key={s} tone="green">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
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
