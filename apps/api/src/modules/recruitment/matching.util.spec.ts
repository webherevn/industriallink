import { buildExplanation, cosine, skillOverlap } from './matching.util';

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
