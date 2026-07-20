'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ApplicationStatus, type ApplicantView, formatJobTitle } from '@industriallink/contracts';
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

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{job?.title ?? 'Tin tuyển dụng'}</h1>
          <p className="mt-1 text-slate-500">{job?.code}</p>
        </div>
        {(applicants?.length ?? 0) > 0 && (
          <Button variant="outline" onClick={() => setBroadcastOpen(true)}>
            Gửi email hàng loạt
          </Button>
        )}
      </div>

      {broadcastResult && (
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{broadcastResult}</p>
      )}

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'pipeline'} onClick={() => setTab('pipeline')}>
          Quy trình ({applicants?.length ?? 0})
        </TabButton>
        <TabButton active={tab === 'suggested'} onClick={() => setTab('suggested')}>
          <Sparkles className="mr-1 inline h-4 w-4" /> AI gợi ý ứng viên
        </TabButton>
      </div>

      {tab === 'pipeline' && (
        <div className="mt-6">
          {loadingApplicants && <p className="text-slate-500">Đang tải...</p>}
          {applicants && applicants.length === 0 && (
            <p className="text-sm text-slate-400">Chưa có ứng viên nào ứng tuyển.</p>
          )}
          {applicants && applicants.length > 0 && (
            <>
              <p className="mb-3 text-sm text-slate-500">
                Kéo-thả thẻ ứng viên giữa các cột để chuyển bước trong quy trình tuyển dụng.
                Bấm «Đặt lịch PV» trên thẻ để lên lịch phỏng vấn.
              </p>
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
            <Link key={c.candidateId} href={`/candidates/${c.candidateId}`} className="block">
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
                  <Badge tone="brand">Phù hợp {c.match.score}%</Badge>
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
