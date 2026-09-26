import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CareerAdviceView, JobModerationAiResult, ParsedSalesJobDraft, ParsedTechnicalJobDraft, SalaryEstimateView } from '@industriallink/contracts';
import type { JobModerationInput } from './providers/job-moderation.util';
import type { AppConfig } from '../../config/configuration';
import type { AiProvider } from './domain/ai-provider.interface';
import type { JobDraftInput, JobDraftResult, JobParseInput, ParsedResume, ResumeParseInput } from './domain/types';
import type {
  CareerAdviceEngineInput,
  SalaryEstimateEngineInput,
} from './providers/career-salary.engine';
import { AiSettingsService } from './ai-settings.service';
import { buildAiProvider } from './providers/ai-provider.factory';

/**
 * AI Gateway: cửa duy nhất để nghiệp vụ gọi AI (Chương 5.13).
 * Chọn provider theo cấu hình; nếu thiếu key thì tự lùi về mock để hệ thống vẫn chạy.
 */
@Injectable()
export class AiGatewayService implements OnModuleInit {
  private readonly logger = new Logger(AiGatewayService.name);
  private provider: AiProvider;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly settings: AiSettingsService,
  ) {
    // Provider tạm từ env để service luôn sẵn sàng ngay khi khởi tạo;
    // onModuleInit() sẽ nạp lại cấu hình từ DB (nếu có) đè lên.
    this.provider = buildAiProvider(this.config.get('ai', { infer: true }), this.logger).provider;
  }

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /**
   * Nạp lại provider theo cấu hình hiện tại (DB > env). Gọi sau khi
   * SuperAdmin cập nhật /admin/ai-settings để đổi provider mà không cần restart.
   */
  async reload(): Promise<void> {
    try {
      const cfg = await this.settings.resolveConfig();
      this.provider = buildAiProvider(cfg, this.logger).provider;
      this.logger.log(`AI Gateway dùng provider: ${this.provider.name}`);
    } catch (err) {
      this.logger.error(`Nạp cấu hình AI thất bại, giữ provider hiện tại: ${String(err)}`);
    }
  }

  parseResume(input: ResumeParseInput): Promise<ParsedResume> {
    return this.provider.parseResume(input);
  }

  generateJobDraft(input: JobDraftInput): Promise<JobDraftResult> {
    return this.provider.generateJobDraft(input);
  }

  parseJobDescription(input: JobParseInput): Promise<ParsedSalesJobDraft | ParsedTechnicalJobDraft> {
    return this.provider.parseJobDescription(input);
  }

  moderateJobPosting(input: JobModerationInput): Promise<JobModerationAiResult> {
    return this.provider.moderateJobPosting(input);
  }

  adviseCareer(input: CareerAdviceEngineInput): Promise<CareerAdviceView> {
    return this.provider.adviseCareer(input);
  }

  estimateSalary(input: SalaryEstimateEngineInput): Promise<SalaryEstimateView> {
    return this.provider.estimateSalary(input);
  }

  embed(text: string): Promise<number[]> {
    return this.provider.embed(text);
  }

  chat(input: { system: string; user: string }): Promise<string> {
    return this.provider.chat(input);
  }

  get providerName(): string {
    return this.provider.name;
  }
}
