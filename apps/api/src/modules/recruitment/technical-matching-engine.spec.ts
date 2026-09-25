import {
  assertTechnicalMatchWeights,
  autonomySimilarityS,
  desiredTechnicalTitleS,
  documentPairSimilarity,
  environmentPairSimilarity,
  equipmentPairSimilarity,
  industryLeakageK_D1,
  locationSimilarityS,
  majorSimilarityS,
  multiSelectCoverageE1,
  scoreTechnicalMatch,
  shiftSimilarityS,
  TECHNICAL_DESIRED_POSITIONS,
  toolPairSimilarity,
  workTypePairSimilarity,
  type TechnicalMatchJdInput,
  type TechnicalMatchProfileInput,
} from '@industriallink/contracts';

const emptyProfile: TechnicalMatchProfileInput = {
  desiredPositions: [],
  desiredLocations: [],
  languages: [],
  certificates: [],
  driverLicenses: [],
  technicalTools: [],
  documentLiteracy: [],
};

function jd(partial: Partial<TechnicalMatchJdInput> = {}): TechnicalMatchJdInput {
  return {
    industries: [],
    equipmentSystems: [],
    workEnvironments: [],
    technicalWorkTypes: [],
    languages: [],
    certificates: [],
    driverLicenses: [],
    technicalTools: [],
    documentLiteracy: [],
    ...partial,
  };
}

describe('A5 trọng số 19 trường Kỹ thuật', () => {
  it('khẳng định 70 + 30 = 100 lúc import', () => {
    expect(() => assertTechnicalMatchWeights()).not.toThrow();
  });
});

describe('13 vị trí kỹ thuật', () => {
  it('catalog đúng 13 vị trí + Khác không nằm trong desired', () => {
    expect(TECHNICAL_DESIRED_POSITIONS).toHaveLength(13);
  });
});

describe('D1 hệ số K kỹ thuật', () => {
  it('S=85 α=0,7 → 0,895', () => {
    expect(industryLeakageK_D1(85, 0.7)).toBeCloseTo(0.895, 6);
  });
  it('S=85 α=0,4 → 0,940', () => {
    expect(industryLeakageK_D1(85, 0.4)).toBeCloseTo(0.94, 6);
  });
  it('trái ngành S=30 α=0,3 (công việc) vẫn 0,790', () => {
    expect(industryLeakageK_D1(30, 0.3)).toBeCloseTo(0.79, 6);
  });
});

describe('E ma trận thiết bị / việc / môi trường / bản vẽ', () => {
  it('E1 trùng mục 100, cùng nhóm khác mục 85, nhóm 1–2 = 65', () => {
    expect(equipmentPairSimilarity('Cơ khí / Cơ khí chế tạo', 'Cơ khí / Cơ khí chế tạo')).toBe(100);
    expect(equipmentPairSimilarity('Cơ khí / Cơ khí chế tạo', 'Thủy lực')).toBe(85);
    expect(equipmentPairSimilarity('Cơ khí / Cơ khí chế tạo', 'Điện / Điện công nghiệp')).toBe(65);
  });
  it('H1/H2 Khác thiết bị = 30 / 10', () => {
    expect(equipmentPairSimilarity('Khác', 'Khác')).toBe(30);
    expect(equipmentPairSimilarity('Khác', 'Thủy lực')).toBe(10);
  });
  it('E2 Thiết kế vs Vận hành = 45; cùng nhóm 85', () => {
    expect(workTypePairSimilarity('Thiết kế', 'Vận hành')).toBe(45);
    expect(workTypePairSimilarity('Thiết kế', 'Bóc tách / khảo sát')).toBe(85);
  });
  it('E3 nhà máy vs công trường = 60', () => {
    expect(environmentPairSimilarity('Nhà máy / xưởng', 'Công trường / dự án')).toBe(60);
  });
  it('E4 P&ID vs bản vẽ điện = 70; datasheet vs manual = 80', () => {
    expect(documentPairSimilarity('P&ID / sơ đồ công nghệ', 'Bản vẽ điện')).toBe(70);
    expect(documentPairSimilarity('Datasheet / thông số kỹ thuật', 'Manual / tài liệu hướng dẫn')).toBe(
      80,
    );
  });
  it('E5 công cụ khớp chính xác, Word/Excel chuẩn hoá', () => {
    expect(toolPairSimilarity('AutoCAD', 'AutoCAD')).toBe(100);
    expect(toolPairSimilarity('Word/Excel', 'Word / Excel')).toBe(100);
    expect(toolPairSimilarity('AutoCAD', 'SolidWorks')).toBe(0);
  });
  it('E1 JD một mục thì bằng max', () => {
    expect(
      multiSelectCoverageE1(
        ['Thủy lực', 'HVAC / Điều hòa – thông gió'],
        ['Cơ khí / Cơ khí chế tạo'],
        equipmentPairSimilarity,
      ),
    ).toBe(85);
  });
});

describe('P4 vị trí / tự chủ / ngoài giờ / địa điểm / chuyên ngành', () => {
  it('jd01a trùng 100, cùng cấp khác chuyên môn 70, lệch 1/2 cấp 60/30', () => {
    expect(desiredTechnicalTitleS('Kỹ sư cơ khí', ['Kỹ sư cơ khí']).S).toBe(100);
    expect(desiredTechnicalTitleS('Kỹ sư cơ khí', ['Kỹ sư điện / Điện công nghiệp']).S).toBe(70);
    expect(desiredTechnicalTitleS('Kỹ thuật viên', ['Kỹ sư cơ khí']).S).toBe(60);
    expect(desiredTechnicalTitleS('Kỹ thuật viên', ['Quản lý kỹ thuật']).S).toBe(30);
  });
  it('jd11 bằng hoặc hơn 100, kém 1/2/3+ = 70/40/10', () => {
    expect(autonomySimilarityS(3, 3)).toBe(100);
    expect(autonomySimilarityS(3, 5)).toBe(100);
    expect(autonomySimilarityS(3, 2)).toBe(70);
    expect(autonomySimilarityS(4, 2)).toBe(40);
    expect(autonomySimilarityS(5, 1)).toBe(10);
  });
  it('jd18 ngoài giờ 100 / 50 / 0', () => {
    expect(shiftSimilarityS('yes', 'yes')).toBe(100);
    expect(shiftSimilarityS('yes', 'limited')).toBe(50);
    expect(shiftSimilarityS('yes', 'no')).toBe(0);
  });
  it('jd03 dùng chung 100/50/10 với Sales', () => {
    expect(locationSimilarityS('Hà Nội', ['Miền Bắc'])).toBe(100);
    expect(locationSimilarityS('Hà Nội', ['Hải Phòng'])).toBe(50);
    expect(locationSimilarityS('Hà Nội', ['Thành phố Hồ Chí Minh'])).toBe(10);
  });
  it('jd13 dùng chung 100/60/25', () => {
    expect(majorSimilarityS('Kỹ thuật cơ khí', 'Kỹ thuật cơ khí')).toBe(100);
    expect(majorSimilarityS('Kỹ thuật cơ khí', 'Điện công nghiệp')).toBe(60);
    expect(majorSimilarityS('Sư phạm Ngữ văn', 'Kỹ thuật cơ khí')).toBe(25);
  });
});

describe('scoreTechnicalMatch I5 + P5 tiền tố', () => {
  it('cùng đầu vào ra cùng điểm; chi tiết dùng tech.jd08 không phải jd09 Sales', () => {
    const input = {
      asOfYear: 2026,
      jd: jd({
        title: 'Kỹ sư cơ khí',
        industries: ['Cơ khí & Chế tạo máy'],
        equipmentSystems: ['Cơ khí / Cơ khí chế tạo'],
        location: 'Hà Nội',
      }),
      profile: {
        ...emptyProfile,
        desiredPositions: ['Kỹ sư cơ khí'],
        desiredLocations: ['Hà Nội'],
        industriesExperienced: ['Cơ khí & Chế tạo máy'],
        equipmentSystems: ['Cơ khí / Cơ khí chế tạo'],
      },
      companies: [
        {
          ten: 'ABC',
          jobTitle: 'Kỹ sư cơ khí',
          industries: ['Cơ khí & Chế tạo máy'],
          equipmentSystems: ['Cơ khí / Cơ khí chế tạo'],
          workEnvironments: ['Nhà máy / xưởng'],
          technicalWorkTypes: ['Bảo trì / bảo dưỡng'],
          startYear: 2022,
          isCurrent: true,
        },
      ],
    };
    const a = scoreTechnicalMatch(input);
    const b = scoreTechnicalMatch(input);
    expect(a.diem_phu_hop).toBe(b.diem_phu_hop);
    expect(a.chi_tiet.some((r) => r.truong === 'tech.jd08')).toBe(true);
    expect(a.chi_tiet.every((r) => r.truong.startsWith('tech.'))).toBe(true);
    const env = a.chi_tiet.find((r) => r.truong === 'tech.jd09');
    expect(env?.label).not.toBe('Sản phẩm / thiết bị');
  });

  it('B2 lọc cứng chứng chỉ fail → diem null', () => {
    const result = scoreTechnicalMatch({
      jd: jd({
        certificates: ['An toàn điện'],
        hardFilters: ['certificates'],
      }),
      profile: emptyProfile,
      companies: [],
    });
    expect(result.dat_loc_cung).toBe(false);
    expect(result.diem_phu_hop).toBeNull();
  });

  it('F3 jd02 trống không chiết khấu K', () => {
    const result = scoreTechnicalMatch({
      asOfYear: 2026,
      jd: jd({
        title: 'Kỹ sư cơ khí',
        equipmentSystems: ['Cơ khí / Cơ khí chế tạo'],
      }),
      profile: {
        ...emptyProfile,
        desiredPositions: ['Kỹ sư cơ khí'],
      },
      companies: [
        {
          ten: 'XYZ',
          jobTitle: 'Kỹ sư cơ khí',
          industries: ['Dầu mỡ nhờn & Hóa chất công nghiệp'],
          equipmentSystems: ['Cơ khí / Cơ khí chế tạo'],
          workEnvironments: [],
          technicalWorkTypes: [],
          startYear: 2020,
          isCurrent: true,
        },
      ],
    });
    const eq = result.chi_tiet.find((r) => r.truong === 'tech.jd08');
    expect(eq?.K).toBe(1);
  });
});
