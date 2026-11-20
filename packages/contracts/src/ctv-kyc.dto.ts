/**
 * Hồ sơ xác thực CCCD 2 mặt + tài khoản ngân hàng của cộng tác viên (CTV).
 * Ảnh CCCD nằm trong storage private. API chỉ trả key tương đối, không trả URL công khai.
 */

export type CrmKycStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type CrmKycSide = 'front' | 'back';

/** Hồ sơ KYC của chính CTV đang đăng nhập. */
export interface CrmKycProfileView {
  status: CrmKycStatus;
  /** Họ và tên đúng theo CCCD. */
  fullName: string | null;
  /** 12 chữ số. */
  idNumber: string | null;
  idIssuedDate: string | null;
  idIssuedPlace: string | null;
  /** Mã số thuế cá nhân dùng để khấu trừ thuế TNCN. */
  personalTaxCode: string | null;
  phone: string | null;
  /** Đã có ảnh mặt trước hay chưa. Key ảnh không trả ra ngoài. */
  hasFrontImage: boolean;
  hasBackImage: boolean;
  bankCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  /** Chỉ có khi bị từ chối. */
  kycRejectReason: string | null;
  /** true khi CTV đã yêu cầu cập nhật lại thông tin đã xác thực. */
  resubmitRequested: boolean;
  updatedAt: string;
}

/** Payload lưu hồ sơ KYC. CTV phải có đủ 2 ảnh và số CCCD 12 chữ số. */
export interface UpdateCrmKycRequest {
  fullName: string;
  idNumber: string;
  idIssuedDate?: string | null;
  idIssuedPlace?: string | null;
  personalTaxCode?: string | null;
  phone: string;
  bankCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  /**
   * Bắt buộc = true khi hồ sơ đang VERIFIED và CTV muốn sửa lại.
   * Chuyển kỳ chi trả về trạng thái chờ duyệt lại.
   */
  confirmChange?: boolean;
}

/** Kết quả upload 1 mặt ảnh CCCD. */
export interface CrmKycUploadResult {
  side: CrmKycSide;
  /** Key tương đối trong storage private. */
  key: string;
  uploadedAt: string;
}

/** Danh sách hồ sơ KYC cho CRM Admin duyệt. */
export interface CrmKycReviewListView {
  rows: CrmKycReviewRowView[];
  /** Số hồ sơ đang chờ duyệt — dùng để gắn badge đỏ trên menu CRM. */
  pendingCount: number;
}

export interface CrmKycReviewRowView {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  partnerPhone: string | null;
  status: CrmKycStatus;
  fullName: string | null;
  idNumber: string | null;
  idIssuedDate: string | null;
  idIssuedPlace: string | null;
  personalTaxCode: string | null;
  phone: string | null;
  hasFrontImage: boolean;
  hasBackImage: boolean;
  bankCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  /** true khi tên chủ tài khoản lệch với họ tên trên CCCD (chuẩn hóa không dấu). */
  holderMismatch: boolean;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  kycRejectReason: string | null;
}

/** Duyệt hoặc từ chối một hồ sơ KYC. */
export interface ReviewCrmKycRequest {
  action: 'APPROVE' | 'REJECT';
  /** Bắt buộc có khi action = REJECT. */
  rejectReason?: string;
}

export interface CrmKycReviewResultView {
  partnerId: string;
  status: CrmKycStatus;
  kycReviewedAt: string | null;
  kycRejectReason: string | null;
}

/** Ngân hàng Việt Nam cho dropdown chọn tài khoản nhận hoa hồng. */
export interface CrmKycBankOption {
  code: string;
  name: string;
}

/** Thông tin chi trả một kỳ của CTV (màn Kỳ chi trả). */
export interface CrmKycPayoutPeriodView {
  periodId: string;
  periodMonth: string;
  /** Tổng hoa hồng kỳ trước thuế. */
  grossAmountVnd: string;
  /** Thuế TNCN 10% (0 khi dưới ngưỡng 2.000.000). */
  pitTaxAmountVnd: string;
  /** Thực nhận = gross - thuế. */
  netPaidAmountVnd: string;
  /** Mã giao dịch / UNC do kế toán nhập. */
  transferRef: string | null;
  status: 'paid' | 'held';
  /** Trạng thái KYC của CTV tại thời điểm xem. */
  kycStatus: CrmKycStatus;
  paidAt: string | null;
}
