import type { CompanyRole, CompanyStatus, JobModerationStatus, JobStatus, UserStatus } from './enums';

export interface AdminCompanyListItem {
  id: string;
  code: string;
  slug: string | null;
  name: string;
  taxCode: string | null;
  industry: string | null;
  status: CompanyStatus;
  trustScore: number;
  verified: boolean;
  trustedEmployer: boolean;
  memberCount: number;
  jobCount: number;
  publishedJobCount: number;
  createdAt: string;
}

export interface AdminCompanyCounts {
  total: number;
  active: number;
  suspended: number;
  banned: number;
}

export interface AdminCompanyListPage {
  items: AdminCompanyListItem[];
  total: number;
  page: number;
  limit: number;
  counts: AdminCompanyCounts;
}

export interface AdminCompanyListQuery {
  status?: CompanyStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export interface AdminCompanyMemberItem {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  roleInCompany: CompanyRole;
  userStatus: UserStatus | string;
  createdAt: string;
}

export interface AdminCompanyJobItem {
  id: string;
  code: string;
  title: string;
  status: JobStatus;
  moderationStatus: JobModerationStatus;
  publishedAt: string | null;
}

export interface AdminCompanyDetail extends AdminCompanyListItem {
  website: string | null;
  address: string | null;
  description: string | null;
  members: AdminCompanyMemberItem[];
  jobs: AdminCompanyJobItem[];
}

/** Cập nhật SuperAdmin. Trường bỏ trống = giữ nguyên. */
export interface UpdateAdminCompanyRequest {
  status?: CompanyStatus;
  trustScore?: number;
  verified?: boolean;
  trustedEmployer?: boolean;
  note?: string;
}
