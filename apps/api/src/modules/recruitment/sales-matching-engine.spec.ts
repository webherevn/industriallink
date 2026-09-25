import {
  DealType,
  INDUSTRY_CATALOG,
  INDUSTRY_GROUP_CLUSTER,
  PRODUCT_CATALOG_ANCHORS,
  PRODUCT_CLUSTER,
  PRODUCT_INDUSTRY_GROUP,
  PRODUCT_MATCH_CODES,
  PRODUCT_MATCH_CLUSTER,
  PRODUCTS_SOLD,
  DESIRED_POSITIONS,
  assertSalesMatchWeights,
  durationFactorG2,
  industryLeakageK_D1,
  industryPairSimilarityC,
  industrySimilarityC5,
  khacSimilarityH1H2,
  multiSelectCoverageE1,
  productPairSimilarity,
  recencyFactorG3,
  regionPairSimilarityE3,
  segmentPairSimilarity,
  desiredTitleSimilarityS,
  pastTitleSimilarityS,
  locationSimilarityS,
  experienceSimilarityS,
  salarySimilarityS,
  educationSimilarityS,
  majorBlockOf,
  majorSimilarityS,
  MAJOR_KEYWORDS_KINH_TE,
  MAJOR_KEYWORDS_KY_THUAT,
  PROVINCE_TO_MACRO_REGION,
  vnMacroRegionOf,
  languageSimilarityS,
  travelSimilarityS,
  renormalizeBlockF2,
  scoreSalesMatch,
  sellingStageScoreE4,
  type SalesMatchJdInput,
  type SalesMatchProfileInput,
} from '@industriallink/contracts';

const emptyProfile: SalesMatchProfileInput = {
  desiredPositions: [],
  desiredLocations: [],
  languages: [],
  driverLicenses: [],
};

function jd(partial: Partial<SalesMatchJdInput> & Pick<SalesMatchJdInput, 'industries'>): SalesMatchJdInput {
  return {
    productsSold: [],
    customerSegments: [],
    dealTypes: [],
    sellingStages: [],
    marketsCovered: [],
    languages: [],
    driverLicenses: [],
    ...partial,
  };
}

describe('A5 trọng số 16 trường', () => {
  it('khẳng định 83 + 17 = 100 lúc import', () => {
    expect(() => assertSalesMatchWeights()).not.toThrow();
  });
});

describe('4 vị trí chức danh Sales', () => {
  it('catalog đúng 4 bậc, không có vị trí thêm', () => {
    expect([...DESIRED_POSITIONS]).toEqual([
      'Nhân viên kinh doanh',
      'Trưởng nhóm kinh doanh',
      'Trưởng phòng kinh doanh',
      'Giám đốc kinh doanh',
    ]);
  });
});

describe('P2 sản phẩm 26 mục vs INDUSTRY_CATALOG', () => {
  const named = PRODUCTS_SOLD.filter((p) => p !== 'Thiết bị công nghiệp khác');

  it('mỗi sản phẩm (trừ Khác) gắn đúng 1 nhóm ngành, cụm = C1 của nhóm đó', () => {
    expect(named).toHaveLength(25);
    for (const product of named) {
      const group = PRODUCT_INDUSTRY_GROUP[product];
      expect(group).toBeTruthy();
      expect(PRODUCT_CLUSTER[product]).toBe(INDUSTRY_GROUP_CLUSTER[group]);
    }
  });

  it('neo ngành chi tiết nằm trong đúng nhóm đã gắn — không lấy Dầu máy nén khí', () => {
    for (const product of named) {
      const group = PRODUCT_INDUSTRY_GROUP[product];
      const catalog = INDUSTRY_CATALOG.find((i) => i.name === group);
      expect(catalog).toBeTruthy();
      const subs = new Set(catalog!.subIndustries);
      const anchors = PRODUCT_CATALOG_ANCHORS[product];
      expect(anchors.length).toBeGreaterThan(0);
      for (const anchor of anchors) {
        expect(subs.has(anchor)).toBe(true);
      }
    }
    expect(PRODUCT_INDUSTRY_GROUP['Máy nén khí']).toBe('Thủy lực & Khí nén');
    expect(PRODUCT_CLUSTER['Máy nén khí']).toBe(1);
    expect(INDUSTRY_GROUP_CLUSTER['Dầu mỡ nhờn & Hóa chất công nghiệp']).toBe(4);
  });

  it('cảm biến tự động hóa cùng cụm 2 với đo lường — không đổi điểm sản phẩm vs PLC', () => {
    expect(INDUSTRY_GROUP_CLUSTER['Tự động hóa & Điều khiển']).toBe(2);
    expect(PRODUCT_CLUSTER['Thiết bị đo lường / cảm biến']).toBe(2);
    expect(PRODUCT_CLUSTER['PLC / HMI']).toBe(2);
  });

  it('cụm JSON 15.09 khớp C1 của nhóm ngành catalog', () => {
    expect(PRODUCT_MATCH_CODES).toHaveLength(PRODUCTS_SOLD.length);
    for (let i = 0; i < PRODUCTS_SOLD.length; i += 1) {
      const product = PRODUCTS_SOLD[i];
      const code = PRODUCT_MATCH_CODES[i];
      const jsonCluster = PRODUCT_MATCH_CLUSTER[code];
      if (product === 'Thiết bị công nghiệp khác') {
        expect(jsonCluster).toBeNull();
        continue;
      }
      expect(jsonCluster).toBe(PRODUCT_CLUSTER[product]);
    }
  });
});

describe('C · ngành / cụm', () => {
  it('C2 trùng nhóm → 100', () => {
    expect(industryPairSimilarityC('Thủy lực & Khí nén', 'Thủy lực & Khí nén')).toBe(100);
  });

  it('C3 cùng cụm khác nhóm → 85, không lấy 100 trên đường chéo', () => {
    expect(industryPairSimilarityC('Thủy lực & Khí nén', 'Cơ khí & Chế tạo máy')).toBe(85);
    expect(industryPairSimilarityC('Máy móc & Thiết bị sản xuất', 'Thiết bị & Vật tư MRO')).toBe(85);
  });

  it('C4 khác cụm → ma trận 6×6', () => {
    expect(industryPairSimilarityC('Thủy lực & Khí nén', 'Tự động hóa & Điều khiển')).toBe(65);
    expect(industryPairSimilarityC('HVAC & Cơ điện M&E', 'Dầu mỡ nhờn & Hóa chất công nghiệp')).toBe(30);
  });
});

describe('D1 hệ số K', () => {
  it('S=85 α=0,7 → 0,895', () => {
    expect(industryLeakageK_D1(85, 0.7)).toBeCloseTo(0.895, 10);
  });

  it('S=85 α=0,6 → 0,910', () => {
    expect(industryLeakageK_D1(85, 0.6)).toBeCloseTo(0.91, 10);
  });

  it('S=100 → K=1 với mọi α', () => {
    expect(industryLeakageK_D1(100, 0.7)).toBe(1);
  });
});

describe('E · ma trận trường', () => {
  it('E3 khu vực có hướng: Toàn quốc→Bắc = 100, Bắc→Toàn quốc = 60', () => {
    expect(regionPairSimilarityE3('Toàn quốc', 'Miền Bắc')).toBe(100);
    expect(regionPairSimilarityE3('Miền Bắc', 'Toàn quốc')).toBe(60);
  });

  it('C6 ví dụ 85% ngành → 12,75 điểm', () => {
    expect((85 / 100) * 15).toBeCloseTo(12.75, 10);
  });

  it('E1 chặn mẫu số JD ở 3: 3/5 sản phẩm trùng vẫn 100', () => {
    const cv = ['Máy nén khí', 'Máy hàn', 'Chiller'];
    const jdFive = ['Máy nén khí', 'Máy hàn', 'Chiller', 'Robot công nghiệp', 'Tủ điện'];
    expect(multiSelectCoverageE1(cv, jdFive, productPairSimilarity)).toBe(100);
  });

  it('26×26 sản phẩm chính thức, không lấy 85 cùng cụm', () => {
    expect(productPairSimilarity('Máy nén khí', 'Máy gia công CNC')).toBe(50);
    expect(productPairSimilarity('Máy nén khí', 'Bơm công nghiệp')).toBe(90);
    expect(productPairSimilarity('Lọc bụi / xử lý khí', 'Hệ thống lọc bụi / xử lý khí')).toBe(100);
  });

  it('8×8 nhóm khách hàng chính thức', () => {
    expect(segmentPairSimilarity('Nhà máy FDI', 'Nhà máy Việt Nam')).toBe(90);
    expect(segmentPairSimilarity('Nhà thầu / đơn vị thi công', 'Tổng thầu EPC')).toBe(90);
    expect(segmentPairSimilarity('Đại lý / nhà phân phối', 'Đơn vị thương mại')).toBe(90);
    expect(segmentPairSimilarity('Nhà máy FDI', 'Đại lý / nhà phân phối')).toBe(30);
  });

  it('E4 chỉ nhóm cốt lõi trên JD → 100% nhóm đó', () => {
    const s = sellingStageScoreE4(
      ['Tìm kiếm khách hàng', 'Chốt hợp đồng'],
      ['Tìm kiếm khách hàng', 'Chốt hợp đồng'],
    );
    expect(s).toBe(100);
  });

  it('jd11/jd13 dùng E1 như jd09: JD 1 mục thì bằng max', () => {
    expect(
      multiSelectCoverageE1(
        [DealType.Equipment, DealType.Project],
        [DealType.Equipment],
        (a, b) => (a === b ? 100 : 70),
      ),
    ).toBe(100);
  });
});

describe('v1.1 S khối chung + ngành', () => {
  it('jd01a lệch 1/2/3 cấp', () => {
    expect(desiredTitleSimilarityS('Nhân viên kinh doanh', ['Trưởng nhóm kinh doanh']).S).toBe(70);
    expect(desiredTitleSimilarityS('Nhân viên kinh doanh', ['Trưởng phòng kinh doanh']).S).toBe(40);
    expect(desiredTitleSimilarityS('Nhân viên kinh doanh', ['Giám đốc kinh doanh']).S).toBe(20);
  });

  it('jd01b CV cao hơn không phạt; không chuẩn hoá → 50 + cờ', () => {
    expect(pastTitleSimilarityS('Nhân viên kinh doanh', 'Giám đốc kinh doanh').S).toBe(100);
    expect(pastTitleSimilarityS('Giám đốc kinh doanh', 'Nhân viên kinh doanh').S).toBe(20);
    const unk = pastTitleSimilarityS('Nhân viên kinh doanh', 'Chuyên viên ABCXYZ');
    expect(unk.S).toBe(50);
    expect(unk.canh_bao).toBe('chuc_danh_chua_chuan_hoa');
  });

  it('jd04 v1.2: giao tỉnh/vùng = 100, cùng miền = 50, khác miền = 10', () => {
    expect(locationSimilarityS('Hà Nội', ['Hà Nội'])).toBe(100);
    expect(locationSimilarityS('Hà Nội', ['Miền Bắc'])).toBe(100);
    expect(locationSimilarityS('Miền Bắc', ['Hà Nội'])).toBe(100);
    expect(locationSimilarityS('Hà Nội', ['Hải Phòng'])).toBe(50);
    expect(locationSimilarityS('Hà Nội', ['Điện Biên'])).toBe(50);
    expect(locationSimilarityS('Hà Nội', ['Thành phố Hồ Chí Minh'])).toBe(10);
    expect(locationSimilarityS('Hà Nội', [])).toBe(0);
    expect(locationSimilarityS('', ['Hà Nội'])).toBe(0);
  });

  it('bảng 34 tỉnh JSON khớp catalog 2025 và đủ 41 từ khoá', () => {
    const entries = Object.entries(PROVINCE_TO_MACRO_REGION);
    expect(entries).toHaveLength(34);
    for (const [name, mien] of entries) {
      expect(vnMacroRegionOf(name)).toBe(mien);
    }
    expect(MAJOR_KEYWORDS_KY_THUAT).toHaveLength(28);
    expect(MAJOR_KEYWORDS_KINH_TE).toHaveLength(13);
  });

  it('jd05 thiếu năm theo bậc 80/60/30', () => {
    expect(experienceSimilarityS('3_5', 3)).toBe(100);
    expect(experienceSimilarityS('3_5', 2.5)).toBe(80);
    expect(experienceSimilarityS('3_5', 1.5)).toBe(60);
    expect(experienceSimilarityS('3_5', 0)).toBe(30);
  });

  it('jd06 kỳ vọng / tối thiểu vs trần JD', () => {
    expect(salarySimilarityS(null, 25, 10, 20, null)).toBe(100);
    expect(salarySimilarityS(null, 25, 22, 30, null)).toBe(80);
    expect(salarySimilarityS(null, 25, 27, 30, null)).toBe(50);
    expect(salarySimilarityS(null, 25, 30, 35, null)).toBe(10);
  });

  it('jd14 thấp hơn 1 bậc = 60, từ 2 bậc = 20', () => {
    expect(educationSimilarityS('Đại học', 'Cao đẳng')).toBe(60);
    expect(educationSimilarityS('Đại học', 'THPT')).toBe(20);
  });

  it('jd15 v1.2: trùng tên 100, cùng khối 60, khác/không nhận 25', () => {
    expect(majorSimilarityS('Kỹ thuật cơ khí', 'Kỹ thuật cơ khí')).toBe(100);
    expect(majorSimilarityS('Kỹ thuật cơ khí', 'Điện công nghiệp')).toBe(60);
    expect(majorSimilarityS('Quản trị kinh doanh', 'Kỹ thuật cơ khí')).toBe(25);
    expect(majorSimilarityS('Sư phạm Ngữ văn', 'Kỹ thuật cơ khí')).toBe(25);
    expect(majorBlockOf('Sư phạm Ngữ văn')).toBe('khac');
    expect(majorBlockOf('môi trường')).toBe('ky_thuat');
    expect(majorBlockOf('mỏ')).toBe('ky_thuat');
    expect(majorSimilarityS('Kỹ thuật cơ khí', '')).toBe(0);
  });

  it('jd16 mặc định mức Khá khi JD không ghi mức', () => {
    expect(languageSimilarityS(['Tiếng Anh'], ['Tiếng Anh'])).toBe(100);
    expect(
      languageSimilarityS(['Tiếng Anh'], [], [
        {
          language: 'Tiếng Anh',
          workUsage: 'basic',
          listening: null,
          speaking: null,
          reading: null,
          writing: null,
          technicalManualReading: null,
        },
      ]),
    ).toBe(60);
  });

  it('jd18 thấp 1 bậc = 50, từ 2 bậc = 0', () => {
    expect(travelSimilarityS('25_50', 'up_to_25')).toBe(50);
    expect(travelSimilarityS('25_50', 'none')).toBe(0);
  });

  it('ngành Khác = 30; ví dụ 7 lấy max khi JD nhiều ngành', () => {
    expect(industryPairSimilarityC('Khác', 'Thủy lực & Khí nén')).toBe(30);
    expect(industryPairSimilarityC('Khác', 'Khác')).toBe(30);
    expect(industrySimilarityC5(['Đo lường & Thiết bị công nghiệp'], ['Thủy lực & Khí nén', 'Tự động hóa & Điều khiển'])).toBe(85);
  });

  it('lọc cứng ngành mặc định ≥ 85, siết 100 thì loại cùng cụm', () => {
    const companies = [
      {
        ten: 'A',
        industries: ['Cơ khí & Chế tạo máy'],
        productsSold: [],
        customerSegments: [],
        dealTypes: [],
        sellingStages: [],
        marketsCovered: [],
        isCurrent: true,
      },
    ];
    const near = scoreSalesMatch({
      asOfYear: 2026,
      jd: jd({ industries: ['Thủy lực & Khí nén'], hardFilters: ['industries'] }),
      profile: emptyProfile,
      companies,
    });
    expect(near.dat_loc_cung).toBe(true);
    const exact = scoreSalesMatch({
      asOfYear: 2026,
      jd: jd({
        industries: ['Thủy lực & Khí nén'],
        hardFilters: ['industries'],
        industryHardMinS: 100,
      }),
      profile: emptyProfile,
      companies,
    });
    expect(exact.dat_loc_cung).toBe(false);
  });
});

describe('F2 chuẩn hoá JD trống', () => {
  it('60 trên 85 còn lại → 70,6', () => {
    expect(renormalizeBlockF2(60, 85)).toBeCloseTo(70.5882352941, 6);
    expect(Math.round(renormalizeBlockF2(60, 85) * 10) / 10).toBe(70.6);
  });
});

describe('G · nhiều công ty', () => {
  it('G2 đúng 1 năm → ≈ 0,667', () => {
    expect(durationFactorG2(1)).toBeCloseTo(2 / 3, 6);
  });

  it('G2 từ 3 năm → 1', () => {
    expect(durationFactorG2(3)).toBe(1);
    expect(durationFactorG2(10)).toBe(1);
  });

  it('G3 đang làm → 1; nghỉ 9 năm → 0,65', () => {
    expect(recencyFactorG3({ ten: 'A', industries: [], productsSold: [], customerSegments: [], dealTypes: [], sellingStages: [], marketsCovered: [], isCurrent: true }, 2026)).toBe(1);
    expect(
      recencyFactorG3(
        {
          ten: 'B',
          industries: [],
          productsSold: [],
          customerSegments: [],
          dealTypes: [],
          sellingStages: [],
          marketsCovered: [],
          endYear: 2017,
          isCurrent: false,
        },
        2026,
      ),
    ).toBe(0.65);
  });

  it('H4 một công ty → B=0; G7 không giảm điểm khi thêm công ty lệch', () => {
    const baseJd = jd({
      industries: ['Thủy lực & Khí nén'],
      productsSold: ['Máy nén khí'],
    });
    const one = scoreSalesMatch({
      asOfYear: 2026,
      jd: baseJd,
      profile: emptyProfile,
      companies: [
        {
          ten: 'Công ty A',
          industries: ['Thủy lực & Khí nén'],
          productsSold: ['Máy nén khí'],
          customerSegments: [],
          dealTypes: [],
          sellingStages: [],
          marketsCovered: [],
          startYear: 2020,
          isCurrent: true,
        },
      ],
    });
    expect(one.thuong_be_day).toBe(0);
    expect(one.cong_ty_tot_nhat?.ten).toBe('Công ty A');

    const two = scoreSalesMatch({
      asOfYear: 2026,
      jd: baseJd,
      profile: emptyProfile,
      companies: [
        {
          ten: 'Công ty A',
          industries: ['Thủy lực & Khí nén'],
          productsSold: ['Máy nén khí'],
          customerSegments: [],
          dealTypes: [],
          sellingStages: [],
          marketsCovered: [],
          startYear: 2020,
          isCurrent: true,
        },
        {
          ten: 'Công ty lệch',
          industries: ['Dầu mỡ nhờn & Hóa chất công nghiệp'],
          productsSold: ['Thiết bị công nghiệp khác'],
          customerSegments: [],
          dealTypes: [],
          sellingStages: [],
          marketsCovered: [],
          startYear: 2010,
          endYear: 2012,
          isCurrent: false,
        },
      ],
    });
    expect(two.thuong_be_day).toBeGreaterThan(0);
    expect(two.diem_kinh_nghiem ?? 0).toBeGreaterThanOrEqual(one.diem_kinh_nghiem ?? 0);
  });
});

describe('H1 / H2 Khác', () => {
  it('hai bên Khác → 30; một bên Khác → 10', () => {
    expect(khacSimilarityH1H2('Khác', 'Khác')).toBe(30);
    expect(khacSimilarityH1H2('Khác', 'Máy nén khí')).toBe(10);
    expect(productPairSimilarity('Thiết bị công nghiệp khác', 'Máy nén khí')).toBe(10);
    expect(productPairSimilarity('Thiết bị công nghiệp khác', 'Thiết bị công nghiệp khác')).toBe(30);
    expect(segmentPairSimilarity('Khác', 'Nhà máy FDI')).toBe(10);
    expect(segmentPairSimilarity('Khác', 'Khác')).toBe(30);
  });
});

describe('scoreSalesMatch I5 xác định', () => {
  it('cùng đầu vào ra cùng điểm; H6 1 chữ số thập phân', () => {
    const input = {
      asOfYear: 2026,
      jd: jd({
        title: 'Kỹ sư kinh doanh',
        industries: ['Thủy lực & Khí nén'],
        productsSold: ['Máy nén khí'],
        customerSegments: ['Nhà máy FDI'],
        dealTypes: [DealType.Equipment],
        marketsCovered: ['Miền Bắc'],
      }),
      profile: {
        ...emptyProfile,
        desiredPositions: ['Kỹ sư kinh doanh'],
      },
      companies: [
        {
          ten: 'Công ty A',
          jobTitle: 'Kỹ sư kinh doanh',
          industries: ['Thủy lực & Khí nén'],
          productsSold: ['Máy nén khí'],
          customerSegments: ['Nhà máy FDI'],
          dealTypes: [DealType.Equipment],
          sellingStages: [],
          marketsCovered: ['Toàn quốc'],
          startYear: 2020,
          isCurrent: true,
        },
      ],
    };
    const a = scoreSalesMatch(input);
    const b = scoreSalesMatch(input);
    expect(a.diem_phu_hop).toBe(b.diem_phu_hop);
    expect(a.diem_phu_hop).not.toBeNull();
    expect(Number.isInteger((a.diem_phu_hop ?? 0) * 10)).toBe(true);
  });

  it('B2 lọc cứng fail → diem null, không chấm tiếp', () => {
    const result = scoreSalesMatch({
      asOfYear: 2026,
      jd: jd({
        industries: ['Thủy lực & Khí nén'],
        languages: ['Tiếng Anh'],
        hardFilters: ['languages'],
      }),
      profile: emptyProfile,
      companies: [
        {
          ten: 'A',
          industries: ['Thủy lực & Khí nén'],
          productsSold: [],
          customerSegments: [],
          dealTypes: [],
          sellingStages: [],
          marketsCovered: [],
          isCurrent: true,
        },
      ],
    });
    expect(result.dat_loc_cung).toBe(false);
    expect(result.diem_phu_hop).toBeNull();
    expect(result.ly_do_loai.length).toBeGreaterThan(0);
  });

  it('jd02 trống (F3) không chiết khấu K', () => {
    const result = scoreSalesMatch({
      asOfYear: 2026,
      jd: jd({
        industries: [],
        productsSold: ['Máy nén khí'],
      }),
      profile: emptyProfile,
      companies: [
        {
          ten: 'A',
          industries: ['Dầu mỡ nhờn & Hóa chất công nghiệp'],
          productsSold: ['Máy nén khí'],
          customerSegments: [],
          dealTypes: [],
          sellingStages: [],
          marketsCovered: [],
          startYear: 2020,
          isCurrent: true,
        },
      ],
    });
    const jd09 = result.chi_tiet.find((r) => r.truong === 'jd09');
    expect(jd09?.K).toBe(1);
    expect(result.chi_tiet.find((r) => r.truong === 'jd02')).toBeUndefined();
  });
});
