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
      experiences: [
        {
          companyName: 'Atlas ABC',
          jobTitle: isSales ? 'Sales Engineer' : 'Kỹ sư ứng dụng',
          startYear: 2021,
          endYear: 2024,
          isCurrent: false,
          productsSold: industry.includes('Khí') || /nen khi|compressor/i.test(haystack)
            ? ['Máy nén khí']
            : skills[0]
              ? [skills[0].name]
              : [],
          customerSegments: ['Nhà máy FDI'],
          marketsCovered: ['Bắc Ninh / Bắc Giang', 'Hải Phòng'],
          industries: [industry],
          highlights: 'Phụ trách khách hàng nhà máy FDI khu vực Bắc Ninh/Hải Phòng.',
          missingFields: ['revenue', 'kpi', 'newCustomerRatio', 'dealValue', 'sellingStages'],
        },
      ],
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
    const shortQ = question.replace(/\s+/g, ' ').slice(0, 80);

    if (/pipeline|phễu|bao nhiêu|thống kê|tình hình/.test(lower)) {
      const stats = extractPipelineStats(context);
      return [
        'Mình vừa quét pipeline workspace của bạn.',
        stats || 'Chưa có đủ số liệu pipeline.',
        'Gợi ý tiếp: mở Hộp thư để sàng lọc hồ sơ mới, hoặc lịch PV nếu có buổi sắp tới.',
      ].join(' ');
    }

    if (/tìm|ứng viên|candidate|plc|hvac|sales|kỹ sư|engineer|nhân viên|kinh doanh/.test(lower)) {
      const people = extractCandidateLines(context);
      if (people.length > 0) {
        const top = people[0];
        const pct = top.match(/phù hợp\s+(\d+)%/i)?.[1];
        return [
          `Đã tìm thấy ${people.length} ứng viên liên quan tới «${shortQ}».`,
          pct
            ? `Ứng viên nổi bật khớp khoảng ${pct}% — xem thẻ bên dưới để chọn hồ sơ ưu tiên.`
            : 'Xem thẻ ứng viên bên dưới để chọn hồ sơ ưu tiên.',
          'Bạn có thể mở Tìm ứng viên AI để lọc sâu hơn hoặc Hộp thư để liên hệ.',
        ].join(' ');
      }
      return [
        `Chưa thấy ứng viên khớp rõ với «${shortQ}» trong chỉ mục hiện tại.`,
        'Thử mô tả kỹ năng (PLC, HVAC, Kinh doanh…) hoặc mở Tìm ứng viên AI để tìm rộng hơn.',
      ].join(' ');
    }

    if (/tin|đăng|job|tuyển dụng|jd/.test(lower)) {
      const jobs = extractJobLines(context);
      return jobs.length
        ? `Công ty đang có ${jobs.length} tin trong ngữ cảnh. Ưu tiên tối ưu JD cho tin đang mở và đẩy sang Tìm ứng viên AI.`
        : 'Chưa có tin tuyển dụng trong ngữ cảnh. Vào «Đăng tin» để tạo JD mới (có AI draft).';
    }

    return [
      `Đã nhận câu hỏi «${shortQ}».`,
      'Mình có thể giúp tìm ứng viên, xem pipeline hoặc gợi ý tin tuyển dụng — hỏi cụ thể hơn một chút nhé.',
    ].join(' ');
  }
}

function extractPipelineStats(context: string): string {
  const block = sectionBlock(context, /pipeline workspace/i);
  const lines = block
    .split('\n')
    .map((l) => l.replace(/^[-•]\s*/, '').trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return '';
  return lines.slice(0, 4).join(' · ') + '.';
}

function extractCandidateLines(context: string): string[] {
  const block = sectionBlock(context, /ứng viên phù hợp|ứng viên liên quan|candidate/i);
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-•]/.test(l) || /phù hợp\s+\d+%/i.test(l))
    .map((l) => l.replace(/^[-•]\s*/, ''))
    .filter(Boolean);
}

function extractJobLines(context: string): string[] {
  const block = sectionBlock(context, /tin tuyển dụng/i);
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !/pipeline|ứng viên/i.test(l))
    .map((l) => l.replace(/^[-•]\s*/, ''))
    .slice(0, 10);
}

function sectionBlock(context: string, title: RegExp): string {
  const lines = context.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].replace(/^#+\s*/, '').trim();
    if (title.test(t)) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return '';
  const out: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    if (/^#{1,6}\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
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
