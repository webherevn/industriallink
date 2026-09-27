import type { InboxApplicantView, RecruiterWorkspaceSummary } from '@industriallink/contracts';
import { apiRequest, asArray } from './api';

function withMatchedSkills<T extends { matchedSkills?: unknown }>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  return { ...row, matchedSkills: asArray(row.matchedSkills) };
}

export async function getWorkspaceSummary(): Promise<RecruiterWorkspaceSummary> {
  const data = await apiRequest<RecruiterWorkspaceSummary>('/applications/workspace-summary');
  return {
    ...data,
    recentApplicants: asArray<InboxApplicantView>(data?.recentApplicants).map(withMatchedSkills),
  };
}

export async function listInbox(limit = 50): Promise<InboxApplicantView[]> {
  return asArray<InboxApplicantView>(await apiRequest(`/applications/inbox?limit=${limit}`)).map(
    withMatchedSkills,
  );
}
