import type { CareerAdviceView, SalaryEstimateView } from '@industriallink/contracts';
import type {
  CareerAdviceEngineInput,
  SalaryEstimateEngineInput,
} from '../providers/career-salary.engine';
import type { JobDraftInput, JobDraftResult, ParsedResume, ResumeParseInput } from './types';

/**
 * Hợp đồng cho mọi nhà cung cấp AI. Nghiệp vụ chỉ phụ thuộc interface này,
 * nên đổi LLM (OpenAI/Anthropic/Gemini/Local) không phải sửa Domain.
 */
export interface AiProvider {
  readonly name: string;
  /** AI đọc & hiểu CV, trả về hồ sơ có cấu trúc. */
  parseResume(input: ResumeParseInput): Promise<ParsedResume>;
  /** Sinh / chuẩn hoá bản nháp tin tuyển dụng từ tiêu đề + gợi ý. */
  generateJobDraft(input: JobDraftInput): Promise<JobDraftResult>;
  /** Career Engine: lộ trình thăng tiến theo taxonomy VN. */
  adviseCareer(input: CareerAdviceEngineInput): Promise<CareerAdviceView>;
  /** Salary Engine: ước lương theo cấp bậc VN. */
  estimateSalary(input: SalaryEstimateEngineInput): Promise<SalaryEstimateView>;
  /** Sinh vector embedding cho semantic search / matching. */
  embed(text: string): Promise<number[]>;
  /**
   * Chat hoàn thành (RAG Copilot). system + user text thuần,
   * trả lời tiếng Việt dạng văn bản.
   */
  chat(input: { system: string; user: string }): Promise<string>;
}

export const AI_PROVIDER = 'AI_PROVIDER_TOKEN';
