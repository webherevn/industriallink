import { computeProfileCompletion } from './candidate.service';

describe('computeProfileCompletion', () => {
  it('trả về 0 nếu chưa có gì', () => {
    expect(computeProfileCompletion({ aiProfile: null, profile: null, skills: [] })).toBe(0);
  });

  it('tăng % khi có tóm tắt AI / hồ sơ', () => {
    const empty = computeProfileCompletion({ aiProfile: null, profile: null, skills: [] });
    const withSummary = computeProfileCompletion({
      aiProfile: { summary: 'Kỹ sư PLC 5 năm kinh nghiệm với nhiều dự án' },
      profile: null,
      skills: [],
    });
    expect(withSummary).toBeGreaterThan(empty);
  });

  it('Sales và Technical dùng checklist khác nhau', () => {
    const base = {
      currentPosition: 'Kỹ sư',
      summary: 'Tóm tắt đủ dài cho hồ sơ ứng viên kỹ thuật công nghiệp',
      phone: '0901234567',
      currentCity: 'Hà Nội',
      productsSold: ['PLC'],
      customerSegments: ['Nhà máy'],
      desiredPositions: ['Kỹ sư bảo trì'],
      jobReadiness: 'actively_looking',
    };

    const salesOnly = computeProfileCompletion({
      aiProfile: null,
      profile: { ...base, jobTrack: 'sales', sellingStages: ['prospecting', 'demo'] },
      skills: [{ id: '1' }],
      experiences: [{ companyName: 'ABC', sellingStages: ['prospecting'] }],
    });

    const techOnly = computeProfileCompletion({
      aiProfile: null,
      profile: {
        ...base,
        jobTrack: 'technical',
        brandsTechnologies: ['Siemens'],
        technicalWorkTypes: ['Bảo trì'],
        technicalAutonomyLevel: 3,
        troubleshootingLevel: 3,
      },
      skills: [{ id: '1' }],
      experiences: [{ companyName: 'ABC' }],
    });

    expect(techOnly).toBeGreaterThan(0);
    expect(salesOnly).toBeGreaterThan(0);
    // Cùng base nhưng track khác → điểm có thể khác
    expect(salesOnly).not.toBe(techOnly);
  });

  it('Technical không phụ thuộc sellingStages để đạt điểm cao hơn khi có block KT', () => {
    const withoutTech = computeProfileCompletion({
      aiProfile: null,
      profile: {
        jobTrack: 'technical',
        currentPosition: 'Kỹ sư',
        summary: 'Tóm tắt đủ dài cho hồ sơ ứng viên kỹ thuật công nghiệp',
      },
      skills: [],
    });
    const withTech = computeProfileCompletion({
      aiProfile: null,
      profile: {
        jobTrack: 'technical',
        currentPosition: 'Kỹ sư',
        summary: 'Tóm tắt đủ dài cho hồ sơ ứng viên kỹ thuật công nghiệp',
        brandsTechnologies: ['Siemens', 'ABB'],
        technicalWorkTypes: ['Lắp đặt', 'Bảo trì'],
        technicalAutonomyLevel: 4,
        troubleshootingLevel: 4,
        technicalTools: ['AutoCAD'],
        documentLiteracy: ['P&ID'],
        systemScaleNote: 'Dây chuyền 2000 tấn/h',
        shiftFlexibility: 'flexible',
      },
      skills: [{ id: '1' }],
    });
    expect(withTech).toBeGreaterThan(withoutTech);
  });
});
