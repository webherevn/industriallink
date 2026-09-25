import type { Metadata } from 'next';
import { INDEX_ROBOTS, NOINDEX_ROBOTS } from '@/lib/seo-robots';

export function firstSearchParam(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

/** Mọi query (tab, page, keyword, lọc…) là bản sao — canonical về trang cha. */
export function isQueryVariant(
  sp: Record<string, string | string[] | undefined> | null | undefined,
): boolean {
  if (!sp || typeof sp !== 'object') return false;
  return Object.values(sp).some((value) => firstSearchParam(value).length > 0);
}

export function parentCanonicalMetadata(
  parentPath: string,
  sp: Record<string, string | string[] | undefined>,
  whenClean: Pick<Metadata, 'title' | 'description'> = {},
): Metadata {
  const variant = isQueryVariant(sp);
  return {
    ...whenClean,
    robots: variant ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    alternates: { canonical: parentPath },
  };
}
