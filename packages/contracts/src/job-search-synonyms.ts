/**
 * Đồng bộ từ khóa tìm việc: các cụm cùng nghĩa (bán hàng ≈ sale ≈ kinh doanh).
 * Dùng ở API list jobs — expand trước khi ILIKE.
 */

/** Chuẩn hoá để so nhóm đồng nghĩa (bỏ dấu, lowercase). */
export function normalizeJobSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s+/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mỗi nhóm: các biến thể nên cho cùng kết quả tìm việc.
 * Giữ cả dạng có dấu / không dấu / EN để khớp title trong DB.
 */
export const JOB_SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Sales / bán hàng / kinh doanh
  [
    'bán hàng',
    'ban hang',
    'sale',
    'sales',
    'salesperson',
    'sales executive',
    'sales engineer',
    'sales manager',
    'account executive',
    'kinh doanh',
    'kỹ sư kinh doanh',
    'ky su kinh doanh',
    'nhân viên kinh doanh',
    'nhan vien kinh doanh',
    'nhân viên bán hàng',
    'nhan vien ban hang',
    'chuyên viên kinh doanh',
    'chuyen vien kinh doanh',
    'quản lý kinh doanh',
    'quan ly kinh doanh',
    'business development',
    'bd executive',
    'nvkd',
  ],
  // Service / dịch vụ kỹ thuật
  [
    'dịch vụ',
    'dich vu',
    'service',
    'service engineer',
    'kỹ sư dịch vụ',
    'ky su dich vu',
    'after sales',
    'after-sales',
    'hậu mãi',
    'hau mai',
  ],
  // Automation
  [
    'tự động hóa',
    'tu dong hoa',
    'automation',
    'plc',
    'scada',
    'kỹ sư tự động hóa',
    'ky su tu dong hoa',
  ],
  // HVAC
  [
    'hvac',
    'điều hòa',
    'dieu hoa',
    'cơ điện',
    'co dien',
    'm&e',
    'điều hòa không khí',
    'dieu hoa khong khi',
  ],
];

function groupMatchesQuery(group: readonly string[], queryNorm: string): boolean {
  if (!queryNorm) return false;
  for (const term of group) {
    const t = normalizeJobSearchTerm(term);
    if (!t) continue;
    if (t === queryNorm) return true;
    // Cụm dài trong query: "tuyển sale tại hcm" / "nhân viên kinh doanh b2b"
    if (t.length >= 4 && queryNorm.includes(t)) return true;
    // Query ngắn là một phần synonym: "sale" ⊂ "sales", "kinh doanh" ⊂ "kỹ sư kinh doanh"
    if (queryNorm.length >= 4 && t.includes(queryNorm)) return true;
    // Từ ngắn phổ biến (sale, plc…) — chỉ khớp exact token
    if (queryNorm.length >= 3 && queryNorm.length < 4) {
      const tokens = queryNorm.split(' ');
      if (tokens.includes(t) || t === queryNorm) return true;
    }
  }
  return false;
}

/**
 * Mở rộng keyword tìm việc thành danh sách term để OR trong ILIKE.
 * Luôn gồm nguyên văn người dùng gõ.
 */
export function expandJobSearchKeywords(keyword: string): string[] {
  const raw = keyword.trim();
  if (!raw) return [];

  const queryNorm = normalizeJobSearchTerm(raw);
  const out = new Set<string>([raw]);

  for (const group of JOB_SEARCH_SYNONYM_GROUPS) {
    if (!groupMatchesQuery(group, queryNorm)) continue;
    for (const term of group) {
      const t = term.trim();
      if (t) out.add(t);
    }
  }

  return [...out];
}
