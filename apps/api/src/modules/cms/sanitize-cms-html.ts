/**
 * Làm sạch HTML mô tả CMS: bỏ div/style rác (copy từ Word).
 * Giữ định dạng Classic Editor: p, heading, list, link, img, hr, code, màu, font, size.
 */
export function sanitizeCmsHtml(input: string): string {
  let html = input ?? '';
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\/?(script|style|iframe|object|embed|form|input|button)[^>]*>/gi, '');
  html = html.replace(/<\/?div\b[^>]*>/gi, '');
  html = html.replace(/<([a-z0-9]+)\b([^>]*)>/gi, (_m, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    const allowed = new Set([
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'del',
      'strike',
      'a',
      'img',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'hr',
      'code',
      'mark',
      'span',
    ]);
    if (!allowed.has(t)) return '';
    if (t === 'br') return '<br>';
    if (t === 'hr') return '<hr>';
    if (t === 'img') {
      const src = /\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const url = src?.[2] || src?.[3] || src?.[4] || '';
      if (!url || /^javascript:/i.test(url)) return '';
      const altMatch = /\balt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const alt = altMatch?.[2] || altMatch?.[3] || '';
      return `<img src="${url.replace(/"/g, '')}" alt="${alt.replace(/"/g, '')}">`;
    }
    if (t === 'a') {
      const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const url = href?.[2] || href?.[3] || href?.[4] || '';
      if (!url || /^javascript:/i.test(url)) return '<a>';
      return `<a href="${url.replace(/"/g, '')}" rel="nofollow noopener noreferrer">`;
    }

    const styleMatch = /\bstyle\s*=\s*("[^"]*"|'[^']*')/i.exec(attrs);
    const styleRaw = styleMatch?.[1]?.slice(1, -1) ?? '';
    const parts: string[] = [];
    const textAlign = /text-align\s*:\s*(left|center|right|justify)/i.exec(styleRaw);
    if (textAlign && ['p', 'h2', 'h3', 'h4', 'blockquote'].includes(t)) {
      parts.push(`text-align: ${textAlign[1]!.toLowerCase()}`);
    }
    const color = /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)\s*(?:;|$)/i.exec(
      styleRaw,
    );
    if (color && (t === 'span' || t === 'mark')) {
      parts.push(`color: ${color[1]}`);
    }
    const bg = /(?:^|;)\s*background-color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)\s*(?:;|$)/i.exec(
      styleRaw,
    );
    if (bg && t === 'mark') {
      parts.push(`background-color: ${bg[1]}`);
    }
    const fontSize = /(?:^|;)\s*font-size\s*:\s*(\d+(?:\.\d+)?(?:px|pt|em|rem))\s*(?:;|$)/i.exec(
      styleRaw,
    );
    if (fontSize && t === 'span') {
      parts.push(`font-size: ${fontSize[1]}`);
    }
    const fontFamily =
      /(?:^|;)\s*font-family\s*:\s*([^;]+)\s*(?:;|$)/i.exec(styleRaw);
    if (fontFamily && t === 'span') {
      const fam = fontFamily[1]!
        .replace(/["']/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
      if (fam && !/[<>{}]/.test(fam)) {
        parts.push(`font-family: ${fam}`);
      }
    }

    if (t === 'span') {
      const keep = parts.filter(
        (p) =>
          p.startsWith('color:') ||
          p.startsWith('font-size:') ||
          p.startsWith('font-family:'),
      );
      if (!keep.length) return '';
      return `<span style="${keep.join('; ')}">`;
    }
    if (parts.length) return `<${t} style="${parts.join('; ')}">`;
    return `<${t}>`;
  });
  html = html.replace(/<\/?span>/gi, '');
  html = html.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();
  return html;
}
