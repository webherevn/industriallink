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
  /** Bắt buộc với search_round / shortlist / revision. Mở vị trí có thể tạo engagement mới. */
  engagementId?: string;
  jobId?: string;
  title?: string;
  note?: string;
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
  /** Bước 7: 'mock' | 'live' — Recruiter UI dùng để hiển thị banner cảnh báo. */
  paymentMode?: 'mock' | 'live';
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
