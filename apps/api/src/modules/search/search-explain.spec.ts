import { inferSkillsFromText } from '../ai/providers/industrial-skills';
import { buildExplanation } from '../recruitment/matching.util';

describe('AI Search explainability helpers', () => {
  it('suy ra kỹ năng từ câu truy vấn tiếng Việt', () => {
    const skills = inferSkillsFromText(
      'Kỹ sư PLC Siemens 3 năm kinh nghiệm nhà máy Đồng Nai, biết SCADA',
    );
    expect(skills).toContain('PLC Siemens');
    expect(skills).toContain('SCADA');
  });

  it('buildExplanation tạo reason + matchedSkills', () => {
    const explanation = buildExplanation(
      0.8,
      ['PLC Siemens', 'SCADA', 'HVAC System'],
      ['PLC Siemens', 'SCADA', 'HMI'],
    );
    expect(explanation.matchedSkills).toEqual(['PLC Siemens', 'SCADA']);
    expect(explanation.missingSkills).toContain('HVAC System');
    expect(explanation.reason).toMatch(/Độ phù hợp|Hồ sơ ngữ nghĩa/);
    expect(explanation.reason).toMatch(/PLC Siemens/);
    expect(explanation.score).toBeGreaterThan(0);
  });
});
