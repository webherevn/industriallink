export const JOB_MODERATION_QUEUE = 'job-moderation';

/** Provider token cho instance Queue kiểm duyệt tin. */
export const JOB_MODERATION_QUEUE_TOKEN = 'JOB_MODERATION_QUEUE_TOKEN';

/**
 * An toàn hạn mức Gemini Free (15 RPM): worker chỉ xử lý tối đa 10 tin/phút.
 * BullMQ limiter áp cho toàn bộ worker (concurrency=1) → tuần tự, có nhịp.
 */
export const JOB_MODERATION_RATE_MAX = 10;
export const JOB_MODERATION_RATE_DURATION_MS = 60_000;

/** Dữ liệu job đưa vào hàng đợi kiểm duyệt. */
export interface JobModerationJobData {
  jobId: string;
  tenantId: string;
  correlationId: string;
}
