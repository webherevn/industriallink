import type { Metadata } from 'next';

export const INDEX_ROBOTS: Metadata['robots'] = { index: true, follow: true };
export const NOINDEX_ROBOTS: Metadata['robots'] = { index: false, follow: false };
