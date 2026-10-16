import type { Metadata } from 'next';
import { CrmHomePanel } from '@/components/crm/home-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
  title: 'CRM inlink',
};

export default function CrmHomePage() {
  return <CrmHomePanel />;
}
