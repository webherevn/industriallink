'use client';

import clsx from 'clsx';
import { ChevronDown, Layers } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NumberedTitle } from '@/components/numbered-field-label';

/** Khối A/B/C/D — cùng họ màu với nhóm khuyến khích, nhẹ hơn; bấm tiêu đề để mở/gộp. */
export function MatrixSection({
  title,
  subtitle,
  extra,
  children,
  className,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-orange-50/20 to-white',
        className,
      )}
    >
      <div className="flex items-start gap-1 bg-gradient-to-r from-amber-200/25 via-orange-100/20 to-amber-100/10">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2.5 px-3.5 py-2.5 text-left sm:px-4"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-sm">
            <Layers className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <h2 className="text-sm font-bold leading-snug text-amber-950">
              <NumberedTitle
                text={title}
                mutedClassName="font-medium tabular-nums text-amber-800/45"
              />
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs font-medium text-amber-900/55">{subtitle}</p>
            ) : null}
          </span>
          <ChevronDown
            className={clsx(
              'mt-1 h-4 w-4 shrink-0 text-amber-800/70 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
        {extra ? <div className="shrink-0 py-2 pr-3 sm:pr-4">{extra}</div> : null}
      </div>
      {open ? (
        <div className="space-y-4 border-t border-amber-100/80 bg-white/75 px-3.5 py-4 sm:px-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
