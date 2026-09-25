import Link from 'next/link';
import type { CmsBreadcrumbItem } from '@/lib/cms-seo';

export function CmsBreadcrumb({ items }: { items: CmsBreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-slate-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.name}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="select-none text-slate-300" aria-hidden>
                  /
                </span>
              )}
              {last || !item.href ? (
                <span
                  className={
                    last
                      ? 'line-clamp-1 max-w-[14rem] font-medium text-slate-700 sm:max-w-md'
                      : undefined
                  }
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="font-medium text-brand-600 transition hover:text-accent-600"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
