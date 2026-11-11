import type {
  BillingPageContentView,
  BillingPlatformPlanView,
  BillingPublicConfig,
  PlatformFeatureLine,
  PlatformPriceMetaItem,
} from '@industriallink/contracts';

/** Một dòng trên thẻ gói tin. Tick = Bao gồm, bỏ tick = Không bao gồm. */
export type { PlatformFeatureLine };

function isPlatformFeatureLine(item: unknown): item is PlatformFeatureLine {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return typeof row.label === 'string' && typeof row.included === 'boolean';
}

function isPriceMetaItem(item: unknown): item is PlatformPriceMetaItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  return typeof (item as { priceMeta?: unknown }).priceMeta === 'string';
}

/** Câu dưới giá đã lưu. Null khi SuperAdmin chưa ghi đè. */
export function readPlatformPriceMeta(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (!isPriceMetaItem(item)) continue;
    const text = item.priceMeta.trim();
    if (text) return text;
  }
  return null;
}

/** Null khi dữ liệu còn là danh sách chữ cũ — trang giữ dòng mặc định. */
export function readPlatformFeatureLines(raw: unknown): PlatformFeatureLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const content = raw.filter((item) => !isPriceMetaItem(item));
  if (content.length === 0 || !content.every(isPlatformFeatureLine)) return null;
  const lines = content
    .map((item) => ({ label: item.label.trim(), included: item.included }))
    .filter((item) => item.label.length > 0);
  return lines.length > 0 ? lines : null;
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
    sourcingPlans: branded.sourcingPlans.map((plan) => ({
      ...plan,
      description: plan.description
        ? plan.description.replace(/(\d+)\s*lượt mở(\s*hồ sơ)?/gi, '$1 Credit')
        : plan.description,
    })),
  };
}

const PRICE_UNIT: Record<'per_jd' | 'per_month', string> = {
  per_jd: '/ JD',
  per_month: '/ tháng',
};

/** Câu dưới giá khi SuperAdmin chưa ghi đè. */
export function defaultPlatformPriceMeta(plan: {
  code: string;
  billingUnit: 'per_jd' | 'per_month';
  durationDays?: number | null;
  jobPostQuota?: number | null;
}): string {
  if (plan.code === 'ENTERPRISE') return 'Theo hợp đồng';
  if (plan.code === 'KHAM_PHA') {
    return `${plan.durationDays ?? 14} ngày · ${platformJobSentence(plan as BillingPlatformPlanView)}`;
  }
  const unit = PRICE_UNIT[plan.billingUnit];
  return plan.durationDays ? `${unit} · ${plan.durationDays} ngày` : unit;
}

/** Câu đang hiện dưới giá: bản đã lưu, hoặc câu tự tính. */
export function platformPriceMetaText(plan: BillingPlatformPlanView): string {
  const saved = readPlatformPriceMeta(plan.features);
  return normalizePricingBrand(saved ?? defaultPlatformPriceMeta(plan));
}

/** Gói dòng thẻ và câu dưới giá vào đúng mảng features API đang lưu. */
export function packPlatformFeatures(
  lines: PlatformFeatureLine[],
  priceMeta: string,
): Array<PlatformFeatureLine | PlatformPriceMetaItem> {
  const clean = lines
    .map((line) => ({ label: line.label.trim(), included: line.included }))
    .filter((line) => line.label.length > 0);
  const text = priceMeta.trim();
  if (!text) return clean;
  return [...clean, { priceMeta: text }];
}

/** Câu hạn mức tin dùng chung cho thẻ, bảng so sánh và schema. */
export function platformJobSentence(plan: BillingPlatformPlanView): string {
  const jobs = plan.jobPostQuota;
  if (plan.code === 'ENTERPRISE') {
    return jobs == null
      ? 'Đăng tin tuyển dụng song song không giới hạn'
      : `Tối đa ${jobs}+ tin tuyển dụng song song`;
  }
  if (jobs == null) return 'Hạn mức tin không giới hạn';
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
  const highMatchCost = actionCost(plan, 'view_profile_high_match');

  if (enterprise) {
    return [
      { included: true, label: platformJobSentence(plan) },
      {
        included: true,
        label:
          credits != null && credits > 0
            ? `Hạn mức ${credits}+ Credit theo quý / năm (đơn giá VIP)`
            : 'Cấp hạn mức Credit lớn theo quý / năm (đơn giá VIP)',
      },
      {
        included: true,
        label:
          days != null && days > 0
            ? `Thời hạn hiển thị tin dài hạn đến ${days} ngày`
            : 'Thời hạn hiển thị tin dài hạn & linh hoạt (đến 365 ngày)',
      },
      { included: true, label: 'Phân tích JD & AI Matching chuyên sâu không giới hạn' },
      { included: true, label: 'Quản lý tuyển dụng tập trung đa chi nhánh / nhiều nhà máy' },
      { included: true, label: 'Chuyên viên AM riêng, cam kết SLA & xuất hoá đơn VAT theo kỳ' },
    ];
  }

  const canOpen = credits == null || credits > 0;
  const openCostLabel =
    openCost != null && openCost > 0
      ? highMatchCost != null && highMatchCost > 0 && highMatchCost !== openCost
        ? `Mở hồ sơ: < 80% Matching tốn ${openCost} Credit, ≥ 80% tốn ${highMatchCost} Credit`
        : `Mỗi lượt mở hồ sơ tốn ${openCost} Credit`
      : 'Mở hồ sơ tiềm năng không tốn Credit';

  return [
    { included: true, label: platformJobSentence(plan) },
    {
      included: true,
      label:
        days == null
          ? 'Thời hạn theo hợp đồng'
          : monthly
            ? `Chu kỳ ${days} ngày`
            : `Hiển thị ${days} ngày`,
    },
    {
      included: canOpen,
      label:
        credits == null
          ? 'Credit mở hồ sơ theo hợp đồng'
          : credits > 0
            ? monthly
              ? `${credits} Credit mở hồ sơ / tháng`
              : `${credits} Credit mở hồ sơ tiềm năng`
            : 'Credit mở hồ sơ tiềm năng',
    },
    { included: plus, label: 'Thêm Credit so với Tin đăng' },
    {
      included:
        canOpen &&
        (openCost == null || openCost > 0 || (highMatchCost != null && highMatchCost > 0)),
      label: openCostLabel,
    },
    { included: !free, label: 'Hồ sơ ứng tuyển không tốn lượt' },
    { included: true, label: 'Tổng Matching không tốn lượt' },
    { included: !free, label: 'Mở lại hồ sơ đã xem không tốn lượt' },
    { included: true, label: 'Phân tích JD bằng AI' },
    { included: true, label: 'Sửa tiêu chí JD' },
    { included: company, label: 'Tin đóng hoặc nháp không tính hạn mức' },
  ];
}

/** Dòng đang hiện trên thẻ: bản đã lưu, hoặc dòng mặc định. */
export function displayFeatureLines(plan: BillingPlatformPlanView): PlatformFeatureLine[] {
  const saved = readPlatformFeatureLines(plan.features);
  if (!saved) return platformFeatureRows(plan);
  const openCost = actionCost(plan, 'view_profile');
  const highMatchCost = actionCost(plan, 'view_profile_high_match');
  const hasDual =
    openCost != null &&
    openCost > 0 &&
    highMatchCost != null &&
    highMatchCost > 0 &&
    highMatchCost !== openCost;
  const dualLabel = `Mở hồ sơ: < 80% Matching tốn ${openCost} Credit, ≥ 80% tốn ${highMatchCost} Credit`;

  if (plan.code === 'ENTERPRISE') {
    const legacyEnterpriseSet = new Set([
      'Số tin tuyển dụng theo thỏa thuận',
      'Số Credit theo thỏa thuận',
      'Báo giá riêng theo nhu cầu',
      'Hạn mức tin và lượt mở theo hợp đồng',
    ]);
    const isLegacyDefault = saved.some((l) => legacyEnterpriseSet.has(l.label.trim()));
    if (isLegacyDefault) {
      return platformFeatureRows(plan);
    }
  }

  return saved.map((line) => {
    const trimmed = line.label.trim();
    if (hasDual && /^Mỗi lượt mở hồ sơ tốn \d+ Credit$/i.test(trimmed)) {
      return { ...line, label: dualLabel };
    }
    const normalized = trimmed
      .replace(/(\d+)\s*lượt mở(\s*hồ sơ)?/gi, '$1 Credit mở hồ sơ')
      .replace(/^Lượt mở hồ sơ/i, 'Credit mở hồ sơ')
      .replace(/^Thêm (\d+\s*)?lượt(\s*mở)? so với Tin đăng$/i, 'Thêm $1Credit so với Tin đăng');
    return normalized !== trimmed ? { ...line, label: normalized } : line;
  });
}

export type PlatformHighlightStat = { label: string; value: string; sub?: string; hint?: string };

function quotaStat(value: number | null, empty: string, hint?: string): { value: string; hint?: string } {
  if (value == null) return { value: empty, hint };
  return { value: String(value) };
}

/** Bốn thông số nổi trên thẻ gói tin. Số lấy từ cài đặt SuperAdmin, không lấy từ câu mô tả. */
export function platformHighlightStats(plan: BillingPlatformPlanView): PlatformHighlightStat[] {
  const enterprise = plan.code === 'ENTERPRISE';
  const openCost = actionCost(plan, 'view_profile');
  const highMatchCost = actionCost(plan, 'view_profile_high_match');
  const hasTieredCost =
    openCost != null &&
    highMatchCost != null &&
    highMatchCost > 0 &&
    highMatchCost !== openCost;

  if (enterprise) {
    return [
      {
        label: 'Số tin',
        value: plan.jobPostQuota == null ? '∞' : `${plan.jobPostQuota}+`,
        sub: plan.jobPostQuota == null ? 'Không giới hạn' : 'Tối đa / HĐ',
        hint:
          plan.jobPostQuota == null
            ? 'Đăng tin tuyển dụng song song không giới hạn'
            : `Từ ${plan.jobPostQuota}+ tin tuyển dụng song song`,
      },
      {
        label: 'Credit',
        value: plan.creditQuota == null ? 'Tối đa' : `${plan.creditQuota}+`,
        sub: 'Theo quy mô',
        hint:
          plan.creditQuota == null
            ? 'Cấp hạn mức Credit lớn theo quy mô tập đoàn & nhà máy'
            : `Từ ${plan.creditQuota}+ Credit mở hồ sơ ưu đãi VIP`,
      },
      {
        label: 'Số ngày',
        value: plan.durationDays == null ? '365' : String(plan.durationDays),
        sub: plan.durationDays == null ? 'Linh hoạt / năm' : 'Linh hoạt / HĐ',
        hint:
          plan.durationDays == null
            ? 'Thời hạn hiển thị tin & hợp đồng dài hạn đến 365 ngày'
            : `Thời hạn hiển thị & chu kỳ linh hoạt đến ${plan.durationDays} ngày`,
      },
      {
        label: 'Credit/lượt',
        value:
          openCost == null
            ? '1'
            : hasTieredCost
              ? `${openCost}–${highMatchCost}`
              : String(openCost),
        sub: hasTieredCost ? 'Ưu đãi mở CV' : 'Ưu đãi VIP',
        hint:
          openCost == null
            ? 'Ưu đãi mở hồ sơ gói Enterprise'
            : hasTieredCost
              ? `< 80% Matching: ${openCost} Credit · ≥ 80% Matching: ${highMatchCost} Credit`
              : `Đặc quyền VIP: mở mọi hồ sơ chỉ tốn ${openCost} Credit`,
      },
    ];
  }

  const jobs = quotaStat(plan.jobPostQuota, '∞', 'Không giới hạn');
  const opens = quotaStat(plan.creditQuota, 'HĐ', 'Theo hợp đồng');
  const days = quotaStat(plan.durationDays, '∞', 'Không giới hạn');
  return [
    { label: 'Số tin', ...jobs },
    { label: 'Credit', ...opens },
    { label: 'Số ngày', ...days },
    {
      label: 'Credit/lượt',
      value:
        openCost == null
          ? '—'
          : hasTieredCost
            ? `${openCost}–${highMatchCost}`
            : String(openCost),
      hint:
        openCost == null
          ? 'Chưa đặt'
          : hasTieredCost
            ? `< 80% Matching: ${openCost} Credit · ≥ 80% Matching: ${highMatchCost} Credit`
            : 'Credit cho mỗi lượt mở hồ sơ',
    },
  ];
}

/** Cụm số tin trong điểm nhấn bảng so sánh. */
export function platformJobCountLabel(plan: BillingPlatformPlanView): string {
  if (plan.code === 'ENTERPRISE') {
    return plan.jobPostQuota == null ? 'Không giới hạn tin' : `${plan.jobPostQuota}+ tin`;
  }
  if (plan.jobPostQuota == null) return 'Không giới hạn tin';
  return `${plan.jobPostQuota} tin`;
}

function alignPlatformCounts(text: string, plan: BillingPlatformPlanView): string {
  let out = text.replace(/(\d+)\s*lượt mở(\s*hồ sơ)?/gi, '$1 Credit');
  const jobs = plan.jobPostQuota;
  const days = plan.durationDays;
  const credits = plan.creditQuota;
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
  if (credits != null) {
    out = out.replace(/(\d+)\s*credit\b/gi, (full, count: string) =>
      Number(count) === credits ? full : `${credits} Credit`,
    );
  }
  return out;
}

function fallbackPlatformDescription(plan: BillingPlatformPlanView): string {
  if (plan.code === 'ENTERPRISE' || plan.jobPostQuota == null) {
    return 'Giải pháp tuyển dụng quy mô lớn với hạn mức tin đăng, Credit và thời hạn tối đa theo hợp đồng.';
  }
  const days = plan.durationDays ? ` trong ${plan.durationDays} ngày` : '';
  if (plan.code === 'KHAM_PHA') {
    return `Dùng thử ${plan.durationDays ?? 14} ngày, tối đa ${plan.jobPostQuota} tin. Không tự chuyển sang gói trả phí.`;
  }
  if (plan.billingUnit === 'per_month') {
    const credits =
      plan.creditQuota == null
        ? 'Credit theo hợp đồng'
        : `${plan.creditQuota} Credit dùng chung mỗi tháng`;
    return `${platformJobSentence(plan)}${days}, ${credits}.`;
  }
  const credits =
    plan.creditQuota == null ? '' : `, ${plan.creditQuota} Credit`;
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
    jobPostQuota: plan.jobPostQuota,
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
