import type {
  CreateInterviewRequest,
  InterviewView,
  UpdateInterviewRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function listInterviews(params: {
  from?: string;
  to?: string;
  jobId?: string;
  status?: string;
} = {}): Promise<InterviewView[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.jobId) qs.set('jobId', params.jobId);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest(`/interviews${suffix}`);
}

export async function listMyInterviews(): Promise<InterviewView[]> {
  return apiRequest('/interviews/mine');
}

export async function getInterviewStats(): Promise<{
  todayCount: number;
  next2hCount: number;
  byType: { hr: number; technical: number; other: number };
}> {
  return apiRequest('/interviews/stats');
}

export async function scheduleInterview(
  input: CreateInterviewRequest,
): Promise<InterviewView> {
  return apiRequest('/interviews', { method: 'POST', body: input });
}

export async function updateInterview(
  id: string,
  input: UpdateInterviewRequest,
): Promise<InterviewView> {
  return apiRequest(`/interviews/${id}`, { method: 'PATCH', body: input });
}
