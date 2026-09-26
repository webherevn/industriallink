import type {
  AdminJobActionRequest,
  AdminJobListItem,
  AdminJobListPage,
  AdminJobListQuery,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchAdminJobs(params: AdminJobListQuery = {}): Promise<AdminJobListPage> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.moderationStatus) qs.set('moderationStatus', params.moderationStatus);
  if (params.companyId) qs.set('companyId', params.companyId);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiRequest<AdminJobListPage>(`/admin/jobs${suffix}`);
}

export async function actAdminJob(
  jobId: string,
  body: AdminJobActionRequest,
): Promise<AdminJobListItem> {
  return apiRequest<AdminJobListItem>(`/admin/jobs/${jobId}/action`, {
    method: 'POST',
    body,
  });
}
