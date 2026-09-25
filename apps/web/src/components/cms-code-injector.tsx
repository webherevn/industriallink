'use client';

import { useEffect, useRef } from 'react';

/**
 * Chèn HTML/JS tùy ý (GA, GTM…) vào head hoặc cuối body.
 * Tạo lại thẻ <script> để trình duyệt thực thi (innerHTML thuần không chạy script).
 */
export function CmsCodeInjector({
  html,
  target,
}: {
  html: string | null | undefined;
  target: 'head' | 'body';
}) {
  const ran = useRef(false);

  useEffect(() => {
    const raw = html?.trim();
    if (!raw || ran.current) return;
    if (typeof window === 'undefined') return;

    // Không inject trên khu vực admin / recruiter app path
    const path = window.location.pathname;
    if (path.startsWith('/admin') || path.startsWith('/recruiter')) return;

    ran.current = true;
    const host = target === 'head' ? document.head : document.body;
    const wrap = document.createElement('div');
    wrap.innerHTML = raw;

    const nodes = Array.from(wrap.childNodes);
    for (const node of nodes) {
      if (node.nodeName.toLowerCase() === 'script') {
        const srcEl = node as HTMLScriptElement;
        const script = document.createElement('script');
        for (const attr of Array.from(srcEl.attributes)) {
          script.setAttribute(attr.name, attr.value);
        }
        if (srcEl.textContent) script.text = srcEl.textContent;
        host.appendChild(script);
      } else {
        host.appendChild(node.cloneNode(true));
      }
    }
  }, [html, target]);

  return null;
}
