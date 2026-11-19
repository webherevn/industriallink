'use client';

import clsx from 'clsx';
import {
  Bookmark,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Coins,
  Eye,
  Info,
  Layers,
  PlayCircle,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  formatJobTitle,
  type JobListItem,
  type RecruiterHuntCampaignView,
  type RecruiterHuntPackageView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingOutreachItem,
  type RecruiterSourcingScanRoundView,
  type RecruiterSourcingUsageView,
} from '@industriallink/contracts';

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function daysLeftOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function openCandidateIdFromNote(note: string | null | undefined): string | null {
  if (!note || !note.startsWith('open:')) return null;
  const parts = note.split(':');
  return parts[1]?.trim() || null;
}

type PackageStatusFilter = 'all' | 'ACTIVE' | 'UNUSED' | 'COMPLETED' | 'EXPIRED';

export function SourcingOverviewDashboard({
  entitlements,
  packages,
  campaigns,
  jobs,
  usages,
  scanRounds,
  shortlistedByCampaign,
  outreachByCampaign,
  creditBalance,
  canOpenMorePositions,
  onActivatePackage,
  onOpenRevision,
}: {
  entitlements: RecruiterSourcingEntitlements;
  packages: RecruiterHuntPackageView[];
  campaigns: RecruiterHuntCampaignView[];
  jobs: JobListItem[];
  usages: RecruiterSourcingUsageView[];
  scanRounds: RecruiterSourcingScanRoundView[];
  shortlistedByCampaign: Record<string, string[]>;
  outreachByCampaign: Record<string, RecruiterSourcingOutreachItem[]>;
  creditBalance: number;
  canOpenMorePositions: boolean;
  onActivatePackage: (packageId: string) => void;
  onOpenRevision: (campaignId: string) => void;
}) {
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [packageFilter, setPackageFilter] = useState<PackageStatusFilter>('all');

  const jobById = useMemo(() => {
    const map = new Map<string, JobListItem>();
    for (const j of jobs) map.set(j.id, j);
    return map;
  }, [jobs]);

  const packageById = useMemo(() => {
    const map = new Map<string, RecruiterHuntPackageView>();
    for (const p of packages) map.set(p.id, p);
    return map;
  }, [packages]);

  /** Gom chiến dịch theo gói: 1 gói ↔ tối đa 1 chiến dịch (ràng buộc UNIQUE ở DB). */
  const campaignsByPackage = useMemo(() => {
    const map = new Map<string, RecruiterHuntCampaignView[]>();
    for (const camp of campaigns) {
      const list = map.get(camp.huntPackageId);
      if (list) list.push(camp);
      else map.set(camp.huntPackageId, [camp]);
    }
    return map;
  }, [campaigns]);

  // Tính chỉ số theo từng chiến dịch dựa trên scanRounds, shortlist, usages (open:), outreach
  const statsByCampaign = useMemo(() => {
    const map = new Map<
      string,
      { matched: number; highMatch: number; shortlisted: number; opened: number; connected: number }
    >();

    for (const camp of campaigns) {
      const rounds = scanRounds
        .filter((r) => r.campaignId === camp.id)
        .sort((a, b) => b.roundNumber - a.roundNumber);
      const latestRound = rounds[0];
      const matched = latestRound?.totalMatched ?? 0;
      const highMatch = latestRound
        ? latestRound.candidates.filter((c) => c.score >= 80).length
        : 0;
      const shortlisted = shortlistedByCampaign[camp.id]?.length ?? 0;

      const openedSet = new Set<string>();
      for (const u of usages) {
        if (u.kind === 'profile_open' && u.campaignId === camp.id) {
          const cid = openCandidateIdFromNote(u.note);
          if (cid) openedSet.add(cid);
        }
      }
      const outreachList = outreachByCampaign[camp.id] ?? [];
      for (const o of outreachList) openedSet.add(o.candidateId);
      const connected = outreachList.filter(
        (o) => o.status === 'agreed' || o.status === 'guided_pending_apply' || o.status === 'applied',
      ).length;

      map.set(camp.id, {
        matched,
        highMatch,
        shortlisted,
        opened: openedSet.size,
        connected: connected || outreachList.length,
      });
    }
    return map;
  }, [campaigns, scanRounds, shortlistedByCampaign, usages, outreachByCampaign]);

  const efficiencySummary = useMemo(() => {
    const targetList =
      campaignFilter === 'all'
        ? campaigns
        : campaigns.filter((c) => c.id === campaignFilter);

    let matched = 0;
    let highMatch = 0;
    let shortlisted = 0;
    let opened = 0;
    let connected = 0;
    for (const camp of targetList) {
      const s = statsByCampaign.get(camp.id);
      if (!s) continue;
      matched += s.matched;
      highMatch += s.highMatch;
      shortlisted += s.shortlisted;
      opened += s.opened;
      connected += s.connected;
    }
    return { matched, highMatch, shortlisted, opened, connected };
  }, [campaignFilter, campaigns, statsByCampaign]);

  const packageCounts = useMemo(() => {
    let active = 0;
    let unused = 0;
    let completed = 0;
    let expired = 0;
    for (const p of packages) {
      if (p.status === 'ACTIVE') active += 1;
      else if (p.status === 'UNUSED') unused += 1;
      else if (p.status === 'COMPLETED') completed += 1;
      else if (p.status === 'EXPIRED') expired += 1;
    }
    return { all: packages.length, active, unused, completed, expired };
  }, [packages]);

  const filteredPackages = useMemo(
    () =>
      packageFilter === 'all' ? packages : packages.filter((p) => p.status === packageFilter),
    [packages, packageFilter],
  );

  /**
   * Chỉ hiển thị chiến dịch có gói Săn đang ACTIVE → khớp tuyệt đối với KPI "Đang sử dụng".
   */
  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.packageStatus === 'ACTIVE' && c.status !== 'closed'),
    [campaigns],
  );

  return (
    <div className="space-y-4">
      {/* Hàng 1: Hiệu quả tìm kiếm ứng viên + Tài nguyên Tin săn */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Trái: Hiệu quả tìm kiếm ứng viên */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[15px] font-bold text-[#072348]">Hiệu quả tìm kiếm ứng viên</h2>
              <span
                title="Thống kê ứng viên phù hợp, shortlist, đã mở hồ sơ và kết nối theo từng chiến dịch"
                className="text-slate-400"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>

            <select
              aria-label="Lọc theo chiến dịch"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="h-8 max-w-[210px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#072348] outline-none transition focus:border-[#0B468C]"
            >
              <option value="all">Toàn bộ chiến dịch</option>
              {campaigns.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {formatJobTitle(camp.title)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <MiniStatBox
              icon={<Users className="h-4 w-4 text-[#0B468C]" />}
              iconBg="bg-sky-50"
              label="Tổng phù hợp"
              value={efficiencySummary.matched}
              valueColor="text-[#E8872A]"
            />
            <MiniStatBox
              icon={<Sparkles className="h-4 w-4 text-amber-500" />}
              iconBg="bg-amber-50"
              label="Khớp cao ≥ 80%"
              value={efficiencySummary.highMatch}
              valueColor="text-[#E8872A]"
            />
            <MiniStatBox
              icon={<Bookmark className="h-4 w-4 text-indigo-600" />}
              iconBg="bg-indigo-50"
              label="Đã Shortlist"
              value={efficiencySummary.shortlisted}
              valueColor="text-[#E8872A]"
            />
            <MiniStatBox
              icon={<Eye className="h-4 w-4 text-sky-600" />}
              iconBg="bg-sky-50"
              label="Đã mở hồ sơ"
              value={efficiencySummary.opened}
              valueColor="text-[#E8872A]"
            />
            <MiniStatBox
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              iconBg="bg-emerald-50"
              label="Đã kết nối"
              value={efficiencySummary.connected}
              valueColor="text-emerald-600"
            />
          </div>
        </section>

        {/* Phải: Tài nguyên Tin săn */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5 lg:col-span-5">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[15px] font-bold text-[#072348]">Tài nguyên Tin săn</h2>
            <span
              title="Tổng số gói Tin săn đã mua, đang chạy, chưa kích hoạt và số dư Credit"
              className="text-slate-400"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MiniStatBox
              icon={<Layers className="h-4 w-4 text-[#E8872A]" />}
              iconBg="bg-amber-50"
              label="Gói đã mua"
              value={packageCounts.all}
              valueColor="text-[#E8872A]"
            />
            <MiniStatBox
              icon={<PlayCircle className="h-4 w-4 text-emerald-600" />}
              iconBg="bg-emerald-50"
              label="Gói đang dùng"
              value={packageCounts.active}
              valueColor="text-emerald-600"
            />
            <MiniStatBox
              icon={<Briefcase className="h-4 w-4 text-[#0B468C]" />}
              iconBg="bg-sky-50"
              label="Chiến dịch đang chạy"
              value={activeCampaigns.length}
              valueColor="text-[#0B468C]"
            />
            <div className="flex flex-col justify-between rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-orange-50/50 p-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-lg font-extrabold tabular-nums text-[#E8872A]">
                    {creditBalance}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-slate-600">Credit khả dụng</p>
              </div>
              <Link
                href="/recruiter/billing/topup"
                className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-[#c96a12] hover:underline"
              >
                Nạp thêm <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Hàng 2: Gói Tin săn của tôi (trái) + Chiến dịch Tin săn đang chạy (phải) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cột trái: Gói Tin săn của tôi */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-[15px] font-bold text-[#072348]">Gói Tin săn của tôi</h2>
              <span
                title="Danh sách từng gói Tin săn bạn đã mua. Gói chưa kích hoạt được bảo lưu tối đa 365 ngày. Mỗi gói gắn với đúng 1 chiến dịch Săn."
                className="text-slate-400"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">
                1 gói → 1 chiến dịch
              </span>
            </div>
            <Link
              href="/recruiter/pricing#sourcing"
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0B468C] hover:underline"
            >
              Mua thêm gói <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Filter pills */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `Tất cả (${packageCounts.all})` },
                { id: 'ACTIVE', label: `Đang sử dụng (${packageCounts.active})` },
                { id: 'UNUSED', label: `Chưa kích hoạt (${packageCounts.unused})` },
                { id: 'COMPLETED', label: `Đã hoàn thành (${packageCounts.completed})` },
                { id: 'EXPIRED', label: `Hết hạn (${packageCounts.expired})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPackageFilter(tab.id)}
                className={clsx(
                  'rounded-full px-3 py-1 text-[11.5px] font-semibold transition',
                  packageFilter === tab.id
                    ? 'bg-[#072348] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3.5 space-y-3">
            {filteredPackages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-xs text-slate-500">
                Không có gói Tin săn nào trong mục này.
              </div>
            ) : (
              filteredPackages.map((pkg) => {
                const isUnused = pkg.status === 'UNUSED';
                const isActive = pkg.status === 'ACTIVE';
                const isExpired = pkg.status === 'EXPIRED';
                const daysLeft = daysLeftOf(pkg.expiresAt);
                // 1 gói ↔ tối đa 1 chiến dịch.
                const pkgCampaigns = campaignsByPackage.get(pkg.id) ?? [];

                return (
                  <div
                    key={pkg.id}
                    className={clsx(
                      'rounded-2xl border p-3.5 transition',
                      isUnused
                        ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/50 via-white to-white'
                        : isActive
                          ? 'border-slate-200 bg-white hover:border-sky-200'
                          : 'border-slate-200/80 bg-slate-50/50 opacity-85',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          className={clsx(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            isUnused
                              ? 'bg-amber-100 text-amber-700'
                              : isActive
                                ? 'bg-sky-50 text-[#0B468C]'
                                : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          <Layers className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[14px] font-bold text-[#072348]">
                              {pkg.packageName}
                            </p>
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                                isUnused && 'bg-amber-100 text-amber-800',
                                isActive && 'bg-emerald-50 text-emerald-700',
                                pkg.status === 'COMPLETED' && 'bg-sky-50 text-[#0B468C]',
                                isExpired && 'bg-rose-50 text-rose-600',
                              )}
                            >
                              <span
                                className={clsx(
                                  'h-1.5 w-1.5 rounded-full',
                                  isUnused && 'bg-amber-500',
                                  isActive && 'bg-emerald-500',
                                  pkg.status === 'COMPLETED' && 'bg-sky-500',
                                  isExpired && 'bg-rose-500',
                                )}
                              />
                              {isUnused
                                ? 'Chưa kích hoạt'
                                : isActive
                                  ? 'Đang sử dụng'
                                  : pkg.status === 'COMPLETED'
                                    ? 'Đã hoàn thành'
                                    : 'Hết hạn'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-slate-500">
                            Mã gói: <span className="font-mono font-semibold text-slate-700">{pkg.code}</span>
                            {' · '}
                            {isUnused
                              ? `Mua ngày: ${fmtDateShort(pkg.purchasedAt)}`
                              : `Kích hoạt: ${fmtDateShort(pkg.activatedAt ?? pkg.purchasedAt)}`}
                          </p>
                        </div>
                      </div>

                      {isUnused ? (
                        <button
                          type="button"
                          disabled={!canOpenMorePositions}
                          onClick={() => onActivatePackage(pkg.id)}
                          className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          Kích hoạt gói
                        </button>
                      ) : pkgCampaigns.length > 0 ? (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          {pkgCampaigns.slice(0, 2).map((camp) => (
                            <Link
                              key={camp.id}
                              href={`/recruiter/sourcing/${camp.id}`}
                              title={`Quản lý chiến dịch: ${formatJobTitle(camp.title)}`}
                              className="max-w-[180px] truncate rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#072348] transition hover:border-sky-300 hover:bg-sky-50/40"
                            >
                              {formatJobTitle(camp.title)}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[11.5px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {isUnused ? (
                          <>
                            Thời hạn: <strong>{pkg.durationDays} ngày</strong> (từ khi kích hoạt)
                          </>
                        ) : (
                          <>
                            Còn <strong>{daysLeft ?? 0} ngày</strong> (đến {fmtDateShort(pkg.expiresAt)})
                          </>
                        )}
                      </span>
                      <span>
                        <strong className="text-[#E8872A]">{pkg.creditsIncluded}</strong> Credit
                        {pkg.creditsGranted ? ' · đã cấp vào ví' : ' · chưa cấp'}
                      </span>
                      <span>
                        <strong className="text-[#E8872A]">
                          {Math.max(0, pkg.totalCriteriaEdits - pkg.usedCriteriaEdits)}
                        </strong>{' '}
                        Lượt điều chỉnh
                      </span>
                      <span>
                        <strong className="text-[#E8872A]">
                          {Math.max(0, pkg.totalReports - pkg.usedReports)}
                        </strong>{' '}
                        Báo cáo
                      </span>
                      {pkg.totalHandovers > 0 ? (
                        <span>
                          <strong className="text-[#E8872A]">
                            {Math.max(0, pkg.totalHandovers - pkg.usedHandovers)}
                          </strong>{' '}
                          Lượt bàn giao
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Cột phải: Chiến dịch Tin săn đang chạy */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[15px] font-bold text-[#072348]">Chiến dịch Tin săn đang chạy</h2>
              <span
                title="Chỉ hiển thị chiến dịch có gói Săn đang hoạt động (ACTIVE). Bấm Quản lý chiến dịch để xem danh sách ứng viên ứng tuyển và ứng viên tiềm năng của vị trí đó."
                className="text-slate-400"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {activeCampaigns.length} chiến dịch
            </span>
          </div>

          <div className="mt-3.5 space-y-3">
            {activeCampaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-[#E8872A]" />
                <p className="mt-2 text-xs font-medium text-slate-600">
                  Chưa có chiến dịch Tin săn nào đang chạy.
                </p>
                {canOpenMorePositions && (
                  <button
                    type="button"
                    onClick={() => onActivatePackage('')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#072348] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3b80]"
                  >
                    Kích hoạt Tin săn ngay
                  </button>
                )}
              </div>
            ) : (
              activeCampaigns.map((camp) => {
                const linkedJob = camp.jobId ? jobById.get(camp.jobId) : undefined;
                const linkedPkg = packageById.get(camp.huntPackageId);
                const pkgEndsAt = camp.expiresAt ?? linkedPkg?.expiresAt ?? null;
                const daysLeft = daysLeftOf(pkgEndsAt);
                const stats = statsByCampaign.get(camp.id) ?? {
                  matched: 0,
                  highMatch: 0,
                  shortlisted: 0,
                  opened: 0,
                  connected: 0,
                };

                return (
                  <div
                    key={camp.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-200 hover:shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#072348]">
                          <Briefcase className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[14.5px] font-bold text-[#072348]">
                              {formatJobTitle(linkedJob?.title ?? camp.title)}
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Đang săn
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-slate-500">
                            {linkedJob?.code ? (
                              <span className="font-mono text-slate-600">{linkedJob.code} · </span>
                            ) : null}
                            {camp.packageName}
                            {camp.packageCode ? (
                              <>
                                {' · '}
                                <span className="font-mono text-slate-500">{camp.packageCode}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      {daysLeft != null && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          Còn {daysLeft} ngày
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <div className="rounded-xl bg-slate-50/90 px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-sm font-bold tabular-nums text-[#072348]">
                            {stats.matched}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">Phù hợp</p>
                      </div>
                      <div className="rounded-xl bg-slate-50/90 px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <Bookmark className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="text-sm font-bold tabular-nums text-[#072348]">
                            {stats.shortlisted}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">Shortlist</p>
                      </div>
                      <div className="rounded-xl bg-slate-50/90 px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-sky-600" />
                          <span className="text-sm font-bold tabular-nums text-[#072348]">
                            {stats.opened}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">Mở hồ sơ</p>
                      </div>
                      <div className="rounded-xl bg-slate-50/90 px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-sm font-bold tabular-nums text-[#072348]">
                            {stats.connected}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">Kết nối</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/recruiter/sourcing/${camp.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#0d3b80]"
                      >
                        Quản lý chiến dịch
                      </Link>
                      <button
                        type="button"
                        disabled={!camp.jobId}
                        onClick={() => onOpenRevision(camp.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#072348] transition hover:border-sky-300 hover:bg-sky-50/40 disabled:opacity-45"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Điều chỉnh tiêu chí
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniStatBox({
  icon,
  iconBg,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  valueColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <span className={clsx('inline-flex h-7 w-7 items-center justify-center rounded-lg', iconBg)}>
        {icon}
      </span>
      <p className="mt-2 text-[11px] font-medium text-slate-600">{label}</p>
      <p className={clsx('mt-0.5 text-xl font-extrabold tabular-nums', valueColor)}>{value}</p>
    </div>
  );
}
