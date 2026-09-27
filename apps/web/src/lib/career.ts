import type { CareerAdviceView, JobTrack, SalaryEstimateView } from '@industriallink/contracts';
import { apiRequest, asArray } from './api';

export async function getCareerAdvice(track?: JobTrack): Promise<CareerAdviceView> {
  const qs = track ? `?track=${track}` : '';
  const data = await apiRequest<CareerAdviceView>(`/candidates/me/career${qs}`);
  return {
    ...data,
    ladder: asArray(data?.ladder),
    skillGaps: asArray(data?.skillGaps),
    actionPlan: asArray(data?.actionPlan),
  };
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
