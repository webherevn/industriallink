import { computeProfileCompletion } from './candidate.service';

describe('computeProfileCompletion', () => {
  it('trả về 0 nếu chưa có gì', () => {
    expect(computeProfileCompletion({ aiProfile: null, profile: null, skills: [] })).toBe(0);
  });

  it('họ tên / năm sinh / SĐT / email tăng điểm hoàn thành KD (0,5% mỗi mục)', () => {
    expect(
      computeProfileCompletion({
        aiProfile: { summary: 'Kỹ sư PLC 5 năm kinh nghiệm với nhiều dự án' },
        profile: { jobTrack: 'sales' },
        skills: [{ id: '1' }],
      }),
    ).toBe(0);
    expect(
      computeProfileCompletion({
        displayName: 'Nguyễn Văn A',
        email: 'a@example.com',
        aiProfile: { summary: 'Kỹ sư PLC 5 năm kinh nghiệm với nhiều dự án' },
        profile: { phone: '0901234567', birthYear: 1990, jobTrack: 'sales' },
        skills: [{ id: '1' }],
      }),
    ).toBe(2);
  });

  it('nơi sống (0,5%) tăng điểm nhẹ; sản phẩm (17%) tăng nhiều hơn', () => {
    const withLocation = computeProfileCompletion({
      aiProfile: null,
      profile: { currentCity: 'Hà Nội', jobTrack: 'sales' },
      skills: [],
    });
    const withProducts = computeProfileCompletion({
      aiProfile: null,
      profile: { productsSold: ['PLC'], jobTrack: 'sales' },
      skills: [],
    });
    expect(withLocation).toBeGreaterThan(0);
    expect(withLocation).toBeLessThan(5);
    expect(withProducts).toBeGreaterThan(withLocation);
    expect(withProducts).toBeGreaterThan(10);
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
    expect(salesOnly).not.toBe(techOnly);
  });

  it('Technical tăng điểm khi có block năng lực kỹ thuật', () => {
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
      skills: [],
    });
    expect(withTech).toBeGreaterThan(withoutTech);
  });

  it('họ tên / năm sinh / SĐT / email tăng điểm hoàn thành KT (0,5% mỗi mục)', () => {
    expect(
      computeProfileCompletion({
        displayName: 'Nguyễn Văn B',
        email: 'b@example.com',
        aiProfile: null,
        profile: { phone: '0901234567', birthYear: 1990, jobTrack: 'technical' },
        skills: [],
      }),
    ).toBe(2);
  });

  it('Kỹ thuật: thành tích/dự án (2,5%) tăng điểm; định hướng (0%) không tăng', () => {
    const base = {
      jobTrack: 'technical' as const,
      currentCity: 'Hà Nội',
    };
    const withOrientation = computeProfileCompletion({
      aiProfile: null,
      profile: { ...base, careerOrientations: ['Trở thành chuyên gia'] },
      skills: [],
    });
    const withCityOnly = computeProfileCompletion({
      aiProfile: null,
      profile: base,
      skills: [],
    });
    const withHighlights = computeProfileCompletion({
      aiProfile: null,
      profile: { ...base, salesHighlights: 'Commissioning 5 line đúng hạn' },
      skills: [],
      experiences: [{ companyName: 'ABC', highlights: 'Commissioning 5 line đúng hạn' }],
    });
    expect(withOrientation).toBe(withCityOnly);
    expect(withHighlights).toBeGreaterThan(withCityOnly);
  });
});
