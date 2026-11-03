'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ClipboardList, Mail, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OfferStatus, type OfferView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { StartOnboardingModal } from '@/components/start-onboarding-modal';
import { Badge, Button, Select } from '@/components/ui';
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
            <span className="h-4 w-1 rounded-full bg-accent-500" />
            Tuyển dụng
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-800">Đề nghị tuyển dụng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gửi đề nghị làm việc + email, theo dõi phản hồi ứng viên.
          </p>
        </div>
        <Link
          href="/recruiter/inbox"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-sm transition duration-200 hover:border-brand-200 hover:bg-brand-50"
        >
          <Users className="h-4 w-4" />
          Chọn ứng viên từ hộp thư
        </Link>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(7,35,72,0.04)] sm:grid-cols-2 lg:max-w-3xl">
        <label className="flex min-w-0 items-center gap-3 text-[12px] font-semibold text-slate-500">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Briefcase className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            Tin tuyển dụng
            <Select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="mt-1.5 border-slate-200 bg-white"
              size="sm"
            >
              <option value="all">Tất cả tin</option>
              {(jobs ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>
          </span>
        </label>
        <label className="flex min-w-0 items-center gap-3 border-slate-100 text-[12px] font-semibold text-slate-500 sm:border-l sm:pl-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
            <Mail className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            Trạng thái đề nghị
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1.5 border-slate-200 bg-white"
              size="sm"
            >
              <option value="all">Mọi trạng thái</option>
              {Object.values(OfferStatus).map((s) => (
                <option key={s} value={s}>
                  {OFFER_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </span>
        </label>
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Đang tải...</p>}
      {isError && (
        <p className="mt-6 text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không tải được đề nghị làm việc'}
        </p>
      )}

      {!isLoading && (offers?.length ?? 0) === 0 && (
        <div className="mt-5 flex flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white px-6 py-10 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_16px_36px_-20px_rgba(7,35,72,0.22)] sm:flex-row sm:px-10">
          <span className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-accent-50 text-accent-600">
            <ClipboardList className="h-12 w-12" />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">
              <Mail className="h-4 w-4" />
            </span>
          </span>
          <div className="text-center sm:text-left">
            <p className="text-lg font-bold text-brand-800">Chưa có đề nghị làm việc nào.</p>
            <p className="mt-1 text-sm text-slate-500">
              Trên bảng quy trình, mở thẻ ứng viên → «Gửi đề nghị».
            </p>
            <Link
              href="/jobs/manage"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-accent-600"
            >
              <Briefcase className="h-4 w-4" />
              Quản lý tin tuyển dụng
            </Link>
          </div>
        </div>
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
    <li className="list-none rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_32px_-16px_rgba(7,35,72,0.3)]">
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
                    : 'accent'
              }
            >
              {OFFER_STATUS_LABEL[offer.status] ?? offer.status}
            </Badge>
            <span className="text-xs text-slate-400">{offer.code}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{offer.jobTitle}</p>
          <p className="mt-2 text-lg font-bold text-accent-600">
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
    </li>
  );
}
