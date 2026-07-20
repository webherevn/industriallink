'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OnboardingStatus, type OnboardingView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { ONBOARDING_STATUS_LABEL } from '@/lib/format';
import { listMyJobs } from '@/lib/jobs';
import { listOnboardings, updateOnboarding } from '@/lib/onboarding';

export default function RecruiterOnboardingPage() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState('all');
  const [status, setStatus] = useState('all');

  const { data: jobs } = useQuery({
    queryKey: ['my-jobs-onboarding'],
    queryFn: listMyJobs,
    retry: false,
  });

  const listKey = ['onboardings', jobId, status] as const;
  const { data: items, isLoading, isError, error } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      listOnboardings({
        jobId: jobId === 'all' ? undefined : jobId,
        status: status === 'all' ? undefined : status,
      }),
    retry: false,
  });

  const mutateStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OnboardingStatus }) =>
      updateOnboarding(id, { status: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboardings'] });
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhận việc</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi ngày nhận việc, checklist và email chào mừng nhân viên mới.
          </p>
        </div>
        <Link href="/recruiter/inbox">
          <Button variant="outline">Chọn từ hộp thư</Button>
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
          {Object.values(OnboardingStatus).map((s) => (
            <option key={s} value={s}>
              {ONBOARDING_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Đang tải...</p>}
      {isError && (
        <p className="mt-6 text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không tải được danh sách nhận việc'}
        </p>
      )}

      {!isLoading && (items?.length ?? 0) === 0 && (
        <Card className="mt-6 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-slate-600">Chưa có nhân viên nào đang nhận việc.</p>
          <p className="mt-1 text-sm text-slate-400">
            Trên bảng quy trình (cột Trúng tuyển / Đề nghị) → «Nhận việc».
          </p>
          <Link href="/jobs/manage" className="mt-4 inline-block">
            <Button>Quản lý tin tuyển dụng</Button>
          </Link>
        </Card>
      )}

      <ul className="mt-6 space-y-3">
        {(items ?? []).map((o) => (
          <OnboardingCard
            key={o.id}
            item={o}
            busy={mutateStatus.isPending}
            onInProgress={() =>
              mutateStatus.mutate({ id: o.id, next: OnboardingStatus.InProgress })
            }
            onComplete={() =>
              mutateStatus.mutate({ id: o.id, next: OnboardingStatus.Completed })
            }
            onCancel={() =>
              mutateStatus.mutate({ id: o.id, next: OnboardingStatus.Cancelled })
            }
          />
        ))}
      </ul>
    </AppShell>
  );
}

function OnboardingCard({
  item,
  busy,
  onInProgress,
  onComplete,
  onCancel,
}: {
  item: OnboardingView;
  busy: boolean;
  onInProgress: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const open =
    item.status === OnboardingStatus.Pending ||
    item.status === OnboardingStatus.InProgress;

  return (
    <Card as="li" className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{item.candidateName}</p>
            <Badge
              tone={
                item.status === OnboardingStatus.Completed
                  ? 'green'
                  : item.status === OnboardingStatus.Cancelled
                    ? 'red'
                    : 'amber'
              }
            >
              {ONBOARDING_STATUS_LABEL[item.status] ?? item.status}
            </Badge>
            <span className="text-xs text-slate-400">{item.code}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{item.jobTitle}</p>
          <p className="mt-2 text-sm font-semibold text-blue-700">
            Nhận việc: {item.startDate}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
            {item.reportLocation && <span>{item.reportLocation}</span>}
            {item.contactName && (
              <span>
                LH: {item.contactName}
                {item.contactPhone ? ` · ${item.contactPhone}` : ''}
              </span>
            )}
          </div>
          {item.checklist && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.checklist}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/jobs/${item.jobId}/applicants`}>
            <Button variant="outline" className="text-xs">
              Quy trình
            </Button>
          </Link>
          {open && item.status === OnboardingStatus.Pending && (
            <Button
              variant="outline"
              className="text-xs"
              disabled={busy}
              onClick={onInProgress}
            >
              Đang nhận việc
            </Button>
          )}
          {open && (
            <>
              <Button
                variant="outline"
                className="text-xs"
                disabled={busy}
                onClick={onComplete}
              >
                Hoàn tất
              </Button>
              <Button
                variant="ghost"
                className="text-xs text-red-600"
                disabled={busy}
                onClick={onCancel}
              >
                Huỷ
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
