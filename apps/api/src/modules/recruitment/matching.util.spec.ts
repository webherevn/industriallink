import { buildB2bExplanation, buildExplanation, cosine, resolveMatchTrack, skillOverlap } from './matching.util';
import { b2bMatchWeightsForTrack, sumB2bMatchWeights } from '@industriallink/contracts';

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
