'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  Shield,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { BillingSourcingPlanView } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { formatPriceVnd } from '@/lib/format-billing';
import { createSourcingCheckout, fetchRecruiterEntitlements } from '@/lib/recruiter-billing';

function fmtQuota(n: number | null) {
  return n == null ? 'Không giới hạn' : String(n);
}

export function RecruiterSourcingActivate() {
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

  const plan = pub?.sourcingPlans.find((p) => p.code === planCode && p.isActive) ?? null;
  const current = entitlements?.sourcing ?? null;
  const isCurrent = Boolean(plan && current?.planCode === plan.code && current.assignment?.isActive);
  const currency = pub?.currency;

  const activate = useMutation({
    mutationFn: () => createSourcingCheckout(planCode),
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
          <h1 className="cms-page-title mt-2">Thanh toán gói Săn</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Phí dịch vụ Săn không gồm Credit. Hạn mức vị trí / đợt tìm / shortlist lấy đúng số SuperAdmin.
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
            Không tìm thấy gói Săn{planCode ? ` “${planCode}”` : ''}. Chọn lại từ bảng giá.
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
                Gói Săn bạn chọn
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[#072348]">{plan.name}</h2>
              {plan.description ? (
                <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
              ) : null}
              <p className="mt-4 text-3xl font-bold text-[#072348]">
                {currency ? formatPriceVnd(plan.feeVnd, currency) : plan.feeVnd}
              </p>
              <p className="mt-1 text-xs text-slate-500">Phí dịch vụ — không tặng Credit</p>

              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  Vị trí: <strong>{fmtQuota(plan.positionQuota)}</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  Đợt tìm: <strong>{fmtQuota(plan.searchRoundQuota)}</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  Shortlist: <strong>{fmtQuota(plan.shortlistQuota)}</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  Điều chỉnh: <strong>{fmtQuota(plan.revisionQuota)}</strong>
                </li>
              </ul>

              {isCurrent ? (
                <p className="mt-6 text-sm text-emerald-800">Bạn đang dùng gói này.</p>
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
                  Thanh toán gói Săn
                </Button>
              )}
            </Card>

            <CurrentSourcingCard currentName={current?.planName ?? null} requested={plan} />
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}

function CurrentSourcingCard({
  currentName,
  requested,
}: {
  currentName: string | null;
  requested: BillingSourcingPlanView;
}) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Gói Săn hiện tại
      </p>
      {currentName ? (
        <>
          <p className="mt-2 text-xl font-bold text-[#072348]">{currentName}</p>
          {currentName !== requested.name ? (
            <p className="mt-4 flex items-start gap-2 text-xs text-slate-600">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
              Sau khi thanh toán, hạn mức sẽ lấy từ <strong>{requested.name}</strong> và đếm lại từ đầu.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
          <Shield className="mt-0.5 h-4 w-4 shrink-0" />
          Chưa gán gói Săn. Kích hoạt để dùng hạn mức SuperAdmin.
        </p>
      )}
    </Card>
  );
}
