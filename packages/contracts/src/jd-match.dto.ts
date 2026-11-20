/**
 * Đối chiếu mức độ phù hợp JD — DTO dành riêng cho Nhà tuyển dụng (Drawer hồ sơ ứng viên).
 *
 * ⚠ BẢO MẬT: khối này KHÔNG bao giờ trả về trọng số (%) hay công thức tính điểm.
 * Chỉ trả về trạng thái định tính (MATCHED / PARTIAL / MISMATCH / MISSING) + bằng
 * chứng đối chiếu cụ thể để NTD đọc trong 3 giây và ra quyết định sàng lọc.
 */

/** Nhóm tiêu chí lớn. */
export type JdMatchGroup = 'EXPERIENCE' | 'CONDITION';

/**
 * Trạng thái đối chiếu của 1 tiêu chí.
 * - `MATCHED`: khớp — ứng viên đáp ứng yêu cầu JD.
 * - `PARTIAL`: khớp một phần.
 * - `MISMATCH`: chưa khớp / lệch thật giữa hồ sơ và JD.
 * - `MISSING`: ứng viên chưa cập nhật thông tin (không phải 0 điểm).
 */
export type JdMatchStatus = 'MATCHED' | 'PARTIAL' | 'MISMATCH' | 'MISSING';

/** Mức độ phù hợp tổng thể (định tính, không lộ trọng số). */
export type JdMatchLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'POOR';

/** Đánh giá định tính của 1 nhóm tiêu chí lớn. */
export type JdMatchGroupStatus = 'HIGH' | 'PARTIAL' | 'LOW' | 'MISSING';

/** 1 tiêu chí đã chuẩn hoá — KHÔNG có trường trọng số. */
export interface JdMatchCriterion {
  /** Mã tiêu chí (vd "jd05", "tech.jd04"). */
  key: string;
  /** Tên tiêu chí tiếng Việt. */
  label: string;
  /** Nhóm tiêu chí lớn. */
  group: JdMatchGroup;
  /** Trạng thái đối chiếu. */
  status: JdMatchStatus;
  /** Mô tả ngắn yêu cầu từ JD (có thể null nếu JD không mô tả rõ). */
  jdRequirement: string | null;
  /** Mô tả ngắn dữ liệu thực tế từ hồ sơ ứng viên (null khi `MISSING`). */
  candidateEvidence: string | null;
}

/** Tóm tắt định tính cho 2 nhóm lớn. */
export interface JdMatchGroupSummary {
  /** Trạng thái nhóm Kinh nghiệm thực chiến. */
  experience: JdMatchGroupStatus;
  /** Trạng thái nhóm Điều kiện & kỳ vọng chung. */
  condition: JdMatchGroupStatus;
  /** Mô tả ngắn kèm theo cho nhóm Kinh nghiệm thực chiến. */
  experienceNote: string | null;
  /** Mô tả ngắn kèm theo cho nhóm Điều kiện & kỳ vọng chung. */
  conditionNote: string | null;
}

/**
 * Kết quả đối chiếu JD chuẩn hoá cho NTD.
 *
 * KHÔNG chứa: `weight`, `trong_so`, công thức tính điểm thô.
 */
export interface JdMatchView {
  /** Điểm phù hợp tổng 0–100 (làm tròn). */
  overallScore: number;
  /** Mức độ định tính theo ngưỡng: ≥80 HIGH, 60–79 MEDIUM, 40–59 LOW, <40 POOR. */
  overallLevel: JdMatchLevel;
  /** Nhãn tiếng Việt của `overallLevel` (để Frontend hiển thị đúng 1 nơi). */
  overallLabel: string;
  /** Tóm tắt 2 nhóm lớn. */
  groupSummary: JdMatchGroupSummary;
  /** 1–2 câu nhận xét ngắn gọn, thực tế. */
  aiSummary: string;
  /** Danh sách tiêu chí đã chuẩn hoá. */
  criteria: JdMatchCriterion[];
  /** Ứng viên có đạt điều kiện lọc cứng của JD không. */
  passesHardFilter: boolean;
  /** Lý do loại (chỉ có khi không đạt lọc cứng). */
  rejectReasons: string[];
  /** Track khớp: 'sales' | 'technical' | null. */
  track: 'sales' | 'technical' | null;
}
