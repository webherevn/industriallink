import {
  buildB2bExplanation,
  buildExplanation,
  cosine,
  jobToB2bMatchInput,
  resolveMatchTrack,
  skillOverlap,
  toB2bCandidateFromRecords,
} from './matching.util';
import {
  DealType,
  JobTrack,
  b2bMatchWeightsForTrack,
  sumB2bMatchWeights,
} from '@industriallink/contracts';

describe('cosine', () => {
  it('trả 1 khi hai vector đơn vị cùng hướng', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it('trả 0 khi vector rỗng hoặc khác chiều', () => {
    expect(cosine([], [])).toBe(0);
    expect(cosine([1, 0], [1])).toBe(0);
    expect(cosine([1, 0], [])).toBe(0);
  });

  it('trả 0 khi một vector toàn số 0', () => {
    expect(cosine([0, 0], [1, 2])).toBe(0);
  });

  it('tính đúng độ tương đồng trực giao', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe('skillOverlap', () => {
  it('khớp không phân biệt hoa/thường', () => {
    const result = skillOverlap(['PLC Siemens', 'SCADA'], ['plc siemens', 'HMI']);
    expect(result.matched).toEqual(['PLC Siemens']);
    expect(result.missing).toEqual(['SCADA']);
  });

  it('không kỹ năng yêu cầu → matched/missing rỗng', () => {
    expect(skillOverlap([], ['PLC'])).toEqual({ matched: [], missing: [] });
  });

  it('bỏ qua chuỗi kỹ năng trống / chỉ khoảng trắng', () => {
    const result = skillOverlap(['PLC', '  ', ''], ['PLC']);
    expect(result.matched).toEqual(['PLC']);
    expect(result.missing).toEqual([]);
  });
});

describe('buildExplanation', () => {
  it('clamp score trong 0–100 khi semantic ngoài biên', () => {
    const high = buildExplanation(2, ['PLC'], ['PLC']);
    expect(high.score).toBeLessThanOrEqual(100);
    expect(high.score).toBeGreaterThanOrEqual(0);

    const low = buildExplanation(-5, ['PLC'], []);
    expect(low.score).toBeLessThanOrEqual(100);
    expect(low.score).toBeGreaterThanOrEqual(0);
  });

  it('xử lý NaN semantic an toàn', () => {
    const explanation = buildExplanation(Number.NaN, [], []);
    expect(explanation.score).toBe(0);
    expect(explanation.reason).toMatch(/0%/);
  });

  it('không kỹ năng yêu cầu → điểm theo semantic, không liệt kê thiếu', () => {
    const explanation = buildExplanation(0.5, [], ['PLC']);
    expect(explanation.matchedSkills).toEqual([]);
    expect(explanation.missingSkills).toEqual([]);
    expect(explanation.score).toBe(50);
    expect(explanation.reason).not.toMatch(/Còn thiếu/);
  });

  it('tính score kết hợp semantic + skill ratio', () => {
    // semantic 1.0, khớp 2/2 → score 100
    const full = buildExplanation(1, ['A', 'B'], ['A', 'B']);
    expect(full.score).toBe(100);
    expect(full.matchedSkills).toEqual(['A', 'B']);

    // semantic 0, khớp 0/2 → score 0
    const none = buildExplanation(0, ['A', 'B'], []);
    expect(none.score).toBe(0);
    expect(none.missingSkills).toEqual(['A', 'B']);
  });
});

describe('b2bMatchWeightsForTrack — đồng bộ ma trận điểm gợi ý', () => {
  it('tổng trọng số KD và KT ≈ 1', () => {
    expect(sumB2bMatchWeights('sales')).toBeCloseTo(1, 8);
    expect(sumB2bMatchWeights('technical')).toBeCloseTo(1, 8);
  });

  it('sản phẩm KD ~17%, thiết bị KT = 19%', () => {
    const sales = b2bMatchWeightsForTrack('sales');
    const tech = b2bMatchWeightsForTrack('technical');
    expect(sales.products).toBeGreaterThanOrEqual(0.16);
    expect(sales.products).toBeLessThanOrEqual(0.18);
    expect(tech.products).toBeCloseTo(0.19, 4);
    expect(tech.sellingCapability).toBeCloseTo(0.2, 4);
    expect(tech.dealProfile).toBeCloseTo(0.08, 4);
    expect(tech.achievements).toBeCloseTo(0.05, 4);
  });
});

describe('resolveMatchTrack', () => {
  it('ưu tiên jobLevel kỹ thuật trên jobTrack ứng viên', () => {
    expect(
      resolveMatchTrack({
        job: { jobLevel: 'technical.staff' },
        candidate: { jobTrack: 'sales' },
      }),
    ).toBe('technical');
  });

  it('search không gắn tin → dùng jobTrack ứng viên', () => {
    expect(resolveMatchTrack({ candidate: { jobTrack: 'technical' } })).toBe('technical');
    expect(resolveMatchTrack({})).toBe('sales');
  });
});

describe('buildB2bExplanation theo track', () => {
  it('tin kỹ thuật dùng nhãn và trọng số KT', () => {
    const explanation = buildB2bExplanation({
      semantic: 0.5,
      candidate: {
        jobTrack: 'technical',
        productsSold: ['PLC / HMI'],
        technicalWorkTypes: ['Bảo trì'],
        technicalAutonomyLevel: 4,
        salesHighlights: 'Dự án HVAC nhà máy FDI — bàn giao đúng hạn 8/8',
      },
      job: {
        jobLevel: 'technical.staff',
        title: 'Kỹ sư tự động hóa PLC',
        filterProducts: ['PLC / HMI'],
      },
    });
    const products = explanation.criteria?.find((c) => c.key === 'products');
    expect(products?.label).toMatch(/Thiết bị/);
    expect(products?.weight).toBeCloseTo(0.19, 4);
    const deal = explanation.criteria?.find((c) => c.key === 'dealProfile');
    expect(deal?.label).toMatch(/tự chủ/i);
    expect(deal?.score).toBe(1);
  });
});

describe('JD Sales 22 trường ↔ CV (dữ liệu, không suy diễn)', () => {
  it('gộp sản phẩm / tệp KH / loại hình từ mọi công ty', () => {
    const candidate = toB2bCandidateFromRecords({
      profile: {
        productsSold: ['Máy nén khí'],
        customerSegments: ['Nhà máy FDI'],
        dealType: DealType.Equipment,
        desiredPositions: ['Nhân viên kinh doanh'],
      },
      experiences: [
        {
          jobTitle: 'Sales Engineer',
          productsSold: ['Robot công nghiệp'],
          customerSegments: ['Tổng thầu EPC'],
          dealType: DealType.Project,
          industries: ['Tự động hóa'],
          marketsCovered: ['Miền Bắc'],
        },
      ],
    });
    expect(candidate.productsSold).toEqual(expect.arrayContaining(['Máy nén khí', 'Robot công nghiệp']));
    expect(candidate.customerSegments).toEqual(
      expect.arrayContaining(['Nhà máy FDI', 'Tổng thầu EPC']),
    );
    expect(candidate.dealTypes).toEqual(expect.arrayContaining([DealType.Equipment, DealType.Project]));
    expect(candidate.jobTitles).toEqual(expect.arrayContaining(['Sales Engineer']));
    expect(candidate.marketsCovered).toEqual(['Miền Bắc']);
  });

  it('JD có sản phẩm khớp CV — không suy diễn thêm từ title', () => {
    const job = jobToB2bMatchInput({
      title: 'Nhân viên kinh doanh robot công nghiệp',
      jobTrack: JobTrack.Sales,
      salesCriteria: { productsSold: ['Máy nén khí'] },
    });
    expect(job.strictJdCriteria).toBe(true);
    expect(job.filterProducts).toEqual(['Máy nén khí']);

    const explanation = buildB2bExplanation({
      semantic: 0.4,
      candidate: { productsSold: ['Máy nén khí'], jobTrack: 'sales' },
      job,
    });
    const products = explanation.criteria?.find((c) => c.key === 'products');
    expect(products?.score).toBe(1);
    expect(products?.note).toMatch(/Máy nén khí/);
  });

  it('JD không ghi sản phẩm → không suy robot từ title, bỏ qua tiêu chí', () => {
    const job = jobToB2bMatchInput({
      title: 'Nhân viên kinh doanh robot công nghiệp',
      description: 'Bán robot công nghiệp cho nhà máy FDI',
      jobTrack: JobTrack.Sales,
      salesCriteria: { productsSold: [] },
    });
    const explanation = buildB2bExplanation({
      semantic: 0.4,
      candidate: { productsSold: ['Robot công nghiệp'], jobTrack: 'sales' },
      job,
    });
    const products = explanation.criteria?.find((c) => c.key === 'products');
    expect(products?.score).toBeNull();
  });

  it('thị trường JD không lấy nơi làm mong muốn của CV', () => {
    const job = jobToB2bMatchInput({
      title: 'Sales B2B',
      location: 'Hà Nội',
      jobTrack: JobTrack.Sales,
      salesCriteria: { marketsCovered: ['Miền Bắc'] },
    });
    const explanation = buildB2bExplanation({
      semantic: 0.2,
      candidate: {
        jobTrack: 'sales',
        desiredLocations: ['Hà Nội'],
        marketsCovered: [],
      },
      job,
    });
    const region = explanation.criteria?.find((c) => c.key === 'region');
    expect(region?.score).toBeCloseTo(0.5, 5);
    expect(region?.note).toMatch(/Nơi làm: Hà Nội/);
    expect(region?.note).toMatch(/Chưa khớp thị trường/);
  });

  it('không chấm thành tích / hunter-farmer khi JD Sales 22 trường không có các mục đó', () => {
    const job = jobToB2bMatchInput({
      title: 'Nhân viên kinh doanh',
      jobTrack: JobTrack.Sales,
      salesCriteria: { productsSold: ['Máy nén khí'] },
    });
    const explanation = buildB2bExplanation({
      semantic: 0.3,
      candidate: {
        jobTrack: 'sales',
        productsSold: ['Máy nén khí'],
        latestRevenue: 12_000_000_000,
        kpiAchievementPct: 140,
        customerDevStyle: 'hunter',
        jobReadiness: 'active',
        languages: ['Tiếng Anh'],
      },
      job,
    });
    expect(explanation.criteria?.find((c) => c.key === 'achievements')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'customerDev')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'salesStyle')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'readiness')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'languages')?.score).toBeNull();
  });

  it('giai đoạn bán: JD trống thì không so với full cycle 12 bước', () => {
    const job = jobToB2bMatchInput({
      title: 'Sales',
      jobTrack: JobTrack.Sales,
      salesCriteria: { sellingStages: [] },
    });
    const explanation = buildB2bExplanation({
      semantic: 0.2,
      candidate: { jobTrack: 'sales', sellingStages: ['Tìm kiếm khách hàng'] },
      job,
    });
    expect(explanation.criteria?.find((c) => c.key === 'sellingCapability')?.score).toBeNull();
  });

  it('JD kỹ thuật: thiết bị khớp CV — không suy diễn thêm từ title', () => {
    const job = jobToB2bMatchInput({
      title: 'Kỹ sư robot công nghiệp',
      jobTrack: JobTrack.Technical,
      technicalCriteria: { equipmentSystems: ['Tự động hóa / Điều khiển'] },
    });
    expect(job.strictJdCriteria).toBe(true);
    expect(job.filterProducts).toEqual(['Tự động hóa / Điều khiển']);

    const explanation = buildB2bExplanation({
      semantic: 0.4,
      candidate: { productsSold: ['Tự động hóa / Điều khiển'], jobTrack: 'technical' },
      job,
    });
    const products = explanation.criteria?.find((c) => c.key === 'products');
    expect(products?.score).toBe(1);
    expect(products?.note).toMatch(/Tự động hóa/);
  });

  it('JD kỹ thuật không ghi thiết bị → không suy từ title, bỏ qua tiêu chí', () => {
    const job = jobToB2bMatchInput({
      title: 'Kỹ sư robot công nghiệp',
      description: 'Làm việc với robot công nghiệp tại nhà máy',
      jobTrack: JobTrack.Technical,
      technicalCriteria: { equipmentSystems: [] },
    });
    const explanation = buildB2bExplanation({
      semantic: 0.4,
      candidate: { productsSold: ['Robot / Tự động hóa sản xuất'], jobTrack: 'technical' },
      job,
    });
    const products = explanation.criteria?.find((c) => c.key === 'products');
    expect(products?.score).toBeNull();
  });

  it('công việc kỹ thuật: JD trống thì không so với full catalog', () => {
    const job = jobToB2bMatchInput({
      title: 'Kỹ sư bảo trì',
      jobTrack: JobTrack.Technical,
      technicalCriteria: { technicalWorkTypes: [] },
    });
    const explanation = buildB2bExplanation({
      semantic: 0.2,
      candidate: { jobTrack: 'technical', technicalWorkTypes: ['Bảo trì / bảo dưỡng'] },
      job,
    });
    expect(explanation.criteria?.find((c) => c.key === 'sellingCapability')?.score).toBeNull();
  });

  it('tự chủ JD yêu cầu mức 4 — ứng viên mức 4 đạt, mức 2 thấp hơn', () => {
    const job = jobToB2bMatchInput({
      title: 'Kỹ sư PLC',
      jobTrack: JobTrack.Technical,
      technicalCriteria: { autonomyLevel: 4 },
    });
    const pass = buildB2bExplanation({
      semantic: 0.2,
      candidate: { jobTrack: 'technical', technicalAutonomyLevel: 4 },
      job,
    });
    expect(pass.criteria?.find((c) => c.key === 'dealProfile')?.score).toBe(1);

    const low = buildB2bExplanation({
      semantic: 0.2,
      candidate: { jobTrack: 'technical', technicalAutonomyLevel: 2 },
      job,
    });
    expect(low.criteria?.find((c) => c.key === 'dealProfile')?.score).toBeCloseTo(0.5, 5);
  });

  it('không chấm thành tích / hunter khi JD kỹ thuật 23 trường không có các mục đó', () => {
    const job = jobToB2bMatchInput({
      title: 'Kỹ sư điện',
      jobTrack: JobTrack.Technical,
      technicalCriteria: { equipmentSystems: ['Điện / Điện công nghiệp'] },
    });
    const explanation = buildB2bExplanation({
      semantic: 0.3,
      candidate: {
        jobTrack: 'technical',
        productsSold: ['Điện / Điện công nghiệp'],
        latestRevenue: 1,
        kpiAchievementPct: 140,
        customerDevStyle: 'hunter',
        jobReadiness: 'active',
        languages: ['Tiếng Anh'],
      },
      job,
    });
    expect(explanation.criteria?.find((c) => c.key === 'achievements')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'customerDev')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'salesStyle')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'readiness')?.score).toBeNull();
    expect(explanation.criteria?.find((c) => c.key === 'languages')?.score).toBeNull();
  });
});
