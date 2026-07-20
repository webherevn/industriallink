import type { InboxApplicantView, RecruiterWorkspaceSummary } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function getWorkspaceSummary(): Promise<RecruiterWorkspaceSummary> {
  return apiRequest('/applications/workspace-summary');
}

export async function listInbox(limit = 50): Promise<InboxApplicantView[]> {
  return apiRequest(`/applications/inbox?limit=${limit}`);
}
