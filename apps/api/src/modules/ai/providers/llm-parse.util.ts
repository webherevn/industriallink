import { SkillLevel } from '@industriallink/contracts';
import type { ParsedResume, ParsedResumeSkill, ResumeParseInput } from '../domain/types';

export const RESUME_SYSTEM_PROMPT = [
  'Bạn là chuyên gia tuyển dụng công nghiệp B2B tại Việt Nam.',
  'Đọc CV và trả về DUY NHẤT một JSON hợp lệ theo schema:',
  '{',
  '  "summary": string, "currentPosition": string|null, "jobLevel": string|null,',
  '  "totalExperienceYears": number|null, "industry": string|null, "specialization": string|null,',
  '  "skills": [{"name": string, "level": "beginner"|"intermediate"|"advanced"|"expert", "yearsOfExperience": number|null}],',
  '  "strengths": string[], "weaknesses": string[], "careerPath": string|null,',
  '  "aiScore": number (0-100), "confidence": number (0-1)',
  '}',
  'Với jobLevel, ưu tiên mã hoặc nhãn theo lộ trình VN:',
  'Kinh doanh: sales.staff | sales.team_lead | sales.dept_head | sales.director | sales.company_director',
  'Kỹ thuật: technical.staff | technical.team_lead | technical.dept_head | technical.director',
  'careerPath nên mô tả lộ trình thăng tiến kiểu Việt Nam (nhân viên → trưởng nhóm → trưởng phòng → giám đốc).',
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
  return allowed.includes(value as string) ? (value as SkillLevel) : SkillLevel.Intermediate;
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
    Array.isArray(v) ? v.map((x) => String(x)).slice(0, 20) : [];

  return {
    summary: String(r.summary ?? '').trim(),
    currentPosition: r.currentPosition ? String(r.currentPosition) : null,
    jobLevel: r.jobLevel ? String(r.jobLevel) : null,
    totalExperienceYears: num(r.totalExperienceYears),
    industry: r.industry ? String(r.industry) : null,
    specialization: r.specialization ? String(r.specialization) : null,
    skills: skills.filter((s) => s.name !== 'Unknown'),
    strengths: strArr(r.strengths),
    weaknesses: strArr(r.weaknesses),
    careerPath: r.careerPath ? String(r.careerPath) : null,
    aiScore: Math.max(0, Math.min(100, num(r.aiScore) ?? 60)),
    confidence: Math.max(0, Math.min(1, num(r.confidence) ?? 0.7)),
  };
}
