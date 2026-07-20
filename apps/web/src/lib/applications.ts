import type {
  ApplicationDetailView,
  ApplicationStatus,
  ApplicationView,
  UpdateApplicationStatusRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function myApplications(): Promise<ApplicationView[]> {
  return apiRequest('/applications/mine');
}

export async function getApplicationDetail(id: string): Promise<ApplicationDetailView> {
  return apiRequest(`/applications/${id}`);
}

export async function updateApplicationStatus(
  id: string,
  input: UpdateApplicationStatusRequest,
): Promise<{ id: string; status: ApplicationStatus }> {
  return apiRequest(`/applications/${id}/status`, { method: 'PATCH', body: input });
}
