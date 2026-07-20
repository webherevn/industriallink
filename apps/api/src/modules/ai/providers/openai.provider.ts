import type { AiProvider } from '../domain/ai-provider.interface';
import type { JobDraftInput, JobDraftResult, ParsedResume, ResumeParseInput } from '../domain/types';
import {
  buildCareerAdvice,
  buildSalaryEstimate,
  type CareerAdviceEngineInput,
  type SalaryEstimateEngineInput,
} from './career-salary.engine';
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
import type { CareerAdviceView, SalaryEstimateView } from '@industriallink/contracts';

export interface OpenAiOptions {
  apiKey: string;
  model: string;
  embeddingModel: string;
  embeddingDim: number;
}

/** Provider dùng OpenAI Chat Completions + Embeddings API. */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  constructor(private readonly opts: OpenAiOptions) {}

  async parseResume(input: ResumeParseInput): Promise<ParsedResume> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: RESUME_SYSTEM_PROMPT },
          { role: 'user', content: buildResumeUserPrompt(input) },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI chat lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return normalizeParsedResume(extractJson(data.choices[0]?.message?.content ?? ''));
  }

  async generateJobDraft(input: JobDraftInput): Promise<JobDraftResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: JOB_DRAFT_SYSTEM_PROMPT },
          { role: 'user', content: buildJobDraftUserPrompt(input) },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI job draft lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return normalizeJobDraft(extractJson(data.choices[0]?.message?.content ?? ''), input.title);
  }

  async adviseCareer(input: CareerAdviceEngineInput): Promise<CareerAdviceView> {
    return buildCareerAdvice(input);
  }

  async estimateSalary(input: SalaryEstimateEngineInput): Promise<SalaryEstimateView> {
    return buildSalaryEstimate(input);
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.embeddingModel,
        input: text.slice(0, 8000),
        dimensions: this.opts.embeddingDim,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding ?? [];
  }

  async chat(input: { system: string; user: string }): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI chat lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content?.trim() ?? '';
  }
}
