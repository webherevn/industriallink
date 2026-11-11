'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Eye,
  FileSearch,
  Headphones,
  ListChecks,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  JOB_LEVEL_LABEL,
  JobTrack,
  SOURCING_OUTREACH_STATUS_META,
  SOURCING_QUOTA_LABELS,
  formatJobTitle,
  type CandidateMatchView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingOutreachItem,
  type RecruiterSourcingScanRoundView,
  type SourcingOutreachStatus,
  type SourcingQuotaKind,
} from '@industriallink/contracts';
import { JdSalesCreateFlow } from '@/app/jobs/new/sales-create-flow';
import { JdTechnicalCreateFlow } from '@/app/jobs/new/technical-create-flow';
import {
  SourcingCandidateDrawer,
  SourcingJdRevisionModal,
  SourcingProgressReportModal,
  type SourcingDrawerSection,
} from '@/components/recruiter-sourcing-all-in-one';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { addCandidateShortlist, getCandidateById, removeCandidateShortlist } from '@/lib/candidate';
import { EXPERIENCE_LABEL, formatVndAmount } from '@/lib/format';
import { getJob, listMyJobs } from '@/lib/jobs';
import { formatMatchPct, matchRingColor } from '@/lib/match-percent';
import { sourcingCandidatesForJob } from '@/lib/matching';
import { consumeRecruiterSourcing, fetchRecruiterSourcing } from '@/lib/recruiter-billing';

function potentialOpenCreditCost(score: number): 1 | 2 {
  const pct = Math.max(0, Math.min(100, score));
  return pct >= 80 ? 2 : 1;
}

function formatPersonName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      const first = word.charAt(0).toLocaleUpperCase('vi-VN');
      const rest = word.slice(1).toLocaleLowerCase('vi-VN');
      return `${first}${rest}`;
    })
    .join(' ');
}

function fmtQuota(used: number, quota: number | null, remaining: number | null) {
  if (quota == null) return `${used} / không giới hạn`;
  return `${used} / ${quota} · còn ${remaining ?? 0}`;
}

function usageLabel(kind: string) {
  if (kind === 'profile_open') return 'Credit';
  if (kind === 'search_round') return 'Báo cáo';
  if (kind === 'auto_scan') return 'Quét tự động';
  return SOURCING_QUOTA_LABELS[kind as SourcingQuotaKind] ?? kind;
}

function openUsageCreditCount(note: string | null | undefined): number {
  if (!note?.startsWith('open:')) return 1;
  const parts = note.split(':');
  const n = parts.length >= 3 ? Number(parts[2]) : 1;
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function cycleEnded(endsAt: string | null | undefined) {
  return Boolean(endsAt && new Date(endsAt).getTime() < Date.now());
}

function formatScanRoundTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

function formatRemainingDaysFromStart(createdAtIso: string | null | undefined): string {
  if (!createdAtIso) return 'Bảo lưu 45 ngày';
  const deadlineMs = new Date(createdAtIso).getTime() + 45 * 24 * 60 * 60 * 1000;
  const diffMs = deadlineMs - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(deadlineMs));
  if (days <= 0) return `Hết hạn (${dateLabel})`;
  return `Bảo lưu còn ${days} ngày (${dateLabel})`;
}

function getPreservationPeriodInfo(createdAtIso: string | null | undefined): {
  remainingText: string;
  expiryDateText: string;
  expired: boolean;
} {
  if (!createdAtIso) {
    return {
      remainingText: 'Còn 45 ngày',
      expiryDateText: 'Bảo lưu theo gói',
      expired: false,
    };
  }
  const deadline = new Date(new Date(createdAtIso).getTime() + 45 * 24 * 60 * 60 * 1000);
  const diffMs = deadline.getTime() - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const dd = String(deadline.getDate()).padStart(2, '0');
  const mm = String(deadline.getMonth() + 1).padStart(2, '0');
  const yyyy = deadline.getFullYear();
  const fullDate = `${dd}/${mm}/${yyyy}`;
  if (days <= 0) {
    return {
      remainingText: 'Đã hết hạn',
      expiryDateText: `Hết hạn: ${fullDate}`,
      expired: true,
    };
  }
  return {
    remainingText: `Còn ${days} ngày`,
    expiryDateText: `Hết hạn: ${fullDate}`,
    expired: false,
  };
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Đang săn 2h/lần',
  in_progress: 'Đang săn 2h/lần',
  shortlisted: 'Đã có Shortlist',
  closed: 'Đã đóng',
};

export function RecruiterSourcingWorkspace() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [jobId, setJobId] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'select' | 'create'>('select');
  const [createTrack, setCreateTrack] = useState<JobTrack>(JobTrack.Sales);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [viewCriteriaModalOpen, setViewCriteriaModalOpen] = useState(false);
  const [drawerCandidate, setDrawerCandidate] = useState<CandidateMatchView | null>(null);
  const [drawerSection, setDrawerSection] = useState<SourcingDrawerSection>('overview');
  const [historyPage, setHistoryPage] = useState(1);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const syncedScanEngagementsRef = useRef<Set<string>>(new Set());

  const openCandidateDrawer = (
    row: CandidateMatchView,
    section: SourcingDrawerSection = 'overview',
  ) => {
    setDrawerSection(section);
    setDrawerCandidate(row);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['recruiter-sourcing'],
    queryFn: fetchRecruiterSourcing,
  });
  const { data: jobs } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    staleTime: 60_000,
  });

  const consume = useMutation({
    mutationFn: consumeRecruiterSourcing,
    onSuccess: (ws, vars) => {
      setBanner({
        tone: 'ok',
        text:
          vars.kind === 'position'
            ? 'Đã tạo Tin Săn (bảo lưu hạn 45 ngày) và bắt đầu quét ứng viên phù hợp.'
            : `Đã ghi ${usageLabel(vars.kind).toLowerCase()}.`,
      });
      void qc.setQueryData(['recruiter-sourcing'], ws);
      void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      void qc.invalidateQueries({ queryKey: ['my-jobs'] });
      void qc.invalidateQueries({ queryKey: ['sourcing-hunt'] });
      if (vars.kind === 'position') {
        setTitle('');
        setJobId('');
        setCreateModalOpen(false);
        setModalMode('select');
        const newest = ws.engagements[0]?.id;
        if (newest) {
          setActiveId(newest);
          setSelectedRoundId('all');
        }
      }
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Không trừ được hạn mức' }),
  });

  const quickShortlist = useMutation({
    mutationFn: async (cand: CandidateMatchView) => {
      if (!selected) throw new Error('Chưa chọn vị trí Săn');
      const currentlyShortlisted = engagementShortlistedIds.includes(cand.candidateId);
      if (currentlyShortlisted) {
        await removeCandidateShortlist(cand.candidateId).catch(() => null);
        const ws = await consumeRecruiterSourcing({
          kind: 'shortlist',
          engagementId: selected,
          jobId: huntJobId ?? undefined,
          note: `unshortlist:${cand.candidateId}:${cand.displayName}`,
        });
        return { ws, removed: true };
      }
      await addCandidateShortlist(cand.candidateId).catch(() => null);
      const ws = await consumeRecruiterSourcing({
        kind: 'shortlist',
        engagementId: selected,
        jobId: huntJobId ?? undefined,
        note: `shortlist:${cand.candidateId}:${cand.displayName}`,
      });
      return { ws, removed: false };
    },
    onSuccess: ({ ws, removed }, cand) => {
      void qc.setQueryData(['recruiter-sourcing'], ws);
      void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      setBanner({
        tone: 'ok',
        text: removed
          ? `Đã bỏ ứng viên «${cand.displayName}» khỏi danh sách Shortlist.`
          : `Đã đưa ứng viên «${cand.displayName}» vào danh sách Shortlist!`,
      });
    },
    onError: (err) =>
      setBanner({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không cập nhật được Shortlist',
      }),
  });

  const quickOutreach = useMutation({
    mutationFn: async (cand: CandidateMatchView) => {
      if (!selected) throw new Error('Chưa chọn vị trí Săn');
      const cleanName = cand.displayName.replace(/:/g, ' ');
      const ws = await consumeRecruiterSourcing({
        kind: 'shortlist',
        engagementId: selected,
        jobId: huntJobId ?? undefined,
        note: `outreach:${cand.candidateId}:${cleanName}:Nhờ CSKH Inlink liên hệ kết nối & thẩm định ứng viên`,
      });
      await getCandidateById(
        cand.candidateId,
        'sourcing',
        formatMatchPct(cand.match.score),
      ).catch(() => null);
      return ws;
    },
    onSuccess: (ws, cand) => {
      void qc.setQueryData(['recruiter-sourcing'], ws);
      void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      void qc.invalidateQueries({ queryKey: ['sourcing-hunt', huntJobId] });
      setBanner({
        tone: 'ok',
        text: `Đã bàn giao ứng viên «${cand.displayName}» cho đội ngũ CSKH Inlink liên hệ kết nối & mở khóa hồ sơ!`,
      });
    },
    onError: (err) =>
      setBanner({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không giao được ứng viên cho Inlink liên hệ',
      }),
  });

  const e = data?.entitlements;
  const hasPlan = Boolean(e?.assignment?.isActive);
  const ended = cycleEnded(e?.assignment?.endsAt);
  const validEngagements = useMemo(
    () => (data?.engagements ?? []).filter((eng) => Boolean(eng.jobId)),
    [data?.engagements],
  );
  const selected =
    activeId && validEngagements.some((eng) => eng.id === activeId)
      ? activeId
      : validEngagements[0]?.id ?? null;
  const scope = e?.serviceScope ?? [];
  const shortlistInScope = scope.length === 0 || scope.includes('shortlist');
  const hasOutreach =
    scope.includes('outreach') ||
    e?.planCode === 'SAN_CHUYEN_SAU' ||
    (e?.outreachQuota != null && e.outreachQuota > 0);
  const selectedEngagement = validEngagements.find((eng) => eng.id === selected) ?? null;
  const huntJobId = selectedEngagement?.jobId ?? null;

  const engagementScanRounds = useMemo(
    () =>
      (data?.scanRounds ?? [])
        .filter((r) => r.engagementId === selected)
        .sort((a, b) => b.roundNumber - a.roundNumber),
    [data?.scanRounds, selected],
  );

  const engagementShortlistedIds = useMemo<string[]>(
    () => (selected ? data?.shortlistedByEngagement?.[selected] ?? [] : []),
    [data?.shortlistedByEngagement, selected],
  );

  const engagementOutreachList = useMemo<RecruiterSourcingOutreachItem[]>(
    () => (selected ? data?.outreachByEngagement?.[selected] ?? [] : []),
    [data?.outreachByEngagement, selected],
  );

  const engagementOutreachIds = useMemo<string[]>(
    () => engagementOutreachList.map((o) => o.candidateId),
    [engagementOutreachList],
  );

  const engagementReports = useMemo(
    () => (data?.reports ?? []).filter((r) => !selected || r.engagementId === selected),
    [data?.reports, selected],
  );

  const hunt = useQuery({
    queryKey: ['sourcing-hunt', huntJobId],
    queryFn: () => sourcingCandidatesForJob(huntJobId!),
    enabled: Boolean(hasPlan && huntJobId && !ended),
  });

  useEffect(() => {
    if (
      hunt.isSuccess &&
      selected &&
      engagementScanRounds.length === 0 &&
      !syncedScanEngagementsRef.current.has(selected)
    ) {
      syncedScanEngagementsRef.current.add(selected);
      void qc.invalidateQueries({ queryKey: ['recruiter-sourcing'] });
    }
  }, [hunt.isSuccess, selected, engagementScanRounds.length, qc]);

  const allResults = hunt.data ?? [];
  const appliedCandidates = useMemo(
    () => allResults.filter((r) => r.applied),
    [allResults],
  );
  const potentialCandidates = useMemo(
    () => allResults.filter((r) => !r.applied),
    [allResults],
  );
  const highMatchCount = useMemo(
    () => potentialCandidates.filter((r) => r.match.score >= 80).length,
    [potentialCandidates],
  );
  const openedCount = useMemo(
    () =>
      potentialCandidates.filter(
        (r) => Boolean(r.viewed) || engagementOutreachIds.includes(r.candidateId),
      ).length,
    [potentialCandidates, engagementOutreachIds],
  );
  const connectedCount = useMemo(
    () => potentialCandidates.filter((r) => Boolean(r.connected)).length,
    [potentialCandidates],
  );

  const outreachStats = useMemo(() => {
    const appliedIdSet = new Set(appliedCandidates.map((c) => c.candidateId));
    let contacted = 0;
    let agreed = 0;
    let guided = 0;
    let applied = 0;
    for (const item of engagementOutreachList) {
      const st: SourcingOutreachStatus = appliedIdSet.has(item.candidateId)
        ? 'applied'
        : item.status ?? 'pending_contact';
      if (st !== 'pending_contact') contacted += 1;
      if (st === 'agreed' || st === 'guided_pending_apply' || st === 'applied') agreed += 1;
      if (st === 'guided_pending_apply' || st === 'applied') guided += 1;
      if (st === 'applied') applied += 1;
    }
    return {
      handedOver: engagementOutreachList.length,
      contacted,
      agreed,
      guided,
      applied,
    };
  }, [engagementOutreachList, appliedCandidates]);

  const canOpenMorePositions =
    hasPlan && !ended && (e?.positionsRemaining === null || (e?.positionsRemaining ?? 0) > 0);

  return (
    <RecruiterShell pinSidebar>
      <div className="ntd-form recruiter-dash space-y-5">
        <header className="brand-hero-surface recruiter-dash-rise rounded-3xl px-5 py-6 sm:px-7">
          <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#E8872A] via-amber-200 to-transparent" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                Săn nhân sự · All-in-One
              </p>
              <h1 className="mt-1.5 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                {hasPlan && e?.planName ? e.planName : 'Gói Săn & hạn mức'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                {hasPlan
                  ? ended
                    ? 'Kỳ gói đã kết thúc.'
                    : 'iLink đối chiếu ứng viên theo tin bạn gắn, tự động quét 2h/lần và xử lý tuyển dụng từ A–Z ngay tại đây.'
                  : 'Kích hoạt gói để iLink săn ứng viên cho vị trí đang tuyển.'}
              </p>
            </div>
            {hasPlan ? (
              <button
                type="button"
                disabled={!canOpenMorePositions}
                onClick={() => {
                  setModalMode('select');
                  setCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#E8872A] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d6761b] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Tạo Tin Săn
              </button>
            ) : null}
          </div>
        </header>

        {banner ? (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm shadow-sm',
              banner.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800',
            )}
          >
            {banner.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            {banner.text}
          </div>
        ) : null}

        {isLoading ? (
          <div className="recruiter-dash-skel h-48 rounded-3xl" />
        ) : isError ? (
          <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
            <p className="font-semibold text-[#072348]">Không tải được gói Săn</p>
            <p className="mt-1 text-sm text-slate-500">
              {error instanceof ApiError ? error.message : 'Thử lại sau.'}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex rounded-xl bg-[#072348] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d3b80]"
              onClick={() => void refetch()}
            >
              Thử lại
            </button>
          </section>
        ) : !hasPlan ? (
          <section className="relative overflow-hidden rounded-3xl border border-[#d7e3f2] bg-white p-6 shadow-sm sm:p-8">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-100 blur-2xl" />
            <Sparkles className="h-6 w-6 text-[#E8872A]" />
            <p className="mt-3 text-xl font-bold text-[#072348]">Chưa có gói Săn</p>
            <p className="mt-1 max-w-lg text-sm text-slate-500">
              Chọn gói trên bảng giá. Sau khi kích hoạt, iLink đưa danh sách ứng viên phù hợp vào đây.
            </p>
            <Link
              href="/recruiter/pricing"
              className="mt-5 inline-flex items-center rounded-xl bg-[#E8872A] px-4 py-2.5 text-sm font-bold text-[#072348] shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-400"
            >
              Xem gói Săn nhân sự
            </Link>
          </section>
        ) : (
          <>
            <QuotaGrid
              entitlements={e!}
              hasOutreach={hasOutreach}
              totalMatchedCount={potentialCandidates.length}
              highMatchCount={highMatchCount}
              shortlistedCount={engagementShortlistedIds.length}
              openedCount={openedCount}
              connectedCount={connectedCount}
              outreachStats={outreachStats}
              onOpenPosition={
                canOpenMorePositions
                  ? () => {
                      setModalMode('select');
                      setCreateModalOpen(true);
                    }
                  : undefined
              }
              onOpenReport={selected ? () => setReportModalOpen(true) : undefined}
              onOpenRevision={selected && huntJobId ? () => setRevisionModalOpen(true) : undefined}
              onFilterAllPotential={selected ? () => setSelectedRoundId('all') : undefined}
              onFilterViewed={selected ? () => setSelectedRoundId('viewed') : undefined}
              onFilterShortlist={selected ? () => setSelectedRoundId('shortlist') : undefined}
              onFilterOutreach={selected && hasOutreach ? () => setSelectedRoundId('outreach') : undefined}
            />

            {/* DANH SÁCH TIN SĂN */}
            <section className="rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold uppercase tracking-tight text-slate-900">
                    DANH SÁCH TIN SĂN
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Danh sách tin săn của bạn · Bấm vào ứng viên bên dưới để mở liên hệ, kết nối & đặt lịch phỏng vấn
                    ngay tại chỗ
                  </p>
                </div>
              </div>

              {validEngagements.length === 0 ? (
                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-[#f8fafc] px-4 py-10 text-center">
                  <Sparkles className="h-6 w-6 text-[#E8872A]" />
                  <p className="mt-2 text-sm font-medium text-slate-600">Danh sách tin săn hiển thị ở đây</p>
                  {canOpenMorePositions ? (
                    <button
                      type="button"
                      onClick={() => {
                        setModalMode('select');
                        setCreateModalOpen(true);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#072348] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3b80]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tạo Tin Săn ngay
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {validEngagements.map((eng) => {
                    const isActive = selected === eng.id;
                    const roundCount = (data?.scanRounds ?? []).filter((r) => r.engagementId === eng.id).length;
                    const slCount = (data?.shortlistedByEngagement?.[eng.id] ?? []).length;
                    const preserveInfo = getPreservationPeriodInfo(eng.createdAt);
                    const linkedJob = (jobs ?? []).find((j) => j.id === eng.jobId);
                    const linkedLocation = linkedJob?.location?.trim();
                    const isRunning = eng.status !== 'closed' && !preserveInfo.expired && !ended;

                    return (
                      <div
                        key={eng.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setActiveId(eng.id);
                          setSelectedRoundId('all');
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            setActiveId(eng.id);
                            setSelectedRoundId('all');
                          }
                        }}
                        className={clsx(
                          'group flex cursor-pointer flex-col justify-between rounded-2xl border p-4 sm:p-5 text-left transition',
                          isActive
                            ? 'border-[#072348] bg-[#072348] text-white shadow-md'
                            : 'border-[#d7e3f2] bg-[#f8fafc] text-slate-800 hover:-translate-y-0.5 hover:border-[#52749a] hover:bg-white',
                        )}
                      >
                        {/* TẦNG 1: TIÊU ĐỀ TIN SĂN & TRẠNG THÁI */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-[15px] font-extrabold leading-snug">
                              {formatJobTitle(eng.title)}
                            </p>
                            <p
                              className={clsx(
                                'mt-1 line-clamp-1 text-xs',
                                isActive ? 'text-white/70' : 'text-slate-500',
                              )}
                            >
                              Tin săn{linkedLocation ? ` · ${linkedLocation}` : linkedJob?.title ? ` · ${formatJobTitle(linkedJob.title)}` : ''}
                            </p>
                          </div>

                          <span
                            className={clsx(
                              'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                              isRunning
                                ? isActive
                                  ? 'bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/30'
                                  : 'bg-emerald-100/90 text-emerald-700'
                                : isActive
                                  ? 'bg-white/15 text-white/80'
                                  : 'bg-slate-200 text-slate-600',
                            )}
                          >
                            {isRunning ? 'Đang hoạt động' : 'Đã kết thúc'}
                          </span>
                        </div>

                        {/* TẦNG 2: THỜI GIAN BẢO LƯU & ĐỢT QUÉT ỨNG VIÊN */}
                        <div
                          className={clsx(
                            'my-3.5 grid grid-cols-2 items-start gap-3 border-y py-3',
                            isActive ? 'border-white/15' : 'border-slate-200/80',
                          )}
                        >
                          <div>
                            <p
                              className={clsx(
                                'text-[11px] font-medium',
                                isActive ? 'text-white/65' : 'text-slate-500',
                              )}
                            >
                              Thời gian bảo lưu
                            </p>
                            <p
                              className={clsx(
                                'mt-0.5 text-[15px] font-extrabold',
                                isActive ? 'text-white' : 'text-slate-900',
                              )}
                            >
                              {preserveInfo.remainingText}
                            </p>
                            <p
                              className={clsx(
                                'mt-0.5 text-[11px]',
                                isActive ? 'text-white/65' : 'text-slate-500',
                              )}
                            >
                              {preserveInfo.expiryDateText}
                            </p>
                          </div>

                          <div className="text-right">
                            <p
                              className={clsx(
                                'text-[11px] font-medium',
                                isActive ? 'text-white/65' : 'text-slate-500',
                              )}
                            >
                              Đợt quét ứng viên
                            </p>
                            <p
                              className={clsx(
                                'mt-0.5 text-[15px] font-extrabold',
                                isActive ? 'text-white' : 'text-slate-900',
                              )}
                            >
                              {roundCount} đợt
                            </p>
                            {slCount > 0 ? (
                              <p
                                className={clsx(
                                  'mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold',
                                  isActive ? 'text-amber-300' : 'text-[#E8872A]',
                                )}
                              >
                                <BookmarkCheck className="h-3 w-3 shrink-0" />
                                {slCount} Shortlist
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* TẦNG 3: TIÊU CHÍ TUYỂN DỤNG & 2 NÚT XEM / ĐIỀU CHỈNH */}
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={clsx(
                              'text-xs leading-snug',
                              isActive ? 'text-white/75' : 'text-slate-500',
                            )}
                          >
                            Tiêu chí tuyển dụng đã được thiết lập
                          </span>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <button
                              type="button"
                              disabled={!eng.jobId}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setActiveId(eng.id);
                                setViewCriteriaModalOpen(true);
                              }}
                              className={clsx(
                                'inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold transition disabled:opacity-40',
                                isActive
                                  ? 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-300/30 hover:bg-sky-400/30'
                                  : 'bg-sky-100/90 text-sky-700 hover:bg-sky-200/80',
                              )}
                            >
                              Xem tiêu chí
                            </button>

                            <button
                              type="button"
                              disabled={
                                ended ||
                                !eng.jobId ||
                                (e!.revisionsRemaining !== null && e!.revisionsRemaining <= 0)
                              }
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setActiveId(eng.id);
                                setRevisionModalOpen(true);
                              }}
                              className={clsx(
                                'inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold transition disabled:opacity-40',
                                isActive
                                  ? 'bg-[#E8872A] text-white shadow-2xs hover:bg-[#d4761d]'
                                  : 'bg-amber-100/90 text-[#c96a12] hover:bg-amber-200/80',
                              )}
                            >
                              Điều chỉnh tiêu chí
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2 CỘT ỨNG VIÊN: NỘP HỒ SƠ & TIỀM NĂNG */}
            <div className="grid gap-4 lg:grid-cols-2">
              <AppliedCandidatesColumn
                jobTitle={(jobs ?? []).find((job) => job.id === huntJobId)?.title ?? selectedEngagement?.title}
                loading={Boolean(huntJobId) && hunt.isLoading}
                error={
                  hunt.isError
                    ? hunt.error instanceof ApiError
                      ? hunt.error.message
                      : 'Không tải được danh sách'
                    : null
                }
                results={appliedCandidates}
                shortlistedIds={engagementShortlistedIds}
                shortlistRemaining={shortlistInScope ? e!.shortlistsRemaining : 0}
                onSelectCandidate={openCandidateDrawer}
                onQuickShortlist={(row) => quickShortlist.mutate(row)}
                ready={Boolean(huntJobId) && !ended}
              />

              <PotentialCandidatesColumn
                jobTitle={(jobs ?? []).find((job) => job.id === huntJobId)?.title ?? selectedEngagement?.title}
                loading={Boolean(huntJobId) && hunt.isLoading}
                error={
                  hunt.isError
                    ? hunt.error instanceof ApiError
                      ? hunt.error.message
                      : 'Không tải được danh sách'
                    : null
                }
                results={potentialCandidates}
                scanRounds={engagementScanRounds}
                shortlistedIds={engagementShortlistedIds}
                shortlistRemaining={shortlistInScope ? e!.shortlistsRemaining : 0}
                hasOutreach={hasOutreach}
                outreachIds={engagementOutreachIds}
                outreachList={engagementOutreachList}
                outreachQuota={e!.outreachQuota ?? e!.shortlistQuota ?? 15}
                outreachRemaining={e!.outreachRemaining ?? e!.shortlistsRemaining ?? 15}
                outreachPending={quickOutreach.isPending}
                selectedRoundId={selectedRoundId}
                onSelectRound={setSelectedRoundId}
                onSelectCandidate={openCandidateDrawer}
                onQuickShortlist={(row) => quickShortlist.mutate(row)}
                onQuickOutreach={(row) => quickOutreach.mutate(row)}
                ready={Boolean(huntJobId) && !ended}
              />
            </div>

            {/* LỊCH SỬ (PHÂN TRANG 7 MỤC / TRANG) */}
            <section className="rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
              {(() => {
                const allUsages = data?.usages ?? [];
                const pageSize = 7;
                const totalPages = Math.max(1, Math.ceil(allUsages.length / pageSize));
                const safePage = Math.min(Math.max(1, historyPage), totalPages);
                const pageItems = allUsages.slice((safePage - 1) * pageSize, safePage * pageSize);

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#072348]">
                        LỊCH SỬ HOẠT ĐỘNG ({allUsages.length})
                      </p>
                      {allUsages.length > pageSize ? (
                        <span className="text-xs font-medium text-slate-500">
                          Trang {safePage} / {totalPages}
                        </span>
                      ) : null}
                    </div>

                    {allUsages.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">Chưa có lần sử dụng.</p>
                    ) : (
                      <>
                        <ul className="mt-3 space-y-2">
                          {pageItems.map((u) => (
                            <li
                              key={u.id}
                              className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f9fc] px-3.5 py-2.5 text-sm"
                            >
                              <span className="min-w-0">
                                <strong className="text-[#072348]">{usageLabel(u.kind)}</strong>
                                {u.note?.startsWith('open:') ? (
                                  <span className="text-slate-500">
                                    {' '}
                                    · Mở hồ sơ (-{openUsageCreditCount(u.note)} Credit)
                                  </span>
                                ) : u.note ? (
                                  <span className="text-slate-500"> · {u.note}</span>
                                ) : null}
                              </span>
                              <span className="shrink-0 text-xs text-slate-400">
                                {new Intl.DateTimeFormat('vi-VN', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }).format(new Date(u.createdAt))}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {totalPages > 1 ? (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <span className="text-xs text-slate-500">
                              Hiển thị {(safePage - 1) * pageSize + 1}–
                              {Math.min(safePage * pageSize, allUsages.length)} trên tổng số{' '}
                              {allUsages.length} lịch sử
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={safePage <= 1}
                                onClick={() => setHistoryPage(safePage - 1)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                              >
                                ← Trước
                              </button>
                              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setHistoryPage(p)}
                                  className={clsx(
                                    'inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2.5 text-xs font-bold transition',
                                    p === safePage
                                      ? 'bg-[#072348] text-white shadow-xs'
                                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                                  )}
                                >
                                  {p}
                                </button>
                              ))}
                              <button
                                type="button"
                                disabled={safePage >= totalPages}
                                onClick={() => setHistoryPage(safePage + 1)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                              >
                                Sau →
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </>
                );
              })()}
            </section>
          </>
        )}
      </div>

      {/* POPUP + TẠO TIN SĂN (ALL-IN-ONE) */}
      {createModalOpen && hasPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs sm:p-6">
          <div
            className={clsx(
              'relative max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7',
              modalMode === 'create' ? 'max-w-5xl' : 'max-w-xl',
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#E8872A]">
                  Săn nhân sự · All-in-One
                </p>
                <h3 className="mt-0.5 text-xl font-bold text-[#072348]">
                  {modalMode === 'select' ? 'Tạo Tin Săn' : 'Tạo Tin Săn Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalMode === 'select' ? (
              <div className="mt-4 space-y-4">
                {(jobs ?? []).length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs leading-relaxed text-amber-950">
                    <p className="font-bold text-[#072348]">
                      Bạn có muốn chuyển tin đăng này thành tin săn hay không?
                    </p>
                    <p className="mt-1 text-amber-900">
                      * Việc chuyển sang tin săn sẽ bảo lưu thời hạn tin đăng cũ 45 ngày cho bạn đồng thời giúp tối ưu
                      credit và gói tin của bạn tốt nhất.
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Chọn tin tuyển dụng (JD) có sẵn để chuyển thành Tin Săn
                  </label>
                  <select
                    value={jobId}
                    onChange={(ev) => {
                      const nextId = ev.target.value;
                      setJobId(nextId);
                      const matched = (jobs ?? []).find((j) => j.id === nextId);
                      if (matched && !title.trim()) {
                        setTitle(matched.title);
                      }
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#072348] focus:ring-2 focus:ring-[#072348]/15"
                  >
                    <option value="">-- Chọn JD có sẵn của doanh nghiệp --</option>
                    {(jobs ?? []).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.status === 'published' ? 'Đang hiển thị' : 'Nháp / Hết hạn'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setModalMode('create')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E8872A] bg-amber-50/70 px-4 py-2.5 text-sm font-bold text-[#c96a12] transition hover:bg-amber-100"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo Tin Săn Mới (Đăng JD tại đây)
                  </button>

                  <Button
                    disabled={consume.isPending || !jobId}
                    onClick={() => {
                      const selectedJob = (jobs ?? []).find((j) => j.id === jobId);
                      consume.mutate({
                        kind: 'position',
                        jobId,
                        title: selectedJob?.title || undefined,
                      });
                    }}
                  >
                    {consume.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Kích hoạt Tin Săn & Quét ngay
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                {createTrack === JobTrack.Technical ? (
                  <JdTechnicalCreateFlow
                    embedded
                    onSwitchTrack={setCreateTrack}
                    onCancel={() => setModalMode('select')}
                    onCreated={(createdJob) => {
                      consume.mutate({
                        kind: 'position',
                        jobId: createdJob.id,
                        title: createdJob.title,
                      });
                    }}
                  />
                ) : (
                  <JdSalesCreateFlow
                    embedded
                    onSwitchTrack={setCreateTrack}
                    onCancel={() => setModalMode('select')}
                    onCreated={(createdJob) => {
                      consume.mutate({
                        kind: 'position',
                        jobId: createdJob.id,
                        title: createdJob.title,
                      });
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* MODAL BÁO CÁO TIẾN ĐỘ & KHUYẾN NGHỊ AI */}
      {hasPlan && e ? (
        <SourcingProgressReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          engagementId={selected}
          engagementTitle={selectedEngagement?.title ?? ''}
          jobId={huntJobId}
          entitlements={e}
          allResults={allResults}
          scanRounds={engagementScanRounds}
          shortlistedIds={engagementShortlistedIds}
          savedReports={engagementReports}
          onWorkspaceUpdated={(ws, msg) => {
            void qc.setQueryData(['recruiter-sourcing'], ws);
            void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
            setBanner({ tone: 'ok', text: msg });
          }}
        />
      ) : null}

      {/* MODAL XEM TIÊU CHÍ TUYỂN DỤNG ĐÃ THIẾT LẬP */}
      {hasPlan && e ? (
        <SourcingViewCriteriaModal
          open={viewCriteriaModalOpen}
          onClose={() => setViewCriteriaModalOpen(false)}
          jobId={huntJobId}
          engagementTitle={selectedEngagement?.title ?? ''}
          revisionsRemaining={e.revisionsRemaining}
          onOpenRevision={() => {
            setViewCriteriaModalOpen(false);
            setRevisionModalOpen(true);
          }}
        />
      ) : null}

      {/* MODAL ĐIỀU CHỈNH TIÊU CHÍ JD TẠI CHỖ */}
      {hasPlan && e ? (
        <SourcingJdRevisionModal
          open={revisionModalOpen}
          onClose={() => setRevisionModalOpen(false)}
          engagementId={selected}
          jobId={huntJobId}
          revisionsRemaining={e.revisionsRemaining}
          allResults={allResults}
          onWorkspaceUpdated={(ws, msg) => {
            void qc.setQueryData(['recruiter-sourcing'], ws);
            void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
            setBanner({ tone: 'ok', text: msg });
          }}
        />
      ) : null}

      {/* DRAWER XỬ LÝ ỨNG VIÊN ALL-IN-ONE */}
      {hasPlan && e ? (
        <SourcingCandidateDrawer
          candidateRow={drawerCandidate}
          initialSection={drawerSection}
          onClose={() => setDrawerCandidate(null)}
          engagementId={selected}
          engagementTitle={selectedEngagement?.title ?? ''}
          jobId={huntJobId}
          entitlements={e}
          isShortlisted={
            drawerCandidate ? engagementShortlistedIds.includes(drawerCandidate.candidateId) : false
          }
          outreachItem={
            drawerCandidate
              ? engagementOutreachList.find((o) => o.candidateId === drawerCandidate.candidateId) ?? null
              : null
          }
          onShortlistSuccess={(ws, candName, removed) => {
            void qc.setQueryData(['recruiter-sourcing'], ws);
            void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
            setBanner({
              tone: 'ok',
              text: removed
                ? `Đã bỏ ứng viên «${candName}» khỏi danh sách Shortlist.`
                : `Đã đưa ứng viên «${candName}» vào danh sách Shortlist!`,
            });
          }}
          onOutreachSuccess={(ws, candName) => {
            void qc.setQueryData(['recruiter-sourcing'], ws);
            void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
            void qc.invalidateQueries({ queryKey: ['sourcing-hunt', huntJobId] });
            setBanner({
              tone: 'ok',
              text: `Đã bàn giao ứng viên «${candName}» cho đội ngũ CSKH Inlink liên hệ kết nối & mở khóa hồ sơ!`,
            });
          }}
          onProfileUnlocked={() => {
            void qc.invalidateQueries({ queryKey: ['recruiter-sourcing'] });
            void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
            void qc.invalidateQueries({ queryKey: ['sourcing-hunt', huntJobId] });
          }}
        />
      ) : null}
    </RecruiterShell>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = formatMatchPct(score);
  const r = 18;
  const c = 2 * Math.PI * r;
  const safe = Math.min(1, Math.max(0, score / 100));
  const offset = c * (1 - safe);
  const ringColor = matchRingColor(score);
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#fde68a" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-soft"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[11.5px] font-extrabold leading-none tracking-tight tabular-nums"
          style={{ color: ringColor }}
        >
          {pct === '100.0' ? '100' : pct}
          <span className="text-[8.5px] font-bold opacity-80">%</span>
        </span>
      </div>
    </div>
  );
}

const CANDIDATE_PAGE_SIZE = 6;

function AppliedCandidatesColumn({
  jobTitle,
  loading,
  error,
  results,
  shortlistedIds,
  shortlistRemaining,
  onSelectCandidate,
  onQuickShortlist,
  ready,
}: {
  jobTitle?: string;
  loading: boolean;
  error: string | null;
  results: CandidateMatchView[];
  shortlistedIds: string[];
  shortlistRemaining: number | null;
  onSelectCandidate: (row: CandidateMatchView, section?: SourcingDrawerSection) => void;
  onQuickShortlist: (row: CandidateMatchView) => void;
  ready: boolean;
}) {
  const [page, setPage] = useState(1);
  const [openMoreId, setOpenMoreId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [jobTitle, results.length]);

  useEffect(() => {
    if (!openMoreId) return;
    const close = () => setOpenMoreId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMoreId]);

  const totalPages = Math.max(1, Math.ceil(results.length / CANDIDATE_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedResults = useMemo(
    () => results.slice((safePage - 1) * CANDIDATE_PAGE_SIZE, safePage * CANDIDATE_PAGE_SIZE),
    [results, safePage],
  );

  return (
    <section className="flex flex-col rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h3 className="text-[15px] font-bold uppercase tracking-tight text-slate-900">
          DANH SÁCH ỨNG VIÊN ỨNG TUYỂN
        </h3>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
            Danh sách ứng viên đã nộp hồ sơ ứng tuyển của bạn
            {jobTitle ? ` · ${jobTitle}` : ''}
          </p>
          {ready && !loading ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-[#DCF5E7] px-3 py-1 text-xs font-semibold tabular-nums text-[#15803D]">
              {results.length} ứng viên
            </span>
          ) : null}
        </div>
      </div>

      {!ready ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#f8fafc] px-4 py-10 text-center">
          <p className="text-xs text-slate-500">Chọn hoặc tạo một Tin Săn để xem ứng viên đã nộp hồ sơ ứng tuyển.</p>
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-2">
          <div className="recruiter-dash-skel h-20 rounded-2xl" />
          <div className="recruiter-dash-skel h-20 rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-700">{error}</p>
      ) : results.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#f8fafc] px-4 py-10 text-center">
          <p className="text-xs text-slate-500">Chưa có ứng viên nộp hồ sơ trực tiếp vào tin săn này.</p>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-3.5">
            {pagedResults.map((row, index) => {
              const isShortlisted = shortlistedIds.includes(row.candidateId);
              const canShortlist = shortlistRemaining === null || shortlistRemaining > 0;
              const pctRawStr = formatMatchPct(row.match.score);
              const matchedSkills = row.match.matchedSkills ?? [];
              const visibleSkills = matchedSkills.slice(0, 3);
              const extraSkillsCount = Math.max(0, matchedSkills.length - visibleSkills.length);
              const locationDisplay = row.location ? row.location.replace(/\s*·\s*/g, ', ') : null;
              const moreOpen = openMoreId === row.candidateId;

              return (
                <li
                  key={row.candidateId}
                  className="animate-soft-rise"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <div className="group relative rounded-2xl border border-[#dce6f4] bg-white shadow-[0_1px_3px_rgba(7,35,72,0.03)] transition hover:border-[#b8cde8] hover:shadow-[0_6px_18px_rgba(7,35,72,0.07)]">
                    {/* TẦNG 1: KHỐI THÔNG TIN ỨNG VIÊN & ĐIỂM SÁNG CHUYÊN MÔN */}
                    <div className="flex items-start gap-3 sm:gap-4 px-4 pt-4 pb-3.5 sm:px-5">
                      <button
                        type="button"
                        onClick={() => onSelectCandidate(row, 'jd_match')}
                        title="Xem chi tiết đối chiếu JD"
                        className="shrink-0 rounded-full transition hover:scale-105"
                      >
                        <ScoreRing score={row.match.score} />
                      </button>

                      <div className="min-w-0 flex-1">
                        {/* Hàng 1: Tên + Nhãn Đã ứng tuyển + Nút Bookmark Shortlist góc phải */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectCandidate(row, 'overview')}
                              className="truncate text-left text-[15px] font-bold text-[#072348] transition hover:text-[#E8872A]"
                            >
                              {formatPersonName(row.displayName)}
                            </button>

                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                              Đã ứng tuyển
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={!isShortlisted && !canShortlist}
                            onClick={() => onQuickShortlist(row)}
                            title={
                              isShortlisted
                                ? 'Đã Shortlist · Bấm để bỏ khỏi Shortlist'
                                : 'Đưa ứng viên vào Shortlist'
                            }
                            className={clsx(
                              'inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition disabled:opacity-40',
                              isShortlisted
                                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/90 hover:bg-indigo-100/80'
                                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
                            )}
                          >
                            {isShortlisted ? (
                              <>
                                <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                                <span>Đã Shortlist</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span>Shortlist</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Hàng 2: Tách bạch Chức danh · Ngành nghề và Khu vực */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="inline-flex min-w-0 items-center gap-1 font-medium text-slate-700">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">
                              {row.currentPosition ? formatJobTitle(row.currentPosition) : 'Chưa cập nhật vị trí'}
                              {row.industry ? ` · ${row.industry}` : ''}
                            </span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 text-slate-500">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                            <span className="truncate">{locationDisplay ?? 'Chưa có địa điểm'}</span>
                          </span>
                        </div>

                        {/* Hàng 3: Điểm sáng chuyên môn / Kỹ năng khớp JD */}
                        {visibleSkills.length > 0 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {visibleSkills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex max-w-[180px] truncate rounded-md bg-[#F4F8FD] px-2 py-0.5 text-[11px] font-medium text-[#072348] ring-1 ring-[#dce7f5]"
                              >
                                ✓ {skill}
                              </span>
                            ))}
                            {extraSkillsCount > 0 ? (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
                                +{extraSkillsCount}
                              </span>
                            ) : null}
                          </div>
                        ) : row.match.reason ? (
                          <p className="mt-1.5 line-clamp-1 text-[11.5px] text-slate-500">
                            <Sparkles className="mr-1 inline h-3 w-3 text-[#E8872A]" />
                            {row.match.reason}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* TẦNG 2: THANH HÀNH ĐỘNG CHÂN THẺ (KHÔNG CÓ GIAO INLINK) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-slate-100 bg-[#FAFBFD] px-4 py-2.5 sm:px-5">
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectCandidate(row, 'jd_match')}
                          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-200/60 hover:text-[#072348]"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                          <span>Đối chiếu JD</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectCandidate(row, 'interview')}
                          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-200/60 hover:text-[#072348]"
                        >
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>Đặt lịch PV</span>
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            title="Tác vụ khác"
                            aria-label="Tác vụ khác"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMoreId((prev) => (prev === row.candidateId ? null : row.candidateId));
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-900"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {moreOpen ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute bottom-full left-0 z-20 mb-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMoreId(null);
                                  onSelectCandidate(row, 'contact');
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Phone className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                                <span>Liên hệ & Kết nối</span>
                              </button>
                              <Link
                                href={`/candidates/${row.candidateId}?from=sourcing&match=${pctRawStr}`}
                                target="_blank"
                                onClick={() => setOpenMoreId(null)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span>Trang hồ sơ đầy đủ</span>
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectCandidate(row, 'overview')}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#072348]/25 bg-white px-3.5 text-xs font-bold text-[#072348] transition hover:border-[#072348] hover:bg-[#072348] hover:text-white"
                      >
                        <span>Xem hồ sơ</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-500">
                Hiển thị {(safePage - 1) * CANDIDATE_PAGE_SIZE + 1}–
                {Math.min(safePage * CANDIDATE_PAGE_SIZE, results.length)} / {results.length} ứng viên
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Trước
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={clsx(
                      'inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11px] font-bold transition',
                      p === safePage
                        ? 'bg-[#072348] text-white shadow-2xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Sau →
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function PotentialCandidatesColumn({
  jobTitle,
  loading,
  error,
  results,
  scanRounds,
  shortlistedIds,
  shortlistRemaining,
  hasOutreach,
  outreachIds,
  outreachList,
  outreachQuota,
  outreachRemaining,
  outreachPending,
  selectedRoundId,
  onSelectRound,
  onSelectCandidate,
  onQuickShortlist,
  onQuickOutreach,
  ready,
}: {
  jobTitle?: string;
  loading: boolean;
  error: string | null;
  results: CandidateMatchView[];
  scanRounds: RecruiterSourcingScanRoundView[];
  shortlistedIds: string[];
  shortlistRemaining: number | null;
  hasOutreach: boolean;
  outreachIds: string[];
  outreachList: RecruiterSourcingOutreachItem[];
  outreachQuota: number | null;
  outreachRemaining: number | null;
  outreachPending: boolean;
  selectedRoundId: string;
  onSelectRound: (id: string) => void;
  onSelectCandidate: (row: CandidateMatchView, section?: SourcingDrawerSection) => void;
  onQuickShortlist: (row: CandidateMatchView) => void;
  onQuickOutreach: (row: CandidateMatchView) => void;
  ready: boolean;
}) {
  const [page, setPage] = useState(1);
  const [openMoreId, setOpenMoreId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMoreId) return;
    const close = () => setOpenMoreId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMoreId]);

  const outreachStatusByCand = useMemo(() => {
    const m = new Map<string, SourcingOutreachStatus>();
    for (const item of outreachList) {
      m.set(item.candidateId, item.status ?? 'pending_contact');
    }
    return m;
  }, [outreachList]);

  const isStatusTab =
    selectedRoundId === 'all' ||
    selectedRoundId === 'unviewed' ||
    selectedRoundId === 'viewed' ||
    selectedRoundId === 'shortlist' ||
    selectedRoundId === 'outreach';

  const activeRound = useMemo(
    () => (isStatusTab ? null : scanRounds.find((r) => r.id === selectedRoundId) ?? null),
    [isStatusTab, scanRounds, selectedRoundId],
  );

  const latestRoundNewSet = useMemo(() => {
    const targetRound = activeRound ?? scanRounds[0] ?? null;
    if (!targetRound) return new Set<string>();
    return new Set(targetRound.candidates.filter((c) => c.isNew).map((c) => c.candidateId));
  }, [activeRound, scanRounds]);

  const filteredResults = useMemo(() => {
    if (selectedRoundId === 'unviewed') {
      return results.filter((r) => !r.viewed && !outreachIds.includes(r.candidateId));
    }
    if (selectedRoundId === 'viewed') {
      return results.filter((r) => Boolean(r.viewed) || outreachIds.includes(r.candidateId));
    }
    if (selectedRoundId === 'shortlist') {
      return results.filter((r) => shortlistedIds.includes(r.candidateId));
    }
    if (selectedRoundId === 'outreach') {
      return results.filter((r) => outreachIds.includes(r.candidateId));
    }
    if (!activeRound) return results;
    const roundCandidateMap = new Map(activeRound.candidates.map((c) => [c.candidateId, c]));
    return results
      .filter((r) => roundCandidateMap.has(r.candidateId))
      .sort((a, b) => {
        const aNew = roundCandidateMap.get(a.candidateId)?.isNew ? 1 : 0;
        const bNew = roundCandidateMap.get(b.candidateId)?.isNew ? 1 : 0;
        if (bNew !== aNew) return bNew - aNew;
        return b.match.score - a.match.score;
      });
  }, [activeRound, outreachIds, results, selectedRoundId, shortlistedIds]);

  const unviewedPotentialCount = useMemo(
    () => results.filter((r) => !r.viewed && !outreachIds.includes(r.candidateId)).length,
    [outreachIds, results],
  );

  const viewedPotentialCount = useMemo(
    () => results.filter((r) => Boolean(r.viewed) || outreachIds.includes(r.candidateId)).length,
    [outreachIds, results],
  );

  const shortlistedPotentialCount = useMemo(
    () => results.filter((r) => shortlistedIds.includes(r.candidateId)).length,
    [results, shortlistedIds],
  );

  const outreachedPotentialCount = useMemo(
    () => results.filter((r) => outreachIds.includes(r.candidateId)).length,
    [outreachIds, results],
  );

  useEffect(() => {
    setPage(1);
  }, [selectedRoundId, jobTitle]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / CANDIDATE_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedResults = useMemo(
    () =>
      filteredResults.slice(
        (safePage - 1) * CANDIDATE_PAGE_SIZE,
        safePage * CANDIDATE_PAGE_SIZE,
      ),
    [filteredResults, safePage],
  );

  return (
    <section className="flex flex-col rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h3 className="text-[15px] font-bold uppercase tracking-tight text-slate-900">
          DANH SÁCH ỨNG VIÊN TIỀM NĂNG
        </h3>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
            AI Inlink tìm kiếm và đề xuất
            {jobTitle ? ` · ${jobTitle}` : ''}
          </p>
          {ready && !loading ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-[#FCEEE3] px-3 py-1 text-xs font-semibold tabular-nums text-[#9A3412]">
              {filteredResults.length} ứng viên
            </span>
          ) : null}
        </div>
      </div>

      {/* Bộ lọc trạng thái hồ sơ & chọn đợt quét tự động 2 giờ/lần */}
      {ready &&
      (results.length > 0 ||
        scanRounds.length > 0 ||
        shortlistedPotentialCount > 0 ||
        hasOutreach ||
        outreachedPotentialCount > 0) ? (
        <div className="mt-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectRound('all')}
              className={clsx(
                'inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold tabular-nums transition',
                selectedRoundId === 'all'
                  ? 'bg-[#E5F2FF] text-[#0969DA]'
                  : 'bg-[#F1F3F5] text-slate-700 hover:bg-slate-200/80',
              )}
            >
              Tất cả {results.length}
            </button>

            <button
              type="button"
              onClick={() => onSelectRound('unviewed')}
              className={clsx(
                'inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold tabular-nums transition',
                selectedRoundId === 'unviewed'
                  ? 'bg-[#E5F2FF] text-[#0969DA]'
                  : 'bg-[#F1F3F5] text-slate-700 hover:bg-slate-200/80',
              )}
            >
              Chưa xem {unviewedPotentialCount}
            </button>

            <button
              type="button"
              onClick={() => onSelectRound('viewed')}
              className={clsx(
                'inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold tabular-nums transition',
                selectedRoundId === 'viewed'
                  ? 'bg-[#E5F2FF] text-[#0969DA]'
                  : 'bg-[#F1F3F5] text-slate-700 hover:bg-slate-200/80',
              )}
            >
              Đã xem {viewedPotentialCount}
            </button>

            {hasOutreach || outreachedPotentialCount > 0 ? (
              <button
                type="button"
                onClick={() => onSelectRound('outreach')}
                className={clsx(
                  'inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold tabular-nums transition',
                  selectedRoundId === 'outreach'
                    ? 'bg-[#C8F0D8] text-[#0F6A2E] ring-1 ring-[#7EDBA2]'
                    : 'bg-[#DCF5E7] text-[#15803D] hover:bg-[#CEEFDC]',
                )}
              >
                Đã giao Inlink {outreachedPotentialCount}
                {outreachQuota != null ? `/${outreachQuota}` : ''}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onSelectRound('shortlist')}
              className={clsx(
                'inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold tabular-nums transition',
                selectedRoundId === 'shortlist'
                  ? 'bg-[#E5F2FF] text-[#0969DA]'
                  : 'bg-[#F1F3F5] text-slate-700 hover:bg-slate-200/80',
              )}
            >
              Shortlist {shortlistedPotentialCount}
            </button>
          </div>

          {scanRounds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f8fafc] px-3 py-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                <Clock className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                <span>Quét tự động 2h/lần (08:00 – 18:00)</span>
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Đợt quét:</span>
                <select
                  value={activeRound ? activeRound.id : 'all'}
                  onChange={(e) => onSelectRound(e.target.value)}
                  className={clsx(
                    'h-6 rounded-lg border px-2 text-[11px] font-semibold outline-none transition',
                    activeRound
                      ? 'border-[#E8872A] bg-amber-50/90 text-[#072348]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  )}
                >
                  <option value="all">Tất cả ({scanRounds.length} đợt quét)</option>
                  {scanRounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Đợt #{round.roundNumber} · {formatScanRoundTime(round.createdAt)}
                      {round.newCount > 0 ? ` (+${round.newCount} mới)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!ready ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#f8fafc] px-4 py-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-[#E8872A]" />
          <p className="mt-2 text-xs text-slate-500">
            Bấm <strong>+ Tạo Tin Săn</strong> để inlink quét và xếp hạng ứng viên tiềm năng phù hợp cao xuống thấp.
          </p>
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-2">
          <div className="recruiter-dash-skel h-20 rounded-2xl" />
          <div className="recruiter-dash-skel h-20 rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-700">{error}</p>
      ) : filteredResults.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#f8fafc] px-4 py-10 text-center">
          <p className="text-xs text-slate-500">
            {selectedRoundId === 'unviewed'
              ? 'Tất cả ứng viên tiềm năng trong danh sách hiện tại đều đã được xem.'
              : selectedRoundId === 'viewed'
                ? 'Chưa có ứng viên tiềm năng nào được mở xem. Bấm «Mở hồ sơ» trên thẻ ứng viên để xem chi tiết.'
                : selectedRoundId === 'outreach'
                  ? 'Chưa có ứng viên nào được giao cho Inlink liên hệ. Bấm «Giao Inlink» trên thẻ ứng viên hoặc trong chi tiết hồ sơ để bàn giao cho đội ngũ CSKH Inlink.'
                  : selectedRoundId === 'shortlist'
                    ? 'Chưa có ứng viên nào trong danh sách Shortlist. Bấm nút «Shortlist» trên thẻ ứng viên để đưa vào đây.'
                    : 'Chưa có ứng viên tiềm năng khớp ở đợt tìm kiếm này. Hệ thống sẽ tiếp tục quét tự động 2 giờ/lần.'}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-3.5">
            {pagedResults.map((row, index) => {
              const creditCost = potentialOpenCreditCost(row.match.score);
              const isNewlyDiscovered = latestRoundNewSet.has(row.candidateId);
              const isShortlisted = shortlistedIds.includes(row.candidateId);
              const isOutreached = outreachIds.includes(row.candidateId);
              const isUnlocked = Boolean(row.viewed || isOutreached);
              const canShortlist = shortlistRemaining === null || shortlistRemaining > 0;
              const canOutreach = outreachRemaining === null || outreachRemaining > 0;
              const pctRawStr = formatMatchPct(row.match.score);
              const matchedSkills = row.match.matchedSkills ?? [];
              const visibleSkills = matchedSkills.slice(0, 3);
              const extraSkillsCount = Math.max(0, matchedSkills.length - visibleSkills.length);
              const locationDisplay = row.location ? row.location.replace(/\s*·\s*/g, ', ') : null;
              const moreOpen = openMoreId === row.candidateId;

              return (
                <li
                  key={row.candidateId}
                  className="animate-soft-rise"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <div className="group relative rounded-2xl border border-[#dce6f4] bg-white shadow-[0_1px_3px_rgba(7,35,72,0.03)] transition hover:border-[#b8cde8] hover:shadow-[0_6px_18px_rgba(7,35,72,0.07)]">
                    {/* TẦNG 1: KHỐI THÔNG TIN ỨNG VIÊN & ĐIỂM SÁNG CHUYÊN MÔN */}
                    <div className="flex items-start gap-3 sm:gap-4 px-4 pt-4 pb-3.5 sm:px-5">
                      {/* Vòng tròn tỉ lệ % đồng bộ từ trang AI Matching */}
                      <button
                        type="button"
                        onClick={() => onSelectCandidate(row, 'jd_match')}
                        title="Xem chi tiết đối chiếu JD"
                        className="shrink-0 rounded-full transition hover:scale-105"
                      >
                        <ScoreRing score={row.match.score} />
                      </button>

                      {/* Thông tin chính ứng viên */}
                      <div className="min-w-0 flex-1">
                        {/* Hàng 1: Tên + Trạng thái gộp gọn + Nút Bookmark Shortlist góc phải */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectCandidate(row, 'overview')}
                              className="truncate text-left text-[15px] font-bold text-[#072348] transition hover:text-[#E8872A]"
                            >
                              {formatPersonName(row.displayName)}
                            </button>

                            {isUnlocked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                                Đã xem
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">
                                Chưa xem
                              </span>
                            )}

                            {!isUnlocked && isNewlyDiscovered ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                                Mới phát hiện
                              </span>
                            ) : null}

                            {isOutreached ? (
                              (() => {
                                const st = outreachStatusByCand.get(row.candidateId) ?? 'pending_contact';
                                const meta = SOURCING_OUTREACH_STATUS_META[st];
                                const toneClass =
                                  st === 'applied' || st === 'agreed'
                                    ? 'bg-[#DCF5E7] text-[#15803D]'
                                    : st === 'guided_pending_apply'
                                      ? 'bg-[#E5F2FF] text-[#0969DA]'
                                      : st === 'declined'
                                        ? 'bg-rose-50 text-rose-700'
                                        : st === 'unreachable'
                                          ? 'bg-slate-100 text-slate-600'
                                          : 'bg-[#FCEEE3] text-[#9A3412]';
                                return (
                                  <span
                                    title={meta.description}
                                    className={clsx(
                                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                                      toneClass,
                                    )}
                                  >
                                    <Headphones className="h-2.5 w-2.5 shrink-0" />
                                    {meta.label}
                                  </span>
                                );
                              })()
                            ) : null}
                          </div>

                          <button
                            type="button"
                            disabled={!isShortlisted && !canShortlist}
                            onClick={() => onQuickShortlist(row)}
                            title={
                              isShortlisted
                                ? 'Đã Shortlist · Bấm để bỏ khỏi Shortlist'
                                : 'Đưa ứng viên vào Shortlist'
                            }
                            className={clsx(
                              'inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition disabled:opacity-40',
                              isShortlisted
                                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/90 hover:bg-indigo-100/80'
                                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
                            )}
                          >
                            {isShortlisted ? (
                              <>
                                <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                                <span>Đã Shortlist</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span>Shortlist</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Hàng 2: Tách bạch Chức danh · Ngành nghề và Khu vực */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="inline-flex min-w-0 items-center gap-1 font-medium text-slate-700">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">
                              {row.currentPosition ? formatJobTitle(row.currentPosition) : 'Chưa cập nhật vị trí'}
                              {row.industry ? ` · ${row.industry}` : ''}
                            </span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 text-slate-500">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                            <span className="truncate">{locationDisplay ?? 'Chưa có địa điểm'}</span>
                          </span>
                        </div>

                        {/* Hàng 3: Điểm sáng chuyên môn / Kỹ năng khớp JD */}
                        {visibleSkills.length > 0 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {visibleSkills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex max-w-[180px] truncate rounded-md bg-[#F4F8FD] px-2 py-0.5 text-[11px] font-medium text-[#072348] ring-1 ring-[#dce7f5]"
                              >
                                ✓ {skill}
                              </span>
                            ))}
                            {extraSkillsCount > 0 ? (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
                                +{extraSkillsCount}
                              </span>
                            ) : null}
                          </div>
                        ) : row.match.reason ? (
                          <p className="mt-1.5 line-clamp-1 text-[11.5px] text-slate-500">
                            <Sparkles className="mr-1 inline h-3 w-3 text-[#E8872A]" />
                            {row.match.reason}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* TẦNG 2: THANH HÀNH ĐỘNG CHÂN THẺ (GỘP TRÁI - PHẢI THẲNG HÀNG) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-slate-100 bg-[#FAFBFD] px-4 py-2.5 sm:px-5">
                      {/* Cụm tác vụ nhanh bên trái */}
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectCandidate(row, 'jd_match')}
                          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-200/60 hover:text-[#072348]"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                          <span>Đối chiếu JD</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectCandidate(row, 'interview')}
                          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-200/60 hover:text-[#072348]"
                        >
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>Đặt lịch PV</span>
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            title="Tác vụ khác"
                            aria-label="Tác vụ khác"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMoreId((prev) => (prev === row.candidateId ? null : row.candidateId));
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-900"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {moreOpen ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute bottom-full left-0 z-20 mb-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMoreId(null);
                                  onSelectCandidate(row, 'contact');
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Phone className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                                <span>Liên hệ & Kết nối</span>
                              </button>
                              <Link
                                href={`/candidates/${row.candidateId}?from=sourcing&match=${pctRawStr}`}
                                target="_blank"
                                onClick={() => setOpenMoreId(null)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span>Trang hồ sơ đầy đủ</span>
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Cụm hành động chính bên phải: Giao Inlink + Mở/Xem hồ sơ */}
                      <div className="flex items-center gap-2">
                        {hasOutreach ? (
                          <button
                            type="button"
                            disabled={(!isOutreached && !canOutreach) || outreachPending}
                            onClick={() => {
                              if (isOutreached) {
                                onSelectCandidate(row, 'overview');
                                return;
                              }
                              onQuickOutreach(row);
                            }}
                            title={
                              isOutreached
                                ? 'Xem tiến độ CSKH Inlink đang liên hệ'
                                : `Giao đội ngũ CSKH Inlink liên hệ kết nối & tự động mở khóa hồ sơ (Còn ${outreachRemaining ?? 0}/${outreachQuota ?? 15} lượt)`
                            }
                            className={clsx(
                              'inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-40',
                              isOutreached
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70'
                                : 'border-[#072348]/15 bg-white text-[#072348] hover:border-[#072348]/35 hover:bg-[#F4F8FD]',
                            )}
                          >
                            <Headphones
                              className={clsx(
                                'h-3.5 w-3.5 shrink-0',
                                isOutreached ? 'text-emerald-600' : 'text-[#E8872A]',
                              )}
                            />
                            <span>{isOutreached ? 'Đã giao Inlink' : 'Giao Inlink'}</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onSelectCandidate(row, isUnlocked ? 'overview' : 'unlock')}
                          title={
                            isUnlocked
                              ? 'Xem chi tiết hồ sơ ứng viên đã mở khóa'
                              : creditCost === 2
                                ? 'Mở hồ sơ ứng viên này tính 2 Credit (Matching ≥ 80%)'
                                : 'Mở hồ sơ ứng viên này tính 1 Credit (Matching < 80%)'
                          }
                          className={clsx(
                            'inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition',
                            isUnlocked
                              ? 'border border-[#072348]/25 bg-white text-[#072348] hover:border-[#072348] hover:bg-[#072348] hover:text-white'
                              : 'bg-[#072348] text-white shadow-2xs hover:bg-[#0d3468]',
                          )}
                        >
                          {isUnlocked ? (
                            <>
                              <span>Xem hồ sơ</span>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            </>
                          ) : (
                            <>
                              <span>Mở hồ sơ</span>
                              <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-amber-300">
                                {creditCost} Credit
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-500">
                Hiển thị {(safePage - 1) * CANDIDATE_PAGE_SIZE + 1}–
                {Math.min(safePage * CANDIDATE_PAGE_SIZE, filteredResults.length)} / {filteredResults.length} ứng viên
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Trước
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={clsx(
                      'inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11px] font-bold transition',
                      p === safePage
                        ? 'bg-[#072348] text-white shadow-2xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Sau →
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function QuotaGrid({
  entitlements: e,
  hasOutreach,
  totalMatchedCount,
  highMatchCount,
  shortlistedCount,
  openedCount,
  connectedCount,
  outreachStats,
  onOpenPosition,
  onOpenReport,
  onOpenRevision,
  onFilterAllPotential,
  onFilterViewed,
  onFilterShortlist,
  onFilterOutreach,
}: {
  entitlements: RecruiterSourcingEntitlements;
  hasOutreach: boolean;
  totalMatchedCount: number;
  highMatchCount: number;
  shortlistedCount: number;
  openedCount: number;
  connectedCount: number;
  outreachStats: {
    handedOver: number;
    contacted: number;
    agreed: number;
    guided: number;
    applied: number;
  };
  onOpenPosition?: () => void;
  onOpenReport?: () => void;
  onOpenRevision?: () => void;
  onFilterAllPotential?: () => void;
  onFilterViewed?: () => void;
  onFilterShortlist?: () => void;
  onFilterOutreach?: () => void;
}) {
  const outreachQ = e.outreachQuota ?? e.shortlistQuota;
  const outreachU = e.outreachUsed ?? e.shortlistsUsed;
  const outreachR = e.outreachRemaining ?? e.shortlistsRemaining;

  type KpiCardItem = {
    label: string;
    value: string | number;
    badge?: string;
    icon: typeof Briefcase;
    tone: string;
    actionHint?: string;
    onClick?: () => void;
  };

  // HÀNG 1: HIỆU QUẢ TÌM KIẾM ỨNG VIÊN (Chung cho mọi gói)
  const searchEffectivenessRows: KpiCardItem[] = [
    {
      label: 'Tổng phù hợp',
      value: totalMatchedCount,
      icon: Users,
      tone: 'bg-[#e7eef8] text-brand-700',
      actionHint: 'Tổng số ứng viên tiềm năng được hệ thống AI Matching tìm thấy và đánh giá phù hợp với tiêu chí tuyển dụng',
      onClick: onFilterAllPotential,
    },
    {
      label: 'Khớp cao ≥ 80%',
      value: highMatchCount,
      icon: Sparkles,
      tone: 'bg-accent-50 text-accent-700',
      actionHint: 'Số ứng viên tiềm năng có điểm phù hợp từ 80% trở lên',
      onClick: onFilterAllPotential,
    },
    {
      label: 'Đã Shortlist',
      value: shortlistedCount,
      icon: BookmarkCheck,
      tone: 'bg-indigo-50 text-indigo-700',
      actionHint: 'Số ứng viên tiềm năng được doanh nghiệp đưa vào danh sách lựa chọn',
      onClick: onFilterShortlist,
    },
    {
      label: 'Đã mở hồ sơ',
      value: openedCount,
      icon: Eye,
      tone: 'bg-brand-50 text-brand-700',
      actionHint: 'Số hồ sơ ứng viên tiềm năng doanh nghiệp đã sử dụng Credit để xem thông tin chi tiết',
      onClick: onFilterViewed,
    },
    {
      label: 'Đã kết nối',
      value: connectedCount,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
      actionHint: 'Số ứng viên tiềm năng doanh nghiệp đã chủ động kết nối trực tiếp',
      onClick: onFilterViewed,
    },
  ];

  // HÀNG 2: HIỆU QUẢ HỖ TRỢ CHUYÊN SÂU (Chỉ áp dụng gói Chuyên sâu)
  const outreachEffectivenessRows: KpiCardItem[] = [
    {
      label: 'Đã bàn giao',
      value: outreachStats.handedOver,
      icon: Headphones,
      tone: 'bg-indigo-50 text-indigo-700',
      actionHint: 'Số ứng viên doanh nghiệp đã lựa chọn và bàn giao cho Inlink hỗ trợ liên hệ',
      onClick: onFilterOutreach,
    },
    {
      label: 'Đã liên hệ',
      value: outreachStats.contacted,
      icon: Clock,
      tone: 'bg-brand-50 text-brand-700',
      actionHint: 'Số ứng viên Inlink đã liên hệ thành công và ghi nhận kết quả tiếp cận',
      onClick: onFilterOutreach,
    },
    {
      label: 'Đồng ý kết nối',
      value: outreachStats.agreed,
      icon: Users,
      tone: 'bg-accent-50 text-accent-700',
      actionHint: 'Số ứng viên đồng ý tìm hiểu cơ hội việc làm và cho phép Inlink kết nối với doanh nghiệp',
      onClick: onFilterOutreach,
    },
    {
      label: 'Đã hướng dẫn ứng tuyển',
      value: outreachStats.guided,
      icon: ListChecks,
      tone: 'bg-[#e7eef8] text-brand-700',
      actionHint: 'Số ứng viên đã được Inlink hướng dẫn cách xem thông tin công việc và thực hiện ứng tuyển vào Tin tuyển dụng phù hợp',
      onClick: onFilterOutreach,
    },
    {
      label: 'Đã ứng tuyển',
      value: outreachStats.applied,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
      actionHint: 'Số ứng viên đã hoàn tất nộp hồ sơ thành công vào Tin tuyển dụng của doanh nghiệp',
      onClick: onFilterOutreach,
    },
  ];

  // HÀNG 3: TÀI NGUYÊN DỊCH VỤ (Chung cho mọi gói)
  const resourceRows: KpiCardItem[] = [
    {
      label: 'Vị trí còn',
      value: e.positionQuota == null ? '∞' : String(e.positionsRemaining ?? 0),
      badge: fmtQuota(e.positionsUsed, e.positionQuota, e.positionsRemaining),
      icon: Briefcase,
      tone: 'bg-brand-50 text-brand-700',
      actionHint: onOpenPosition
        ? 'Số vị trí tuyển dụng doanh nghiệp còn được phép sử dụng · Bấm để tạo Tin Săn'
        : 'Số vị trí tuyển dụng doanh nghiệp còn được phép sử dụng',
      onClick: onOpenPosition,
    },
    {
      label: 'Credit còn',
      value: e.creditQuota == null ? '∞' : String(e.profileOpensRemaining ?? 0),
      badge: fmtQuota(e.profileOpensUsed, e.creditQuota, e.profileOpensRemaining),
      icon: Coins,
      tone: 'bg-accent-50 text-accent-700',
      actionHint: 'Số Credit còn lại trong gói để mở hồ sơ ứng viên (ưu tiên trừ trước ví lẻ)',
    },
    {
      label: 'Lượt điều chỉnh còn',
      value: e.revisionQuota == null ? '∞' : String(e.revisionsRemaining ?? 0),
      badge: fmtQuota(e.revisionsUsed, e.revisionQuota, e.revisionsRemaining),
      icon: RefreshCw,
      tone: 'bg-[#e7eef8] text-brand-700',
      actionHint: onOpenRevision
        ? 'Số lượt còn được điều chỉnh tiêu chí tìm kiếm hoặc JD · Bấm để sửa tiêu chí'
        : 'Số lượt còn được điều chỉnh tiêu chí tìm kiếm hoặc JD',
      onClick: onOpenRevision,
    },
    {
      label: 'Lượt bàn giao Inlink còn',
      value: hasOutreach
        ? outreachQ == null
          ? '∞'
          : String(outreachR ?? 0)
        : '0',
      badge: hasOutreach
        ? fmtQuota(outreachU, outreachQ ?? 15, outreachR ?? 0)
        : 'Gói Chuyên sâu',
      icon: Headphones,
      tone: 'bg-indigo-50 text-indigo-700',
      actionHint: hasOutreach
        ? 'Số lượt doanh nghiệp còn được bàn giao ứng viên cho Inlink hỗ trợ liên hệ · Bấm để lọc danh sách'
        : 'Nâng cấp gói Tin săn Chuyên sâu để bàn giao ứng viên cho Inlink hỗ trợ liên hệ',
      onClick: hasOutreach ? onFilterOutreach : undefined,
    },
    {
      label: 'Báo cáo còn',
      value: e.searchRoundQuota == null ? '∞' : String(e.searchRoundsRemaining ?? 0),
      badge: fmtQuota(e.searchRoundsUsed, e.searchRoundQuota, e.searchRoundsRemaining),
      icon: FileSearch,
      tone: 'bg-emerald-50 text-emerald-700',
      actionHint: onOpenReport
        ? 'Số lượt báo cáo doanh nghiệp còn được sử dụng theo gói dịch vụ · Bấm để xem báo cáo tiến độ'
        : 'Số lượt báo cáo doanh nghiệp còn được sử dụng theo gói dịch vụ',
      onClick: onOpenReport,
    },
  ];

  const ended = cycleEnded(e.assignment?.endsAt);
  const endLabel = e.assignment?.endsAt
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(e.assignment.endsAt))
    : null;

  const renderCardGrid = (items: KpiCardItem[]) => (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((r) => {
        const Icon = r.icon;
        const Tag = r.onClick ? 'button' : 'div';
        return (
          <Tag
            key={r.label}
            type={r.onClick ? 'button' : undefined}
            onClick={r.onClick}
            title={r.actionHint}
            className={clsx(
              'group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-200',
              r.onClick && 'cursor-pointer',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={clsx(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110',
                  r.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {r.badge ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  {r.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">{r.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[#E8872A]">{r.value}</p>
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-4 h-16 w-24 rounded-full bg-brand-50/80"
            />
          </Tag>
        );
      })}
    </div>
  );

  return (
    <section className="space-y-5">
      {/* 1. HIỆU QUẢ TÌM KIẾM ỨNG VIÊN */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
              1. HIỆU QUẢ TÌM KIẾM ỨNG VIÊN
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Theo dõi hiệu quả hệ thống tìm kiếm và hoạt động khai thác ứng viên tiềm năng của doanh nghiệp.
            </p>
          </div>
        </div>
        {renderCardGrid(searchEffectivenessRows)}
      </div>

      {/* 2. HIỆU QUẢ HỖ TRỢ CHUYÊN SÂU (Chỉ hiển thị khi gói Chuyên sâu / hasOutreach) */}
      {hasOutreach ? (
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
              2. HIỆU QUẢ HỖ TRỢ CHUYÊN SÂU
            </h2>
            <span className="rounded-full bg-orange-100/90 px-2.5 py-0.5 text-[11px] font-bold text-[#c95b12]">
              Chỉ áp dụng gói Chuyên sâu
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Theo dõi toàn bộ quá trình Inlink hỗ trợ doanh nghiệp tiếp cận, kết nối và chuyển đổi ứng viên thành hồ sơ ứng tuyển.
          </p>
          {renderCardGrid(outreachEffectivenessRows)}
        </div>
      ) : null}

      {/* 3. TÀI NGUYÊN DỊCH VỤ */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
              {hasOutreach ? '3. TÀI NGUYÊN DỊCH VỤ' : '2. TÀI NGUYÊN DỊCH VỤ'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Theo dõi số lượng tài nguyên và quyền lợi dịch vụ còn lại trong gói Tin săn.
            </p>
          </div>
          {ended || endLabel ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {ended
                ? `Gói đã hết hạn${endLabel ? ` ngày ${endLabel}` : ''}`
                : endLabel
                  ? `Dùng đến ${endLabel}`
                  : null}
            </span>
          ) : null}
        </div>
        {renderCardGrid(resourceRows)}
      </div>
    </section>
  );
}

function SourcingViewCriteriaModal({
  open,
  onClose,
  jobId,
  engagementTitle,
  revisionsRemaining,
  onOpenRevision,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  engagementTitle: string;
  revisionsRemaining: number | null;
  onOpenRevision: () => void;
}) {
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: Boolean(open && jobId),
  });

  if (!open) return null;

  const isSales =
    job?.jobTrack === JobTrack.Sales ||
    (!job?.jobTrack && (!job?.technicalCriteria || Boolean(job?.salesCriteria)));

  const sales = job?.salesCriteria;
  const tech = job?.technicalCriteria;
  const industries =
    (isSales ? sales?.industries : tech?.industries)?.length
      ? (isSales ? sales?.industries : tech?.industries) ?? []
      : job?.industry
        ? [job.industry]
        : [];

  const expLabel =
    job?.experienceBand && EXPERIENCE_LABEL[job.experienceBand as keyof typeof EXPERIENCE_LABEL]
      ? EXPERIENCE_LABEL[job.experienceBand as keyof typeof EXPERIENCE_LABEL]
      : 'Thoả thuận / Theo JD';
  const levelLabel =
    job?.jobLevel && JOB_LEVEL_LABEL[job.jobLevel as keyof typeof JOB_LEVEL_LABEL]
      ? JOB_LEVEL_LABEL[job.jobLevel as keyof typeof JOB_LEVEL_LABEL]
      : 'Chuyên viên / Quản lý';
  const salaryLabel =
    job?.salaryMin || job?.salaryMax
      ? `${job?.salaryMin ? formatVndAmount(job.salaryMin) : 'Thoả thuận'} – ${
          job?.salaryMax ? formatVndAmount(job.salaryMax) : 'Thoả thuận'
        }`
      : 'Thoả thuận theo năng lực';
  const canRevise = revisionsRemaining === null || revisionsRemaining > 0;

  const criteriaGroups: { label: string; items: string[] }[] = isSales
    ? [
        { label: 'Ngành / lĩnh vực ưu tiên', items: industries },
        { label: 'Sản phẩm / Giải pháp kinh doanh', items: sales?.productsSold ?? [] },
        { label: 'Tệp khách hàng mục tiêu', items: sales?.customerSegments ?? [] },
        { label: 'Loại hình giao dịch (Deal)', items: sales?.dealTypes ?? [] },
        { label: 'Phạm vi công việc bán hàng', items: sales?.sellingStages ?? [] },
        { label: 'Thị trường / Vùng phụ trách', items: sales?.marketsCovered ?? [] },
        {
          label: 'Trình độ & Chuyên ngành',
          items: [sales?.educationLevel, sales?.educationMajor].filter((x): x is string => Boolean(x)),
        },
        { label: 'Ngoại ngữ & Bằng lái', items: [...(sales?.languages ?? []), ...(sales?.driverLicenses ?? [])] },
      ]
    : [
        { label: 'Ngành / lĩnh vực kỹ thuật', items: industries },
        { label: 'Hệ thống / Thiết bị phụ trách', items: tech?.equipmentSystems ?? [] },
        { label: 'Môi trường làm việc', items: tech?.workEnvironments ?? [] },
        { label: 'Nhóm công việc kỹ thuật', items: tech?.technicalWorkTypes ?? [] },
        { label: 'Công cụ / Phần mềm chuyên ngành', items: tech?.technicalTools ?? [] },
        { label: 'Chứng chỉ & Tài liệu kỹ thuật', items: [...(tech?.certificates ?? []), ...(tech?.documentLiteracy ?? [])] },
        {
          label: 'Trình độ & Chuyên ngành',
          items: [tech?.educationLevel, tech?.educationMajor].filter((x): x is string => Boolean(x)),
        },
        { label: 'Ngoại ngữ & Bằng lái', items: [...(tech?.languages ?? []), ...(tech?.driverLicenses ?? [])] },
      ];

  const skillItems = (job?.skills ?? []).map((s) => s.name).filter(Boolean);
  if (skillItems.length > 0) {
    criteriaGroups.push({ label: 'Kỹ năng trọng tâm', items: skillItems });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#d7e3f2] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-[#072348] to-[#0f3466] px-6 py-4 text-white">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-200">
              <ListChecks className="h-3.5 w-3.5" />
              Tiêu chí tuyển dụng đang áp dụng
            </span>
            <h3 className="mt-1.5 truncate text-lg font-extrabold">
              {job?.title ? formatJobTitle(job.title) : formatJobTitle(engagementTitle)}
            </h3>
            <p className="mt-0.5 text-xs text-white/75">
              Hệ thống AI Inlink đang quét tự động 2 giờ/lần dựa trên bộ tiêu chí bên dưới
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#E8872A]" />
              Đang tải tiêu chí tuyển dụng...
            </div>
          ) : !job ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Chưa tìm thấy thông tin chi tiết JD của vị trí săn này.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Khung thông số cốt lõi */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-[#d7e3f2] bg-[#f8fafc] p-3">
                  <p className="text-[11px] font-medium text-slate-500">Địa điểm làm việc</p>
                  <p className="mt-1 text-xs font-extrabold text-[#072348]">
                    {job.location || 'Toàn quốc'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d7e3f2] bg-[#f8fafc] p-3">
                  <p className="text-[11px] font-medium text-slate-500">Kinh nghiệm</p>
                  <p className="mt-1 text-xs font-extrabold text-[#072348]">{expLabel}</p>
                </div>
                <div className="rounded-2xl border border-[#d7e3f2] bg-[#f8fafc] p-3">
                  <p className="text-[11px] font-medium text-slate-500">Cấp bậc</p>
                  <p className="mt-1 text-xs font-extrabold text-[#072348]">{levelLabel}</p>
                </div>
                <div className="rounded-2xl border border-[#d7e3f2] bg-[#f8fafc] p-3">
                  <p className="text-[11px] font-medium text-slate-500">Mức lương dự kiến</p>
                  <p className="mt-1 text-xs font-extrabold text-[#E8872A]">{salaryLabel}</p>
                </div>
              </div>

              {/* Các nhóm tiêu chí chuyên sâu */}
              <div className="space-y-3">
                {criteriaGroups.map((group) => (
                  <div
                    key={group.label}
                    className="rounded-2xl border border-slate-200/80 bg-white p-3.5"
                  >
                    <p className="text-xs font-bold text-[#072348]">{group.label}</p>
                    {group.items.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.items.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200/80"
                          >
                            <CheckCircle2 className="h-3 w-3 text-sky-600" />
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Không giới hạn cứng (Mở rộng nguồn ứng viên)</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <span className="text-xs text-slate-500">
            Lượt điều chỉnh tiêu chí còn lại:{' '}
            <strong className="text-[#072348]">
              {revisionsRemaining == null ? '∞' : revisionsRemaining}
            </strong>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            {canRevise ? (
              <Button onClick={onOpenRevision}>
                <RefreshCw className="h-4 w-4" />
                Điều chỉnh tiêu chí
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
