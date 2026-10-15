/**
 * View types cho module Billing — serialize BigInt thành string.
 * Dùng cho response API (JSON-safe).
 */

/** Hành động trừ Credit có thể cấu hình theo từng gói (không gồm grant/adjust thủ công). */
export type BillingPlanBillableAction =
  | 'view_profile'
  | 'reopen_profile'
  | 'view_applicant'
  | 'contact_potential'
  | 'contact_applicant'
  | 'view_match_summary';

export const BILLING_PLAN_BILLABLE_ACTIONS: readonly BillingPlanBillableAction[] = [
  'view_profile',
  'reopen_profile',
  'view_applicant',
  'contact_potential',
  'contact_applicant',
  'view_match_summary',
] as const;

export const BILLING_PLAN_ACTION_LABELS: Record<BillingPlanBillableAction, string> = {
  view_profile: 'Mở hồ sơ tiềm năng',
  reopen_profile: 'Mở lại hồ sơ đã xem',
  view_applicant: 'Xem ứng viên đã ứng tuyển',
  contact_potential: 'Liên hệ ứng viên tiềm năng',
  contact_applicant: 'Liên hệ ứng viên đã ứng tuyển',
  view_match_summary: 'Xem tổng Matching',
};

export interface BillingPlanActionCostView {
  action: BillingPlanBillableAction;
  cost: number;
  isActive: boolean;
}

export interface BillingPlatformPlanView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** VND integer, serialize thành string. */
  priceVnd: string;
  billingUnit: 'per_jd' | 'per_month';
  durationDays: number | null;
  jobPostQuota: number | null;
  creditQuota: number | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  features: string[];
  /** Cost-per-action của gói; thiếu action → UI/backend fallback policy global. */
  actionCosts: BillingPlanActionCostView[];
  createdAt: string;
  updatedAt: string;
}

export interface BillingCompanyPlanView {
  id: string;
  companyId: string;
  planId: string;
  planCode: string;
  planName: string;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  note: string | null;
  updatedAt: string;
}

export interface BillingSourcingPlanView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** VND integer, serialize thành string. */
  feeVnd: string;
  positionQuota: number | null;
  searchRoundQuota: number | null;
  shortlistQuota: number | null;
  revisionQuota: number | null;
  serviceScope: string[];
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BillingCreditTopupView {
  id: string;
  name: string;
  creditCount: number;
  /** VND integer, serialize thành string. */
  priceVnd: string;
  /** VND/credit, serialize thành string. */
  unitPriceVnd: string;
  badge: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BillingCreditPolicyView {
  id: string;
  scope: string;
  costPerProfile: number;
  costPerReopen: number;
  costPerApplicant: number;
  costPerContactPotential: number;
  costPerContactApplicant: number;
  costPerMatchSummary: number;
  allowAutoPurchase: boolean;
  /** VND integer hoặc null, serialize thành string | null. */
  defaultBudgetVnd: string | null;
  warnWhenBelowPercent: number;
  allowBudgetOverspend: boolean;
  expireWhenInactive: boolean;
  inactiveDays: number | null;
  allowRefund: boolean;
  updatedAt: string;
}

export interface BillingCurrencyDisplay {
  id: string;
  scope: string;
  currencyCode: string;
  displaySymbol: string;
  symbolBefore: boolean;
  useThousandsSeparator: boolean;
  thousandsSeparator: string;
  decimalDigits: number;
  showReferenceUsd: boolean;
  referenceUsdRate: string | null;
  usdToVndRateHundredths: string | null;
  updatedAt: string;
}

export interface BillingAdminAuditLogView {
  id: string;
  entity: string;
  entityKey: string;
  action: string;
  diff: Record<string, unknown>;
  actorId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

// =========================================================================
// CREDIT LEDGER
// =========================================================================

/** Loại giao dịch Credit. */
export type CreditTransactionType = 'deduct' | 'grant' | 'topup' | 'refund' | 'adjustment';

/** Hành động gây ra giao dịch Credit. */
export type CreditAction =
  | 'view_profile'
  | 'reopen_profile'
  | 'view_applicant'
  | 'contact_potential'
  | 'contact_applicant'
  | 'view_match_summary'
  | 'manual_grant'
  | 'manual_adjust'
  | 'plan_grant';

/** View model: BillingCreditAccount. */
export interface BillingCreditAccountView {
  id: string;
  tenantId: string;
  companyId: string;
  balance: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
  lifetimeRefunded: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** View model: BillingCreditTransaction. */
export interface BillingCreditTransactionView {
  id: string;
  tenantId: string;
  companyId: string;
  accountId: string;
  type: CreditTransactionType;
  action: CreditAction;
  creditDelta: number;
  balanceAfter: number;
  costPerUnit: number;
  quantity: number;
  candidateId: string | null;
  jobId: string | null;
  connectionId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  policySnapshot: Record<string, unknown> | null;
  note: string | null;
  metadata: Record<string, unknown>;
  enforced: boolean;
  createdAt: string;
}

/** Phân trang danh sách transaction. */
export interface BillingCreditLedgerListResponse {
  items: BillingCreditTransactionView[];
  total: number;
}

/** Daily series entry for charts. */
export interface BillingCreditDailySeries {
  date: string; // YYYY-MM-DD
  total: number;
}

/** Top company entry. */
export interface BillingCreditTopCompany {
  companyId: string;
  total: number;
}

/** By-action breakdown entry. */
export interface BillingCreditByAction {
  action: CreditAction;
  total: number;
}

/** Summary dashboard cho admin. */
export interface BillingCreditSummary {
  totalAccounts: number;
  totalBalance: number;
  totalConsumedAllTime: number;
  totalConsumedLast7d: number;
  totalConsumedLast30d: number;
  totalConsumedToday: number;
  topCompanies: BillingCreditTopCompany[];
  dailySeries: BillingCreditDailySeries[];
  byAction: BillingCreditByAction[];
}

/** Số dư credit của recruiter. */
export interface RecruiterCreditBalanceResponse {
  balance: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
  lifetimeRefunded: number;
}

/** Recruiter: 30 ngày summary. */
export interface RecruiterCreditSummaryResponse {
  totalConsumed30d: number;
  byAction: { action: string; total: number }[];
  dailySeries: { date: string; total: number }[];
}

/** Hạn mức gói + số dư thực tế của công ty NTD. */
export interface RecruiterBillingEntitlements {
  plan: BillingCompanyPlanView | null;
  planCode: string | null;
  planName: string | null;
  creditQuota: number | null;
  jobPostQuota: number | null;
  credits: RecruiterCreditBalanceResponse;
  jobsUsed: number;
  /** null = không giới hạn. */
  jobsRemaining: number | null;
  /** Số ngày tin được hiển thị (durationDays SuperAdmin). */
  jobDisplayDays: number | null;
  actionCosts: BillingPlanActionCostView[];
  enforcement: 'log' | 'enforce';
}

// =========================================================================
// PAYMENT (Bước 7)
// =========================================================================

export type PaymentMode = 'mock' | 'live';

export interface BillingPaymentSettingView {
  mode: PaymentMode;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  publishableKeyPreview: string | null;
  secretKeyPreview: string | null;
  webhookSecretPreview: string | null;
  successUrl: string;
  cancelUrl: string;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

export interface UpdatePaymentSettingsRequest {
  mode?: PaymentMode;
  /** Plaintext — service sẽ encrypt. Để trống = giữ nguyên. */
  stripePublishableKey?: string | null;
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentCheckoutResponse {
  orderId: string;
  sessionId: string;
  /** URL để client redirect (Stripe Checkout URL hoặc local mock page). */
  url: string;
  mode: PaymentMode;
}

export interface BillingOrderView {
  id: string;
  companyId: string;
  topupId: string;
  creditCountSnapshot: number;
  /** BigInt → string để JSON an toàn. */
  priceVndSnapshot: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  provider: 'stripe' | 'stripe-mock';
  providerSessionId: string | null;
  providerPaymentIntent: string | null;
  createdByEmail: string | null;
  createdAt: string;
  paidAt: string | null;
  failedAt: string | null;
  note: string | null;
}

export interface RecruiterOrderListResponse {
  items: BillingOrderView[];
  total: number;
}

export interface RecruiterCreateCheckoutRequest {
  topupId: string;
}

// =========================================================================
// PAGE CONTENT (/bang-gia — SEO, copy, FAQ, liên hệ)
// =========================================================================

export interface BillingPageTextItem {
  title: string;
  desc: string;
}

export interface BillingPageFaqItem {
  q: string;
  a: string;
}

/** Nội dung marketing / SEO trang bảng giá. Không gồm giá-quota của gói. */
export interface BillingPageContentView {
  seoTitle: string;
  seoDescription: string;
  seoTitleRecruiter: string;
  seoDescriptionRecruiter: string;
  focusKeyword: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  ogImageAlt: string;
  robotsIndex: boolean;
  robotsFollow: boolean;

  heroBadge: string;
  heroHeading: string;
  heroHeadingAccent: string;
  heroSubtitle: string;
  heroSocialProof: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;

  recruiterKicker: string;
  recruiterHeading: string;
  recruiterSubtitle: string;

  platformTitle: string;
  platformSubtitle: string;
  sourcingTitle: string;
  sourcingSubtitle: string;
  creditTitle: string;
  creditSubtitle: string;
  featuresTitle: string;
  featuresSubtitle: string;
  compareTitle: string;
  compareSubtitle: string;
  howTitle: string;
  howSubtitle: string;
  howFooter: string;
  faqTitle: string;
  faqSubtitle: string;
  contactTitle: string;
  contactSubtitle: string;
  finalCtaTitle: string;
  finalCtaSubtitle: string;
  footerTagline: string;
  consultNavText: string;

  contactEmail: string;
  contactEmailDesc: string;
  contactHotline: string;
  contactHotlineHref: string;
  contactHotlineDesc: string;
  contactZaloLabel: string;
  contactZaloHref: string;
  contactZaloDesc: string;

  features: BillingPageTextItem[];
  howSteps: BillingPageTextItem[];
  faqItems: BillingPageFaqItem[];
  trustItems: BillingPageTextItem[];
  updatedAt: string;
}

export const DEFAULT_BILLING_PAGE_FEATURES: BillingPageTextItem[] = [
  {
    title: 'AI Matching thông minh',
    desc: 'Thuật toán AI phân tích JD, tìm ứng viên phù hợp. Matching chính xác, tiết kiệm 70% thời gian sàng lọc.',
  },
  {
    title: 'Tạo JD từ template',
    desc: 'Template chuẩn công nghiệp, điền thông tin và nhận JD hoàn chỉnh chỉ trong 3 phút.',
  },
  {
    title: 'Mở hồ sơ tiềm năng',
    desc: 'Dùng Credit để mở hồ sơ ứng viên tiềm năng. Không auto-charge, chủ động kiểm soát chi phí.',
  },
  {
    title: 'Nhiều user cùng dùng',
    desc: 'Gói Doanh nghiệp & Enterprise hỗ trợ nhiều tài khoản nhà tuyển dụng cùng lúc.',
  },
  {
    title: 'Báo cáo hiệu quả',
    desc: 'Dashboard thống kê views, ứng tuyển, matching rate. Theo dõi ROI tuyển dụng dễ dàng.',
  },
  {
    title: 'Top-up Credit linh hoạt',
    desc: 'Mua Credit theo nhu cầu thực tế. Đơn giá giảm khi mua nhiều. Không hết hạn khi tài khoản còn hoạt động.',
  },
];

export const DEFAULT_BILLING_PAGE_HOW_STEPS: BillingPageTextItem[] = [
  {
    title: 'Chọn gói phù hợp',
    desc: 'Từ gói miễn phí Khám phá đến Enterprise — chọn gói phù hợp quy mô và nhu cầu tuyển dụng của bạn.',
  },
  {
    title: 'Đăng JD & Matching AI',
    desc: 'Tạo JD bằng template hoặc paste nội dung. AI sẽ tự động phân tích và matching ứng viên phù hợp.',
  },
  {
    title: 'Mua thêm Credit khi cần',
    desc: 'Mở hồ sơ ứng viên tiềm năng bằng Credit. Mua thêm bất kỳ lúc nào, đơn giá giảm theo số lượng.',
  },
];

export const DEFAULT_BILLING_PAGE_FAQ: BillingPageFaqItem[] = [
  {
    q: 'Giá đã bao gồm VAT chưa?',
    a: 'Giá hiển thị chưa bao gồm VAT 10%. Hoá đơn VAT được xuất theo yêu cầu khi thanh toán.',
  },
  {
    q: 'Tôi có thể đổi từ Tin đăng sang Tin đăng Plus không?',
    a: 'Có. Vào trang quản lý gói, chọn "Nâng cấp" và phần chênh lệch sẽ được tính theo tỉ lệ thời gian còn lại.',
  },
  {
    q: 'Credit mua thêm có hết hạn không?',
    a: 'Theo chính sách hiện tại, Credit không hết hạn khi tài khoản còn hoạt động. Chúng tôi sẽ thông báo trước 30 ngày nếu có thay đổi.',
  },
  {
    q: 'Phí Săn nhân sự có bao gồm Credit không?',
    a: 'Không. Phí Săn (Cơ bản/Tiêu chuẩn/Chuyên sâu) là phí dịch vụ iLink thực hiện. Credit mua riêng theo nhu cầu mở hồ sơ tiềm năng.',
  },
  {
    q: 'iLink có auto-charge Credit khi hết không?',
    a: 'Không. Theo nguyên tắc V1, hệ thống không tự động mua Credit. Bạn chủ động mua khi cần.',
  },
  {
    q: 'Có hỗ trợ thanh toán qua chuyển khoản ngân hàng không?',
    a: 'Có. Doanh nghiệp và Enterprise hỗ trợ chuyển khoản, xuất hoá đơn VAT. Liên hệ sales@inlink.vn để được hỗ trợ.',
  },
];

export const DEFAULT_BILLING_PAGE_TRUST: BillingPageTextItem[] = [
  {
    title: 'Không auto-charge',
    desc: 'Hệ thống không tự động mua Credit. Bạn chủ động quyết định.',
  },
  {
    title: 'Hoá đơn VAT',
    desc: 'Xuất VAT đầy đủ cho doanh nghiệp. Hỗ trợ chuyển khoản.',
  },
  {
    title: 'Hỗ trợ 1-1',
    desc: 'Đội ngũ iLink đồng hành setup, training và tối ưu JD.',
  },
];

export const DEFAULT_BILLING_PAGE_CONTENT: BillingPageContentView = {
  seoTitle: 'Bảng giá dịch vụ — inlink',
  seoDescription:
    'Bảng giá minh bạch cho nhà tuyển dụng: gói Tin đăng, Săn nhân sự và Top-up Credit. Không auto-charge, không phát sinh.',
  seoTitleRecruiter: 'Bảng giá dành cho nhà tuyển dụng — inlink Recruiter',
  seoDescriptionRecruiter:
    'Gói Tin đăng, Tin đăng Plus, Doanh nghiệp, Enterprise. Dịch vụ Săn nhân sự. Top-up Credit. Minh bạch, không auto-charge.',
  focusKeyword: null,
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  ogImageAlt: 'Bảng giá inlink',
  robotsIndex: true,
  robotsFollow: true,
  heroBadge: 'Bảng giá 2026',
  heroHeading: 'Tuyển dụng công nghiệp',
  heroHeadingAccent: 'minh bạch, không phát sinh',
  heroSubtitle:
    'iLink giúp nhà tuyển dụng đăng tin, matching AI, mở hồ sơ tiềm năng chỉ với vài cú click. Không auto-charge, không phí ẩn.',
  heroSocialProof: 'Được 50+ doanh nghiệp FDI tin dùng',
  heroCtaPrimary: 'Bắt đầu miễn phí',
  heroCtaSecondary: 'Xem cách tính phí',
  recruiterKicker: 'Tài khoản / Bảng giá',
  recruiterHeading: 'Chọn gói phù hợp, nâng cấp bất kỳ lúc nào',
  recruiterSubtitle: 'Tất cả gói dùng được ngay sau khi thanh toán. Hoá đơn VAT cho doanh nghiệp.',
  platformTitle: 'Gói nền tảng',
  platformSubtitle: 'Tự tuyển dụng với AI Matching. Quản lý JD, ứng viên, mở hồ sơ tiềm năng.',
  sourcingTitle: 'Gói Săn nhân sự',
  sourcingSubtitle: 'Đội ngũ iLink trực tiếp tìm kiếm, sàng lọc và đánh giá ứng viên theo JD của bạn.',
  creditTitle: 'Top-up Credit',
  creditSubtitle: 'Mua thêm lượt mở hồ sơ tiềm năng. Đơn giá giảm khi mua nhiều.',
  featuresTitle: 'Tính năng nổi bật',
  featuresSubtitle: 'Tất cả công cụ bạn cần để tuyển dụng công nghiệp hiệu quả.',
  compareTitle: 'So sánh gói',
  compareSubtitle: 'Chọn gói phù hợp với nhu cầu tuyển dụng của bạn.',
  howTitle: 'Chỉ trả cho những gì bạn dùng',
  howSubtitle: 'Quy trình đơn giản, không phí ẩn, không auto-charge.',
  howFooter: 'Tặng Credit khi mua gói — không auto-charge, không phí ẩn.',
  faqTitle: 'Câu hỏi thường gặp',
  faqSubtitle: 'Mọi thắc mắc về giá, gói và Credit.',
  contactTitle: 'Cần tư vấn gói riêng cho doanh nghiệp?',
  contactSubtitle: 'Đội ngũ iLink sẵn sàng hỗ trợ bạn chọn gói phù hợp nhất.',
  finalCtaTitle: 'Sẵn sàng tuyển hiệu quả hơn?',
  finalCtaSubtitle: 'Đăng ký miễn phí hoặc liên hệ sales để được tư vấn gói phù hợp.',
  footerTagline: 'Kết nối nhân tài – Dẫn lối công nghiệp',
  consultNavText: 'Cần tư vấn? Gọi 1900 6868',
  contactEmail: 'sales@inlink.vn',
  contactEmailDesc: 'Phản hồi trong 24h',
  contactHotline: '1900 6868',
  contactHotlineHref: 'tel:19006868',
  contactHotlineDesc: 'T2–T6, 8h–17h',
  contactZaloLabel: 'inlink.vn',
  contactZaloHref: 'https://zalo.me/inlink',
  contactZaloDesc: 'Nhắn tin nhanh',
  features: DEFAULT_BILLING_PAGE_FEATURES,
  howSteps: DEFAULT_BILLING_PAGE_HOW_STEPS,
  faqItems: DEFAULT_BILLING_PAGE_FAQ,
  trustItems: DEFAULT_BILLING_PAGE_TRUST,
  updatedAt: '',
};
