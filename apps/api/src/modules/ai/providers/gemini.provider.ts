import { Logger } from '@nestjs/common';
import type { CareerAdviceView, ParsedSalesJobDraft, ParsedTechnicalJobDraft, SalaryEstimateView } from '@industriallink/contracts';
import type { AiProvider } from '../domain/ai-provider.interface';
import type { JobDraftInput, JobDraftResult, JobParseInput, ParsedResume, ResumeParseInput } from '../domain/types';
import {
  buildCareerAdvice,
  buildSalaryEstimate,
  type CareerAdviceEngineInput,
  type SalaryEstimateEngineInput,
} from './career-salary.engine';
import { deterministicEmbedding } from './embedding.util';
import {
  JOB_PARSE_SYSTEM_PROMPT,
  buildJobParseUserPrompt,
  normalizeParsedSalesJob,
} from './llm-job-parse.util';
import {
  JOB_PARSE_TECHNICAL_SYSTEM_PROMPT,
  buildTechnicalJobParseUserPrompt,
  normalizeParsedTechnicalJob,
} from './llm-job-parse-technical.util';
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
import {
  JOB_MODERATION_SYSTEM_PROMPT,
  buildJobModerationUserPrompt,
  normalizeJobModerationResult,
  type JobModerationInput,
} from './job-moderation.util';
import type { JobModerationAiResult } from '@industriallink/contracts';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  embeddingModel: string;
  embeddingDim: number;
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Dự phòng khi model chính (vd. gemini-3.6-flash) bị 503/429. */
export const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;

export function geminiModelsToTry(primary: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [primary, ...GEMINI_FALLBACK_MODELS]) {
    const model = raw.trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

export function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 503;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gemini hỗ trợ đọc trực tiếp PDF / ảnh (không phụ thuộc OCR cục bộ). */
const MULTIMODAL_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

/** Giới hạn inline ~18MB base64 an toàn cho generateContent. */
const MAX_INLINE_BYTES = 15 * 1024 * 1024;

/** Gemini 3.x bỏ / bỏ qua temperature — chỉ gửi config tối thiểu. */
function generationConfigFor(
  model: string,
  extras: Record<string, unknown> = {},
  temperature?: number,
) {
  const isGemini3 = /^gemini-3/i.test(model);
  if (isGemini3) {
    return { ...extras };
  }
  return {
    temperature: temperature ?? 0.2,
    ...extras,
  };
}

function normalizeMime(mime?: string): string {
  return (mime ?? '').split(';')[0].trim().toLowerCase();
}

/** Provider dùng Google Gemini generateContent + embedContent API. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly opts: GeminiOptions) {}

  private modelUrl(method: 'generateContent' | 'embedContent', model = this.opts.model): string {
    return `${API_BASE}/models/${model}:${method}?key=${this.opts.apiKey}`;
  }

  private async generateContent(
    model: string,
    system: string,
    userParts: Array<Record<string, unknown>>,
    extras: Record<string, unknown>,
    temperature?: number,
  ): Promise<Response> {
    return fetch(this.modelUrl('generateContent', model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: generationConfigFor(model, extras, temperature),
      }),
    });
  }

  private async generateWithRetry(
    system: string,
    userParts: Array<Record<string, unknown>>,
    extras: Record<string, unknown> = {},
    temperature = 0.2,
  ): Promise<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }> {
    const models = geminiModelsToTry(this.opts.model);
    let lastStatus = 0;
    let lastBody = '';
    for (const model of models) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const res = await this.generateContent(model, system, userParts, extras, temperature);
        if (res.ok) {
          if (model !== this.opts.model) {
            this.logger.warn(`Gemini model ${this.opts.model} lỗi, đã dùng ${model}`);
          }
          return (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
        }
        lastStatus = res.status;
        lastBody = await res.text();
        if (isRetryableGeminiStatus(res.status) && attempt < 3) {
          this.logger.warn(`Gemini ${model} ${res.status}, thử lại lần ${attempt + 1}`);
          await delay(400 * 2 ** (attempt - 1));
          continue;
        }
        if (isRetryableGeminiStatus(res.status)) break;
        throw new Error(`Gemini lỗi ${res.status}: ${lastBody}`);
      }
    }
    throw new Error(`Gemini lỗi ${lastStatus}: ${lastBody}`);
  }

  private async generateJson(
    system: string,
    userParts: Array<Record<string, unknown>>,
    temperature = 0.2,
  ): Promise<unknown> {
    const data = await this.generateWithRetry(
      system,
      userParts,
      { responseMimeType: 'application/json' },
      temperature,
    );
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return extractJson(text);
  }

  async parseResume(input: ResumeParseInput): Promise<ParsedResume> {
    const parts: Array<Record<string, unknown>> = [{ text: buildResumeUserPrompt(input) }];

    const mime = normalizeMime(input.mimeType);
    const bytes = input.fileBytes;
    const textThin = (input.text?.trim().length ?? 0) < 80;
    const shouldAttachFile =
      Boolean(bytes?.length) &&
      bytes!.length <= MAX_INLINE_BYTES &&
      MULTIMODAL_MIME.has(mime) &&
      (textThin || mime === 'application/pdf');

    if (shouldAttachFile && bytes) {
      parts.unshift({
        inlineData: {
          mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
          data: bytes.toString('base64'),
        },
      });
    }

    const raw = await this.generateJson(RESUME_SYSTEM_PROMPT, parts, 0.1);
    return normalizeParsedResume(raw);
  }

  async generateJobDraft(input: JobDraftInput): Promise<JobDraftResult> {
    const raw = await this.generateJson(
      JOB_DRAFT_SYSTEM_PROMPT,
      [{ text: buildJobDraftUserPrompt(input) }],
      0.4,
    );
    return normalizeJobDraft(raw, input.title);
  }

  async parseJobDescription(input: JobParseInput): Promise<ParsedSalesJobDraft | ParsedTechnicalJobDraft> {
    const isTech = input.track === 'technical';
    const parts: Array<Record<string, unknown>> = [
      { text: isTech ? buildTechnicalJobParseUserPrompt(input) : buildJobParseUserPrompt(input) },
    ];
    const mime = normalizeMime(input.mimeType);
    const bytes = input.fileBytes;
    const textThin = (input.text?.trim().length ?? 0) < 80;
    const shouldAttachFile =
      Boolean(bytes?.length) &&
      bytes!.length <= MAX_INLINE_BYTES &&
      MULTIMODAL_MIME.has(mime) &&
      (textThin || mime === 'application/pdf');

    if (shouldAttachFile && bytes) {
      parts.unshift({
        inlineData: {
          mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
          data: bytes.toString('base64'),
        },
      });
    }

    const raw = await this.generateJson(
      isTech ? JOB_PARSE_TECHNICAL_SYSTEM_PROMPT : JOB_PARSE_SYSTEM_PROMPT,
      parts,
      0.1,
    );
    return isTech
      ? normalizeParsedTechnicalJob(raw, input.text)
      : normalizeParsedSalesJob(raw, input.text);
  }

  async moderateJobPosting(input: JobModerationInput): Promise<JobModerationAiResult> {
    const raw = await this.generateJson(
      JOB_MODERATION_SYSTEM_PROMPT,
      [{ text: buildJobModerationUserPrompt(input) }],
      0,
    );
    return normalizeJobModerationResult(raw);
  }

  async adviseCareer(input: CareerAdviceEngineInput): Promise<CareerAdviceView> {
    return buildCareerAdvice(input);
  }

  async estimateSalary(input: SalaryEstimateEngineInput): Promise<SalaryEstimateView> {
    return buildSalaryEstimate(input);
  }

  async embed(text: string): Promise<number[]> {
    try {
      const res = await fetch(this.modelUrl('embedContent', this.opts.embeddingModel), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: this.opts.embeddingDim,
        }),
      });
      if (!res.ok) {
        // Fallback local nếu model/embedding không hỗ trợ outputDimensionality
        const fallback = await fetch(this.modelUrl('embedContent', this.opts.embeddingModel), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text: text.slice(0, 8000) }] },
          }),
        });
        if (!fallback.ok) {
          return deterministicEmbedding(text, this.opts.embeddingDim);
        }
        const data = (await fallback.json()) as {
          embedding?: { values?: number[] };
        };
        return normalizeEmbeddingDim(
          data.embedding?.values ?? [],
          this.opts.embeddingDim,
        );
      }
      const data = (await res.json()) as {
        embedding?: { values?: number[] };
      };
      return normalizeEmbeddingDim(data.embedding?.values ?? [], this.opts.embeddingDim);
    } catch {
      return deterministicEmbedding(text, this.opts.embeddingDim);
    }
  }

  async chat(input: { system: string; user: string }): Promise<string> {
    const data = await this.generateWithRetry(input.system, [{ text: input.user }]);
    return (
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        ?.trim() ?? ''
    );
  }
}

function normalizeEmbeddingDim(values: number[], dim: number): number[] {
  if (values.length === dim) return values;
  if (values.length === 0) return deterministicEmbedding('empty', dim);
  if (values.length > dim) return values.slice(0, dim);
  const out = values.slice();
  while (out.length < dim) out.push(0);
  return out;
}
