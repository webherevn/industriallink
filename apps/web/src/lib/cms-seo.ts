import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

/** Bỏ HTML khỏi meta description / OG. */
export function stripHtml(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Format title SEO: [Nội dung] - [Brand] */
export function formatCmsSeoTitle(contentTitle: string, brand = BRAND_NAME): string {
  const t = contentTitle.trim();
  if (!t) return brand;
  if (t.toLowerCase().includes(brand.toLowerCase())) return t;
  return `${t} - ${brand}`;
}

export function cmsRobotsMeta(input: {
  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsMaxImagePreview?: boolean;
}): Metadata['robots'] {
  return {
    index: input.robotsIndex,
    follow: input.robotsFollow,
    'max-image-preview': input.robotsMaxImagePreview === false ? 'standard' : 'large',
  } as Metadata['robots'];
}

export type CmsBreadcrumbItem = {
  name: string;
  href?: string; // thiếu = cấp hiện tại (không link)
};

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export type CmsTocItem = { id: string; text: string; level: 2 | 3 };

function slugifyHeading(text: string, used: Map<string, number>): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'muc';
  const n = (used.get(base) ?? 0) + 1;
  used.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

/**
 * - Gắn id cho H2/H3 (TOC)
 * - Ảnh: lazy (trừ ảnh đầu), giữ/điền alt, width/height nếu thiếu
 * - External link: rel="noopener noreferrer nofollow"
 */
export function prepareCmsBodyHtml(
  html: string,
  opts: { siteOrigin: string; firstImageEager?: boolean } = { siteOrigin: '' },
): { html: string; toc: CmsTocItem[] } {
  if (!html) return { html: '', toc: [] };
  const used = new Map<string, number>();
  const toc: CmsTocItem[] = [];
  let imgIndex = 0;

  let out = html.replace(/<h([23])(\b[^>]*)>([\s\S]*?)<\/h\1>/gi, (_m, levelStr, attrs, inner) => {
    const level = Number(levelStr) as 2 | 3;
    const text = stripHtml(inner);
    const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs || '');
    const id = idMatch?.[1] || slugifyHeading(text, used);
    const attrsClean = (attrs || '').replace(/\bid\s*=\s*["'][^"']*["']/i, '');
    toc.push({ id, text, level });
    return `<h${level}${attrsClean} id="${id}">${inner}</h${level}>`;
  });

  out = out.replace(/<img\b([^>]*)>/gi, (_m, attrs: string) => {
    imgIndex += 1;
    let a = attrs;
    if (!/\balt\s*=/i.test(a)) {
      a += ' alt=""';
    }
    const eager = opts.firstImageEager && imgIndex === 1;
    if (!/\bloading\s*=/i.test(a)) {
      a += eager ? ' loading="eager"' : ' loading="lazy"';
    }
    if (!/\bdecoding\s*=/i.test(a)) {
      a += ' decoding="async"';
    }
    // Chống CLS: nếu thiếu width/height, đặt tỷ lệ tối thiểu qua style (không bịa số)
    if (!/\bwidth\s*=/i.test(a) && !/\bheight\s*=/i.test(a) && !/\bstyle\s*=/i.test(a)) {
      a += ' style="max-width:100%;height:auto"';
    } else if (!/\bheight\s*=/i.test(a) && !/\bstyle\s*=/i.test(a)) {
      a += ' style="height:auto"';
    }
    return `<img${a}>`;
  });

  const origin = opts.siteOrigin.replace(/\/$/, '');
  out = out.replace(/<a\b([^>]*)>/gi, (_m, attrs: string) => {
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const href = hrefMatch?.[1] || '';
    const isExternal =
      /^https?:\/\//i.test(href) && origin && !href.startsWith(origin) && !href.startsWith('/');
    if (!isExternal) return `<a${attrs}>`;
    let a = attrs;
    if (!/\brel\s*=/i.test(a)) {
      a += ' rel="noopener noreferrer nofollow"';
    } else if (!/nofollow/i.test(a)) {
      a = a.replace(/\brel\s*=\s*["']([^"']*)["']/i, (_r, rel: string) => {
        const parts = new Set(`${rel} noopener noreferrer nofollow`.split(/\s+/).filter(Boolean));
        return `rel="${[...parts].join(' ')}"`;
      });
    }
    if (!/\btarget\s*=/i.test(a)) a += ' target="_blank"';
    return `<a${a}>`;
  });

  return { html: out, toc };
}
