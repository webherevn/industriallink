'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CalendarDays, ClipboardList, IdCard, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OnboardingStatus, type OnboardingView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Select } from '@/components/ui';
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
              <span className="h-4 w-1 rounded-full bg-accent-500" />
              Tuyển dụng
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-800">Nhận việc</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Theo dõi ngày nhận việc, checklist và email chào mừng nhân viên mới.
            </p>
          </div>
          <div aria-hidden className="relative hidden h-20 w-28 shrink-0 sm:block">
            <CalendarDays className="absolute left-0 top-1 h-10 w-10 text-brand-700" strokeWidth={1.4} />
            <IdCard className="absolute left-8 top-0 h-9 w-9 text-accent-500" strokeWidth={1.4} />
            <Briefcase className="absolute bottom-0 right-1 h-10 w-10 text-brand-800" strokeWidth={1.4} />
          </div>
        </div>
        <Link
          href="/recruiter/inbox"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-sm transition duration-200 hover:border-brand-200 hover:bg-brand-50"
        >
          <Mail className="h-4 w-4" />
          Chọn từ hộp thư
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
            <User className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            Trạng thái nhận việc
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1.5 border-slate-200 bg-white"
              size="sm"
            >
              <option value="all">Mọi trạng thái</option>
              {Object.values(OnboardingStatus).map((s) => (
                <option key={s} value={s}>
                  {ONBOARDING_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </span>
        </label>
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Đang tải...</p>}
      {isError && (
        <p className="mt-6 text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không tải được danh sách nhận việc'}
        </p>
      )}

      {!isLoading && (items?.length ?? 0) === 0 && (
        <div className="mt-5 flex flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white px-6 py-10 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_16px_36px_-20px_rgba(7,35,72,0.22)] sm:flex-row sm:px-10">
          <span className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-accent-50 text-accent-600">
            <ClipboardList className="h-12 w-12" />
            <span className="absolute -bottom-2 -left-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-100">
              <IdCard className="h-4 w-4" />
            </span>
          </span>
          <div className="text-center sm:text-left">
            <p className="text-lg font-bold text-brand-800">Chưa có nhân viên nào đang nhận việc.</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Ở cột Đề nghị làm việc, bấm Nhận việc và lưu ngày. Hồ sơ chuyển sang Đã nhận việc sau khi lưu.
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
    <li className="list-none rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_32px_-16px_rgba(7,35,72,0.3)]">
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
          <p className="mt-2 text-sm font-semibold text-[#E8872A]">
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
    </li>
  );
}
