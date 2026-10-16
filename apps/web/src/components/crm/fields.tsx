'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { crmFieldClass } from '@/components/crm-frame';

type Option = { value: string; label: string };

export function CrmSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn',
  required = false,
  disabled = false,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenu({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <input className="sr-only" tabIndex={-1} value={value} required={required} onChange={() => undefined} />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        ref={buttonRef}
        className={`${crmFieldClass} flex items-center justify-between gap-2 text-left disabled:opacity-50 ${compact ? 'px-2 py-1.5 text-xs' : ''}`}
        onClick={toggle}
      >
        <span className={`min-w-0 truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          style={menu ? { top: menu.top, left: menu.left, width: menu.width } : undefined}
          className="fixed z-50 max-h-60 overflow-auto rounded-xl border border-[#e4e0f7] bg-white py-1 shadow-[0_16px_40px_rgba(76,62,201,0.14)]"
        >
          {options.length === 0 ? <li className="px-3 py-2 text-sm text-slate-400">Không có lựa chọn</li> : null}
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    active ? 'bg-[#efeaff] font-medium text-[#4c3ec9]' : 'text-slate-700 hover:bg-[#f6f4ff]'
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function CrmMonthField({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const parsed = parsePeriod(value);
  const parsedYear = parsed?.year;
  const [year, setYear] = useState(parsedYear ?? new Date().getFullYear());

  useEffect(() => {
    if (parsedYear) setYear(parsedYear);
  }, [parsedYear]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const maxPeriod = max ? parsePeriod(max) : null;

  function disabledMonth(month: number): boolean {
    if (!maxPeriod) return false;
    return year > maxPeriod.year || (year === maxPeriod.year && month > maxPeriod.month);
  }

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        ref={buttonRef}
        className={`${crmFieldClass} flex items-center justify-between gap-2 text-left`}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = buttonRef.current?.getBoundingClientRect();
          if (!rect) return;
          const width = 280;
          const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
          setMenu({ top: rect.bottom + 6, left });
          setOpen(true);
        }}
      >
        <span>{parsed ? `Tháng ${parsed.month}/${parsed.year}` : 'Chọn tháng'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          style={menu ? { top: menu.top, left: menu.left } : undefined}
          className="fixed z-50 w-[280px] rounded-2xl border border-[#e4e0f7] bg-white p-3 shadow-[0_16px_40px_rgba(76,62,201,0.14)]"
        >
          <div className="flex items-center justify-between">
            <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f6f4ff]" aria-label="Năm trước" onClick={() => setYear((current) => current - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-slate-800">{year}</p>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f6f4ff] disabled:opacity-30"
              aria-label="Năm sau"
              disabled={maxPeriod ? year >= maxPeriod.year : false}
              onClick={() => setYear((current) => current + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {MONTHS.map((month) => {
              const active = parsed?.year === year && parsed.month === month;
              const blocked = disabledMonth(month);
              return (
                <button
                  key={month}
                  type="button"
                  disabled={blocked}
                  className={`rounded-lg px-2 py-2 text-sm ${
                    active
                      ? 'bg-[#072348] font-semibold text-white'
                      : blocked
                        ? 'cursor-not-allowed text-slate-300'
                        : 'text-slate-700 hover:bg-[#efeaff]'
                  }`}
                  onClick={() => {
                    onChange(`${year}-${String(month).padStart(2, '0')}`);
                    setOpen(false);
                  }}
                >
                  Tháng {month}
                </button>
              );
            })}
          </div>
          {max ? (
            <button
              type="button"
              className="mt-2 w-full rounded-lg px-2 py-1.5 text-sm font-medium text-[#4c3ec9] hover:bg-[#f6f4ff]"
              onClick={() => {
                onChange(max);
                const next = parsePeriod(max);
                if (next) setYear(next.year);
                setOpen(false);
              }}
            >
              Tháng liền trước
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function parsePeriod(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}
