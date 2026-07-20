import type { JobLevelCode } from './career-path';
import { EmploymentType, ExperienceBand, JobStatus } from './enums';

export interface JobSkillInput {
  name: string;
  required?: boolean;
  weight?: number;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  requirements?: string;
  benefits?: string;
  industry?: string;
  department?: string;
  /** Mã cấp bậc theo lộ trình VN (JobLevelCode). */
  jobLevel?: JobLevelCode | string;
  employmentType?: EmploymentType;
  location?: string;
  headcount?: number;
  deadline?: string;
  experienceBand?: ExperienceBand | string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: JobSkillInput[];
  /** true để đăng công khai ngay; false để lưu nháp. */
  publish?: boolean;
}

export interface JobSkillView {
  skillId: string | null;
  name: string;
  required: boolean;
  weight: number;
}

export interface JobView {
  id: string;
  code: string;
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  requirements: string | null;
  benefits: string | null;
  industry: string | null;
  department: string | null;
  jobLevel: string | null;
  employmentType: EmploymentType | null;
  location: string | null;
  headcount: number | null;
  deadline: string | null;
  experienceBand: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: JobStatus;
  skills: JobSkillView[];
  createdAt: string;
  /** Chỉ có khi ứng viên đang đăng nhập xem: đã ứng tuyển hay chưa. */
  hasApplied?: boolean;
}

export interface JobListItem {
  id: string;
  code: string;
  title: string;
  companyId: string;
  companyName: string;
  industry: string | null;
  jobLevel: string | null;
  location: string | null;
  employmentType: EmploymentType | null;
  experienceBand: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: JobStatus;
  /** Tên kỹ năng (rút gọn cho thẻ tin). */
  skills: string[];
  createdAt: string;
  publishedAt: string | null;
  /** Tin đăng trong 48h gần nhất. */
  isNew: boolean;
  /** Chỉ có khi ứng viên đã đăng nhập và đã lưu tin. */
  isBookmarked?: boolean;
}

/** Tham số lọc danh sách tin công khai. */
export interface ListPublishedJobsQuery {
  keyword?: string;
  industry?: string;
  location?: string;
  /** Một hoặc nhiều ExperienceBand, cách nhau bởi dấu phẩy. */
  experienceBand?: string;
  /** Một hoặc nhiều JobLevelCode, cách nhau bởi dấu phẩy. */
  jobLevel?: string;
  /** sales | technical — lọc theo tiền tố jobLevel. */
  jobTrack?: string;
  salaryMin?: number;
  salaryMax?: number;
}

/** Yêu cầu AI soạn / chuẩn hoá bản nháp tin tuyển dụng. */
export interface GenerateJobDraftRequest {
  /** Chức danh — bắt buộc. */
  title: string;
  industry?: string;
  jobLevel?: JobLevelCode | string;
  location?: string;
  employmentType?: EmploymentType;
  /** Gợi ý tự do: kỹ năng, nhiệm vụ, môi trường làm việc… */
  hints?: string;
  /** Bản nháp hiện có — nếu có, AI sẽ chuẩn hoá / làm rõ. */
  existingDescription?: string;
  existingRequirements?: string;
  existingBenefits?: string;
  existingSkills?: string[];
}

export interface GenerateJobDraftSkill {
  name: string;
  required?: boolean;
}

/** Kết quả AI gợi ý nội dung tin tuyển dụng. */
export interface GenerateJobDraftResponse {
  title?: string;
  description: string;
  requirements: string;
  benefits: string;
  skills: GenerateJobDraftSkill[];
  suggestedSalaryMin?: number;
  suggestedSalaryMax?: number;
  /** Gợi ý ngắn cho nhà tuyển dụng (tuỳ chọn). */
  notes?: string;
}
