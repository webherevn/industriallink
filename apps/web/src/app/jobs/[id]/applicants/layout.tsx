import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS };

export default function ApplicantsLayout({ children }: { children: ReactNode }) {
  return children;
}
