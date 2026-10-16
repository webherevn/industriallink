'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchRecruiterOrders, mockTopupFailure, mockTopupSuccess } from '@/lib/recruiter-billing';

/**
 * Trang thanh toán giả lập — chỉ hiển thị khi billing.payment_setting.mode = 'mock'.
 * Mô phỏng giao diện Stripe Checkout để test end-to-end flow:
 *   1. Recruiter bấm "Mua" → backend trả URL trang này
 *   2. User bấm "Thanh toán thành công" → backend cấp credit + audit log
 *   3. Redirect về /recruiter/billing/topup/success
 *   Hoặc "Thanh toán thất bại" → status=failed + redirect về /cancel
 */
export function RecruiterMockCheckout() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') ?? '';
  const orderId = searchParams.get('order') ?? '';
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [orderInfo, setOrderInfo] = useState<{
    kind: 'topup' | 'platform' | 'sourcing';
    planName: string | null;
    creditCount: number;
    priceVnd: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRecruiterOrders();
        const found = data.items.find((o) => o.id === orderId);
        if (found && !cancelled) {
          setOrderInfo({
            kind: found.kind,
            planName: found.planName,
            creditCount: found.creditCountSnapshot,
            priceVnd: found.priceVndSnapshot,
            status: found.status,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const success = useMutation({
    mutationFn: () => mockTopupSuccess(orderId),
    onSuccess: (paid) => {
      setBanner({ tone: 'ok', text: 'Thanh toán thành công! Đang chuyển hướng…' });
      qc.invalidateQueries({ queryKey: ['recruiter-credit-summary'] });
      qc.invalidateQueries({ queryKey: ['recruiter-credit-balance'] });
      qc.invalidateQueries({ queryKey: ['recruiter-orders'] });
      qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      qc.invalidateQueries({ queryKey: ['recruiter-sourcing'] });
      const next =
        paid.kind === 'sourcing'
          ? '/recruiter/sourcing'
          : paid.kind === 'platform'
            ? '/recruiter/billing'
            : `/recruiter/billing/topup/success?session=${sessionId}&order=${orderId}`;
      setTimeout(() => router.push(next), 800);
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Thanh toán thất bại' }),
  });

  const failure = useMutation({
    mutationFn: () => mockTopupFailure(orderId, 'User cancelled from mock checkout'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-orders'] });
      router.push(`/recruiter/billing/topup/cancel?order=${orderId}`);
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Cập nhật thất bại' }),
  });

  if (!orderId || !sessionId) {
    return (
      <RecruiterShell>
        <Card className="mx-auto max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-3 text-sm text-slate-700">Thiếu tham số order hoặc session.</p>
          <Link href="/recruiter/billing/topup" className="mt-4 inline-block text-xs text-accent-600 underline">
            ← Quay lại
          </Link>
        </Card>
      </RecruiterShell>
    );
  }

  return (
    <RecruiterShell>
      <div className="mx-auto max-w-md space-y-4">
        <Link
          href="/recruiter/billing/topup"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3 w-3" /> Quay lại
        </Link>

        <Card className="overflow-hidden p-0">
          {/* Header giả lập Stripe */}
          <div className="bg-gradient-to-br from-[#635bff] to-[#4f46e5] p-5 text-white">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <span className="text-sm font-semibold">Stripe Checkout (Mock)</span>
            </div>
            <p className="mt-1 text-[11px] opacity-80">Môi trường test — không giao dịch thật</p>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">
                  {orderInfo?.kind === 'topup' || !orderInfo ? 'Số credit' : 'Gói'}
                </span>
                <span className="text-right font-bold text-slate-900">
                  {!orderInfo
                    ? '…'
                    : orderInfo.kind === 'topup'
                      ? `${orderInfo.creditCount.toLocaleString('vi-VN')} credit`
                      : orderInfo.planName || 'Gói dịch vụ'}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-slate-500">Tổng</span>
                <span className="text-base font-bold text-accent-700">
                  {orderInfo ? formatVnd(orderInfo.priceVnd) : '…'}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Session</span>
                <span className="font-mono">{sessionId.slice(0, 24)}…</span>
              </div>
              {orderInfo?.status && orderInfo.status !== 'pending' ? (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  Order đang ở trạng thái: <strong>{orderInfo.status}</strong>. Không thể thanh toán lại.
                </div>
              ) : null}
            </div>

            {/* Card form giả */}
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Thông tin thẻ (giả lập)</p>
              <input
                type="text"
                readOnly
                value="4242 4242 4242 4242"
                className="w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  readOnly
                  value="12 / 34"
                  className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs"
                />
                <input
                  type="text"
                  readOnly
                  value="CVC 123"
                  className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs"
                />
              </div>
            </div>

            {banner ? (
              <div
                className={
                  banner.tone === 'ok'
                    ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800'
                    : 'rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800'
                }
              >
                {banner.text}
              </div>
            ) : null}

            {/* Actions */}
            <div className="space-y-2">
              <Button
                type="button"
                onClick={() => success.mutate()}
                disabled={success.isPending || failure.isPending || (orderInfo?.status !== 'pending' && !!orderInfo)}
                className="w-full"
              >
                {success.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Thanh toán thành công (giả lập)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => failure.mutate()}
                disabled={success.isPending || failure.isPending}
                className="w-full"
              >
                {failure.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Thanh toán thất bại
              </Button>
            </div>

            <p className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
              <ShieldCheck className="h-3 w-3" /> Mock checkout — không charge thẻ thật
            </p>
          </div>
        </Card>
      </div>
    </RecruiterShell>
  );
}

function formatVnd(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}
