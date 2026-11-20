/**
 * Quy tắc NGHIỆP VỤ dùng chung cho cả 2 chiều khóa gói Tin đăng ↔ gói Tin săn.
 *
 * BẤT BIẾN: Một tin `Job` đang ở trạng thái `PUBLISHED` chỉ được nuôi bởi DUY NHẤT
 * 1 nguồn gói trả phí tại một thời điểm:
 *   - `JOB_PACKAGE` (Tin đăng / Tin đăng Plus / Doanh nghiệp / Enterprise)
 *   - HOẶC `HUNT_PACKAGE` (Tin săn Cơ bản / Tiêu chuẩn / Chuyên sâu — mỗi gói Săn
 *     đã bao gồm sẵn 01 tin tuyển dụng hiển thị 30 ngày).
 *
 * Vì vậy:
 *   - Chiều 1: gắn Gói Tin đăng vào tin đang chạy Tin săn → BỊ CHẶN.
 *   - Chiều 2: gắn Gói Tin săn vào tin đang chạy gói Tin đăng trả phí → BỊ CHẶN.
 */

/** Loại gói tin đăng TRẢ PHÍ (không tính gói Khám phá / FREE). */
export const PAID_JOB_PACKAGE_TYPES = ['STANDARD', 'PLUS', 'ENTERPRISE'] as const;

/** Lý do chặn dùng chung cho cả 2 chiều (hiển thị trên UI). */
export const HUNT_OWNED_JOB_REASON =
  'Tin này đang chạy bằng gói Săn nhân sự (đã gồm 30 ngày hiển thị) — không cần gắn thêm gói Tin đăng';

export const PAID_JOB_PACKAGE_REASON =
  'Tin này đang chạy bằng gói Tin đăng trả phí — không thể gắn thêm gói Tin săn. Hãy dùng "Tạo Tin săn từ nội dung JD này" để tạo tin độc lập.';

/**
 * Tin có đang chạy bằng gói Tin đăng TRẢ PHÍ không.
 *
 * @param packageType `BillingJobPackage.packageType` (FREE / STANDARD / PLUS / ENTERPRISE).
 * @param jobStatus Trạng thái hiện tại của tin.
 */
export function isPaidJobPackageActive(
  packageType: string | null | undefined,
  jobStatus: string | null | undefined,
): boolean {
  if (!packageType) return false;
  if (!(PAID_JOB_PACKAGE_TYPES as readonly string[]).includes(packageType)) return false;
  // Chỉ tính là "đang chạy" khi tin còn hiển thị (published).
  return jobStatus === 'published';
}

/**
 * Tin có được gắn gói Tin đăng không (chiều 1).
 *
 * @param isHuntOwned Tin đang thuộc 1 chiến dịch Săn ACTIVE (billingSource = HUNT_PACKAGE).
 */
export function canAttachJobPackage(params: {
  isHuntOwned: boolean;
  jobStatus: string | null | undefined;
}): { eligible: boolean; disabledReason: string | null } {
  if (params.isHuntOwned) {
    return { eligible: false, disabledReason: HUNT_OWNED_JOB_REASON };
  }
  return { eligible: true, disabledReason: null };
}

/**
 * Tin có được gắn gói Tin săn không (chiều 2).
 *
 * Chỉ cho phép gắn trực tiếp gói Tin săn vào các tin ở trạng thái:
 * - `DRAFT` (Nháp)
 * - `EXPIRED` / `CLOSED` (Đã đóng / Đã hết hạn)
 * - `PUBLISHED` đang dùng gói `FREE` (Khám phá)
 *
 * Chặn cứng nếu tin đang `PUBLISHED` bằng gói Tin đăng trả phí, hoặc đang thuộc
 * 1 chiến dịch Săn `ACTIVE` khác.
 */
export function canAttachHuntPackage(params: {
  jobStatus: string | null | undefined;
  jobPackageType: string | null | undefined;
  isHuntOwnedByOther: boolean;
}): { eligible: boolean; disabledReason: string | null } {
  if (params.isHuntOwnedByOther) {
    return {
      eligible: false,
      disabledReason: 'Tin này đang chạy trong 1 chiến dịch Săn nhân sự khác.',
    };
  }
  if (isPaidJobPackageActive(params.jobPackageType, params.jobStatus)) {
    return { eligible: false, disabledReason: PAID_JOB_PACKAGE_REASON };
  }
  return { eligible: true, disabledReason: null };
}
