'use client';

import { useQuery } from '@tanstack/react-query';
import type { CrmCommissionEntryView } from '@industriallink/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { fetchCrmCommissionLedger } from '@/lib/crm';

export function CrmReconciliationPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const ledger = useQuery({ queryKey: ['crm-commissions'], queryFn: fetchCrmCommissionLedger });
  const [query, setQuery] = useState(initialQuery);
  const entries = (ledger.data?.entries ?? []).filter((entry) =>
    matchesQuery(query, [
      entry.companyName,
      entry.partnerName,
      entry.partnerCode,
      entry.planName,
      entry.planCode,
      entry.invoiceNumber,
    ]),
  );

  return (
    <CrmFrame
      kicker="Sau khi khách đã thanh toán trên inlink"
      title="Đối soát hoa hồng"
      description="Mỗi đơn gói đã thanh toán ghi một khoản cho cộng tác viên của nhà máy đó. Chốt deal không tạo khoản này."
      placeholder="Tìm nhà máy, cộng tác viên hoặc gói"
      search={{ value: query, onChange: setQuery }}
      footnote="Chỉ trạng thái chờ đối soát. Không rút và không có lệnh chi."
    >
      {ledger.isLoading ? <CrmEmpty>Đang tải khoản hoa hồng…</CrmEmpty> : null}
      {ledger.isError ? <CrmEmpty>Không tải được danh sách đối soát.</CrmEmpty> : null}
      {ledger.data && ledger.data.entries.length === 0 ? (
        <CrmEmpty>Chưa có khoản nào. Hoa hồng xuất hiện sau khi khách thanh toán gói trên inlink.</CrmEmpty>
      ) : null}
      {ledger.data && ledger.data.entries.length > 0 && entries.length === 0 ? (
        <CrmEmpty>Không có khoản khớp từ khóa.</CrmEmpty>
      ) : null}
      {ledger.data && entries.length > 0 ? (
        <div className="space-y-4">
          <section className="rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Tổng chờ đối soát</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-[#4c3ec9]">
              {formatVnd(String(entries.reduce((sum, entry) => sum + Number(entry.commissionVnd), 0)))}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {entries.length} khoản đang hiện. Đây là số đã ghi nhận, chưa phải số được rút.
            </p>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ) : null}
    </CrmFrame>
  );
}

function EntryCard({ entry }: { entry: CrmCommissionEntryView }) {
  return (
    <article className="rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{entry.companyName}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {entry.partnerName} · {entry.partnerCode}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
          Chờ đối soát
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Gói đã thanh toán</dt>
          <dd className="mt-1 font-medium text-slate-800">
            {entry.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}
            {entry.planName ? ` · ${entry.planName}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Số đã thu</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatVnd(entry.paidAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Tỷ lệ lúc thanh toán</dt>
          <dd className="mt-1 font-medium text-slate-800">{entry.percent}%</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Hoa hồng</dt>
          <dd className="mt-1 font-semibold text-[#4c3ec9]">{formatVnd(entry.commissionVnd)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-slate-400">Thanh toán {formatWhen(entry.paidAt)}</p>
      <Link
        href={`/crm/finance?q=${encodeURIComponent(entry.invoiceNumber ?? entry.companyName)}`}
        className={`mt-1 block text-xs font-medium underline ${entry.invoiceNumber ? 'text-emerald-700' : 'text-amber-700'}`}
      >
        {entry.invoiceNumber ? `Hóa đơn ${entry.invoiceNumber}` : 'Chưa ghi số hóa đơn'}
      </Link>
    </article>
  );
}
