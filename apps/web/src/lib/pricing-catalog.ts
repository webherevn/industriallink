import type {
  BillingPageContentView,
  BillingPlatformPlanView,
  BillingPublicConfig,
} from '@industriallink/contracts';

/** Một dòng trên thẻ gói tin. Tick = Bao gồm, bỏ tick = Không bao gồm. */
export type PlatformFeatureLine = { label: string; included: boolean };

function isPlatformFeatureLine(item: unknown): item is PlatformFeatureLine {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return typeof row.label === 'string' && typeof row.included === 'boolean';
}

/** Null khi dữ liệu còn là danh sách chữ cũ — trang giữ dòng mặc định. */
export function readPlatformFeatureLines(raw: unknown): PlatformFeatureLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (!raw.every(isPlatformFeatureLine)) return null;
  const lines = raw
    .map((item) => ({ label: item.label.trim(), included: item.included }))
    .filter((item) => item.label.length > 0);
  return lines;
}

/** Tên thương hiệu trên bảng giá. Khớp domain inlink.vn. */
export const PRICING_BRAND = 'inlink';

export const PRICING_HEADING_CONTEXT = ` — bảng giá ${PRICING_BRAND}`;

export function normalizePricingBrand(text: string): string {
  return text.replace(/\biLink\b/g, PRICING_BRAND);
}

function walkBrand(value: unknown): unknown {
  if (typeof value === 'string') return normalizePricingBrand(value);
  if (Array.isArray(value)) return value.map(walkBrand);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = walkBrand(item);
    return out;
  }
  return value;
}

/** Mọi câu CMS trên trang bảng giá dùng cùng tên thương hiệu. */
export function normalizePricingPage(page: BillingPageContentView): BillingPageContentView {
  return walkBrand(page) as BillingPageContentView;
}

/** Cấu hình bảng giá sau khi đã đồng bộ tên thương hiệu và số tin. */
export function normalizePricingConfig(config: BillingPublicConfig): BillingPublicConfig {
  const branded = walkBrand(config) as BillingPublicConfig;
  return {
    ...branded,
    pageContent: branded.pageContent ? normalizePricingPage(branded.pageContent) : branded.pageContent,
    platformPlans: branded.platformPlans.map((plan) => ({
      ...plan,
      description: pricingPlatformFact(plan).description,
    })),
  };
}

/** Câu hạn mức tin dùng chung cho thẻ, bảng so sánh và schema. */
export function platformJobSentence(plan: BillingPlatformPlanView): string {
  const jobs = plan.jobPostQuota;
  if (plan.code === 'ENTERPRISE' || jobs == null) return 'Hạn mức tin theo hợp đồng';
  if (plan.billingUnit === 'per_month') return `Tối đa ${jobs} tin đang hoạt động`;
  if (plan.code === 'KHAM_PHA') return `${jobs} tin thử nghiệm`;
  return `${jobs} tin đăng`;
}

function actionCost(plan: BillingPlatformPlanView, action: string): number | null {
  const row = plan.actionCosts?.find((item) => item.action === action && item.isActive);
  return row ? row.cost : null;
}

/** Dòng thẻ gói khi cài đặt chưa lưu danh sách riêng. */
export function platformFeatureRows(plan: BillingPlatformPlanView): PlatformFeatureLine[] {
  const free = plan.code === 'KHAM_PHA';
  const plus = plan.code === 'TIN_DANG_PLUS';
  const company = plan.code === 'DOANH_NGHIEP';
  const enterprise = plan.code === 'ENTERPRISE';
  const monthly = plan.billingUnit === 'per_month';
  const days = plan.durationDays;
  const credits = plan.creditQuota;
  const openCost = actionCost(plan, 'view_profile');
  const canOpen = enterprise || credits == null || credits > 0;

  return [
    { included: true, label: platformJobSentence(plan) },
    {
      included: true,
      label:
        enterprise || days == null
          ? 'Thời hạn theo hợp đồng'
          : monthly
            ? `Chu kỳ ${days} ngày`
            : `Hiển thị ${days} ngày`,
    },
    {
      included: canOpen,
      label:
        enterprise || credits == null
          ? 'Lượt mở hồ sơ theo hợp đồng'
          : credits > 0
            ? monthly
              ? `${credits} lượt mở hồ sơ / tháng`
              : `${credits} lượt mở hồ sơ tiềm năng`
            : 'Lượt mở hồ sơ tiềm năng',
    },
    { included: plus, label: 'Thêm lượt mở so với Tin đăng' },
    {
      included: canOpen && (openCost == null || openCost > 0),
      label:
        openCost != null && openCost > 0
          ? `Mỗi lượt mở hồ sơ tốn ${openCost} Credit`
          : 'Mở hồ sơ tiềm năng không tốn Credit',
    },
    { included: !free, label: 'Hồ sơ ứng tuyển không tốn lượt' },
    { included: true, label: 'Tổng Matching không tốn lượt' },
    { included: !free, label: 'Mở lại hồ sơ đã xem không tốn lượt' },
    { included: true, label: 'Phân tích JD bằng AI' },
    { included: true, label: 'Sửa tiêu chí JD' },
    { included: company, label: 'Tin đóng hoặc nháp không tính hạn mức' },
    { included: enterprise, label: 'Hỗ trợ triển khai riêng' },
  ];
}

/** Dòng đang hiện trên thẻ: bản đã lưu, hoặc dòng mặc định. */
export function displayFeatureLines(plan: BillingPlatformPlanView): PlatformFeatureLine[] {
  return readPlatformFeatureLines(plan.features) ?? platformFeatureRows(plan);
}

export type PlatformHighlightStat = { label: string; value: string; hint?: string };

function quotaStat(value: number | null, empty: string, hint?: string): { value: string; hint?: string } {
  if (value == null) return { value: empty, hint };
  return { value: String(value) };
}

/** Bốn thông số nổi trên thẻ gói tin. Số lấy từ cài đặt SuperAdmin, không lấy từ câu mô tả. */
export function platformHighlightStats(plan: BillingPlatformPlanView): PlatformHighlightStat[] {
  const enterprise = plan.code === 'ENTERPRISE';
  const jobs = quotaStat(plan.jobPostQuota, enterprise ? 'HĐ' : '∞', enterprise ? 'Theo hợp đồng' : 'Không giới hạn');
  const opens = quotaStat(plan.creditQuota, 'HĐ', 'Theo hợp đồng');
  const days = quotaStat(plan.durationDays, enterprise ? 'HĐ' : '∞', enterprise ? 'Theo hợp đồng' : 'Không giới hạn');
  const openCost = actionCost(plan, 'view_profile');
  return [
    { label: 'Số tin', ...jobs },
    { label: 'Lượt mở', ...opens },
    { label: 'Số ngày', ...days },
    {
      label: 'Credit/lượt',
      value: openCost == null ? '—' : String(openCost),
      hint: openCost == null ? 'Chưa đặt' : 'Credit cho mỗi lượt mở hồ sơ',
    },
  ];
}

/** Cụm số tin trong điểm nhấn bảng so sánh. */
export function platformJobCountLabel(plan: BillingPlatformPlanView): string {
  if (plan.code === 'ENTERPRISE' || plan.jobPostQuota == null) return 'Không giới hạn tin';
  return `${plan.jobPostQuota} tin`;
}

function alignPlatformCounts(text: string, plan: BillingPlatformPlanView): string {
  let out = text;
  const jobs = plan.code === 'ENTERPRISE' ? null : plan.jobPostQuota;
  const days = plan.durationDays;
  if (jobs != null) {
    out = out.replace(/(\d+)\s*(tin|jd)\b/gi, (full, count: string, unit: string) => {
      if (Number(count) === jobs) return full;
      const word = /^jd$/i.test(unit) ? 'tin' : unit;
      return `${jobs} ${word}`;
    });
  }
  if (days != null) {
    out = out.replace(/(\d+)\s*ngày/gi, (full, count: string) =>
      Number(count) === days ? full : `${days} ngày`,
    );
  }
  return out;
}

function fallbackPlatformDescription(plan: BillingPlatformPlanView): string {
  if (plan.code === 'ENTERPRISE' || plan.jobPostQuota == null) {
    return 'Báo giá riêng. Hạn mức tin và lượt mở theo hợp đồng.';
  }
  const days = plan.durationDays ? ` trong ${plan.durationDays} ngày` : '';
  if (plan.code === 'KHAM_PHA') {
    return `Dùng thử ${plan.durationDays ?? 14} ngày, tối đa ${plan.jobPostQuota} tin. Không tự chuyển sang gói trả phí.`;
  }
  if (plan.billingUnit === 'per_month') {
    const credits =
      plan.creditQuota == null
        ? 'lượt mở theo hợp đồng'
        : `${plan.creditQuota} lượt mở hồ sơ dùng chung mỗi tháng`;
    return `${platformJobSentence(plan)}${days}, ${credits}.`;
  }
  const credits =
    plan.creditQuota == null ? '' : `, ${plan.creditQuota} lượt mở hồ sơ tiềm năng`;
  return `${plan.jobPostQuota} tin${days}${credits}.`;
}

export type PricingPlatformFact = {
  id: string;
  code: string;
  name: string;
  brand: typeof PRICING_BRAND;
  description: string;
  jobSentence: string;
  jobCountLabel: string;
  jobPostQuota: number | null;
  durationDays: number | null;
  creditQuota: number | null;
  /** Giá bán đang hiển thị, VND nguyên. Null khi báo giá theo hợp đồng. */
  sellingPriceVnd: string | null;
};

function sellingPriceVnd(plan: BillingPlatformPlanView): string | null {
  if (plan.code === 'ENTERPRISE') return null;
  if (plan.promoPercent && plan.promoPercent > 0 && plan.promoPriceVnd && plan.promoPriceVnd !== plan.priceVnd) {
    return plan.promoPriceVnd;
  }
  return plan.priceVnd;
}

/** Một bản ghi gói nền tảng cho thẻ, bảng và JSON-LD. */
export function pricingPlatformFact(plan: BillingPlatformPlanView): PricingPlatformFact {
  const raw = normalizePricingBrand((plan.description ?? '').trim());
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    brand: PRICING_BRAND,
    description: raw ? alignPlatformCounts(raw, plan) : fallbackPlatformDescription(plan),
    jobSentence: platformJobSentence(plan),
    jobCountLabel: platformJobCountLabel(plan),
    jobPostQuota: plan.code === 'ENTERPRISE' ? null : plan.jobPostQuota,
    durationDays: plan.durationDays,
    creditQuota: plan.creditQuota ?? null,
    sellingPriceVnd: sellingPriceVnd(plan),
  };
}

function payableVnd(list: string, percent?: number | null, sale?: string | null): string {
  if (percent && percent > 0 && sale && sale !== list) return sale;
  return list;
}

/** SoftwareApplication + OfferCatalog. Giá là số VND đang bán trên thẻ. */
export function pricingSoftwareApplicationJsonLd(
  config: BillingPublicConfig,
  canonical: string,
  salesMailto: string,
) {
  const offers: Record<string, unknown>[] = [];

  for (const plan of config.platformPlans.filter((item) => item.isActive)) {
    const fact = pricingPlatformFact(plan);
    offers.push({
      '@type': 'Offer',
      name: fact.name,
      category: 'Gói nền tảng',
      description: `${fact.description} Số tin: ${fact.jobSentence}.`,
      url: fact.sellingPriceVnd == null ? salesMailto : canonical,
      availability:
        fact.sellingPriceVnd == null
          ? 'https://schema.org/ContactSupplier'
          : 'https://schema.org/InStock',
      ...(fact.sellingPriceVnd == null
        ? {}
        : { price: fact.sellingPriceVnd, priceCurrency: 'VND' }),
    });
  }

  for (const plan of config.sourcingPlans.filter((item) => item.isActive)) {
    offers.push({
      '@type': 'Offer',
      name: plan.name,
      category: 'Gói Săn',
      description: normalizePricingBrand(plan.description ?? plan.name),
      url: canonical,
      price: payableVnd(plan.feeVnd, plan.promoPercent, plan.promoPriceVnd),
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
    });
  }

  for (const topup of config.creditTopups.filter((item) => item.isActive)) {
    offers.push({
      '@type': 'Offer',
      name: topup.name,
      category: 'Top-up Credit',
      description: `${topup.creditCount} lượt mở hồ sơ`,
      url: canonical,
      price: topup.priceVnd,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PRICING_BRAND,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: canonical,
    offers: {
      '@type': 'OfferCatalog',
      name: 'Bảng giá tuyển dụng inlink',
      itemListElement: offers,
    },
  };
}
