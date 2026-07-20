import {
  JOB_LEVEL_LABEL,
  JobLevelCode,
  SkillLevel,
  formatJobLevel,
  isJobLevelCode,
  type CareerAdviceView,
  type SalaryEstimateView,
} from '@industriallink/contracts';
import type { AiProvider } from '../domain/ai-provider.interface';
import type {
  JobDraftInput,
  JobDraftResult,
  JobDraftSkill,
  ParsedResume,
  ParsedResumeSkill,
  ResumeParseInput,
} from '../domain/types';
import {
  buildCareerAdvice,
  buildSalaryEstimate,
  type CareerAdviceEngineInput,
  type SalaryEstimateEngineInput,
} from './career-salary.engine';
import { deterministicEmbedding } from './embedding.util';
import { INDUSTRIAL_SKILL_KEYWORDS } from './industrial-skills';
import { normalizeJobDraft } from './llm-job-draft.util';

/**
 * Provider AI mô phỏng - KHÔNG cần API key. Dùng làm mặc định cho dev/demo,
 * suy luận từ tên file + nội dung text theo từ khoá.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  constructor(private readonly embeddingDim: number) {}

  async parseResume(input: ResumeParseInput): Promise<ParsedResume> {
    const haystack = `${input.fileName} ${input.text}`;
    const matched = INDUSTRIAL_SKILL_KEYWORDS.filter((s) => s.keyword.test(haystack));
    const chosen = matched.length > 0 ? matched : INDUSTRIAL_SKILL_KEYWORDS.slice(0, 4);

    const skills: ParsedResumeSkill[] = chosen.map((s, idx) => ({
      name: s.name,
      level: idx === 0 ? SkillLevel.Expert : SkillLevel.Advanced,
      yearsOfExperience: Math.max(1, 6 - idx),
    }));

    const industry = chosen[0]?.industry ?? 'Automation';
    const totalExperienceYears = 5 + (haystack.length % 5);
    const isSales = /kinh doanh|sales/i.test(haystack) || industry === 'Sales';

    const jobLevel = inferLevelFromYears(totalExperienceYears, isSales);
    const ladder = isSales
      ? 'Nhân viên Kinh doanh → Trưởng nhóm Kinh doanh → Trưởng phòng Kinh doanh → Giám đốc Kinh doanh → Giám đốc công ty'
      : 'Nhân viên Kỹ thuật → Trưởng nhóm Kỹ thuật → Trưởng phòng Kỹ thuật → Giám đốc Kỹ thuật';

    return {
      summary: `Ứng viên ngành ${industry} với khoảng ${totalExperienceYears} năm kinh nghiệm, thành thạo ${skills
        .map((s) => s.name)
        .slice(0, 3)
        .join(', ')}.`,
      currentPosition: JOB_LEVEL_LABEL[jobLevel],
      jobLevel,
      totalExperienceYears,
      industry,
      specialization: skills[0]?.name ?? null,
      skills,
      strengths: ['Kinh nghiệm thực chiến tại nhà máy', 'Thành thạo thiết bị công nghiệp chính'],
      weaknesses: totalExperienceYears < 8 ? ['Kinh nghiệm quản lý còn hạn chế'] : [],
      careerPath: ladder,
      aiScore: 70 + (haystack.length % 25),
      confidence: 0.6,
    };
  }

  async generateJobDraft(input: JobDraftInput): Promise<JobDraftResult> {
    const haystack = [
      input.title,
      input.industry,
      input.hints,
      input.existingDescription,
      input.existingRequirements,
      ...(input.existingSkills ?? []),
    ]
      .filter(Boolean)
      .join(' ');

    const matched = INDUSTRIAL_SKILL_KEYWORDS.filter((s) => s.keyword.test(haystack));
    const chosen =
      matched.length > 0
        ? matched
        : INDUSTRIAL_SKILL_KEYWORDS.filter((s) => s.industry === 'Automation').slice(0, 4);

    const industry = input.industry?.trim() || chosen[0]?.industry || 'Automation';
    const levelCode = isJobLevelCode(input.jobLevel)
      ? input.jobLevel
      : inferLevelFromTitle(input.title);
    const levelLabel = formatJobLevel(levelCode);
    const location = input.location?.trim() || 'KCN tại Việt Nam';
    const skillNamesFromExisting = (input.existingSkills ?? [])
      .map((s) => s.trim())
      .filter(Boolean);

    const skills: JobDraftSkill[] = [
      ...skillNamesFromExisting.map((name) => ({ name, required: true })),
      ...chosen.map((s) => ({ name: s.name, required: true })),
    ]
      .filter((s, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === s.name.toLowerCase()) === i)
      .slice(0, 10);

    const skillList = skills.map((s) => s.name).join(', ');
    const isImprove = Boolean(
      input.existingDescription?.trim() ||
        input.existingRequirements?.trim() ||
        input.existingBenefits?.trim(),
    );

    const description = isImprove
      ? input.existingDescription?.trim() ||
        [
          `Tuyển ${levelLabel} — ${input.title.trim()}.`,
          `Làm việc tại ${location}, thuộc môi trường nhà máy / KCN ngành ${industry}.`,
        ].join('\n')
      : [
          `Tuyển ${levelLabel} — ${input.title.trim()}.`,
          `Làm việc tại ${location}, thuộc môi trường nhà máy / KCN ngành ${industry}.`,
          skillList
            ? `Phụ trách công việc liên quan: ${skillList}.`
            : 'Phụ trách công việc chuyên môn theo mô tả chi tiết.',
          'Phối hợp với các bộ phận sản xuất, bảo trì và đối tác thiết bị để đảm bảo tiến độ và chất lượng.',
        ].join('\n');

    const yearsHint = yearsHintForLevel(levelCode);
    const requirements = isImprove
      ? [
          input.existingRequirements?.trim() || 'Yêu cầu ứng viên:',
          '',
          `- Tốt nghiệp chuyên ngành liên quan đến ${industry}.`,
          `- Kinh nghiệm phù hợp cấp bậc ${levelLabel}; ưu tiên làm việc tại nhà máy / KCN.`,
          skillList ? `- Thành thạo hoặc có kinh nghiệm: ${skillList}.` : null,
          '- Tuân thủ ATLĐ, làm việc theo ca khi cần; giao tiếp tiếng Việt tốt.',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `- Tốt nghiệp Cao đẳng / Đại học chuyên ngành liên quan đến ${industry}.`,
          `- Kinh nghiệm ${yearsHint} trong môi trường nhà máy / B2B công nghiệp.`,
          skillList ? `- Thành thạo: ${skillList}.` : '- Có kiến thức thiết bị công nghiệp cơ bản.',
          '- Đọc hiểu tài liệu kỹ thuật; ưu tiên có chứng chỉ ATLĐ.',
          '- Chịu được môi trường sản xuất, sẵn sàng đi công tác KCN khi cần.',
        ].join('\n');

    const benefits = isImprove
      ? [
          input.existingBenefits?.trim() || 'Quyền lợi & phúc lợi:',
          '',
          '• Lương cạnh tranh theo cấp bậc, thưởng hiệu suất / tháng 13',
          '• BHXH, BHYT, BHTN đầy đủ; khám sức khoẻ định kỳ',
          `• Hỗ trợ đi lại / nhà ở gần ${location}`,
          '• Đào tạo nội bộ, lộ trình thăng tiến theo khối Kinh doanh / Kỹ thuật',
          '• Phụ cấp ca, ATLĐ, đồng phục / dụng cụ bảo hộ',
        ].join('\n')
      : [
          '• Lương cạnh tranh theo cấp bậc, thưởng hiệu suất / tháng 13',
          '• BHXH, BHYT, BHTN đầy đủ theo luật; khám sức khoẻ định kỳ',
          `• Hỗ trợ nhà ở / xe đưa đón KCN tại ${location}`,
          '• Đào tạo chuyên môn, lộ trình thăng tiến rõ ràng',
          '• Phụ cấp ca, ATLĐ, đồng phục / dụng cụ bảo hộ',
          '• Môi trường nhà máy chuyên nghiệp, đồng nghiệp hỗ trợ',
        ].join('\n');

    const [suggestedSalaryMin, suggestedSalaryMax] = salaryForLevel(levelCode);

    return normalizeJobDraft(
      {
        title: input.title.trim(),
        description,
        requirements,
        benefits,
        skills,
        suggestedSalaryMin,
        suggestedSalaryMax,
        notes: `Cấp bậc: ${levelLabel}. Lộ trình VN (Kinh doanh / Kỹ thuật) — chỉnh sửa trước khi đăng.`,
      },
      input.title,
    );
  }

  async estimateSalary(input: SalaryEstimateEngineInput): Promise<SalaryEstimateView> {
    return buildSalaryEstimate(input);
  }

  async adviseCareer(input: CareerAdviceEngineInput): Promise<CareerAdviceView> {
    return buildCareerAdvice(input);
  }

  async embed(text: string): Promise<number[]> {
    return deterministicEmbedding(text, this.embeddingDim);
  }

  async chat(input: { system: string; user: string }): Promise<string> {
    const q = input.user;
    const lower = q.toLowerCase();

    // Trích đoạn ngữ cảnh từ prompt user (sau "Ngữ cảnh:" nếu có).
    const contextMatch = q.match(/Ngữ cảnh:\s*([\s\S]*?)\n\nCâu hỏi:\s*([\s\S]+)$/i);
    const context = contextMatch?.[1]?.trim() ?? '';
    const question = (contextMatch?.[2] ?? q).trim();

    if (/pipeline|phễu|bao nhiêu|thống kê|tình hình/.test(lower)) {
      return [
        'Dựa trên dữ liệu workspace hiện tại của bạn:',
        context ? `\n${summarizeContext(context)}` : '',
        '\nGợi ý: mở Inbox để xử lý hồ sơ mới, hoặc lịch PV nếu có buổi sắp tới.',
        '\n(Mock AI — bật OPENAI/Anthropic/Gemini để câu trả lời sâu hơn.)',
      ].join('');
    }

    if (/tìm|ứng viên|candidate|plc|hvac|sales|kỹ sư|engineer/.test(lower)) {
      const people = extractCandidateLines(context);
      if (people.length > 0) {
        return [
          `Tôi đã đối chiếu câu hỏi «${question.slice(0, 120)}» với chỉ mục ứng viên:`,
          ...people.slice(0, 5).map((p, i) => `${i + 1}. ${p}`),
          '\nBạn có thể mở AI Search hoặc Pipeline để liên hệ / đặt lịch PV.',
          '\n(Mock AI — semantic ranking dùng pgvector/OpenSearch khi có dữ liệu.)',
        ].join('\n');
      }
      return [
        `Chưa thấy ứng viên khớp rõ với «${question.slice(0, 100)}» trong chỉ mục.`,
        'Thử mô tả kỹ năng (PLC, HVAC…) hoặc mở /search để tìm rộng hơn.',
        '\n(Mock AI)',
      ].join('\n');
    }

    if (/tin|đăng|job|tuyển dụng|jd/.test(lower)) {
      const jobs = extractJobLines(context);
      return [
        jobs.length
          ? `Các tin đang mở của công ty:\n${jobs.slice(0, 8).map((j, i) => `${i + 1}. ${j}`).join('\n')}`
          : 'Chưa có tin tuyển dụng trong ngữ cảnh. Vào «Đăng tin» để tạo JD mới (có AI draft).',
        '\n(Mock AI)',
      ].join('\n');
    }

    return [
      'Tôi là AI Copilot IndustrialLink (chế độ mock local).',
      `Bạn hỏi: «${question.slice(0, 200)}»`,
      context ? `\nTóm tắt dữ liệu nội bộ:\n${summarizeContext(context)}` : '',
      '\nTôi có thể giúp: tìm ứng viên, xem pipeline, gợi ý tin tuyển dụng. Hỏi cụ thể hơn nhé.',
    ].join('\n');
  }
}

function summarizeContext(context: string): string {
  return context
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join('\n');
}

function extractCandidateLines(context: string): string[] {
  return context
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-•]/.test(l) || /ứng viên|score|phù hợp/i.test(l))
    .map((l) => l.replace(/^[-•]\s*/, ''));
}

function extractJobLines(context: string): string[] {
  const block = context.split(/###\s*Tin tuyển dụng/i)[1] ?? context;
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !/pipeline|ứng viên/i.test(l))
    .slice(0, 10);
}

function inferLevelFromYears(years: number, sales: boolean): JobLevelCode {
  if (sales) {
    if (years >= 15) return JobLevelCode.CompanyDirector;
    if (years >= 12) return JobLevelCode.SalesDirector;
    if (years >= 8) return JobLevelCode.SalesDeptHead;
    if (years >= 4) return JobLevelCode.SalesTeamLead;
    return JobLevelCode.SalesStaff;
  }
  if (years >= 12) return JobLevelCode.TechDirector;
  if (years >= 8) return JobLevelCode.TechDeptHead;
  if (years >= 4) return JobLevelCode.TechTeamLead;
  return JobLevelCode.TechStaff;
}

function inferLevelFromTitle(title: string): JobLevelCode {
  const t = title.toLowerCase();
  if (/giám đốc công ty|ceo|tổng giám đốc/.test(t)) return JobLevelCode.CompanyDirector;
  if (/giám đốc kinh doanh|sales director/.test(t)) return JobLevelCode.SalesDirector;
  if (/giám đốc kỹ thuật|cto|technical director/.test(t)) return JobLevelCode.TechDirector;
  if (/trưởng phòng kinh doanh/.test(t)) return JobLevelCode.SalesDeptHead;
  if (/trưởng phòng kỹ thuật|trưởng phòng/.test(t)) return JobLevelCode.TechDeptHead;
  if (/trưởng nhóm kinh doanh/.test(t)) return JobLevelCode.SalesTeamLead;
  if (/trưởng nhóm/.test(t)) return JobLevelCode.TechTeamLead;
  if (/kinh doanh|sales/.test(t)) return JobLevelCode.SalesStaff;
  return JobLevelCode.TechStaff;
}

function yearsHintForLevel(code: JobLevelCode): string {
  switch (code) {
    case JobLevelCode.SalesStaff:
    case JobLevelCode.TechStaff:
      return 'từ 0–2 năm';
    case JobLevelCode.SalesTeamLead:
    case JobLevelCode.TechTeamLead:
      return 'từ 2–5 năm';
    case JobLevelCode.SalesDeptHead:
    case JobLevelCode.TechDeptHead:
      return 'từ 5–8 năm';
    case JobLevelCode.SalesDirector:
    case JobLevelCode.TechDirector:
      return 'từ 8–12 năm';
    case JobLevelCode.CompanyDirector:
      return 'trên 12 năm';
    default:
      return 'phù hợp cấp bậc';
  }
}

function salaryForLevel(code: JobLevelCode): [number, number] {
  const table: Record<JobLevelCode, [number, number]> = {
    [JobLevelCode.SalesStaff]: [10_000_000, 18_000_000],
    [JobLevelCode.TechStaff]: [12_000_000, 22_000_000],
    [JobLevelCode.SalesTeamLead]: [18_000_000, 28_000_000],
    [JobLevelCode.TechTeamLead]: [20_000_000, 32_000_000],
    [JobLevelCode.SalesDeptHead]: [28_000_000, 45_000_000],
    [JobLevelCode.TechDeptHead]: [30_000_000, 50_000_000],
    [JobLevelCode.SalesDirector]: [45_000_000, 80_000_000],
    [JobLevelCode.TechDirector]: [45_000_000, 85_000_000],
    [JobLevelCode.CompanyDirector]: [70_000_000, 150_000_000],
  };
  return table[code];
}
