import type { Logger } from '@nestjs/common';
import type { AppConfig } from '../../../config/configuration';
import type { AiProvider } from '../domain/ai-provider.interface';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { MockAiProvider } from './mock.provider';
import { OpenAiProvider } from './openai.provider';

/** Cấu hình AI đã "giải quyết" (đã trộn DB > env, đã giải mã key). */
export type ResolvedAiConfig = AppConfig['ai'];

export interface BuiltAiProvider {
  provider: AiProvider;
  /** true nếu phải lùi về mock vì provider đã chọn thiếu API key. */
  fellBackToMock: boolean;
}

/**
 * Dựng AiProvider từ cấu hình. Thiếu key của provider đã chọn → lùi về mock
 * để hệ thống vẫn chạy (giống hành vi cũ của AiGatewayService).
 */
export function buildAiProvider(ai: ResolvedAiConfig, logger?: Logger): BuiltAiProvider {
  const dim = ai.embeddingDim;

  switch (ai.provider) {
    case 'openai':
      if (ai.openaiApiKey) {
        return {
          provider: new OpenAiProvider({
            apiKey: ai.openaiApiKey,
            model: ai.openaiModel,
            embeddingModel: ai.openaiEmbeddingModel,
            embeddingDim: dim,
          }),
          fellBackToMock: false,
        };
      }
      break;
    case 'anthropic':
      if (ai.anthropicApiKey) {
        return {
          provider: new AnthropicProvider({
            apiKey: ai.anthropicApiKey,
            model: ai.anthropicModel,
            embeddingDim: dim,
          }),
          fellBackToMock: false,
        };
      }
      break;
    case 'gemini':
      if (ai.geminiApiKey) {
        return {
          provider: new GeminiProvider({
            apiKey: ai.geminiApiKey,
            model: ai.geminiModel,
            embeddingModel: ai.geminiEmbeddingModel,
            embeddingDim: dim,
          }),
          fellBackToMock: false,
        };
      }
      break;
    default:
      break;
  }

  if (ai.provider !== 'mock') {
    logger?.warn(`Thiếu API key cho provider "${ai.provider}", tạm dùng mock.`);
  }
  return { provider: new MockAiProvider(dim), fellBackToMock: ai.provider !== 'mock' };
}
