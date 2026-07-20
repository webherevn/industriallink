import { CandidateStatus, ResumeParseStatus, SkillLevel } from './enums';
import type {
  B2bExperienceBand,
  CustomerDevStyle,
  DealType,
  JobReadiness,
} from './sales-b2b-criteria';

export interface CandidateSkillView {
  skillId: string | null;
  name: string;
  level: SkillLevel;
  yearsOfExperience: number | null;
}

/** Hồ sơ Sales B2B — tiêu chí lọc / chấm điểm doanh nghiệp công nghiệp VN. */
export interface CandidateSalesProfileView {
  productsSold: string[];
  customerSegments: string[];
  b2bExperienceBand: B2bExperienceBand | string | null;
  marketsCovered: string[];
  /** Thành tích: doanh số gần nhất (VND). */
  latestRevenue: number | null;
  /** % đạt KPI gần nhất. */
  kpiAchievementPct: number | null;
  salesHighlights: string | null;
  customerDevStyle: CustomerDevStyle | string | null;
  /** Tỷ lệ khách mới tự phát triển 0–100. */
  newCustomerRatioPct: number | null;
  dealType: DealType | string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  sellingStages: string[];
  jobReadiness: JobReadiness | string | null;
  noticePeriodDays: number | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  languages: string[];
  hasB2License: boolean | null;
  willingToTravel: boolean | null;
}

export interface CandidateProfileView {
  currentPosition: string | null;
  jobLevel: string | null;
  totalExperienceYears: number | null;
  industry: string | null;
  /** Nhiều ngành đã làm (bộ lọc chính). */
  industriesExperienced: string[];
  specialization: string | null;
  summary: string | null;
  careerObjective: string | null;
  sales: CandidateSalesProfileView | null;
}

export interface CandidateAiProfileView {
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  careerPath: string | null;
  aiScore: number | null;
  confidence: number | null;
  lastAnalyzedAt: string | null;
}

export interface CandidateView {
  id: string;
  code: string;
  displayName: string;
  status: CandidateStatus;
  profileCompletion: number;
  /** true nếu đã tải ảnh đại diện lên hệ thống (không phải Gravatar). */
  hasAvatar: boolean;
  profile: CandidateProfileView | null;
  aiProfile: CandidateAiProfileView | null;
  skills: CandidateSkillView[];
}

export interface UploadAvatarResponse {
  hasAvatar: boolean;
  message: string;
}

export interface ResumeUploadResponse {
  resumeId: string;
  jobId: string;
  status: ResumeParseStatus;
}

/** Kết quả poll trạng thái phân tích CV cho màn hình "AI Resume Analysis". */
export interface ResumeParseStatusResponse {
  resumeId: string;
  status: ResumeParseStatus;
  /** Các bước AI đã hoàn thành, hiển thị dạng checklist tiến trình. */
  steps: ResumeParseStep[];
  candidateId: string | null;
  error: string | null;
}

export interface ResumeParseStep {
  key: string;
  label: string;
  done: boolean;
}
