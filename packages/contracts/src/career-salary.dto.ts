import type { JobLevelCode, JobTrack } from './career-path';

/** Gợi ý lộ trình nghề nghiệp (Career Engine). */
export interface CareerAdviceRequest {
  /** Ghi đè khối nếu hồ sơ chưa có / muốn xem khối khác. */
  track?: JobTrack;
  /** Ghi đè cấp bậc hiện tại. */
  currentLevel?: JobLevelCode;
}

export interface CareerLadderStepView {
  code: JobLevelCode;
  label: string;
  /** past | current | next | future */
  status: 'past' | 'current' | 'next' | 'future';
}

export interface SalaryBandView {
  min: number;
  max: number;
  currency: 'VND';
  median: number;
}

export interface CareerAdviceView {
  track: JobTrack;
  trackLabel: string;
  currentLevel: JobLevelCode;
  currentLevelLabel: string;
  nextLevel: JobLevelCode | null;
  nextLevelLabel: string | null;
  ladder: CareerLadderStepView[];
  readinessScore: number;
  skillGaps: string[];
  actionPlan: string[];
  summary: string;
  salaryCurrent: SalaryBandView;
  salaryNext: SalaryBandView | null;
  confidence: number;
}

/** Ước lương thị trường (Salary Engine). */
export interface SalaryEstimateRequest {
  jobLevel: JobLevelCode;
  industry?: string;
  location?: string;
  title?: string;
  yearsOfExperience?: number;
}

export interface SalaryEstimateView {
  jobLevel: JobLevelCode;
  jobLevelLabel: string;
  track: JobTrack;
  trackLabel: string;
  salaryMin: number;
  salaryMax: number;
  median: number;
  currency: 'VND';
  factors: string[];
  notes: string;
  confidence: number;
}
