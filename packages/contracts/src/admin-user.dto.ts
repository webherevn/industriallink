import { UserRole, UserStatus } from './enums';

export interface AdminUserView {
  id: string;
  code: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string | null;
  status: UserStatus | string;
  isVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export interface AdminUpdateUserRequest {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
  /** Phòng ban trên bảng nhân sự. Bỏ trống thì xóa. */
  department?: string | null;
}

export interface AdminSystemResetPreviewView {
  superAdminCount: number;
  editorCount: number;
  salesStaffCount: number;
  recruiterUserCount: number;
  candidateUserCount: number;
  companyCount: number;
  jobCount: number;
  applicationCount: number;
  candidateProfileCount: number;
  billingOrderCount: number;
  crmLeadCount: number;
  crmDealCount: number;
  crmPartnerCount: number;
  analyticsHitCount: number;
  auditLogCount: number;
}

export interface AdminSystemResetRequest {
  confirmPhrase: string;
  password: string;
  keepEditors?: boolean;
  keepSalesStaff?: boolean;
  clearAnalyticsAndAudit?: boolean;
}

export interface AdminSystemResetResultView {
  ok: true;
  resetAt: string;
  keptUsersCount: number;
  deletedUsersCount: number;
  deletedCompaniesCount: number;
  deletedJobsCount: number;
  deletedCandidatesCount: number;
  deletedOrdersCount: number;
  deletedCrmLeadsCount: number;
}
