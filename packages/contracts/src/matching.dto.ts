/**
 * Kết quả AI Matching có "giải thích" (explainable) - không chỉ trả điểm số
 * mà nêu lý do vì sao phù hợp (kỹ năng trùng, kỹ năng thiếu, tiêu chí B2B).
 */

/** 16 trường có trọng số — Bảng quy tắc lập trình Engine Matching Sales B2B 10.09.2026. */
export type SalesMatchFieldCode =
  | 'jd01a'
  | 'jd01b'
  | 'jd02'
  | 'jd04'
  | 'jd05'
  | 'jd06'
  | 'jd09'
  | 'jd10'
  | 'jd11'
  | 'jd12'
  | 'jd13'
  | 'jd14'
  | 'jd15'
  | 'jd16'
  | 'jd17'
  | 'jd18';

/** I2 — chi tiết từng trường (S, K, trọng số, điểm). */
export interface SalesMatchFieldDetail {
  truong: SalesMatchFieldCode;
  label: string;
  S: number;
  K: number;
  trong_so: number;
  diem: number;
  canh_bao?: string;
}

/** I3 — công ty được chọn làm nền (G5). */
export interface SalesMatchCompanySummary {
  ten: string;
  P: number;
  D: number;
  R: number;
  E: number;
}

/** 19 trường có trọng số — Bảng quy tắc lập trình Engine Matching Kỹ thuật 21.09.2026. Tiền tố tech. (P5). */
export type TechnicalMatchFieldCode =
  | 'tech.jd01a'
  | 'tech.jd01b'
  | 'tech.jd02'
  | 'tech.jd03'
  | 'tech.jd04'
  | 'tech.jd05'
  | 'tech.jd08'
  | 'tech.jd09'
  | 'tech.jd10'
  | 'tech.jd11'
  | 'tech.jd12'
  | 'tech.jd13'
  | 'tech.jd14'
  | 'tech.jd15'
  | 'tech.jd16'
  | 'tech.jd17'
  | 'tech.jd18'
  | 'tech.jd19'
  | 'tech.jd20';

export interface TechnicalMatchFieldDetail {
  truong: TechnicalMatchFieldCode;
  label: string;
  S: number;
  K: number;
  trong_so: number;
  diem: number;
  canh_bao?: string;
}

export interface TechnicalMatchResult {
  diem_phu_hop: number | null;
  dat_loc_cung: boolean;
  ly_do_loai: string[];
  diem_kinh_nghiem: number | null;
  diem_chung: number | null;
  cong_ty_tot_nhat: SalesMatchCompanySummary | null;
  thuong_be_day: number;
  chi_tiet: TechnicalMatchFieldDetail[];
  khoang_thieu: TechnicalMatchFieldCode[];
  canh_bao: string[];
}

/** I1–I4 — đầu ra engine Sales (không LLM). */
export interface SalesMatchResult {
  /** H6: 1 chữ số thập phân. null khi không đạt lọc cứng (B2). */
  diem_phu_hop: number | null;
  dat_loc_cung: boolean;
  ly_do_loai: string[];
  diem_kinh_nghiem: number | null;
  diem_chung: number | null;
  cong_ty_tot_nhat: SalesMatchCompanySummary | null;
  thuong_be_day: number;
  chi_tiet: SalesMatchFieldDetail[];
  khoang_thieu: SalesMatchFieldCode[];
  /** jd01b không chuẩn hoá được chức danh, v.v. */
  canh_bao: string[];
}

export interface MatchCriterionScore {
  key: string;
  label: string;
  /** Điểm tiêu chí 0–1 (null = không áp dụng / thiếu dữ liệu). */
  score: number | null;
  weight: number;
  note?: string;
}

export interface MatchExplanation {
  /** Điểm phù hợp 0-100. Engine Sales làm tròn 1 chữ số thập phân (H6). */
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
  /** Chi tiết theo tiêu chí Sales B2B (nếu có). */
  criteria?: MatchCriterionScore[];
  /** Kết quả đầy đủ engine 16 trường (gợi ý JD ↔ CV Sales). */
  salesMatch?: SalesMatchResult;
  /** Kết quả đầy đủ engine 19 trường (gợi ý JD ↔ CV Kỹ thuật). */
  technicalMatch?: TechnicalMatchResult;
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
  slug: string;
  code: string;
  title: string;
  companyId: string;
  companySlug: string | null;
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
