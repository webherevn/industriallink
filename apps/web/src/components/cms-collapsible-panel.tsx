'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Panel admin: tap tiêu đề để thu gọn / mở rộng. */
export function CmsCollapsiblePanel({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100/80"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="text-[13px] font-semibold text-slate-800">{title}</span>
      </button>
      {open ? <div className="space-y-3 border-t border-slate-100 p-4">{children}</div> : null}
    </div>
  );
}
