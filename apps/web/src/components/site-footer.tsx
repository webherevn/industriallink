'use client';

import type { CmsFooterBlock, CmsFooterSettingsView } from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { getApiBase } from '@/lib/api';
import { absolutizeCmsHtml } from '@/lib/cms-assets';
import { BRAND_NAME } from '@/lib/brand';

function stripHtml(html: string): boolean {
  return Boolean(
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function visibleColumns(block: CmsFooterBlock) {
  return (block.columns ?? [])
    .map((c, index) => ({ html: c.html ?? '', index }))
    .filter((c) => stripHtml(c.html));
}

function FooterColumns({ block, dense }: { block: CmsFooterBlock; dense?: boolean }) {
  const cols = visibleColumns(block);
  if (!block.enabled || cols.length === 0) return null;

  const grid =
    cols.length === 1
      ? 'grid-cols-1'
      : cols.length === 2
        ? 'sm:grid-cols-2'
        : cols.length === 3
          ? 'sm:grid-cols-2 lg:grid-cols-3'
          : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={clsx('grid gap-8', grid)}>
      {cols.map((col) => (
        <div
          key={col.index}
          className={clsx(
            'cms-prose cms-footer-prose max-w-none text-sm leading-relaxed',
            dense ? 'text-slate-300' : 'text-slate-300',
          )}
          dangerouslySetInnerHTML={{ __html: absolutizeCmsHtml(col.html) }}
        />
      ))}
    </div>
  );
}

async function fetchFooterClient(): Promise<CmsFooterSettingsView | null> {
  const res = await fetch(`${getApiBase()}/cms/footer`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as CmsFooterSettingsView;
}

const FALLBACK: CmsFooterSettingsView = {
  footer1: { enabled: false, columns: [{ html: '' }, { html: '' }, { html: '' }, { html: '' }] },
  footer2: { enabled: false, columns: [{ html: '' }, { html: '' }, { html: '' }, { html: '' }] },
  copyrightText: `©${new Date().getFullYear()} Inlink Vietnam JSC. All rights reserved.`,
  updatedAt: new Date().toISOString(),
};

/** Chân trang public — Footer 1/2 (4 cột, ẩn cột trống) + copyright bar. */
export function SiteFooter() {
  const { data } = useQuery({
    queryKey: ['public-cms-footer'],
    queryFn: fetchFooterClient,
    staleTime: 60_000,
  });

  const footer = data ?? FALLBACK;
  const show1 =
    footer.footer1.enabled && visibleColumns(footer.footer1).length > 0;
  const show2 =
    footer.footer2.enabled && visibleColumns(footer.footer2).length > 0;
  const copyright =
    footer.copyrightText?.trim() ||
    `©${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`;

  return (
    <footer className="mt-auto border-t border-white/10 bg-[var(--brand-navy)] text-slate-300">
      {(show1 || show2) && (
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          {show1 ? <FooterColumns block={footer.footer1} /> : null}
          {show1 && show2 ? (
            <div className="my-8 border-t border-white/10" aria-hidden />
          ) : null}
          {show2 ? <FooterColumns block={footer.footer2} dense /> : null}
        </div>
      )}

      <div className="border-t border-white/10 bg-[#051a36]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-center text-xs text-slate-400 sm:flex-row sm:px-6 sm:text-left">
          <p>{copyright}</p>
          <p className="font-medium tracking-wide text-slate-500">{BRAND_NAME}</p>
        </div>
      </div>
    </footer>
  );
}
