'use client';

import { PricingClient } from '@/components/pricing-client';
import { RecruiterShell } from '@/components/recruiter-shell';

/** Bảng giá trong app NTD — sidebar giữ nguyên, không dùng trang public /bang-gia. */
export function RecruiterPricingPage() {
  return (
    <RecruiterShell>
      <div className="recruiter-dash space-y-6">
        <div className="recruiter-dash-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            Tài khoản
          </p>
          <h1 className="cms-page-title mt-1.5">Bảng giá & Credit</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Giá, hạn mức và bảng so sánh lấy đúng cấu hình SuperAdmin đang bật.
          </p>
        </div>
        <PricingClient config={null} embedded />
      </div>
    </RecruiterShell>
  );
}
