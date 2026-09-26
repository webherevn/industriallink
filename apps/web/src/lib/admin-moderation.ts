import type {
  DecideJobModerationRequest,
  JobModerationQueueItem,
  JobModerationQueuePage,
  JobModerationStatus,
} from '@industriallink/contracts';
import { apiRequest } from './api';

/** Hàng đợi kiểm duyệt tin (mặc định: cần duyệt tay). */
export async function fetchJobModerationQueue(params: {
  status?: JobModerationStatus;
  limit?: number;
} = {}): Promise<JobModerationQueuePage> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiRequest<JobModerationQueuePage>(`/admin/job-moderation/queue${suffix}`);
}

/** SuperAdmin quyết định 1 tin: duyệt / từ chối / khoá tài khoản. */
export async function decideJobModeration(
  jobId: string,
  body: DecideJobModerationRequest,
): Promise<JobModerationQueueItem> {
  return apiRequest<JobModerationQueueItem>(
    `/admin/job-moderation/${jobId}/decide`,
    { method: 'POST', body },
  );
}
