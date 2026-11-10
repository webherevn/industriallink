'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { BarChart3, Check, X } from 'lucide-react';
import type {
  BillingCompareTable,
  BillingCreditTopupView,
  BillingCurrencyDisplay,
  BillingPageContentView,
  BillingPlatformPlanView,
  BillingSourcingPlanView,
  SourcingScopeLine,
} from '@industriallink/contracts';
import { BILLING_PLAN_BILLABLE_ACTIONS } from '@industriallink/contracts';
import { formatPriceVnd } from '@/lib/format-billing';
import { PRICING_BRAND, PRICING_HEADING_CONTEXT, platformJobCountLabel } from '@/lib/pricing-catalog';

type CompareTab = 'platform' | 'sourcing' | 'credit';
type CompareCell =
  | { kind: 'text'; text: string }
  | { kind: 'hook'; text: string }
  | { kind: 'flag'; yes: boolean };
export type CompareRow = { label: string; autoKey?: string; cells: CompareCell[] };

const PLATFORM_ROW_KEYS = [
  'hook',
  'price',
  'billing',
  'free_start',
  'ai_match',
  'view_match_summary',
  'view_profile',
  'reopen_profile',
  'view_applicant',
  'contact_potential',
  'contact_applicant',
  'gift_credit',
  'multi_job',
  'monthly',
  'enterprise_sla',
  'duration',
  'job_count',
  'credit_quota',
  'fit',
];

const CREDIT_ROW_KEYS = [
  'hook',
  'count',
  'price',
  'unit',
  'cheaper_pct',
  'cheapest',
  'smallest',
  'largest',
  'no_auto',
];

function tagRows(rows: CompareRow[], keys: string[]): CompareRow[] {
  return rows.map((row, index) => ({ ...row, autoKey: row.autoKey ?? keys[index] }));
}

export function creditColumnCode(topup: BillingCreditTopupView): string {
  return `credit-${topup.creditCount}`;
}

function formatQuota(value: number | null, unlimited = 'Không giới hạn'): string {
  return value == null ? unlimited : String(value);
}

function planHasAction(
  plan: BillingPlatformPlanView,
  action: (typeof BILLING_PLAN_BILLABLE_ACTIONS)[number],
): boolean {
  const row = plan.actionCosts?.find((c) => c.action === action);
  if (!row) return true;
  return row.isActive;
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
  const payable = plan.promoPercent && plan.promoPriceVnd ? plan.promoPriceVnd : plan.priceVnd;
  return formatPriceVnd(payable, currency);
}

function hasPaidPrice(plan: BillingPlatformPlanView): boolean {
  if (isEnterprisePlan(plan)) return false;
  try {
    return BigInt(plan.priceVnd) > 0n;
  } catch {
    return false;
  }
}

function hasGiftCredit(plan: BillingPlatformPlanView): boolean {
  return plan.creditQuota == null || plan.creditQuota > 0;
}

function platformHook(plan: BillingPlatformPlanView): string {
  if (isEnterprisePlan(plan)) return 'Thiết kế riêng — giá theo hợp đồng';
  if (!hasPaidPrice(plan) && !hasGiftCredit(plan)) {
    return plan.durationDays
      ? `Zero đồng · hiểu matching trong ${plan.durationDays} ngày`
      : 'Zero đồng — thử matching trước khi trả phí';
  }
  const credit =
    plan.creditQuota == null ? 'Credit theo HĐ' : `tặng ${plan.creditQuota} Credit`;
  if (plan.jobPostQuota == null) {
    return `${platformJobCountLabel(plan)} · ${credit}`;
  }
  const days = plan.durationDays ? ` · ${plan.durationDays} ngày` : '';
  return `${platformJobCountLabel(plan)}${days} · ${credit}`;
}

function platformFit(plan: BillingPlatformPlanView): string {
  if (isEnterprisePlan(plan)) return 'Tập đoàn cần SLA, tích hợp, onboarding riêng';
  if (!hasGiftCredit(plan)) return 'Muốn xem matching trước, chưa cần mở CV';
  if (plan.jobPostQuota == null) {
    return 'Tuyển nhiều vị trí, nhiều user cùng tài khoản';
  }
  const credits =
    plan.creditQuota == null ? 'Credit theo HĐ' : `${plan.creditQuota} Credit`;
  return `Tự tuyển ${platformJobCountLabel(plan)}, ${credits} mở hồ sơ`;
}

function sourcingHook(plan: BillingSourcingPlanView): string {
  const n = plan.serviceScope.length;
  const rounds = plan.searchRoundQuota == null ? 'đợt tìm không giới hạn' : `${plan.searchRoundQuota} đợt tìm`;
  if (plan.searchRoundQuota == null || n >= 7) {
    return `Theo sát đến khi tuyển · ${n} hạng mục · ${rounds}`;
  }
  if (n >= 4) {
    const sl = plan.shortlistQuota == null ? 'shortlist linh hoạt' : `shortlist ${plan.shortlistQuota}`;
    return `${PRICING_BRAND} tìm & chọn · ${sl} · ${rounds}`;
  }
  return `${PRICING_BRAND} tìm giúp · ${n} hạng mục · ${rounds}`;
}

function sourcingFit(plan: BillingSourcingPlanView): string {
  const n = plan.serviceScope.length;
  if (plan.searchRoundQuota == null || n >= 7) return 'Vị trí then chốt, cần người theo đến khi chốt';
  if (n >= 4) return 'Cần shortlist + phân tích, không chỉ danh sách thô';
  return `Vị trí dễ, ngân sách gọn, cần ${PRICING_BRAND} tìm hộ`;
}

function creditHook(topup: BillingCreditTopupView, minUnit: number, maxUnit: number): string {
  const unit = Number(BigInt(topup.unitPriceVnd));
  if (minUnit > 0 && unit === minUnit && maxUnit > minUnit) {
    const pct = Math.round(((maxUnit - unit) / maxUnit) * 100);
    return `${topup.creditCount} lượt · đơn giá thấp nhất (rẻ hơn ${pct}%)`;
  }
  if (topup.isFeatured || topup.badge) {
    return topup.badge
      ? `${topup.creditCount} lượt · ${topup.badge}`
      : `${topup.creditCount} lượt · lựa chọn cân bằng`;
  }
  return `${topup.creditCount} lượt · mua đúng số cần`;
}

export function buildPlatformRows(
  plans: BillingPlatformPlanView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  return tagRows([
    {
      label: 'Điểm nhấn',
      cells: plans.map((p) => ({ kind: 'hook', text: platformHook(p) })),
    },
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
      label: 'Bắt đầu không mất phí',
      cells: plans.map((p) => ({ kind: 'flag', yes: !hasPaidPrice(p) && !isEnterprisePlan(p) })),
    },
    {
      label: 'AI phân tích & matching JD',
      cells: plans.map(() => ({ kind: 'flag', yes: true })),
    },
    {
      label: 'Xem tổng quan Matching',
      cells: plans.map((p) => ({ kind: 'flag', yes: planHasAction(p, 'view_match_summary') })),
    },
    {
      label: 'Mở danh tính & CV đầy đủ',
      cells: plans.map((p) => ({ kind: 'flag', yes: planHasAction(p, 'view_profile') })),
    },
    {
      label: 'Mở lại hồ sơ đã xem',
      cells: plans.map((p) => ({ kind: 'flag', yes: planHasAction(p, 'reopen_profile') })),
    },
    {
      label: 'Xem ứng viên đã ứng tuyển',
      cells: plans.map((p) => ({ kind: 'flag', yes: planHasAction(p, 'view_applicant') })),
    },
    {
      label: 'Liên hệ ứng viên tiềm năng',
      cells: plans.map((p) => ({ kind: 'flag', yes: planHasAction(p, 'contact_potential') })),
    },
    {
      label: 'Liên hệ ứng viên đã ứng tuyển',
      cells: plans.map((p) => ({ kind: 'flag', yes: planHasAction(p, 'contact_applicant') })),
    },
    {
      label: 'Tặng Credit mở hồ sơ',
      cells: plans.map((p) => ({ kind: 'flag', yes: hasGiftCredit(p) })),
    },
    {
      label: 'Tuyển nhiều tin song song',
      cells: plans.map((p) => ({
        kind: 'flag',
        yes: p.jobPostQuota == null || p.jobPostQuota > 1,
      })),
    },
    {
      label: 'Thuê bao theo tháng',
      cells: plans.map((p) => ({
        kind: 'flag',
        yes: p.billingUnit === 'per_month' && !isEnterprisePlan(p),
      })),
    },
    {
      label: 'Hợp đồng & SLA riêng',
      cells: plans.map((p) => ({ kind: 'flag', yes: isEnterprisePlan(p) })),
    },
    {
      label: 'Thời hạn',
      cells: plans.map((p) => ({
        kind: 'text',
        text: p.durationDays == null ? 'Không giới hạn' : `${p.durationDays} ngày`,
      })),
    },
    {
      label: 'Số tin',
      cells: plans.map((p) => ({ kind: 'text', text: formatQuota(p.jobPostQuota) })),
    },
    {
      label: 'Credit tặng kèm',
      cells: plans.map((p) => ({
        kind: 'text',
        text: p.creditQuota == null ? 'Theo HĐ' : String(p.creditQuota),
      })),
    },
    {
      label: 'Phù hợp khi',
      cells: plans.map((p) => ({ kind: 'text', text: platformFit(p) })),
    },
  ], PLATFORM_ROW_KEYS);
}

function sourcingScopeCatalog(plans: BillingSourcingPlanView[]): SourcingScopeLine[] {
  const order: SourcingScopeLine[] = [];
  const seen = new Set<string>();
  for (const plan of plans) {
    for (const line of plan.scopeItems ?? []) {
      if (seen.has(line.code)) continue;
      seen.add(line.code);
      order.push(line);
    }
  }
  return order;
}

export function buildSourcingRows(
  plans: BillingSourcingPlanView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  const scopes = sourcingScopeCatalog(plans);
  return tagRows([
    {
      label: 'Điểm nhấn',
      cells: plans.map((p) => ({ kind: 'hook', text: sourcingHook(p) })),
    },
    {
      label: 'Phí / vị trí',
      cells: plans.map((p) => ({
        kind: 'text',
        text: formatPriceVnd(p.promoPercent && p.promoPriceVnd ? p.promoPriceVnd : p.feeVnd, currency),
      })),
    },
    ...scopes.map((line) => ({
      label: line.label,
      autoKey: `scope:${line.code}`,
      cells: plans.map((p) => ({
        kind: 'flag' as const,
        yes: (p.scopeItems ?? []).some((item) => item.code === line.code && item.included),
      })),
    })),
    {
      label: 'Tìm không giới hạn đợt',
      cells: plans.map((p) => ({ kind: 'flag', yes: p.searchRoundQuota == null })),
    },
    {
      label: 'Điều chỉnh không giới hạn',
      cells: plans.map((p) => ({ kind: 'flag', yes: p.revisionQuota == null })),
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
    {
      label: 'Phù hợp khi',
      cells: plans.map((p) => ({ kind: 'text', text: sourcingFit(p) })),
    },
  ], [
    'hook',
    'fee',
    ...scopes.map((line) => `scope:${line.code}`),
    'unlimited_rounds',
    'unlimited_revisions',
    'positions',
    'rounds',
    'shortlist',
    'revisions',
    'fit',
  ]);
}

export function buildCreditRows(
  topups: BillingCreditTopupView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  const units = topups.map((t) => Number(BigInt(t.unitPriceVnd)));
  const maxUnit = units.length ? Math.max(...units) : 0;
  const minUnit = units.length ? Math.min(...units) : 0;

  const maxCount = topups.reduce((m, t) => Math.max(m, t.creditCount), 0);

  return tagRows([
    {
      label: 'Điểm nhấn',
      cells: topups.map((t) => ({ kind: 'hook', text: creditHook(t, minUnit, maxUnit) })),
    },
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
    {
      label: 'Mua đúng số cần, ít nhất',
      cells: topups.map((t) => ({
        kind: 'flag',
        yes: t.creditCount === Math.min(...topups.map((x) => x.creditCount)),
      })),
    },
    {
      label: 'Nhiều lượt nhất trong các gói',
      cells: topups.map((t) => ({ kind: 'flag', yes: maxCount > 0 && t.creditCount === maxCount })),
    },
    {
      label: 'Không tự động trừ thêm khi hết',
      cells: topups.map(() => ({ kind: 'flag', yes: true })),
    },
  ], CREDIT_ROW_KEYS);
}

export function platformInsight(plans: BillingPlatformPlanView[]): string {
  const trial = plans.find((p) => !hasPaidPrice(p) && !isEnterprisePlan(p));
  const unlock = plans.filter((p) => planHasAction(p, 'view_profile') && (p.creditQuota ?? 0) > 0);
  const unlimitedJd = plans.filter((p) => p.jobPostQuota == null && !isEnterprisePlan(p));
  const bits: string[] = [];
  if (trial) {
    bits.push(`${trial.name}: matching miễn phí, chưa mở CV.`);
  }
  if (unlock.length) {
    bits.push(
      `Mở danh tính/CV từ ${unlock.map((p) => `${p.name}${p.creditQuota ? ` (${p.creditQuota} Credit)` : ''}`).join(', ')}.`,
    );
  }
  if (unlimitedJd.length) {
    bits.push(`${unlimitedJd.map((p) => p.name).join(', ')} không giới hạn tin.`);
  }
  bits.push('Enterprise không niêm yết — báo giá theo hợp đồng.');
  return bits.join(' ');
}

export function sourcingInsight(plans: BillingSourcingPlanView[]): string {
  const sorted = [...plans].sort((a, b) => a.serviceScope.length - b.serviceScope.length);
  const slim = sorted[0];
  const full = sorted[sorted.length - 1];
  if (!slim || !full) return `✓ / ✗ theo đúng hạng mục ${PRICING_BRAND} thực hiện ở từng gói.`;
  if (slim.id === full.id) {
    return `${slim.name}: ${PRICING_BRAND} làm ${slim.serviceScope.length} hạng mục đã cấu hình.`;
  }
  return `${slim.name} — ${PRICING_BRAND} tìm & lọc (${slim.serviceScope.length} hạng mục). ${full.name} — theo sát đến khi tuyển (${full.serviceScope.length} hạng mục). Không tick hạng mục gói chưa bán.`;
}

export function creditInsight(topups: BillingCreditTopupView[]): string {
  if (topups.length < 2) return 'Mua Credit khi cần. Hệ thống không tự trừ thêm khi hết.';
  const byUnit = [...topups].sort((a, b) => Number(BigInt(a.unitPriceVnd) - BigInt(b.unitPriceVnd)));
  const cheapest = byUnit[0];
  const dearest = byUnit[byUnit.length - 1];
  if (!cheapest || !dearest || cheapest.id === dearest.id) {
    return 'Đơn giá / lượt = giá gói ÷ số Credit. Không tự động mua thêm.';
  }
  const max = Number(BigInt(dearest.unitPriceVnd));
  const min = Number(BigInt(cheapest.unitPriceVnd));
  const pct = max > 0 ? Math.round(((max - min) / max) * 100) : 0;
  return `Mua nhiều thì rẻ hơn: ${cheapest.name} thấp hơn ${pct}% / lượt so với ${dearest.name}. Credit mua từ Top-up có giá trị vô thời hạn, được bảo lưu khi hết hạn gói.`;
}

function staticCell(text: string): CompareCell {
  const value = text.trim();
  if (value === 'Có' || value === '✓') return { kind: 'flag', yes: true };
  if (value === 'Không' || value === '✗') return { kind: 'flag', yes: false };
  return { kind: 'text', text: value || '—' };
}

function panelFromSaved(
  saved: BillingCompareTable | null | undefined,
  fallback: {
    columns: { id: string; code: string; name: string; featured: boolean }[];
    rows: CompareRow[];
    insight: string;
  },
) {
  if (!saved || saved.columns.length === 0) return { ...fallback, custom: false };
  return {
    columns: saved.columns.map((name, index) => ({
      id: `c-${index}`,
      code: `c-${index}`,
      name,
      featured: false,
    })),
    rows: saved.rows.map((row) => ({
      label: row.label,
      cells: saved.columns.map((_, index) => staticCell(row.cells[index] ?? '')),
    })),
    insight: saved.insight.trim(),
    custom: true,
  };
}

function CompareFlag({ yes, compact = false }: { yes: boolean; compact?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center justify-center', compact ? '' : 'mx-auto')}>
      {yes ? (
        <Check className={compact ? 'h-3.5 w-3.5 shrink-0 text-emerald-500' : 'h-4 w-4 text-emerald-500'} aria-hidden="true" />
      ) : (
        <X className={compact ? 'h-3.5 w-3.5 shrink-0 text-rose-500' : 'h-4 w-4 text-rose-500'} aria-hidden="true" />
      )}
      <span className="sr-only">{yes ? 'Có hỗ trợ' : 'Không hỗ trợ'}</span>
    </span>
  );
}

function CompareCellView({ cell }: { cell: CompareCell }) {
  if (cell.kind === 'flag') {
    return <CompareFlag yes={cell.yes} />;
  }
  if (cell.kind === 'hook') {
    return (
      <span className="text-[12px] font-semibold leading-snug text-[#072348]">{cell.text}</span>
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
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_32px_-16px_rgba(7,35,72,0.12)]">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Bảng so sánh chi tiết thông số và quyền lợi các gói tuyển dụng công nghiệp trên inlink.vn
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-[#072348] text-white">
                <th
                  className="w-[24%] px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-300"
                  scope="col"
                >
                  Tiêu chí đối chiếu
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className={clsx(
                      'px-4 py-4 text-center align-middle',
                      col.featured
                        ? 'bg-gradient-to-b from-amber-500/25 to-amber-500/10 text-amber-300'
                        : 'text-white',
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {col.featured ? (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#072348]">
                          Đề xuất
                        </span>
                      ) : null}
                      <span className="text-xs font-bold uppercase tracking-wide">{col.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, ri) => {
                const isPriceRow = row.autoKey === 'price' || row.autoKey === 'fee';
                const isHookRow = row.autoKey === 'hook';
                return (
                  <tr
                    key={`${row.label}-${ri}`}
                    className={clsx(
                      'transition-colors hover:bg-slate-50/90',
                      isPriceRow
                        ? 'bg-slate-50/80 font-semibold'
                        : ri % 2 === 0
                          ? 'bg-white'
                          : 'bg-slate-50/35',
                    )}
                  >
                    <th
                      scope="row"
                      className={clsx(
                        'px-5 py-3.5 text-left text-[13px]',
                        isPriceRow || isHookRow
                          ? 'font-bold text-[#072348]'
                          : 'font-medium text-slate-700',
                      )}
                    >
                      {row.label}
                    </th>
                    {row.cells.map((cell, ci) => (
                      <td
                        key={columns[ci]?.id ?? ci}
                        className={clsx(
                          'px-4 py-3.5 text-center align-middle',
                          featured[ci]
                            ? 'border-x border-amber-200/50 bg-amber-50/40'
                            : '',
                        )}
                      >
                        <CompareCellView cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:hidden">
        {columns.map((col, idx) => (
          <div
            key={col.id}
            className={clsx(
              'rounded-2xl border p-5 shadow-sm',
              col.featured
                ? 'border-amber-300 bg-gradient-to-b from-amber-50/70 to-white'
                : 'border-slate-200 bg-white',
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold uppercase text-[#072348]">{col.name}</h3>
              {col.featured ? (
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#072348]">
                  Đề xuất
                </span>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {rows.map((row, rowIndex) => {
                const cell = row.cells[idx];
                if (!cell) return null;
                return (
                  <div
                    key={row.autoKey ?? `${row.label}-${rowIndex}`}
                    className="flex items-start justify-between gap-3 border-b border-slate-100/70 pb-1.5 text-xs last:border-b-0 last:pb-0"
                  >
                    <span className="text-slate-500">{row.label}</span>
                    {cell.kind === 'flag' ? (
                      <CompareFlag yes={cell.yes} compact />
                    ) : (
                      <span
                        className={clsx(
                          'max-w-[58%] text-right leading-snug',
                          cell.kind === 'hook'
                            ? 'font-semibold text-[#072348]'
                            : 'font-medium text-slate-700',
                        )}
                      >
                        {cell.text}
                      </span>
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
  flush = false,
}: {
  platformPlans: BillingPlatformPlanView[];
  sourcingPlans: BillingSourcingPlanView[];
  topups: BillingCreditTopupView[];
  currency: BillingCurrencyDisplay;
  page: BillingPageContentView;
  flush?: boolean;
}) {
  const [tab, setTab] = useState<CompareTab>('platform');
  const platform = platformPlans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const sourcing = sourcingPlans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const credit = topups.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const hasExplicitFeaturedPlatform = platform.some((p) => p.isFeatured);

  const tabs = [
    ['platform', page.platformTitle],
    ['sourcing', page.sourcingTitle],
    ['credit', page.creditTitle],
  ] as const;

  const saved = page.compareTables ?? null;
  const panels = [
    panelFromSaved(saved?.platform, {
      columns: platform.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        featured: hasExplicitFeaturedPlatform ? Boolean(p.isFeatured) : p.code === 'TIN_DANG_PLUS',
      })),
      rows: buildPlatformRows(platform, currency),
      insight: platformInsight(platform),
    }),
    panelFromSaved(saved?.sourcing, {
      columns: sourcing.map((p) => ({ id: p.id, code: p.code, name: p.name, featured: p.isFeatured })),
      rows: buildSourcingRows(sourcing, currency),
      insight: sourcingInsight(sourcing),
    }),
    panelFromSaved(saved?.credit, {
      columns: credit.map((t) => ({
        id: t.id,
        code: creditColumnCode(t),
        name: t.name,
        featured: t.isFeatured || Boolean(t.badge),
      })),
      rows: buildCreditRows(credit, currency),
      insight: creditInsight(credit),
    }),
  ].map((panel, index) => ({ ...panel, id: (['platform', 'sourcing', 'credit'] as const)[index] }));

  return (
    <section
      id="compare"
      aria-labelledby="compare-title"
      className={flush ? 'scroll-mt-20' : 'scroll-mt-20 border-t border-slate-200/80 bg-white py-14 sm:py-20'}
    >
      <div
        className={
          flush
            ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'
            : 'mx-auto max-w-7xl px-4 sm:px-6'
        }
      >
        <div className="mb-6 text-center">
          <h2
            id="compare-title"
            className="inline-flex items-center justify-center gap-2 text-2xl font-bold text-[#072348] sm:text-3xl"
          >
            <BarChart3 className="h-6 w-6 text-[#E8872A]" aria-hidden="true" />
            {page.compareTitle}
            <span className="sr-only">{PRICING_HEADING_CONTEXT}</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">{page.compareSubtitle}</p>
        </div>

        <div
          className="mb-6 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="So sánh theo nhóm gói"
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                'rounded-xl px-4 py-2 text-sm font-semibold transition',
                tab === id
                  ? 'bg-[#072348] text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-[#072348]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {panels.map((panel) => (
          <div key={panel.id} hidden={tab !== panel.id} aria-hidden={tab !== panel.id}>
            {panel.insight ? (
              <p className="mx-auto mb-6 max-w-3xl rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-center text-xs leading-relaxed text-slate-600 sm:text-sm">
                {panel.insight}
              </p>
            ) : null}
            {panel.columns.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                {panel.custom ? 'Chưa có nội dung so sánh.' : 'Chưa có gói đang bật để so sánh.'}
              </p>
            ) : (
              <>
                <CompareMatrix
                  columns={panel.columns}
                  featured={panel.columns.map((c) => c.featured)}
                  rows={panel.rows}
                />
                <p className="mt-4 text-center text-[11px] text-slate-400">
                  {panel.custom
                    ? 'Nội dung bảng được hiển thị theo cấu hình bảng so sánh từ quản trị viên.'
                    : 'Bảng đối chiếu tự động đồng bộ theo giá, hạn mức và quyền lợi đang bật của từng gói.'}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
