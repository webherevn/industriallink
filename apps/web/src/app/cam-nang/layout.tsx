import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = {
  title: 'Cẩm nang nghề nghiệp | inlink',
  description: 'Cẩm nang nghề nghiệp công nghiệp B2B — kiến thức, lộ trình và mẹo ứng tuyển.',
  robots: NOINDEX_ROBOTS,
  alternates: { canonical: '/cam-nang' },
};

export default function CareerGuideLayout({ children }: { children: ReactNode }) {
  return children;
}
