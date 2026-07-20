import { computeProfileCompletion } from './candidate.service';

describe('computeProfileCompletion', () => {
  it('trả về 0 nếu chưa có gì', () => {
    expect(computeProfileCompletion({ aiProfile: null, profile: null, skills: [] })).toBe(0);
  });

  it('cộng 30% khi đã có AI Profile (tóm tắt CV)', () => {
    expect(
      computeProfileCompletion({
        aiProfile: { summary: 'Kỹ sư PLC 5 năm kinh nghiệm' },
        profile: null,
        skills: [],
      }),
    ).toBe(30);
  });

  it('cộng đủ 40% khi hồ sơ nghề nghiệp điền đủ 6 field', () => {
    expect(
      computeProfileCompletion({
        aiProfile: null,
        profile: {
          currentPosition: 'Sales Engineer',
          jobLevel: 'senior',
          totalExperienceYears: 5,
          industry: 'Automation',
          specialization: 'PLC',
          summary: 'Tóm tắt',
        },
        skills: [],
      }),
    ).toBe(40);
  });

  it('cộng một phần khi chỉ điền một số field hồ sơ nghề nghiệp', () => {
    expect(
      computeProfileCompletion({
        aiProfile: null,
        profile: {
          currentPosition: 'Sales Engineer',
          jobLevel: null,
          totalExperienceYears: null,
          industry: null,
          specialization: null,
          summary: null,
        },
        skills: [],
      }),
    ).toBeCloseTo((1 / 6) * 40, 0);
  });

  it('cộng 15% khi có ít nhất 1 kỹ năng, thêm 15% nữa khi có từ 3 kỹ năng', () => {
    const oneSkill = computeProfileCompletion({
      aiProfile: null,
      profile: null,
      skills: [{ id: 's1' }],
    });
    expect(oneSkill).toBe(15);

    const threeSkills = computeProfileCompletion({
      aiProfile: null,
      profile: null,
      skills: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    });
    expect(threeSkills).toBe(30);
  });

  it('đạt 100% khi có đủ AI Profile, hồ sơ đầy đủ và từ 3 kỹ năng', () => {
    expect(
      computeProfileCompletion({
        aiProfile: { summary: 'Tóm tắt AI' },
        profile: {
          currentPosition: 'Sales Engineer',
          jobLevel: 'senior',
          totalExperienceYears: 5,
          industry: 'Automation',
          specialization: 'PLC',
          summary: 'Tóm tắt',
        },
        skills: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }],
      }),
    ).toBe(100);
  });
});
