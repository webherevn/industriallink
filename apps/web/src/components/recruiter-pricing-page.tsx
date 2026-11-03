'use client';

import { Coins, Crown } from 'lucide-react';
import { PricingClient } from '@/components/pricing-client';
import { RecruiterShell } from '@/components/recruiter-shell';

/** Bảng giá trong app NTD — sidebar giữ nguyên, không dùng trang public /bang-gia. */
export function RecruiterPricingPage() {
  return (
    <RecruiterShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-800">Bảng giá & Credit</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Lựa chọn gói phù hợp để tối ưu hiệu quả tuyển dụng với AI.
            </p>
          </div>
          <div className="relative hidden h-16 w-28 shrink-0 sm:block" aria-hidden>
            <span className="absolute bottom-1 left-0 flex h-9 w-9 -rotate-6 items-center justify-center rounded-xl bg-amber-100 text-[13px] font-black text-amber-700 shadow-sm">
              il
            </span>
            <span className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-md shadow-accent-500/30">
              <Crown className="h-5 w-5" />
            </span>
            <span className="absolute bottom-0 left-8 flex h-7 w-7 items-center justify-center rounded-full bg-white text-accent-600 shadow-sm ring-1 ring-accent-100">
              <Coins className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
        <PricingClient config={null} embedded />
      </div>
    </RecruiterShell>
  );
}
