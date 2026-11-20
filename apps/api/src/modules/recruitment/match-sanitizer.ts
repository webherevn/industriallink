import type {
  MatchExplanation,
  RecruiterMatchCriterion,
  RecruiterMatchExplanation,
} from '@industriallink/contracts';

/**
 * ⚠ BẢO MẬT — Dọn trọng số khỏi payload trả về cho Nhà tuyển dụng.
 *
 * `MatchExplanation` vốn mang `criteria[].weight` và `salesMatch.chi_tiet[].trong_so`
 * — tức là công thức tính điểm. NTD không cần (và không nên) biết trọng số từng
 * tiêu chí: đó là thứ khiến họ "chấm điểm tay" theo trọng số thay vì đọc bằng
 * chứng thực tế. Vì vậy payload recruiter phải được LỘC — không chỉ ẩn ở UI.
 *
 * Hàm này trả về bản sao đã lọc; không mutate input.
 */

/** Trường bị cấm tuyệt đối trong payload gửi cho NTD. */
const BANNED_KEYS = new Set(['weight', 'trong_so', 'weights', 'K', 'diem']);

function stripBanned(node: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    return node
      .map((item) => stripBanned(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (BANNED_KEYS.has(key)) continue;
    const cleaned = stripBanned(value, depth + 1);
    if (cleaned === undefined) continue;
    out[key] = cleaned;
  }
  return out;
}

/**
 * Lọc `MatchExplanation` để trả về cho NTD.
 *
 * - Bỏ `weight` khỏi `criteria[]`.
 * - Bỏ `salesMatch` / `technicalMatch` (chứa `trong_so`, `K`, `diem` — công thức điểm).
 * - Giữ `score`, `matchedSkills`, `missingSkills`, `reason` để các màn khác vẫn dùng được.
 */
export function sanitizeMatchExplanationForRecruiter(
  explanation: MatchExplanation,
): RecruiterMatchExplanation {
  const criteria: RecruiterMatchCriterion[] | undefined = explanation.criteria?.map((c) => {
    const item: RecruiterMatchCriterion = {
      key: c.key,
      label: c.label,
      score: c.score,
      // KHÔNG copy `weight` — field bị loại khỏi object luôn.
    };
    if (c.note != null) item.note = c.note;
    return item;
  });

  const out: RecruiterMatchExplanation = {
    score: explanation.score,
    matchedSkills: explanation.matchedSkills ?? [],
    missingSkills: explanation.missingSkills ?? [],
    reason: explanation.reason,
  };
  if (criteria) out.criteria = criteria;
  // `salesMatch` / `technicalMatch` cố ý KHÔNG copy — chúng chứa trọng số + điểm thô.
  return out;
}

/** Bản sanitize tổng quát cho bất kỳ payload nào (dùng để chặn hồi quy). */
export function stripWeightDeep<T>(payload: T): T {
  return stripBanned(payload) as T;
}
