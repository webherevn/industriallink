import { apiPublicBase } from './public-paths';
import { getApiBase } from './api';

/**
 * Chuẩn hoá URL ảnh CMS: path tương đối `/api/v1/cms/media/...` → absolute theo môi trường.
 */
export function resolveCmsAssetUrl(url?: string | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) {
    return raw;
  }
  if (raw.startsWith('/api/v1/')) {
    const origin =
      typeof window !== 'undefined'
        ? getApiBase().replace(/\/api\/v1\/?$/, '')
        : apiPublicBase().replace(/\/api\/v1\/?$/, '');
    // Local: Next rewrite /api → API; production: same-origin nginx.
    // Absolute chỉ cần khi origin khác site (SSR metadata / OG).
    if (typeof window === 'undefined') {
      return `${origin}${raw}`;
    }
    // Browser: giữ path tương đối nếu cùng origin proxy; absolute nếu API khác host.
    try {
      const apiHost = new URL(getApiBase()).origin;
      if (apiHost === window.location.origin) return raw;
      return `${origin}${raw}`;
    } catch {
      return raw;
    }
  }
  if (raw.startsWith('/')) {
    const base = typeof window !== 'undefined' ? getApiBase() : apiPublicBase();
    return `${base}${raw}`;
  }
  return raw;
}

/** Rewrite src ảnh `/api/v1/...` trong HTML sang URL dùng được khi render. */
export function absolutizeCmsHtml(html: string): string {
  return html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])(\/api\/v1\/[^"']+)\2/gi,
    (_m, prefix: string, quote: string, path: string) => {
      const abs = resolveCmsAssetUrl(path) || path;
      return `${prefix}${quote}${abs}${quote}`;
    },
  );
}
