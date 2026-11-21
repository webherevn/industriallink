'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Briefcase,
  CalendarDays,
  Coins,
  CreditCard,
  FileText,
  Link2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type {
  BillingPlatformPlanView,
  RecruiterActiveHuntPackageView,
  RecruiterBillingOverview,
  RecruiterJobPackageView,
  RecruiterPendingPackageView,
} from '@industriallink/contracts';
import { describeCreditAction } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { ApiError } from '@/lib/api';
import {
  fetchRecruiterBillingOverview,
  fetchRecruiterCreditTransactions,
  fetchRecruiterEntitlements,
  fetchRecruiterOrders,
} from '@/lib/recruiter-billing';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return 'Không giới hạn';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Định dạng dd/mm/yyyy — dùng cho hạn dùng gói (yêu cầu: "Hạn đến 20/12/2026"). */
function fmtDateDMY(iso: string | null | undefined) {
  if (!iso) return 'Không giới hạn';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function daysRemaining(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

function fmtVnd(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
}

type HistoryTab = 'transactions' | 'usage' | 'orders';

export function RecruiterBillingHub() {
  const searchParams = useSearchParams();
  const requestedCode = searchParams.get('plan');

  const [activeTab, setActiveTab] = useState<HistoryTab>('transactions');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [txDays, setTxDays] = useState<30 | 90 | 0>(30);

  const { data: entitlements } = useQuery({
    queryKey: ['recruiter-billing-entitlements'],
    queryFn: fetchRecruiterEntitlements,
    retry: 1,
  });

  /**
   * (B) TỔNG QUAN — nguồn sự thật cho trang này.
   * Đọc TRỰC TIẾP `BillingJobPackage` + `BillingHuntPackage` + Ví Credit dùng chung.
   * KHÔNG dùng `entitlements.sourcing.assignment` (số cộng dồn legacy).
   */
  const {
    data: overview,
    isLoading: loadingOverview,
    isError: isOverviewError,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['recruiter-billing-overview'],
    queryFn: fetchRecruiterBillingOverview,
    retry: 1,
  });

  const { data: pub } = useQuery({
    queryKey: ['public-billing-config'],
    queryFn: fetchPublicBillingConfig,
    staleTime: 60_000,
  });

  const { data: ledger, isLoading: loadingLedger } = useQuery({
    queryKey: ['recruiter-credit-ledger-hub'],
    queryFn: () => fetchRecruiterCreditTransactions({ limit: 50, offset: 0 }),
    retry: false,
  });

  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['recruiter-orders-hub'],
    queryFn: fetchRecruiterOrders,
    retry: false,
  });

  const plan = entitlements?.plan ?? null;
  const planName = plan?.planName ?? entitlements?.planName ?? 'Khám phá';

  // Gói tin đăng multi-active: danh sách gói đang chạy (mỗi gói 1 lượt đăng riêng).
  const activeJobPackages = useMemo(() => overview?.activeJobPackages ?? [], [overview]);
  // Gói Săn multi-active: MỖI gói = 1 card độc lập (không gộp vào 1 card chung).
  const activeHuntPackages = useMemo(() => overview?.activeHuntPackages ?? [], [overview]);
  const pendingPackages = useMemo(() => overview?.pendingPackages ?? [], [overview]);

  // Gói Săn đang chạy = có ít nhất 1 gói ACTIVE (KHÔNG dựa vào assignment legacy).
  const showSourcingColumn = activeHuntPackages.length > 0;
  const showJobPackages = activeJobPackages.length > 0;
  const showPlatformCard = Boolean(
    showJobPackages || (plan && !showSourcingColumn),
  );
  // Số gói đang sử dụng = gói tin đăng ACTIVE + gói Săn ACTIVE.
  const activePackageCount = activeJobPackages.length + activeHuntPackages.length;

  const requested = pub?.platformPlans.find((p) => p.code === requestedCode) ?? null;
  const requestedSourcing = requested
    ? null
    : (pub?.sourcingPlans.find((p) => p.code === requestedCode) ?? null);
  const filteredTx = useMemo(() => {
    let items = ledger?.items ?? [];
    if (activeTab === 'usage') {
      items = items.filter((t) => t.creditDelta < 0);
    } else if (txTypeFilter === 'in') {
      items = items.filter((t) => t.creditDelta > 0);
    } else if (txTypeFilter === 'out') {
      items = items.filter((t) => t.creditDelta < 0);
    }
    if (txDays > 0) {
      const cutoff = Date.now() - txDays * 24 * 60 * 60 * 1000;
      items = items.filter((t) => new Date(t.createdAt).getTime() >= cutoff);
    }
    return items;
  }, [ledger?.items, activeTab, txTypeFilter, txDays]);

  const filteredOrders = useMemo(() => {
    const list = ordersData?.items ?? [];
    if (txDays === 0) return list;
    const cutoff = Date.now() - txDays * 24 * 60 * 60 * 1000;
    return list.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
  }, [ordersData?.items, txDays]);

  /**
   * (2) Chính sách Credit:
   * Credit từ gói mua (`package_grant`) và nạp thêm (`topup`) GIỮ LẠI lâu dài trong
   * Ví dùng chung. CHỈ lô miễn phí `plan_grant` mới có hạn → chỉ khi có lô này
   * sắp hết hạn mới hiển thị tag "Hạn: ...".
   */
  const expiringLot = overview?.expiringLot ?? null;

  /**
   * (3) Chuẩn hoá "Tổng quyền lợi đang có" — SUM duy nhất trên danh sách gói ACTIVE.
   */
  const benefits = useMemo(() => {
    // Cột trái: gói tin đăng ACTIVE (KHÔNG đếm gói FREE cũ hay UNUSED).
    const jobUsed = activeJobPackages.reduce((sum, p) => sum + (p.jobsUsed ?? 0), 0);
    const jobTotal = activeJobPackages.reduce((sum, p) => sum + (p.jobPostQuota ?? 0), 0);

    // Cột phải: gói Săn ACTIVE — mỗi gói 1 vị trí.
    const huntPositionsUsed = activeHuntPackages.reduce((s, p) => s + p.positionsUsed, 0);
    const huntPositionsTotal = activeHuntPackages.reduce((s, p) => s + p.positionsTotal, 0);

    // Chỉ gói DEEP mới có bàn giao Inlink.
    const deepPackages = activeHuntPackages.filter((p) => p.packageType === 'DEEP');
    const handoverUsed = deepPackages.reduce((s, p) => s + p.usedHandovers, 0);
    const handoverTotal = deepPackages.reduce((s, p) => s + p.totalHandovers, 0);

    const criteriaUsed = activeHuntPackages.reduce((s, p) => s + p.usedCriteriaEdits, 0);
    const criteriaTotal = activeHuntPackages.reduce((s, p) => s + p.totalCriteriaEdits, 0);

    const reportsUsed = activeHuntPackages.reduce((s, p) => s + p.usedReports, 0);
    const reportsTotal = activeHuntPackages.reduce((s, p) => s + p.totalReports, 0);

    return {
      jobUsed,
      jobTotal,
      huntPositionsUsed,
      huntPositionsTotal,
      handoverUsed,
      handoverTotal,
      criteriaUsed,
      criteriaTotal,
      reportsUsed,
      reportsTotal,
    };
  }, [activeJobPackages, activeHuntPackages]);

  return (
    <RecruiterShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-[#E8872A]">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#072348]">
                Gói dịch vụ &amp; Ví Credit
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Quản lý các gói đang sử dụng, số dư Credit và quyền lợi tuyển dụng của doanh nghiệp.
              </p>
            </div>
          </div>
        </div>

        {requested ? (
          <RequestedPlanBanner plan={requested} isCurrent={plan?.planCode === requested.code} />
        ) : requestedSourcing ? (
          <RequestedSourcingBanner
            planName={requestedSourcing.name}
            planCode={requestedSourcing.code}
            isCurrent={activeHuntPackages.some((p) => {
              const code = requestedSourcing.code.toUpperCase();
              if (code.includes('CHUYEN_SAU') || code.includes('DEEP')) return p.packageType === 'DEEP';
              if (code.includes('CO_BAN') || code.includes('BASIC')) return p.packageType === 'BASIC';
              if (code.includes('TIEU_CHUAN') || code.includes('STANDARD')) return p.packageType === 'STANDARD';
              return false;
            })}
          />
        ) : null}

        {/* Hàng 1: Banner Ví Credit + Thao tác nhanh */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* Ví Credit */}
          <div className="brand-hero-surface relative overflow-hidden rounded-2xl p-5 text-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#FFB366] ring-1 ring-white/20">
                  <Coins className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-medium text-white/75">Số dư Ví Credit</p>
                  <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-[#FFB366]">
                    {overview ? fmtNum(overview.creditBalance) : '0'}{' '}
                    <span className="text-base font-semibold text-white">Credit</span>
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-white/85">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">
                    {overview ? fmtNum(overview.lifetimeGranted) : '0'} Credit
                  </span>
                  <span className="text-white/65">Đã cấp tổng cộng</span>
                  {/*
                    (2) CHỈ hiển thị hạn khi thực sự có lô Credit MIỄN PHÍ (`plan_grant`)
                    sắp hết hạn. Credit từ gói mua + nạp thêm giữ lâu dài vô thời hạn.
                  */}
                  {expiringLot ? (
                    <span
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] text-amber-200"
                      title={`${fmtNum(expiringLot.available)} Credit miễn phí sắp hết hạn`}
                    >
                      Hạn: {fmtDate(expiringLot.expiresAt)}
                    </span>
                  ) : null}
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">
                    {overview ? fmtNum(overview.lifetimeConsumed) : '0'} Credit
                  </span>
                  <span className="text-white/65">Đã sử dụng</span>
                  <span className="text-white/50">·</span>
                  <span className="text-white/75">Credit nạp thêm có hiệu lực lâu dài</span>
                </p>
              </div>
            </div>
          </div>

          {/* Thao tác nhanh */}
          <div className="flex flex-col justify-center rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#072348]">
              <Zap className="h-3.5 w-3.5 text-[#E8872A]" />
              Thao tác nhanh
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <Link
                href="/recruiter/billing/topup"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#0c3266]"
              >
                <span>Nạp Credit</span>
                <Plus className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/recruiter/pricing"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#072348] transition hover:bg-slate-50"
              >
                <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                <span>Mua thêm gói</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('orders');
                  // Cuộn xuống tab "Hoá đơn & thanh toán" ngay bên dưới.
                  window.setTimeout(() => {
                    document
                      .getElementById('billing-history-tabs')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#072348] transition hover:bg-slate-50"
              >
                <CreditCard className="h-3.5 w-3.5 text-amber-600" />
                <span>Xem hóa đơn</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hàng 2: Gói đang sử dụng — 2 cột ( trái: tin đăng · phải: từng gói Săn) */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#072348]">
              Gói đang sử dụng ({activePackageCount})
            </h2>
            <Link
              href="/recruiter/pricing"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100/70"
            >
              <span>Xem bảng giá nâng cấp</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loadingOverview ? (
            <div className="mt-3 h-36 animate-pulse rounded-2xl bg-slate-100" />
          ) : isOverviewError ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
              <p className="font-semibold text-slate-800">Không tải được thông tin gói</p>
              <p className="mt-1 text-xs text-slate-500">
                {overviewError instanceof ApiError
                  ? overviewError.message
                  : 'Tải lại trang hoặc bấm thử lại.'}
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-[#1D4ED8] hover:underline"
                onClick={() => void refetchOverview()}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {/* ============ CỘT TRÁI: Gói Tin đăng / Nền tảng ============ */}
              <div className="space-y-4">
                {showJobPackages ? (
                  <JobPackagesCard packages={activeJobPackages} />
                ) : (
                  showPlatformCard &&
                  plan && (
                    <PlatformPlanCard
                      planName={planName}
                      isActive={plan.isActive}
                      expiresAt={plan.endsAt}
                      activatedAt={plan.activatedAt ?? null}
                      reserveEndsAt={plan.reserveEndsAt ?? null}
                      jobsUsed={entitlements?.jobsUsed ?? 0}
                      jobPostQuota={entitlements?.jobPostQuota ?? null}
                      creditQuota={entitlements?.creditQuota ?? null}
                      jobDisplayDays={entitlements?.jobDisplayDays ?? null}
                    />
                  )
                )}
              </div>

              {/* ============ CỘT PHẢI: TỪNG GÓI SĂN (1 card / gói) ============ */}
              <div className="space-y-4">
                {showSourcingColumn ? (
                  <>
                    <p className="text-xs font-semibold text-slate-500">
                      Gói Tin săn đang chạy ({activeHuntPackages.length})
                    </p>
                    {activeHuntPackages.map((pkg) => (
                      <HuntPackageCard key={pkg.id} pkg={pkg} />
                    ))}
                    {/* Tổng gọn khớp 100% với cột trái. */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs shadow-2xs">
                      <span className="text-slate-600">
                        Tổng vị trí Săn:{' '}
                        <strong className="text-[#072348]">
                          {benefits.huntPositionsUsed} / {benefits.huntPositionsTotal} vị trí
                        </strong>
                      </span>
                      <Link
                        href="/recruiter/sourcing"
                        className="inline-flex items-center gap-1 font-semibold text-[#E8872A] hover:underline"
                      >
                        Quản lý Săn nhân sự <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center">
                    <p className="text-sm font-semibold text-slate-600">
                      Chưa có gói Tin săn đang chạy
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Mua gói Săn nhân sự để mở chiến dịch tìm ứng viên tiềm năng.
                    </p>
                    <Link
                      href="/recruiter/pricing"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#E8872A] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#d97a20]"
                    >
                      Xem gói Săn nhân sự <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hàng 2b: Gói chờ kích hoạt (UNUSED) từ CẢ gói tin đăng + gói Săn */}
        {!loadingOverview && pendingPackages.length > 0 ? (
          <PendingPackagesBlock packages={pendingPackages} />
        ) : null}

        {/* Hàng 3: Tổng quyền lợi đang có */}
        {!loadingOverview && !isOverviewError && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#072348]">
                <Star className="h-4 w-4 text-amber-500" fill="currentColor" />
                Tổng quyền lợi đang có
              </span>

              <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2.5 text-xs">
                {/*
                  (3) Chuẩn hoá: SUM DUY NHẤT trên danh sách gói `ACTIVE` ở 2 cột trên.
                  KHÔNG dùng số cộng dồn legacy (1/5, 2/6, 302, 0/72, 0/21).
                */}
                {showJobPackages && (
                  <BenefitItem
                    icon={<FileText className="h-4 w-4 text-[#0B468C]" />}
                    label="Lượt tin đang chạy"
                    value={`${benefits.jobUsed}/${benefits.jobTotal} tin`}
                  />
                )}

                {showSourcingColumn && (
                  <BenefitItem
                    icon={<Target className="h-4 w-4 text-[#E8872A]" />}
                    label="Vị trí Săn đang chạy"
                    value={`${benefits.huntPositionsUsed}/${benefits.huntPositionsTotal} vị trí`}
                  />
                )}

                {/* (3) "Credit khả dụng" đọc trực tiếp `billing_credit_account.balance`. */}
                <BenefitItem
                  icon={<Coins className="h-4 w-4 text-amber-500" />}
                  label="Credit khả dụng"
                  value={`${fmtNum(overview?.creditBalance ?? 0)} Credit`}
                />

                {/* (3) "Bàn giao Inlink" = SUM của các gói DEEP đang ACTIVE. */}
                {benefits.handoverTotal > 0 && (
                  <BenefitItem
                    icon={<Link2 className="h-4 w-4 text-sky-600" />}
                    label="Bàn giao Inlink"
                    value={`${benefits.handoverUsed}/${benefits.handoverTotal} lượt`}
                  />
                )}

                {benefits.criteriaTotal > 0 && (
                  <BenefitItem
                    icon={<Pencil className="h-4 w-4 text-amber-600" />}
                    label="Điều chỉnh JD"
                    value={`${benefits.criteriaUsed}/${benefits.criteriaTotal} lượt`}
                  />
                )}

                {benefits.reportsTotal > 0 && (
                  <BenefitItem
                    icon={<BarChart3 className="h-4 w-4 text-indigo-600" />}
                    label="Báo cáo tiến độ"
                    value={`${benefits.reportsUsed}/${benefits.reportsTotal} báo cáo`}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hàng 4: Lịch sử giao dịch / Quyền lợi / Hoá đơn & thanh toán */}
        <div
          id="billing-history-tabs"
          className="scroll-mt-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 pt-3">
            <div className="flex gap-1 overflow-x-auto">
              {(
                [
                  { key: 'transactions', label: 'Lịch sử giao dịch' },
                  { key: 'usage', label: 'Lịch sử sử dụng quyền lợi' },
                  { key: 'orders', label: 'Hoá đơn & thanh toán' },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={clsx(
                    'shrink-0 border-b-2 px-3.5 pb-3 pt-1 text-xs font-semibold transition',
                    activeTab === t.key
                      ? 'border-[#072348] text-[#072348]'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pb-2.5">
              {activeTab === 'transactions' && (
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value as 'all' | 'in' | 'out')}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="all">Tất cả giao dịch</option>
                  <option value="in">Cấp / Nạp Credit</option>
                  <option value="out">Sử dụng Credit</option>
                </select>
              )}
              <select
                value={txDays}
                onChange={(e) => setTxDays(Number(e.target.value) as 30 | 90 | 0)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none"
              >
                <option value={30}>30 ngày qua</option>
                <option value={90}>90 ngày qua</option>
                <option value={0}>Tất cả thời gian</option>
              </select>
            </div>
          </div>

          {/* Nội dung Tab */}
          <div className="overflow-x-auto">
            {activeTab !== 'orders' ? (
              <table className="w-full min-w-[680px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11.5px] font-semibold text-slate-500">
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-3 py-3">Loại giao dịch</th>
                    <th className="px-3 py-3">Nội dung</th>
                    <th className="px-3 py-3 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Số dư sau</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLedger && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                        Đang tải lịch sử...
                      </td>
                    </tr>
                  )}
                  {!loadingLedger && filteredTx.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                        Chưa có giao dịch nào trong khoảng thời gian này.
                      </td>
                    </tr>
                  )}
                  {!loadingLedger &&
                    filteredTx.map((tx) => {
                      const isPositive = tx.creditDelta > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {fmtDateTime(tx.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={clsx(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                isPositive
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-800',
                              )}
                            >
                              {isPositive ? 'Cấp / Nạp Credit' : 'Sử dụng Credit'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-slate-700">
                            {/*
                              (4) Map toàn bộ `actionType` thô sang tiếng Việt đầy đủ.
                              - `view_profile` → "Mở hồ sơ ứng viên" + tên/mã ứng viên (nếu có).
                              - `package_grant` → "Cấp [X] Credit khi kích hoạt gói [Tên gói]".
                            */}
                            {describeCreditAction(tx.action, tx.metadata, tx.note)}
                          </td>
                          <td
                            className={clsx(
                              'px-3 py-3 text-right text-xs font-bold tabular-nums',
                              isPositive ? 'text-emerald-600' : 'text-rose-600',
                            )}
                          >
                            {isPositive ? `+${tx.creditDelta}` : tx.creditDelta} Credit
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-slate-600">
                            {fmtNum(tx.balanceAfter)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[680px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11.5px] font-semibold text-slate-500">
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-3 py-3">Loại đơn</th>
                    <th className="px-3 py-3">Gói / Sản phẩm</th>
                    <th className="px-3 py-3 text-right">Thanh toán</th>
                    <th className="px-4 py-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingOrders && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                        Đang tải hoá đơn...
                      </td>
                    </tr>
                  )}
                  {!loadingOrders && filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                        Chưa có đơn thanh toán nào trong khoảng thời gian này.
                      </td>
                    </tr>
                  )}
                  {!loadingOrders &&
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {fmtDateTime(ord.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                          {ord.kind === 'topup'
                            ? 'Nạp Credit'
                            : ord.kind === 'sourcing'
                              ? 'Gói Săn nhân sự'
                              : 'Gói Tin đăng'}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          {ord.planName ??
                            (ord.creditCountSnapshot > 0
                              ? `Nạp ${ord.creditCountSnapshot} Credit`
                              : 'Dịch vụ Inlink')}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-[#072348]">
                          {fmtVnd(ord.payableVnd)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={clsx(
                              'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              ord.status === 'paid' && 'bg-emerald-50 text-emerald-700',
                              ord.status === 'pending' && 'bg-amber-50 text-amber-800',
                              ord.status === 'failed' && 'bg-rose-50 text-rose-600',
                              ord.status === 'refunded' && 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {ord.status === 'paid'
                              ? 'Thành công'
                              : ord.status === 'pending'
                                ? 'Chờ thanh toán'
                                : ord.status === 'failed'
                                  ? 'Thất bại'
                                  : 'Đã hoàn'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </RecruiterShell>
  );
}

/**
 * Gói tin đăng multi-active: mỗi gói là 1 lần mua độc lập, cấp lượt đăng cho 1 tin riêng.
 */
function JobPackagesCard({ packages }: { packages: RecruiterJobPackageView[] }) {
  const totalJobs = packages.reduce((sum, p) => sum + (p.jobPostQuota ?? 0), 0);
  const usedJobs = packages.reduce((sum, p) => sum + (p.jobsUsed ?? 0), 0);
  const totalCredits = packages.reduce((sum, p) => sum + (p.creditQuota ?? 0), 0);
  const displayDays = packages
    .map((p) => p.displayDays ?? 0)
    .filter((d) => d > 0)
    .sort((a, b) => b - a)[0];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-[#1D4ED8]">
            <Briefcase className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-[#072348]">
              Gói tin đăng đang chạy ({packages.length})
            </p>
            <p className="text-xs text-slate-500">
              Mỗi gói quản lý lượt đăng và thời hạn độc lập theo từng đơn mua.
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {packages.map((pkg) => {
          const pct =
            pkg.jobPostQuota && pkg.jobPostQuota > 0
              ? Math.min(100, Math.round(((pkg.jobsUsed ?? 0) / pkg.jobPostQuota) * 100))
              : 0;
          const daysLeft = daysRemaining(pkg.endsAt);
          return (
            <li
              key={pkg.code}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-bold text-[#072348]">{pkg.planName}</p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Đang hoạt động
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] font-medium text-slate-400">{pkg.code}</p>
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Lượt tin đã dùng</span>
                  <span className="font-bold text-[#072348]">
                    {pkg.jobsUsed ?? 0} / {pkg.jobPostQuota ?? '∞'} tin
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full bg-[#1D4ED8]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                {pkg.creditQuota ? (
                  <span className="inline-flex items-center gap-1">
                    <Coins className="h-3 w-3 text-slate-400" />
                    {pkg.creditQuota} Credit
                  </span>
                ) : null}
                {displayDays ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 text-slate-400" />
                    Hiển thị {displayDays} ngày
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3 text-slate-400" />
                  Hạn đến {fmtDate(pkg.endsAt)}
                  {daysLeft != null ? ` (còn ${daysLeft} ngày)` : ''}
                </span>
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span>
          Tổng lượt tin:{' '}
          <strong className="text-[#072348]">
            {usedJobs} / {totalJobs} tin
          </strong>
        </span>
        <span>
          Tổng Credit gói:{' '}
          <strong className="text-[#072348]">{fmtNum(totalCredits)} Credit</strong>
        </span>
      </div>
    </section>
  );
}

function PlatformPlanCard({
  planName,
  isActive,
  expiresAt,
  activatedAt,
  reserveEndsAt,
  jobsUsed,
  jobPostQuota,
  creditQuota,
  jobDisplayDays,
}: {
  planName: string;
  isActive: boolean;
  expiresAt: string | null;
  activatedAt?: string | null;
  reserveEndsAt?: string | null;
  jobsUsed: number;
  jobPostQuota: number | null;
  creditQuota: number | null;
  jobDisplayDays: number | null;
}) {
  const isReserved = Boolean(isActive && !activatedAt && reserveEndsAt);
  const daysLeft = daysRemaining(isReserved ? reserveEndsAt! : expiresAt);
  const pct =
    jobPostQuota && jobPostQuota > 0
      ? Math.min(100, Math.round((jobsUsed / jobPostQuota) * 100))
      : 0;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-[#1D4ED8]">
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-bold text-[#072348]">{planName}</p>
              <p className="text-xs text-slate-500">
                Đăng tin tuyển dụng, tăng hiện diện thương hiệu.
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                {isReserved ? (
                  <span>
                    Đang bảo lưu đến: <strong className="text-sky-700">{fmtDate(reserveEndsAt!)}</strong>
                    {daysLeft != null ? ` (còn ${daysLeft}/365 ngày)` : ''}
                  </span>
                ) : (
                  <span>
                    Hạn đến: <strong className="text-slate-700">{fmtDate(expiresAt)}</strong>
                    {daysLeft != null ? ` (còn ${daysLeft} ngày)` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          <span
            className={clsx(
              'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              isReserved
                ? 'bg-sky-50 text-[#0B468C]'
                : isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600',
            )}
          >
            {isReserved ? 'Đang bảo lưu' : isActive ? 'Đang hoạt động' : 'Đã tắt'}
          </span>
        </div>

        <div className="flex-1 space-y-3 lg:max-w-md">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Lượt tin đã dùng</span>
              <span className="font-bold text-[#072348]">
                {jobPostQuota != null ? `${jobsUsed} / ${jobPostQuota} tin` : `${jobsUsed} tin (Không giới hạn)`}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#1D4ED8] transition-all"
                style={{ width: `${jobPostQuota ? pct : 35}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
            <div>
              <span className="text-slate-500">Credit gói: </span>
              <strong className="text-[#072348]">
                {creditQuota != null ? `${fmtNum(creditQuota)} Credit` : 'Theo nạp'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Hiển thị tin: </span>
              <strong className="text-[#072348]">
                {jobDisplayDays != null ? `${jobDisplayDays} ngày` : 'Mặc định'}
              </strong>
            </div>
            <Link
              href="/jobs/manage"
              className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8] hover:underline"
            >
              Quản lý tin <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * (1) 1 CARD ĐỘC LẬP cho MỖI gói Săn đang chạy.
 *
 * Không gộp vào 1 "gói Săn chung" như cũ: mỗi gói trong `BillingHuntPackage`
 * là 1 lần mua độc lập với hạn dùng + hạn mức riêng.
 */
function HuntPackageCard({ pkg }: { pkg: RecruiterActiveHuntPackageView }) {
  const daysLeft = daysRemaining(pkg.expiresAt);
  const posPct =
    pkg.positionsTotal > 0
      ? Math.min(100, Math.round((pkg.positionsUsed / pkg.positionsTotal) * 100))
      : 0;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-[#E8872A]">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold uppercase tracking-wide text-[#072348]">
              {pkg.packageName}
            </p>
            <p className="text-[11.5px] font-medium text-slate-400">{pkg.code}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          Đang hoạt động
        </span>
      </div>

      {/* Tiến độ vị trí Săn của riêng gói này. */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">Tiến độ vị trí</span>
          <span className="font-bold text-[#072348]">
            {pkg.positionsUsed}/{pkg.positionsTotal} vị trí
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-[#E8872A] transition-all"
            style={{ width: `${posPct}%` }}
          />
        </div>
      </div>

      {/* Credit đã cấp + hạn dùng thực tế. */}
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3 w-3 text-slate-400" />
          <strong className="font-bold text-[#072348]">{pkg.creditsIncluded} Credit</strong>
          {pkg.creditsGranted ? (
            <span className="text-slate-400">đã cấp</span>
          ) : (
            <span className="text-amber-600">chờ cấp</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3 text-slate-400" />
          Hạn đến <strong className="font-bold text-slate-700">{fmtDateDMY(pkg.expiresAt)}</strong>
          {daysLeft != null ? ` · còn ${daysLeft} ngày` : ''}
        </span>
      </p>

      {/* Chỉ số thực của RIÊNG gói này. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px]">
        <span>
          <span className="text-slate-500">Điều chỉnh: </span>
          <strong className="text-[#072348]">
            {pkg.usedCriteriaEdits}/{pkg.totalCriteriaEdits}
          </strong>
        </span>
        <span>
          <span className="text-slate-500">Báo cáo: </span>
          <strong className="text-[#072348]">
            {pkg.usedReports}/{pkg.totalReports}
          </strong>
        </span>
        {/* Chỉ gói DEEP mới có bàn giao Inlink. */}
        {pkg.packageType === 'DEEP' && pkg.totalHandovers > 0 ? (
          <span>
            <span className="text-slate-500">Bàn giao Inlink: </span>
            <strong className="text-[#072348]">
              {pkg.usedHandovers}/{pkg.totalHandovers}
            </strong>
          </span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * (2) Gói chờ kích hoạt (`UNUSED`) — từ CẢ gói tin đăng + gói Săn.
 */
function PendingPackagesBlock({ packages }: { packages: RecruiterPendingPackageView[] }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold text-[#072348]">
            Gói chờ kích hoạt ({packages.length})
          </p>
          <p className="text-xs text-slate-500">
            Đã mua nhưng chưa kích hoạt — Credit và quyền lợi sẽ được cấp khi bạn kích hoạt.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {packages.map((pkg) => {
          const daysLeft = daysRemaining(pkg.activationDeadlineAt);
          return (
            <li
              key={`${pkg.kind}-${pkg.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    pkg.kind === 'hunt'
                      ? 'bg-amber-50 text-[#E8872A]'
                      : 'bg-sky-50 text-[#1D4ED8]',
                  )}
                >
                  {pkg.kind === 'hunt' ? (
                    <Target className="h-4 w-4" />
                  ) : (
                    <Briefcase className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-[13.5px] font-bold text-[#072348]">{pkg.packageName}</p>
                  <p className="text-[11.5px] font-medium text-slate-400">
                    {pkg.code} · {pkg.kind === 'hunt' ? 'Gói Săn' : 'Gói tin đăng'} ·{' '}
                    {pkg.creditsIncluded} Credit
                  </p>
                  {pkg.activationDeadlineAt ? (
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Hạn kích hoạt: {fmtDate(pkg.activationDeadlineAt)}
                      {daysLeft != null ? ` (còn ${daysLeft} ngày)` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              <Link
                href={pkg.activateHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#E8872A] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#d97a20]"
              >
                Kích hoạt ngay <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BenefitItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
        {icon}
      </span>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="font-bold text-[#072348]">{value}</p>
      </div>
    </div>
  );
}

function RequestedPlanBanner({
  plan,
  isCurrent,
}: {
  plan: BillingPlatformPlanView;
  isCurrent: boolean;
}) {
  const isFree = Number(plan.priceVnd) === 0;
  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-2xl border p-4 text-sm',
        isCurrent
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
          : 'border-accent-200 bg-accent-50/80 text-brand-800',
      )}
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
      <div>
        <p className="font-semibold">
          {isCurrent ? `Bạn đang dùng gói ${plan.name}` : `Bạn đã chọn gói ${plan.name}`}
        </p>
        {!isCurrent ? (
          <Link
            href={
              isFree
                ? '/recruiter/pricing'
                : `/recruiter/billing/upgrade?plan=${encodeURIComponent(plan.code)}`
            }
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-800 hover:underline"
          >
            {isFree ? 'Xem các gói khác' : 'Đi tới thanh toán'} <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function RequestedSourcingBanner({
  planName,
  planCode,
  isCurrent,
}: {
  planName: string;
  planCode: string;
  isCurrent: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-2xl border p-4 text-sm',
        isCurrent
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
          : 'border-accent-200 bg-accent-50/80 text-brand-800',
      )}
    >
      <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
      <div>
        <p className="font-semibold">
          {isCurrent ? `Bạn đang dùng gói Săn ${planName}` : `Bạn chọn gói Săn ${planName}`}
        </p>
        {!isCurrent ? (
          <Link
            href={`/recruiter/billing/sourcing?plan=${encodeURIComponent(planCode)}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-800 hover:underline"
          >
            Đi tới thanh toán <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            href="/recruiter/sourcing"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            Mở workspace Săn <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
