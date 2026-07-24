/** Kinh nghiệm trên bản nháp CV — gồm trường Sales B2B. */
export interface CvDraftExperienceView {
  role: string;
  company: string;
  period: string;
  /** Mô tả / thành tích (xuống dòng = bullet). */
  bullets: string;
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  sellingStages: string[];
  latestRevenue: number | null;
  kpiAchievementPct: number | null;
}

/** Bản nháp CV do AI trích / nạp từ hồ sơ / chỉnh tay. */
export interface CvDraftView {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  softSkills: string[];
  languages: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  desiredPositions: string[];
  salesHighlights: string;
  experience: CvDraftExperienceView[];
  education: { school: string; degree: string; period: string }[];
  certificates: string[];
  projects: { name: string; detail: string }[];
}

export interface CvDraftFieldHint {
  key: string;
  label: string;
  status: 'filled' | 'missing' | 'weak';
  value: string | null;
  /** Gợi ý bổ sung khi thiếu / yếu. */
  suggestion: string;
}

export interface CvDraftFromTextRequest {
  /** Nội dung ứng viên tự nhập (văn bản tự do). */
  text: string;
}

export interface CvDraftFromTextResponse {
  draft: CvDraftView;
  fields: CvDraftFieldHint[];
  missingCount: number;
  aiScore: number | null;
  message: string;
}

/** Lưu bản nháp CV vào hồ sơ ứng viên (tuỳ chọn từ wizard tạo CV). */
export interface SaveCvDraftToProfileRequest {
  draft: CvDraftView;
}

export interface SaveCvDraftToProfileResponse {
  message: string;
  profileCompletion: number;
}
