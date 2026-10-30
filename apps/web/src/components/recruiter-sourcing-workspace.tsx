'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Eye,
  FileSearch,
  ListChecks,
  Loader2,
  MapPin,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  SOURCING_QUOTA_LABELS,
  formatJobTitle,
  type CandidateMatchView,
  type RecruiterSourcingEntitlements,
  type SourcingQuotaKind,
} from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { ProfileOpenLink } from '@/components/starter-profile-lock';
import { Button, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { listMyJobs } from '@/lib/jobs';
import { formatMatchPct, matchRingColor } from '@/lib/match-percent';
import { sourcingCandidatesForJob } from '@/lib/matching';
import { consumeRecruiterSourcing, fetchRecruiterSourcing } from '@/lib/recruiter-billing';

function fmtQuota(used: number, quota: number | null, remaining: number | null) {
  if (quota == null) return `${used} / không giới hạn`;
  return `${used} / ${quota} · còn ${remaining ?? 0}`;
}

function usageLabel(kind: string) {
  if (kind === 'profile_open') return 'Lượt mở';
  if (kind === 'search_round') return 'Báo cáo';
  return SOURCING_QUOTA_LABELS[kind as SourcingQuotaKind] ?? kind;
}

function cycleEnded(endsAt: string | null | undefined) {
  return Boolean(endsAt && new Date(endsAt).getTime() < Date.now());
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Mới mở',
  in_progress: 'Đang tìm',
  shortlisted: 'Đã shortlist',
  closed: 'Đã đóng',
};

export function RecruiterSourcingWorkspace() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [jobId, setJobId] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

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
        text: `Đã ghi ${usageLabel(vars.kind).toLowerCase()}.`,
      });
      void qc.setQueryData(['recruiter-sourcing'], ws);
      void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      void qc.invalidateQueries({ queryKey: ['sourcing-hunt'] });
      if (vars.kind === 'position') {
        setTitle('');
        setJobId('');
        const newest = ws.engagements[0]?.id;
        if (newest) setActiveId(newest);
      }
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Không trừ được hạn mức' }),
  });

  const e = data?.entitlements;
  const hasPlan = Boolean(e?.assignment?.isActive);
  const ended = cycleEnded(e?.assignment?.endsAt);
  const selected = activeId ?? data?.engagements[0]?.id ?? null;
  const scope = e?.serviceScope ?? [];
  const shortlistInScope = scope.length === 0 || scope.includes('shortlist');
  const selectedEngagement = (data?.engagements ?? []).find((eng) => eng.id === selected) ?? null;
  const huntJobId = selectedEngagement?.jobId ?? null;
  const hunt = useQuery({
    queryKey: ['sourcing-hunt', huntJobId],
    queryFn: () => sourcingCandidatesForJob(huntJobId!),
    enabled: Boolean(hasPlan && huntJobId && !ended),
  });

  return (
    <RecruiterShell pinSidebar>
      <div className="ntd-form recruiter-dash space-y-5">
        <header className="recruiter-dash-rise relative overflow-hidden rounded-3xl bg-[#072348] px-5 py-6 text-white shadow-[0_18px_40px_-24px_rgba(7,35,72,0.85)] sm:px-7">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#E8872A]/35 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#E8872A] via-amber-200 to-transparent" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">Săn nhân sự</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                {hasPlan && e?.planName ? e.planName : 'Gói Săn & hạn mức'}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-white/75">
                {hasPlan
                  ? ended
                    ? 'Kỳ gói đã kết thúc.'
                    : 'iLink đối chiếu ứng viên theo tin bạn gắn và xếp danh sách phù hợp.'
                  : 'Kích hoạt gói để iLink săn ứng viên cho vị trí đang tuyển.'}
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Shield className="h-6 w-6 text-amber-200" />
            </span>
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
            <QuotaGrid entitlements={e!} />

            <HuntList
              jobTitle={(jobs ?? []).find((job) => job.id === huntJobId)?.title}
              loading={Boolean(huntJobId) && hunt.isLoading}
              error={hunt.isError ? (hunt.error instanceof ApiError ? hunt.error.message : 'Không tải được danh sách') : null}
              results={hunt.data ?? []}
              ready={Boolean(huntJobId) && !ended}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 h-1 w-16 rounded-full bg-gradient-to-r from-[#072348] to-[#E8872A]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#072348]">Mở vị trí</p>
                <p className="mt-1 text-sm text-slate-500">
                  Gắn tin đăng để iLink bắt đầu đối chiếu.
                  {' '}
                  {fmtQuota(e!.positionsUsed, e!.positionQuota, e!.positionsRemaining)}
                  {ended ? ' · Gói đã hết hạn.' : ''}
                </p>
                <Input
                  className="mt-4"
                  placeholder="Tên vị trí cần săn"
                  value={title}
                  onChange={(ev) => setTitle(ev.target.value)}
                />
                <Select className="mt-2" value={jobId} onChange={(ev) => setJobId(ev.target.value)} size="sm">
                  <option value="">Không gắn tin đăng</option>
                  {(jobs ?? []).map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </Select>
                <Button
                  className="mt-4 w-full"
                  disabled={
                    ended || consume.isPending || (e!.positionsRemaining !== null && e!.positionsRemaining <= 0)
                  }
                  onClick={() =>
                    consume.mutate({
                      kind: 'position',
                      title: title.trim() || undefined,
                      jobId: jobId || undefined,
                    })
                  }
                >
                  {consume.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Mở vị trí
                </Button>
              </section>

              <section className="rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 h-1 w-16 rounded-full bg-gradient-to-r from-[#E8872A] to-[#072348]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#072348]">Vị trí đang săn</p>
                <p className="mt-1 text-sm text-slate-500">Chọn vị trí rồi ghi báo cáo, shortlist hoặc điều chỉnh.</p>
                <div className="mt-4 space-y-2">
                  {(data?.engagements ?? []).length === 0 ? (
                    <p className="rounded-2xl bg-[#f4f7fb] px-3 py-4 text-sm text-slate-500">
                      Chưa có vị trí. Mở vị trí ở cột bên cạnh.
                    </p>
                  ) : (
                    (data?.engagements ?? []).map((eng) => (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => setActiveId(eng.id)}
                        className={clsx(
                          'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition',
                          selected === eng.id
                            ? 'border-[#072348] bg-[#072348] text-white shadow-md'
                            : 'border-[#d7e3f2] bg-[#f7f9fc] text-slate-800 hover:-translate-y-0.5 hover:border-[#52749a]',
                        )}
                      >
                        <span className="min-w-0 truncate font-semibold">{eng.title}</span>
                        <span
                          className={clsx(
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            selected === eng.id ? 'bg-white/15 text-amber-100' : 'bg-white text-slate-500',
                          )}
                        >
                          {STATUS_LABEL[eng.status] ?? eng.status}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <UseBtn
                    kind="search_round"
                    label="Báo cáo"
                    icon={FileSearch}
                    disabled={ended || !selected || consume.isPending}
                    remaining={e!.searchRoundsRemaining}
                    onClick={() => selected && consume.mutate({ kind: 'search_round', engagementId: selected })}
                  />
                  <UseBtn
                    kind="shortlist"
                    icon={ListChecks}
                    disabled={ended || !shortlistInScope || !selected || consume.isPending}
                    remaining={shortlistInScope ? e!.shortlistsRemaining : null}
                    onClick={() => selected && consume.mutate({ kind: 'shortlist', engagementId: selected })}
                  />
                  <UseBtn
                    kind="revision"
                    icon={RefreshCw}
                    disabled={ended || !selected || consume.isPending}
                    remaining={e!.revisionsRemaining}
                    onClick={() => selected && consume.mutate({ kind: 'revision', engagementId: selected })}
                  />
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-[#d7e3f2] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#072348]">Lịch sử</p>
              {(data?.usages ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Chưa có lần sử dụng.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(data?.usages ?? []).map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f9fc] px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <strong className="text-[#072348]">{usageLabel(u.kind)}</strong>
                        {u.note?.startsWith('open:') ? (
                          <span className="text-slate-500"> · Mở hồ sơ</span>
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

function HuntList({
  jobTitle,
  loading,
  error,
  results,
  ready,
}: {
  jobTitle?: string;
  loading: boolean;
  error: string | null;
  results: CandidateMatchView[];
  ready: boolean;
}) {
  return (
    <section className="rounded-3xl border border-[#d7e3f2] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#072348]">Ứng viên phù hợp</p>
          <p className="mt-0.5 text-sm text-slate-500">{jobTitle ? jobTitle : 'Danh sách iLink săn cho vị trí đang chọn'}</p>
        </div>
        {ready && !loading ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
            <Users className="h-3.5 w-3.5" />
            {results.length}
          </span>
        ) : null}
      </div>
      {!ready ? (
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#f4f7fb] to-white px-4 py-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-[#E8872A]" />
          <p className="mt-2 text-sm text-slate-600">Mở vị trí và gắn tin đăng để iLink đưa ứng viên vào đây.</p>
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-2">
          <div className="recruiter-dash-skel h-20 rounded-2xl" />
          <div className="recruiter-dash-skel h-20 rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-700">{error}</p>
      ) : results.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[#f4f7fb] px-3 py-6 text-center text-sm text-slate-500">
          Chưa có ứng viên khớp tin này.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {results.map((row, index) => (
            <li key={row.candidateId} className="animate-soft-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
              <ProfileOpenLink
                href={`/candidates/${row.candidateId}?from=sourcing`}
                potential={!row.applied}
                className="progress-card group flex w-full items-start gap-3 p-3 text-left sm:p-4"
              >
                <ScoreRing score={row.match.score} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#072348] transition group-hover:text-[#E8872A]">{row.displayName}</span>
                    {row.viewed ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        Đã xem
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Mới
                      </span>
                    )}
                    {row.applied ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Đã ứng tuyển
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {row.currentPosition ? formatJobTitle(row.currentPosition) : 'Chưa cập nhật vị trí'}
                    {row.industry ? ` · ${row.industry}` : ''}
                    {' · '}
                    <span className={row.location ? 'font-medium text-slate-700' : 'text-slate-400'}>
                      <MapPin className="mr-0.5 inline h-3.5 w-3.5 text-[#E8872A]" />
                      {row.location ?? 'Chưa có địa điểm'}
                    </span>
                  </span>
                  {row.match.reason ? (
                    <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-slate-600">{row.match.reason}</span>
                  ) : null}
                  <span className="mt-2 inline-flex text-xs font-semibold text-[#E8872A]">Xem hồ sơ</span>
                </span>
              </ProfileOpenLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function quotaFill(used: number, quota: number | null) {
  if (quota == null || quota <= 0) return quota == null ? 100 : 0;
  return Math.max(0, Math.min(100, (used / quota) * 100));
}

function QuotaGrid({ entitlements: e }: { entitlements: RecruiterSourcingEntitlements }) {
  const rows: {
    label: string;
    used: number;
    quota: number | null;
    remaining: number | null;
    icon: typeof Briefcase;
  }[] = [
    { label: 'Vị trí', used: e.positionsUsed, quota: e.positionQuota, remaining: e.positionsRemaining, icon: Briefcase },
    { label: 'Lượt mở', used: e.profileOpensUsed, quota: e.creditQuota, remaining: e.profileOpensRemaining, icon: Eye },
    { label: 'Báo cáo', used: e.searchRoundsUsed, quota: e.searchRoundQuota, remaining: e.searchRoundsRemaining, icon: FileSearch },
    { label: 'Điều chỉnh', used: e.revisionsUsed, quota: e.revisionQuota, remaining: e.revisionsRemaining, icon: RefreshCw },
    { label: 'Shortlist', used: e.shortlistsUsed, quota: e.shortlistQuota, remaining: e.shortlistsRemaining, icon: ListChecks },
  ];
  const ended = cycleEnded(e.assignment?.endsAt);
  const endLabel = e.assignment?.endsAt
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(e.assignment.endsAt))
    : null;
  return (
    <section>
      <p className="mb-3 text-xs text-slate-500">
        {ended
          ? `Gói đã hết hạn${endLabel ? ` ngày ${endLabel}` : ''}.`
          : endLabel
            ? `Dùng đến ${endLabel}.`
            : null}
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((r) => {
          const Icon = r.icon;
          const left = r.quota == null ? '∞' : String(r.remaining ?? 0);
          return (
            <div
              key={r.label}
              className="rounded-2xl border border-[#d7e3f2] bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.label}</p>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-[#f4f7fb] text-[#072348]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[#072348]">{left}</p>
              <p className="text-[11px] text-slate-400">{fmtQuota(r.used, r.quota, r.remaining)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8eef6]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#072348] to-[#E8872A] transition-all duration-700"
                  style={{ width: `${quotaFill(r.used, r.quota)}%` }}
                />
              </div>
            </div>
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
                className="rounded-full bg-[#f4f7fb] px-2.5 py-1 text-[11px] font-medium text-[#072348] ring-1 ring-[#d7e3f2]"
              >
                {line.label}
              </span>
            ))}
        </div>
      ) : null}
    </section>
  );
}

function UseBtn({
  kind,
  label,
  icon: Icon,
  disabled,
  remaining,
  onClick,
}: {
  kind: SourcingQuotaKind;
  label?: string;
  icon: typeof FileSearch;
  disabled: boolean;
  remaining: number | null;
  onClick: () => void;
}) {
  const out = remaining !== null && remaining <= 0;
  return (
    <button
      type="button"
      disabled={disabled || out}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#d7e3f2] bg-[#f7f9fc] px-2 py-2.5 text-xs font-semibold text-[#072348] transition hover:-translate-y-0.5 hover:border-[#072348] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      <Icon className="h-3.5 w-3.5" />
      {label ?? SOURCING_QUOTA_LABELS[kind]}
      {out ? ' · hết' : remaining != null ? ` · ${remaining}` : ''}
    </button>
  );
}
