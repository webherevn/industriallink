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
}

export interface SubmitCompanyVerificationRequest {
  note: string;
  askVerified?: boolean;
  askTrusted?: boolean;
}

export interface AdminVerificationQueueItem {
  companyId: string;
  companyCode: string;
  companyName: string;
  companyStatus: string;
  verified: boolean;
  trustedEmployer: boolean;
  requestStatus: Exclude<CompanyVerificationStatus, 'none'>;
  note: string | null;
  reviewNote: string | null;
  requestedAt: string;
  requestedByEmail: string | null;
  askVerified: boolean;
  askTrusted: boolean;
}

export interface ReviewCompanyVerificationRequest {
  decision: 'approve' | 'reject';
  /** Bỏ trống = cấp đúng mục NTD đã xin. */
  verified?: boolean;
  trustedEmployer?: boolean;
  reviewNote?: string;
}
