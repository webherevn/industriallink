/** Vai trò người dùng trong hệ thống (RBAC). */
export enum UserRole {
  Candidate = 'candidate',
  Recruiter = 'recruiter',
  HiringManager = 'hiring_manager',
  CompanyAdmin = 'company_admin',
  /** Biên tập viên CMS — viết/đăng bài, SEO, không quản trị nền tảng. */
  Editor = 'editor',
  SuperAdmin = 'super_admin',
}

/** Có quyền vào admin CMS (Dashboard / bài viết / SEO…). */
export function isCmsAdminRole(role: UserRole | string): boolean {
  return role === UserRole.SuperAdmin || role === UserRole.Editor;
}

/** Trạng thái vòng đời của tài khoản người dùng. */
export enum UserStatus {
  Created = 'created',
  Verified = 'verified',
  Active = 'active',
  Locked = 'locked',
  Deleted = 'deleted',
}

/** Loại nội dung CMS. */
export enum CmsContentType {
  Post = 'post',
  Page = 'page',
}

/** Trạng thái xuất bản CMS. */
export enum CmsContentStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

/** Phương thức xác thực 2 lớp (MFA) đang bật cho tài khoản. */
export enum MfaMethod {
  /** Gửi mã OTP qua email mỗi lần đăng nhập. */
  EmailOtp = 'email_otp',
  /** Mã TOTP sinh bởi ứng dụng xác thực (Google Authenticator, Authy...). */
  Totp = 'totp',
}

/** Trạng thái vòng đời của ứng viên. */
export enum CandidateStatus {
  Registered = 'registered',
  Completed = 'completed',
  Verified = 'verified',
  Searching = 'searching',
  Archived = 'archived',
}

/** Trạng thái xử lý CV (tương ứng job parse trong hàng đợi). */
export enum ResumeParseStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

/** Mức độ thành thạo kỹ năng. */
export enum SkillLevel {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
  Expert = 'expert',
}

/** Vai trò/quyền của thành viên trong một công ty (permission cấp tổ chức). */
export enum CompanyRole {
  /** Người tạo công ty — toàn quyền, không thể bị gỡ bởi người khác. */
  Owner = 'owner',
  /** Có thể mời/gỡ thành viên, sửa hồ sơ công ty. */
  Admin = 'admin',
  /** Chỉ thao tác nghiệp vụ (đăng tin, xem ứng viên...), không quản trị công ty. */
  Member = 'member',
}

/** Quy mô công ty. */
export enum CompanySize {
  Micro = 'micro', // < 10
  Small = 'small', // 10-50
  Medium = 'medium', // 50-200
  Large = 'large', // 200-1000
  Enterprise = 'enterprise', // > 1000
}

/** Trạng thái tin tuyển dụng. */
export enum JobStatus {
  Draft = 'draft',
  Published = 'published',
  Paused = 'paused',
  Closed = 'closed',
}

/**
 * Trạng thái kiểm duyệt tin tuyển dụng (2 lớp: bộ lọc tĩnh + Gemini).
 * Tách khỏi JobStatus: tin chỉ public khi status=published, và luôn phải
 * đi qua kiểm duyệt trước đó.
 */
export enum JobModerationStatus {
  /** Bản nháp chưa gửi kiểm duyệt (không nằm trong hàng đợi). */
  Draft = 'draft',
  /** Vừa gửi, đang chờ worker xử lý. */
  Pending = 'pending',
  /** AI chấm an toàn → tự động xuất bản. */
  ApprovedAuto = 'approved_auto',
  /** AI nghi ngờ → chờ SuperAdmin duyệt tay. */
  NeedsManualReview = 'needs_manual_review',
  /** Bộ lọc tĩnh hoặc AI chặn tự động. */
  RejectedAuto = 'rejected_auto',
  /** SuperAdmin duyệt tay → xuất bản. */
  ApprovedManual = 'approved_manual',
  /** SuperAdmin từ chối tay. */
  RejectedManual = 'rejected_manual',
}

/** Hành động Gemini đề xuất sau khi phân tích tin. */
export enum JobModerationAction {
  Publish = 'PUBLISH',
  ManualReview = 'MANUAL_REVIEW',
  Reject = 'REJECT',
}

/** Quyết định của SuperAdmin trên hàng đợi duyệt tay. */
export enum JobModerationDecision {
  Approve = 'approve',
  Reject = 'reject',
  BanUser = 'ban_user',
}

/** Hình thức làm việc. */
export enum EmploymentType {
  FullTime = 'full_time',
  PartTime = 'part_time',
  Contract = 'contract',
  Internship = 'internship',
  Seasonal = 'seasonal',
}

/** Khoảng kinh nghiệm yêu cầu trên tin tuyển dụng. */
export enum ExperienceBand {
  None = 'none',
  Under1 = 'under_1',
  From1To3 = '1_3',
  From3To5 = '3_5',
  Over5 = '5_plus',
}

/**
 * Trạng thái hồ sơ ứng tuyển (pipeline tuyển dụng).
 * Thứ tự phản ánh các bước trong quy trình.
 */
export enum ApplicationStatus {
  Applied = 'applied',
  Screening = 'screening',
  Interview = 'interview',
  Offer = 'offer',
  Hired = 'hired',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn',
}

/** Loại buổi phỏng vấn. */
export enum InterviewType {
  Hr = 'hr',
  Technical = 'technical',
  Other = 'other',
}

/** Trạng thái lịch phỏng vấn. */
export enum InterviewStatus {
  Scheduled = 'scheduled',
  Completed = 'completed',
  Cancelled = 'cancelled',
  NoShow = 'no_show',
}

/** Trạng thái đề nghị tuyển dụng (Offer). */
export enum OfferStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
  Withdrawn = 'withdrawn',
  Expired = 'expired',
}

/** Trạng thái onboarding nhân sự mới. */
export enum OnboardingStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/** Trạng thái yêu cầu kết nối NTD ↔ ứng viên. */
export enum ConnectionStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}
