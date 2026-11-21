'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CalendarClock,
  CheckCircle2,
  Cookie,
  Percent,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { CtvCommissionPolicyPublicView, CtvCommissionTierView } from '@industriallink/contracts';
import { fetchMyCommissionPolicy } from '@/lib/ctv-commission';

type PolicyItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  lead: string;
  points: string[];
  tone: string;
};

const POLICIES: PolicyItem[] = [
  {
    id: 'cookie',
    icon: Cookie,
    title: 'Cơ chế Cookie 14 ngày',
    lead:
      'Khi khách hàng mở link giới thiệu của bạn, hệ thống ghi nhận mã CTV trong 14 ngày kể từ lần bấm đầu tiên.',
    points: [
      'Trong 14 ngày, khách đăng ký tài khoản và thanh toán gói — hoa hồng về tài khoản của bạn.',
      'Khách bấm lại link (kể cả link của CTV khác) trong 14 ngày thì mã của bạn vẫn được giữ.',
      'Ngoài 14 ngày, mã CTV của người bấm mới được tính.',
      'Cookie gắn với trình duyệt của khách. Khách xóa cookie hoặc đăng ký từ thiết bị khác thì không ghi nhận.',
    ],
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'tax-lock',
    icon: ScrollText,
    title: 'Cơ chế Khóa MST 30 ngày & tối đa 30 mã',
    lead:
      'Khóa Mã số thuế giúp bạn giữ quyền hoa hồng với doanh nghiệp mà bạn giới thiệu.',
    points: [
      'Mỗi mã số thuế thuộc về một cộng tác viên — không có chuyện hai người cùng giữ một MST.',
      'Mỗi CTV khóa tối đa 30 mã số thuế đang hiệu lực.',
      'Mỗi mã giữ 30 ngày kể từ lúc khóa. Hết hạn thì mã tự nhả và bạn có thể khóa mã mới.',
      'Khóa MST không gán gói, không tính hoa hồng ngay — hoa hồng chỉ ghi khi doanh nghiệp đó thanh toán gói.',
    ],
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    id: 'kyc',
    icon: ShieldCheck,
    title: 'Xác thực CCCD 2 mặt & điều kiện nhận tiền',
    lead:
      'Để nhận hoa hồng qua chuyển khoản ngân hàng, bạn cần hoàn tất xác thực CCCD 2 mặt và khai báo tài khoản ngân hàng.',
    points: [
      'Cần ảnh mặt trước và mặt sau CCCD, chụp rõ 4 góc, không lóa, không che số.',
      'Số CCCD đúng 12 chữ số. Tên chủ tài khoản ngân hàng phải khớp với họ tên trên CCCD.',
      'Ảnh CCCD lưu trong kho riêng tư — chỉ bạn và kế toán CRM có quyền xem, không chia sẻ công khai.',
      'CRM Admin duyệt hồ sơ. Nếu hồ sơ đã xác thực mà bạn sửa thông tin, hồ sơ chuyển về Chờ duyệt lại và kỳ chi trả đang chờ sẽ tạm giữ.',
    ],
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    id: 'payout',
    icon: Percent,
    title: 'Khấu trừ thuế TNCN 10% & lịch chi trả ngày 10',
    lead:
      'Khi khoản chi trả trong một kỳ từ 2.000.000đ trở lên và bạn là cá nhân, Inlink khấu trừ thuế TNCN 10% theo quy định.',
    points: [
      'Khoản chi dưới 2.000.000đ trong kỳ: không khấu trừ thuế.',
      'Khoản chi từ 2.000.000đ trở lên trong kỳ: khấu trừ 10%. Số thực nhận = tổng hoa hồng kỳ − thuế.',
      'Số dư tự động cộng khi khách hàng thanh toán gói và đối soát chuyển khoản ngân hàng vào ngày 10 hàng tháng.',
      'Mã giao dịch / UNC của kỳ chi trả hiển thị ở màn "Ví & Kỳ chi trả" để bạn đối soát.',
    ],
    tone: 'bg-rose-50 text-rose-700',
  },
];

export default function CtvPolicyPage() {
  const policy = useQuery({
    queryKey: ['ctv-commission-policy'],
    queryFn: fetchMyCommissionPolicy,
    retry: false,
  });
  const current = policy.data ?? null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-bold tracking-tight text-[#0F2440]">
          Chính sách & Hướng dẫn cộng tác viên
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Tóm tắt đầy đủ cách Inlink ghi nhận hoa hồng, bảo vệ quyền giới thiệu và chi trả cho bạn.
          Nếu có điểm chưa rõ, hãy liên hệ đội ngũ kinh doanh Inlink.
        </p>
      </section>

      {/* ── Bảng cấp bậc động từ chính sách đang áp dụng ── */}
      <TierTable policy={current} />

      {/* ── Phạm vi áp dụng ── */}
      {current ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#0F2440]">Phạm vi áp dụng hoa hồng</h3>
              <ul className="mt-3 space-y-2.5">
                {current.includeJobPosting ? (
                  <ScopeItem ok>
                    Gói Tin đăng (Tin đăng, Tin đăng Plus, Doanh nghiệp) — mua mới, mua lại, nâng cấp.
                  </ScopeItem>
                ) : null}
                {current.includeHuntPackage ? (
                  <ScopeItem ok>
                    Gói Tin săn (Cơ bản, Tiêu chuẩn, Chuyên sâu) — mua mới, mua lại, nâng cấp.
                  </ScopeItem>
                ) : null}
                <ScopeItem ok={false}>
                  Gói Khám phá (0đ) — không tính hoa hồng.
                </ScopeItem>
                <ScopeItem ok={current.includeCreditTopup}>
                  {current.includeCreditTopup
                    ? 'Nạp thêm Credit — được tính hoa hồng theo chính sách hiện hành.'
                    : 'Nạp thêm Credit — không tính hoa hồng và không cộng vào doanh số xét hạng.'}
                </ScopeItem>
              </ul>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  Cơ sở tính:{' '}
                  <strong className="font-semibold text-slate-700">
                    {current.excludeVat
                      ? 'Doanh thu thực thu chưa VAT, sau chiết khấu'
                      : 'Tổng tiền khách chuyển'}
                  </strong>
                </span>
                <span>
                  Thời hạn khách hàng:{' '}
                  <strong className="font-semibold text-slate-700">
                    Trọn đời (1 KH – 1 CTV)
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Ví dụ minh họa ── */}
      <ExampleBlock policy={current} />

      {POLICIES.map((item) => {
        const Icon = item.icon;
        return (
          <section
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  item.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F2440]">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.lead}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {item.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <XCircle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0F2440]">Những gì KHÔNG tính hoa hồng</h3>
            <ul className="mt-3 space-y-2.5">
              {[
                'Gói Khám phá 0đ — khách không trả tiền nên không sinh hoa hồng.',
                'Nạp thêm Credit — thanh toán riêng, không gắn vào gói dịch vụ có hoa hồng.',
                'Khóa Mã số thuế — chỉ giữ quyền giới thiệu, không gán gói, không tính tiền.',
                'Đơn chưa thanh toán — hoa hồng chỉ ghi khi khách trả đủ.',
                'Đơn bị hủy hoặc hoàn tiền — dòng hoa hồng tương ứng bị loại khỏi kỳ chi trả.',
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700"
                >
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0F2440]">Sẵn sàng nhận hoa hồng?</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Xác thực CCCD & tài khoản ngân hàng để mở cổng chi trả ngày 10 hàng tháng.
            </p>
          </div>
        </div>
        <Link
          href="/ctv/kyc"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#0F2440] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16324f]"
        >
          Xác thực CCCD & Ngân hàng
        </Link>
      </section>
    </div>
  );
}

/** Bảng 3 cấp bậc render động từ chính sách ACTIVE. */
function TierTable({ policy }: { policy: CtvCommissionPolicyPublicView | null }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <TrendingUp className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[#0F2440]">Bảng cấp hoa hồng theo tháng</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {policy
              ? `${policy.name} · Phiên bản ${policy.version} · hiệu lực từ ${formatDate(policy.effectiveFrom)}`
              : 'Đang tải chính sách hoa hồng…'}
          </p>
        </div>
      </div>

      {!policy ? (
        <p className="px-5 py-6 text-sm text-slate-500">Đang tải bảng cấp bậc…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Cấp bậc</th>
                  <th className="px-5 py-3">Doanh số gói / tháng</th>
                  <th className="px-5 py-3 text-right">Tỷ lệ hoa hồng</th>
                </tr>
              </thead>
              <tbody>
                {policy.tiers.map((tier) => (
                  <tr key={tier.code} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-900">{tier.name}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{tierRange(tier)}</td>
                    <td className="px-5 py-3 text-right text-base font-bold text-[#4c3ec9]">
                      {tier.ratePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-5 py-3.5 text-xs leading-relaxed text-slate-500">
            Bậc bạn đạt trong tháng được áp dụng cho <strong className="font-semibold text-slate-700">
              toàn bộ doanh thu hợp lệ của tháng đó</strong> — kể cả các đơn nhỏ hơn. Sang tháng
            mới, bậc tính lại từ 0đ.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Ví dụ minh họa: 9tr Tin săn + 7tr Tin đăng + 6tr Tin săn = 22tr → Bạc 20% = 4.400.000đ.
 * Tính động theo chính sách đang áp dụng.
 */
function ExampleBlock({ policy }: { policy: CtvCommissionPolicyPublicView | null }) {
  if (!policy) return null;

  const parts = [
    { label: 'Gói Tin săn', amount: 9_000_000 },
    { label: 'Gói Tin đăng', amount: 7_000_000 },
    { label: 'Gói Tin săn', amount: 6_000_000 },
  ];
  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  const tier = resolveTier(policy.tiers, total);
  const rate = tier?.ratePercent ?? 0;
  const commission = Math.round((total * rate) / 100);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[#0F2440]">Ví dụ minh họa trong một tháng</h3>
      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        {parts.map((part, index) => (
          <p key={`${part.label}-${index}`}>
            {part.label} <span className="font-medium text-slate-800">{formatVnd(part.amount)}</span>
          </p>
        ))}
        <p className="border-t border-slate-100 pt-1.5 font-medium text-slate-800">
          Tổng doanh số {formatVnd(total)}
        </p>
      </div>
      <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900">
        Đạt cấp <strong>{tier?.name ?? '—'}</strong> ({rate}%) → hoa hồng cả tháng ={' '}
        <strong>{formatVnd(commission)}</strong>. Lưu ý đơn 6.000.000đ cũng được trả ở tỷ lệ {rate}% —
        không phải tỷ lệ riêng của riêng đơn đó.
      </p>
    </section>
  );
}

/** Một dòng phạm vi (✓ tính / ✕ không tính). */
function ScopeItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
      )}
      <span>{children}</span>
    </li>
  );
}

/** Dải doanh số của một bậc, dạng văn bản. */
function tierRange(tier: CtvCommissionTierView): string {
  const min = Number(tier.minMonthlyRevenueVnd);
  const max = tier.maxMonthlyRevenueVnd === null ? null : Number(tier.maxMonthlyRevenueVnd);
  if (max === null) return `Từ ${formatVnd(min)} trở lên`;
  if (min === 0) return `Dưới ${formatVnd(max)}`;
  return `${formatVnd(min)} – dưới ${formatVnd(max)}`;
}

/** Tra bậc theo doanh số — cùng quy tắc với backend. */
function resolveTier(
  tiers: CtvCommissionTierView[],
  revenue: number,
): CtvCommissionTierView | null {
  const sorted = [...tiers].sort((a, b) => Number(a.minMonthlyRevenueVnd) - Number(b.minMonthlyRevenueVnd));
  let fallback: CtvCommissionTierView | null = null;
  for (const tier of sorted) {
    const min = Number(tier.minMonthlyRevenueVnd);
    const max = tier.maxMonthlyRevenueVnd === null ? null : Number(tier.maxMonthlyRevenueVnd);
    if (max === null) {
      fallback = tier;
      if (revenue >= min) return tier;
      continue;
    }
    if (revenue >= min && revenue < max) return tier;
  }
  if (sorted[0] && Number(sorted[0].minMonthlyRevenueVnd) > 0 && revenue < Number(sorted[0].minMonthlyRevenueVnd)) {
    return sorted[0];
  }
  return fallback;
}

/** Định dạng số VND. */
function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

/** Định dạng ngày hiệu lực sang dd/MM/yyyy. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
