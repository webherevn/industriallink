'use client';

import { ChevronDown, List } from 'lucide-react';
import { useId, useState } from 'react';
import type { CmsTocItem } from '@/lib/cms-seo';

/** Mục lục tự động (kiểu Easy TOC) — numbered, thu gọn được, SEO-friendly. */
export function CmsTableOfContents({
  items,
  defaultOpen = true,
}: {
  items: CmsTocItem[];
  defaultOpen?: boolean;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);

  if (items.length < 2) return null;

  let major = 0;
  let minor = 0;
  const withNumbers = items.map((item) => {
    if (item.level === 2) {
      major += 1;
      minor = 0;
      return { ...item, num: String(major) };
    }
    minor += 1;
    return { ...item, num: `${major || 1}.${minor}` };
  });

  return (
    <nav
      aria-label="Mục lục bài viết"
      className="cms-toc overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-slate-100/80 sm:px-5"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--brand-navy)] text-white">
          <List className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </span>
        <span className="flex-1 text-sm font-bold text-[var(--brand-navy)]">Mục lục</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="border-t border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4"
      >
        <ol className="space-y-1">
          {withNumbers.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`group flex gap-2.5 rounded-md px-1.5 py-1.5 text-sm leading-snug transition hover:bg-accent-50 ${
                  item.level === 3 ? 'pl-5' : ''
                }`}
              >
                <span
                  className="mt-0.5 w-7 shrink-0 text-right text-[11px] font-bold tabular-nums text-accent-600"
                  aria-hidden
                >
                  {item.num}
                </span>
                <span className="font-medium text-slate-700 group-hover:text-[var(--brand-navy)]">
                  {item.text}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
