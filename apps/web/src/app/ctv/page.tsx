'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Check,
  ClipboardList,
  Coins,
  Copy,
  FileText,
  Layers,
  Link2,
  Loader2,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { CrmPartnerSelfView, CtvMonthlyTierView } from '@industriallink/contracts';
import { Button, Card, Input } from '@/components/ui';
import { errorText, formatVnd } from '@/components/crm/format';
import { createMyPartnerClaim, fetchMyPartner, registerMyPartner } from '@/lib/crm';
import { fetchMyCommissionTier } from '@/lib/ctv-commission';
import { fetchMyKyc } from '@/lib/ctv-kyc';
import { fetchMe } from '@/lib/auth';
import { KYC_STATUS_META } from '@/components/ctv-shell';

export default function CtvOverviewPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const session = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });

  // Chưa đăng nhập -> sang trang đăng nhập CTV.
  useEffect(() => {
    if (session.isError || (session.isSuccess && !session.data)) {
      router.replace('/ctv/login');
    }
  }, [router, session.isError, session.isSuccess, session.data]);

  const mine = useQuery({
    queryKey: ['recruiter-partner'],
    queryFn: fetchMyPartner,
    enabled: Boolean(session.data),
  });
  const partner = mine.data?.partner ?? null;
  const kyc = useQuery({
    queryKey: ['ctv-kyc'],
    queryFn: fetchMyKyc,
    enabled: Boolean(partner?.id),
    retry: false,
  });
  const tier = useQuery({
    queryKey: ['ctv-commission-tier'],
    queryFn: () => fetchMyCommissionTier(),
    enabled: Boolean(partner?.id),
    retry: false,
  });
  const [copied, setCopied] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const entries = mine.data?.commissions ?? [];
  const payoutDay = mine.data?.payoutDay ?? 10;
  const monthEntries = entries.filter((entry) => inThisMonth(entry.paidAt));
  const monthTotal = sumVnd(monthEntries);
  const kycStatus = kyc.data?.status ?? 'UNVERIFIED';
  const kycMeta = KYC_STATUS_META[kycStatus];

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (session.isLoading || mine.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Đang tải dữ liệu cộng tác viên...
      </div>
    );
  }

  if (mine.isError) {
    return (
      <Card className="p-5 text-sm text-rose-600">Không tải được thông tin cộng tác viên.</Card>
    );
  }

  // Chưa đăng ký làm cộng tác viên.
  if (!partner) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold tracking-tight text-[#0F2440]">
            Kích hoạt tài khoản Cộng tác viên
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Hệ thống tự cấp mã giới thiệu riêng gắn với tài khoản đang đăng nhập — không cần nhập số điện thoại, bảo mật thông tin cá nhân. Mỗi tài khoản chỉ có một mã.
          </p>
          <PartnerRegisterForm onDone={() => void qc.invalidateQueries({ queryKey: ['recruiter-partner'] })} />
        </section>
      </div>
    );
  }

  const claims = partner.claims ?? [];

  return (
    <div className="space-y-5">
      {/* Banner nhắc KYC — hiện trên cùng khi chưa xác thực */}
      {kycStatus !== 'VERIFIED' ? (
        <section
          className={clsx(
            'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5',
            kycStatus === 'REJECTED'
              ? 'border-rose-200 bg-rose-50'
              : kycStatus === 'PENDING'
                ? 'border-blue-200 bg-blue-50'
                : 'border-amber-200 bg-amber-50',
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={clsx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm',
                kycStatus === 'REJECTED' ? 'text-rose-600' : 'text-amber-600',
              )}
            >
              {kycStatus === 'REJECTED' ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                {kycStatus === 'REJECTED'
                  ? 'Xác thực CCCD bị từ chối'
                  : kycStatus === 'PENDING'
                    ? 'Hồ sơ xác thực đang chờ duyệt'
                    : 'Hoàn tất xác thực CCCD & ngân hàng để nhận hoa hồng'}
              </p>
              <p className="mt-1 text-sm leading-snug text-slate-700">
                {kycStatus === 'REJECTED'
                  ? kyc.data?.kycRejectReason ?? 'Vui lòng gửi lại hồ sơ sau khi điều chỉnh.'
                  : kycStatus === 'PENDING'
                    ? 'CRM Admin sẽ duyệt trong thời gian sớm. Số dư vẫn được bảo lưu an toàn.'
                    : 'Chưa xác thực thì kỳ chi trả sẽ tạm giữ. Xác thực một lần là nhận hoa hồng định kỳ ngày ' +
                      payoutDay +
                      ' hàng tháng.'}
              </p>
            </div>
          </div>
          <Link
            href="/ctv/kyc"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0F2440] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16324f]"
          >
            {kycStatus === 'REJECTED' ? 'Gửi lại hồ sơ' : 'Xác thực ngay'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}

      {/* Banner số dư ví */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0F2440] p-5 text-white shadow-sm sm:p-6">
        <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,18rem)_1px_minmax(0,1fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              Số dư ví hoa hồng
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {formatVnd(partner.walletBalanceVnd)}
            </p>
            <p className="mt-2 text-sm text-white/75">
              Mã <span className="font-mono font-semibold">{partner.code}</span> · {partner.name}
            </p>
          </div>
          <div className="hidden h-16 bg-white/20 lg:block" />
          <div className="flex items-center justify-between gap-4">
            <p className="max-w-md text-sm leading-relaxed text-white/80">
              Số dư trên Inlink, tự động cộng khi khách hàng thanh toán gói dịch vụ và đối soát
              chuyển khoản ngân hàng vào ngày {payoutDay} hàng tháng.
            </p>
            <Wallet className="hidden h-12 w-12 shrink-0 text-white/40 sm:block" strokeWidth={1.2} />
          </div>
        </div>
      </section>

      {/* Thẻ cấp bậc tháng này + thanh tiến độ lên hạng */}
      <TierProgressCard
        tier={tier.data ?? null}
        loading={tier.isLoading}
      />

      {/* 4 thẻ KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Layers className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-700"
          label="Đơn có hoa hồng"
          value={String(entries.length)}
          hint="Mỗi đơn đã thanh toán một dòng"
        />
        <Kpi
          icon={<Coins className="h-5 w-5" />}
          tone="bg-accent-50 text-accent-700"
          label="Hoa hồng tạm tính tháng này"
          value={formatVnd(tier.data?.estimatedCommissionVnd ?? '0')}
          hint="Tự động cập nhật khi bạn lên bậc trong tháng"
        />
        <Kpi
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-700"
          label="Số dư ví đã chốt"
          value={formatVnd(partner.walletBalanceVnd)}
          hint={`Chờ chi ngày ${payoutDay} hàng tháng`}
        />
        <Kpi
          icon={<ScrollText className="h-5 w-5" />}
          tone="bg-[#e7eef8] text-brand-700"
          label="MST đang bảo vệ"
          value={`${claims.filter((c) => c.status !== 'EXPIRED').length}/30`}
          hint="Mã số thuế đang giữ quyền hoa hồng"
        />
      </div>

      {/* 2 cột: link nhanh + hoạt động gần đây */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Link2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#0F2440]">Lấy link giới thiệu nhanh</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Gửi link này cho khách hàng B2B. Cookie giữ 14 ngày, lần bấm sau thay mã và tính
                lại 14 ngày.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={partner.referralUrl}
              aria-label="Link giới thiệu"
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 whitespace-nowrap"
              onClick={() => void copyLink(partner.referralUrl)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Đã chép' : 'Chép link'}
            </Button>
          </div>
          <Link
            href="/ctv/links"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            Xem thêm link & tài liệu bán hàng
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#0F2440]">Hoạt động & đơn hoa hồng gần đây</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {entries.length} đơn đã ghi hoa hồng. Chỉ đơn đã thanh toán mới tính.
              </p>
            </div>
          </div>
          {entries.length === 0 ? (
            <div className="px-5 py-6">
              <p className="text-sm font-semibold text-slate-700">Bắt đầu với 3 bước</p>
              <ol className="mt-3 space-y-2.5">
                {[
                  'Chép link giới thiệu của bạn và gửi cho khách hàng B2B.',
                  'Khách đăng ký qua link — cookie giữ 14 ngày.',
                  'Khách thanh toán gói có giá — hoa hồng tự cộng vào ví.',
                ].map((step, index) => (
                  <li key={step} className="flex items-start gap-2.5 text-sm leading-snug text-slate-600">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <Link
                href="/ctv/tax-locks"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Khóa MST khách hàng
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.slice(0, 6).map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {entry.companyName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {entry.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}
                      {entry.planName ? ` · ${entry.planName}` : ''} · {entry.percent}%
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#0F2440]">
                    {formatVnd(entry.commissionVnd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Khóa MST nhanh */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ScrollText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#0F2440]">Khóa Mã số thuế khách hàng</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Mỗi CTV tối đa 30 mã đang hiệu lực. Mã giữ 30 ngày, hết hạn tự nhả.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => setClaimOpen((value) => !value)}
          >
            {claimOpen ? 'Đóng' : 'Khóa mã số thuế'}
          </Button>
        </div>

        {claimOpen ? (
          <PartnerClaimForm onDone={() => void qc.invalidateQueries({ queryKey: ['recruiter-partner'] })} />
        ) : null}

        {claims.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 text-sm text-slate-700">
            {claims.slice(0, 8).map((claim) => (
              <li key={claim.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium text-slate-900">{claim.companyName}</span>
                <span className="font-mono text-xs text-slate-500">MST {claim.taxCode}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Chưa khóa mã số thuế nào.</p>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium leading-snug text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#0F2440]">{value}</p>
      <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>
    </div>
  );
}

/**
 * Thẻ cấp bậc tháng này + thanh tiến độ lên hạng.
 * Bậc đạt được áp dụng cho TOÀN BỘ doanh thu hợp lệ trong tháng.
 */
function TierProgressCard({
  tier,
  loading,
}: {
  tier: CtvMonthlyTierView | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải cấp bậc tháng này…
        </p>
      </section>
    );
  }

  if (!tier || tier.achievedTierCode == null) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#0F2440]">Cấp bậc tháng này</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Chưa có doanh số gói trong tháng này. Bạn bắt đầu ở cấp Cơ bản và tự động lên bậc khi đạt
          ngưỡng doanh số.
        </p>
      </section>
    );
  }

  const revenue = Number(tier.totalEligibleRevenueVnd);
  const threshold = tier.nextTierThresholdVnd == null ? null : Number(tier.nextTierThresholdVnd);
  const missing = Number(tier.revenueToNextTierVnd);
  // % tiến độ trong bậc hiện tại: doanh số / ngưỡng bậc kế tiếp.
  const progress = threshold && threshold > 0 ? Math.min(100, (revenue / threshold) * 100) : 100;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#0F2440]">Cấp bậc tháng này</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Doanh số gói thực thu tháng {formatMonth(tier.yearMonth)} — chưa gồm VAT.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tracking-tight text-[#0F2440]">
            {tier.achievedTierName}
            <span className="ml-1.5 text-xl text-[#4c3ec9]">
              {tier.appliedRatePercent ?? 0}%
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tổng doanh số {formatVnd(tier.totalEligibleRevenueVnd)}
          </p>
        </div>
      </div>

      {/* Thanh tiến độ lên hạng */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{tier.achievedTierName}</span>
          <span>
            {tier.nextTierCode
              ? `${tier.nextTierName} (${tier.nextTierRatePercent}%)`
              : 'Bậc cao nhất'}
          </span>
        </div>
        <div
          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4c3ec9] to-[#7a6af2] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {tier.nextTierCode && missing > 0 ? (
            <>
              Còn thiếu{' '}
              <strong className="font-semibold text-[#4c3ec9]">
                {formatVnd(String(missing))}
              </strong>{' '}
              doanh số gói để lên cấp {tier.nextTierName} ({tier.nextTierRatePercent}%) cho toàn bộ
              đơn tháng này.
            </>
          ) : (
            <>
              Bạn đã đạt cấp cao nhất. Tỷ lệ{' '}
              <strong className="font-semibold text-[#4c3ec9]">{tier.appliedRatePercent}%</strong> áp
              dụng cho toàn bộ doanh thu tháng này.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

/** Định dạng tháng YYYY-MM sang MM/YYYY. */
function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${month}/${year}`;
}

function PartnerRegisterForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [accepted, setAccepted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const register = useMutation({
    mutationFn: () => registerMyPartner({ acceptTerms: true }),
    onSuccess: () => {
      setError(null);
      onDone();
      void qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => setError(errorText(err, 'Không kích hoạt được cộng tác viên')),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!accepted) return;
        register.mutate();
      }}
      className="mt-4 space-y-3"
    >
      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#E8872A]"
        />
        <span>
          Tôi đồng ý với{' '}
          <a
            href="/ctv/policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#0B468C] hover:underline"
          >
            Điều khoản chương trình Cộng tác viên inLink
          </a>
          . Thông tin nhận chi trả sẽ bổ sung riêng trong mục Hồ sơ &amp; KYC.
        </span>
      </label>
      <div>
        <Button type="submit" disabled={!accepted || register.isPending}>
          {register.isPending ? 'Đang kích hoạt…' : 'Kích hoạt mã Cộng tác viên ngay'}
        </Button>
      </div>
      {error ? <p className="w-full text-sm text-rose-600">{error}</p> : null}
    </form>
  );
}

function PartnerClaimForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => createMyPartnerClaim({ companyName, taxCode, contactPhone: phone }),
    onSuccess: () => {
      setCompanyName('');
      setTaxCode('');
      setPhone('');
      setError(null);
      onDone();
      void qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => setError(errorText(err, 'Không khóa được mã số thuế')),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate();
      }}
      className="mt-4 grid gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3 sm:grid-cols-4"
    >
      <Input
        placeholder="Tên công ty"
        value={companyName}
        maxLength={160}
        onChange={(event) => setCompanyName(event.target.value)}
        required
      />
      <Input
        placeholder="Mã số thuế"
        value={taxCode}
        onChange={(event) => setTaxCode(event.target.value)}
        required
      />
      <Input
        placeholder="Số điện thoại"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        required
      />
      <Button type="submit" disabled={add.isPending}>
        {add.isPending ? 'Đang khóa…' : 'Khóa mã số thuế'}
      </Button>
      {error ? <p className="text-sm text-rose-600 sm:col-span-4">{error}</p> : null}
    </form>
  );
}

function sumVnd(rows: Array<{ commissionVnd: string }>): string {
  return rows.reduce((sum, row) => sum + BigInt(row.commissionVnd || '0'), 0n).toString();
}

function inThisMonth(iso: string): boolean {
  const stamp = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(iso));
  const now = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  return stamp === now;
}
