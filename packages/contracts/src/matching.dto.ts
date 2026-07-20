/**
 * Kết quả AI Matching có "giải thích" (explainable) - không chỉ trả điểm số
 * mà nêu lý do vì sao phù hợp (kỹ năng trùng, kỹ năng thiếu, tiêu chí B2B).
 */
export interface MatchCriterionScore {
  key: string;
  label: string;
  /** Điểm tiêu chí 0–1 (null = không áp dụng / thiếu dữ liệu). */
  score: number | null;
  weight: number;
  note?: string;
}

export interface MatchExplanation {
  /** Điểm phù hợp 0-100. */
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
  /** Chi tiết theo tiêu chí Sales B2B (nếu có). */
  criteria?: MatchCriterionScore[];
}

/** Ứng viên được AI gợi ý cho một tin tuyển dụng. */
export interface CandidateMatchView {
  candidateId: string;
  displayName: string;
  currentPosition: string | null;
  industry: string | null;
  match: MatchExplanation;
}

/** Tin tuyển dụng được AI gợi ý cho một ứng viên. */
export interface JobMatchView {
  jobId: string;
  code: string;
  title: string;
  companyId: string;
  companyName: string;
  location: string | null;
  industry: string | null;
  jobLevel: string | null;
  experienceBand: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  /** Tên kỹ năng yêu cầu (rút gọn cho thẻ tin). */
  skills: string[];
  publishedAt: string | null;
  match: MatchExplanation;
}
