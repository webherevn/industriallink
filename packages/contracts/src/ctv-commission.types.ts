/**
 * Chính sách & Tính toán Hoa hồng CTV — mô hình 3 cấp bậc doanh số thực thu/tháng.
 *
 * Nguyên tắc:
 *  - Bậc đạt được trong tháng áp dụng cho TOÀN BỘ doanh thu hợp lệ của tháng đó.
 *  - Chính sách có hiệu lực theo ngày, KHÔNG áp dụng hồi tố cho kỳ đã phát sinh.
 *  - Hoa hồng tính trên doanh thu thực thu chưa VAT, sau chiết khấu.
 *  - Nạp thêm Credit mặc định KHÔNG tính hoa hồng, không cộng doanh số xét hạng.
 *  - Khách hàng hưởng hoa hồng trọn đời theo CTV đã gán (1 KH — 1 CTV).
 */

/** Trạng thái vòng đời chính sách. */
export type CtvCommissionPolicyStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED';

/** Mã cấp bậc. */
export type CtvCommissionTierCode = 'BASIC' | 'SILVER' | 'GOLD';

/** Loại sản phẩm được ghi nhận trong kỳ. */
export type CtvCommissionProductType =
  | 'JOB_PACKAGE'
  | 'HUNT_PACKAGE'
  | 'UPGRADE_DELTA'
  | 'CREDIT_TOPUP';

/** Trạng thái 1 dòng chi tiết giao dịch. */
export type CtvCommissionItemStatus = 'RECORDED' | 'VOIDED' | 'ADJUSTED_NEXT_PERIOD';

/** Trạng thái kỳ đối soát tháng. */
export type CtvMonthlyStatementStatus = 'OPEN' | 'RECONCILED' | 'PAID';

/** Nguồn gán khách hàng cho CTV. */
export type CtvAttributionSource = 'COOKIE' | 'TAX_LOCK' | 'CRM_MANUAL';

export interface CtvCommissionTierView {
  code: CtvCommissionTierCode;
  name: string;
  /** Cận dưới (gồm). */
  minMonthlyRevenueVnd: string;
  /** Cận trên (không gồm). Null = không giới hạn trên. */
  maxMonthlyRevenueVnd: string | null;
  /** Tỷ lệ % áp dụng cho toàn bộ doanh thu tháng đạt bậc này. */
  ratePercent: number;
}

export interface CtvCommissionPolicyView {
  id: string;
  name: string;
  version: number;
  status: CtvCommissionPolicyStatus;
  /** Ngày bắt đầu hiệu lực. Không áp dụng hồi tố. */
  effectiveFrom: string;
  /** Gói Tin đăng (Tin đăng, Tin đăng Plus, Doanh nghiệp). */
  includeJobPosting: boolean;
  /** Gói Tin săn (Cơ bản, Tiêu chuẩn, Chuyên sâu). */
  includeHuntPackage: boolean;
  /** Nạp thêm Credit — mặc định false. */
  includeCreditTopup: boolean;
  /** Doanh thu chưa VAT (sau chiết khấu). */
  excludeVat: boolean;
  tiers: CtvCommissionTierView[];
  createdById: string;
  createdAt: string;
  note: string | null;
}

/** Kết quả trả về cho trang cài đặt hoa hồng. */
export interface CrmCommissionPolicySettingsView {
  /** Chính sách đang áp dụng (ACTIVE). Null khi chưa có. */
  activePolicy: CtvCommissionPolicyView | null;
  /** Lịch sử phiên bản để lưu vết kiểm toán. */
  history: CtvCommissionPolicyView[];
  /** Chỉ SuperAdmin được sửa / tạo phiên bản mới. */
  canEdit: boolean;
}

export interface UpdateCtvCommissionTierInput {
  code: CtvCommissionTierCode;
  name: string;
  /** Cận dưới (gồm), VND. */
  minMonthlyRevenueVnd: string;
  /** Cận trên (không gồm), VND. Null = không giới hạn trên. */
  maxMonthlyRevenueVnd: string | null;
  /** Tỷ lệ % — số nguyên 0–50. */
  ratePercent: number;
}

export interface CreateCtvCommissionPolicyRequest {
  name: string;
  /** Ngày hiệu lực (YYYY-MM-DD). Bắt buộc. */
  effectiveFrom: string;
  tiers: UpdateCtvCommissionTierInput[];
  includeJobPosting: boolean;
  includeHuntPackage: boolean;
  includeCreditTopup: boolean;
  excludeVat: boolean;
  note?: string | null;
}

/** Kỳ đối soát tháng của 1 CTV. */
export interface CtvMonthlyStatementView {
  id: string;
  ctvId: string;
  ctvName: string;
  ctvCode: string;
  /** YYYY-MM. */
  yearMonth: string;
  policyId: string;
  totalEligibleRevenueVnd: string;
  achievedTierCode: CtvCommissionTierCode | null;
  achievedTierName: string | null;
  appliedRatePercent: number | null;
  grossCommissionVnd: string;
  adjustmentAmountVnd: string;
  finalCommissionVnd: string;
  status: CtvMonthlyStatementStatus;
  reconciledAt: string | null;
  paidAt: string | null;
}

/** Chi tiết 1 giao dịch hợp lệ trong kỳ. */
export interface CtvCommissionItemView {
  id: string;
  statementId: string;
  ctvId: string;
  companyId: string;
  companyName: string;
  billingOrderId: string;
  productType: CtvCommissionProductType;
  planCode: string | null;
  planName: string | null;
  paidAmountGrossVnd: string;
  vatAmountVnd: string;
  discountAmountVnd: string;
  eligibleRevenueVnd: string;
  appliedRatePercent: number;
  commissionAmountVnd: string;
  status: CtvCommissionItemStatus;
  yearMonth: string;
  paidAt: string;
}

/** Bậc tháng của 1 CTV + thanh tiến độ lên hạng. */
export interface CtvMonthlyTierView {
  /** YYYY-MM. */
  yearMonth: string;
  /** Tổng doanh số hợp lệ trong tháng (chưa VAT). */
  totalEligibleRevenueVnd: string;
  achievedTierCode: CtvCommissionTierCode | null;
  achievedTierName: string | null;
  appliedRatePercent: number | null;
  /** Tỷ lệ % của bậc kế tiếp (để vẽ thanh tiến độ). Null khi đã đạt bậc cao nhất. */
  nextTierCode: CtvCommissionTierCode | null;
  nextTierName: string | null;
  nextTierRatePercent: number | null;
  /** Doanh số cần thêm để lên bậc kế tiếp. 0 khi đã đạt bậc cao nhất. */
  revenueToNextTierVnd: string;
  /** Ngưỡng doanh số của bậc kế tiếp. Null khi đã đạt bậc cao nhất. */
  nextTierThresholdVnd: string | null;
  /** Hoa hồng tạm tính trong tháng (chưa chốt kỳ). */
  estimatedCommissionVnd: string;
}

/** Thông tin chính sách cho Cổng CTV (read-only). */
export interface CtvCommissionPolicyPublicView {
  name: string;
  version: number;
  effectiveFrom: string;
  includeJobPosting: boolean;
  includeHuntPackage: boolean;
  includeCreditTopup: boolean;
  excludeVat: boolean;
  tiers: CtvCommissionTierView[];
}
