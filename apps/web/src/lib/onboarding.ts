import type {
  CreateOnboardingRequest,
  OnboardingView,
  UpdateOnboardingRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function listOnboardings(params: {
  jobId?: string;
  status?: string;
} = {}): Promise<OnboardingView[]> {
  const qs = new URLSearchParams();
  if (params.jobId) qs.set('jobId', params.jobId);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest(`/onboardings${suffix}`);
}

export async function listMyOnboardings(): Promise<OnboardingView[]> {
  return apiRequest('/onboardings/mine');
}

export async function startOnboarding(
  input: CreateOnboardingRequest,
): Promise<OnboardingView> {
  return apiRequest('/onboardings', { method: 'POST', body: input });
}

export async function updateOnboarding(
  id: string,
  input: UpdateOnboardingRequest,
): Promise<OnboardingView> {
  return apiRequest(`/onboardings/${id}`, { method: 'PATCH', body: input });
}
