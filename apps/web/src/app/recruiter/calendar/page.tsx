'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Briefcase, CalendarDays, Check, Layers, Link2, MapPin, User, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { InterviewStatus, InterviewType, type InterviewView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { INTERVIEW_STATUS_LABEL, INTERVIEW_TYPE_LABEL } from '@/lib/format';
import { getInterviewStats, listInterviews, updateInterview } from '@/lib/interviews';
import { listMyJobs } from '@/lib/jobs';
import { EXTERNAL_REL } from '@/lib/public-paths';

function rangeDays(days: number): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

type TodayFocus = 'all' | 'hr' | 'technical';

const FOCUS_LABEL: Record<TodayFocus, string> = {
  all: 'PV hôm nay',
  hr: 'PV HR hôm nay',
  technical: 'PV chuyên môn hôm nay',
};

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
  const [focus, setFocus] = useState<TodayFocus | null>(null);
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

  const {
    data: todayScheduled,
    isLoading: todayLoading,
    isError: todayError,
    error: todayQueryError,
  } = useQuery({
    queryKey: ['interviews', 'today-scheduled'],
    queryFn: () => listInterviews({ scope: 'today' }),
    retry: false,
    enabled: focus !== null,
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

  const visible = useMemo(() => {
    if (!focus) return interviews ?? [];
    const rows = todayScheduled ?? [];
    if (focus === 'hr') return rows.filter((row) => row.type === InterviewType.Hr);
    if (focus === 'technical') return rows.filter((row) => row.type === InterviewType.Technical);
    return rows;
  }, [focus, interviews, todayScheduled]);

  const grouped = useMemo(() => groupByDay(visible), [visible]);
  const listLoading = focus ? todayLoading : isLoading;
  const listFailed = focus ? todayError : isError;
  const listError = focus ? todayQueryError : error;

  function pickFocus(next: TodayFocus) {
    setFocus((current) => (current === next ? null : next));
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
            <span className="h-4 w-1 rounded-full bg-accent-500" />
            Tuyển dụng
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-800">Lịch phỏng vấn</h1>
          <p className="mt-1 text-sm text-slate-500">
            Đặt lịch HR / chuyên môn, theo dõi và cập nhật trạng thái.
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

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-700"
          label="PV hôm nay"
          value={stats?.todayCount ?? 0}
          hint={
            stats?.next2hCount
              ? `${stats.next2hCount} trong 2 giờ tới`
              : 'Không có buổi sắp tới'
          }
          active={focus === 'all'}
          onClick={() => pickFocus('all')}
        />
        <StatCard
          icon={<User className="h-5 w-5" />}
          tone="bg-accent-50 text-accent-700"
          label="PV HR hôm nay"
          value={stats?.byType.hr ?? 0}
          hint="Loại HR"
          active={focus === 'hr'}
          onClick={() => pickFocus('hr')}
        />
        <StatCard
          icon={<Layers className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-700"
          label="PV chuyên môn hôm nay"
          value={stats?.byType.technical ?? 0}
          hint="Loại Chuyên môn"
          active={focus === 'technical'}
          onClick={() => pickFocus('technical')}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Bấm một ô để xem đúng các buổi đã lên lịch trong số đó.
      </p>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(7,35,72,0.04)] sm:grid-cols-2 lg:max-w-3xl">
        <label className="flex min-w-0 items-center gap-3 text-[12px] font-semibold text-slate-500">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            Khoảng thời gian
            <Select
              value={String(range)}
              onChange={(e) => {
                setRange(Number(e.target.value));
                setFocus(null);
              }}
              className="mt-1.5 border-slate-200 bg-white"
              size="sm"
            >
              <option value="7">7 ngày tới</option>
              <option value="14">14 ngày tới</option>
              <option value="30">30 ngày tới</option>
            </Select>
          </span>
        </label>
        <label className="flex min-w-0 items-center gap-3 border-slate-100 text-[12px] font-semibold text-slate-500 sm:border-l sm:pl-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
            <Briefcase className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            Tin tuyển dụng
            <Select
              value={jobId}
              onChange={(e) => {
                setJobId(e.target.value);
                setFocus(null);
              }}
              className="mt-1.5 border-slate-200 bg-white"
              size="sm"
            >
              <option value="all">Tất cả tin tuyển dụng</option>
              {(jobs ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>
          </span>
        </label>
      </div>

      {focus && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            {FOCUS_LABEL[focus]}
            {!todayLoading && ` · ${visible.length} buổi đã lên lịch`}
          </p>
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            Xem theo khoảng thời gian
          </button>
        </div>
      )}

      {listLoading && <p className="mt-6 text-slate-500">Đang tải lịch...</p>}
      {listFailed && (
        <p className="mt-6 text-sm text-red-600">
          {listError instanceof ApiError ? listError.message : 'Không tải được lịch'}
        </p>
      )}

      {!listLoading && grouped.length === 0 && (
        <div className="mt-5 flex flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white px-6 py-10 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_16px_36px_-20px_rgba(7,35,72,0.22)] sm:flex-row sm:px-10">
          <span className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-brand-50 text-brand-700">
            <CalendarDays className="h-12 w-12" />
            <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm">
              <Check className="h-4 w-4" />
            </span>
          </span>
          <div className="text-center sm:text-left">
            {focus ? (
              <p className="text-lg font-bold text-brand-800">Không có buổi đã lên lịch trong mục này hôm nay.</p>
            ) : (
              <>
                <p className="text-lg font-bold text-brand-800">Chưa có lịch phỏng vấn trong khoảng này.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Mở Kanban tin tuyển dụng → chọn ứng viên → Đặt lịch PV.
                </p>
                <Link
                  href="/jobs/manage"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-accent-600"
                >
                  <Briefcase className="h-4 w-4" />
                  Quản lý tin tuyển dụng
                </Link>
              </>
            )}
          </div>
        </div>
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
  icon,
  tone,
  label,
  value,
  hint,
  active,
  onClick,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: number;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'group relative w-full overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)] transition duration-300 hover:-translate-y-0.5',
        active ? 'border-brand-600 ring-2 ring-brand-600' : 'border-slate-200/80 hover:border-brand-200',
      )}
    >
      <span className={clsx('flex h-11 w-11 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110', tone)}>
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[#E8872A]">{value}</p>
      <p className="mt-1 text-xs font-medium text-accent-600">{hint}</p>
      <span aria-hidden className="pointer-events-none absolute -bottom-6 -right-4 h-16 w-24 rounded-full bg-brand-50/80" />
    </button>
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
    <li className="list-none rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_32px_-16px_rgba(7,35,72,0.3)]">
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
                rel={EXTERNAL_REL}
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
