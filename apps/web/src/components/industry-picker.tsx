'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, Flame, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  INDUSTRY_GROUPS_WEB,
  getIndustryCatalog,
  normalizeIndustry,
  type IndustryGroup,
} from '@industriallink/contracts';
import { fetchJobPositionStats } from '@/lib/jobs';

const GROUP_PAGE_SIZE = 7;

export type IndustryFilterValue = {
  industry: string;
  subIndustry: string;
  role: string;
};

type Props = {
  value: IndustryFilterValue;
  onChange: (next: IndustryFilterValue) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** `bar` = thanh tìm việc; `field` = bộ lọc / form. */
  variant?: 'bar' | 'field';
};

function emptyValue(): IndustryFilterValue {
  return { industry: '', subIndustry: '', role: '' };
}

export function IndustryPicker({
  value,
  onChange,
  placeholder = 'Tất cả ngành nghề',
  disabled = false,
  className,
  variant = 'field',
}: Props) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [groupPage, setGroupPage] = useState(0);
  const [preview, setPreview] = useState<IndustryGroup | ''>('');

  const { data: stats } = useQuery({
    queryKey: ['job-position-stats'],
    queryFn: fetchJobPositionStats,
    staleTime: 60_000,
    enabled: open || Boolean(value.industry),
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const currentGroup = normalizeIndustry(value.industry) ?? '';
    setPreview((currentGroup as IndustryGroup) || INDUSTRY_GROUPS_WEB[0]);
    const idx = INDUSTRY_GROUPS_WEB.findIndex((g) => g === currentGroup);
    setGroupPage(idx >= 0 ? Math.floor(idx / GROUP_PAGE_SIZE) : 0);
  }, [open, value.industry]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const width = Math.min(44 * 16, window.innerWidth - 16);
    let left = variant === 'bar' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = rect.bottom + gap;
    const maxHeight = Math.max(280, window.innerHeight - top - 12);
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
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const totalPages = Math.max(1, Math.ceil(INDUSTRY_GROUPS_WEB.length / GROUP_PAGE_SIZE));
  const pageGroups = INDUSTRY_GROUPS_WEB.slice(
    groupPage * GROUP_PAGE_SIZE,
    groupPage * GROUP_PAGE_SIZE + GROUP_PAGE_SIZE,
  );

  const catalog = preview ? getIndustryCatalog(preview) : undefined;
  const positions = useMemo(() => {
    if (!preview || !stats) return [];
    return stats.byIndustry.find((g) => g.industry === preview)?.positions ?? [];
  }, [preview, stats]);

  const triggerLabel = useMemo(() => {
    if (value.role) return value.role;
    if (value.subIndustry) return value.subIndustry;
    if (value.industry) return value.industry;
    return placeholder;
  }, [value, placeholder]);

  const apply = (next: IndustryFilterValue) => {
    onChange(next);
    setOpen(false);
  };

  const clear = (e: ReactMouseEvent) => {
    e.stopPropagation();
    onChange(emptyValue());
  };

  const hasValue = Boolean(value.industry || value.subIndustry || value.role);

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex h-12 w-full items-center gap-1.5 bg-transparent px-3.5 text-left text-sm outline-none',
          variant === 'field' &&
            'h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-300',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          className={clsx(
            'min-w-0 flex-1 truncate',
            hasValue ? 'font-medium text-slate-800' : 'text-slate-500',
          )}
        >
          {triggerLabel}
        </span>
        {hasValue ? (
          <X className="h-3.5 w-3.5 shrink-0 text-slate-400 hover:text-slate-700" onClick={clear} />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Chọn ngành nghề"
            style={panelStyle}
            className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.14)]"
          >
            <div className="flex w-[220px] shrink-0 flex-col border-r border-slate-100 bg-slate-50/80">
              <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                {pageGroups.map((group) => {
                  const active = preview === group;
                  const selected = value.industry === group;
                  return (
                    <li key={group}>
                      <button
                        type="button"
                        onMouseEnter={() => setPreview(group)}
                        onFocus={() => setPreview(group)}
                        onClick={() => apply({ industry: group, subIndustry: '', role: '' })}
                        className={clsx(
                          'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] leading-snug transition',
                          active
                            ? 'bg-white font-semibold text-brand-700'
                            : 'text-slate-700 hover:bg-white/80',
                          selected && !active && 'font-medium text-brand-600',
                        )}
                      >
                        <span>{group}</span>
                        <ChevronRight
                          className={clsx(
                            'h-3.5 w-3.5 shrink-0',
                            active ? 'text-brand-500' : 'text-slate-300',
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-2 py-2">
                  <button
                    type="button"
                    disabled={groupPage <= 0}
                    onClick={() => setGroupPage((p) => Math.max(0, p - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 disabled:opacity-30"
                    aria-label="Nhóm trước"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] font-medium text-slate-500">
                    {groupPage + 1}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={groupPage >= totalPages - 1}
                    onClick={() => setGroupPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 disabled:opacity-30"
                    aria-label="Nhóm sau"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {catalog ? (
                <div className="space-y-4 pb-8">
                  <button
                    type="button"
                    onClick={() => apply({ industry: catalog.name, subIndustry: '', role: '' })}
                    className="text-xs font-semibold text-brand-700 hover:underline"
                  >
                    Tất cả {catalog.name}
                  </button>

                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Vị trí đang tuyển
                    </p>
                    {positions.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Chưa có tin tuyển dụng trong nhóm này trên nền tảng.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {positions.map((p, i) => (
                          <button
                            key={p.title}
                            type="button"
                            onClick={() =>
                              apply({
                                industry: catalog.name,
                                subIndustry: '',
                                role: p.title,
                              })
                            }
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition',
                              value.role === p.title
                                ? 'border-brand-300 bg-brand-50 font-semibold text-brand-800'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-200 hover:bg-brand-50/60',
                            )}
                          >
                            {i < 3 && <Flame className="h-3 w-3 text-rose-500" />}
                            <span className="max-w-[220px] truncate">{p.title}</span>
                            <span className="text-[10px] text-slate-400">{p.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                    <div className="border-t border-slate-100 pt-3">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Ngành chi tiết
                    </p>
                    {catalog.classificationPrinciple ? (
                      <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
                        {catalog.classificationPrinciple}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {catalog.subIndustries.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            apply({
                              industry: catalog.name,
                              subIndustry: item,
                              role: '',
                            })
                          }
                          className={clsx(
                            'rounded-full border px-2.5 py-1 text-xs transition',
                            value.subIndustry === item
                              ? 'border-brand-300 bg-brand-50 font-semibold text-brand-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50/50',
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Chọn nhóm ngành bên trái.</p>
              )}
              <div className="pointer-events-none sticky bottom-0 flex justify-end pt-2">
                <span className="pointer-events-none inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow">
                  Cuộn để xem
                  <ChevronsDown className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Chọn ngành chi tiết khi NTD đăng / sửa tin. */
export function IndustrySubFields({
  industry,
  subIndustry,
  onChange,
  disabled,
}: {
  industry: string;
  subIndustry: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const catalog = industry ? getIndustryCatalog(industry) : undefined;
  if (!catalog) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-600">Ngành chi tiết</p>
      {catalog.classificationPrinciple ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          {catalog.classificationPrinciple}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {catalog.subIndustries.map((item) => (
          <Chip
            key={item}
            active={subIndustry === item}
            disabled={disabled}
            onClick={() => onChange(subIndustry === item ? '' : item)}
          >
            {item}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'rounded-full border px-2.5 py-1 text-xs transition',
        active
          ? 'border-brand-300 bg-brand-50 font-semibold text-brand-800'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  );
}
