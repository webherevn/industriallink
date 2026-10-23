import { ApplicationStatus, InterviewStatus, InterviewType } from './enums';

export interface ApplyJobRequest {
  coverLetter?: string;
}

export interface UpdateApplicationStatusRequest {
  status: ApplicationStatus;
  note?: string;
}

/** Hồ sơ ứng tuyển nhìn từ phía ứng viên. */
export interface ApplicationView {
  id: string;
  code: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  /** Địa điểm làm việc từ tin tuyển dụng. */
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: ApplicationStatus;
  matchScore: number | null;
  coverLetter: string | null;
  createdAt: string;
}

/** Một ứng viên trong danh sách ứng tuyển nhìn từ phía nhà tuyển dụng. */
export interface ApplicantView {
  applicationId: string;
  candidateId: string;
  displayName: string;
  currentPosition: string | null;
  industry: string | null;
  status: ApplicationStatus;
  matchScore: number | null;
  matchedSkills: string[];
  coverLetter: string | null;
  createdAt: string;
  /** Lịch còn hiệu lực. HR và chuyên môn là loại lịch, không phải bước hồ sơ. */
  interviews: ApplicantInterviewMark[];
}

/** Một buổi phỏng vấn gắn trên hồ sơ, đủ để hiện loại HR hoặc chuyên môn. */
export interface ApplicantInterviewMark {
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string;
}

/** Ứng viên trong inbox toàn công ty (kèm tin tuyển dụng). */
export interface InboxApplicantView extends ApplicantView {
  jobId: string;
  jobTitle: string;
}

/** Một mốc trên biểu đồ hồ sơ mới. */
export interface RecruitmentReportTrendPoint {
  /** Ngày YYYY-MM-DD, tuần hoặc tháng tuỳ kỳ. */
  key: string;
  label: string;
  applications: number;
  hires: number;
}

/** Một bậc phễu — số hồ sơ đang đứng ở trạng thái đó trong kỳ. */
export interface RecruitmentReportFunnelStep {
  key: string;
  label: string;
  count: number;
}

/** Hiệu suất một tin trong kỳ báo cáo. */
export interface RecruitmentReportJobRow {
  jobId: string;
  title: string;
  status: string;
  location: string | null;
  applications: number;
  screening: number;
  interviews: number;
  offers: number;
  hires: number;
  /** Điểm khớp trung bình 0–100. */
  avgMatchScore: number | null;
}

/** Báo cáo tuyển dụng của công ty trong một kỳ. */
export interface RecruitmentReportView {
  companyName: string | null;
  hasCompany: boolean;
  days: number;
  generatedAt: string;
  openJobs: number;
  applications: number;
  /** Hồ sơ mới kỳ liền trước, cùng số ngày. */
  applicationsPrev: number;
  screening: number;
  interviews: number;
  /** Buổi phỏng vấn đã lên lịch trong kỳ, không tính buổi huỷ. */
  interviewSessions: number;
  offers: number;
  /** Đề nghị đã lập trong kỳ. */
  offersSent: number;
  hires: number;
  rejected: number;
  withdrawn: number;
  /** 0–100. */
  avgMatchScore: number | null;
  avgTimeToHireDays: number | null;
  /** Nhận việc / hồ sơ mới trong kỳ, phần trăm 1 chữ số. */
  conversionPct: number | null;
  funnel: RecruitmentReportFunnelStep[];
  trend: RecruitmentReportTrendPoint[];
  jobs: RecruitmentReportJobRow[];
}

/** Tóm tắt Recruiter Workspace. */
export interface RecruiterWorkspaceSummary {
  companyName: string | null;
  hasCompany: boolean;
  jobCount: number;
  publishedJobCount: number;
  applicationCount: number;
  newApplicationCount: number;
  recentApplicants: InboxApplicantView[];
  /** Số tin đang mở, tính tại thời điểm 7 ngày trước (để so sánh xu hướng). */
  publishedJobCount7dAgo: number;
  /** Số hồ sơ ứng tuyển mới nộp trong hôm nay / hôm qua. */
  newApplicationsToday: number;
  newApplicationsYesterday: number;
  /** Thời gian tuyển trung bình (ngày) từ lúc ứng tuyển đến lúc tuyển — null nếu chưa có ai được tuyển. */
  avgTimeToHireDays: number | null;
  /** Chênh lệch so với giai đoạn 30 ngày trước đó — null nếu thiếu dữ liệu một trong hai giai đoạn. */
  avgTimeToHireDeltaDays: number | null;
}

/** Một mốc trên timeline xử lý hồ sơ ứng tuyển. */
export interface ApplicationTimelineItemView {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
}

/** Chi tiết đơn ứng tuyển (ứng viên) kèm timeline trạng thái. */
export interface ApplicationDetailView extends ApplicationView {
  timeline: ApplicationTimelineItemView[];
}
