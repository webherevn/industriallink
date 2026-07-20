import { JobLevelCode, SkillLevel } from '@industriallink/contracts';
import { MockAiProvider } from './mock.provider';

describe('MockAiProvider', () => {
  const provider = new MockAiProvider(768);

  it('nhận diện kỹ năng công nghiệp từ nội dung CV', async () => {
    const parsed = await provider.parseResume({
      fileName: 'cv-automation.pdf',
      text: 'Kỹ sư tự động hoá, thành thạo PLC Siemens S7-1500, TIA Portal, SCADA WinCC.',
    });

    expect(parsed.skills.length).toBeGreaterThan(0);
    const names = parsed.skills.map((s) => s.name);
    expect(names).toContain('PLC Siemens');
    expect(parsed.skills[0].level).toBe(SkillLevel.Expert);
    expect(parsed.aiScore).toBeGreaterThanOrEqual(0);
    expect(parsed.aiScore).toBeLessThanOrEqual(100);
    expect(Object.values(JobLevelCode)).toContain(parsed.jobLevel as JobLevelCode);
    expect(parsed.careerPath).toMatch(/Trưởng nhóm|Trưởng phòng|Giám đốc/);
  });

  it('sinh embedding đúng số chiều và đã chuẩn hoá', async () => {
    const embedding = await provider.embed('PLC Siemens SCADA HVAC');
    expect(embedding).toHaveLength(768);
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    // Vector đã chuẩn hoá L2 nên norm xấp xỉ 1.
    expect(norm).toBeGreaterThan(0.9);
    expect(norm).toBeLessThan(1.1);
  });

  it('generateJobDraft: title có PLC → mô tả và kỹ năng chứa PLC/SCADA', async () => {
    const draft = await provider.generateJobDraft({
      title: 'Kỹ sư PLC',
      industry: 'Automation',
      location: 'KCN Đồng Nai',
      hints: 'Siemens, ca kíp',
    });

    expect(draft.description.length).toBeGreaterThan(20);
    expect(draft.requirements.length).toBeGreaterThan(10);
    expect(draft.benefits.length).toBeGreaterThan(10);
    expect(draft.benefits).toMatch(/BHXH|phúc lợi|thưởng|nhà ở/i);
    expect(draft.description.toLowerCase()).toMatch(/plc|scada|nhà máy|kcn/);
    const skillNames = draft.skills.map((s) => s.name.toLowerCase());
    expect(skillNames.some((n) => n.includes('plc') || n.includes('scada'))).toBe(true);
    expect(draft.suggestedSalaryMin).toBeGreaterThan(0);
    expect(draft.suggestedSalaryMax).toBeGreaterThan(draft.suggestedSalaryMin!);
  });
});
