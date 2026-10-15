'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Banknote,
  Coins,
  CreditCard,
  History,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';
import type { BillingPlatformPlanView } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Card } from '@/components/ui';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
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

  const { data: entitlements, isLoading } = useQuery({
    queryKey: ['recruiter-billing-entitlements'],
    queryFn: fetchRecruiterEntitlements,
  });
  const { data: pub } = useQuery({
    queryKey: ['public-billing-config'],
    queryFn: fetchPublicBillingConfig,
    staleTime: 60_000,
  });

  const plan = entitlements?.plan ?? null;
  const credits = entitlements?.credits;
  const requested = pub?.platformPlans.find((p) => p.code === requestedCode) ?? null;

  return (
    <RecruiterShell>
      <div className="recruiter-dash space-y-6">
        <div className="recruiter-dash-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            Billing
          </p>
          <h1 className="cms-page-title mt-1.5">Gói & Credit</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Xem gói đang dùng, số dư Credit và nạp thêm khi cần.
          </p>
        </div>

        {requested ? (
          <RequestedPlanBanner plan={requested} isCurrent={plan?.planCode === requested.code} />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Gói nền tảng
            </p>
            {isLoading ? (
              <div className="recruiter-dash-skel mt-3 h-16" />
            ) : plan ? (
              <>
                <p className="mt-2 text-2xl font-bold text-[#072348]">{plan.planName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Chu kỳ gói {fmtDate(plan.startsAt)} → {fmtDate(plan.endsAt)}
                  {!plan.isActive ? ' · đã tắt' : ''}
                </p>
                {entitlements?.jobDisplayDays != null ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Tin đăng hiển thị <strong>{entitlements.jobDisplayDays} ngày</strong>
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-slate-600">
                  Đăng tin:{' '}
                  <strong>
                    {entitlements?.jobPostQuota == null
                      ? 'Không giới hạn'
                      : `${entitlements.jobsUsed}/${entitlements.jobPostQuota} lượt`}
                  </strong>
                  {entitlements?.jobsRemaining != null ? (
                    <span className="text-slate-500"> · còn {entitlements.jobsRemaining}</span>
                  ) : null}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-semibold text-slate-800">Đang gán gói Khám phá</p>
                <p className="mt-1 text-sm text-slate-500">
                  Tài khoản NTD mới mặc định nhận gói Khám phá. Tải lại trang nếu chưa thấy.
                </p>
              </>
            )}
            <Link
              href="/bang-gia"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
            >
              Xem bảng giá <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card className="bg-gradient-to-br from-[#072348] to-[#1a4a7a] p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Số dư Credit
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight">
              {isLoading ? '—' : fmtCredit(credits?.balance ?? 0)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {entitlements?.creditQuota != null
                ? `Gói tặng ${fmtCredit(entitlements.creditQuota)} · `
                : ''}
              đã cấp {fmtCredit(credits?.lifetimeGranted ?? 0)} · đã dùng{' '}
              {fmtCredit(credits?.lifetimeConsumed ?? 0)}
            </p>
          </Card>
        </div>

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
    <Card
      className={clsx(
        'flex items-start gap-3 p-4 text-sm',
        isCurrent
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
          : 'border-amber-200 bg-amber-50/70 text-amber-950',
      )}
    >
      {isCurrent ? (
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
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
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
          >
            Đi tới thanh toán <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </Card>
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
      className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
    >
      <Icon className="h-5 w-5 text-accent-600" />
      <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </Link>
  );
}
