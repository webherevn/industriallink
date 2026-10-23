import type { JobLevelCode, JobTrack } from './career-path';

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
