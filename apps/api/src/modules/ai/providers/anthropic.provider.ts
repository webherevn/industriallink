import type { CareerAdviceView, SalaryEstimateView } from '@industriallink/contracts';
import type { AiProvider } from '../domain/ai-provider.interface';
import type { JobDraftInput, JobDraftResult, ParsedResume, ResumeParseInput } from '../domain/types';
import {
  buildCareerAdvice,
  buildSalaryEstimate,
  type CareerAdviceEngineInput,
  type SalaryEstimateEngineInput,
} from './career-salary.engine';
import { deterministicEmbedding } from './embedding.util';
import {
  JOB_DRAFT_SYSTEM_PROMPT,
  buildJobDraftUserPrompt,
  normalizeJobDraft,
} from './llm-job-draft.util';
import {
  RESUME_SYSTEM_PROMPT,
  buildResumeUserPrompt,
  extractJson,
  normalizeParsedResume,
} from './llm-parse.util';

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  embeddingDim: number;
}

/**
 * Provider dùng Anthropic Messages API.
 * Anthropic không cung cấp embeddings, nên embedding dùng phương án cục bộ
 * (có thể thay bằng Voyage AI ở giai đoạn sau).
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(private readonly opts: AnthropicOptions) {}

  async parseResume(input: ResumeParseInput): Promise<ParsedResume> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.opts.model,
        max_tokens: 1500,
        system: RESUME_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildResumeUserPrompt(input) }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content: { text: string }[] };
    return normalizeParsedResume(extractJson(data.content[0]?.text ?? ''));
  }

  async generateJobDraft(input: JobDraftInput): Promise<JobDraftResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.opts.model,
        max_tokens: 2000,
        system: JOB_DRAFT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildJobDraftUserPrompt(input) }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic job draft lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content: { text: string }[] };
    return normalizeJobDraft(extractJson(data.content[0]?.text ?? ''), input.title);
  }

  async adviseCareer(input: CareerAdviceEngineInput): Promise<CareerAdviceView> {
    return buildCareerAdvice(input);
  }

  async estimateSalary(input: SalaryEstimateEngineInput): Promise<SalaryEstimateView> {
    return buildSalaryEstimate(input);
  }

  async embed(text: string): Promise<number[]> {
    return deterministicEmbedding(text, this.opts.embeddingDim);
  }

  async chat(input: { system: string; user: string }): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.opts.model,
        max_tokens: 1200,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic chat lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.find((c) => c.type === 'text')?.text?.trim() ?? '';
  }
}
