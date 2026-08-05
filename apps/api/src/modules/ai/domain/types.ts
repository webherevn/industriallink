import type { EmploymentType, SkillLevel } from '@industriallink/contracts';

export interface ParsedResumeSkill {
  name: string;
  level: SkillLevel;
  yearsOfExperience: number | null;
}

export interface ParsedResumeEducation {
  school: string;
  degree: string | null;
  major: string | null;
  level: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface ParsedResumeProject {
  name: string;
  detail: string | null;
}

/** Kinh nghiệm theo từng công ty — AI trích từ CV. */
export interface ParsedResumeExperience {
  companyName: string;
  jobTitle: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  industries: string[];
  sellingStages: string[];
  latestRevenue: number | null;
  kpiAchievementPct: number | null;
  newCustomerRatioPct: number | null;
  dealType: string | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  /** Thành tích / kết quả nổi bật. */
  highlights: string | null;
  /** Mô tả công việc đầy đủ (nhiệm vụ chi tiết). */
  jobDescription: string | null;
  /** Danh sách nhiệm vụ từng dòng — ưu tiên trích nguyên văn từ CV. */
  responsibilities: string[];
  /** Field AI chưa đọc được → ứng viên bổ sung. */
  missingFields: string[];
}

/** Liên hệ / định danh trích từ CV. */
export interface ParsedResumeContact {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  /** Tỉnh / thành phố (34 đơn vị cấp tỉnh mới). */
  currentCity: string | null;
  /** Huyện (tuỳ chọn — có thể trống sau cải cách). */
  district: string | null;
  /** Xã / Phường / Đặc khu (cấp xã mới). */
  ward: string | null;
  birthYear: number | null;
  /** Ngày sinh đầy đủ nếu có (ưu tiên ISO YYYY-MM-DD). */
  birthDate: string | null;
}

/** Kết quả AI "hiểu" một CV (không chỉ OCR/parse text). */
export interface ParsedResume {
  contact: ParsedResumeContact;
  summary: string;
  careerObjective: string | null;
  currentPosition: string | null;
  jobLevel: string | null;
  totalExperienceYears: number | null;
  b2bExperienceBand: string | null;
  industry: string | null;
  specialization: string | null;
  skills: ParsedResumeSkill[];
  softSkills: string[];
  experiences: ParsedResumeExperience[];
  education: ParsedResumeEducation[];
  certificates: string[];
  languages: string[];
  /** Sở thích cá nhân (đọc sách, bóng đá...). */
  hobbies: string[];
  projects: ParsedResumeProject[];
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  industriesExperienced: string[];
  sellingStages: string[];
  desiredPositions: string[];
  desiredLocations: string[];
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  expectedOte: number | null;
  hasB2License: boolean | null;
  driverLicenseType: string | null;
  travelAbility: string | null;
  jobReadiness: string | null;
  availabilityBand: string | null;
  salesHighlights: string | null;
  strengths: string[];
  weaknesses: string[];
  careerPath: string | null;
  /** sales | technical — AI nhận diện lĩnh vực. */
  jobTrack: 'sales' | 'technical' | null;
  brandsTechnologies: string[];
  technicalWorkTypes: string[];
  technicalAutonomyLevel: number | null;
  troubleshootingLevel: number | null;
  technicalTools: string[];
  documentLiteracy: string[];
  systemScaleNote: string | null;
  shiftFlexibility: string | null;
  /** Điểm tổng 0-100. */
  aiScore: number;
  /** Độ tin cậy 0-1. */
  confidence: number;
}

export interface ResumeParseInput {
  fileName: string;
  /** Nội dung văn bản trích từ CV (rỗng nếu chưa trích được). */
  text: string;
  /** Bytes gốc (PDF/DOCX) — Gemini multimodal dùng khi text mỏng hoặc PDF. */
  fileBytes?: Buffer;
  mimeType?: string;
}

/** Đầu vào AI soạn / chuẩn hoá tin tuyển dụng. */
export interface JobDraftInput {
  title: string;
  industry?: string;
  jobLevel?: string;
  location?: string;
  employmentType?: EmploymentType;
  hints?: string;
  existingDescription?: string;
  existingRequirements?: string;
  existingBenefits?: string;
  existingSkills?: string[];
}

export interface JobDraftSkill {
  name: string;
  required: boolean;
}

/** Kết quả AI gợi ý nội dung JD. */
export interface JobDraftResult {
  title?: string;
  description: string;
  requirements: string;
  benefits: string;
  skills: JobDraftSkill[];
  suggestedSalaryMin?: number;
  suggestedSalaryMax?: number;
  notes?: string;
}
