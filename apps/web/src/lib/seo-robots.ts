import type { Metadata } from 'next';

/** Public indexable — ưu tiên Google Discover ảnh lớn. */
export const INDEX_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
  'max-image-preview': 'large',
} as Metadata['robots'];

export const NOINDEX_ROBOTS: Metadata['robots'] = { index: false, follow: false };
