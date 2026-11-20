import type {
  JdMatchCriterion,
  JdMatchGroupStatus,
  JdMatchLevel,
  JdMatchStatus,
  JdMatchView,
  MatchExplanation,
} from '@industriallink/contracts';
import {
  SALES_MATCH_COMPANY_FIELDS,
  SALES_MATCH_FIELD_LABEL,
  SALES_MATCH_PROFILE_FIELDS,
  TECH_MATCH_FIELD_LABEL,
} from '@industriallink/contracts';

/**
 * ⚠ BẢO MẬT — KHỐI ĐỐI CHIẾU JD CHO NHÀ TUYỂN DỤNG.
 *
 * Mục tiêu: NTD đọc trong 3 giây và ra quyết định sàng lọc, KHÔNG cần biết
 * công thức tính điểm. Vì vậy khối này:
 *  1. KHÔNG bao giờ trả về trọng số (`weight` / `trong_so`) hay điểm thô.
 *  2. Chuẩn hoá mỗi tiêu chí thành trạng thái định tính + bằng chứng 2 vế.
 *  3. Tách rõ `MISSING` (chưa cập nhật) với `MISMATCH` (lệch thật) để NTD
 *     không hiểu nhầm ứng viên bị 0 điểm.
 */

/** Ngưỡng phân loại điểm S (0–100) của 1 tiêu chí. */
const S_MATCHED = 80;
const S_PARTIAL = 50;
const S_MISMATCH = 30;

/** Ngưỡng phân loại mức độ tổng thể. */
const LEVEL_HIGH = 80;
const LEVEL_MEDIUM = 60;
const LEVEL_LOW = 40;

export const JD_MATCH_LEVEL_LABEL: Record<JdMatchLevel, string> = {
  HIGH: 'Rất phù hợp',
  MEDIUM: 'Khá phù hợp',
  LOW: 'Cân nhắc',
  POOR: 'Chưa phù hợp',
};

export const JD_MATCH_GROUP_LABEL: Record<JdMatchGroupStatus, string> = {
  HIGH: 'Khớp cao',
  PARTIAL: 'Khớp 1 phần',
  LOW: 'Chưa đạt',
  MISSING: 'Thiếu dữ liệu',
};

/** Sales: nhóm "Kinh nghiệm thực chiến" = các trường chấm trên doanh nghiệp. */
const SALES_EXPERIENCE_FIELDS = new Set<string>(SALES_MATCH_COMPANY_FIELDS);

/** Technical: nhóm "Kinh nghiệm thực chiến" = các trường chấm trên doanh nghiệp. */
const TECH_EXPERIENCE_FIELDS = new Set<string>([
  'tech.jd01b',
  'tech.jd02',
  'tech.jd08',
  'tech.jd09',
  'tech.jd10',
  'tech.jd11',
  'tech.jd15',
  'tech.jd18',
  'tech.jd19',
  'tech.jd20',
]);

function classifyStatus(s: number, hasCandidateData: boolean): JdMatchStatus {
  if (!hasCandidateData) return 'MISSING';
  if (s >= S_MATCHED) return 'MATCHED';
  if (s >= S_PARTIAL) return 'PARTIAL';
  if (s >= S_MISMATCH) return 'MISMATCH';
  return 'MISMATCH';
}

/** Chuẩn hoá chuỗi để so sánh "có thay đổi không" (bỏ khoảng trắng + hoa/thường). */
function normalizeLoose(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return null;
}

/** Rút gọn chuỗi bằng chứng để hiển thị 1 dòng gọn. */
function trimEvidence(raw: string | null, max = 120): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export interface JdMatchEvidenceContext {
  /** Tiêu đề JD (dùng làm yêu cầu cho nhóm "Vị trí ứng tuyển"). */
  jobTitle?: string | null;
  /** Yêu cầu từ JD cho từng mã tiêu chí (vd "jd05" → "3–5 năm"). */
  jdRequirements?: Record<string, string | null | undefined>;
  /** Bằng chứng từ hồ sơ ứng viên cho từng mã tiêu chí (vd "jd05" → "4 năm"). */
  candidateEvidence?: Record<string, string | null | undefined>;
}

interface RawCriterion {
  key: string;
  label: string;
  s: number;
  /** Cảnh báo kỹ thuật từ engine (nếu có) — dùng làm bằng chứng bổ sung. */
  warning?: string;
}

/** Chuẩn hoá 1 tiêu chí kèm bằng chứng 2 vế (JD yêu cầu / ứng viên thực tế). */
function toCriterion(
  raw: RawCriterion,
  group: 'EXPERIENCE' | 'CONDITION',
  ctx: JdMatchEvidenceContext,
): JdMatchCriterion {
  const jdRequirement = trimEvidence(ctx.jdRequirements?.[raw.key] ?? null);
  const candidateRaw = ctx.candidateEvidence?.[raw.key] ?? null;
  const candidateEvidence = trimEvidence(candidateRaw ?? raw.warning ?? null);
  // Thiếu dữ liệu ứng viên: KHÔNG quy về 0 điểm → `MISSING` (cần hỏi thêm).
  const hasCandidateData = Boolean(candidateEvidence);
  return {
    key: raw.key,
    label: raw.label,
    group,
    status: classifyStatus(raw.s, hasCandidateData),
    jdRequirement,
    candidateEvidence: hasCandidateData ? candidateEvidence : null,
  };
}

/** Trạng thái định tính của 1 nhóm tiêu chí. */
function summarizeGroup(criteria: JdMatchCriterion[]): JdMatchGroupStatus {
  if (criteria.length === 0) return 'MISSING';
  const scored = criteria.filter((c) => c.status !== 'MISSING');
  if (scored.length === 0) return 'MISSING';
  if (scored.some((c) => c.status === 'MISMATCH')) return 'LOW';
  if (scored.some((c) => c.status === 'PARTIAL')) return 'PARTIAL';
  return 'HIGH';
}

function overallLevelOf(score: number): JdMatchLevel {
  if (score >= LEVEL_HIGH) return 'HIGH';
  if (score >= LEVEL_MEDIUM) return 'MEDIUM';
  if (score >= LEVEL_LOW) return 'LOW';
  return 'POOR';
}

/** Tổng hợp 1–2 câu nhận xét ngắn gọn, thực tế (không lộ trọng số). */
function buildAiSummary(input: {
  score: number;
  level: JdMatchLevel;
  groupSummary: { experience: JdMatchGroupStatus; condition: JdMatchGroupStatus };
  criteria: JdMatchCriterion[];
  passesHardFilter: boolean;
  rejectReasons: string[];
}): string {
  if (!input.passesHardFilter) {
    const reasons = input.rejectReasons.slice(0, 2).join(' · ');
    return `Ứng viên chưa đạt điều kiện bắt buộc của JD${reasons ? `: ${reasons}` : ''}. Cần xem xét thủ công trước khi sàng lọc.`;
  }

  const matched = input.criteria.filter((c) => c.status === 'MATCHED');
  const partial = input.criteria.filter((c) => c.status === 'PARTIAL');
  const mismatch = input.criteria.filter((c) => c.status === 'MISMATCH');
  const missing = input.criteria.filter((c) => c.status === 'MISSING');

  const parts: string[] = [];

  if (input.level === 'HIGH') {
    parts.push(`Hồ sơ phù hợp tốt với vị trí, nổi bật ở ${matched.slice(0, 2).map((c) => c.label).join(' và ') || 'kinh nghiệm thực chiến'}.`);
  } else if (input.level === 'MEDIUM') {
    parts.push(
      `Hồ sơ khá phù hợp, phần mạnh ở ${(matched[0] ?? partial[0])?.label ?? 'kinh nghiệm thực chiến'}${
        partial.length > 0 ? ` nhưng còn ${partial.length} tiêu chí mới đạt một phần` : ''
      }.`,
    );
  } else if (input.level === 'LOW') {
    parts.push(
      `Hồ sơ chỉ đạt một phần yêu cầu${mismatch.length > 0 ? `, lệch rõ ở ${mismatch.slice(0, 2).map((c) => c.label).join(' và ')}` : ''}.`,
    );
  } else {
    parts.push('Hồ sơ hiện chưa phù hợp với các yêu cầu chính của vị trí.');
  }

  // Thiếu dữ liệu → nhấn mạnh để NTD biết cần hỏi thêm, KHÔNG phải ứng viên 0 điểm.
  if (missing.length > 0 && missing.length >= Math.max(1, Math.ceil(input.criteria.length / 2))) {
    parts.push(
      'Hồ sơ ứng viên chưa cập nhật đủ thông tin chuyên môn để đánh giá sâu — nên khai thác thêm khi trao đổi.',
    );
  } else if (missing.length > 0) {
    parts.push(
      `Còn ${missing.length} thông tin chưa được cập nhật (${missing
        .slice(0, 2)
        .map((c) => c.label)
        .join(', ')}) — nên hỏi thêm khi trao đổi.`,
    );
  }

  if (input.groupSummary.experience === 'LOW') {
    parts.push('Kinh nghiệm thực chiến là điểm yếu rõ rệt cần xác minh.');
  } else if (input.groupSummary.condition === 'LOW') {
    parts.push('Điều kiện & kỳ vọng chung chưa khớp với JD.');
  }

  return parts.slice(0, 2).join(' ');
}

/**
 * Dựng `JdMatchView` từ kết quả engine + bằng chứng 2 vế.
 *
 * @param explanation kết quả `MatchExplanation` (đã có `salesMatch` / `technicalMatch`)
 * @param ctx         bằng chứng JD + hồ sơ cho từng mã tiêu chí
 */
export function buildJdMatchView(
  explanation: MatchExplanation,
  ctx: JdMatchEvidenceContext = {},
): JdMatchView {
  const salesMatch = explanation.salesMatch ?? null;
  const technicalMatch = explanation.technicalMatch ?? null;
  const engine = salesMatch ?? technicalMatch;
  const track: 'sales' | 'technical' | null = salesMatch ? 'sales' : technicalMatch ? 'technical' : null;

  const rawRows: RawCriterion[] = engine
    ? engine.chi_tiet.map((r) => ({
        key: String(r.truong),
        label:
          (track === 'technical'
            ? (TECH_MATCH_FIELD_LABEL as Record<string, string>)[r.truong]
            : (SALES_MATCH_FIELD_LABEL as Record<string, string>)[r.truong]) ??
          r.label ??
          String(r.truong),
        s: Number.isFinite(r.S) ? r.S : 0,
        warning: r.canh_bao,
      }))
    : (explanation.criteria ?? []).map((c) => ({
        key: c.key,
        label: c.label,
        // Engine cũ (B2B matrix) chỉ có score 0–1.
        s: c.score == null ? 0 : Math.round(c.score * 100),
        warning: c.note,
      }));

  const isExperienceField = (key: string): boolean =>
    track === 'technical' ? TECH_EXPERIENCE_FIELDS.has(key) : SALES_EXPERIENCE_FIELDS.has(key);

  const criteria = rawRows.map((raw) =>
    toCriterion(raw, isExperienceField(raw.key) ? 'EXPERIENCE' : 'CONDITION', ctx),
  );

  const experienceCriteria = criteria.filter((c) => c.group === 'EXPERIENCE');
  const conditionCriteria = criteria.filter((c) => c.group === 'CONDITION');

  const groupSummary = {
    experience: summarizeGroup(experienceCriteria),
    condition: summarizeGroup(conditionCriteria),
    experienceNote: buildGroupNote(experienceCriteria, 'Kinh nghiệm thực chiến'),
    conditionNote: buildGroupNote(conditionCriteria, 'Điều kiện & kỳ vọng chung'),
  };

  const score = Math.max(0, Math.min(100, Math.round(explanation.score ?? 0)));
  const level = overallLevelOf(score);
  const passesHardFilter = engine ? engine.dat_loc_cung : true;
  const rejectReasons = engine ? engine.ly_do_loai ?? [] : [];

  return {
    overallScore: score,
    overallLevel: level,
    overallLabel: JD_MATCH_LEVEL_LABEL[level],
    groupSummary,
    aiSummary: buildAiSummary({
      score,
      level,
      groupSummary,
      criteria,
      passesHardFilter,
      rejectReasons,
    }),
    criteria,
    passesHardFilter,
    rejectReasons,
    track,
  };
}

/** Mô tả ngắn cho 1 nhóm tiêu chí (dùng làm chú thích dưới thẻ nhóm). */
function buildGroupNote(
  criteria: JdMatchCriterion[],
  groupLabel: string,
): string | null {
  if (criteria.length === 0) return null;
  const matched = criteria.filter((c) => c.status === 'MATCHED');
  const mismatch = criteria.filter((c) => c.status === 'MISMATCH');
  const missing = criteria.filter((c) => c.status === 'MISSING');

  if (mismatch.length > 0) {
    return `${groupLabel}: lệch ở ${mismatch.map((c) => c.label).join(', ')}.`;
  }
  if (matched.length > 0) {
    return `${groupLabel}: khớp ${matched.map((c) => c.label).join(', ')}.`;
  }
  if (missing.length === criteria.length) {
    return `${groupLabel}: ứng viên chưa cập nhật thông tin cho nhóm này.`;
  }
  return null;
}

/**
 * Kiểm tra 1 payload đối chiếu JD có chứa trường cấm (`weight` / `trong_so`) hay không.
 *
 * Dùng trong unit test + guard runtime để chặn hồi quy (regression).
 */
export function containsWeightField(payload: unknown): boolean {
  const BANNED = new Set(['weight', 'trong_so', 'weights']);
  const seen = new Set<unknown>();
  const walk = (node: unknown): boolean => {
    if (node === null || typeof node !== 'object') return false;
    if (seen.has(node)) return false;
    seen.add(node);
    if (Array.isArray(node)) return node.some(walk);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (BANNED.has(key)) return true;
      if (walk(value)) return true;
    }
    return false;
  };
  return walk(payload);
}
