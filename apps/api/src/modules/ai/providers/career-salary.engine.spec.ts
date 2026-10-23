import { JobLevelCode } from '@industriallink/contracts';
import { buildSalaryEstimate } from './career-salary.engine';

describe('Salary Engine', () => {
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
