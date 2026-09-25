'use client';

import { useEffect, useRef, useState } from 'react';

/** Mô tả HTML công khai — rút gọn / xem thêm khi dài. */
export function CmsExpandableHtml({
  html,
  collapsedMaxHeight = 140,
}: {
  html: string;
  collapsedMaxHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setNeedsToggle(el.scrollHeight > collapsedMaxHeight + 8);
  }, [html, collapsedMaxHeight]);

  if (!html?.trim()) return null;

  return (
    <div className="relative">
      <div
        ref={ref}
        className="cms-prose max-w-none overflow-hidden transition-[max-height] duration-300"
        style={{ maxHeight: expanded || !needsToggle ? undefined : collapsedMaxHeight }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {needsToggle && !expanded ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
      ) : null}
      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="relative z-[1] mt-2 text-sm font-semibold text-brand-600 transition hover:text-accent-600"
        >
          {expanded ? 'Rút gọn' : 'Xem thêm'}
        </button>
      ) : null}
    </div>
  );
}
