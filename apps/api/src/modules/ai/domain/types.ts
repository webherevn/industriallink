import type { EmploymentType, SkillLevel } from '@industriallink/contracts';

export interface ParsedResumeSkill {
  name: string;
  level: SkillLevel;
  yearsOfExperience: number | null;
}

/** Kết quả AI "hiểu" một CV (không chỉ OCR/parse text). */
export interface ParsedResume {
  summary: string;
  currentPosition: string | null;
  jobLevel: string | null;
  totalExperienceYears: number | null;
  industry: string | null;
  specialization: string | null;
  skills: ParsedResumeSkill[];
  strengths: string[];
  weaknesses: string[];
  careerPath: string | null;
  /** Điểm tổng 0-100. */
  aiScore: number;
  /** Độ tin cậy 0-1. */
  confidence: number;
}

export interface ResumeParseInput {
  fileName: string;
  /** Nội dung văn bản trích từ CV (rỗng nếu chưa trích được). */
  text: string;
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
