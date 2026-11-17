'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Briefcase,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApplicationStatus,
  InterviewStatus,
  OfferStatus,
  OnboardingStatus,
  formatJobTitle,
  type InterviewView,
  type OfferView,
  type OnboardingView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CopilotRobot } from '@/components/copilot-robot';
import { ScheduleInterviewModal } from '@/components/schedule-interview-modal';
import { StartOnboardingModal } from '@/components/start-onboarding-modal';
import { INTERVIEW_TYPE_LABEL, ONBOARDING_STATUS_LABEL } from '@/lib/format';
import { listInterviews, updateInterview } from '@/lib/interviews';
import { listMyJobs } from '@/lib/jobs';
import { listOffers, updateOffer } from '@/lib/offers';
import { listOnboardings, updateOnboarding } from '@/lib/onboarding';
import { listInbox } from '@/lib/recruiter';

type StageFilter = 'all' | 'interview' | 'offer' | 'onboarding';

type PipelineRow = {
  key: string;
  stage: 'interview' | 'offer' | 'onboarding';
  candidateId: string;
  candidateName: string;
  candidateRole: string | null;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  scheduleMain: string;
  scheduleSub: string | null;
  statusText: string;
  statusTone: 'sky' | 'amber' | 'emerald' | 'rose' | 'slate';
  needsSchedule?: boolean;
  sortDate: number;
  interview?: InterviewView;
  offer?: OfferView;
  onboarding?: OnboardingView;
};

const AVATAR_TONES = [
  'bg-sky-100 text-[#0B468C]',
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-fuchsia-100 text-fuchsia-700',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function RecruiterPipelinePage() {
  const queryClient = useQueryClient();
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [jobId, setJobId] = useState('all');
  const [rangeDays, setRangeDays] = useState<14 | 30 | 90 | 0>(14);
  const [q, setQ] = useState('');
  const [statusOnlyPending, setStatusOnlyPending] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string } | null>(null);
  const [onboardFor, setOnboardFor] = useState<{
    applicationId: string;
    name: string;
    startDate?: string;
  } | null>(null);

  useEffect(() => {
    if (!openMenuKey) return;
    function onOutside(e: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setOpenMenuKey(null);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [openMenuKey]);

  const dateWindow = useMemo(() => {
    if (rangeDays === 0) {
      return {
        from: '2020-01-01T00:00:00.000Z',
        to: '2099-12-31T23:59:59.999Z',
      };
    }
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + rangeDays);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [rangeDays]);

  const { data: jobs } = useQuery({
    queryKey: ['my-jobs-pipeline'],
    queryFn: listMyJobs,
    retry: false,
  });

  const { data: inbox } = useQuery({
    queryKey: ['recruiter-inbox-pipeline'],
    queryFn: () => listInbox(100),
    retry: false,
  });

  const { data: interviews, isLoading: loadingInterviews } = useQuery({
    queryKey: ['interviews-pipeline', jobId, rangeDays],
    queryFn: () =>
      listInterviews({
        jobId: jobId === 'all' ? undefined : jobId,
        ...dateWindow,
      }),
    retry: false,
  });

  const { data: offers, isLoading: loadingOffers } = useQuery({
    queryKey: ['offers-pipeline', jobId],
    queryFn: () => listOffers({ jobId: jobId === 'all' ? undefined : jobId }),
    retry: false,
  });

  const { data: onboardings, isLoading: loadingOnboardings } = useQuery({
    queryKey: ['onboardings-pipeline', jobId],
    queryFn: () => listOnboardings({ jobId: jobId === 'all' ? undefined : jobId }),
    retry: false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['interviews-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['offers-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['onboardings-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['recruiter-inbox-pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['interviews'] });
    queryClient.invalidateQueries({ queryKey: ['offers'] });
    queryClient.invalidateQueries({ queryKey: ['onboardings'] });
    queryClient.invalidateQueries({ queryKey: ['interview-stats'] });
  };

  const interviewStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InterviewStatus }) =>
      updateInterview(id, { status }),
    onSuccess: invalidateAll,
  });

  const offerStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OfferStatus }) =>
      updateOffer(id, { status }),
    onSuccess: invalidateAll,
  });

  const onboardingStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OnboardingStatus }) =>
      updateOnboarding(id, { status }),
    onSuccess: invalidateAll,
  });

  const roleByCandidateId = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of inbox ?? []) {
      if (a.currentPosition) map.set(a.candidateId, formatJobTitle(a.currentPosition));
    }
    return map;
  }, [inbox]);

  const rows = useMemo<PipelineRow[]>(() => {
    const list: PipelineRow[] = [];
    const nowMs = Date.now();
    const scheduledAppIds = new Set((interviews ?? []).map((iv) => iv.applicationId));

    // 1. Lịch phỏng vấn đã lên lịch
    for (const iv of interviews ?? []) {
      const isPastScheduled =
        iv.status === InterviewStatus.Scheduled && new Date(iv.scheduledAt).getTime() < nowMs;
      const tone =
        iv.status === InterviewStatus.Scheduled
          ? isPastScheduled
            ? 'amber'
            : 'sky'
          : iv.status === InterviewStatus.Completed
            ? 'emerald'
            : 'rose';
      const statusText =
        iv.status === InterviewStatus.Scheduled
          ? isPastScheduled
            ? 'Đã qua lịch'
            : 'Sắp diễn ra'
          : iv.status === InterviewStatus.Completed
            ? 'Đã kết thúc'
            : iv.status === InterviewStatus.NoShow
              ? 'Vắng mặt'
              : 'Đã huỷ';

      list.push({
        key: `iv-${iv.id}`,
        stage: 'interview',
        candidateId: iv.candidateId,
        candidateName: iv.candidateName,
        candidateRole: roleByCandidateId.get(iv.candidateId) ?? null,
        applicationId: iv.applicationId,
        jobId: iv.jobId,
        jobTitle: formatJobTitle(iv.jobTitle),
        scheduleMain: formatDateTime(iv.scheduledAt),
        scheduleSub: INTERVIEW_TYPE_LABEL[iv.type] ?? 'Phỏng vấn',
        statusText,
        statusTone: tone,
        sortDate: new Date(iv.scheduledAt).getTime(),
        interview: iv,
      });
    }

    // 1b. Ứng viên đang ở bước Phỏng vấn nhưng chưa đặt lịch
    for (const app of inbox ?? []) {
      if (jobId !== 'all' && app.jobId !== jobId) continue;
      if (app.status === ApplicationStatus.Interview && !scheduledAppIds.has(app.applicationId)) {
        list.push({
          key: `unsched-${app.applicationId}`,
          stage: 'interview',
          candidateId: app.candidateId,
          candidateName: app.displayName,
          candidateRole: app.currentPosition ? formatJobTitle(app.currentPosition) : null,
          applicationId: app.applicationId,
          jobId: app.jobId,
          jobTitle: formatJobTitle(app.jobTitle),
          scheduleMain: 'Chưa đặt lịch',
          scheduleSub: null,
          statusText: 'Cần đặt lịch',
          statusTone: 'amber',
          needsSchedule: true,
          sortDate: new Date(app.createdAt).getTime(),
        });
      }
    }

    // 2. Đề nghị làm việc
    for (const ofr of offers ?? []) {
      const tone =
        ofr.status === OfferStatus.Pending
          ? 'amber'
          : ofr.status === OfferStatus.Accepted
            ? 'emerald'
            : 'rose';
      const statusText =
        ofr.status === OfferStatus.Pending
          ? 'Chờ phản hồi'
          : ofr.status === OfferStatus.Accepted
            ? '✓ Đã chấp nhận'
            : ofr.status === OfferStatus.Declined
              ? 'Từ chối'
              : ofr.status === OfferStatus.Withdrawn
                ? 'Đã rút'
                : 'Hết hạn';

      list.push({
        key: `offer-${ofr.id}`,
        stage: 'offer',
        candidateId: ofr.candidateId,
        candidateName: ofr.candidateName,
        candidateRole: roleByCandidateId.get(ofr.candidateId) ?? null,
        applicationId: ofr.applicationId,
        jobId: ofr.jobId,
        jobTitle: formatJobTitle(ofr.jobTitle),
        scheduleMain: ofr.expiresAt
          ? `Hạn phản hồi: ${formatDateOnly(ofr.expiresAt)}`
          : `Đã gửi: ${formatDateOnly(ofr.createdAt)}`,
        scheduleSub: `${ofr.salary.toLocaleString('vi-VN')} ${ofr.currency}/tháng`,
        statusText,
        statusTone: tone,
        sortDate: new Date(ofr.createdAt).getTime(),
        offer: ofr,
      });
    }

    // 3. Nhận việc
    for (const ob of onboardings ?? []) {
      const done = ob.status === OnboardingStatus.Completed;
      const tone = done
        ? 'emerald'
        : ob.status === OnboardingStatus.Cancelled
          ? 'rose'
          : 'sky';
      const statusText = done
        ? '✓ Hoàn tất'
        : ONBOARDING_STATUS_LABEL[ob.status] ?? 'Đang chuẩn bị';

      list.push({
        key: `ob-${ob.id}`,
        stage: 'onboarding',
        candidateId: ob.candidateId,
        candidateName: ob.candidateName,
        candidateRole: roleByCandidateId.get(ob.candidateId) ?? null,
        applicationId: ob.applicationId,
        jobId: ob.jobId,
        jobTitle: formatJobTitle(ob.jobTitle),
        scheduleMain: `Ngày nhận việc: ${formatDateOnly(ob.startDate)}`,
        scheduleSub: ob.reportLocation ?? null,
        statusText,
        statusTone: tone,
        sortDate: new Date(ob.startDate).getTime(),
        onboarding: ob,
      });
    }

    return list.sort((a, b) => b.sortDate - a.sortDate);
  }, [interviews, inbox, offers, onboardings, jobId, roleByCandidateId]);

  const counts = useMemo(() => {
    const nowMs = Date.now();
    const ivRows = rows.filter((r) => r.stage === 'interview');
    const ofRows = rows.filter((r) => r.stage === 'offer');
    const obRows = rows.filter((r) => r.stage === 'onboarding');
    return {
      all: rows.length,
      interview: ivRows.length,
      interviewUpcoming: ivRows.filter(
        (r) =>
          r.interview?.status === InterviewStatus.Scheduled &&
          new Date(r.interview.scheduledAt).getTime() >= nowMs,
      ).length,
      interviewOverdue: ivRows.filter(
        (r) =>
          r.interview?.status === InterviewStatus.Scheduled &&
          new Date(r.interview.scheduledAt).getTime() < nowMs,
      ).length,
      offer: ofRows.length,
      offerPending: ofRows.filter((r) => r.offer?.status === OfferStatus.Pending).length,
      onboarding: obRows.length,
      onboardingDone: obRows.filter(
        (r) => r.onboarding?.status === OnboardingStatus.Completed,
      ).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (stageFilter !== 'all') {
      list = list.filter((r) => r.stage === stageFilter);
    }
    if (statusOnlyPending) {
      list = list.filter((r) => r.statusTone === 'amber' || r.statusTone === 'sky');
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((r) =>
        [r.candidateName, r.candidateRole ?? '', r.jobTitle, r.scheduleMain, r.statusText]
          .join(' ')
          .toLowerCase()
          .includes(query),
      );
    }
    return list;
  }, [rows, stageFilter, statusOnlyPending, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const loading = loadingInterviews || loadingOffers || loadingOnboardings;

  return (
    <AppShell>
      {/* Header */}
      <section className="brand-hero-surface relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Tuyển dụng
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Quy trình tuyển dụng
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Quản lý toàn bộ các bước sau phỏng vấn: Lịch phỏng vấn, Đề nghị làm việc và Nhận việc.
            </p>
          </div>
          <div className="hidden w-24 shrink-0 sm:block" aria-hidden>
            <CopilotRobot />
          </div>
        </div>
      </section>

      {/* 3 thẻ KPI tóm tắt */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => {
            setStageFilter(stageFilter === 'interview' ? 'all' : 'interview');
            setPage(1);
          }}
          className={clsx(
            'group flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all',
            stageFilter === 'interview'
              ? 'border-[#0B468C] bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/30 ring-2 ring-[#0B468C]/15 shadow-sm'
              : 'border-slate-200/80 bg-white shadow-xs hover:border-sky-200 hover:bg-sky-50/20',
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-[#0B468C] text-white shadow-sm shadow-sky-900/15">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-600">Lịch phỏng vấn</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold tabular-nums text-[#072348]">
                {counts.interview}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0B468C]">
                {counts.interviewUpcoming} sắp diễn ra
              </span>
              {counts.interviewOverdue > 0 && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {counts.interviewOverdue} đã qua lịch
                </span>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStageFilter(stageFilter === 'offer' ? 'all' : 'offer');
            setPage(1);
          }}
          className={clsx(
            'group flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all',
            stageFilter === 'offer'
              ? 'border-accent-500 bg-gradient-to-br from-accent-50/90 via-white to-amber-50/30 ring-2 ring-accent-500/15 shadow-sm'
              : 'border-slate-200/80 bg-white shadow-xs hover:border-accent-200 hover:bg-accent-50/20',
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-sm shadow-accent-600/20">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-600">Đề nghị làm việc</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold tabular-nums text-[#072348]">
                {counts.offer}
              </span>
              <span className="rounded-full border border-accent-200 bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-800">
                {counts.offerPending} chờ phản hồi
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStageFilter(stageFilter === 'onboarding' ? 'all' : 'onboarding');
            setPage(1);
          }}
          className={clsx(
            'group flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all',
            stageFilter === 'onboarding'
              ? 'border-emerald-500 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/30 ring-2 ring-emerald-500/15 shadow-sm'
              : 'border-slate-200/80 bg-white shadow-xs hover:border-emerald-200 hover:bg-emerald-50/20',
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-700/20">
            <Briefcase className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-600">Nhận việc</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold tabular-nums text-[#072348]">
                {counts.onboarding}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Check className="h-3 w-3" />
                {counts.onboardingDone} đã hoàn tất
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Thanh tab lọc + Lọc nâng cao */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'all', label: `Tất cả (${counts.all})`, icon: Calendar },
              { key: 'interview', label: `Lịch phỏng vấn (${counts.interview})`, icon: CalendarDays },
              { key: 'offer', label: `Đề nghị làm việc (${counts.offer})`, icon: FileText },
              { key: 'onboarding', label: `Nhận việc (${counts.onboarding})`, icon: Briefcase },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = stageFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setStageFilter(t.key);
                  setPage(1);
                }}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all',
                  active
                    ? 'bg-gradient-to-r from-[#072348] to-[#0B468C] text-white shadow-sm shadow-sky-900/15'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50/50 hover:text-[#0B468C]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition',
            advancedOpen || statusOnlyPending
              ? 'border-[#0B468C] bg-sky-50 text-[#0B468C] shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/40',
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Lọc nâng cao
        </button>
      </div>

      {/* Khối tìm kiếm + Bộ lọc + Bảng dữ liệu */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_-10px_rgba(7,35,72,0.07)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/40 p-4 lg:flex-row lg:items-end">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên ứng viên, vị trí, tin tuyển dụng..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#0B468C] focus:ring-2 focus:ring-sky-500/15"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:flex lg:shrink-0 lg:items-end">
            <div className="min-w-0 sm:w-56">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Tin tuyển dụng
              </span>
              <select
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-full truncate rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#072348] outline-none transition focus:border-[#0B468C]"
              >
                <option value="all">Tất cả tin</option>
                {(jobs ?? []).map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 sm:w-44">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Khoảng thời gian
              </span>
              <select
                value={rangeDays}
                onChange={(e) => {
                  setRangeDays(Number(e.target.value) as 14 | 30 | 90 | 0);
                  setPage(1);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#072348] outline-none transition focus:border-[#0B468C]"
              >
                <option value={14}>14 ngày tới</option>
                <option value={30}>30 ngày tới</option>
                <option value={90}>90 ngày tới</option>
                <option value={0}>Tất cả thời gian</option>
              </select>
            </div>
          </div>
        </div>

        {advancedOpen && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-sky-50/40 px-4 py-2.5 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-[#072348]">
              <input
                type="checkbox"
                checked={statusOnlyPending}
                onChange={(e) => {
                  setStatusOnlyPending(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-slate-300 text-[#0B468C]"
              />
              Chỉ hiển thị hồ sơ cần xử lý / sắp diễn ra
            </label>
          </div>
        )}

        {/* Bảng */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={
                      pagedRows.length > 0 && pagedRows.every((r) => selectedKeys[r.key])
                    }
                    onChange={(e) => {
                      const next: Record<string, boolean> = { ...selectedKeys };
                      for (const r of pagedRows) next[r.key] = e.target.checked;
                      setSelectedKeys(next);
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-3 py-3">Ứng viên</th>
                <th className="px-3 py-3">Tin tuyển dụng</th>
                <th className="px-3 py-3">Bước hiện tại</th>
                <th className="px-3 py-3">Lịch / Hạn xử lý</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    Đang tải dữ liệu quy trình tuyển dụng...
                  </td>
                </tr>
              )}

              {!loading && pagedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    Chưa có hồ sơ nào phù hợp bộ lọc hiện tại.
                  </td>
                </tr>
              )}

              {!loading &&
                pagedRows.map((row, idx) => {
                  const avatarTone = AVATAR_TONES[idx % AVATAR_TONES.length];
                  const menuOpen = openMenuKey === row.key;
                  return (
                    <tr key={row.key} className="transition hover:bg-sky-50/35">
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${row.candidateName}`}
                          checked={Boolean(selectedKeys[row.key])}
                          onChange={(e) =>
                            setSelectedKeys((prev) => ({ ...prev, [row.key]: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={clsx(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              avatarTone,
                            )}
                          >
                            {initials(row.candidateName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#072348]">
                              {row.candidateName}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {row.candidateRole ?? row.jobTitle}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-[13px] font-medium text-slate-700">
                        {row.jobTitle}
                      </td>

                      <td className="px-3 py-3.5">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold',
                            row.stage === 'interview' && 'border-sky-200 bg-sky-50 text-[#0B468C]',
                            row.stage === 'offer' && 'border-accent-200 bg-accent-50 text-accent-800',
                            row.stage === 'onboarding' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                          )}
                        >
                          {row.stage === 'interview' && <CalendarDays className="h-3.5 w-3.5" />}
                          {row.stage === 'offer' && <FileText className="h-3.5 w-3.5" />}
                          {row.stage === 'onboarding' && <Briefcase className="h-3.5 w-3.5" />}
                          {row.stage === 'interview'
                            ? 'Lịch phỏng vấn'
                            : row.stage === 'offer'
                              ? 'Đề nghị làm việc'
                              : 'Nhận việc'}
                        </span>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex items-start gap-1.5 text-xs">
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <div>
                            <p className="font-semibold text-slate-800">{row.scheduleMain}</p>
                            {row.scheduleSub && (
                              <p className="text-[11px] text-slate-500">{row.scheduleSub}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                            row.statusTone === 'sky' && 'border-sky-200 bg-sky-50 text-[#0B468C]',
                            row.statusTone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800',
                            row.statusTone === 'emerald' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                            row.statusTone === 'rose' && 'border-rose-200 bg-rose-50 text-rose-600',
                            row.statusTone === 'slate' && 'border-slate-200 bg-slate-100 text-slate-600',
                          )}
                        >
                          {row.statusText}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {row.needsSchedule ? (
                            <button
                              type="button"
                              onClick={() =>
                                setScheduleFor({
                                  id: row.applicationId,
                                  name: row.candidateName,
                                })
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#072348] transition hover:border-brand-300 hover:bg-slate-50"
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                              Đặt lịch PV
                            </button>
                          ) : (
                            <Link
                              href={`/candidates/${row.candidateId}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#072348] transition hover:border-brand-300 hover:bg-slate-50"
                            >
                              <UserRound className="h-3.5 w-3.5" />
                              Xem hồ sơ
                            </Link>
                          )}

                          <div
                            ref={menuOpen ? menuWrapRef : null}
                            className="relative"
                          >
                            <button
                              type="button"
                              aria-label="Thao tác khác"
                              onClick={() => setOpenMenuKey(menuOpen ? null : row.key)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>

                            {menuOpen && (
                              <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-lg">
                                <Link
                                  href={`/candidates/${row.candidateId}`}
                                  onClick={() => setOpenMenuKey(null)}
                                  className="block px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Xem hồ sơ ứng viên
                                </Link>
                                <Link
                                  href={`/jobs/${row.jobId}/applicants`}
                                  onClick={() => setOpenMenuKey(null)}
                                  className="block px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Mở bảng Kanban vị trí
                                </Link>

                                {row.interview?.status === InterviewStatus.Scheduled && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuKey(null);
                                        interviewStatusMut.mutate({
                                          id: row.interview!.id,
                                          status: InterviewStatus.Completed,
                                        });
                                      }}
                                      className="flex w-full items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Đánh dấu hoàn thành
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuKey(null);
                                        interviewStatusMut.mutate({
                                          id: row.interview!.id,
                                          status: InterviewStatus.Cancelled,
                                        });
                                      }}
                                      className="block w-full px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                    >
                                      Huỷ lịch phỏng vấn
                                    </button>
                                  </>
                                )}

                                {row.offer?.status === OfferStatus.Accepted && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuKey(null);
                                      setOnboardFor({
                                        applicationId: row.offer!.applicationId,
                                        name: row.candidateName,
                                        startDate: row.offer!.startDate ?? undefined,
                                      });
                                    }}
                                    className="block w-full px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                  >
                                    Bắt đầu nhận việc
                                  </button>
                                )}

                                {row.offer?.status === OfferStatus.Pending && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuKey(null);
                                      offerStatusMut.mutate({
                                        id: row.offer!.id,
                                        status: OfferStatus.Withdrawn,
                                      });
                                    }}
                                    className="block w-full px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                  >
                                    Rút đề nghị làm việc
                                  </button>
                                )}

                                {row.onboarding &&
                                  row.onboarding.status !== OnboardingStatus.Completed && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuKey(null);
                                        onboardingStatusMut.mutate({
                                          id: row.onboarding!.id,
                                          status: OnboardingStatus.Completed,
                                        });
                                      }}
                                      className="block w-full px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                    >
                                      Đánh dấu đã nhận việc
                                    </button>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Hiển thị{' '}
              <strong className="font-semibold text-slate-700">
                {(safePage - 1) * pageSize + 1} – {Math.min(safePage * pageSize, filtered.length)}
              </strong>{' '}
              trên <strong className="font-semibold text-slate-700">{filtered.length}</strong> ứng viên
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, safePage - 3), Math.max(5, safePage + 2))
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={clsx(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition',
                        p === safePage
                          ? 'bg-[#072348] text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-xs text-slate-500">
              <span>Số dòng/trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as 10 | 20 | 50);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#072348] outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {scheduleFor && (
        <ScheduleInterviewModal
          applicationId={scheduleFor.id}
          candidateName={scheduleFor.name}
          onClose={() => setScheduleFor(null)}
          onScheduled={invalidateAll}
        />
      )}

      {onboardFor && (
        <StartOnboardingModal
          applicationId={onboardFor.applicationId}
          candidateName={onboardFor.name}
          defaultStartDate={onboardFor.startDate}
          onClose={() => setOnboardFor(null)}
          onStarted={invalidateAll}
        />
      )}
    </AppShell>
  );
}
