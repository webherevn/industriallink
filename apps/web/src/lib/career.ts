import type { SalaryEstimateView } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function estimateSalary(input: {
  jobLevel: string;
  industry?: string;
  location?: string;
  title?: string;
  yearsOfExperience?: number;
}): Promise<SalaryEstimateView> {
  return apiRequest('/jobs/ai/salary', { method: 'POST', body: input });
}
