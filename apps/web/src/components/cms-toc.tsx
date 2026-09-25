import type { CmsTocItem } from '@/lib/cms-seo';

export function CmsTableOfContents({ items }: { items: CmsTocItem[] }) {
  if (items.length < 2) return null;
  return (
    <nav
      aria-label="Mục lục"
      className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5 sm:py-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mục lục</p>
      <ol className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'ml-3' : undefined}>
            <a
              href={`#${item.id}`}
              className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
