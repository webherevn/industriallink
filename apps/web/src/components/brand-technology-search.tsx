'use client';

import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { suggestFdiB2bBrands } from '@industriallink/contracts';

export function BrandTechnologySearch({
  selected,
  onChange,
  max = 24,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected],
  );

  const suggestions = useMemo(() => {
    return suggestFdiB2bBrands(query, 14).filter(
      (i) => !selectedSet.has(i.name.toLowerCase()),
    );
  }, [query, selectedSet]);

  const exactInCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return suggestions.some((s) => s.name.toLowerCase() === q);
  }, [query, suggestions]);

  const canAddCustom =
    Boolean(query.trim()) &&
    !selectedSet.has(query.trim().toLowerCase()) &&
    !exactInCatalog;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedSet.has(trimmed.toLowerCase())) {
      setQuery('');
      setOpen(false);
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, trimmed]);
    setQuery('');
    setOpen(false);
  }

  function remove(name: string) {
    onChange(selected.filter((s) => s !== name));
  }

  return (
    <div ref={rootRef} className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                className="rounded-full p-0.5 text-brand-600 hover:bg-brand-100"
                aria-label={`Xoá ${name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions[0]) add(suggestions[0].name);
              else if (canAddCustom) add(query);
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Tìm hãng FDI/B2B (Samsung, Siemens, Bosch…)"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-brand-500/30 focus:ring-2"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
        />

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
          >
            {suggestions.length === 0 && !canAddCustom && (
              <li className="px-3 py-2 text-xs text-slate-500">
                Gõ tên hãng để tìm trong danh mục FDI/B2B Việt Nam
              </li>
            )}
            {suggestions.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
                  onClick={() => add(item.name)}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                    {item.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">
                      {item.name}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {[item.country, ...(item.sectors ?? []).slice(0, 2)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {item.priority === 1 && (
                    <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">
                      Ưu tiên
                    </span>
                  )}
                </button>
              </li>
            ))}
            {canAddCustom && (
              <li className="border-t border-slate-100">
                <button
                  type="button"
                  className={clsx(
                    'w-full px-3 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50',
                  )}
                  onClick={() => add(query)}
                >
                  + Thêm “{query.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        Gợi ý từ danh mục FDI/B2B tại Việt Nam. Không có trong danh sách — bấm “+ Thêm” để nhập tay.
      </p>
    </div>
  );
}
