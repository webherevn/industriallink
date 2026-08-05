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
  embeddingModel: string;
  embeddingDim: number;
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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

  constructor(private readonly opts: GeminiOptions) {}

  private modelUrl(method: 'generateContent' | 'embedContent', model = this.opts.model): string {
    return `${API_BASE}/models/${model}:${method}?key=${this.opts.apiKey}`;
  }

  private async generateJson(
    system: string,
    userParts: Array<Record<string, unknown>>,
    temperature = 0.2,
  ): Promise<unknown> {
    const res = await fetch(this.modelUrl('generateContent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: generationConfigFor(
          this.opts.model,
          {
            responseMimeType: 'application/json',
          },
          temperature,
        ),
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
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
    const res = await fetch(this.modelUrl('generateContent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: 'user', parts: [{ text: input.user }] }],
        generationConfig: generationConfigFor(this.opts.model),
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini chat lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
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
