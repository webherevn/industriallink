import clsx from 'clsx';
import { Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function CrmFrame({
  kicker,
  title,
  description,
  placeholder,
  chips,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  placeholder: string;
  chips?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="px-2 pt-2 text-center">
        <p className="text-sm text-slate-500">{kicker}</p>
        <h1 className="mx-auto mt-1 max-w-3xl bg-gradient-to-r from-[#4c3ec9] to-[#7a6af2] bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-[28px]">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{description}</p>
      </div>

      <div className="mx-auto flex max-w-2xl items-center gap-2.5 rounded-full bg-white px-4 py-3 shadow-[0_8px_24px_rgba(91,76,219,0.08)]">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate text-sm text-slate-400">{placeholder}</span>
      </div>

      {chips ? (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-[28px] bg-white/75 p-3 shadow-[0_8px_24px_rgba(91,76,219,0.05)]">
          {chips}
        </div>
      ) : null}

      {children}

      <p className="text-center text-[11px] text-slate-400">Số liệu trên màn là mẫu, chưa ghi vào hệ thống</p>
    </div>
  );
}

export function CrmChip({
  icon,
  label,
  href,
  active,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
}) {
  const className = clsx(
    'inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium shadow-sm ring-1',
    active
      ? 'bg-[#efeaff] text-[#4c3ec9] ring-[#ddd6fe]'
      : 'bg-white text-slate-700 ring-slate-100',
  );
  const body = (
    <>
      <span className="text-slate-500">{icon}</span>
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <span className={className}>{body}</span>;
}

const TONE = {
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-500',
  green: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-500',
  indigo: 'bg-indigo-50 text-indigo-600',
} as const;

export function CrmCard({
  icon,
  tone,
  title,
  text,
  badge,
  meta,
}: {
  icon: ReactNode;
  tone: keyof typeof TONE;
  title: string;
  text: string;
  badge?: string;
  meta?: string;
}) {
  return (
    <article className="relative flex h-full flex-col rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
      {badge ? (
        <span className="absolute right-4 top-4 rounded-full bg-[#ff4d4f] px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      <div className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', TONE[tone])}>{icon}</div>
      <h2 className="mt-4 pr-8 text-[15px] font-semibold leading-snug text-slate-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{text}</p>
      {meta ? <p className="mt-auto pt-3 text-xs font-medium text-slate-400">{meta}</p> : null}
    </article>
  );
}

export function CrmCardGrid({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 }) {
  return (
    <div className={clsx('grid gap-4 sm:grid-cols-2', columns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4')}>
      {children}
    </div>
  );
}
