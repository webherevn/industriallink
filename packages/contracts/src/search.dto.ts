/**
 * Kết quả AI Search ứng viên — điểm phù hợp kèm giải thích ngắn cho NTD.
 */
import type { MatchCriterionScore } from './matching.dto';

export interface CandidateSearchFilters {
  /** Ngôn ngữ tự nhiên (semantic). */
  q?: string;
  /** Bộ lọc chính */
  industries?: string[];
  products?: string[];
  customerSegments?: string[];
  b2bExperience?: string;
  regions?: string[];
  /** Bộ lọc nâng cao */
  customerDevStyle?: string;
  dealType?: string;
  jobReadiness?: string[];
  /** Điều kiện bổ sung */
  languages?: string[];
  requireB2License?: boolean;
  requireTravel?: boolean;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
}

export interface CandidateSearchResult {
  candidateId: string;
  code: string;
  displayName: string;
  currentPosition: string | null;
  industry: string | null;
  /** Điểm phù hợp 0–1 (semantic + tiêu chí B2B). UI hiển thị % = score * 100. */
  score: number;
  /** Lý do phù hợp ngắn (tiếng Việt). */
  reason: string;
  /** Kỹ năng khớp giữa truy vấn và hồ sơ. */
  matchedSkills: string[];
  /** Chi tiết tiêu chí B2B (nếu có). */
  criteria?: MatchCriterionScore[];
}
