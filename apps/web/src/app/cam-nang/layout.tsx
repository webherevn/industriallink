import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { formatCmsSeoTitle } from '@/lib/cms-seo';
import { INDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = {
  title: { absolute: formatCmsSeoTitle('Cẩm nang nghề nghiệp') },
  description: 'Cẩm nang nghề nghiệp công nghiệp B2B — kiến thức, lộ trình và mẹo ứng tuyển.',
  robots: INDEX_ROBOTS,
  alternates: { canonical: '/cam-nang' },
};

export default function CareerGuideLayout({ children }: { children: ReactNode }) {
  return children;
}
