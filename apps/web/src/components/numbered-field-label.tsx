import clsx from 'clsx';
import type { ReactNode } from 'react';

const FIELD_STT = /^(\d+)\.\s*(.*)$/s;
const SECTION_RANGE = /^(.*?)(\s*\(\d+[–-]\d+\))\s*$/;

const MUTED_STT = 'font-medium tabular-nums text-slate-400';

/** Tách số thứ tự (1. / 24.) hoặc dải (1–12) để làm mờ hơn tiêu đề. */
export function NumberedTitle({
  text,
  mutedClassName = MUTED_STT,
}: {
  text: ReactNode;
  mutedClassName?: string;
}) {
  if (typeof text !== 'string') return <>{text}</>;
  const field = text.match(FIELD_STT);
  if (field) {
    return (
      <>
        <span className={mutedClassName}>{field[1]}.</span> {field[2]}
      </>
    );
  }
  const range = text.match(SECTION_RANGE);
  if (range) {
    return (
      <>
        {range[1]}
        <span className={mutedClassName}>{range[2]}</span>
      </>
    );
  }
  return <>{text}</>;
}

/** Tiêu đề mục đánh số — số STT mờ hơn chữ; câu hỏi/gợi ý mờ bên dưới. */
export function NumberedFieldLabel({
  title,
  description,
  extra,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-2', className)}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
        <NumberedTitle text={title} />
        {extra}
      </p>
      {description ? (
        <p className="mt-0.5 text-xs font-normal text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
