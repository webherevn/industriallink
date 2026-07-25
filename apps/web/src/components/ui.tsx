import clsx from 'clsx';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react';

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
      <select
        disabled={disabled}
        aria-label="Tháng"
        className={inputClassName}
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
      <select
        disabled={disabled}
        aria-label="Năm"
        className={inputClassName}
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
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function Card({
  className,
  children,
  as = 'div',
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'li';
}) {
  const Tag = as;
  return (
    <Tag className={clsx('rounded-2xl border border-slate-200 bg-white p-6 shadow-sm', className)}>
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'slate' | 'green' | 'amber' | 'red';
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
      )}
    >
      {children}
    </span>
  );
}
