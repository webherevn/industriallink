/** Làm sạch một dòng bullet. */
function cleanBullet(line: string): string {
  return line
    .replace(/^[\s\-–—*•·▪●]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim();
}

/**
 * Tách văn bản thành các bullet logic, gọn — dùng cho Nổi bật Sales / mô tả.
 * Ưu tiên xuống dòng / ký hiệu bullet; nếu là đoạn liền thì tách theo câu.
 */
export function toBulletLines(text: string | null | undefined): string[] {
  const raw = (text ?? '').trim();
  if (!raw) return [];

  const byNewline = raw
    .split(/\n+/)
    .map(cleanBullet)
    .filter((s) => s.length >= 2);
  if (byNewline.length > 1) return dedupe(byNewline);

  const byMarker = raw
    .split(/(?:[•·▪●]|\s[-–—]\s|\d+[.)]\s+)/)
    .map(cleanBullet)
    .filter((s) => s.length >= 2);
  if (byMarker.length > 1) return dedupe(byMarker);

  // Đoạn liền: tách theo câu kết thúc (. ! ? …) khi có ≥2 câu đủ dài
  const bySentence = raw
    .split(/(?<=[.!?…])\s+/)
    .map(cleanBullet)
    .filter((s) => s.length >= 12);
  if (bySentence.length > 1) return dedupe(bySentence);

  return [raw];
}

/** Chuẩn hoá về chuỗi nhiều dòng, mỗi dòng một bullet (lưu form). */
export function toBulletText(text: string | null | undefined): string {
  return toBulletLines(text)
    .map((line) => (line.startsWith('•') ? line : `• ${line}`))
    .join('\n');
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.slice(0, 20);
}
