import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CareerAdviceView, SalaryEstimateView } from '@industriallink/contracts';
import type { AppConfig } from '../../config/configuration';
import type { AiProvider } from './domain/ai-provider.interface';
import type { JobDraftInput, JobDraftResult, ParsedResume, ResumeParseInput } from './domain/types';
import { AnthropicProvider } from './providers/anthropic.provider';
import type {
  CareerAdviceEngineInput,
  SalaryEstimateEngineInput,
} from './providers/career-salary.engine';
import { GeminiProvider } from './providers/gemini.provider';
import { MockAiProvider } from './providers/mock.provider';
import { OpenAiProvider } from './providers/openai.provider';

/**
 * AI Gateway: cửa duy nhất để nghiệp vụ gọi AI (Chương 5.13).
 * Chọn provider theo cấu hình; nếu thiếu key thì tự lùi về mock để hệ thống vẫn chạy.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly provider: AiProvider;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    this.provider = this.resolveProvider();
    this.logger.log(`AI Gateway dùng provider: ${this.provider.name}`);
  }

  private resolveProvider(): AiProvider {
    const ai = this.config.get('ai', { infer: true });
    const dim = ai.embeddingDim;

    switch (ai.provider) {
      case 'openai':
        if (ai.openaiApiKey) {
          return new OpenAiProvider({
            apiKey: ai.openaiApiKey,
            model: ai.openaiModel,
            embeddingModel: ai.openaiEmbeddingModel,
            embeddingDim: dim,
          });
        }
        break;
      case 'anthropic':
        if (ai.anthropicApiKey) {
          return new AnthropicProvider({
            apiKey: ai.anthropicApiKey,
            model: ai.anthropicModel,
            embeddingDim: dim,
          });
        }
        break;
      case 'gemini':
        if (ai.geminiApiKey) {
          return new GeminiProvider({
            apiKey: ai.geminiApiKey,
            model: ai.geminiModel,
            embeddingDim: dim,
          });
        }
        break;
      default:
        break;
    }

    if (ai.provider !== 'mock') {
      this.logger.warn(`Thiếu API key cho provider "${ai.provider}", tạm dùng mock.`);
    }
    return new MockAiProvider(dim);
  }

  parseResume(input: ResumeParseInput): Promise<ParsedResume> {
    return this.provider.parseResume(input);
  }

  generateJobDraft(input: JobDraftInput): Promise<JobDraftResult> {
    return this.provider.generateJobDraft(input);
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
