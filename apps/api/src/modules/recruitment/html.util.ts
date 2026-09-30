/**
 * Helper chuẩn hoá HTML / text cho input AI matching & moderation.
 *
 * Job description / requirements / benefits giờ được lưu dưới dạng HTML
 * (đầu ra của Tiptap rich-text editor). AI cần text thuần để so sánh
 * keyword / tóm tắt; truyền HTML nguyên si sẽ làm matching lệch.
 */

const HTML_TAG = /<[^>]+>/g;
const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&zwnj;': '',
  '&zwj;': '',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/**
 * Bóc tách thẻ HTML, decode entity, rút gọn khoảng trắng.
 * An toàn với mọi input: undefined / null / plain text / HTML.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(HTML_TAG, ' ')
    .replace(/&#?\w+;/g, (m) => HTML_ENTITIES[m] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
