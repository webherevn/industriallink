import { JobLevelCode, JobTrack } from '@industriallink/contracts';
import { buildCareerAdvice, buildSalaryEstimate } from './career-salary.engine';

describe('Career + Salary Engine', () => {
  it('adviseCareer: kỹ thuật — ladder có current và next', () => {
    const advice = buildCareerAdvice({
      track: JobTrack.Technical,
      currentLevel: JobLevelCode.TechStaff,
      skills: ['PLC'],
      yearsOfExperience: 2,
    });

    expect(advice.track).toBe(JobTrack.Technical);
    expect(advice.currentLevel).toBe(JobLevelCode.TechStaff);
    expect(advice.nextLevel).toBe(JobLevelCode.TechTeamLead);
    expect(advice.ladder.some((s) => s.status === 'current')).toBe(true);
    expect(advice.ladder.some((s) => s.status === 'next')).toBe(true);
    expect(advice.salaryCurrent.min).toBeGreaterThan(0);
    expect(advice.salaryNext?.min).toBeGreaterThan(advice.salaryCurrent.min);
    expect(advice.readinessScore).toBeGreaterThanOrEqual(15);
    expect(advice.actionPlan.length).toBeGreaterThan(0);
  });

  it('estimateSalary: điều chỉnh theo địa điểm HCM', () => {
    const base = buildSalaryEstimate({ jobLevel: JobLevelCode.SalesTeamLead });
    const hcm = buildSalaryEstimate({
      jobLevel: JobLevelCode.SalesTeamLead,
      location: 'TP. Hồ Chí Minh',
    });
    expect(hcm.salaryMin).toBeGreaterThan(base.salaryMin);
    expect(hcm.factors.some((f) => /HCM|Hà Nội/i.test(f))).toBe(true);
  });
});
