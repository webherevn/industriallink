import type { CandidateMatchView, JobMatchView } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function candidatesForJob(jobId: string): Promise<CandidateMatchView[]> {
  return apiRequest(`/matching/jobs/${jobId}/candidates`);
}

export async function recommendedJobs(): Promise<JobMatchView[]> {
  return apiRequest('/matching/recommended-jobs');
}
