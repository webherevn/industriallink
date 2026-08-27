'use client';

import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NumberedTitle } from '@/components/numbered-field-label';

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
  variant?: 'default' | 'hot' | 'company';
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
  const company = variant === 'company';

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl',
        company
          ? 'exp-company-card'
          : hot
            ? 'border border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]'
            : 'border border-slate-200 bg-slate-50/50',
        className,
      )}
    >
      <div
        className={clsx(
          'flex items-start gap-1',
          company
            ? 'bg-gradient-to-r from-[#3d5466]/[0.07] via-white to-[#f2b01f]/[0.12]'
            : hot
              ? 'bg-gradient-to-r from-amber-400/25 via-orange-300/20 to-amber-400/15'
              : 'bg-white/80',
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
          <span className="min-w-0 flex-1">
            <span
              className={clsx(
                'flex flex-wrap items-center gap-2 leading-snug',
                company
                  ? 'text-[15px] font-extrabold'
                  : hot
                    ? 'text-sm font-bold text-amber-950'
                    : 'text-sm font-bold text-slate-800',
              )}
            >
              {typeof title === 'string' ? (
                <span className={company ? 'exp-company-title' : undefined}>
                  <NumberedTitle
                    text={title}
                    mutedClassName={
                      hot
                        ? 'font-medium tabular-nums text-amber-800/45'
                        : undefined
                    }
                  />
                </span>
              ) : (
                title
              )}
              {hot ? (
                <span className="hot-badge-pulse inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
                  Hot
                </span>
              ) : null}
            </span>
            {subtitle ? (
              <span
                className={clsx(
                  'mt-0.5 block text-xs font-medium',
                  hot ? 'leading-snug text-amber-900/70' : 'truncate text-slate-500',
                )}
              >
                {subtitle}
              </span>
            ) : null}
            {extra}
          </span>
          <ChevronDown
            className={clsx(
              'h-4 w-4 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-180',
              company ? 'text-[#c98912]' : hot ? 'text-amber-800' : 'text-slate-400',
            )}
          />
        </button>
        {actions ? <div className="shrink-0 py-1.5 pr-2">{actions}</div> : null}
      </div>
      {isOpen ? (
        <div
          className={clsx(
            'space-y-4 border-t px-3.5 py-4 sm:px-4',
            company
              ? 'border-[#f2b01f]/25 bg-white'
              : hot
                ? 'border-amber-200 bg-white/90'
                : 'border-slate-100 bg-slate-50/40',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
