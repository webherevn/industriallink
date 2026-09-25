/**
 * Làm sạch HTML mô tả CMS: bỏ div/span/style rác (copy từ Word).
 * Chỉ giữ ul, ol, li, p, strong, b, em, br, a, h2–h4.
 */
export function sanitizeCmsHtml(input: string): string {
  let html = input ?? '';
  // Bỏ comment Word / conditional
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  // Bỏ thẻ nguy hiểm
  html = html.replace(/<\/?(script|style|iframe|object|embed|form|input|button)[^>]*>/gi, '');
  // Unwrap div/span giữ nội dung
  html = html.replace(/<\/?div\b[^>]*>/gi, '');
  html = html.replace(/<\/?span\b[^>]*>/gi, '');
  // Bỏ mọi attribute trừ href trên <a>
  html = html.replace(/<([a-z0-9]+)\b([^>]*)>/gi, (_m, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    const allowed = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'h2', 'h3', 'h4']);
    if (!allowed.has(t)) return '';
    if (t === 'br') return '<br>';
    if (t === 'a') {
      const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const url = href?.[2] || href?.[3] || href?.[4] || '';
      if (!url || /^javascript:/i.test(url)) return '<a>';
      return `<a href="${url.replace(/"/g, '')}" rel="nofollow noopener noreferrer">`;
    }
    return `<${t}>`;
  });
  // Dọn khoảng trắng thừa
  html = html.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();
  return html;
}
