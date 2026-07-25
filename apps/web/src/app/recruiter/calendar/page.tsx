'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Link2, MapPin, User } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { InterviewStatus, type InterviewView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { INTERVIEW_STATUS_LABEL, INTERVIEW_TYPE_LABEL } from '@/lib/format';
import { getInterviewStats, listInterviews, updateInterview } from '@/lib/interviews';
import { listMyJobs } from '@/lib/jobs';

function rangeDays(days: number): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function RecruiterCalendarPage() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState('all');
  const [range, setRange] = useState(14);
  const window = useMemo(() => rangeDays(range), [range]);

  const { data: jobs } = useQuery({
    queryKey: ['my-jobs-calendar'],
    queryFn: listMyJobs,
    retry: false,
  });

  const { data: stats } = useQuery({
    queryKey: ['interview-stats'],
    queryFn: getInterviewStats,
    retry: false,
  });

  const listKey = ['interviews', window.from, window.to, jobId] as const;
  const { data: interviews, isLoading, isError, error } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      listInterviews({
        from: window.from,
        to: window.to,
        jobId: jobId === 'all' ? undefined : jobId,
      }),
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      updateInterview(id, { status: InterviewStatus.Cancelled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['interview-stats'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      updateInterview(id, { status: InterviewStatus.Completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['interview-stats'] });
    },
  });

  const grouped = useMemo(() => groupByDay(interviews ?? []), [interviews]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="brand-accent-dot" />
            Tuyển dụng
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Lịch phỏng vấn</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="mt-2 text-sm text-slate-500">
            Đặt lịch HR / chuyên môn, theo dõi và cập nhật trạng thái.
          </p>
        </div>
        <Link href="/recruiter/inbox">
          <Button variant="outline">Chọn ứng viên từ hộp thư</Button>
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="PV hôm nay"
          value={stats?.todayCount ?? 0}
          hint={
            stats?.next2hCount
              ? `${stats.next2hCount} trong 2 giờ tới`
              : 'Không có buổi sắp tới'
          }
        />
        <StatCard
          label="PV HR hôm nay"
          value={stats?.byType.hr ?? 0}
          hint="Loại HR"
        />
        <StatCard
          label="PV chuyên môn hôm nay"
          value={stats?.byType.technical ?? 0}
          hint="Loại Chuyên môn"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="brand-panel flex flex-wrap items-center gap-3 p-2.5">
          <Select
            value={String(range)}
            onChange={(e) => setRange(Number(e.target.value))}
            className="max-w-[160px] border-0 bg-transparent py-2 text-sm shadow-none"
          >
            <option value="7">7 ngày tới</option>
            <option value="14">14 ngày tới</option>
            <option value="30">30 ngày tới</option>
          </Select>
          <span className="hidden h-5 w-px bg-accent-200 sm:block" aria-hidden />
          <Select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="max-w-[240px] border-0 bg-transparent py-2 text-sm shadow-none"
          >
            <option value="all">Tất cả tin tuyển dụng</option>
            {(jobs ?? []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Đang tải lịch...</p>}
      {isError && (
        <p className="mt-6 text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không tải được lịch'}
        </p>
      )}

      {!isLoading && grouped.length === 0 && (
        <Card className="mt-6 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-slate-600">Chưa có lịch phỏng vấn trong khoảng này.</p>
          <p className="mt-1 text-sm text-slate-400">
            Mở Kanban tin tuyển dụng → chọn ứng viên → Đặt lịch PV.
          </p>
          <Link href="/jobs/manage" className="mt-4 inline-block">
            <Button>Quản lý tin tuyển dụng</Button>
          </Link>
        </Card>
      )}

      <div className="mt-6 space-y-6">
        {grouped.map((g) => (
          <div key={g.day}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {g.label}
            </h2>
            <ul className="space-y-3">
              {g.items.map((iv) => (
                <InterviewCard
                  key={iv.id}
                  interview={iv}
                  busy={cancelMutation.isPending || completeMutation.isPending}
                  onCancel={() => cancelMutation.mutate(iv.id)}
                  onComplete={() => completeMutation.mutate(iv.id)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="brand-panel p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-accent-600">{hint}</p>
    </div>
  );
}

function InterviewCard({
  interview,
  busy,
  onCancel,
  onComplete,
}: {
  interview: InterviewView;
  busy: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const scheduled = interview.status === InterviewStatus.Scheduled;
  return (
    <li className="brand-panel brand-card-accent list-none p-4 transition hover:border-accent-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{interview.candidateName}</p>
            <Badge tone="brand">{INTERVIEW_TYPE_LABEL[interview.type] ?? interview.type}</Badge>
            <Badge
              tone={
                interview.status === InterviewStatus.Cancelled
                  ? 'red'
                  : interview.status === InterviewStatus.Completed
                    ? 'green'
                    : 'slate'
              }
            >
              {INTERVIEW_STATUS_LABEL[interview.status] ?? interview.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{interview.jobTitle}</p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            {formatWhen(interview.scheduledAt)} · {interview.durationMinutes} phút
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {interview.interviewerName && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {interview.interviewerName}
              </span>
            )}
            {interview.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {interview.location}
              </span>
            )}
            {interview.meetingLink && (
              <a
                href={interview.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-brand-600 hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" /> Link họp
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/jobs/${interview.jobId}/applicants`}>
            <Button variant="outline" className="text-xs">
              Quy trình
            </Button>
          </Link>
          {scheduled && (
            <>
              <Button
                variant="outline"
                className="text-xs"
                disabled={busy}
                onClick={onComplete}
              >
                Hoàn thành
              </Button>
              <Button
                variant="ghost"
                className="text-xs text-red-600"
                disabled={busy}
                onClick={onCancel}
              >
                Huỷ lịch
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function groupByDay(items: InterviewView[]): { day: string; label: string; items: InterviewView[] }[] {
  const map = new Map<string, InterviewView[]>();
  for (const iv of items) {
    const day = iv.scheduledAt.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(iv);
  }
  return [...map.entries()].map(([day, list]) => ({
    day,
    label: new Date(day + 'T12:00:00').toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    items: list,
  }));
}
