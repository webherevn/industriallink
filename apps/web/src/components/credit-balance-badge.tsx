'use client';

import { useQuery } from '@tanstack/react-query';
import { Coins, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { fetchRecruiterCreditBalance } from '@/lib/recruiter-billing';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { formatCreditBalance } from '@/lib/format-billing';

const BALANCE_QUERY_KEY = ['recruiter', 'credit', 'balance'] as const;
const PUBLIC_CONFIG_QUERY_KEY = ['billing', 'public-config'] as const;

interface CreditBalanceBadgeProps {
  /**
   * Ngưỡng credit thấp để hiển thị cảnh báo.
   * @default 10
   */
  lowThreshold?: number;
}

/**
 * Badge credit balance ở header, click để mở menu nhanh.
 * - Bình thường: hiển thị balance + icon Coins
 * - Dưới ngưỡng: thêm icon AlertTriangle + tooltip nhắc mua thêm
 */
export function CreditBalanceBadge({ lowThreshold = 10 }: CreditBalanceBadgeProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: balance, isLoading } = useQuery({
    queryKey: BALANCE_QUERY_KEY,
    queryFn: fetchRecruiterCreditBalance,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: publicConfig } = useQuery({
    queryKey: PUBLIC_CONFIG_QUERY_KEY,
    queryFn: fetchPublicBillingConfig,
    staleTime: 5 * 60_000,
  });

  // Hiển thị enforcement status
  const isEnforced = publicConfig?.creditEnforcement === 'enforce';
  const isLow =
    !isLoading && balance != null && balance.balance > 0 && balance.balance <= lowThreshold;
  const isOut =
    !isLoading && balance != null && balance.balance <= 0;

  // Nếu enforcement=log, không cần warn user
  if (!isEnforced) {
    return (
      <Link
        href="/recruiter/billing/topup"
        className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/50 sm:inline-flex"
        title="Mua thêm credit"
      >
        <Coins className="h-3.5 w-3.5 text-amber-500" />
        <span className="tabular-nums">
          {isLoading ? '—' : formatCreditBalance(balance?.balance ?? 0)}
        </span>
      </Link>
    );
  }

  // Enforce mode → cảnh báo khi thấp/hết
  const alertLevel = isOut ? 'out' : isLow ? 'low' : 'ok';
  const showAlert = (isLow || isOut) && !dismissed;

  return (
    <div className="relative hidden items-center sm:flex">
      <Link
        href="/recruiter/billing/topup"
        className={
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ' +
          (alertLevel === 'out'
            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
            : alertLevel === 'low'
              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50')
        }
        title={
          alertLevel === 'out'
            ? 'Hết credit — Mua thêm để tiếp tục'
            : alertLevel === 'low'
              ? `Còn ${balance?.balance ?? 0} credit — Sắp hết`
              : 'Credit balance'
        }
      >
        {alertLevel === 'ok' ? (
          <Coins className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <AlertTriangle
            className={
              'h-3.5 w-3.5 ' +
              (alertLevel === 'out' ? 'text-red-600' : 'text-amber-600')
            }
          />
        )}
        <span className="tabular-nums">
          {isLoading ? '—' : formatCreditBalance(balance?.balance ?? 0)}
        </span>
        <Sparkles className="ml-0.5 h-3 w-3 opacity-60" />
      </Link>

      {showAlert && balance && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-500 shadow ring-1 ring-slate-200 hover:bg-slate-100"
          title="Đóng cảnh báo"
        >
          ×
        </button>
      )}
    </div>
  );
}
