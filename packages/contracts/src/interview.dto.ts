import { InterviewStatus, InterviewType } from './enums';

export interface CreateInterviewRequest {
  applicationId: string;
  type: InterviewType;
  scheduledAt: string;
  durationMinutes?: number;
  meetingLink?: string;
  location?: string;
  interviewerName?: string;
  notes?: string;
  /** true (mặc định): chuyển hồ sơ sang trạng thái Phỏng vấn nếu chưa. */
  moveToInterview?: boolean;
}

export interface UpdateInterviewRequest {
  type?: InterviewType;
  status?: InterviewStatus;
  scheduledAt?: string;
  durationMinutes?: number;
  meetingLink?: string;
  location?: string;
  interviewerName?: string;
  notes?: string;
}

export interface InterviewView {
  id: string;
  code: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  candidateId: string;
  candidateName: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string;
  durationMinutes: number;
  meetingLink: string | null;
  location: string | null;
  interviewerName: string | null;
  notes: string | null;
  createdAt: string;
}
