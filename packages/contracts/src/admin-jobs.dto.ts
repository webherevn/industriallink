import type { AdminJobAction, JobModerationStatus, JobStatus } from './enums';

/** Một dòng trên console SuperAdmin /admin/jobs. */
export interface AdminJobListItem {
  id: string;
  code: string;
  title: string;
  slug: string | null;
  industry: string | null;
  location: string | null;
  companyId: string;
  companyName: string;
  companyTrustScore: number;
  status: JobStatus;
  moderationStatus: JobModerationStatus;
  aiRiskScore: number | null;
  aiReason: string | null;
  createdAt: string;
  publishedAt: string | null;
  moderatedAt: string | null;
  submittedByEmail: string | null;
}

export interface AdminJobCompanyOption {
  id: string;
  name: string;
}

export interface AdminJobCounts {
  total: number;
  draft: number;
  published: number;
  paused: number;
  closed: number;
  pending: number;
  needsManualReview: number;
}

export interface AdminJobListPage {
  items: AdminJobListItem[];
  total: number;
  page: number;
  limit: number;
  counts: AdminJobCounts;
  companies: AdminJobCompanyOption[];
}

export interface AdminJobListQuery {
  status?: JobStatus;
  moderationStatus?: JobModerationStatus;
  companyId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface AdminJobActionRequest {
  action: AdminJobAction;
  note?: string;
}
