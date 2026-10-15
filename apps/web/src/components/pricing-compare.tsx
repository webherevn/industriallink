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
import { BILLING_PLAN_BILLABLE_ACTIONS } from '@industriallink/contracts';
import { formatPriceVnd } from '@/lib/format-billing';

type CompareTab = 'platform' | 'sourcing' | 'credit';
type CompareCell =
  | { kind: 'text'; text: string }
  | { kind: 'hook'; text: string }
  | { kind: 'flag'; yes: boolean };
type CompareRow = { label: string; cells: CompareCell[] };

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
  if (plan.jobPostQuota == null || plan.jobPostQuota > 1) {
    return `Không giới hạn JD · ${credit}`;
  }
  const days = plan.durationDays ? ` · ${plan.durationDays} ngày` : '';
  return `1 JD${days} · ${credit}`;
}

function platformFit(plan: BillingPlatformPlanView): string {
  if (isEnterprisePlan(plan)) return 'Tập đoàn cần SLA, tích hợp, onboarding riêng';
  if (!hasGiftCredit(plan)) return 'Muốn xem matching trước, chưa cần mở CV';
  if (plan.jobPostQuota == null || plan.jobPostQuota > 1) {
    return 'Tuyển nhiều vị trí, nhiều user cùng tài khoản';
  }
  if (plan.creditQuota != null && plan.creditQuota >= 25) {
    return 'JD cần sàng lọc sâu, mở nhiều hồ sơ';
  }
  return 'Tự tuyển 1 JD, chủ động mở hồ sơ tiềm năng';
}

function sourcingHook(plan: BillingSourcingPlanView): string {
  const n = plan.serviceScope.length;
  const rounds = plan.searchRoundQuota == null ? 'đợt tìm không giới hạn' : `${plan.searchRoundQuota} đợt tìm`;
  if (plan.searchRoundQuota == null || n >= 7) {
    return `Theo sát đến khi tuyển · ${n} hạng mục · ${rounds}`;
  }
  if (n >= 4) {
    const sl = plan.shortlistQuota == null ? 'shortlist linh hoạt' : `shortlist ${plan.shortlistQuota}`;
    return `iLink tìm & chọn · ${sl} · ${rounds}`;
  }
  return `iLink tìm giúp · ${n} hạng mục · ${rounds}`;
}

function sourcingFit(plan: BillingSourcingPlanView): string {
  const n = plan.serviceScope.length;
  if (plan.searchRoundQuota == null || n >= 7) return 'Vị trí then chốt, cần người theo đến khi chốt';
  if (n >= 4) return 'Cần shortlist + phân tích, không chỉ danh sách thô';
  return 'Vị trí dễ, ngân sách gọn, cần iLink tìm hộ';
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

function buildPlatformRows(
  plans: BillingPlatformPlanView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  return [
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
      label: 'Tuyển nhiều JD song song',
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
      label: 'Số JD',
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
  ];
}

const SOURCING_PITCH: { scope: SourcingServiceScope; label: string }[] = [
  { scope: 'ai_match', label: 'iLink dùng AI tìm ứng viên' },
  { scope: 'filter_rank', label: 'Lọc & xếp hạng giúp bạn' },
  { scope: 'shortlist', label: 'Giao shortlist sẵn sàng phỏng vấn' },
  { scope: 'strengths_gaps', label: 'Phân tích điểm mạnh / khoảng thiếu' },
  { scope: 'priority', label: 'Chỉ ra ứng viên ưu tiên' },
  { scope: 'outreach', label: 'Chủ động tiếp cận ứng viên' },
  { scope: 'follow_up', label: 'Theo dõi phản hồi giúp bạn' },
  { scope: 'replacement', label: 'Ứng viên thay thế nếu không chốt' },
];

function buildSourcingRows(
  plans: BillingSourcingPlanView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  return [
    {
      label: 'Điểm nhấn',
      cells: plans.map((p) => ({ kind: 'hook', text: sourcingHook(p) })),
    },
    {
      label: 'Phí / vị trí',
      cells: plans.map((p) => ({ kind: 'text', text: formatPriceVnd(p.feeVnd, currency) })),
    },
    ...SOURCING_PITCH.map(({ scope, label }) => ({
      label,
      cells: plans.map((p) => ({
        kind: 'flag' as const,
        yes: p.serviceScope.includes(scope),
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
  ];
}

function buildCreditRows(
  topups: BillingCreditTopupView[],
  currency: BillingCurrencyDisplay,
): CompareRow[] {
  const units = topups.map((t) => Number(BigInt(t.unitPriceVnd)));
  const maxUnit = units.length ? Math.max(...units) : 0;
  const minUnit = units.length ? Math.min(...units) : 0;

  const maxCount = topups.reduce((m, t) => Math.max(m, t.creditCount), 0);

  return [
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
  ];
}

function platformInsight(plans: BillingPlatformPlanView[]): string {
  const trial = plans.find((p) => !hasPaidPrice(p) && !isEnterprisePlan(p));
  const unlock = plans.filter((p) => planHasAction(p, 'view_profile'));
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
    bits.push(`${unlimitedJd.map((p) => p.name).join(', ')} không giới hạn JD.`);
  }
  bits.push('Enterprise không niêm yết — báo giá theo hợp đồng.');
  return bits.join(' ');
}

function sourcingInsight(plans: BillingSourcingPlanView[]): string {
  const sorted = [...plans].sort((a, b) => a.serviceScope.length - b.serviceScope.length);
  const slim = sorted[0];
  const full = sorted[sorted.length - 1];
  if (!slim || !full) return '✓ / ✗ theo đúng hạng mục iLink thực hiện ở từng gói.';
  if (slim.id === full.id) {
    return `${slim.name}: iLink làm ${slim.serviceScope.length} hạng mục đã cấu hình.`;
  }
  return `${slim.name} — iLink tìm & lọc (${slim.serviceScope.length} hạng mục). ${full.name} — theo sát đến khi tuyển (${full.serviceScope.length} hạng mục). Không tick hạng mục gói chưa bán.`;
}

function creditInsight(topups: BillingCreditTopupView[]): string {
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
  return `Mua nhiều thì rẻ hơn: ${cheapest.name} thấp hơn ${pct}% / lượt so với ${dearest.name}. Không tự động trừ thêm khi hết Credit.`;
}

function CompareCellView({ cell }: { cell: CompareCell }) {
  if (cell.kind === 'flag') {
    return cell.yes ? (
      <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Có" />
    ) : (
      <X className="mx-auto h-4 w-4 text-slate-300" aria-label="Không" />
    );
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
          <>
            <CompareMatrix
              columns={columns}
              featured={columns.map((c) => c.featured)}
              rows={rows}
            />
            <p className="mt-4 text-center text-[11px] text-slate-400">
              ✓ / ✗ lấy từ giá, hạn mức và quyền đang bật của từng gói — đổi cấu hình SuperAdmin là bảng đổi theo.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
