import { CandidateStatus, ResumeParseStatus, SkillLevel } from './enums';
import type {
  B2bExperienceBand,
  CustomerDevStyle,
  DealType,
  JobReadiness,
  ProfileMissingFieldKey,
} from './sales-b2b-criteria';

export interface CandidateSkillView {
  skillId: string | null;
  name: string;
  level: SkillLevel;
  yearsOfExperience: number | null;
}

/** Kinh nghiệm theo từng công ty — ma trận hồ sơ Sales B2B. */
export interface CandidateExperienceView {
  id: string;
  sortOrder: number;
  companyName: string;
  jobTitle: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  sellingStages: string[];
  revenueBand: string | null;
  latestRevenue: number | null;
  kpiBand: string | null;
  kpiAchievementPct: number | null;
  newCustomerRatioBand: string | null;
  newCustomerRatioPct: number | null;
  dealType: DealType | string | null;
  typicalDealValueBand: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  maxDealRole: string | null;
  highlights: string | null;
  jobDescription: string | null;
  missingFields: ProfileMissingFieldKey[] | string[];
  source: 'cv_ai' | 'manual' | string;
}

/** Hồ sơ Sales B2B — tiêu chí lọc / chấm điểm (tổng hợp + cấp hồ sơ). */
export interface CandidateSalesProfileView {
  productsSold: string[];
  customerSegments: string[];
  b2bExperienceBand: B2bExperienceBand | string | null;
  marketsCovered: string[];
  latestRevenue: number | null;
  kpiAchievementPct: number | null;
  salesHighlights: string | null;
  customerDevStyle: CustomerDevStyle | string | null;
  newCustomerRatioPct: number | null;
  dealType: DealType | string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  sellingStages: string[];
  jobReadiness: JobReadiness | string | null;
  availabilityBand: string | null;
  noticePeriodDays: number | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  expectedOte: number | null;
  languages: string[];
  hasB2License: boolean | null;
  driverLicenseType: string | null;
  willingToTravel: boolean | null;
  travelAbility: string | null;
  desiredPositions: string[];
  desiredLocations: string[];
  /** Phong cách & hành vi Sales (câu ưu tiên A–D). */
  salesBehavior: string | null;
  careerMotivations: string[];
  workStyles: string[];
  /** Một hoặc nhiều định hướng (lưu dạng mảng). */
  careerOrientations: string[];
  /** @deprecated dùng careerOrientations */
  careerOrientation: string | null;
}

export interface CandidateProfileView {
  currentPosition: string | null;
  jobLevel: string | null;
  totalExperienceYears: number | null;
  industry: string | null;
  industriesExperienced: string[];
  specialization: string | null;
  summary: string | null;
  careerObjective: string | null;
  birthYear: number | null;
  birthDate: string | null;
  currentCity: string | null;
  district: string | null;
  /** Xã / Phường / Đặc khu (cấp xã mới). */
  ward: string | null;
  phone: string | null;
  educationLevel: string | null;
  educationSchool: string | null;
  educationMajor: string | null;
  certificates: string[];
  hobbies: string[];
  /** sales | technical */
  jobTrack: 'sales' | 'technical' | null;
  brandsTechnologies: string[];
  technicalWorkTypes: string[];
  technicalAutonomyLevel: number | null;
  troubleshootingLevel: number | null;
  technicalTools: string[];
  documentLiteracy: string[];
  systemScaleNote: string | null;
  shiftFlexibility: string | null;
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
  hasAvatar: boolean;
  profile: CandidateProfileView | null;
  aiProfile: CandidateAiProfileView | null;
  skills: CandidateSkillView[];
  experiences: CandidateExperienceView[];
}

export interface CandidateExperienceInput {
  id?: string | null;
  companyName: string;
  jobTitle: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  industries: string[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  sellingStages: string[];
  revenueBand: string | null;
  latestRevenue: number | null;
  kpiBand: string | null;
  kpiAchievementPct: number | null;
  newCustomerRatioBand: string | null;
  newCustomerRatioPct: number | null;
  dealType: string | null;
  typicalDealValueBand: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  maxDealRole: string | null;
  highlights: string | null;
  jobDescription: string | null;
  missingFields?: string[];
  source?: string;
}

/** Payload chỉnh sửa hồ sơ (wizard nhiều bước). */
export interface UpdateCandidateProfileRequest {
  displayName: string;
  phone: string | null;
  birthYear: number | null;
  birthDate?: string | null;
  currentCity: string | null;
  district?: string | null;
  ward?: string | null;
  currentPosition: string | null;
  jobLevel: string | null;
  totalExperienceYears: number | null;
  industry: string | null;
  industriesExperienced: string[];
  specialization: string | null;
  summary: string | null;
  careerObjective: string | null;
  productsSold: string[];
  customerSegments: string[];
  b2bExperienceBand: string | null;
  marketsCovered: string[];
  salesHighlights: string | null;
  customerDevStyle: string | null;
  dealType: string | null;
  latestRevenue: number | null;
  kpiAchievementPct: number | null;
  newCustomerRatioPct: number | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  sellingStages: string[];
  jobReadiness: string | null;
  availabilityBand: string | null;
  noticePeriodDays: number | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  expectedOte: number | null;
  languages: string[];
  hasB2License: boolean | null;
  driverLicenseType: string | null;
  willingToTravel: boolean | null;
  travelAbility: string | null;
  desiredPositions: string[];
  desiredLocations: string[];
  /** Phong cách & hành vi Sales — lưu vào customerDevStyle. */
  salesBehavior?: string | null;
  careerMotivations: string[];
  workStyles: string[];
  /** Định hướng nghề — multi; API ghép vào careerOrientation. */
  careerOrientations?: string[];
  careerOrientation: string | null;
  educationLevel: string | null;
  educationSchool: string | null;
  educationMajor: string | null;
  certificates: string[];
  hobbies?: string[];
  jobTrack?: 'sales' | 'technical' | null;
  brandsTechnologies?: string[];
  technicalWorkTypes?: string[];
  technicalAutonomyLevel?: number | null;
  troubleshootingLevel?: number | null;
  technicalTools?: string[];
  documentLiteracy?: string[];
  systemScaleNote?: string | null;
  shiftFlexibility?: string | null;
  skills: { name: string; level: SkillLevel | string }[];
  experiences: CandidateExperienceInput[];
}

export interface UpdateCandidateProfileResponse {
  message: string;
  candidate: CandidateView;
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
