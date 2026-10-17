'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { CrmWorkspaceSlice } from '@industriallink/contracts';
import { CrmEmpty } from '@/components/crm-frame';
import { CrmMonthField } from '@/components/crm/fields';
import { formatVnd } from '@/components/crm/format';
import { fetchCrmWorkspace } from '@/lib/crm';

function currentVietnamMonth(): string {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shortVnd(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return '0';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return amount.toLocaleString('vi-VN');
}

export function CrmWorkspaceBoard() {
  const [month, setMonth] = useState(currentVietnamMonth);
  const report = useQuery({ queryKey: ['crm-workspace', month], queryFn: () => fetchCrmWorkspace(month) });
  const data = report.data;
  const maxMonth = Math.max(1, ...(data?.months.map((item) => Number(item.paidAmountVnd)) ?? [1]));
  const maxSource = Math.max(1, ...(data?.bySource.map((item) => Number(item.paidAmountVnd)) ?? [1]));
  const platform = Number(data?.platformPaidVnd ?? 0);
  const sourcing = Number(data?.sourcingPaidVnd ?? 0);
  const enterprise = Number(data?.enterpriseCollectedVnd ?? 0);
  const paidTotal = platform + sourcing + enterprise;
  const platformTurn = paidTotal === 0 ? 0 : (platform / paidTotal) * 360;
  const sourcingTurn = paidTotal === 0 ? 0 : ((platform + sourcing) / paidTotal) * 360;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Tình hình tháng</h2>
          <p className="mt-1 text-sm text-slate-500">Tiền là đơn gói đã trả, chưa VAT. Giá niêm yết trên cơ hội không cộng vào doanh số.</p>
        </div>
        <div className="w-full max-w-xs">
          <CrmMonthField value={month} onChange={setMonth} max={currentVietnamMonth()} />
        </div>
      </div>
      {report.isLoading ? <CrmEmpty>Đang tải tình hình…</CrmEmpty> : null}
      {report.isError ? <CrmEmpty>Không tải được tình hình tháng.</CrmEmpty> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi href="/crm/orders" className="bg-[#072348] text-white" label="Đơn đã trả" value={String(data.orders)} hint={`${data.newLeads} lead mới · ${data.quotes} báo giá`} />
            <Kpi href="/crm/reports" className="bg-[#4c3ec9] text-white" label="Doanh số đã thu" value={formatVnd(data.paidAmountVnd)} hint="Gói tin và gói Săn, giá lớn hơn 0" />
            <Kpi href="/crm/orders" className="bg-white text-slate-900" label="Gói tin" value={formatVnd(data.platformPaidVnd)} hint="Đã thu trong tháng" />
            <Kpi href="/crm/orders" className="bg-white text-slate-900" label="Gói Săn" value={formatVnd(data.sourcingPaidVnd)} hint="Đã thu trong tháng" />
            <Kpi href="/crm/quotes" className="bg-white text-slate-900" label="Đã thu Enterprise" value={formatVnd(data.enterpriseCollectedVnd)} hint="Đợt đã ghi thu trong tháng" />
            <Kpi href="/crm/finance" className="bg-white text-slate-900" label="Còn phải thu" value={formatVnd(data.receivableVnd)} hint={`Đến hạn trong tháng ${formatVnd(data.receivableDueVnd)}`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-[22px] bg-white p-4 crm-surface">
              <h3 className="text-sm font-semibold text-slate-900">Tiền đã thu theo tháng</h3>
              <p className="mt-1 text-xs text-slate-400">Năm {data.periodMonth.slice(0, 4)}. Gồm đơn gói đã trả và đợt Enterprise đã ghi thu.</p>
              <div className="mt-4 flex h-40 items-end gap-1.5">
                {data.months.map((item) => {
                  const height = Math.round((Number(item.paidAmountVnd) / maxMonth) * 100);
                  const active = item.month === data.periodMonth;
                  return (
                    <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-400">{Number(item.paidAmountVnd) > 0 ? shortVnd(item.paidAmountVnd) : ''}</span>
                      <div className="flex h-28 w-full items-end">
                        <div
                          className={`w-full rounded-t-md ${active ? 'bg-[#4c3ec9]' : 'bg-[#d9d4f5]'}`}
                          style={{ height: `${Math.max(height, Number(item.paidAmountVnd) > 0 ? 8 : 2)}%` }}
                          title={`${item.label}: ${formatVnd(item.paidAmountVnd)}`}
                        />
                      </div>
                      <span className={`text-[10px] ${active ? 'font-semibold text-[#4c3ec9]' : 'text-slate-400'}`}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </article>
            <article className="rounded-[22px] bg-white p-4 crm-surface">
              <h3 className="text-sm font-semibold text-slate-900">Doanh số theo nguồn</h3>
              <p className="mt-1 text-xs text-slate-400">Đơn gói và đợt Enterprise, gắn theo lead sớm nhất của công ty.</p>
              <ul className="mt-4 space-y-3">
                {data.bySource.map((row) => (
                  <BarRow key={row.key} row={row} max={maxSource} />
                ))}
              </ul>
            </article>
            <article className="rounded-[22px] bg-white p-4 crm-surface">
              <h3 className="text-sm font-semibold text-slate-900">Doanh số theo gói</h3>
              <div className="mt-4 flex items-center gap-4">
                <div
                  className="relative h-24 w-24 shrink-0 rounded-full"
                  style={{ background: paidTotal === 0 ? '#e7e5f4' : `conic-gradient(#4c3ec9 0deg ${platformTurn}deg, #5eead4 ${platformTurn}deg ${sourcingTurn}deg, #072348 ${sourcingTurn}deg 360deg)` }}
                >
                  <div className="absolute inset-3 rounded-full bg-white" />
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#4c3ec9]" />Gói tin · {formatVnd(data.platformPaidVnd)}</p>
                  <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#5eead4]" />Gói Săn · {formatVnd(data.sourcingPaidVnd)}</p>
                  <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#072348]" />Enterprise · {formatVnd(data.enterpriseCollectedVnd)}</p>
                  <p className="text-xs text-slate-400">{data.openDeals} cơ hội đang chạy · giá niêm yết {formatVnd(data.openListPriceVnd)}</p>
                </div>
              </div>
              <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Gói được trả nhiều</h4>
              {data.plans.length === 0 ? <p className="mt-2 text-sm text-slate-500">Chưa có đơn đã trả.</p> : null}
              <ol className="mt-2 space-y-2">
                {data.plans.map((plan, index) => (
                  <li key={plan.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{index + 1}. {plan.label}</span>
                    <span className="shrink-0 font-semibold text-[#4c3ec9]">{formatVnd(plan.paidAmountVnd)}</span>
                  </li>
                ))}
              </ol>
            </article>
          </div>
          <article className="rounded-[22px] bg-white p-4 crm-surface">
            <h3 className="text-sm font-semibold text-slate-900">Nhân viên xuất sắc</h3>
            <p className="mt-1 text-xs text-slate-400">Xếp theo tiền đã thu trong tháng: đơn gói đã trả và đợt Enterprise đã ghi thu.</p>
            {data.staff.length === 0 ? <p className="mt-4 text-sm text-slate-500">Chưa có tiền đã thu trong tháng này.</p> : null}
            <ol className="mt-4 space-y-3">
              {data.staff.map((person, index) => (
                <li key={person.key} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-[#4c3ec9] text-white' : 'bg-[#efeaff] text-[#4c3ec9]'}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{person.label}</span>
                    <span className="block text-xs text-slate-400">{person.orders} đơn gói · Enterprise {formatVnd(person.enterpriseCollectedVnd)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-[#0f766e]">{formatVnd(person.paidAmountVnd)}</span>
                </li>
              ))}
            </ol>
          </article>
          <article className="overflow-hidden rounded-[22px] bg-white crm-surface">
            <div className="border-b border-slate-100 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Việc trong tháng</h3>
              <p className="mt-1 text-xs text-slate-400">Lead, cơ hội và báo giá tạo trong tháng. Doanh số gồm đơn đã trả và đợt Enterprise đã ghi thu.</p>
            </div>
            {data.people.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Chưa có việc hoặc đơn trong tháng này.</p> : null}
            {data.people.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-max min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">Người phụ trách</th>
                      <th className="whitespace-nowrap px-4 py-3">Lead mới</th>
                      <th className="whitespace-nowrap px-4 py-3">Cơ hội</th>
                      <th className="whitespace-nowrap px-4 py-3">Báo giá</th>
                      <th className="whitespace-nowrap px-4 py-3">Đơn đã trả</th>
                      <th className="whitespace-nowrap px-4 py-3">Doanh số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((person) => (
                      <tr key={person.key} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{person.label}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{person.leads}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{person.deals}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{person.quotes}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{person.orders}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#4c3ec9]">{formatVnd((BigInt(person.paidAmountVnd) + BigInt(person.enterpriseCollectedVnd)).toString())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        </>
      ) : null}
    </section>
  );
}

function Kpi({ href, className, label, value, hint }: { href: string; className: string; label: string; value: string; hint: string }) {
  return (
    <Link href={href} className={`block rounded-[22px] p-4 crm-surface ${className}`}>
      <p className={`text-xs font-medium ${className.includes('text-white') ? 'text-white/80' : 'text-slate-500'}`}>{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className={`mt-2 text-xs ${className.includes('text-white') ? 'text-white/75' : 'text-slate-400'}`}>{hint}</p>
    </Link>
  );
}

function BarRow({ row, max }: { row: CrmWorkspaceSlice; max: number }) {
  const width = Math.round((Number(row.paidAmountVnd) / max) * 100);
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-700">{row.label}</span>
        <span className="font-semibold text-[#4c3ec9]">{formatVnd(row.paidAmountVnd)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f4f2fb]">
        <div className="h-full rounded-full bg-[#4c3ec9]" style={{ width: `${Math.max(width, Number(row.paidAmountVnd) > 0 ? 6 : 0)}%` }} />
      </div>
    </li>
  );
}
