'use client';

import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { crmFieldClass } from '@/components/crm-frame';
import { vietnamDay } from '@/components/crm/format';

function menuBox(button: HTMLButtonElement, width = button.getBoundingClientRect().width) {
  const rect = button.getBoundingClientRect();
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  return { top: rect.bottom + 6, left, width };
}

type Option = { value: string; label: string };

export function CrmField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </div>
  );
}

export function CrmFormSection({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="md:col-span-2 mt-1 flex items-center gap-2 border-t border-[#efeaff] pt-4 text-xs font-semibold uppercase tracking-wide text-[#4c3ec9] first:mt-0 first:border-0 first:pt-0">
      <span className="text-[#7a6af2]">{icon}</span>
      {children}
    </p>
  );
}

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
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  function place() {
    if (!buttonRef.current) return;
    setMenu(menuBox(buttonRef.current));
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onMove() {
      place();
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
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
      {open && menu
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              style={{ top: menu.top, left: menu.left, width: menu.width }}
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
                      onMouseDown={(event) => event.preventDefault()}
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
            </ul>,
            document.body,
          )
        : null}
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
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const parsed = parsePeriod(value);
  const parsedYear = parsed?.year;
  const [year, setYear] = useState(parsedYear ?? new Date().getFullYear());

  useEffect(() => {
    if (parsedYear) setYear(parsedYear);
  }, [parsedYear]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onMove() {
      if (!buttonRef.current) return;
      setMenu(menuBox(buttonRef.current, 280));
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
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
          if (!buttonRef.current) return;
          setMenu(menuBox(buttonRef.current, 280));
          setOpen(true);
        }}
      >
        <span>{parsed ? `Tháng ${parsed.month}/${parsed.year}` : 'Chọn tháng'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && menu
        ? createPortal(
        <div
          ref={menuRef}
          style={{ top: menu.top, left: menu.left, width: menu.width }}
          className="fixed z-50 rounded-2xl border border-[#e4e0f7] bg-white p-3 shadow-[0_16px_40px_rgba(76,62,201,0.14)]"
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
        </div>,
            document.body,
          )
        : null}
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

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function CrmDateField({
  value,
  onChange,
  placeholder = 'Chọn ngày',
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const parsed = parseDay(value);
  const today = vietnamDay(new Date().toISOString());
  const todayParts = parseDay(today);
  const [cursor, setCursor] = useState(() => parsed ?? todayParts ?? { year: 2026, month: 1, date: 1 });

  useEffect(() => {
    const next = parseDay(value);
    if (next) setCursor(next);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onMove() {
      if (!buttonRef.current) return;
      setMenu(menuBox(buttonRef.current, 304));
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  function shift(delta: number) {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, date: 1 };
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <input className="sr-only" tabIndex={-1} value={value} required={required} onChange={() => undefined} />
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
          if (!buttonRef.current) return;
          setMenu(menuBox(buttonRef.current, 304));
          setOpen(true);
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-[#7a6af2]" />
          <span className={parsed ? 'text-slate-800' : 'text-slate-400'}>{parsed ? formatDay(value) : placeholder}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && menu
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: menu.top, left: menu.left, width: menu.width }}
              className="fixed z-50 rounded-2xl border border-[#e4e0f7] bg-white p-3 shadow-[0_16px_40px_rgba(76,62,201,0.14)]"
            >
              <div className="flex items-center justify-between">
                <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f6f4ff]" aria-label="Tháng trước" onClick={() => shift(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold text-slate-800">Tháng {cursor.month}/{cursor.year}</p>
                <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f6f4ff]" aria-label="Tháng sau" onClick={() => shift(1)}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <button type="button" className="rounded-lg px-2 py-1 text-xs font-medium text-[#4c3ec9] hover:bg-[#f6f4ff]" aria-label="Năm trước" onClick={() => shift(-12)}>
                  Năm trước
                </button>
                <button type="button" className="rounded-lg px-2 py-1 text-xs font-medium text-[#4c3ec9] hover:bg-[#f6f4ff]" aria-label="Năm sau" onClick={() => shift(12)}>
                  Năm sau
                </button>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {monthCells(cursor.year, cursor.month).map((cell) =>
                  cell.day ? (
                    <button
                      key={cell.key}
                      type="button"
                      className={`rounded-lg py-1.5 text-sm ${
                        cell.day === value
                          ? 'bg-[#072348] font-semibold text-white'
                          : cell.day === today
                            ? 'font-semibold text-[#4c3ec9] ring-1 ring-[#ddd6fe] hover:bg-[#efeaff]'
                            : 'text-slate-700 hover:bg-[#efeaff]'
                      }`}
                      onClick={() => {
                        onChange(cell.day!);
                        setOpen(false);
                      }}
                    >
                      {Number(cell.day.slice(8))}
                    </button>
                  ) : (
                    <span key={cell.key} />
                  ),
                )}
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  className="flex-1 rounded-lg px-2 py-1.5 text-sm font-medium text-[#4c3ec9] hover:bg-[#f6f4ff]"
                  onClick={() => {
                    onChange(today);
                    if (todayParts) setCursor(todayParts);
                    setOpen(false);
                  }}
                >
                  Hôm nay
                </button>
                {value && !required ? (
                  <button
                    type="button"
                    className="flex-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                    }}
                  >
                    Xóa ngày
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function parseDay(value: string): { year: number; month: number; date: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || date < 1 || date > count) return null;
  return { year, month, date };
}

function formatDay(value: string): string {
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}/${month}/${year}` : value;
}

function monthCells(year: number, month: number): Array<{ key: string; day: string | null }> {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<{ key: string; day: string | null }> = [];
  for (let index = 0; index < lead; index += 1) cells.push({ key: `blank-${index}`, day: null });
  for (let date = 1; date <= count; date += 1) {
    const day = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    cells.push({ key: day, day });
  }
  return cells;
}
