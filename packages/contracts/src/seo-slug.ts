/** UUID v1–v8 — dùng để phân biệt param id cũ với slug SEO. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Tên/tiêu đề tiếng Việt → slug URL (không dấu, gạch ngang). */
export function toSeoSlug(input: string): string {
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return raw || 'muc';
}

/**
 * Nếu `base` đã có thì thêm -1, -2, -3… (không đụng bản gốc).
 */
export function nextUniqueSlug(base: string, taken: Iterable<string | null | undefined>): string {
  const used = new Set(
    [...taken].filter((s): s is string => Boolean(s && s.trim())),
  );
  if (!used.has(base)) return base;
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
