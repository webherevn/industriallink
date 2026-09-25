import type { JobLevelCode, JobTrack } from './career-path';
import { EmploymentType, ExperienceBand, JobStatus } from './enums';
import type { JobSalesCriteria, ParsedSalesJobDraft } from './jd-sales-matching';
import type { JobTechnicalCriteria, ParsedTechnicalJobDraft } from './jd-technical-matching';

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
  /** Ngành chi tiết trong nhóm (INDUSTRY_CATALOG.subIndustries). */
  subIndustry?: string;
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
  /** sales | technical — lọc tin; JD Sales không hiện cấp bậc trên form. */
  jobTrack?: JobTrack | string;
  /** 22 trường matching Sales (nhóm B/C + ngành đa chọn) — JSON. */
  salesCriteria?: JobSalesCriteria;
  /** 23 trường matching Kỹ thuật (nhóm B/C + ngành đa chọn) — JSON. */
  technicalCriteria?: JobTechnicalCriteria;
  /** true để đăng công khai ngay; false để lưu nháp. */
  publish?: boolean;
}

/** Cập nhật tin tuyển dụng (toàn bộ trường nội dung). */
export type UpdateJobRequest = Omit<CreateJobRequest, 'publish'>;

/** Đổi trạng thái tin: published | paused | closed | draft. */
export interface UpdateJobStatusRequest {
  status: JobStatus.Published | JobStatus.Paused | JobStatus.Closed | JobStatus.Draft;
}

export interface JobSkillView {
  skillId: string | null;
  name: string;
  required: boolean;
  weight: number;
}

export interface JobView {
  id: string;
  slug: string;
  code: string;
  companyId: string;
  companySlug: string | null;
  companyName: string;
  title: string;
  description: string;
  requirements: string | null;
  benefits: string | null;
  industry: string | null;
  subIndustry: string | null;
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
  jobTrack: string | null;
  salesCriteria: JobSalesCriteria | null;
  technicalCriteria: JobTechnicalCriteria | null;
  skills: JobSkillView[];
  createdAt: string;
  publishedAt: string | null;
  companyWebsite: string | null;
  companyAddress: string | null;
  companyHasLogo: boolean;
  /** Chỉ có khi ứng viên đang đăng nhập xem: đã ứng tuyển hay chưa. */
  hasApplied?: boolean;
}

export interface JobListItem {
  id: string;
  slug: string;
  code: string;
  title: string;
  companyId: string;
  companySlug: string | null;
  companyName: string;
  industry: string | null;
  subIndustry: string | null;
  jobLevel: string | null;
  location: string | null;
  employmentType: EmploymentType | null;
  experienceBand: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: JobStatus;
  jobTrack: string | null;
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
  /** Ngành chi tiết trong nhóm (lọc contains trên mô tả tin). */
  subIndustry?: string;
  /** Vị trí điển hình (lọc contains trên title/mô tả/skill). */
  role?: string;
  /** Một địa điểm (tương thích ngược). */
  location?: string;
  /** Nhiều địa điểm (CSV trên query string `locations`). */
  locations?: string[];
  /** Một hoặc nhiều ExperienceBand, cách nhau bởi dấu phẩy. */
  experienceBand?: string;
  /** Một hoặc nhiều JobLevelCode, cách nhau bởi dấu phẩy. */
  jobLevel?: string;
  /** sales | technical — lọc theo tiền tố jobLevel. */
  jobTrack?: string;
  salaryMin?: number;
  salaryMax?: number;
}

export interface JobPositionCount {
  title: string;
  count: number;
}

/** Thống kê vị trí đang tuyển — lấy từ tin published trên nền tảng. */
export interface JobPositionStatsView {
  popular: JobPositionCount[];
  byIndustry: Array<{
    industry: string;
    positions: JobPositionCount[];
  }>;
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

/** Yêu cầu AI trích 22 trường JD Sales hoặc 23 trường JD Kỹ thuật từ văn bản. */
export type ParseJobDescriptionFromTextRequest = {
  text: string;
  jobTrack?: JobTrack | string;
};

/** Kết quả AI đọc JD (upload PDF/DOCX hoặc dán text). */
export type ParseJobDescriptionResponse = ParsedSalesJobDraft | ParsedTechnicalJobDraft;
