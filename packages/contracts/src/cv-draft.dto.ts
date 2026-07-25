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
  newCustomerRatioPct: number | null;
  dealType: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
}

/** Bản nháp CV do AI trích / nạp từ hồ sơ / chỉnh tay — đủ ma trận ~39 mục. */
export interface CvDraftView {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  birthYear: number | null;
  educationLevel: string | null;
  skills: string[];
  softSkills: string[];
  languages: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  industriesExperienced: string[];
  desiredPositions: string[];
  desiredLocations: string[];
  salesHighlights: string;
  b2bExperienceBand: string | null;
  newCustomerRatioPct: number | null;
  dealType: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  jobReadiness: string | null;
  availabilityBand: string | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  expectedOte: number | null;
  travelAbility: string | null;
  hasB2License: boolean | null;
  driverLicenseType: string | null;
  /** Phong cách & hành vi Sales (assessment). */
  salesBehavior: string | null;
  careerMotivations: string[];
  careerOrientations: string[];
  /** Phù hợp văn hóa — lưu các đáp án assessment. */
  workStyles: string[];
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
