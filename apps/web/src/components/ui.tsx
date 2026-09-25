'use client';

import clsx from 'clsx';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useId,
  useEffect,
  useRef,
  useState,
} from 'react';
import { NumberedTitle } from '@/components/numbered-field-label';

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'outline' && 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        className,
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          className,
        )}
        {...props}
      />
    );
  },
);

const inputClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const selectClassName =
  'h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm leading-normal outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

/** ISO YYYY-MM-DD → hiển thị DD/MM/YYYY. */
export function isoToDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Chuỗi số DDMMYYYY (tối đa 8) → DD/MM/YYYY khi gõ. */
export function digitsToDisplayDate(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** DD/MM/YYYY hoặc số thuần → ISO YYYY-MM-DD (chỉ khi đủ & hợp lệ). */
export function displayDateToIso(display: string): string | null {
  const d = display.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Ngày sinh: gõ số tự chèn `/` (DD/MM/YYYY), kèm nút mở lịch chọn ngày.
 * Giá trị lưu: ISO `YYYY-MM-DD` (rỗng nếu chưa chọn / xoá).
 */
export function BirthDateInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'DD/MM/YYYY',
}: {
  value: string;
  onChange: (isoYmd: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const textId = useId();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.test(value.trim()) ? value.trim() : '';
  const [text, setText] = useState(() => (iso ? isoToDisplayDate(iso) : ''));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setText(iso ? isoToDisplayDate(iso) : '');
  }, [iso, focused]);

  function openPicker() {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker?.();
    } catch {
      el.click();
    }
  }

  return (
    <div className={clsx('relative', className)}>
      <input
        id={textId}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        disabled={disabled}
        placeholder={placeholder}
        className={clsx(inputClassName, 'pr-11 tabular-nums')}
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          const next = digitsToDisplayDate(e.target.value);
          setText(next);
          const nextIso = displayDateToIso(next);
          if (nextIso) onChange(nextIso);
          else if (!next.replace(/\D/g, '')) onChange('');
        }}
        onBlur={() => {
          setFocused(false);
          const nextIso = displayDateToIso(text);
          if (nextIso) {
            setText(isoToDisplayDate(nextIso));
            onChange(nextIso);
          } else if (!text.replace(/\D/g, '')) {
            setText('');
            onChange('');
          } else {
            // Giữ text dở; đồng bộ lại từ value ISO nếu còn
            setText(iso ? isoToDisplayDate(iso) : text);
          }
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-brand-700 disabled:opacity-50"
        aria-label="Chọn ngày trên lịch"
        title="Chọn ngày trên lịch"
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={iso}
        min="1950-01-01"
        max="2015-12-31"
        onChange={(e) => {
          const v = e.target.value;
          setText(v ? isoToDisplayDate(v) : '');
          onChange(v);
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );
}

/**
 * Nhập năm (VD: năm sinh): gõ 4 số hoặc bấm nút lịch để mở bảng chọn năm.
 * Giá trị: chuỗi năm 4 số hoặc rỗng.
 */
export function YearInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'VD: 1995',
  minYear = 1950,
  maxYear = new Date().getFullYear(),
}: {
  value: string;
  onChange: (year: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [open]);

  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y -= 1) years.push(y);

  return (
    <div ref={wrapRef} className={clsx('relative', className)}>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder}
        maxLength={4}
        className={clsx(inputClassName, 'pr-11 tabular-nums')}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-brand-700 disabled:opacity-50"
        aria-label="Chọn năm"
        title="Chọn năm"
      >
        <Calendar className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 max-h-56 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="grid grid-cols-4 gap-1">
            {years.map((y) => {
              const selected = String(y) === value;
              return (
                <button
                  key={y}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  onClick={() => {
                    onChange(String(y));
                    setOpen(false);
                  }}
                  className={clsx(
                    'rounded-lg px-1.5 py-1.5 text-sm tabular-nums transition',
                    selected
                      ? 'bg-brand-600 font-semibold text-white'
                      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700',
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Nhập số tiền: hiện 1,000,000; lưu chuỗi chỉ gồm chữ số. */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  hint,
  className,
  disabled,
}: {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  /** Gợi ý đơn vị thông minh bên dưới, vd. "≈ 1 tỷ". */
  hint?: string | null;
  className?: string;
  disabled?: boolean;
}) {
  const digits = value.replace(/\D/g, '');
  const display = digits ? Number(digits).toLocaleString('en-US') : '';

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder ?? 'VD: 1,000,000'}
        className={clsx(inputClassName, 'tabular-nums', className)}
        value={display}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
          onChange(next);
        }}
      />
      {hint ? <p className="mt-1 text-[11px] font-medium text-amber-700">{hint}</p> : null}
    </div>
  );
}

const MONTH_OPTIONS = [
  { value: '01', label: 'Tháng 1' },
  { value: '02', label: 'Tháng 2' },
  { value: '03', label: 'Tháng 3' },
  { value: '04', label: 'Tháng 4' },
  { value: '05', label: 'Tháng 5' },
  { value: '06', label: 'Tháng 6' },
  { value: '07', label: 'Tháng 7' },
  { value: '08', label: 'Tháng 8' },
  { value: '09', label: 'Tháng 9' },
  { value: '10', label: 'Tháng 10' },
  { value: '11', label: 'Tháng 11' },
  { value: '12', label: 'Tháng 12' },
] as const;

const YEAR_OPTIONS: number[] = (() => {
  const years: number[] = [];
  for (let y = 2035; y >= 1980; y -= 1) years.push(y);
  return years;
})();

/** Chọn tháng + năm (YYYY-MM) bằng 2 dropdown — dễ chọn năm hơn lịch native. */
export function MonthYearInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (yyyyMm: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  const year = match?.[1] ?? '';
  const month = match?.[2] ?? '';

  function emit(nextYear: string, nextMonth: string) {
    if (!nextYear && !nextMonth) {
      onChange('');
      return;
    }
    const y = nextYear || String(new Date().getFullYear());
    const m = nextMonth || '01';
    onChange(`${y}-${m}`);
  }

  return (
    <div className={clsx('grid grid-cols-2 gap-2', className)}>
      <div className="relative min-w-0">
        <select
          disabled={disabled}
          aria-label="Tháng"
          className={selectClassName}
          value={month}
          onChange={(e) => emit(year, e.target.value)}
        >
          <option value="">Tháng</option>
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="relative min-w-0">
        <select
          disabled={disabled}
          aria-label="Năm"
          className={selectClassName}
          value={year}
          onChange={(e) => emit(e.target.value, month)}
        >
          <option value="">Năm</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

/** Bắt đầu / Kết thúc cùng hàng với dropdown tháng-năm — tránh lệch cột. */
export function MonthYearRangeFields({
  start,
  end,
  current,
  onStartChange,
  onEndChange,
  onCurrentChange,
}: {
  start: string;
  end: string;
  current: boolean;
  onStartChange: (yyyyMm: string) => void;
  onEndChange: (yyyyMm: string) => void;
  onCurrentChange: (current: boolean) => void;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-[4.75rem] shrink-0 text-sm font-medium text-slate-600">
            Bắt đầu
          </span>
          <MonthYearInput className="min-w-0 flex-1" value={start} onChange={onStartChange} />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-[4.75rem] shrink-0 text-sm font-medium text-slate-600">
            Kết thúc
          </span>
          <MonthYearInput
            className="min-w-0 flex-1"
            value={end}
            disabled={current}
            onChange={onEndChange}
          />
        </div>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="rounded border-slate-300 text-brand-600"
          checked={current}
          onChange={(e) => onCurrentChange(e.target.checked)}
        />
        Đang làm việc tại đây
      </label>
    </div>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(
          'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={clsx(
          'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Field({
  label,
  description,
  children,
  className,
}: {
  label: string;
  /** Câu hỏi / gợi ý mờ dưới tiêu đề (cùng kiểu meta A/B/C). */
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('block space-y-1.5', className)}>
      <span className="block text-sm font-semibold text-slate-800">
        <NumberedTitle text={label} />
      </span>
      {description ? (
        <span className="block text-xs font-normal text-slate-500">{description}</span>
      ) : null}
      {children}
    </div>
  );
}

export function Card({
  className,
  children,
  as = 'div',
}: {
  className?: string;
  children?: ReactNode;
  as?: 'div' | 'li';
}) {
  const Tag = as;
  return (
    <Tag className={clsx('rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6', className)}>
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'slate' | 'green' | 'amber' | 'red' | 'accent';
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'brand' && 'bg-brand-50 text-brand-700',
        tone === 'slate' && 'bg-slate-100 text-slate-600',
        tone === 'green' && 'bg-green-50 text-green-700',
        tone === 'amber' && 'bg-amber-50 text-amber-700',
        tone === 'red' && 'bg-red-50 text-red-700',
        tone === 'accent' && 'bg-accent-50 text-accent-700 ring-1 ring-accent-200/80',
      )}
    >
      {children}
    </span>
  );
}
