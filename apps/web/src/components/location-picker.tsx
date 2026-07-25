'use client';

import {
  filterUnits,
  formatLocationLabel,
  listChildren,
  listProvinces,
  searchNormalize,
  serializeLocationLabels,
  type AdminMode,
  type AdminUnit,
  type LocationPickerMode,
  type LocationSelectionItem,
} from '@industriallink/vn-admin';
import { LOCATIONS } from '@industriallink/contracts';
import clsx from 'clsx';
import { ChevronRight, MapPin, Search, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Nhóm phụ KCN / địa điểm seed cũ — giữ tương thích filter tin đã đăng.
 * (KCN + vài tỉnh phổ biến trong LOCATIONS.)
 */
export const KCN_LOCATIONS = [...LOCATIONS];

const MODE_TABS: {
  id: LocationPickerMode;
  label: string;
  badge?: string;
}[] = [
  { id: 'old', label: 'Tỉnh, Quận/huyện cũ' },
  { id: 'new', label: 'Tỉnh, Phường/xã', badge: 'Mới' },
  { id: 'kcn', label: 'KCN / phổ biến' },
];

function itemKey(item: LocationSelectionItem): string {
  return formatLocationLabel(item);
}

function isAdminMode(mode: LocationPickerMode): mode is AdminMode {
  return mode === 'old' || mode === 'new';
}

function childColumnTitle(mode: LocationPickerMode): string {
  if (mode === 'old') return 'Quận/huyện';
  if (mode === 'new') return 'Phường/xã';
  return 'Địa điểm';
}

/** Hà Nội → TP.HCM → Đà Nẵng lên đầu danh sách. */
const PROVINCE_PRIORITY = ['ha noi', 'ho chi minh', 'da nang'] as const;

function provinceSortRank(name: string): number {
  const n = searchNormalize(name);
  const idx = PROVINCE_PRIORITY.findIndex((p) => n.includes(p));
  return idx === -1 ? PROVINCE_PRIORITY.length : idx;
}

function sortProvincesPopular(units: AdminUnit[]): AdminUnit[] {
  return [...units].sort((a, b) => {
    const ra = provinceSortRank(a.name);
    const rb = provinceSortRank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, 'vi');
  });
}

/** Hiển thị thân thiện; giá trị lưu vẫn dùng tên chuẩn trong data. */
function formatProvinceDisplay(name: string): string {
  if (searchNormalize(name).includes('ho chi minh')) return 'TP. Hồ Chí Minh';
  return name;
}

export interface LocationPickerProps {
  value: string[];
  onChange: (labels: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** false = chỉ giữ 1 địa điểm khi Apply. */
  multiple?: boolean;
  className?: string;
  /** `bar` = thanh tìm việc; `field` = form. */
  variant?: 'bar' | 'field';
  /** Mode mặc định khi mở lần đầu. */
  defaultMode?: LocationPickerMode;
}

export function LocationPicker({
  value,
  onChange,
  placeholder = 'Tất cả địa điểm',
  disabled = false,
  multiple = true,
  className,
  variant = 'field',
  defaultMode = 'new',
}: LocationPickerProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LocationPickerMode>(defaultMode);
  const [draft, setDraft] = useState<LocationSelectionItem[]>([]);
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
  const [provinceQuery, setProvinceQuery] = useState('');
  const [childQuery, setChildQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncDraftFromValue = useCallback(() => {
    setDraft(
      value.map((label) => {
        const sep = ' · ';
        const idx = label.indexOf(sep);
        if (idx === -1) return { province: label };
        return {
          province: label.slice(0, idx).trim(),
          child: label.slice(idx + sep.length).trim() || undefined,
        };
      }),
    );
  }, [value]);

  useEffect(() => {
    if (!open) return;
    syncDraftFromValue();
    setProvinceQuery('');
    setChildQuery('');
  }, [open, syncDraftFromValue]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const width = Math.min(36 * 16, window.innerWidth - 16);
    let left = rect.right - width;
    if (variant === 'field') left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = rect.bottom + gap;
    const maxHeight = Math.max(240, window.innerHeight - top - 12);
    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight,
      zIndex: 1000,
    });
  }, [variant]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener('resize', onScrollOrResize);
    // capture: đóng/đặt lại khi scroll bất kỳ container nào
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Tránh đóng ngay trong cùng nhịp click mở
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc);
    }, 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const provinces = useMemo(() => {
    if (!isAdminMode(mode)) return [] as AdminUnit[];
    return sortProvincesPopular(filterUnits(listProvinces(mode), provinceQuery));
  }, [mode, provinceQuery]);

  useEffect(() => {
    if (!isAdminMode(mode)) {
      setActiveProvinceId(null);
      return;
    }
    if (activeProvinceId && provinces.some((p) => p.id === activeProvinceId)) return;
    setActiveProvinceId(provinces[0]?.id ?? null);
  }, [mode, provinces, activeProvinceId]);

  const activeProvince = useMemo(() => {
    if (!isAdminMode(mode) || !activeProvinceId) return null;
    return listProvinces(mode).find((p) => p.id === activeProvinceId) ?? null;
  }, [mode, activeProvinceId]);

  const allChildrenOfActive = useMemo(() => {
    if (!isAdminMode(mode) || !activeProvinceId) return [] as AdminUnit[];
    return listChildren(mode, activeProvinceId);
  }, [mode, activeProvinceId]);

  const children = useMemo(
    () => filterUnits(allChildrenOfActive, childQuery),
    [allChildrenOfActive, childQuery],
  );

  const draftKeys = useMemo(() => new Set(draft.map(itemKey)), [draft]);

  const triggerLabel = useMemo(() => {
    if (!value.length) return placeholder;
    if (value.length === 1) return value[0];
    return `${value[0]} +${value.length - 1}`;
  }, [value, placeholder]);

  /** Chọn cả tỉnh (compact) — UI vẫn tick hết cấp 2. */
  const isProvinceWide = useCallback(
    (provinceName: string) => draft.some((x) => x.province === provinceName && !x.child),
    [draft],
  );

  const selectedChildCount = useCallback(
    (provinceName: string) =>
      draft.filter((x) => x.province === provinceName && Boolean(x.child)).length,
    [draft],
  );

  const isAllChildrenSelected = useCallback(
    (provinceName: string, childUnits: AdminUnit[]) => {
      if (!childUnits.length) return isProvinceWide(provinceName);
      if (isProvinceWide(provinceName)) return true;
      const selected = new Set(
        draft.filter((x) => x.province === provinceName && x.child).map((x) => x.child!),
      );
      return childUnits.every((c) => selected.has(c.name));
    },
    [draft, isProvinceWide],
  );

  const isChildChecked = (provinceName: string, childName: string) =>
    isProvinceWide(provinceName) || draftKeys.has(itemKey({ province: provinceName, child: childName }));

  const toggleProvinceAll = (provinceName: string, childUnits: AdminUnit[]) => {
    setDraft((prev) => {
      const without = prev.filter((x) => x.province !== provinceName);
      const wide = prev.some((x) => x.province === provinceName && !x.child);
      const allPicked =
        wide ||
        (childUnits.length > 0 &&
          childUnits.every((c) =>
            prev.some((x) => x.province === provinceName && x.child === c.name),
          ));
      if (allPicked) return without;
      if (!multiple) return [{ province: provinceName }];
      // Lưu compact "cả tỉnh"; UI tick hết cấp 2
      return [...without, { province: provinceName }];
    });
  };

  const toggleChild = (provinceName: string, childName: string, childUnits: AdminUnit[]) => {
    setDraft((prev) => {
      const wide = prev.some((x) => x.province === provinceName && !x.child);
      if (wide) {
        // Đang chọn cả tỉnh → bỏ 1 đơn vị = chọn hết trừ đơn vị đó
        const rest = childUnits
          .filter((c) => c.name !== childName)
          .map((c) => ({ province: provinceName, child: c.name }));
        const others = prev.filter((x) => x.province !== provinceName);
        if (!multiple) return rest[0] ? [rest[0]] : [];
        return [...others, ...rest];
      }

      const key = itemKey({ province: provinceName, child: childName });
      const exists = prev.some((x) => itemKey(x) === key);
      let next = exists
        ? prev.filter((x) => itemKey(x) !== key)
        : multiple
          ? [...prev, { province: provinceName, child: childName }]
          : [{ province: provinceName, child: childName }];

      // Đủ hết cấp 2 → gộp thành "cả tỉnh"
      if (
        multiple &&
        childUnits.length > 0 &&
        childUnits.every((c) =>
          next.some((x) => x.province === provinceName && x.child === c.name),
        )
      ) {
        next = [
          ...next.filter((x) => x.province !== provinceName),
          { province: provinceName },
        ];
      }
      return next;
    });
  };

  const toggleKcn = (name: string) => {
    setDraft((prev) => {
      const exists = prev.some((x) => itemKey(x) === name);
      if (exists) return prev.filter((x) => itemKey(x) !== name);
      if (!multiple) return [{ province: name }];
      return [...prev, { province: name }];
    });
  };

  const provinceAllSelected = (provinceName: string, childUnits: AdminUnit[]) =>
    isAllChildrenSelected(provinceName, childUnits);

  const provincePartialSelected = (provinceName: string, childUnits: AdminUnit[]) => {
    if (isAllChildrenSelected(provinceName, childUnits)) return false;
    return selectedChildCount(provinceName) > 0 || isProvinceWide(provinceName);
  };

  const apply = () => {
    onChange(serializeLocationLabels(draft));
    setOpen(false);
  };

  const clearDraft = () => setDraft([]);

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Chọn địa điểm"
            style={panelStyle}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15"
          >
            <div className="flex shrink-0 flex-wrap gap-1 border-b border-slate-100 p-2">
              {MODE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setChildQuery('');
                    setProvinceQuery('');
                  }}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                    mode === tab.id
                      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                      : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="rounded bg-emerald-500 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-white">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {mode === 'kcn' ? (
                <KcnColumn
                  selected={draftKeys}
                  onToggle={toggleKcn}
                  query={provinceQuery}
                  onQueryChange={setProvinceQuery}
                />
              ) : (
                <div className="grid h-full max-h-[min(22rem,calc(100vh-12rem))] grid-cols-1 sm:grid-cols-2">
                  <Column
                    title="Tỉnh/Thành phố"
                    query={provinceQuery}
                    onQueryChange={setProvinceQuery}
                    searchPlaceholder="Tìm tỉnh..."
                  >
                    {provinces.map((p) => {
                      const pChildren = isAdminMode(mode)
                        ? listChildren(mode, p.id)
                        : [];
                      const all = provinceAllSelected(p.name, pChildren);
                      const partial = provincePartialSelected(p.name, pChildren);
                      const active = p.id === activeProvinceId;
                      return (
                        <div
                          key={p.id}
                          className={clsx(
                            'flex w-full items-center gap-2 px-3 py-2 text-sm transition',
                            active ? 'bg-brand-50/80' : 'hover:bg-slate-50',
                          )}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${formatProvinceDisplay(p.name)}`}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            checked={all}
                            ref={(el) => {
                              if (el) el.indeterminate = !all && partial;
                            }}
                            onChange={() => toggleProvinceAll(p.name, pChildren)}
                          />
                          <button
                            type="button"
                            onClick={() => setActiveProvinceId(p.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="min-w-0 flex-1 truncate text-slate-800">
                              {formatProvinceDisplay(p.name)}
                            </span>
                            <ChevronRight
                              className={clsx(
                                'h-4 w-4 shrink-0',
                                active ? 'text-brand-500' : 'text-slate-300',
                              )}
                            />
                          </button>
                        </div>
                      );
                    })}
                    {!provinces.length && (
                      <p className="px-3 py-6 text-center text-xs text-slate-400">
                        Không tìm thấy tỉnh
                      </p>
                    )}
                  </Column>

                  <Column
                    title={
                      activeProvince
                        ? `${childColumnTitle(mode)} · ${formatProvinceDisplay(activeProvince.name)}`
                        : childColumnTitle(mode)
                    }
                    query={childQuery}
                    onQueryChange={setChildQuery}
                    searchPlaceholder={`Tìm ${childColumnTitle(mode).toLowerCase()}...`}
                    borderLeft
                  >
                    {activeProvince && (
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          checked={provinceAllSelected(
                            activeProvince.name,
                            allChildrenOfActive,
                          )}
                          onChange={() =>
                            toggleProvinceAll(activeProvince.name, allChildrenOfActive)
                          }
                        />
                        <span className="font-medium text-slate-800">Tất cả</span>
                      </label>
                    )}
                    {children.map((c) => {
                      const checked = isChildChecked(activeProvince!.name, c.name);
                      return (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            checked={checked}
                            onChange={() =>
                              toggleChild(
                                activeProvince!.name,
                                c.name,
                                allChildrenOfActive,
                              )
                            }
                          />
                          <span className="truncate text-slate-700">{c.name}</span>
                        </label>
                      );
                    })}
                    {activeProvince && !children.length && (
                      <p className="px-3 py-6 text-center text-xs text-slate-400">
                        Không tìm thấy {childColumnTitle(mode).toLowerCase()}
                      </p>
                    )}
                    {!activeProvince && (
                      <p className="px-3 py-6 text-center text-xs text-slate-400">
                        Chọn tỉnh bên trái
                      </p>
                    )}
                  </Column>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <button
                type="button"
                onClick={clearDraft}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Bỏ chọn tất cả
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {draft.length ? `${draft.length} đã chọn` : 'Chưa chọn'}
                </span>
                <button
                  type="button"
                  onClick={apply}
                  className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={clsx('relative flex items-center', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-2 text-left text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'bar' &&
            'h-12 bg-transparent pl-10 pr-3 text-slate-700',
          variant === 'field' &&
            'rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          !value.length && 'text-slate-500',
        )}
      >
        {variant === 'field' && (
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
      </button>
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Xóa địa điểm"
          disabled={disabled}
          className={clsx(
            'absolute right-2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50',
            variant === 'bar' && 'top-1/2 -translate-y-1/2',
            variant === 'field' && 'top-1/2 -translate-y-1/2',
          )}
          onClick={() => onChange([])}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {panel}
    </div>
  );
}

function Column({
  title,
  query,
  onQueryChange,
  searchPlaceholder,
  children,
  borderLeft,
}: {
  title: string;
  query: string;
  onQueryChange: (q: string) => void;
  searchPlaceholder: string;
  children: ReactNode;
  borderLeft?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex min-h-0 flex-col',
        borderLeft && 'border-t border-slate-100 sm:border-l sm:border-t-0',
      )}
    >
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs outline-none focus:border-brand-400"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function KcnColumn({
  selected,
  onToggle,
  query,
  onQueryChange,
}: {
  selected: Set<string>;
  onToggle: (name: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const list = useMemo(() => {
    const n = searchNormalize(query);
    if (!n) return [...KCN_LOCATIONS];
    return KCN_LOCATIONS.filter((loc) => searchNormalize(loc).includes(n));
  }, [query]);

  return (
    <div className="max-h-[22rem]">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Khu công nghiệp
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Tìm KCN..."
            className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs outline-none focus:border-brand-400"
          />
        </div>
      </div>
      <div className="max-h-[18rem] overflow-y-auto">
        {list.map((loc) => (
          <label
            key={loc}
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={selected.has(loc)}
              onChange={() => onToggle(loc)}
            />
            <span className="text-slate-700">{loc}</span>
          </label>
        ))}
        {!list.length && (
          <p className="px-3 py-6 text-center text-xs text-slate-400">Không tìm thấy KCN</p>
        )}
      </div>
    </div>
  );
}
