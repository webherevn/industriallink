/**
 * Tên sự kiện miền (domain events), có phiên bản (versioned).
 *
 * Quy ước: `<Domain>.<Event>.v<n>`. Khi payload thay đổi phá vỡ tương thích,
 * tăng version (v2, v3...) thay vì sửa event cũ, để service đang lắng nghe không bị hỏng.
 */
export const DomainEvents = {
  // Identity
  UserRegistered: 'identity.UserRegistered.v1',
  UserLoggedIn: 'identity.UserLoggedIn.v1',
  /** OTP đã phát hành — Notification gửi email (không kèm plaintext trong payload). */
  OtpIssued: 'identity.OtpIssued.v1',

  // Candidate
  CandidateCreated: 'candidate.CandidateCreated.v1',
  CandidateUpdated: 'candidate.CandidateUpdated.v1',
  ResumeUploaded: 'candidate.ResumeUploaded.v1',
  ResumeParsed: 'candidate.ResumeParsed.v1',

  // Company
  CompanyCreated: 'company.CompanyCreated.v1',

  // Recruitment
  JobPublished: 'recruitment.JobPublished.v1',
  JobUpdated: 'recruitment.JobUpdated.v1',
  ApplicationSubmitted: 'recruitment.ApplicationSubmitted.v1',
  ApplicationStatusChanged: 'recruitment.ApplicationStatusChanged.v1',
  InterviewScheduled: 'recruitment.InterviewScheduled.v1',
  InterviewUpdated: 'recruitment.InterviewUpdated.v1',
  OfferSent: 'recruitment.OfferSent.v1',
  OfferUpdated: 'recruitment.OfferUpdated.v1',
  OnboardingStarted: 'recruitment.OnboardingStarted.v1',
  OnboardingUpdated: 'recruitment.OnboardingUpdated.v1',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];

/** Cấu trúc phong bì (envelope) chuẩn cho mọi sự kiện phát qua Event Bus. */
export interface DomainEventEnvelope<TPayload = unknown> {
  /** Tên sự kiện có version, ví dụ candidate.ResumeParsed.v1 */
  name: DomainEventName;
  /** ID sự kiện (UUID) để idempotency / trace. */
  eventId: string;
  /** Correlation ID để lần theo toàn bộ luồng xử lý. */
  correlationId: string;
  /** Định danh tenant (đa thuê). */
  tenantId: string;
  /** Thời điểm phát sự kiện (ISO 8601). */
  occurredAt: string;
  /** Dữ liệu nghiệp vụ kèm theo. */
  payload: TPayload;
}
