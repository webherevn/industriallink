'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Clock3,
  Filter,
  Inbox,
  Mail,
  Search,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ApplicationStatus,
  formatJobTitle,
  type InboxApplicantView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CopilotRobot } from '@/components/copilot-robot';
import { Badge, Button, Input } from '@/components/ui';
import { APPLICATION_STATUS_LABEL, interviewMarkText, statusTone } from '@/lib/format';
import { formatMatchPct } from '@/lib/match-percent';
import { listInbox } from '@/lib/recruiter';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: ApplicationStatus.Applied, label: 'Mới ứng tuyển' },
  { value: ApplicationStatus.Screening, label: 'Sàng lọc' },
  { value: ApplicationStatus.Interview, label: 'Phỏng vấn' },
  { value: ApplicationStatus.Offer, label: 'Đề nghị' },
  { value: ApplicationStatus.Hired, label: APPLICATION_STATUS_LABEL[ApplicationStatus.Hired] },
  { value: ApplicationStatus.Rejected, label: 'Từ chối' },
];

type InboxSort = 'match' | 'new';

export default function RecruiterInboxPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<InboxSort>('match');
  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-inbox'],
    queryFn: () => listInbox(100),
    retry: false,
  });

  const stats = useMemo(() => {
    const list = data ?? [];
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      total: list.length,
      newToday: list.filter((a) => new Date(a.createdAt).getTime() >= dayAgo).length,
      screening: list.filter((a) => a.status === ApplicationStatus.Screening).length,
      highMatch: list.filter((a) => (a.matchScore ?? 0) >= 60).length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((a) => {
        const hay = [
          a.displayName,
          a.jobTitle,
          a.currentPosition ?? '',
          a.industry ?? '',
          ...a.matchedSkills,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(query);
      });
    }
    return [...list].sort((a, b) => {
      if (sort === 'new') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      const scoreDiff = (b.matchScore ?? -1) - (a.matchScore ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data, statusFilter, q, sort]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
              <span className="h-4 w-1 rounded-full bg-accent-500" />
              Tuyển dụng
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-800">Hộp thư ứng viên</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Theo dõi và xử lý toàn bộ hồ sơ ứng tuyển — ưu tiên điểm phù hợp AI cao.
            </p>
          </div>
          <div className="hidden w-24 shrink-0 lg:block" aria-hidden>
            <CopilotRobot />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/recruiter/email"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-sm transition duration-200 hover:border-brand-200 hover:bg-brand-50"
          >
            <Mail className="h-4 w-4" />
            Gửi email hàng loạt
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" />
            Tìm ứng viên AI
          </Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Tổng hồ sơ" value={stats.total} tone="bg-brand-50 text-brand-700" />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Mới 24 giờ" value={stats.newToday} tone="bg-accent-50 text-accent-700" />
        <StatCard icon={<Filter className="h-5 w-5" />} label="Đang sàng lọc" value={stats.screening} tone="bg-[#e7eef8] text-brand-700" />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Phù hợp ≥ 60%" value={stats.highMatch} tone="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(7,35,72,0.04)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 xl:max-w-md xl:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên, tin tuyển dụng, kỹ năng..."
              className="w-full border-slate-200 bg-slate-50 pl-9"
            />
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-[12px] font-semibold transition duration-200',
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">
          {isLoading ? 'Đang tải…' : `${filtered.length} hồ sơ`}
        </p>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
          Sắp xếp theo
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as InboxSort)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800"
          >
            <option value="match">Độ phù hợp AI</option>
            <option value="new">Mới nhất</option>
          </select>
        </label>
      </div>

      <div className="mt-3 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80"
              />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <Inbox className="mx-auto h-10 w-10 text-brand-500" />
            <p className="mt-3 text-base font-semibold text-slate-800">
              Chưa có hồ sơ phù hợp bộ lọc
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Thử đổi trạng thái, xoá từ khoá, hoặc tìm thêm ứng viên bằng AI.
            </p>
            <Link href="/search" className="mt-4 inline-block">
              <Button variant="outline">
                <Sparkles className="h-4 w-4" /> Tìm ứng viên AI
              </Button>
            </Link>
          </div>
        )}

        {filtered.map((a) => (
          <ApplicantRow key={a.applicationId} applicant={a} />
        ))}
      </div>
    </AppShell>
  );
}

function ApplicantRow({ applicant: a }: { applicant: InboxApplicantView }) {
  const initials = a.displayName
    .split(' ')
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const when = new Date(a.createdAt);
  const timeLabel = when.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const strong = scoreValue(a.matchScore) >= 60;
  const meta = [
    a.jobTitle,
    a.currentPosition ? formatJobTitle(a.currentPosition) : '',
    a.industry ?? '',
    ...a.matchedSkills.slice(0, 3),
  ].filter(Boolean);

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex w-14 shrink-0 flex-col items-center">
            <div
              className={clsx(
                'flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold',
                strong ? 'bg-emerald-50 text-emerald-700' : 'bg-accent-50 text-accent-700',
              )}
            >
              {initials || 'UV'}
            </div>
            {a.matchScore != null && (
              <p className={clsx('mt-1 text-xs font-bold tabular-nums', strong ? 'text-emerald-600' : 'text-[#E8872A]')}>
                {formatMatchPct(a.matchScore)}%
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[15px] font-bold uppercase tracking-wide text-brand-800">
                {a.displayName}
              </h2>
              <Badge tone={statusTone(a.status)}>{APPLICATION_STATUS_LABEL[a.status]}</Badge>
              {a.interviews.map((mark, index) => (
                <Badge key={`${mark.type}-${mark.scheduledAt}-${index}`} tone="amber">
                  {interviewMarkText(mark)}
                </Badge>
              ))}
              {strong && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                  <Sparkles className="h-3 w-3" /> Ưu tiên
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[13px] text-slate-500">
              {meta.join(' · ')}
              {a.matchedSkills.length > 3 ? ` · +${a.matchedSkills.length - 3}` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <p className="mr-1 text-[12px] text-slate-400">{timeLabel}</p>
          <Link
            href={`/candidates/${a.candidateId}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-700"
          >
            <UserRound className="h-4 w-4" />
            Xem hồ sơ
          </Link>
          <Link
            href={`/jobs/${a.jobId}/applicants`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-brand-800 transition hover:border-brand-200 hover:bg-brand-50"
          >
            Quy trình
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function scoreValue(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  const numeric = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, numeric));
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-200">
      <span className={clsx('flex h-11 w-11 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110', tone)}>
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[#E8872A]">{value}</p>
      <span aria-hidden className="pointer-events-none absolute -bottom-6 -right-4 h-16 w-24 rounded-full bg-brand-50/80" />
    </div>
  );
}
