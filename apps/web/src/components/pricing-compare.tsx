'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Check, Coins, Package, Shield, X } from 'lucide-react';
import type {
  BillingCreditTopupView,
  BillingCurrencyDisplay,
  BillingPageContentView,
  BillingPlatformPlanView,
  BillingSourcingPlanView,
  SourcingServiceScope,
} from '@industriallink/contracts';
import {
  BILLING_PLAN_ACTION_LABELS,
  BILLING_PLAN_BILLABLE_ACTIONS,
} from '@industriallink/contracts';
import { formatPriceVnd } from '@/lib/format-billing';

type CompareTab = 'platform' | 'sourcing' | 'credit';
type CompareCell = { kind: 'text'; text: string } | { kind: 'flag'; yes: boolean };
type CompareRow = { label: string; cells: CompareCell[] };

const SCOPE_LABEL: Record<SourcingServiceScope, string> = {
  ai_match: 'AI tìm / Matching',
  filter_rank: 'Lọc & xếp hạng',
  shortlist: 'Shortlist',
  strengths_gaps: 'Điểm mạnh / khoảng thiếu',
  priority: 'Ứng viên ưu tiên',
  outreach: 'Chủ động tiếp cận',
  follow_up: 'Theo dõi phản hồi',
  replacement: 'Ứng viên thay thế',
};

const ALL_SCOPES: SourcingServiceScope[] = [
  'ai_match',
  'filter_rank',
  'shortlist',
  'strengths_gaps',
  'priority',
  'outreach',
  'follow_up',
  'replacement',
];

function formatQuota(value: number | null, unlimited = 'Không giới hạn'): string {
  return value == null ? unlimited : String(value);
}

function planHasAction(
  plan: BillingPlatformPlanView,
  action: (typeof BILLING_PLAN_BILLABLE_ACTIONS)[number],
): boolean {
  const row = plan.actionCosts?.find((c) => c.action === action && c.isActive);
  if (!row) return false;
  if (row.cost === 0) return true;
  return plan.creditQuota == null || plan.creditQuota > 0;
}

function isEnterprisePlan(plan: BillingPlatformPlanView): boolean {
  return plan.code === 'ENTERPRISE';
}

function platformPriceText(plan: BillingPlatformPlanView, currency: BillingCurrencyDisplay): string {
  if (isEnterprisePlan(plan)) return 'Báo giá';
  try {
    if (BigInt(plan.priceVnd) === 0n) return 'Miễn phí';
  } catch {
    return 'Báo giá';
  }
  return formatPriceVnd(plan.priceVnd, currency);
}

function platformFit(plan: BillingPlatformPlanView): string {
  if (isEnterprisePlan(plan)) return 'Tập đoàn, thiết kế theo hợp đồng';
  if (plan.creditQuota === 0) return 'Dùng thử 1 JD, chưa mở hồ sơ';
  if (plan.jobPostQuota == null || plan.jobPostQuota > 1) return 'Nhiều JD / nhiều user';
  if (plan.billingUnit === 'per_month') return 'Thuê bao theo tháng';
  return '1 JD có thời hạn';
}

function sourcingFit(plan: BillingSourcingPlanView): string {
  const n = plan.serviceScope.length;
  if (plan.searchRoundQuota == null || n >= 7) return 'Vị trí then chốt, theo sát đến khi tuyển';
  if (n >= 4) return 'Cần shortlist và phân tích';
  return 'Vị trí dễ, phạm vi gọn';
}

function buildPlatformRows(
  plans: BillingPlatformPlanView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  return [
    {
      label: 'Giá',
      cells: plans.map((p) => ({ kind: 'text', text: platformPriceText(p, currency) })),
    },
    {
      label: 'Cách tính',
      cells: plans.map((p) => ({
        kind: 'text',
        text: isEnterprisePlan(p) ? 'Theo hợp đồng' : p.billingUnit === 'per_month' ? 'Theo tháng' : 'Theo JD',
      })),
    },
    {
      label: 'Thời hạn',
      cells: plans.map((p) => ({
        kind: 'text',
        text: p.durationDays == null ? 'Không giới hạn' : `${p.durationDays} ngày`,
      })),
    },
    {
      label: 'Số JD',
      cells: plans.map((p) => ({ kind: 'text', text: formatQuota(p.jobPostQuota) })),
    },
    {
      label: 'Nhiều JD cùng lúc',
      cells: plans.map((p) => ({
        kind: 'flag',
        yes: p.jobPostQuota == null || p.jobPostQuota > 1,
      })),
    },
    {
      label: 'Credit tặng kèm',
      cells: plans.map((p) => ({
        kind: 'text',
        text: p.creditQuota == null ? 'Theo HĐ' : String(p.creditQuota),
      })),
    },
    ...BILLING_PLAN_BILLABLE_ACTIONS.map((action) => ({
      label: BILLING_PLAN_ACTION_LABELS[action],
      cells: plans.map((p) => ({ kind: 'flag' as const, yes: planHasAction(p, action) })),
    })),
    {
      label: 'Phù hợp khi',
      cells: plans.map((p) => ({ kind: 'text', text: platformFit(p) })),
    },
  ];
}

function buildSourcingRows(
  plans: BillingSourcingPlanView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  return [
    {
      label: 'Phí / vị trí',
      cells: plans.map((p) => ({ kind: 'text', text: formatPriceVnd(p.feeVnd, currency) })),
    },
    {
      label: 'Số vị trí',
      cells: plans.map((p) => ({ kind: 'text', text: formatQuota(p.positionQuota) })),
    },
    {
      label: 'Đợt tìm',
      cells: plans.map((p) => ({ kind: 'text', text: formatQuota(p.searchRoundQuota) })),
    },
    {
      label: 'Shortlist',
      cells: plans.map((p) => ({ kind: 'text', text: formatQuota(p.shortlistQuota) })),
    },
    {
      label: 'Lần điều chỉnh',
      cells: plans.map((p) => ({ kind: 'text', text: formatQuota(p.revisionQuota) })),
    },
    ...ALL_SCOPES.map((scope) => ({
      label: SCOPE_LABEL[scope],
      cells: plans.map((p) => ({
        kind: 'flag' as const,
        yes: p.serviceScope.includes(scope),
      })),
    })),
    {
      label: 'Phù hợp khi',
      cells: plans.map((p) => ({ kind: 'text', text: sourcingFit(p) })),
    },
  ];
}

function buildCreditRows(
  topups: BillingCreditTopupView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  const units = topups.map((t) => Number(BigInt(t.unitPriceVnd)));
  const maxUnit = units.length ? Math.max(...units) : 0;
  const minUnit = units.length ? Math.min(...units) : 0;

  return [
    {
      label: 'Số Credit',
      cells: topups.map((t) => ({ kind: 'text', text: `${t.creditCount} lượt` })),
    },
    {
      label: 'Giá gói',
      cells: topups.map((t) => ({ kind: 'text', text: formatPriceVnd(t.priceVnd, currency) })),
    },
    {
      label: 'Đơn giá / lượt',
      cells: topups.map((t) => ({
        kind: 'text',
        text: formatPriceVnd(t.unitPriceVnd, { ...currency, decimalDigits: 0 }),
      })),
    },
    {
      label: 'Rẻ hơn gói đắt nhất / lượt',
      cells: topups.map((t) => {
        const unit = Number(BigInt(t.unitPriceVnd));
        if (maxUnit <= 0 || unit >= maxUnit) return { kind: 'text' as const, text: '—' };
        const pct = Math.round(((maxUnit - unit) / maxUnit) * 100);
        return { kind: 'text' as const, text: `${pct}%` };
      }),
    },
    {
      label: 'Đơn giá thấp nhất',
      cells: topups.map((t) => ({
        kind: 'flag',
        yes: minUnit > 0 && Number(BigInt(t.unitPriceVnd)) === minUnit,
      })),
    },
  ];
}

function platformInsight(plans: BillingPlatformPlanView[]): string {
  const trial = plans.find((p) => p.creditQuota === 0 && !isEnterprisePlan(p));
  const withCredit = plans.filter((p) => p.creditQuota != null && p.creditQuota > 0);
  const unlimitedJd = plans.filter((p) => p.jobPostQuota == null && !isEnterprisePlan(p));
  const bits: string[] = [];
  if (trial) bits.push(`${trial.name} để thử 1 JD, chưa tặng Credit mở hồ sơ.`);
  if (withCredit.length) {
    bits.push(
      `${withCredit.map((p) => `${p.name} tặng ${p.creditQuota}`).join(', ')} Credit.`,
    );
  }
  if (unlimitedJd.length) {
    bits.push(`${unlimitedJd.map((p) => p.name).join(', ')} không giới hạn số JD.`);
  }
  bits.push('Enterprise báo giá theo hợp đồng — không niêm yết số.');
  return bits.join(' ');
}

function sourcingInsight(plans: BillingSourcingPlanView[]): string {
  const sorted = [...plans].sort((a, b) => a.serviceScope.length - b.serviceScope.length);
  const slim = sorted[0];
  const full = sorted[sorted.length - 1];
  if (!slim || !full) return 'Phạm vi dịch vụ lấy đúng từ cấu hình từng gói Săn.';
  if (slim.id === full.id) {
    return `${slim.name} gồm ${slim.serviceScope.length} hạng mục trong cấu hình.`;
  }
  return `${slim.name} gồm ${slim.serviceScope.length} hạng mục; ${full.name} gồm ${full.serviceScope.length} hạng mục. Số đợt tìm / shortlist / điều chỉnh lấy từ quota gói.`;
}

function creditInsight(topups: BillingCreditTopupView[]): string {
  if (topups.length < 2) return 'Đơn giá / lượt = giá gói chia số Credit.';
  const byUnit = [...topups].sort((a, b) => Number(BigInt(a.unitPriceVnd) - BigInt(b.unitPriceVnd)));
  const cheapest = byUnit[0];
  const dearest = byUnit[byUnit.length - 1];
  if (!cheapest || !dearest || cheapest.id === dearest.id) {
    return 'Đơn giá / lượt tính từ giá gói và số Credit.';
  }
  const max = Number(BigInt(dearest.unitPriceVnd));
  const min = Number(BigInt(cheapest.unitPriceVnd));
  const pct = max > 0 ? Math.round(((max - min) / max) * 100) : 0;
  return `${cheapest.name} rẻ hơn ${pct}% mỗi lượt so với ${dearest.name} (${formatCount(min)} vs ${formatCount(max)} VNĐ/lượt). Credit không tự gia hạn mua.`;
}

function formatCount(n: number): string {
  return n.toLocaleString('vi-VN');
}

function CompareCellView({ cell }: { cell: CompareCell }) {
  if (cell.kind === 'flag') {
    return cell.yes ? (
      <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Có" />
    ) : (
      <X className="mx-auto h-4 w-4 text-slate-300" aria-label="Không" />
    );
  }
  return <span className="text-xs font-medium leading-snug text-slate-600">{cell.text}</span>;
}

function CompareMatrix({
  columns,
  featured,
  rows,
}: {
  columns: { id: string; name: string; featured: boolean }[];
  featured: boolean[];
  rows: CompareRow[];
}) {
  return (
    <>
      <div className="hidden lg:block">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-600" scope="col">
                  Chỉ số
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className={clsx(
                      'px-4 py-3 text-center',
                      col.featured ? 'bg-amber-50 text-[#072348]' : 'text-slate-600',
                    )}
                  >
                    <span className="font-bold">{col.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={`${row.label}-${ri}`}
                  className={clsx(
                    'border-b border-slate-100',
                    ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                  )}
                >
                  <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                  {row.cells.map((cell, ci) => (
                    <td
                      key={columns[ci]?.id ?? ci}
                      className={clsx('px-4 py-3 text-center', featured[ci] ? 'bg-amber-50/50' : '')}
                    >
                      <CompareCellView cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:hidden">
        {columns.map((col, idx) => (
          <div
            key={col.id}
            className={clsx(
              'rounded-2xl border p-5',
              col.featured
                ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400'
                : 'border-slate-200 bg-white',
            )}
          >
            <h3 className="text-base font-bold text-[#072348]">{col.name}</h3>
            <div className="mt-3 space-y-1.5">
              {rows.map((row) => {
                const cell = row.cells[idx];
                if (!cell) return null;
                return (
                  <div key={row.label} className="flex items-start justify-between gap-3 text-xs">
                    <span className="text-slate-500">{row.label}</span>
                    {cell.kind === 'flag' ? (
                      cell.yes ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Có" />
                      ) : (
                        <X className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-label="Không" />
                      )
                    ) : (
                      <span className="max-w-[55%] text-right font-medium text-slate-700">{cell.text}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function CompareSection({
  platformPlans,
  sourcingPlans,
  topups,
  currency,
  page,
}: {
  platformPlans: BillingPlatformPlanView[];
  sourcingPlans: BillingSourcingPlanView[];
  topups: BillingCreditTopupView[];
  currency: BillingCurrencyDisplay;
  page: BillingPageContentView;
}) {
  const [tab, setTab] = useState<CompareTab>('platform');
  const platform = platformPlans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const sourcing = sourcingPlans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const credit = topups.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const tabs = [
    ['platform', page.platformTitle, Package],
    ['sourcing', page.sourcingTitle, Shield],
    ['credit', page.creditTitle, Coins],
  ] as const;

  let columns: { id: string; name: string; featured: boolean }[] = [];
  let rows: CompareRow[] = [];
  let insight = '';

  if (tab === 'platform') {
    columns = platform.map((p) => ({ id: p.id, name: p.name, featured: p.isFeatured }));
    rows = buildPlatformRows(platform, currency);
    insight = platformInsight(platform);
  } else if (tab === 'sourcing') {
    columns = sourcing.map((p) => ({ id: p.id, name: p.name, featured: p.isFeatured }));
    rows = buildSourcingRows(sourcing, currency);
    insight = sourcingInsight(sourcing);
  } else {
    columns = credit.map((t) => ({
      id: t.id,
      name: t.name,
      featured: t.isFeatured || Boolean(t.badge),
    }));
    rows = buildCreditRows(credit, currency);
    insight = creditInsight(credit);
  }

  return (
    <section id="compare" className="bg-slate-50 py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-[#072348] sm:text-3xl">{page.compareTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{page.compareSubtitle}</p>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200" role="tablist" aria-label="So sánh theo nhóm gói">
            {tabs.map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  tab === id
                    ? 'bg-[#072348] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {insight ? (
          <p className="mx-auto mb-6 max-w-3xl text-center text-sm leading-relaxed text-slate-600">{insight}</p>
        ) : null}

        {columns.length === 0 ? (
          <p className="text-center text-sm text-slate-500">Chưa có gói đang bật để so sánh.</p>
        ) : (
          <CompareMatrix
            columns={columns}
            featured={columns.map((c) => c.featured)}
            rows={rows}
          />
        )}
      </div>
    </section>
  );
}
