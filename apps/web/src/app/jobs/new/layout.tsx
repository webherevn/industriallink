import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = { robots: NOINDEX_ROBOTS };

export default function NewJobLayout({ children }: { children: ReactNode }) {
  return children;
}
