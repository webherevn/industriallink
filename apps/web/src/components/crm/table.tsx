'use client';

import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Columns3, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export function useColumnSort<K extends string>(initial: K, initialDir: SortDir = 'asc') {
  const [key, setKey] = useState<K>(initial);
  const [dir, setDir] = useState<SortDir>(initialDir);
  function toggle(next: K) {
    if (next === key) setDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setKey(next);
      setDir('asc');
    }
  }
  return { key, dir, toggle };
}

export function sortRows<T>(rows: T[], dir: SortDir, pick: (row: T) => string | number | null | undefined): T[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = pick(left);
    const b = pick(right);
    const emptyA = a == null || a === '';
    const emptyB = b == null || b === '';
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
    return String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' }) * factor;
  });
}

export function SortableTh({
  label,
  active,
  dir,
  onClick,
  className = '',
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className={`whitespace-nowrap border-b border-slate-100 bg-slate-50 px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wider ${active ? 'text-[#4c3ec9]' : 'hover:text-slate-700'}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? '' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

export function filterChipClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-[#efeaff] text-[#4c3ec9]' : 'bg-white text-slate-600'}`;
}

export const crmTableClass = 'w-max min-w-full border-separate border-spacing-0 text-sm';
export const crmTd = 'whitespace-nowrap border-b border-slate-100 px-4 py-3 align-middle';
export const stickyCheck = 'sticky left-0 z-20 w-11 border-b border-slate-100 bg-slate-50 px-2 text-center align-middle';
export const stickyIndex = 'sticky left-11 z-20 w-14 border-b border-slate-100 bg-slate-50 text-center align-middle';

export function stickyCell(picked: boolean, edge: 'check' | 'index' | 'name'): string {
  const bg = picked ? 'bg-[#f6f4ff]' : 'bg-white';
  const line = `border-b border-slate-100 align-middle ${bg}`;
  if (edge === 'check') return `sticky left-0 z-10 w-11 px-2 text-center ${line}`;
  if (edge === 'index') return `sticky left-11 z-10 w-14 text-center text-xs tabular-nums text-slate-400 ${line}`;
  return `sticky left-[6.25rem] z-10 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)] ${line}`;
}

export function useRowSelection() {
  const [picked, setPicked] = useState<string[]>([]);
  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }
  function toggleVisible(ids: string[]) {
    setPicked((current) => {
      const allOn = ids.length > 0 && ids.every((id) => current.includes(id));
      if (allOn) return current.filter((id) => !ids.includes(id));
      return [...new Set([...current, ...ids])];
    });
  }
  function has(id: string) {
    return picked.includes(id);
  }
  return { picked, toggle, toggleVisible, has };
}

export function useVisibleColumns<K extends string>(storageKey: string, columns: readonly K[]) {
  const [hidden, setHidden] = useState<K[]>([]);
  const [ready, setReady] = useState(false);
  const columnKey = columns.join('\n');
  useEffect(() => {
    const known = columnKey.split('\n') as K[];
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) setHidden(parsed.filter((item): item is K => known.includes(item as K)));
    } catch {
      setHidden([]);
    }
    setReady(true);
  }, [storageKey, columnKey]);
  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(storageKey, JSON.stringify(hidden));
  }, [ready, hidden, storageKey]);
  function shown(key: K) {
    return !hidden.includes(key);
  }
  function toggle(key: K) {
    setHidden((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      return columns.some((item) => !next.includes(item)) ? next : current;
    });
  }
  function showAll() {
    setHidden([]);
  }
  return { shown, toggle, showAll };
}

export function RowCheck({
  checked,
  mixed = false,
  onChange,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: () => void;
  label: string;
}) {
  const on = checked || mixed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      onClick={onChange}
      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-[#4c3ec9] bg-[#4c3ec9] text-white' : 'border-slate-300 bg-white'}`}
    >
      {checked ? <Check className="h-3 w-3" /> : mixed ? <Minus className="h-3 w-3" /> : null}
    </button>
  );
}

export function ColumnPicker<K extends string>({
  columns,
  shown,
  onToggle,
  onShowAll,
  selectedCount,
}: {
  columns: ReadonlyArray<{ key: K; label: string }>;
  shown: (key: K) => boolean;
  onToggle: (key: K) => void;
  onShowAll: () => void;
  selectedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);
  return (
    <div className="relative z-30 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">{selectedCount > 0 ? `Đã chọn ${selectedCount}` : 'Chọn dòng ở cột đầu'}</p>
      <div ref={rootRef} className="relative">
        <button type="button" className={filterChipClass(open)} onClick={() => setOpen((current) => !current)}>
          <span className="inline-flex items-center gap-1.5"><Columns3 className="h-3.5 w-3.5" />Cột hiển thị</span>
        </button>
        {open ? (
          <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-[#e4e0f7] bg-white p-2 shadow-[0_16px_40px_rgba(76,62,201,0.14)]">
            {columns.map((column) => (
              <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-[#f6f4ff]">
                <input type="checkbox" className="accent-[#4c3ec9]" checked={shown(column.key)} onChange={() => onToggle(column.key)} />
                {column.label}
              </label>
            ))}
            <button type="button" className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-[#4c3ec9] hover:bg-[#f6f4ff]" onClick={onShowAll}>
              Hiện tất cả
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
