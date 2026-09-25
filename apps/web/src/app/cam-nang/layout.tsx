import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CAM_NANG_INTRO, CAM_NANG_INTRO_DETAIL } from '@/components/cms-blog';
import { formatCmsSeoTitle } from '@/lib/cms-seo';
import { INDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = {
  title: { absolute: formatCmsSeoTitle('Cẩm nang nghề nghiệp') },
  description: `${CAM_NANG_INTRO} ${CAM_NANG_INTRO_DETAIL}`,
  robots: INDEX_ROBOTS,
  alternates: { canonical: '/cam-nang' },
};

export default function CareerGuideLayout({ children }: { children: ReactNode }) {
  return children;
}
