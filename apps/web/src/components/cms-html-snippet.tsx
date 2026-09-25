import type { ReactNode } from 'react';

type AttrMap = Record<string, string>;

function parseAttrs(raw: string): AttrMap {
  const attrs: AttrMap = {};
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const key = m[1].toLowerCase();
    if (key === '/' || key === '') continue;
    attrs[key] = m[2] ?? m[3] ?? m[4] ?? 'true';
  }
  return attrs;
}

function boolAttr(attrs: AttrMap, name: string): boolean | undefined {
  if (!(name in attrs)) return undefined;
  const v = attrs[name];
  if (v === 'false' || v === '0') return false;
  return true;
}

/**
 * Render HTML snippet (meta/link/script/style…) thành React nodes cho SSR.
 * GSC / crawler cần thẻ trong HTML gốc — không inject bằng useEffect.
 */
export function renderCmsHtmlSnippet(html: string | null | undefined): ReactNode[] {
  const raw = html?.trim();
  if (!raw) return [];

  const nodes: ReactNode[] = [];
  let key = 0;

  // <script ...>...</script> hoặc <script ... />
  const scriptRe =
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<script\b([^>]*)\s*\/>/gi;
  // <style>...</style>
  const styleRe = /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi;
  // <meta ...> <link ...> <noscript>...</noscript>
  const voidRe = /<(meta|link)\b([^>]*)\/?>/gi;
  const noscriptRe = /<noscript\b([^>]*)>([\s\S]*?)<\/noscript\s*>/gi;

  const consumed: Array<{ start: number; end: number }> = [];
  const mark = (start: number, end: number) => consumed.push({ start, end });

  let m: RegExpExecArray | null;

  scriptRe.lastIndex = 0;
  while ((m = scriptRe.exec(raw))) {
    mark(m.index, m.index + m[0].length);
    const attrStr = m[1] ?? m[3] ?? '';
    const body = m[2] ?? '';
    const attrs = parseAttrs(attrStr);
    const props: Record<string, unknown> = { key: `cms-script-${key++}` };
    if (attrs.src) props.src = attrs.src;
    if (attrs.type) props.type = attrs.type;
    if (attrs.id) props.id = attrs.id;
    if (attrs.async != null) props.async = boolAttr(attrs, 'async');
    if (attrs.defer != null) props.defer = boolAttr(attrs, 'defer');
    if (attrs.crossorigin) props.crossOrigin = attrs.crossorigin;
    if (attrs.referrerpolicy) props.referrerPolicy = attrs.referrerpolicy;
    if (attrs.nonce) props.nonce = attrs.nonce;
    if (attrs['data-noptimize']) props['data-noptimize'] = attrs['data-noptimize'];
    if (body.trim()) {
      nodes.push(
        <script {...props} dangerouslySetInnerHTML={{ __html: body }} />,
      );
    } else {
      nodes.push(<script {...props} />);
    }
  }

  styleRe.lastIndex = 0;
  while ((m = styleRe.exec(raw))) {
    mark(m.index, m.index + m[0].length);
    const attrs = parseAttrs(m[1] ?? '');
    nodes.push(
      <style
        key={`cms-style-${key++}`}
        id={attrs.id}
        dangerouslySetInnerHTML={{ __html: m[2] ?? '' }}
      />,
    );
  }

  voidRe.lastIndex = 0;
  while ((m = voidRe.exec(raw))) {
    mark(m.index, m.index + m[0].length);
    const tag = m[1].toLowerCase();
    const attrs = parseAttrs(m[2] ?? '');
    if (tag === 'meta') {
      const metaProps: Record<string, string> = {};
      if (attrs.name) metaProps.name = attrs.name;
      if (attrs.property) metaProps.property = attrs.property;
      if (attrs.content) metaProps.content = attrs.content;
      if (attrs.httpEquiv || attrs['http-equiv']) {
        metaProps.httpEquiv = attrs.httpEquiv || attrs['http-equiv'];
      }
      if (attrs.charset || attrs.charSet) metaProps.charSet = attrs.charset || attrs.charSet;
      if (Object.keys(metaProps).length === 0) continue;
      nodes.push(<meta key={`cms-meta-${key++}`} {...metaProps} />);
    } else if (tag === 'link') {
      nodes.push(
        <link
          key={`cms-link-${key++}`}
          rel={attrs.rel}
          href={attrs.href}
          as={attrs.as}
          type={attrs.type}
          crossOrigin={attrs.crossorigin as 'anonymous' | 'use-credentials' | undefined}
          media={attrs.media}
        />,
      );
    }
  }

  noscriptRe.lastIndex = 0;
  while ((m = noscriptRe.exec(raw))) {
    mark(m.index, m.index + m[0].length);
    nodes.push(
      <noscript
        key={`cms-noscript-${key++}`}
        dangerouslySetInnerHTML={{ __html: m[2] ?? '' }}
      />,
    );
  }

  // Phần HTML còn lại (comment, text…) — bỏ qua an toàn
  return nodes;
}
