import {
  JobModerationAction,
  type JobModerationAiResult,
} from '@industriallink/contracts';

/** Đầu vào cho moderation (đã gộp nội dung tin). */
export interface JobModerationInput {
  title: string;
  description: string;
  requirements?: string | null;
  benefits?: string | null;
  companyName?: string | null;
  /** Lý do bộ lọc tĩnh (nếu có) — đưa vào prompt để AI tham chiếu. */
  staticFilterNote?: string | null;
}

/** System prompt kiểm duyệt tin B2B (yêu cầu trả JSON thuần). */
export const JOB_MODERATION_SYSTEM_PROMPT = `Bạn là hệ thống kiểm duyệt tin tuyển dụng B2B. Hãy đọc nội dung sau và phân tích theo 3 tiêu chí:
1. Dấu hiệu lừa đảo đa cấp (thu tiền cọc, tải app, tuyển tuyến dưới).
2. Dấu hiệu spam (nội dung vô nghĩa, lặp lại, câu kéo).
3. Tính phù hợp ngữ cảnh B2B (đây có phải việc làm doanh nghiệp hay việc vặt online?).

Trả về ĐÚNG định dạng JSON sau, không kèm bất kỳ text nào khác:
{
  "risk_score": (số từ 0-100, 100 là cực kỳ nguy hiểm),
  "is_b2b": (boolean, true/false),
  "reason": (chuỗi ngắn gọn giải thích lý do chấm điểm rủi ro, tiếng Việt),
  "suggested_action": ("PUBLISH", "MANUAL_REVIEW", "REJECT")
}`;

/** Ghép nội dung tin thành user prompt. */
export function buildJobModerationUserPrompt(input: JobModerationInput): string {
  const parts = [
    input.companyName ? `Công ty: ${input.companyName}` : null,
    `Tiêu đề: ${input.title}`,
    `Mô tả:\n${input.description}`,
    input.requirements ? `Yêu cầu:\n${input.requirements}` : null,
    input.benefits ? `Quyền lợi:\n${input.benefits}` : null,
    input.staticFilterNote ? `Cảnh báo bộ lọc tĩnh: ${input.staticFilterNote}` : null,
  ].filter(Boolean);
  return parts.join('\n\n');
}

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function normalizeAction(value: unknown, riskScore: number): JobModerationAction {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === JobModerationAction.Publish) return JobModerationAction.Publish;
  if (raw === JobModerationAction.Reject) return JobModerationAction.Reject;
  if (raw === JobModerationAction.ManualReview) return JobModerationAction.ManualReview;
  // Suy diễn từ risk_score nếu model trả sai định dạng.
  if (riskScore >= 70) return JobModerationAction.Reject;
  if (riskScore >= 40) return JobModerationAction.ManualReview;
  return JobModerationAction.Publish;
}

/** Chuẩn hoá kết quả AI về shape an toàn, không tin dữ liệu thô từ model. */
export function normalizeJobModerationResult(raw: unknown): JobModerationAiResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const riskScore = clampScore(obj.risk_score);
  return {
    risk_score: riskScore,
    is_b2b: Boolean(obj.is_b2b),
    reason:
      typeof obj.reason === 'string' && obj.reason.trim()
        ? obj.reason.trim().slice(0, 500)
        : 'Không có lý do cụ thể từ AI.',
    suggested_action: normalizeAction(obj.suggested_action, riskScore),
  };
}
