import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

/** Không prerender. HTML tĩnh từng bị cache s-maxage=1 năm và trỏ tới chunk JS đã xóa sau deploy. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
  title: 'inlink Admin',
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
