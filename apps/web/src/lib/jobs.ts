import type {
  ApplicationStatus,
  ApplicationView,
  ApplicantView,
  ApplyJobRequest,
  CreateJobRequest,
  GenerateJobDraftRequest,
  GenerateJobDraftResponse,
  JobListItem,
  JobView,
  ListPublishedJobsQuery,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function listPublishedJobs(
  params: ListPublishedJobsQuery = {},
): Promise<JobListItem[]> {
  const qs = new URLSearchParams();
  if (params.keyword) qs.set('keyword', params.keyword);
  if (params.industry) qs.set('industry', params.industry);
  if (params.locations?.length) qs.set('locations', params.locations.join(','));
  else if (params.location) qs.set('location', params.location);
  if (params.experienceBand) qs.set('experienceBand', params.experienceBand);
  if (params.jobLevel) qs.set('jobLevel', params.jobLevel);
  if (params.jobTrack) qs.set('jobTrack', params.jobTrack);
  if (params.salaryMin != null) qs.set('salaryMin', String(params.salaryMin));
  if (params.salaryMax != null) qs.set('salaryMax', String(params.salaryMax));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest(`/jobs${suffix}`);
}

export async function getJob(id: string): Promise<JobView> {
  return apiRequest(`/jobs/${id}`);
}

export async function listMyJobs(): Promise<JobListItem[]> {
  return apiRequest('/jobs/mine');
}

export async function listBookmarkedJobs(): Promise<JobListItem[]> {
  return apiRequest('/jobs/bookmarks/mine');
}

export async function addJobBookmark(id: string): Promise<{ ok: true }> {
  return apiRequest(`/jobs/${id}/bookmark`, { method: 'POST' });
}

export async function removeJobBookmark(id: string): Promise<{ ok: true }> {
  return apiRequest(`/jobs/${id}/bookmark`, { method: 'DELETE' });
}

export async function createJob(input: CreateJobRequest): Promise<JobView> {
  return apiRequest('/jobs', { method: 'POST', body: input });
}

/** AI gợi ý / chuẩn hoá nội dung tin tuyển dụng. */
export async function generateJobDraft(
  input: GenerateJobDraftRequest,
): Promise<GenerateJobDraftResponse> {
  return apiRequest('/jobs/ai/draft', { method: 'POST', body: input });
}

export async function publishJob(id: string): Promise<JobView> {
  return apiRequest(`/jobs/${id}/publish`, { method: 'POST' });
}

export async function applyToJob(id: string, input: ApplyJobRequest): Promise<ApplicationView> {
  return apiRequest(`/jobs/${id}/apply`, { method: 'POST', body: input });
}

export async function listApplicants(id: string): Promise<ApplicantView[]> {
  return apiRequest(`/jobs/${id}/applications`);
}

export async function broadcastJobEmail(
  id: string,
  input: { subject: string; body: string; status?: ApplicationStatus },
): Promise<{ recipients: number; sent: number; failed: number }> {
  return apiRequest(`/jobs/${id}/broadcast-email`, { method: 'POST', body: input });
}
