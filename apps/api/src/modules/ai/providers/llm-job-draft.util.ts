import { formatJobLevel } from '@industriallink/contracts';
import type { JobDraftInput, JobDraftResult, JobDraftSkill } from '../domain/types';

export const JOB_DRAFT_SYSTEM_PROMPT = [
  'Bạn là chuyên gia tuyển dụng ngành công nghiệp B2B tại Việt Nam',
  '(tự động hoá, nhà máy, KCN, PLC/SCADA, cơ khí, HVAC, an toàn lao động…).',
  'Soạn tin tuyển dụng chuyên nghiệp, rõ ràng, tiếng Việt.',
  'Cấp bậc theo lộ trình thực tế VN:',
  '- Kinh doanh: Nhân viên Kinh doanh → Trưởng nhóm Kinh doanh → Trưởng phòng Kinh doanh → Giám đốc Kinh doanh → Giám đốc công ty',
  '- Kỹ thuật: Nhân viên Kỹ thuật → Trưởng nhóm Kỹ thuật → Trưởng phòng Kỹ thuật → Giám đốc Kỹ thuật',
  'Trả về DUY NHẤT một JSON hợp lệ theo schema:',
  '{',
  '  "title": string (tuỳ chọn, có thể tinh chỉnh chức danh),',
  '  "description": string (mô tả công việc, nhiệm vụ chính, môi trường),',
  '  "requirements": string (yêu cầu ứng viên: học vấn, kinh nghiệm, phẩm chất),',
  '  "benefits": string (quyền lợi & phúc lợi: lương thưởng, BHXH, hỗ trợ nhà ở/xe, đào tạo…),',
  '  "skills": [{"name": string, "required": boolean}],',
  '  "suggestedSalaryMin": number|null (VND/tháng, tuỳ chọn),',
  '  "suggestedSalaryMax": number|null (VND/tháng, tuỳ chọn),',
  '  "notes": string|null (gợi ý ngắn cho nhà tuyển dụng)',
  '}',
  'Nếu có bản nháp hiện có: chuẩn hoá, làm rõ, bổ sung phần còn thiếu — không xoá ý chính.',
  'Nếu gợi ý thêm yêu cầu tập trung vào một phần (yêu cầu / phúc lợi), ưu tiên làm kỹ phần đó.',
  'Không thêm giải thích, không markdown, chỉ JSON.',
].join('\n');

export function buildJobDraftUserPrompt(input: JobDraftInput): string {
  const lines = [
    `Chức danh: ${input.title}`,
    input.industry ? `Ngành: ${input.industry}` : null,
    input.jobLevel ? `Cấp bậc: ${formatJobLevel(input.jobLevel)}` : null,
    input.location ? `Địa điểm: ${input.location}` : null,
    input.employmentType ? `Hình thức: ${input.employmentType}` : null,
    input.hints ? `Gợi ý thêm: ${input.hints}` : null,
    input.existingDescription ? `Mô tả hiện có:\n${input.existingDescription}` : null,
    input.existingRequirements ? `Yêu cầu hiện có:\n${input.existingRequirements}` : null,
    input.existingBenefits ? `Phúc lợi hiện có:\n${input.existingBenefits}` : null,
    input.existingSkills?.length
      ? `Kỹ năng hiện có: ${input.existingSkills.join(', ')}`
      : null,
  ].filter(Boolean);

  return [
    'Hãy soạn / chuẩn hoá tin tuyển dụng dựa trên thông tin sau:',
    ...lines,
    '',
    'Ngữ cảnh: thị trường lao động công nghiệp Việt Nam (nhà máy, KCN, ca kíp, ATLĐ).',
  ].join('\n');
}

/** Chuẩn hoá JSON thô từ LLM về JobDraftResult, điền mặc định an toàn. */
export function normalizeJobDraft(raw: unknown, fallbackTitle: string): JobDraftResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawSkills = Array.isArray(r.skills) ? r.skills : [];
  const skills: JobDraftSkill[] = rawSkills
    .slice(0, 30)
    .map((s) => {
      const skill = (s ?? {}) as Record<string, unknown>;
      const name = String(skill.name ?? '').trim();
      return {
        name,
        required: skill.required === false ? false : true,
      };
    })
    .filter((s) => s.name.length > 0);

  const salary = (v: unknown): number | undefined => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return undefined;
    return Math.round(v);
  };

  const description = String(r.description ?? '').trim();
  const requirements = String(r.requirements ?? '').trim();
  const benefits = String(r.benefits ?? '').trim();
  const titleRaw = r.title ? String(r.title).trim() : '';

  return {
    title: titleRaw || fallbackTitle,
    description:
      description ||
      `Tuyển dụng vị trí ${fallbackTitle}. Tham gia vận hành và hỗ trợ sản xuất tại nhà máy / KCN.`,
    requirements:
      requirements ||
      'Tốt nghiệp chuyên ngành liên quan; có kinh nghiệm thực tế; tuân thủ an toàn lao động.',
    benefits:
      benefits ||
      [
        '• Lương cạnh tranh, thưởng hiệu suất / tháng 13',
        '• BHXH, BHYT, BHTN đầy đủ theo luật',
        '• Hỗ trợ nhà ở / xe đưa đón KCN (tuỳ địa điểm)',
        '• Đào tạo nội bộ, lộ trình thăng tiến rõ ràng',
        '• Khám sức khoẻ định kỳ, phụ cấp ca / ATLĐ',
      ].join('\n'),
    skills,
    suggestedSalaryMin: salary(r.suggestedSalaryMin),
    suggestedSalaryMax: salary(r.suggestedSalaryMax),
    notes: r.notes ? String(r.notes).trim() : undefined,
  };
}
