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
  /**
   * Gợi ý mềm khi ứng viên ứng tuyển CHÉO lĩnh vực (hồ sơ Kỹ thuật nộp JD
   * Kinh doanh hoặc ngược lại). KHÔNG chặn — chỉ để Frontend hiển thị gợi ý.
   */
  trackNotice?: string | null;
  /** Lĩnh vực hồ sơ ứng viên đang active. */
  candidateTrack?: 'sales' | 'technical' | null;
  /** Lĩnh vực của tin tuyển dụng. */
  jobTrack?: 'sales' | 'technical' | null;
  /** true khi ứng viên ứng tuyển chéo lĩnh vực. */
  crossTrack?: boolean;
}

/**
 * Nguồn gốc hồ sơ ứng tuyển — dùng để lọc và hiển thị badge nguồn.
 * - `self_applied`: ứng viên tự nộp hồ sơ (luôn thuộc quyền liên hệ).
 * - `hunt`: ứng viên do chiến dịch Săn nhân sự mang về (cần mở khóa hồ sơ bằng Credit).
 * - `ai_suggested`: ứng viên do AI gợi ý, chưa nộp hồ sơ (chưa có application).
 */
export type ApplicationSource = 'self_applied' | 'hunt' | 'ai_suggested';

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
  /** Nguồn gốc hồ sơ để lọc + hiển thị badge nguồn. */
  source?: ApplicationSource;
  /** Email ứng viên (null khi tài khoản chưa cập nhật email). */
  email?: string | null;
  /**
   * NTD có quyền liên hệ ứng viên này không:
   * tự ứng tuyển → có; hồ sơ Săn/AI → cần mở khóa bằng Credit mới liên hệ được.
   */
  canContact?: boolean;
  /** Lý do từ chối (chỉ có ở hồ sơ đã từ chối). */
  rejectionReason?: string | null;
  /** Chức danh hiện tại (đã đồng bộ theo lĩnh vực đang active của hồ sơ). */
  primaryTitle?: string | null;
  /** Lĩnh vực lĩnh vực hồ sơ ứng viên đang active ('sales' | 'technical'). */
  candidateTrack?: 'sales' | 'technical' | null;
  /** Lĩnh vực của tin tuyển dụng ('sales' | 'technical' | null nếu tin legacy). */
  jobTrack?: 'sales' | 'technical' | null;
  /**
   * Ứng viên ứng tuyển CHÉO lĩnh vực (hồ sơ Kỹ thuật nộp JD Kinh doanh hoặc ngược lại).
   * NTD cần thấy nhanh nhóm kỹ sư ứng tuyển Sales B2B.
   */
  crossTrack?: boolean;
  /**
   * Quyền xem thông tin liên hệ đầy đủ (email / số điện thoại không bị mask).
   * - true: công ty đã mở khóa hồ sơ bằng Credit, HOẶC ứng viên đã tự ứng tuyển.
   * - false: hồ sơ tiềm năng chưa mở khóa → email/số điện thoại bị mask.
   */
  isContactUnlocked?: boolean;
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

/** Một bậc phễu — số hồ sơ đang đứng ở trạng thái đó trong kỳ kèm số liệu chuyển đổi lũy kế. */
export interface RecruitmentReportFunnelStep {
  key: string;
  label: string;
  count: number;
  /** Số hồ sơ đã đi tới hoặc vượt qua bước này (phễu chuyển đổi lũy kế). */
  cumulativeCount?: number;
  /** Số hồ sơ hiện đang đứng tại bước này. */
  currentCount?: number;
  /** Tỷ lệ chuyển đổi so với tổng đầu vào (%). */
  conversionFromStartPct?: number;
  /** Tỷ lệ qua vòng so với bước liền trước (%). */
  stepPassRatePct?: number;
}

/** Hiệu suất một tin trong kỳ báo cáo. */
export interface RecruitmentReportJobRow {
  jobId: string;
  code?: string | null;
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
  /** Điểm khớp cao nhất 0–100. */
  topMatchScore?: number | null;
  /** Số hồ sơ chất lượng cao (điểm khớp ≥ 70%). */
  highMatchCount?: number;
  /** Số đợt quét AI Săn nhân sự gắn với tin này trong kỳ. */
  sourcingScans?: number;
  /** Số ứng viên đã Shortlist gắn với tin này. */
  shortlisted?: number;
  /** Số ứng viên đã giao CSKH Inlink liên hệ gắn với tin này. */
  outreachCount?: number;
}

/** Thống kê nguồn Săn nhân sự AI & tiếp cận chủ động trong kỳ báo cáo. */
export interface RecruitmentReportSourcingStats {
  planName: string | null;
  activeEngagements: number;
  scanRoundsInPeriod: number;
  scannedCandidatesCount: number;
  shortlistedCount: number;
  outreachCount: number;
  outreachQuota: number;
  connectionsSent: number;
  connectionsAccepted: number;
}

/** Thống kê hiệu quả sử dụng Credit mở hồ sơ trong kỳ báo cáo. */
export interface RecruitmentReportCreditStats {
  balance: number;
  consumedInPeriod: number;
  profilesUnlockedInPeriod: number;
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
  /** Điểm khớp cao nhất trong kỳ (0–100). */
  topMatchScore?: number | null;
  /** Số lượng hồ sơ khớp cao ≥ 70% trong kỳ. */
  highMatchCount?: number;
  avgTimeToHireDays: number | null;
  /** Nhận việc / hồ sơ mới trong kỳ, phần trăm 1 chữ số. */
  conversionPct: number | null;
  funnel: RecruitmentReportFunnelStep[];
  trend: RecruitmentReportTrendPoint[];
  jobs: RecruitmentReportJobRow[];
  /** Nguồn ứng viên Săn nhân sự AI & chủ động kết nối. */
  sourcing?: RecruitmentReportSourcingStats;
  /** Hiệu quả sử dụng Credit & mở khóa hồ sơ. */
  credits?: RecruitmentReportCreditStats;
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
  /** Số hồ sơ đang chờ xử lý (Applied + Screening). */
  pendingReviewCount?: number;
  /** Số đề nghị làm việc đang chờ ứng viên phản hồi (Pending). */
  pendingOfferCount?: number;
  /** Số ứng viên nhận việc (Hired) trong tháng hiện tại. */
  hiredThisMonthCount?: number;
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
