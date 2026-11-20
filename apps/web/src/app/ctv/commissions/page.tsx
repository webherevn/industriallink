'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader2, Percent, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CrmCommissionEntryView } from '@industriallink/contracts';
import { Input } from '@/components/ui';
import { formatVnd, matchesQuery } from '@/components/crm/format';
import { fetchMyPartner } from '@/lib/crm';

type RangeFilter = 'all' | 'month';
type StatusFilter = 'all' | 'pending' | 'closed' | 'paid';

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ đối soát' },
  { id: 'closed', label: 'Đã chốt kỳ' },
  { id: 'paid', label: 'Đã chi trả' },
];

export default function CtvCommissionsPage() {
  const mine = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const [range, setRange] = useState<RangeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const entries = mine.data?.commissions ?? [];

  const rows = useMemo(() => {
    let scoped: CrmCommissionEntryView[] = entries;
    if (range === 'month') scoped = scoped.filter((entry) => inThisMonth(entry.paidAt));
    if (status !== 'all') {
      scoped = scoped.filter((entry) => matchStatus(entry, status));
    }
    return scoped.filter((entry) =>
      matchesQuery(query, [
        entry.companyName,
        entry.planName,
        entry.planCode,
        entry.invoiceNumber,
        entry.billingOrderId,
      ]),
    );
  }, [entries, range, status, query]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Percent className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#0F2440]">Lịch sử hoa hồng</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {rows.length} dòng đang hiện. Chỉ đơn đã thanh toán mới tính hoa hồng.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', 'Tất cả'],
                  ['month', 'Tháng này'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRange(id)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    range === id
                      ? 'bg-[#0F2440] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatus(item.id)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    status === item.id
                      ? 'bg-[#0F2440] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Tìm công ty, gói, mã hóa đơn"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>

        {mine.isLoading ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải lịch sử hoa hồng…
          </p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Chưa có khoản hoa hồng nào. Hoa hồng xuất hiện sau khi khách hàng thanh toán gói.
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Không có dòng nào khớp bộ lọc.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Thời gian</th>
                  <th className="px-5 py-3">Công ty khách hàng</th>
                  <th className="px-5 py-3">Gói dịch vụ</th>
                  <th className="px-5 py-3">Giá trị đơn</th>
                  <th className="px-5 py-3">Tỷ lệ %</th>
                  <th className="px-5 py-3">Tiền hoa hồng</th>
                  <th className="px-5 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-xs leading-snug text-slate-500">
                      {formatDate(entry.paidAt)}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{entry.companyName}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        Đơn {entry.billingOrderId.slice(0, 8)}
                        {entry.invoiceNumber ? ` · ${entry.invoiceNumber}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {entry.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}
                      {entry.planName ? ` · ${entry.planName}` : ''}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {formatVnd(entry.paidAmountVnd)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-700">{entry.percent}%</td>
                    <td className="px-5 py-3 font-bold text-[#0F2440]">
                      {formatVnd(entry.commissionVnd)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusChip entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusChip({ entry }: { entry: CrmCommissionEntryView }) {
  if (entry.periodStatus === 'paid' && entry.periodMonth) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        Đã chi kỳ {formatPeriodMonth(entry.periodMonth)}
      </span>
    );
  }
  if (entry.periodMonth) {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
        Đã chốt kỳ {formatPeriodMonth(entry.periodMonth)}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      Chờ đối soát
    </span>
  );
}

function matchStatus(entry: CrmCommissionEntryView, status: StatusFilter): boolean {
  if (status === 'pending') return entry.periodMonth == null;
  if (status === 'closed') return entry.periodMonth != null && entry.periodStatus !== 'paid';
  if (status === 'paid') return entry.periodStatus === 'paid';
  return true;
}

function formatPeriodMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  return `${Number(month)}/${year}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

function inThisMonth(iso: string): boolean {
  const stamp = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(iso));
  const now = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  return stamp === now;
}
