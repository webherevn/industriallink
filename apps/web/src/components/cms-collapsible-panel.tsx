'use client';

import clsx from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Panel admin: tap tiêu đề để thu gọn / mở rộng. */
export function CmsCollapsiblePanel({
  title,
  defaultOpen = true,
  tone = 'plain',
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  /** dash: navy/cam, dùng khi nâng UI từng mục. plain giữ giao diện cũ. */
  tone?: 'plain' | 'dash';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dash = tone === 'dash';
  return (
    <div
      className={clsx(
        'overflow-hidden',
        dash ? 'rounded-2xl border border-slate-100 bg-[#f8fafc]' : 'rounded-xl border border-slate-200 bg-white',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex w-full items-center gap-2 px-4 py-3 text-left transition',
          dash ? 'hover:bg-white' : 'gap-1.5 bg-slate-50/80 hover:bg-slate-100/80',
        )}
        aria-expanded={open}
      >
        {dash ? (
          <ChevronDown
            className={clsx(
              'h-4 w-4 shrink-0 text-[#E8872A] transition-transform duration-300',
              !open && '-rotate-90',
            )}
          />
        ) : open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className={clsx('font-semibold', dash ? 'text-sm text-[#072348]' : 'text-[13px] text-slate-800')}>
          {title}
        </span>
      </button>
      {open ? (
        <div
          className={clsx(
            'space-y-3 border-t border-slate-100 p-4',
            dash && 'bg-white',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
