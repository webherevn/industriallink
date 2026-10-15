'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  CreditCard,
  ExternalLink,
  History,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BillingCreditTopupView, BillingOrderView, PaymentMode } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { formatPriceVnd } from '@/lib/format-billing';
import { createTopupCheckout, fetchRecruiterCreditBalance, fetchRecruiterCreditSummary } from '@/lib/recruiter-billing';

export function RecruiterTopup() {
  const qc = useQueryClient();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const { data: pub, isLoading: pubLoading } = useQuery({
    queryKey: ['public-billing-config'],
    queryFn: fetchPublicBillingConfig,
  });
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['recruiter-credit-summary'],
    queryFn: fetchRecruiterCreditSummary,
  });
  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ['recruiter-credit-balance'],
    queryFn: fetchRecruiterCreditBalance,
  });
  const topups: BillingCreditTopupView[] = ((pub?.creditTopups ?? []) as BillingCreditTopupView[]).filter(
    (t) => t.isActive,
  );
  const currency = pub?.currency;
  const mode: PaymentMode = pub?.paymentMode ?? 'mock';

  const checkout = useMutation({
    mutationFn: (topupId: string) => createTopupCheckout(topupId),
    onSuccess: (resp) => {
      setBanner({ tone: 'ok', text: `Đã tạo đơn #${resp.orderId.slice(0, 8)} — chuyển đến cổng thanh toán…` });
      // Redirect sang Stripe (hoặc mock checkout page)
      window.location.href = resp.url;
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Tạo đơn thất bại' }),
  });

  const formatPrice = (n: number) => (currency ? formatPriceVnd(n, currency) : new Intl.NumberFormat('vi-VN').format(n));

  return (
    <RecruiterShell>
      <div className="recruiter-dash space-y-6">
        <div className="recruiter-dash-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            Billing · Nạp Credit
          </p>
          <h1 className="cms-page-title mt-1.5">Mua thêm Credit</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Chọn gói Top-up phù hợp và thanh toán qua Stripe. Credit được cộng vào tài khoản ngay khi thanh toán thành công.
          </p>
        </div>

        {/* Balance banner */}
        <BalanceBanner balance={balance} loading={balLoading} />

        {/* Mode banner */}
        <Card
          className={clsx(
            'flex items-center gap-3 p-3 text-xs',
            mode === 'live'
              ? 'border-amber-200 bg-amber-50/60 text-amber-900'
              : 'border-blue-200 bg-blue-50/60 text-blue-900',
          )}
        >
          {mode === 'live' ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          <span>
            {mode === 'live'
              ? 'Stripe Live — Thanh toán thật qua Stripe Checkout (sandbox dùng test card 4242 4242 4242 4242).'
              : 'Mock mode — Thanh toán giả lập trong app, không cần Stripe key. Bấm "Mua" sẽ hiện trang thanh toán nội bộ.'}
          </span>
        </Card>

        {/* Bước 8: enforcement banner */}
        {pub?.creditEnforcement === 'enforce' && (
          <Card className="flex items-start gap-3 border-red-200 bg-red-50/60 p-3 text-xs text-red-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">Đang ở chế độ Enforce — Credit bị trừ thật</p>
              <p className="mt-1 text-[11px]">
                Mỗi thao tác tốn credit (xem hồ sơ ứng viên, mở contact, mở lại JD) sẽ bị trừ vào số dư.
                Nếu hết credit, các thao tác sẽ bị chặn. Hãy nạp thêm để tiếp tục.
              </p>
            </div>
          </Card>
        )}

        {banner ? (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
              banner.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800',
            )}
          >
            {banner.tone === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {banner.text}
          </div>
        ) : null}

        {/* Topup list */}
        {pubLoading ? (
          <div className="recruiter-dash-skel h-64" />
        ) : topups.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">
            Hiện chưa có gói Top-up nào khả dụng. Liên hệ admin để được hỗ trợ.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topups.map((t) => (
              <TopupCard
                key={t.id}
                topup={t}
                selected={selectedId === t.id}
                onSelect={() => setSelectedId(t.id)}
                onBuy={() => checkout.mutate(t.id)}
                pending={checkout.isPending && selectedId === t.id}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={() => router.push('/recruiter/billing/orders')}>
            <History className="h-3.5 w-3.5" /> Xem lịch sử đơn
          </Button>
        </div>
      </div>
    </RecruiterShell>
  );
}

function BalanceBanner({
  balance,
  loading,
}: {
  balance: { balance: number; lifetimeGranted: number; lifetimeConsumed: number } | undefined;
  loading: boolean;
}) {
  if (loading) return <div className="recruiter-dash-skel h-24" />;
  if (!balance) return null;
  const low = balance.balance <= 0;
  return (
    <Card
      className={clsx(
        'flex items-center gap-4 p-4',
        low ? 'border-rose-200 bg-rose-50/40' : 'border-emerald-200 bg-emerald-50/40',
      )}
    >
      <div
        className={clsx(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          low ? 'bg-rose-200 text-rose-700' : 'bg-emerald-200 text-emerald-700',
        )}
      >
        <Coins className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Số dư Credit</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900">
          {balance.balance.toLocaleString('vi-VN')}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Đã dùng: {balance.lifetimeConsumed.toLocaleString('vi-VN')} / Đã nạp:{' '}
          {balance.lifetimeGranted.toLocaleString('vi-VN')}
        </p>
      </div>
      {low ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-3 w-3" /> Hết credit
        </div>
      ) : null}
    </Card>
  );
}

function TopupCard({
  topup,
  selected,
  onSelect,
  onBuy,
  pending,
  formatPrice,
}: {
  topup: BillingCreditTopupView;
  selected: boolean;
  onSelect: () => void;
  onBuy: () => void;
  pending: boolean;
  formatPrice: (n: number) => string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'relative cursor-pointer rounded-xl border border-slate-200 bg-white p-5 text-left transition',
        selected
          ? 'border-accent-500 ring-2 ring-accent-200'
          : 'hover:border-accent-300',
        topup.isFeatured ? 'bg-gradient-to-br from-accent-50 to-white' : '',
      )}
    >
      {topup.isFeatured ? (
        <span className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-accent-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
          <Sparkles className="h-3 w-3" /> Phổ biến
        </span>
      ) : null}
      {topup.badge ? (
        <span className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 shadow">
          {topup.badge}
        </span>
      ) : null}

      <h3 className="text-sm font-bold text-slate-900">{topup.name}</h3>
      {topup.badge ? <p className="mt-0.5 text-[11px] text-slate-500">{topup.badge}</p> : null}

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-slate-900">{topup.creditCount}</span>
        <span className="text-sm font-semibold text-slate-500">credit</span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">
        ≈ {formatPrice(Number(topup.unitPriceVnd))}/credit
      </p>

      <div className="mt-4 flex items-baseline gap-1.5 border-t border-slate-100 pt-3">
        <span className="text-xl font-bold text-accent-700">{formatPrice(Number(topup.priceVnd))}</span>
      </div>

      <Button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onBuy();
        }}
        disabled={pending}
        className="mt-4 w-full"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
        Mua ngay
        <ExternalLink className="h-3 w-3 opacity-50" />
      </Button>
    </button>
  );
}
