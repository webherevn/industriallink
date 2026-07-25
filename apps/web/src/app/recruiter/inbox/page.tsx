'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Briefcase,
  Clock3,
  Filter,
  Inbox,
  Search,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ApplicationStatus,
  formatJobTitle,
  type InboxApplicantView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Input } from '@/components/ui';
import { APPLICATION_STATUS_LABEL, statusTone } from '@/lib/format';
import { listInbox } from '@/lib/recruiter';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: ApplicationStatus.Applied, label: 'Mới ứng tuyển' },
  { value: ApplicationStatus.Screening, label: 'Sàng lọc' },
  { value: ApplicationStatus.Interview, label: 'Phỏng vấn' },
  { value: ApplicationStatus.Offer, label: 'Đề nghị' },
  { value: ApplicationStatus.Hired, label: 'Đã tuyển' },
  { value: ApplicationStatus.Rejected, label: 'Từ chối' },
];

export default function RecruiterInboxPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [q, setQ] = useState('');
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
      const scoreDiff = (b.matchScore ?? -1) - (a.matchScore ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data, statusFilter, q]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span className="brand-accent-dot" />
            Tuyển dụng
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Hộp thư ứng viên
          </h1>
          <div className="brand-accent-bar mt-2" />
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Theo dõi và xử lý toàn bộ hồ sơ ứng tuyển — ưu tiên điểm phù hợp AI cao.
          </p>
        </div>
        <Link href="/search">
          <Button>
            <Sparkles className="h-4 w-4 text-accent-300" />
            Tìm ứng viên AI
          </Button>
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Tổng hồ sơ"
          value={stats.total}
          tone="blue"
        />
        <StatCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Mới 24 giờ"
          value={stats.newToday}
          tone="teal"
        />
        <StatCard
          icon={<Filter className="h-4 w-4" />}
          label="Đang sàng lọc"
          value={stats.screening}
          tone="amber"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Phù hợp ≥ 60%"
          value={stats.highMatch}
          tone="green"
        />
      </div>

      <div className="brand-panel mt-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên, tin tuyển dụng, kỹ năng..."
              className="border-accent-200 bg-[#FFFBF7] pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
                    active
                      ? 'bg-brand-600 text-white shadow-sm ring-2 ring-accent-300/70'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {isLoading ? 'Đang tải…' : `${filtered.length} hồ sơ`}
        </p>
        {!isLoading && filtered.length > 0 && (
          <p className="text-[12px] text-slate-400">Sắp xếp theo độ phù hợp AI</p>
        )}
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

  return (
    <article className="brand-panel brand-card-accent group p-4 transition hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DBEAFE] to-[#93C5FD] text-sm font-bold text-[#1D4ED8] ring-2 ring-white">
              {initials || 'UV'}
            </div>
            {a.matchScore != null && (
              <span
                className={clsx(
                  'absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow',
                  a.matchScore >= 60
                    ? 'bg-emerald-500'
                    : a.matchScore >= 35
                      ? 'bg-brand-600'
                      : 'bg-slate-500',
                )}
              >
                {a.matchScore}%
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold text-slate-900">
                {a.displayName}
              </h2>
              <Badge tone={statusTone(a.status)}>{APPLICATION_STATUS_LABEL[a.status]}</Badge>
              {a.matchScore != null && a.matchScore >= 60 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <Sparkles className="h-3 w-3" /> Ưu tiên
                </span>
              )}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                {a.jobTitle}
              </span>
              {a.currentPosition && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{formatJobTitle(a.currentPosition)}</span>
                </>
              )}
              {a.industry && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{a.industry}</span>
                </>
              )}
            </p>

            {a.matchedSkills.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {a.matchedSkills.slice(0, 6).map((s) => (
                  <Badge key={s} tone="green">
                    {s}
                  </Badge>
                ))}
                {a.matchedSkills.length > 6 && (
                  <span className="text-[11px] font-medium text-slate-400">
                    +{a.matchedSkills.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end xl:flex-row">
          <p className="text-[11px] text-slate-400 sm:order-first lg:order-none xl:mr-1">
            {timeLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/candidates/${a.candidateId}`}>
              <Button className="h-9 bg-accent-500 px-3.5 text-[13px] hover:bg-accent-600">
                <UserRound className="h-4 w-4" />
                Xem hồ sơ
              </Button>
            </Link>
            <Link href={`/jobs/${a.jobId}/applicants`}>
              <Button variant="outline" className="h-9 px-3.5 text-[13px]">
                Quy trình
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

const STAT_TONE = {
  blue: 'bg-brand-50 text-brand-700',
  teal: 'bg-accent-50 text-accent-700',
  amber: 'bg-accent-100 text-accent-700',
  green: 'bg-[#D1FAE5] text-[#059669]',
} as const;

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <div className="brand-panel p-4">
      <div
        className={clsx(
          'flex h-9 w-9 items-center justify-center rounded-full',
          STAT_TONE[tone],
        )}
      >
        {icon}
      </div>
      <p className="mt-3 text-[12px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-[1.5rem] font-extrabold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
