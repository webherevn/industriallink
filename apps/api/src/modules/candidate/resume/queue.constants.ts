export const RESUME_PARSE_QUEUE = 'resume-parse';

/** Dữ liệu job phân tích CV đưa vào hàng đợi BullMQ. */
export interface ResumeParseJobData {
  resumeId: string;
  candidateId: string;
  tenantId: string;
  correlationId: string;
}

/** Provider token cho instance Queue. */
export const RESUME_PARSE_QUEUE_TOKEN = 'RESUME_PARSE_QUEUE_TOKEN';
