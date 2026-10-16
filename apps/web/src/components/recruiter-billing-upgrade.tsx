'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Loader2,
  Package,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { BillingPlatformPlanView } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { formatPriceVnd } from '@/lib/format-billing';
import { createPlanCheckout, fetchRecruiterEntitlements } from '@/lib/recruiter-billing';

function fmtDate(iso: string | null) {
  if (!iso) return 'Không giới hạn';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(iso));
}

export function RecruiterPlanUpgrade() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const planCode = searchParams.get('plan') ?? '';
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const { data: pub, isLoading: pubLoading } = useQuery({
    queryKey: ['public-billing-config'],
    queryFn: fetchPublicBillingConfig,
    staleTime: 60_000,
  });
  const { data: entitlements, isLoading: entLoading } = useQuery({
    queryKey: ['recruiter-billing-entitlements'],
    queryFn: fetchRecruiterEntitlements,
  });

  const plan = pub?.platformPlans.find((p) => p.code === planCode && p.isActive) ?? null;
  const current = entitlements?.plan ?? null;
  const isCurrent = Boolean(plan && current?.planCode === plan.code && current.isActive);
  const isEnterprise = plan?.code === 'ENTERPRISE';
  const isFree = plan?.code === 'KHAM_PHA';
  const currency = pub?.currency;

  const activate = useMutation({
    mutationFn: () => createPlanCheckout(planCode),
    onSuccess: (checkout) => {
      void qc.invalidateQueries({ queryKey: ['recruiter-orders'] });
      window.location.href = checkout.url;
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Không tạo được đơn thanh toán' }),
  });

  return (
    <RecruiterShell>
      <div className="recruiter-dash space-y-6">
        <div className="recruiter-dash-rise">
          <Link
            href="/recruiter/billing"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Gói & Credit
          </Link>
          <h1 className="cms-page-title mt-2">Thanh toán gói</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Tạo đơn thanh toán. Gói được gán sau khi thanh toán thành công. Số ngày trên bảng giá là hạn hiển thị tin đăng.
          </p>
        </div>

        {banner ? (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
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

        {pubLoading || entLoading ? (
          <div className="recruiter-dash-skel h-56" />
        ) : !plan ? (
          <Card className="p-8 text-center text-sm text-slate-500">
            Không tìm thấy gói{planCode ? ` “${planCode}”` : ''}. Chọn lại từ bảng giá.
            <div className="mt-4">
              <Link href="/recruiter/pricing" className="font-semibold text-accent-700 hover:underline">
                Xem bảng giá
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Gói bạn chọn
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[#072348]">{plan.name}</h2>
              {plan.description ? (
                <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
              ) : null}

              <p className="mt-4 text-3xl font-bold text-[#072348]">
                {isEnterprise
                  ? 'Báo giá'
                  : currency
                    ? formatPriceVnd(plan.priceVnd, currency)
                    : plan.priceVnd}
              </p>

              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Tin hiển thị:{' '}
                  <strong>
                    {plan.durationDays != null ? `${plan.durationDays} ngày` : 'Theo hợp đồng'}
                  </strong>
                </li>
                {plan.code === 'KHAM_PHA' ? (
                  <li className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    Chu kỳ gói: <strong>30 ngày</strong> (tạo JD mới khi hết chu kỳ)
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  Đăng tin:{' '}
                  <strong>{plan.jobPostQuota == null ? 'Không giới hạn' : `${plan.jobPostQuota} JD`}</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-slate-400" />
                  Credit tặng:{' '}
                  <strong>{plan.creditQuota ?? 0}</strong>
                </li>
              </ul>

              {isEnterprise ? (
                <p className="mt-6 text-sm text-slate-600">
                  Gói Enterprise không tự thanh toán. Liên hệ sales để được tư vấn và SuperAdmin kích hoạt.
                </p>
              ) : isCurrent ? (
                <p className="mt-6 text-sm text-emerald-800">
                  Bạn đang dùng gói này đến {fmtDate(current?.endsAt ?? null)}.
                </p>
              ) : (
                <Button
                  className="mt-6 w-full"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate()}
                >
                  {activate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {isFree ? 'Kích hoạt gói Khám phá' : 'Thanh toán gói'}
                </Button>
              )}
            </Card>

            <CurrentPlanCard plan={current} requested={plan} />
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}

function CurrentPlanCard({
  plan,
  requested,
}: {
  plan: { planName: string; planCode: string; startsAt: string; endsAt: string | null; isActive: boolean } | null;
  requested: BillingPlatformPlanView;
}) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Gói hiện tại
      </p>
      {plan ? (
        <>
          <p className="mt-2 text-xl font-bold text-[#072348]">{plan.planName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {fmtDate(plan.startsAt)} → {fmtDate(plan.endsAt)}
            {!plan.isActive ? ' · đã tắt' : ''}
          </p>
          {plan.planCode !== requested.code ? (
            <p className="mt-4 flex items-start gap-2 text-xs text-slate-600">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
              Sau khi thanh toán, gói hiển thị sẽ là <strong>{requested.name}</strong>
              {requested.code === 'KHAM_PHA'
                ? ', chu kỳ 30 ngày'
                : requested.durationDays != null
                  ? `, hạn gói ${requested.durationDays} ngày`
                  : ''}
              {requested.durationDays != null
                ? `, tin hiển thị ${requested.durationDays} ngày`
                : ''}
              .
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Đang gán gói Khám phá mặc định…</p>
      )}
    </Card>
  );
}
