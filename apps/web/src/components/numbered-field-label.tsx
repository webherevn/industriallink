import clsx from 'clsx';
import type { ReactNode } from 'react';

/** Tiêu đề mục đánh số — cùng cỡ chữ; câu hỏi/gợi ý mờ bên dưới như meta A/B/C. */
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
        {title}
        {extra}
      </p>
      {description ? (
        <p className="mt-0.5 text-xs font-normal text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
