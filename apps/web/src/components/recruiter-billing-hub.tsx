'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Coins,
  CreditCard,
  History,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';
import type { BillingPlatformPlanView } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { ApiError } from '@/lib/api';
import { fetchRecruiterEntitlements } from '@/lib/recruiter-billing';

function fmtDate(iso: string | null) {
  if (!iso) return 'Không giới hạn';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(iso));
}

function fmtCredit(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function RecruiterBillingHub() {
  const searchParams = useSearchParams();
  const requestedCode = searchParams.get('plan');

  const { data: entitlements, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['recruiter-billing-entitlements'],
    queryFn: fetchRecruiterEntitlements,
    retry: 1,
  });
  const { data: pub } = useQuery({
    queryKey: ['public-billing-config'],
    queryFn: fetchPublicBillingConfig,
    staleTime: 60_000,
  });

  const plan = entitlements?.plan ?? null;
  const planName = plan?.planName ?? entitlements?.planName ?? null;
  const credits = entitlements?.credits;
  const sourcing = entitlements?.sourcing ?? null;
  const requested = pub?.platformPlans.find((p) => p.code === requestedCode) ?? null;
  const requestedSourcing = requested
    ? null
    : (pub?.sourcingPlans.find((p) => p.code === requestedCode) ?? null);

  return (
    <RecruiterShell>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-800">Gói & Credit</h1>
            <p className="mt-1 text-sm text-slate-500">
              Xem gói đang dùng, số dư Credit và nạp thêm khi cần.
            </p>
          </div>
        </div>

        {requested ? (
          <RequestedPlanBanner plan={requested} isCurrent={plan?.planCode === requested.code} />
        ) : requestedSourcing ? (
          <RequestedSourcingBanner
            planName={requestedSourcing.name}
            planCode={requestedSourcing.code}
            isCurrent={sourcing?.planCode === requestedSourcing.code && Boolean(sourcing.assignment?.isActive)}
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Briefcase className="h-4 w-4" />
                </span>
                <p className="text-sm font-bold text-brand-800">Gói nền tảng</p>
              </div>
              {plan ? (
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    plan.isActive
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {plan.isActive ? 'Đang hoạt động' : 'Đã tắt'}
                </span>
              ) : null}
            </div>
            {isLoading ? (
              <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" />
            ) : isError ? (
              <>
                <p className="mt-3 text-lg font-semibold text-slate-800">Không tải được gói</p>
                <p className="mt-1 text-sm text-slate-500">
                  {error instanceof ApiError
                    ? error.message
                    : 'Tải lại trang hoặc bấm thử lại. Nếu đã có công ty, hệ thống sẽ gán gói Khám phá.'}
                </p>
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-accent-700 hover:underline"
                  onClick={() => void refetch()}
                >
                  Thử lại
                </button>
              </>
            ) : planName ? (
              <>
                <p className="mt-3 text-2xl font-bold text-brand-800">{planName}</p>
                {plan ? (
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {plan.planCode === 'KHAM_PHA'
                      ? `Dùng thử ${fmtDate(plan.startsAt)} → ${fmtDate(plan.endsAt)}. Hết hạn gói mở lại sau 30 ngày (Credit Top-up được bảo lưu vô thời hạn).`
                      : plan.planCode === 'ENTERPRISE'
                        ? `Theo hợp đồng${plan.endsAt ? ` · đến ${fmtDate(plan.endsAt)}` : ''}`
                        : `Hạn gói đến ${fmtDate(plan.endsAt)}. Hết hạn chuyển về Khám phá (chỉ hết hạn Credit tặng kèm gói, Credit Top-up được bảo lưu vô thời hạn).`}
                    {!plan.isActive ? ' · đã tắt' : ''}
                  </p>
                ) : null}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Metric
                    label="Tin hiển thị"
                    value={
                      entitlements?.jobDisplayDays != null
                        ? `${entitlements.jobDisplayDays} ngày`
                        : 'Không giới hạn'
                    }
                  />
                  <Metric
                    label="Đăng tin (JD)"
                    value={
                      entitlements?.jobPostQuota == null
                        ? 'Không giới hạn'
                        : `${entitlements.jobsUsed}/${entitlements.jobPostQuota}`
                    }
                    hint={
                      entitlements?.jobsRemaining != null
                        ? `còn ${entitlements.jobsRemaining}`
                        : undefined
                    }
                  />
                  <Metric
                    label="Credit tặng kèm"
                    value={
                      entitlements?.creditQuota == null
                        ? 'Theo HĐ'
                        : `${fmtCredit(entitlements.creditQuota)} Credit`
                    }
                    hint={entitlements?.creditQuota ? 'Đã cộng vào ví' : 'Gói miễn phí'}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-lg font-semibold text-slate-800">Đang gán gói Khám phá</p>
                <p className="mt-1 text-sm text-slate-500">
                  Tài khoản NTD mới mặc định nhận gói Khám phá. Tải lại trang nếu chưa thấy.
                </p>
              </>
            )}
            <Link
              href="/recruiter/pricing"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
            >
              Xem bảng giá <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <section className="brand-hero-surface flex flex-col justify-between rounded-2xl p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                    Số dư Ví Credit
                  </p>
                  <p className="mt-2 text-5xl font-bold tracking-tight text-[#E8872A]">
                    {isLoading ? '—' : fmtCredit(credits?.balance ?? 0)}
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    Gói nền tảng tặng {fmtCredit(entitlements?.creditQuota ?? 0)} · đã cấp{' '}
                    {fmtCredit(credits?.lifetimeGranted ?? 0)} · đã dùng{' '}
                    {fmtCredit(credits?.lifetimeConsumed ?? 0)}
                  </p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-500 text-white">
                  <Coins className="h-6 w-6" />
                </span>
              </div>

              {sourcing?.planName && sourcing.creditQuota != null ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/90">
                  <span>
                    Credit đi kèm <strong>{sourcing.planName}</strong> (ưu tiên trừ trước ví lẻ):
                  </span>
                  <span className="font-bold text-amber-300">
                    còn {fmtCredit(sourcing.profileOpensRemaining ?? 0)}/
                    {fmtCredit(sourcing.creditQuota)} Credit
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/recruiter/billing/topup"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-brand-800 transition hover:bg-accent-50"
              >
                Nạp Credit <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/recruiter/billing/credits"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3.5 text-xs font-semibold text-white/90 transition hover:bg-white/10"
              >
                Lịch sử cộng / trừ
              </Link>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                <Target className="h-4 w-4" />
              </span>
              <p className="text-sm font-bold text-brand-800">Gói Săn nhân sự</p>
            </div>
            {sourcing?.planName ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                  Quét tự động 2h/lần (08:00 – 18:00)
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  Đã lưu Shortlist: {sourcing.shortlistsUsed} ứng viên
                </span>
              </div>
            ) : null}
          </div>
          {sourcing?.planName ? (
            <>
              <p className="mt-3 text-xl font-bold text-brand-800">{sourcing.planName}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Metric
                  label="Vị trí săn"
                  value={
                    sourcing.positionQuota == null
                      ? 'Không giới hạn'
                      : `${sourcing.positionsUsed}/${sourcing.positionQuota}`
                  }
                  hint={
                    sourcing.positionsRemaining != null
                      ? `còn ${sourcing.positionsRemaining} vị trí`
                      : undefined
                  }
                />
                <Metric
                  label="Credit gói Săn"
                  value={
                    sourcing.creditQuota == null
                      ? 'Không giới hạn'
                      : `${sourcing.profileOpensUsed}/${sourcing.creditQuota}`
                  }
                  hint={
                    sourcing.profileOpensRemaining != null
                      ? `còn ${sourcing.profileOpensRemaining} Credit`
                      : '1–2 Credit / hồ sơ'
                  }
                />
                <Metric
                  label="Lượt điều chỉnh"
                  value={
                    sourcing.revisionQuota == null
                      ? 'Không giới hạn'
                      : `${sourcing.revisionsUsed}/${sourcing.revisionQuota}`
                  }
                  hint={
                    sourcing.revisionsRemaining != null
                      ? `còn ${sourcing.revisionsRemaining} lượt sửa JD/tiêu chí`
                      : undefined
                  }
                />
                <Metric
                  label="Bàn giao Inlink"
                  value={
                    sourcing.outreachQuota != null && sourcing.outreachQuota > 0
                      ? `${sourcing.outreachUsed}/${sourcing.outreachQuota}`
                      : 'Tự liên hệ'
                  }
                  hint={
                    sourcing.outreachQuota != null && sourcing.outreachQuota > 0
                      ? `còn ${sourcing.outreachRemaining ?? 0} lượt CSKH hỗ trợ`
                      : 'Mở hồ sơ & liên hệ trực tiếp'
                  }
                />
                <Metric
                  label="Báo cáo tiến độ"
                  value={
                    sourcing.searchRoundQuota == null
                      ? 'Không giới hạn'
                      : `${sourcing.searchRoundsUsed}/${sourcing.searchRoundQuota}`
                  }
                  hint={
                    sourcing.searchRoundsRemaining != null
                      ? `còn ${sourcing.searchRoundsRemaining} lượt xuất báo cáo`
                      : undefined
                  }
                />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Hạn đến {fmtDate(sourcing.assignment?.endsAt ?? null)}. Không gia hạn thì gói Săn tắt khi hết hạn.
              </p>
              <Link
                href="/recruiter/sourcing"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
              >
                Dùng hạn mức Săn <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-lg font-semibold text-slate-800">Chưa kích hoạt gói Săn nhân sự</p>
              <p className="mt-1 text-sm text-slate-500">
                Hệ thống AI chủ động quét ứng viên tự động 2 giờ/lần (08:00 – 18:00), tặng kèm Credit mở hồ sơ và hỗ trợ bàn giao liên hệ ứng viên.
              </p>
              <Link
                href="/recruiter/pricing#sannhansu"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
              >
                Xem gói Săn <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <HubLink
            href="/recruiter/billing/topup"
            icon={CreditCard}
            title="Nạp Credit"
            desc="Mua thêm lượt mở hồ sơ"
          />
          <HubLink
            href="/recruiter/billing/credits"
            icon={Coins}
            title="Lịch sử Credit"
            desc="Xem cộng / trừ theo từng thao tác"
          />
          <HubLink
            href="/recruiter/billing/orders"
            icon={History}
            title="Đơn hàng"
            desc="Top-up và trạng thái thanh toán"
          />
        </div>
      </div>
    </RecruiterShell>
  );
}

function RequestedPlanBanner({
  plan,
  isCurrent,
}: {
  plan: BillingPlatformPlanView;
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
      {isCurrent ? (
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
      )}
      <div>
        <p className="font-semibold">
          {isCurrent ? `Bạn đang dùng gói ${plan.name}` : `Bạn chọn gói ${plan.name}`}
        </p>
        <p className="mt-1 text-xs opacity-80">
          {isCurrent
            ? 'Bạn đang dùng gói này. Credit tặng đã được cộng khi kích hoạt.'
            : 'Xác nhận thanh toán để chuyển sang gói này. Số ngày SuperAdmin là hạn hiển thị tin.'}
        </p>
        {!isCurrent ? (
          <Link
            href={`/recruiter/billing/upgrade?plan=${encodeURIComponent(plan.code)}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-800 hover:underline"
          >
            Đi tới thanh toán <ArrowRight className="h-3 w-3" />
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

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-brand-800">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function HubLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-accent-200 hover:bg-accent-50/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-brand-800">{title}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-accent-600" />
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>
      </span>
    </Link>
  );
}
