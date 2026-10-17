import type { Metadata } from 'next';
import { CrmChannelsPanel } from '@/components/crm/marketing-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Kênh · CRM' };

export default function CrmChannelsPage() {
  return <CrmChannelsPanel />;
}
