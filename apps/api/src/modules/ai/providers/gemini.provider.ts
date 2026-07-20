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

export interface GeminiOptions {
  apiKey: string;
  model: string;
  embeddingDim: number;
}

/** Provider dùng Google Gemini generateContent API. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(private readonly opts: GeminiOptions) {}

  async parseResume(input: ResumeParseInput): Promise<ParsedResume> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.opts.model}:generateContent?key=${this.opts.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: RESUME_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildResumeUserPrompt(input) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    const text = data.candidates[0]?.content?.parts?.[0]?.text ?? '';
    return normalizeParsedResume(extractJson(text));
  }

  async generateJobDraft(input: JobDraftInput): Promise<JobDraftResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.opts.model}:generateContent?key=${this.opts.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: JOB_DRAFT_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildJobDraftUserPrompt(input) }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini job draft lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    const text = data.candidates[0]?.content?.parts?.[0]?.text ?? '';
    return normalizeJobDraft(extractJson(text), input.title);
  }

  async adviseCareer(input: CareerAdviceEngineInput): Promise<CareerAdviceView> {
    return buildCareerAdvice(input);
  }

  async estimateSalary(input: SalaryEstimateEngineInput): Promise<SalaryEstimateView> {
    return buildSalaryEstimate(input);
  }

  async embed(text: string): Promise<number[]> {
    // Có thể thay bằng text-embedding-004; tạm dùng phương án cục bộ để đồng nhất số chiều.
    return deterministicEmbedding(text, this.opts.embeddingDim);
  }

  async chat(input: { system: string; user: string }): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.opts.model}:generateContent?key=${this.opts.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: 'user', parts: [{ text: input.user }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini chat lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim() ?? '';
  }
}
