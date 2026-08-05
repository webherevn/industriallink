import { normalizeParsedResume } from './llm-parse.util';

describe('normalizeParsedResume', () => {
  it('map đầy đủ contact, education, KPI experience', () => {
    const parsed = normalizeParsedResume({
      contact: {
        fullName: 'Nguyễn Văn A',
        email: 'a@example.com',
        phone: '0901234567',
        currentCity: 'Thành phố Hà Nội',
        district: null,
        ward: 'Phường Cầu Giấy',
        birthYear: 1995,
        birthDate: '15/03/1995',
      },
      summary: 'Sales B2B khí công nghiệp',
      careerObjective: 'Trở thành Sales Manager công nghiệp trong 3 năm',
      hobbies: ['Đọc sách', 'Bóng đá'],
      currentPosition: 'Sales Engineer',
      jobLevel: 'sales_staff',
      totalExperienceYears: 4,
      b2bExperienceBand: '3_5',
      industry: 'Khí công nghiệp',
      specialization: 'Máy nén khí',
      skills: [{ name: 'Tư vấn kỹ thuật', level: 'advanced', yearsOfExperience: 3 }],
      softSkills: ['Chủ động'],
      experiences: [
        {
          companyName: 'Atlas Gas',
          jobTitle: 'Sales Engineer',
          startYear: 2021,
          endYear: null,
          isCurrent: true,
          productsSold: ['Máy nén khí'],
          customerSegments: ['FDI'],
          marketsCovered: ['Bắc Ninh'],
          industries: ['Khí công nghiệp'],
          sellingStages: ['Tìm kiếm khách hàng', 'Báo giá', 'Chốt hợp đồng'],
          latestRevenue: 1200000000,
          kpiAchievementPct: 110,
          newCustomerRatioPct: 40,
          dealType: 'solution',
          typicalDealValue: 200000000,
          maxDealValue: 800000000,
          responsibilities: [
            'Lên kế hoạch và mục tiêu kinh doanh',
            'Nghiên cứu sản phẩm và đối thủ cạnh tranh',
            'Đào tạo đội ngũ sales',
          ],
          highlights: 'Vượt KPI 110%',
          jobDescription: null,
          missingFields: [],
        },
      ],
      education: [
        {
          school: 'Đại học Bách khoa',
          degree: 'Kỹ sư',
          major: 'Cơ khí',
          level: 'dai_hoc',
          startYear: 2013,
          endYear: 2018,
        },
      ],
      certificates: ['An toàn lao động'],
      languages: ['Tiếng Anh'],
      projects: [],
      productsSold: [],
      customerSegments: [],
      marketsCovered: [],
      industriesExperienced: [],
      sellingStages: [],
      desiredPositions: ['Sales Engineer'],
      desiredLocations: ['Hà Nội'],
      expectedSalaryMin: 20000000,
      expectedSalaryMax: 30000000,
      expectedOte: 40000000,
      hasB2License: true,
      driverLicenseType: 'B2',
      travelAbility: 'toan_quoc',
      jobReadiness: 'immediate',
      availabilityBand: 'immediate',
      salesHighlights: 'Vượt KPI 110%',
      strengths: ['Kỹ thuật vững'],
      weaknesses: [],
      careerPath: 'Sales → Team lead',
      aiScore: 88,
      confidence: 0.9,
    });

    expect(parsed.contact.fullName).toBe('Nguyễn Văn A');
    expect(parsed.contact.phone).toBe('0901234567');
    expect(parsed.contact.ward).toBe('Phường Cầu Giấy');
    expect(parsed.contact.currentCity).toBe('Thành phố Hà Nội');
    expect(parsed.contact.birthDate).toBe('1995-03-15');
    expect(parsed.careerObjective).toMatch(/Sales Manager/);
    expect(parsed.hobbies).toEqual(['Đọc sách', 'Bóng đá']);
    expect(parsed.education[0].school).toContain('Bách khoa');
    expect(parsed.education[0].level).toBe('Đại học');
    expect(parsed.experiences[0].latestRevenue).toBe(1200000000);
    expect(parsed.experiences[0].sellingStages).toContain('Báo giá');
    expect(parsed.experiences[0].responsibilities.length).toBe(3);
    expect(parsed.experiences[0].jobDescription).toMatch(/Lên kế hoạch/);
    expect(parsed.experiences[0].missingFields).toEqual([]);
    expect(parsed.productsSold).toContain('Máy nén khí');
    expect(parsed.hasB2License).toBe(true);
    expect(parsed.b2bExperienceBand).toBe('3_5');
  });

  it('không gắn cứng missingFields khi đã có KPI', () => {
    const parsed = normalizeParsedResume({
      summary: 'x',
      experiences: [
        {
          companyName: 'A',
          jobTitle: 'Sales',
          productsSold: ['P'],
          customerSegments: ['S'],
          marketsCovered: ['M'],
          industries: ['I'],
          sellingStages: ['Báo giá'],
          responsibilities: ['Phụ trách khách hàng'],
          latestRevenue: 1,
          kpiAchievementPct: 100,
          newCustomerRatioPct: 20,
          typicalDealValue: 10,
        },
      ],
    });
    expect(parsed.experiences[0].missingFields).toEqual([]);
  });
});
