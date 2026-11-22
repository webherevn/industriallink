export type CompanyVerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Trạng thái xác minh mà NTD thấy trên hồ sơ công ty. */
export interface CompanyVerificationView {
  verified: boolean;
  trustedEmployer: boolean;
  status: CompanyVerificationStatus;
  note: string | null;
  reviewNote: string | null;
  requestedAt: string | null;
  askVerified: boolean;
  askTrusted: boolean;
  taxCode?: string | null;
  hasLicenseDoc?: boolean;
  licenseDocName?: string | null;
  licenseDocMime?: string | null;
  licenseDocSize?: number | null;
  licenseUploadedAt?: string | null;
  taxRegistryVerified?: boolean;
  taxRegistryBusinessName?: string | null;
}

export interface SubmitCompanyVerificationRequest {
  note: string;
  askVerified?: boolean;
  askTrusted?: boolean;
  /** Cho phép nhập/cập nhật MST trực tiếp khi gửi đơn xác minh. */
  taxCode?: string;
}

export interface AdminVerificationQueueItem {
  companyId: string;
  companyCode: string;
  companyName: string;
  companyStatus: string;
  taxCode?: string | null;
  verified: boolean;
  trustedEmployer: boolean;
  requestStatus: Exclude<CompanyVerificationStatus, 'none'>;
  note: string | null;
  reviewNote: string | null;
  requestedAt: string;
  requestedByEmail: string | null;
  askVerified: boolean;
  askTrusted: boolean;
  hasLicenseDoc?: boolean;
  licenseDocName?: string | null;
  licenseDocMime?: string | null;
}

export interface ReviewCompanyVerificationRequest {
  decision: 'approve' | 'reject';
  /** Bỏ trống = cấp đúng mục NTD đã xin. */
  verified?: boolean;
  trustedEmployer?: boolean;
  reviewNote?: string;
}
