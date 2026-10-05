'use client';

import clsx from 'clsx';
import { useMemo, useState, useEffect } from 'react';

/**
 * Trả về `true` khi chuỗi có vẻ là HTML (chứa thẻ) thay vì plain text.
 * Dùng để quyết định có render bằng `SafeHtml` hay fallback text mode.
 */
export function looksLikeHtml(input: string | null | undefined): boolean {
  if (!input) return false;
  // Đếm thẻ mở kiểu `<tag>`. Coi là HTML nếu có ít nhất 1 thẻ mở.
  return /<[a-z][\s\S]*>/i.test(input);
}

/**
 * Chuẩn hoá đầu vào cho AI/matching:
 *  - Bỏ toàn bộ thẻ HTML, chỉ giữ text
 *  - Decode entity (&amp; &nbsp; ...)
 *  - Rút gọn khoảng trắng
 *
 * Match an toàn với mọi input: undefined, null, plain text, hay HTML.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&zwnj;|&zwj;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'span',
];
const ALLOWED_ATTR = ['href', 'rel', 'target', 'class', 'style'];

/**
 * Render HTML an toàn từ string. Sanitize qua DOMPurify (chỉ chạy ở client).
 * Nếu `fallback` không phải HTML thì render như text.
 */
export function SafeHtml({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const [safe, setSafe] = useState('');

  useEffect(() => {
    if (!html || !looksLikeHtml(html)) {
      setSafe('');
      return;
    }
    // Lazy-load dompurify only on the client where window is available
    import('dompurify').then(({ default: DOMPurify }) => {
      setSafe(
        DOMPurify.sanitize(html, {
          ALLOWED_TAGS,
          ALLOWED_ATTR,
          ALLOW_DATA_ATTR: false,
        }),
      );
    });
  }, [html]);

  if (!safe) return null;
  return (
    <div
      className={clsx('jd-rich-text', className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
