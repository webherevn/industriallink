import type {
  AdminCompanyDetail,
  AdminCompanyListPage,
  AdminCompanyListQuery,
  AdminVerificationQueueItem,
  ReviewCompanyVerificationRequest,
  UpdateAdminCompanyRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchAdminCompanies(
  params: AdminCompanyListQuery = {},
): Promise<AdminCompanyListPage> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiRequest<AdminCompanyListPage>(`/admin/companies${suffix}`);
}

export async function fetchAdminCompany(id: string): Promise<AdminCompanyDetail> {
  return apiRequest<AdminCompanyDetail>(`/admin/companies/${id}`);
}

export async function fetchVerificationQueue(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
): Promise<AdminVerificationQueueItem[]> {
  return apiRequest(`/admin/companies/verification?status=${status}`);
}

export async function reviewCompanyVerification(
  id: string,
  body: ReviewCompanyVerificationRequest,
): Promise<AdminVerificationQueueItem> {
  return apiRequest(`/admin/companies/${id}/verification`, { method: 'POST', body });
}

export async function updateAdminCompany(
  id: string,
  body: UpdateAdminCompanyRequest,
): Promise<AdminCompanyDetail> {
  return apiRequest<AdminCompanyDetail>(`/admin/companies/${id}`, { method: 'PATCH', body });
}
