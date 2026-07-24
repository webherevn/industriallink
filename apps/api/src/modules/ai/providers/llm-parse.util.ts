import { SkillLevel } from '@industriallink/contracts';
import type {
  ParsedResume,
  ParsedResumeExperience,
  ParsedResumeSkill,
  ResumeParseInput,
} from '../domain/types';

export const RESUME_SYSTEM_PROMPT = [
  'Bạn là chuyên gia tuyển dụng Sales B2B công nghiệp tại Việt Nam.',
  'Đọc CV và trả về DUY NHẤT một JSON hợp lệ theo schema:',
  '{',
  '  "summary": string, "currentPosition": string|null, "jobLevel": string|null,',
  '  "totalExperienceYears": number|null, "industry": string|null, "specialization": string|null,',
  '  "skills": [{"name": string, "level": "beginner"|"intermediate"|"advanced"|"expert", "yearsOfExperience": number|null}],',
  '  "experiences": [{',
  '    "companyName": string, "jobTitle": string, "startYear": number|null, "endYear": number|null, "isCurrent": boolean,',
  '    "productsSold": string[], "customerSegments": string[], "marketsCovered": string[], "industries": string[],',
  '    "highlights": string|null,',
  '    "missingFields": string[]',
  '  }],',
  '  "strengths": string[], "weaknesses": string[], "careerPath": string|null,',
  '  "aiScore": number (0-100), "confidence": number (0-1)',
  '}',
  'Với mỗi công ty: điền những gì đọc được; nếu thiếu doanh số/KPI/tỷ lệ khách tự tìm/quy mô thương vụ/giai đoạn bán → ghi missingFields.',
  'missingFields dùng mã: revenue|kpi|newCustomerRatio|dealValue|sellingStages|products|customerSegments|markets',
  'Không hỏi ứng viên tự đánh giá giỏi/yếu; chỉ trích dữ liệu thực tế.',
  'Không thêm giải thích, không markdown, chỉ JSON.',
].join('\n');

export function buildResumeUserPrompt(input: ResumeParseInput): string {
  return `Tên file: ${input.fileName}\n\nNội dung CV:\n${input.text || '(không trích được nội dung, hãy suy luận hợp lý từ tên file)'}`;
}

/** Trích JSON từ output LLM (chịu được trường hợp có ```json ... ```). */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Không tìm thấy JSON trong output LLM');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function asSkillLevel(value: unknown): SkillLevel {
  const allowed = Object.values(SkillLevel) as string[];
  return allowed.includes(value as SkillLevel) ? (value as SkillLevel) : SkillLevel.Intermediate;
}

/** Chuẩn hoá JSON thô từ LLM về ParsedResume, điền mặc định an toàn. */
export function normalizeParsedResume(raw: unknown): ParsedResume {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawSkills = Array.isArray(r.skills) ? r.skills : [];
  const skills: ParsedResumeSkill[] = rawSkills.slice(0, 50).map((s) => {
    const skill = (s ?? {}) as Record<string, unknown>;
    return {
      name: String(skill.name ?? '').trim() || 'Unknown',
      level: asSkillLevel(skill.level),
      yearsOfExperience:
        typeof skill.yearsOfExperience === 'number' ? skill.yearsOfExperience : null,
    };
  });

  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 40) : [];

  const rawExps = Array.isArray(r.experiences) ? r.experiences : [];
  const experiences: ParsedResumeExperience[] = rawExps.slice(0, 12).map((item) => {
    const e = (item ?? {}) as Record<string, unknown>;
    const productsSold = strArr(e.productsSold);
    const customerSegments = strArr(e.customerSegments);
    const marketsCovered = strArr(e.marketsCovered);
    const missing = strArr(e.missingFields);
    const defaultsMissing = [
      ...(productsSold.length ? [] : ['products']),
      ...(customerSegments.length ? [] : ['customerSegments']),
      ...(marketsCovered.length ? [] : ['markets']),
      'revenue',
      'kpi',
      'newCustomerRatio',
      'dealValue',
      'sellingStages',
    ];
    return {
      companyName: String(e.companyName ?? '').trim() || 'Công ty chưa rõ',
      jobTitle: String(e.jobTitle ?? '').trim() || 'Sales',
      startYear: num(e.startYear),
      endYear: num(e.endYear),
      isCurrent: Boolean(e.isCurrent),
      productsSold,
      customerSegments,
      marketsCovered,
      industries: strArr(e.industries),
      highlights: e.highlights ? String(e.highlights) : null,
      missingFields: [...new Set([...missing, ...defaultsMissing])].slice(0, 12),
    };
  });

  return {
    summary: String(r.summary ?? '').trim(),
    currentPosition: r.currentPosition ? String(r.currentPosition) : null,
    jobLevel: r.jobLevel ? String(r.jobLevel) : null,
    totalExperienceYears: num(r.totalExperienceYears),
    industry: r.industry ? String(r.industry) : null,
    specialization: r.specialization ? String(r.specialization) : null,
    skills: skills.filter((s) => s.name !== 'Unknown'),
    experiences,
    strengths: strArr(r.strengths),
    weaknesses: strArr(r.weaknesses),
    careerPath: r.careerPath ? String(r.careerPath) : null,
    aiScore: Math.max(0, Math.min(100, num(r.aiScore) ?? 60)),
    confidence: Math.max(0, Math.min(1, num(r.confidence) ?? 0.7)),
  };
}
