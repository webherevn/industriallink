import type { Metadata } from 'next';
import { CrmMarketingHomePanel } from '@/components/crm/marketing-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Marketing · CRM' };

export default function CrmMarketingPage() {
  return <CrmMarketingHomePanel />;
}
