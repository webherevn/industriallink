'use client';

import clsx from 'clsx';
import { ChevronDown, Flame } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export function CollapsibleFormSection({
  title,
  subtitle,
  extra,
  actions,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  variant = 'default',
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'default' | 'hot';
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const isOpen = isControlled ? openProp : internal;

  function toggle() {
    const next = !isOpen;
    if (!isControlled) setInternal(next);
    onOpenChange?.(next);
  }

  const hot = variant === 'hot';

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border',
        hot
          ? 'border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]'
          : 'border-slate-200 bg-slate-50/50',
        className,
      )}
    >
      <div
        className={clsx(
          'flex items-start gap-1',
          hot ? 'bg-gradient-to-r from-amber-400/25 via-orange-300/20 to-amber-400/15' : 'bg-white/80',
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className={clsx(
            'flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-3 text-left sm:px-4',
            hot ? 'text-amber-950' : 'text-slate-800',
          )}
        >
          {hot ? (
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md ring-2 ring-amber-200">
              <Flame className="h-5 w-5" fill="currentColor" />
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span
              className={clsx(
                'flex flex-wrap items-center gap-2 text-sm font-bold leading-snug',
                hot ? 'text-amber-950' : 'text-slate-800',
              )}
            >
              {title}
              {hot ? (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
                  Hot
                </span>
              ) : null}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                {subtitle}
              </span>
            ) : null}
            {extra}
          </span>
          <ChevronDown
            className={clsx(
              'h-4 w-4 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-180',
              hot ? 'text-amber-800' : 'text-slate-400',
            )}
          />
        </button>
        {actions ? <div className="shrink-0 py-1.5 pr-2">{actions}</div> : null}
      </div>
      {isOpen ? (
        <div
          className={clsx(
            'space-y-4 border-t px-3.5 py-4 sm:px-4',
            hot ? 'border-amber-200 bg-white/90' : 'border-slate-100 bg-slate-50/40',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
