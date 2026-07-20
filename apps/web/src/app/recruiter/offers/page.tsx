'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OfferStatus, type OfferView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { StartOnboardingModal } from '@/components/start-onboarding-modal';
import { Badge, Button, Card, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { OFFER_STATUS_LABEL } from '@/lib/format';
import { listMyJobs } from '@/lib/jobs';
import { listOffers, updateOffer } from '@/lib/offers';

function formatSalary(n: number, currency: string) {
  return `${n.toLocaleString('vi-VN')} ${currency}/tháng`;
}

export default function RecruiterOffersPage() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState('all');
  const [status, setStatus] = useState('all');
  const [onboardFor, setOnboardFor] = useState<{
    applicationId: string;
    name: string;
    startDate?: string;
  } | null>(null);

  const { data: jobs } = useQuery({
    queryKey: ['my-jobs-offers'],
    queryFn: listMyJobs,
    retry: false,
  });

  const listKey = ['offers', jobId, status] as const;
  const { data: offers, isLoading, isError, error } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      listOffers({
        jobId: jobId === 'all' ? undefined : jobId,
        status: status === 'all' ? undefined : status,
      }),
    retry: false,
  });

  const mutateStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OfferStatus }) =>
      updateOffer(id, { status: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Đề nghị tuyển dụng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gửi đề nghị làm việc + email, theo dõi phản hồi ứng viên.
          </p>
        </div>
        <Link href="/recruiter/inbox">
          <Button variant="outline">Chọn ứng viên từ hộp thư</Button>
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="max-w-[240px] py-2 text-sm"
        >
          <option value="all">Tất cả tin</option>
          {(jobs ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="max-w-[180px] py-2 text-sm"
        >
          <option value="all">Mọi trạng thái</option>
          {Object.values(OfferStatus).map((s) => (
            <option key={s} value={s}>
              {OFFER_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Đang tải...</p>}
      {isError && (
        <p className="mt-6 text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không tải được đề nghị làm việc'}
        </p>
      )}

      {!isLoading && (offers?.length ?? 0) === 0 && (
        <Card className="mt-6 text-center">
          <Gift className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-slate-600">Chưa có đề nghị làm việc nào.</p>
          <p className="mt-1 text-sm text-slate-400">
            Trên bảng quy trình, mở thẻ ứng viên → «Gửi đề nghị».
          </p>
          <Link href="/jobs/manage" className="mt-4 inline-block">
            <Button>Quản lý tin tuyển dụng</Button>
          </Link>
        </Card>
      )}

      <ul className="mt-6 space-y-3">
        {(offers ?? []).map((o) => (
          <OfferCard
            key={o.id}
            offer={o}
            busy={mutateStatus.isPending}
            onWithdraw={() =>
              mutateStatus.mutate({ id: o.id, next: OfferStatus.Withdrawn })
            }
            onAccepted={() =>
              mutateStatus.mutate({ id: o.id, next: OfferStatus.Accepted })
            }
            onDeclined={() =>
              mutateStatus.mutate({ id: o.id, next: OfferStatus.Declined })
            }
            onOnboard={() =>
              setOnboardFor({
                applicationId: o.applicationId,
                name: o.candidateName,
                startDate: o.startDate ?? undefined,
              })
            }
          />
        ))}
      </ul>

      {onboardFor && (
        <StartOnboardingModal
          applicationId={onboardFor.applicationId}
          candidateName={onboardFor.name}
          defaultStartDate={onboardFor.startDate}
          onClose={() => setOnboardFor(null)}
          onStarted={() => {
            queryClient.invalidateQueries({ queryKey: ['onboardings'] });
            queryClient.invalidateQueries({ queryKey: ['applicants'] });
          }}
        />
      )}
    </AppShell>
  );
}

function OfferCard({
  offer,
  busy,
  onWithdraw,
  onAccepted,
  onDeclined,
  onOnboard,
}: {
  offer: OfferView;
  busy: boolean;
  onWithdraw: () => void;
  onAccepted: () => void;
  onDeclined: () => void;
  onOnboard: () => void;
}) {
  const pending = offer.status === OfferStatus.Pending;
  const accepted = offer.status === OfferStatus.Accepted;
  return (
    <Card as="li" className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{offer.candidateName}</p>
            <Badge
              tone={
                offer.status === OfferStatus.Accepted
                  ? 'green'
                  : offer.status === OfferStatus.Declined ||
                      offer.status === OfferStatus.Withdrawn
                    ? 'red'
                    : 'amber'
              }
            >
              {OFFER_STATUS_LABEL[offer.status] ?? offer.status}
            </Badge>
            <span className="text-xs text-slate-400">{offer.code}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{offer.jobTitle}</p>
          <p className="mt-2 text-lg font-bold text-teal-700">
            {formatSalary(offer.salary, offer.currency)}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
            {offer.startDate && <span>Nhận việc: {offer.startDate}</span>}
            {offer.expiresAt && <span>Hạn phản hồi: {offer.expiresAt}</span>}
          </div>
          {offer.benefits && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{offer.benefits}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/jobs/${offer.jobId}/applicants`}>
            <Button variant="outline" className="text-xs">
              Quy trình
            </Button>
          </Link>
          {pending && (
            <>
              <Button
                variant="outline"
                className="text-xs"
                disabled={busy}
                onClick={onAccepted}
              >
                Đánh dấu chấp nhận
              </Button>
              <Button
                variant="outline"
                className="text-xs"
                disabled={busy}
                onClick={onDeclined}
              >
                Từ chối
              </Button>
              <Button
                variant="ghost"
                className="text-xs text-red-600"
                disabled={busy}
                onClick={onWithdraw}
              >
                Rút đề nghị
              </Button>
            </>
          )}
          {accepted && (
            <Button variant="outline" className="text-xs" onClick={onOnboard}>
              Bắt đầu nhận việc
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
