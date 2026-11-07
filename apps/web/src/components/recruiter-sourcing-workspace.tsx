'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  BookmarkCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileSearch,
  ListChecks,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  JobTrack,
  SOURCING_QUOTA_LABELS,
  formatJobTitle,
  type CandidateMatchView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingScanRoundView,
  type SourcingQuotaKind,
} from '@industriallink/contracts';
import { JdSalesCreateFlow } from '@/app/jobs/new/sales-create-flow';
import { JdTechnicalCreateFlow } from '@/app/jobs/new/technical-create-flow';
import {
  SourcingCandidateDrawer,
  SourcingJdRevisionModal,
  SourcingProgressReportModal,
} from '@/components/recruiter-sourcing-all-in-one';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { addCandidateShortlist } from '@/lib/candidate';
import { listMyJobs } from '@/lib/jobs';
import { formatMatchPct, matchRingColor } from '@/lib/match-percent';
import { sourcingCandidatesForJob } from '@/lib/matching';
import { consumeRecruiterSourcing, fetchRecruiterSourcing } from '@/lib/recruiter-billing';

function potentialOpenCreditCost(score: number): 1 | 2 {
  const pct = score <= 1 ? score * 100 : score;
  return pct >= 80 ? 2 : 1;
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
  const [drawerCandidate, setDrawerCandidate] = useState<CandidateMatchView | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const syncedScanEngagementsRef = useRef<Set<string>>(new Set());

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
      await addCandidateShortlist(cand.candidateId).catch(() => null);
      return consumeRecruiterSourcing({
        kind: 'shortlist',
        engagementId: selected,
        jobId: huntJobId ?? undefined,
        note: `shortlist:${cand.candidateId}:${cand.displayName}`,
      });
    },
    onSuccess: (ws, cand) => {
      void qc.setQueryData(['recruiter-sourcing'], ws);
      void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      setBanner({
        tone: 'ok',
        text: `Đã đưa ứng viên «${cand.displayName}» vào danh sách Shortlist!`,
      });
    },
    onError: (err) =>
      setBanner({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không đưa được vào Shortlist',
      }),
  });

  const e = data?.entitlements;
  const hasPlan = Boolean(e?.assignment?.isActive);
  const ended = cycleEnded(e?.assignment?.endsAt);
  const validEngagements = useMemo(
    () => (data?.engagements ?? []).filter((eng) => Boolean(eng.jobId)),
    [data?.engagements],
  );
  const selected = activeId ?? validEngagements[0]?.id ?? null;
  const scope = e?.serviceScope ?? [];
  const shortlistInScope = scope.length === 0 || scope.includes('shortlist');
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
              onFilterShortlist={selected ? () => setSelectedRoundId('shortlist') : undefined}
            />

            {/* DANH SÁCH TIN SĂN */}
            <section className="rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold uppercase tracking-tight text-slate-900">
                    DANH SÁCH TIN SĂN
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Danh sách tin săn của bạn · Bấm vào ứng viên bên dưới để xem đối chiếu JD, mở liên hệ, kết nối & đặt
                    lịch phỏng vấn ngay tại chỗ
                  </p>
                </div>
                {selectedEngagement ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={ended}
                      onClick={() => setReportModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#d7e3f2] bg-[#f7f9fc] px-3 py-2 text-xs font-semibold text-[#072348] transition hover:-translate-y-0.5 hover:border-[#072348] hover:bg-white disabled:opacity-40"
                    >
                      <FileSearch className="h-3.5 w-3.5 text-[#E8872A]" />
                      Báo cáo tiến độ & AI
                      {e!.searchRoundsRemaining != null ? ` · còn ${e!.searchRoundsRemaining}` : ''}
                    </button>

                    <button
                      type="button"
                      disabled={ended || !huntJobId || (e!.revisionsRemaining !== null && e!.revisionsRemaining <= 0)}
                      onClick={() => setRevisionModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#d7e3f2] bg-[#f7f9fc] px-3 py-2 text-xs font-semibold text-[#072348] transition hover:-translate-y-0.5 hover:border-[#072348] hover:bg-white disabled:opacity-40"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-[#E8872A]" />
                      Điều chỉnh tiêu chí JD
                      {e!.revisionsRemaining != null ? ` · còn ${e!.revisionsRemaining}` : ''}
                    </button>

                    <button
                      type="button"
                      disabled={ended || !shortlistInScope}
                      onClick={() =>
                        setSelectedRoundId((prev) => (prev === 'shortlist' ? 'all' : 'shortlist'))
                      }
                      className={clsx(
                        'inline-flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition',
                        selectedRoundId === 'shortlist'
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-[#d7e3f2] bg-[#f7f9fc] text-[#072348] hover:-translate-y-0.5 hover:border-[#072348] hover:bg-white',
                      )}
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                      Đã Shortlist ({engagementShortlistedIds.length}
                      {e!.shortlistQuota != null ? `/${e!.shortlistQuota}` : ''})
                    </button>
                  </div>
                ) : null}
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
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {validEngagements.map((eng) => {
                    const isActive = selected === eng.id;
                    const roundCount = (data?.scanRounds ?? []).filter((r) => r.engagementId === eng.id).length;
                    const slCount = (data?.shortlistedByEngagement?.[eng.id] ?? []).length;
                    const deadlineBadge = formatRemainingDaysFromStart(eng.createdAt);
                    return (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => {
                          setActiveId(eng.id);
                          setSelectedRoundId('all');
                        }}
                        className={clsx(
                          'flex flex-col justify-between gap-2 rounded-2xl border p-3.5 text-left transition',
                          isActive
                            ? 'border-[#072348] bg-[#072348] text-white shadow-md'
                            : 'border-[#d7e3f2] bg-[#f8fafc] text-slate-800 hover:-translate-y-0.5 hover:border-[#52749a] hover:bg-white',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 font-bold">{eng.title}</span>
                          <span
                            className={clsx(
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              isActive ? 'bg-[#E8872A] text-white' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
                            )}
                          >
                            {STATUS_LABEL[eng.status] ?? eng.status}
                          </span>
                        </div>
                        <div
                          className={clsx(
                            'flex flex-wrap items-center justify-between gap-2 text-[11px]',
                            isActive ? 'text-white/80' : 'text-slate-500',
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {deadlineBadge ?? 'Bảo lưu 45 ngày'}
                          </span>
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {roundCount} đợt
                            </span>
                            {slCount > 0 ? <span>· ★ {slCount} Shortlist</span> : null}
                          </span>
                        </div>
                      </button>
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
                onSelectCandidate={setDrawerCandidate}
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
                selectedRoundId={selectedRoundId}
                onSelectRound={setSelectedRoundId}
                onSelectCandidate={setDrawerCandidate}
                onQuickShortlist={(row) => quickShortlist.mutate(row)}
                ready={Boolean(huntJobId) && !ended}
              />
            </div>

            {/* LỊCH SỬ */}
            <section className="rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[#072348]">LỊCH SỬ</p>
              {(data?.usages ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Chưa có lần sử dụng.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(data?.usages ?? []).map((u) => (
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
                        {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                          new Date(u.createdAt),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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

      {/* MODAL ĐIỀU CHỈNH TIÊU CHÍ JD TẠI CHỖ */}
      {hasPlan && e ? (
        <SourcingJdRevisionModal
          open={revisionModalOpen}
          onClose={() => setRevisionModalOpen(false)}
          engagementId={selected}
          jobId={huntJobId}
          revisionsRemaining={e.revisionsRemaining}
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
          onClose={() => setDrawerCandidate(null)}
          engagementId={selected}
          engagementTitle={selectedEngagement?.title ?? ''}
          jobId={huntJobId}
          entitlements={e}
          isShortlisted={
            drawerCandidate ? engagementShortlistedIds.includes(drawerCandidate.candidateId) : false
          }
          onShortlistSuccess={(ws, candName) => {
            void qc.setQueryData(['recruiter-sourcing'], ws);
            void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
            setBanner({
              tone: 'ok',
              text: `Đã đưa ứng viên «${candName}» vào danh sách Shortlist!`,
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
  const unit = score <= 1 ? score : score / 100;
  const pct = formatMatchPct(score);
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, unit)));
  const color = matchRingColor(score);
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#f4f7fb" strokeWidth="3.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-extrabold" style={{ color }}>
          {pct}
        </span>
      </div>
    </div>
  );
}

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
  onSelectCandidate: (row: CandidateMatchView) => void;
  onQuickShortlist: (row: CandidateMatchView) => void;
  ready: boolean;
}) {
  return (
    <section className="flex flex-col rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
            ỨNG VIÊN NỘP HỒ SƠ ỨNG TUYỂN
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Danh sách ứng viên đã nộp hồ sơ ứng tuyển của bạn
            {jobTitle ? ` · ${jobTitle}` : ''}
          </p>
        </div>
        {ready && !loading ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <Users className="h-3.5 w-3.5" />
            {results.length}
          </span>
        ) : null}
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
        <ul className="mt-4 grid gap-3">
          {results.map((row, index) => {
            const isShortlisted = shortlistedIds.includes(row.candidateId);
            const canShortlist = shortlistRemaining === null || shortlistRemaining > 0;
            return (
              <li
                key={row.candidateId}
                className="animate-soft-rise"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="progress-card group flex w-full items-start gap-3 p-3 text-left sm:p-4">
                  <button
                    type="button"
                    onClick={() => onSelectCandidate(row)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <ScoreRing score={row.match.score} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#072348] transition group-hover:text-[#E8872A]">
                          {row.displayName}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Đã ứng tuyển
                        </span>
                        {isShortlisted ? (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                            ★ Đã Shortlist
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {row.currentPosition ? formatJobTitle(row.currentPosition) : 'Chưa cập nhật vị trí'}
                        {row.industry ? ` · ${row.industry}` : ''}
                        {' · '}
                        <span className={row.location ? 'font-medium text-slate-700' : 'text-slate-400'}>
                          <MapPin className="mr-0.5 inline h-3.5 w-3.5 text-[#E8872A]" />
                          {row.location ?? 'Chưa có địa điểm'}
                        </span>
                      </span>
                      {row.match.reason ? (
                        <span className="mt-1.5 block line-clamp-2 text-xs leading-relaxed text-slate-600">
                          {row.match.reason}
                        </span>
                      ) : null}
                      <span className="mt-2 inline-flex text-xs font-semibold text-[#E8872A]">
                        Xem đối chiếu JD · Liên hệ · Đặt lịch PV →
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isShortlisted || !canShortlist}
                    onClick={() => onQuickShortlist(row)}
                    title={isShortlisted ? 'Đã trong Shortlist' : 'Đưa ứng viên vào Shortlist'}
                    className={clsx(
                      'shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition',
                      isShortlisted
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-[#072348] hover:text-[#072348] disabled:opacity-40',
                    )}
                  >
                    {isShortlisted ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      '+ Shortlist'
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
  selectedRoundId,
  onSelectRound,
  onSelectCandidate,
  onQuickShortlist,
  ready,
}: {
  jobTitle?: string;
  loading: boolean;
  error: string | null;
  results: CandidateMatchView[];
  scanRounds: RecruiterSourcingScanRoundView[];
  shortlistedIds: string[];
  shortlistRemaining: number | null;
  selectedRoundId: string;
  onSelectRound: (id: string) => void;
  onSelectCandidate: (row: CandidateMatchView) => void;
  onQuickShortlist: (row: CandidateMatchView) => void;
  ready: boolean;
}) {
  const activeRound = useMemo(
    () =>
      selectedRoundId === 'all' || selectedRoundId === 'shortlist'
        ? null
        : scanRounds.find((r) => r.id === selectedRoundId) ?? null,
    [scanRounds, selectedRoundId],
  );

  const latestRoundNewSet = useMemo(() => {
    const targetRound = activeRound ?? scanRounds[0] ?? null;
    if (!targetRound) return new Set<string>();
    return new Set(targetRound.candidates.filter((c) => c.isNew).map((c) => c.candidateId));
  }, [activeRound, scanRounds]);

  const filteredResults = useMemo(() => {
    if (selectedRoundId === 'shortlist') {
      return results.filter((r) => shortlistedIds.includes(r.candidateId));
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
  }, [activeRound, results, selectedRoundId, shortlistedIds]);

  const shortlistedPotentialCount = useMemo(
    () => results.filter((r) => shortlistedIds.includes(r.candidateId)).length,
    [results, shortlistedIds],
  );

  return (
    <section className="flex flex-col rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
            DANH SÁCH ỨNG VIÊN TIỀM NĂNG
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Danh sách các ứng viên inlink săn cho bạn dựa trên JD đã chọn, tỉ lệ phù hợp từ cao xuống thấp.
            {jobTitle ? ` (${jobTitle})` : ''}
          </p>
        </div>
        {ready && !loading ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
            <Users className="h-3.5 w-3.5" />
            {filteredResults.length}
          </span>
        ) : null}
      </div>

      {/* Thanh chọn các đợt tìm kiếm 2 giờ/lần + bộ lọc Shortlist */}
      {ready && (scanRounds.length > 0 || shortlistedPotentialCount > 0) ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 font-medium text-[#072348]">
              <Clock className="h-3.5 w-3.5 text-[#E8872A]" />
              Tự động quét 2 giờ/lần (08:00 – 18:00) & báo Email/Zalo khi có ứng viên mới
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => onSelectRound('all')}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition',
                selectedRoundId === 'all'
                  ? 'bg-[#072348] text-white shadow-xs'
                  : 'bg-[#f4f7fb] text-slate-600 hover:bg-slate-200/70',
              )}
            >
              Tất cả phù hợp ({results.length})
            </button>
            <button
              type="button"
              onClick={() => onSelectRound('shortlist')}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition',
                selectedRoundId === 'shortlist'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
              )}
            >
              ★ Đã Shortlist ({shortlistedPotentialCount})
            </button>
            {scanRounds.map((round) => {
              const active = selectedRoundId === round.id;
              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => onSelectRound(round.id)}
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
                    active
                      ? 'bg-[#E8872A] text-white shadow-xs'
                      : 'bg-[#f4f7fb] text-slate-600 hover:bg-slate-200/70',
                  )}
                >
                  <span>
                    Đợt #{round.roundNumber} · {formatScanRoundTime(round.createdAt)}
                  </span>
                  {round.newCount > 0 ? (
                    <span
                      className={clsx(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                        active ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      +{round.newCount} mới
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
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
            {selectedRoundId === 'shortlist'
              ? 'Chưa có ứng viên nào trong danh sách Shortlist. Bấm «+ Shortlist» trên thẻ ứng viên để lưu vào đây.'
              : 'Chưa có ứng viên tiềm năng khớp ở đợt tìm kiếm này. Hệ thống sẽ tiếp tục quét tự động 2 giờ/lần.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {filteredResults.map((row, index) => {
            const creditCost = potentialOpenCreditCost(row.match.score);
            const isNewlyDiscovered = latestRoundNewSet.has(row.candidateId);
            const isShortlisted = shortlistedIds.includes(row.candidateId);
            const canShortlist = shortlistRemaining === null || shortlistRemaining > 0;
            return (
              <li
                key={row.candidateId}
                className="animate-soft-rise"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="progress-card group flex w-full items-start gap-3 p-3 text-left sm:p-4">
                  <button
                    type="button"
                    onClick={() => onSelectCandidate(row)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <ScoreRing score={row.match.score} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-[#072348] transition group-hover:text-[#E8872A]">
                          {row.displayName}
                        </span>
                        {isNewlyDiscovered ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-300">
                            Mới phát hiện
                          </span>
                        ) : null}
                        {isShortlisted ? (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                            ★ Đã Shortlist
                          </span>
                        ) : null}
                        {row.viewed ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            Đã xem
                          </span>
                        ) : (
                          <span
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
                              creditCost === 2
                                ? 'bg-orange-50 text-[#c96a12] ring-orange-200'
                                : 'bg-sky-50 text-[#072348] ring-sky-200',
                            )}
                          >
                            {creditCost} Credit
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {row.currentPosition ? formatJobTitle(row.currentPosition) : 'Chưa cập nhật vị trí'}
                        {row.industry ? ` · ${row.industry}` : ''}
                        {' · '}
                        <span className={row.location ? 'font-medium text-slate-700' : 'text-slate-400'}>
                          <MapPin className="mr-0.5 inline h-3.5 w-3.5 text-[#E8872A]" />
                          {row.location ?? 'Chưa có địa điểm'}
                        </span>
                      </span>
                      {row.match.reason ? (
                        <span className="mt-1.5 block line-clamp-2 text-xs leading-relaxed text-slate-600">
                          {row.match.reason}
                        </span>
                      ) : null}
                      <span className="mt-2 inline-flex text-xs font-semibold text-[#E8872A]">
                        Xem đối chiếu JD · Mở liên hệ · Đặt lịch PV →
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isShortlisted || !canShortlist}
                    onClick={() => onQuickShortlist(row)}
                    title={isShortlisted ? 'Đã trong Shortlist' : 'Đưa ứng viên vào Shortlist'}
                    className={clsx(
                      'shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition',
                      isShortlisted
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-[#072348] hover:text-[#072348] disabled:opacity-40',
                    )}
                  >
                    {isShortlisted ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      '+ Shortlist'
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function quotaFill(used: number, quota: number | null) {
  if (quota == null || quota <= 0) return quota == null ? 100 : 0;
  return Math.max(0, Math.min(100, (used / quota) * 100));
}

function QuotaGrid({
  entitlements: e,
  onOpenPosition,
  onOpenReport,
  onOpenRevision,
  onFilterShortlist,
}: {
  entitlements: RecruiterSourcingEntitlements;
  onOpenPosition?: () => void;
  onOpenReport?: () => void;
  onOpenRevision?: () => void;
  onFilterShortlist?: () => void;
}) {
  const rows: {
    label: string;
    used: number;
    quota: number | null;
    remaining: number | null;
    icon: typeof Briefcase;
    actionHint?: string;
    onClick?: () => void;
  }[] = [
    {
      label: 'Vị trí',
      used: e.positionsUsed,
      quota: e.positionQuota,
      remaining: e.positionsRemaining,
      icon: Briefcase,
      actionHint: onOpenPosition ? 'Bấm để tạo Tin Săn' : undefined,
      onClick: onOpenPosition,
    },
    {
      label: 'Credit',
      used: e.profileOpensUsed,
      quota: e.creditQuota,
      remaining: e.profileOpensRemaining,
      icon: Eye,
      actionHint: 'Ưu tiên trừ trước ví lẻ',
    },
    {
      label: 'Báo cáo',
      used: e.searchRoundsUsed,
      quota: e.searchRoundQuota,
      remaining: e.searchRoundsRemaining,
      icon: FileSearch,
      actionHint: onOpenReport ? 'Xem phễu & khuyến nghị AI →' : undefined,
      onClick: onOpenReport,
    },
    {
      label: 'Điều chỉnh',
      used: e.revisionsUsed,
      quota: e.revisionQuota,
      remaining: e.revisionsRemaining,
      icon: RefreshCw,
      actionHint: onOpenRevision ? 'Sửa tiêu chí JD & quét lại →' : undefined,
      onClick: onOpenRevision,
    },
    {
      label: 'Shortlist',
      used: e.shortlistsUsed,
      quota: e.shortlistQuota,
      remaining: e.shortlistsRemaining,
      icon: ListChecks,
      actionHint: onFilterShortlist ? 'Lọc ứng viên đã Shortlist →' : undefined,
      onClick: onFilterShortlist,
    },
  ];
  const ended = cycleEnded(e.assignment?.endsAt);
  const endLabel = e.assignment?.endsAt
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(e.assignment.endsAt))
    : null;
  return (
    <section>
      {ended || endLabel ? (
        <p className="mb-3 text-xs text-slate-500">
          {ended
            ? `Gói đã hết hạn${endLabel ? ` ngày ${endLabel}` : ''}.`
            : endLabel
              ? `Dùng đến ${endLabel}.`
              : null}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((r) => {
          const Icon = r.icon;
          const left = r.quota == null ? '∞' : String(r.remaining ?? 0);
          const Tag = r.onClick ? 'button' : 'div';
          return (
            <Tag
              key={r.label}
              type={r.onClick ? 'button' : undefined}
              onClick={r.onClick}
              className={clsx(
                'rounded-2xl border border-[#d7e3f2] bg-white p-3.5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
                r.onClick && 'cursor-pointer hover:border-[#072348]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.label}</p>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-[#f4f7fb] text-[#072348]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[#E8872A]">{left}</p>
              <p className="text-[11px] text-slate-400">{fmtQuota(r.used, r.quota, r.remaining)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8eef6]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#072348] to-[#E8872A] transition-all duration-700"
                  style={{ width: `${quotaFill(r.used, r.quota)}%` }}
                />
              </div>
              {r.actionHint ? (
                <p className="mt-1.5 text-[10px] font-semibold text-[#072348]/75">{r.actionHint}</p>
              ) : null}
            </Tag>
          );
        })}
      </div>
      {(e.scopeItems?.length ? e.scopeItems.filter((line) => line.included) : []).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(e.scopeItems ?? [])
            .filter((line) => line.included)
            .map((line) => (
              <span
                key={line.code}
                className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#072348] shadow-2xs ring-1 ring-[#d7e3f2]"
              >
                {line.label}
              </span>
            ))}
        </div>
      ) : null}
    </section>
  );
}
