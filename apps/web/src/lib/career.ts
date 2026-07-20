import type { CareerAdviceView, JobTrack, SalaryEstimateView } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function getCareerAdvice(track?: JobTrack): Promise<CareerAdviceView> {
  const qs = track ? `?track=${track}` : '';
  return apiRequest(`/candidates/me/career${qs}`);
}

export async function estimateSalary(input: {
  jobLevel: string;
  industry?: string;
  location?: string;
  title?: string;
  yearsOfExperience?: number;
}): Promise<SalaryEstimateView> {
  return apiRequest('/jobs/ai/salary', { method: 'POST', body: input });
}
