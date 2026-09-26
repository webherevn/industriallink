import type {
  JobModerationAction,
  JobModerationDecision,
  JobModerationStatus,
  JobStatus,
} from './enums';

/**
 * Kết quả Gemini trả về (đã ép response_mime_type = application/json).
 * Đây là "single source of truth" cho shape JSON của Lớp 2.
 */
export interface JobModerationAiResult {
  /** 0–100, 100 là cực kỳ nguy hiểm. */
  risk_score: number;
  /** true nếu là việc làm doanh nghiệp B2B thực sự. */
  is_b2b: boolean;
  /** Lý do ngắn gọn giải thích điểm rủi ro. */
  reason: string;
  suggested_action: JobModerationAction;
}

/** Kết quả Lớp 1 (bộ lọc tĩnh, không dùng AI). */
export interface JobStaticFilterResult {
  /** true nếu vi phạm nghiêm trọng → reject ngay, không gọi Gemini. */
  blocked: boolean;
  /** Từ khoá cấm bắt được (đen/spam/đa cấp). */
  bannedHits: string[];
  /** Link Telegram/Zalo phát hiện trong nội dung. */
  contactLinks: string[];
  /** Mô tả quá ngắn (< ngưỡng ký tự). */
  tooShort: boolean;
  /** Lý do tổng hợp để hiển thị cho Admin. */
  reason: string;
}

/** Một dòng trong hàng đợi duyệt tay của SuperAdmin. */
export interface JobModerationQueueItem {
  id: string;
  code: string;
  title: string;
  slug: string | null;
  description: string;
  companyId: string;
  companyName: string;
  companyTrustScore: number;
  status: JobStatus;
  moderationStatus: JobModerationStatus;
  aiRiskScore: number | null;
  aiReason: string | null;
  aiIsB2b: boolean | null;
  aiSuggestedAction: JobModerationAction | null;
  /** Lý do bộ lọc tĩnh (nếu có). */
  moderationNote: string | null;
  createdAt: string;
  moderatedAt: string | null;
  /** Người đăng tin (để có thể khoá tài khoản). */
  submittedByUserId: string | null;
  submittedByEmail: string | null;
}

/** Job moderation tuân theo enum JobModerationDecision cho quyết định. */

export interface JobModerationQueuePage {
  items: JobModerationQueueItem[];
  total: number;
  /** Thống kê nhanh cho badge dashboard. */
  counts: {
    pending: number;
    needsManualReview: number;
    rejectedAuto: number;
    approvedAuto: number;
  };
}

/** Body cho SuperAdmin quyết định 1 tin. */
export interface DecideJobModerationRequest {
  decision: JobModerationDecision;
  /** Ghi chú nội bộ / lý do gửi cho recruiter. */
  note?: string;
}
