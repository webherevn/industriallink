'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { CrmFunnelBucket } from '@industriallink/contracts';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { CrmMonthField } from '@/components/crm/fields';
import { formatVnd } from '@/components/crm/format';
import { fetchCrmFunnelReport } from '@/lib/crm';

function currentVietnamMonth(): string {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function CrmReportsPanel() {
  const [month, setMonth] = useState(currentVietnamMonth());
  const report = useQuery({ queryKey: ['crm-funnel-report', month], queryFn: () => fetchCrmFunnelReport(month) });
  const data = report.data;
  const empty = data && data.byOwner.length === 0 && data.bySource.length === 0 && data.byPartner.length === 0;

  return (
    <CrmFrame
      kicker="Đơn đã trả trên inlink"
      title="Doanh số"
      description="Doanh số một tháng theo người phụ trách và nguồn. Tiền tách gói tin với gói Săn. Bước Đã chốt không được tính."
      footnote="Tiền là đơn khách đã trả trong tháng, chưa VAT. Lead là lead tạo trong tháng đó. Đơn gắn với lead sớm nhất của công ty."
    >
      <div className="mx-auto w-full max-w-xs">
        <CrmMonthField value={month} onChange={setMonth} max={currentVietnamMonth()} />
      </div>
      {report.isLoading ? <CrmEmpty>Đang tải báo cáo…</CrmEmpty> : null}
      {report.isError ? <CrmEmpty>Không tải được báo cáo.</CrmEmpty> : null}
      {empty ? <CrmEmpty>Chưa có lead hoặc đơn đã trả trong tháng này.</CrmEmpty> : null}
      {data && !empty ? (
        <div className="space-y-4">
          <BucketTable title="Theo người phụ trách" rows={data.byOwner} leadLabel="Lead" />
          <BucketTable title="Theo nguồn" rows={data.bySource} leadLabel="Lead" />
          <BucketTable title="Theo cộng tác viên" rows={data.byPartner} leadLabel="Lead giới thiệu" />
        </div>
      ) : null}
    </CrmFrame>
  );
}

function BucketTable({ title, rows, leadLabel }: { title: string; rows: CrmFunnelBucket[]; leadLabel: string }) {
  return (
    <section className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
      <div className="border-b border-slate-100 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {rows.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Chưa có số.</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Nhóm</th>
                <th className="px-4 py-3">{leadLabel}</th>
                <th className="px-4 py-3">Đơn đã trả</th>
                <th className="px-4 py-3">Gói tin</th>
                <th className="px-4 py-3">Gói Săn</th>
                <th className="px-4 py-3">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="px-4 py-3 text-slate-700">{row.leads}</td>
                  <td className="px-4 py-3 text-slate-700">{row.paidOrders}</td>
                  <td className="px-4 py-3 text-slate-700">{formatVnd(row.platformPaidVnd)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatVnd(row.sourcingPaidVnd)}</td>
                  <td className="px-4 py-3 font-semibold text-[#4c3ec9]">{formatVnd(row.paidAmountVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
