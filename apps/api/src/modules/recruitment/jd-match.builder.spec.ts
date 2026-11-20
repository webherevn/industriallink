/**
 * (1) BẢO MẬT khối "Đối chiếu mức độ phù hợp JD" cho Nhà tuyển dụng.
 *
 * - Payload trả về cho NTD KHÔNG BAO GIỜ chứa `weight` / `trong_so` (trọng số)
 *   hay công thức tính điểm thô — phải xóa hẳn khỏi DTO, không chỉ ẩn ở UI.
 * - Mỗi tiêu chí được chuẩn hoá: key / label / group / status / jdRequirement /
 *   candidateEvidence.
 * - `MISSING` (chưa cập nhật) tách bạch với `MISMATCH` (lệch thật).
 */
import { BadRequestException } from '@nestjs/common';
import type { MatchExplanation } from '@industriallink/contracts';
import { buildJdMatchView, containsWeightField } from './jd-match.builder';
import { sanitizeMatchExplanationForRecruiter } from './match-sanitizer';
import {
  assertHuntImmutableFieldsUnchanged,
  IMMUTABLE_HUNT_FIELDS_MESSAGE,
} from './hunt-immutable-fields';

/** Engine Sales trả về đủ bộ trường (S, K, trong_so, diem). */
function salesExplanation(overrides: Partial<MatchExplanation> = {}): MatchExplanation {
  return {
    score: 86.4,
    matchedSkills: [],
    missingSkills: [],
    reason: 'Độ phù hợp 86.4% (Sales B2B).',
    criteria: [
      {
        key: 'jd05',
        label: 'Kinh nghiệm yêu cầu',
        score: 1,
        weight: 0.05,
        note: 'S=100 · K=1.000 · 5.00 điểm',
      },
    ],
    salesMatch: {
      diem_phu_hop: 86.4,
      dat_loc_cung: true,
      ly_do_loai: [],
      diem_kinh_nghiem: 90,
      diem_chung: 80,
      cong_ty_tot_nhat: { ten: 'Công ty A', P: 90, D: 100, R: 100, E: 90 },
      thuong_be_day: 0,
      chi_tiet: [
        {
          truong: 'jd05',
          label: 'Kinh nghiệm yêu cầu',
          S: 100,
          K: 1,
          trong_so: 5,
          diem: 5,
        },
        {
          truong: 'jd01b',
          label: 'Vị trí đã làm',
          S: 90,
          K: 1,
          trong_so: 20,
          diem: 18,
        },
        {
          truong: 'jd06',
          label: 'Mức thu nhập',
          S: 40,
          K: 1,
          trong_so: 6,
          diem: 2.4,
        },
      ],
      khoang_thieu: ['jd06'],
      canh_bao: [],
    },
    ...overrides,
  };
}

describe('buildJdMatchView (khối đối chiếu JD cho NTD)', () => {
  it('KHÔNG bao giờ trả về trường `weight` hay `trong_so`', () => {
    const view = buildJdMatchView(salesExplanation());
    expect(containsWeightField(view)).toBe(false);
    expect(JSON.stringify(view)).not.toContain('"weight"');
    expect(JSON.stringify(view)).not.toContain('"trong_so"');
  });

  it('KHÔNG kèm công thức tính điểm thô (S / K / diem) trong payload', () => {
    const view = buildJdMatchView(salesExplanation());
    const json = JSON.stringify(view);
    expect(json).not.toContain('"S"');
    expect(json).not.toContain('"K"');
    expect(json).not.toContain('"diem"');
  });

  it('chuẩn hoá tiêu chí: key / label / group / status / jdRequirement / candidateEvidence', () => {
    const view = buildJdMatchView(salesExplanation(), {
      jdRequirements: {
        jd05: '3–5 năm',
        jd01b: 'Kỹ thuật viên',
        jd06: '15–25 triệu',
      },
      candidateEvidence: {
        jd05: '4 năm kinh nghiệm',
        jd01b: 'Kỹ sư dịch vụ',
        jd06: '18 triệu',
      },
    });

    expect(view.criteria.length).toBe(3);
    for (const c of view.criteria) {
      expect(typeof c.key).toBe('string');
      expect(typeof c.label).toBe('string');
      expect(['EXPERIENCE', 'CONDITION']).toContain(c.group);
      expect(['MATCHED', 'PARTIAL', 'MISMATCH', 'MISSING']).toContain(c.status);
      expect(c).not.toHaveProperty('weight');
    }

    const exp = view.criteria.find((c) => c.key === 'jd01b');
    expect(exp?.group).toBe('EXPERIENCE');
    expect(exp?.status).toBe('MATCHED');
    expect(exp?.jdRequirement).toBe('Kỹ thuật viên');
    expect(exp?.candidateEvidence).toBe('Kỹ sư dịch vụ');

    const cond = view.criteria.find((c) => c.key === 'jd06');
    expect(cond?.group).toBe('CONDITION');
  });

  it('phân biệt MISSING (chưa cập nhật) với MISMATCH (lệch thật)', () => {
    const view = buildJdMatchView(salesExplanation(), {
      jdRequirements: { jd06: '15–25 triệu' },
      candidateEvidence: { jd06: '10 triệu' },
    });
    // Có bằng chứng nhưng lệch → MISMATCH (không phải MISSING).
    expect(view.criteria.find((c) => c.key === 'jd06')?.status).toBe('MISMATCH');

    const view2 = buildJdMatchView(salesExplanation(), {
      jdRequirements: { jd06: '15–25 triệu' },
      candidateEvidence: {},
    });
    // Không có bằng chứng → MISSING (không bị quy về 0 điểm).
    expect(view2.criteria.find((c) => c.key === 'jd06')?.status).toBe('MISSING');
    expect(view2.criteria.find((c) => c.key === 'jd06')?.candidateEvidence).toBeNull();
  });

  it('trả overallScore / overallLevel / groupSummary / aiSummary', () => {
    const view = buildJdMatchView(salesExplanation());
    expect(view.overallScore).toBe(86);
    expect(view.overallLevel).toBe('HIGH');
    expect(view.overallLabel).toBe('Rất phù hợp');
    expect(view.groupSummary.experience).toBeTruthy();
    expect(view.groupSummary.condition).toBeTruthy();
    expect(typeof view.aiSummary).toBe('string');
    expect(view.aiSummary.length).toBeGreaterThan(0);
  });

  it('ngưỡng overallLevel đúng: ≥80 HIGH, 60–79 MEDIUM, 40–59 LOW, <40 POOR', () => {
    const cases: Array<[number, string]> = [
      [85, 'HIGH'],
      [80, 'HIGH'],
      [79, 'MEDIUM'],
      [60, 'MEDIUM'],
      [59, 'LOW'],
      [40, 'LOW'],
      [39, 'POOR'],
    ];
    for (const [score, expected] of cases) {
      const view = buildJdMatchView(salesExplanation({ score }));
      expect(view.overallLevel).toBe(expected);
    }
  });

  it('nhắc NTD khai thác thêm khi hồ sơ thiếu nhiều thông tin', () => {
    const view = buildJdMatchView(salesExplanation(), {
      jdRequirements: { jd05: '3–5 năm', jd01b: 'Kỹ thuật viên', jd06: '15–25 triệu' },
      candidateEvidence: {},
    });
    expect(view.aiSummary).toContain('chưa cập nhật đủ thông tin');
  });

  it('giữ cờ lọc cứng + lý do loại khi không đạt', () => {
    const base = salesExplanation();
    const view = buildJdMatchView(
      salesExplanation({
        score: 0,
        salesMatch: {
          ...base.salesMatch!,
          dat_loc_cung: false,
          ly_do_loai: ['Ngành / lĩnh vực (bắt buộc)'],
          chi_tiet: [],
        },
      }),
    );
    expect(view.passesHardFilter).toBe(false);
    expect(view.rejectReasons).toEqual(['Ngành / lĩnh vực (bắt buộc)']);
    expect(view.aiSummary).toContain('chưa đạt điều kiện bắt buộc');
  });
});

describe('sanitizeMatchExplanationForRecruiter', () => {
  it('xoá `weight` khỏi criteria và không trả về salesMatch / technicalMatch', () => {
    const sanitized = sanitizeMatchExplanationForRecruiter(salesExplanation());
    expect(sanitized.criteria?.[0]).not.toHaveProperty('weight');
    expect(sanitized).not.toHaveProperty('salesMatch');
    expect(sanitized).not.toHaveProperty('technicalMatch');
    expect(containsWeightField(sanitized)).toBe(false);
  });

  it('giữ lại score / reason / matchedSkills cho các màn khác dùng', () => {
    const sanitized = sanitizeMatchExplanationForRecruiter(salesExplanation());
    expect(sanitized.score).toBe(86.4);
    expect(typeof sanitized.reason).toBe('string');
    expect(Array.isArray(sanitized.matchedSkills)).toBe(true);
  });
});

describe('assertHuntImmutableFieldsUnchanged (khóa cứng Vị trí & Cấp bậc)', () => {
  const current = {
    title: 'Nhân viên kinh doanh',
    jobLevel: 'sales.staff',
    technicalPosition: 'Kỹ thuật viên',
  };

  it('ném 400 khi cố đổi `level` khác bản ghi gốc', () => {
    expect(() =>
      assertHuntImmutableFieldsUnchanged(
        { title: 'Nhân viên kinh doanh', jobLevel: 'sales.manager' },
        current,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertHuntImmutableFieldsUnchanged(
        { title: 'Nhân viên kinh doanh', jobLevel: 'sales.manager' },
        current,
      ),
    ).toThrow(IMMUTABLE_HUNT_FIELDS_MESSAGE);
  });

  it('ném 400 khi cố đổi `position` (vị trí tuyển dụng) khác bản ghi gốc', () => {
    expect(() =>
      assertHuntImmutableFieldsUnchanged(
        {
          title: 'Nhân viên kinh doanh',
          jobLevel: 'sales.staff',
          technicalCriteria: { position: 'Quản lý dự án' },
        },
        current,
      ),
    ).toThrow(BadRequestException);
  });

  it('ném 400 khi cố đổi chức danh (tiêu đề tin)', () => {
    expect(() =>
      assertHuntImmutableFieldsUnchanged(
        { title: 'Giám đốc kinh doanh', jobLevel: 'sales.staff' },
        current,
      ),
    ).toThrow(BadRequestException);
  });

  it('cho phép điều chỉnh tiêu chí tối ưu phạm vi săn (lương, kinh nghiệm, khu vực)', () => {
    expect(() =>
      assertHuntImmutableFieldsUnchanged(
        {
          title: 'Nhân viên kinh doanh',
          jobLevel: 'sales.staff',
          technicalCriteria: { position: 'Kỹ thuật viên' },
        },
        current,
      ),
    ).not.toThrow();
  });

  it('coi khác biệt khác hoa/thường + khoảng trắng là KHÔNG đổi', () => {
    expect(() =>
      assertHuntImmutableFieldsUnchanged(
        { title: '  nhân viên   kinh doanh ', jobLevel: 'SALES.STAFF' },
        current,
      ),
    ).not.toThrow();
  });
});
