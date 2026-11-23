/**
 * DTO cho module Billing & Pricing Configuration.
 * Public-facing (UI bảng giá) + admin (SuperAdmin CRUD).
 *
 * Contracts dùng TypeScript interface, không dùng zod.
 * BigInt serialize thành string để truyền qua JSON.
 */

import type {
  BillingCurrencyDisplay,
  BillingPlatformPlanView,
  BillingSourcingPlanView,
  BillingCreditTopupView,
  BillingCreditPolicyView,
  BillingAdminAuditLogView,
  BillingCreditAccountView,
  BillingCreditTransactionView,
  BillingPlanActionCostView,
  BillingCompanyPlanView,
  BillingCompanySourcingPlanView,
  BillingPlanBillableAction,
  RecruiterSourcingWorkspace,
  SourcingQuotaKind,
  BillingPageContentView,
  BillingPageTextItem,
  BillingPageFaqItem,
  BillingCompareTables,
  PlatformFeatureLine,
  PlatformPriceMetaItem,
  SourcingScopeLine,
} from './billing.types';

// Re-export types
export * from './billing.types';

// =========================================================================
// REQUEST (Admin + Recruiter)
// =========================================================================
export interface AdminCreatePlatformPlanRequest {
  code: string;
  name: string;
  description?: string;
  /** VND integer (number ≤ 2^53 hoặc string). */
  priceVnd: number | string;
  billingUnit: 'per_jd' | 'per_month';
  durationDays?: number | null;
  jobPostQuota?: number | null;
  creditQuota?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  /** Dòng thẻ, chữ cũ, hoặc câu dưới giá { priceMeta }. */
  features?: Array<string | PlatformFeatureLine | PlatformPriceMetaItem>;
  /** Cost-per-action khi tạo gói. Thiếu thì copy từ policy global. */
  actionCosts?: AdminPlanActionCostItem[];
}

export interface AdminUpdatePlatformPlanRequest extends Partial<AdminCreatePlatformPlanRequest> {}

export interface AdminCreateSourcingPlanRequest {
  code: string;
  name: string;
  description?: string;
  feeVnd: number | string;
  positionQuota?: number;
  searchRoundQuota?: number;
  shortlistQuota?: number;
  revisionQuota?: number;
  creditQuota?: number;
  durationDays?: number;
  serviceScope?: SourcingServiceScope[];
  /** Dòng phạm vi dịch vụ. Có trường này thì ghi đè serviceScope. */
  scopeItems?: SourcingScopeLine[];
  sortOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface AdminUpdateSourcingPlanRequest extends Partial<AdminCreateSourcingPlanRequest> {}

export interface AdminCreateCreditTopupRequest {
  name: string;
  creditCount: number;
  priceVnd: number | string;
  badge?: string;
  sortOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface AdminUpdateCreditTopupRequest extends Partial<AdminCreateCreditTopupRequest> {}

export interface AdminUpdateCreditPolicyRequest {
  costPerProfile?: number;
  costPerHighMatchProfile?: number;
  costPerReopen?: number;
  costPerApplicant?: number;
  costPerContactPotential?: number;
  costPerContactApplicant?: number;
  costPerMatchSummary?: number;
  allowAutoPurchase?: boolean;
  defaultBudgetVnd?: number | string | null;
  warnWhenBelowPercent?: number;
  allowBudgetOverspend?: boolean;
  expireWhenInactive?: boolean;
  inactiveDays?: number | null;
  allowRefund?: boolean;
}

export interface AdminUpdateCurrencyConfigRequest {
  currencyCode?: string;
  displaySymbol?: string;
  symbolBefore?: boolean;
  useThousandsSeparator?: boolean;
  thousandsSeparator?: string;
  decimalDigits?: number;
  showReferenceUsd?: boolean;
  referenceUsdRate?: number | string | null;
  usdToVndRateHundredths?: number | string | null;
}

/** Thuế suất VAT hiển thị trên bảng giá (SuperAdmin đặt ở Admin → Billing → Policy & tiền tệ). */
export interface AdminVatSettingView {
  /** Null khi chưa đặt. Giá niêm yết luôn là giá chưa VAT. */
  percent: number | null;
  updatedAt: string | null;
}

export interface AdminUpdateVatSettingRequest {
  /** Số nguyên 0–100. */
  percent: number;
}

/** SuperAdmin chỉnh copy / SEO / FAQ / liên hệ trang /bang-gia. */
export interface AdminUpdatePageContentRequest {
  seoTitle?: string;
  seoDescription?: string;
  seoTitleRecruiter?: string;
  seoDescriptionRecruiter?: string;
  focusKeyword?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  ogImageAlt?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;

  heroBadge?: string;
  heroHeading?: string;
  heroHeadingAccent?: string;
  heroSubtitle?: string;
  heroSocialProof?: string;
  heroCtaPrimary?: string;
  heroCtaSecondary?: string;

  recruiterKicker?: string;
  recruiterHeading?: string;
  recruiterSubtitle?: string;

  platformTitle?: string;
  platformSubtitle?: string;
  sourcingTitle?: string;
  sourcingSubtitle?: string;
  creditTitle?: string;
  creditSubtitle?: string;
  featuresTitle?: string;
  featuresSubtitle?: string;
  compareTitle?: string;
  compareSubtitle?: string;
  howTitle?: string;
  howSubtitle?: string;
  howFooter?: string;
  faqTitle?: string;
  faqSubtitle?: string;
  contactTitle?: string;
  contactSubtitle?: string;
  finalCtaTitle?: string;
  finalCtaSubtitle?: string;
  footerTagline?: string;
  consultNavText?: string;

  contactEmail?: string;
  contactEmailDesc?: string;
  contactHotline?: string;
  contactHotlineHref?: string;
  contactHotlineDesc?: string;
  contactZaloLabel?: string;
  contactZaloHref?: string;
  contactZaloDesc?: string;

  features?: BillingPageTextItem[];
  howSteps?: BillingPageTextItem[];
  faqItems?: BillingPageFaqItem[];
  trustItems?: BillingPageTextItem[];
  /** Null để trang bảng giá dùng lại bảng tính từ gói. */
  compareTables?: BillingCompareTables | null;
}

/** Admin thêm/trừ credit thủ công cho một công ty. */
export interface AdminPlanActionCostItem {
  action: BillingPlanBillableAction;
  cost: number;
  isActive?: boolean;
}

export interface AdminUpdatePlanActionCostsRequest {
  costs: AdminPlanActionCostItem[];
}

export interface AdminAssignCompanyPlanRequest {
  companyId: string;
  planId: string;
  startsAt?: string;
  endsAt?: string | null;
  isActive?: boolean;
  note?: string | null;
  customJobPostQuota?: number | null;
  customCreditQuota?: number | null;
  customDurationDays?: number | null;
}

export interface AdminCreditAdjustRequest {
  companyId: string;
  creditDelta: number; // dương = cấp thêm, âm = trừ bớt
  reason: string;
}

/** Recruiter thanh toán / kích hoạt gói nền tảng. */
export interface RecruiterCreatePlanCheckoutRequest {
  planCode: string;
}

/** Recruiter thanh toán / kích hoạt gói Săn nhân sự. */
export interface RecruiterCreateSourcingCheckoutRequest {
  planCode: string;
}

/**
 * Recruiter gắn 1 gói tin đăng vào 1 tin tuyển dụng có sẵn.
 *
 * Dùng cho 2 trường hợp (cùng 1 transaction):
 * - Gói `UNUSED`: kích hoạt gói (ACTIVE + hạn 30 ngày + cộng Credit) rồi gắn vào tin.
 * - Gói `ACTIVE` còn lượt: chỉ trừ 1 lượt đăng rồi gắn vào tin (KHÔNG cộng lại Credit).
 */
export interface RecruiterApplyJobPackageRequest {
  /** Id tin tuyển dụng cần gắn gói. Tin phải thuộc công ty và còn hiệu lực để đăng lại. */
  jobId: string;
}

/** Kết quả gắn gói cho 1 tin. */
export interface RecruiterApplyJobPackageResponse {
  /** Id gói đã áp dụng. */
  packageId: string;
  /** Mã gói (vd "JD-ST-000029"). */
  packageCode: string;
  /** Id tin đã gắn gói. */
  jobId: string;
  /** Số lượt đăng còn lại của gói sau khi áp dụng. */
  jobsRemaining: number | null;
  /** true = gói vừa được kích hoạt (UNUSED → ACTIVE) trong lần này. */
  activated: boolean;
  /** Số Credit vừa được cộng vào ví (0 = không cộng thêm). */
  creditsGranted: number;
  /** Ngày hết hạn của gói sau khi áp dụng (null = không xác định). */
  expiresAt: string | null;
}

/** 1 tin tuyển dụng có thể áp dụng gói (dùng cho modal "Áp dụng cho tin có sẵn"). */
export interface RecruiterApplicableJobView {
  id: string;
  code: string;
  title: string;
  /** Trạng thái hiện tại của tin (draft / published / closed / expired...). */
  status: string;
  /** Mã gói đang gắn với tin này (null = tin dùng gói FREE / chưa gắn gói). */
  jobPackageCode: string | null;
  /** Ngày hết hạn hiện tại của tin. */
  deadline: string | null;
  /** Ngày đăng. */
  publishedAt: string | null;
  createdAt: string;
  /**
   * Tin này có gắn được gói Tin đăng không.
   * `false` khi tin đang chạy bằng gói Săn nhân sự (chiến dịch ACTIVE).
   */
  eligible: boolean;
  /** Lý do không gắn được (chỉ có khi `eligible === false`). */
  disabledReason: string | null;
  /**
   * Hành động phù hợp khi NTD chọn tin này trong modal Dùng gói:
   * - `apply`: áp dụng gói trực tiếp (nháp / đã đóng / hết hạn / gói Khám phá)
   * - `resume`: tin đang tạm dừng trên gói trả phí còn hạn → tiếp tục chạy lại (không trừ thêm lượt)
   * - `clone`: tin đang chạy trên gói trả phí → sao chép nội dung để đăng tin mới bằng gói này
   */
  actionHint?: 'apply' | 'resume' | 'clone';
}

/**
 * Nguồn gói nuôi tin tuyển dụng (loại trừ lẫn nhau).
 * - `HUNT`: tin đang có chiến dịch Săn ACTIVE / được tạo bởi `BillingHuntPackage`.
 * - `STANDARD`: mọi tin còn lại (gói Khám phá / Tin đăng / Tin đăng Plus / Doanh nghiệp / Nháp).
 */
export type RecruiterJobSource = 'STANDARD' | 'HUNT';

/** Bộ lọc nguồn tin cho "Danh sách tin đăng". */
export type RecruiterJobSourceFilter = 'ALL' | RecruiterJobSource;

/** Số đếm theo nguồn (tính theo bộ lọc từ khoá / thời gian / trạng thái hiện tại). */
export interface RecruiterJobSourceCounts {
  all: number;
  standard: number;
  hunt: number;
}

/** Kết quả lọc nguồn + số đếm đi kèm. */
export interface RecruiterJobSourceFilterResult {
  source: RecruiterJobSourceFilter;
  sourceCounts: RecruiterJobSourceCounts;
}

export interface AdminAssignCompanySourcingPlanRequest {
  companyId: string;
  planId: string;
  startsAt?: string;
  endsAt?: string | null;
  isActive?: boolean;
  note?: string | null;
}

export interface RecruiterConsumeSourcingRequest {
  kind: SourcingQuotaKind;
  /** Bắt buộc với search_round / shortlist / revision. Mở vị trí có thể tạo chiến dịch mới. */
  campaignId?: string;
  /** Gói Săn sẽ được kích hoạt (mở vị trí Săn). 1 gói → tối đa 1 chiến dịch. */
  packageId?: string;
  jobId?: string;
  title?: string;
  note?: string;
  /**
   * Chế độ "Copy nội dung JD sang Tin săn mới".
   *
   * Khi `true`: hệ thống TẠO 1 bản ghi `Job` MỚI (copy tiêu đề, mô tả, yêu cầu, lương,
   * địa điểm, kỹ năng, tiêu chí AI) và gắn gói Săn vào tin MỚI này.
   * Tin cũ KHÔNG bị ghi đè `jobId` — mọi dữ liệu tin cũ giữ nguyên.
   */
  copyJdToNewJob?: boolean;
  /**
   * Tự động đóng tin đăng thường cũ sau khi kích hoạt Tin săn (chỉ áp dụng khi
   * `copyJdToNewJob === true`) — tránh hiển thị 2 tin trùng ngoài trang ứng viên.
   */
  closeSourceJob?: boolean;
}

export interface RecruiterCreateCheckoutRequest {
  topupId: string;
}

/** Recruiter xem lịch sử giao dịch của công ty mình. */
export interface RecruiterCreditListRequest {
  limit?: number;
  offset?: number;
}

// =========================================================================
// RESPONSE
// =========================================================================
export type PlatformPlanView = BillingPlatformPlanView;
export type SourcingPlanView = BillingSourcingPlanView;
export type CreditTopupView = BillingCreditTopupView;
export type CreditPolicyView = BillingCreditPolicyView;
export type CurrencyDisplay = BillingCurrencyDisplay;
export type BillingAuditLogView = BillingAdminAuditLogView;
export type BillingCreditAccountViewDTO = BillingCreditAccountView;
export type BillingCreditTransactionViewDTO = BillingCreditTransactionView;
export type PlanActionCostView = BillingPlanActionCostView;
export type CompanyPlanView = BillingCompanyPlanView;
export type CompanySourcingPlanView = BillingCompanySourcingPlanView;
export type SourcingWorkspaceView = RecruiterSourcingWorkspace;
export type PageContentView = BillingPageContentView;

/** Bundle gộp cho UI bảng giá public (một request duy nhất). */
export interface BillingPublicConfig {
  platformPlans: PlatformPlanView[];
  sourcingPlans: SourcingPlanView[];
  creditTopups: CreditTopupView[];
  creditPolicy: CreditPolicyView;
  currency: CurrencyDisplay;
  /** Copy / SEO / FAQ / liên hệ — SuperAdmin chỉnh, không gồm số liệu gói. */
  pageContent: BillingPageContentView;
  /** Bước 7: 'mock' | 'bank_transfer' | 'live' — Recruiter UI dùng để hiển thị banner trạng thái thanh toán. */
  paymentMode?: 'mock' | 'bank_transfer' | 'live';
  /** Null khi SuperAdmin chưa đặt. Giá niêm yết không gồm số này. Thanh toán mới cộng thêm khi đã đặt. */
  vatPercent?: number | null;
  /**
   * Bước 8: cho frontend biết hệ thống có đang enforce trừ credit thật không.
   * - 'enforce': trừ balance thật, throw 402 INSUFFICIENT_CREDIT nếu thiếu.
   * - 'log' (mặc định): chỉ ghi ledger, không trừ thật.
   */
  creditEnforcement?: 'log' | 'enforce';
}

export interface BillingAuditListResponse {
  items: BillingAuditLogView[];
  total: number;
}

// RecruiterCreditBalanceResponse and RecruiterCreditSummaryResponse are exported via billing.types.ts

// =========================================================================
// SERVICE SCOPE (8 mức từ bảng XI tài liệu)
// =========================================================================
export type SourcingServiceScope =
  | 'ai_match'
  | 'filter_rank'
  | 'shortlist'
  | 'strengths_gaps'
  | 'priority'
  | 'outreach'
  | 'follow_up'
  | 'replacement';
