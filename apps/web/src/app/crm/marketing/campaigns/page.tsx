import type { Metadata } from 'next';
import { CrmCampaignsPanel } from '@/components/crm/marketing-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Chiến dịch · CRM' };

export default function CrmCampaignsPage() {
  return <CrmCampaignsPanel />;
}
