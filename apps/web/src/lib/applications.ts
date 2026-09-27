import type {
  ApplicationDetailView,
  ApplicationStatus,
  ApplicationView,
  UpdateApplicationStatusRequest,
} from '@industriallink/contracts';
import { apiRequest, asArray } from './api';

export async function myApplications(): Promise<ApplicationView[]> {
  return asArray(await apiRequest('/applications/mine'));
}

export async function getApplicationDetail(id: string): Promise<ApplicationDetailView> {
  const data = await apiRequest<ApplicationDetailView>(`/applications/${id}`);
  return { ...data, timeline: asArray(data?.timeline) };
}

export async function updateApplicationStatus(
  id: string,
  input: UpdateApplicationStatusRequest,
): Promise<{ id: string; status: ApplicationStatus }> {
  return apiRequest(`/applications/${id}/status`, { method: 'PATCH', body: input });
}
