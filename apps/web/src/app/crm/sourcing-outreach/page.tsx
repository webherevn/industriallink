import type { Metadata } from 'next';
import { CrmSourcingOutreachPageView } from '@/components/crm/sourcing-outreach-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
  title: 'Bàn giao liên hệ Săn nhân sự · CRM',
};

export default function CrmSourcingOutreachPage() {
  return <CrmSourcingOutreachPageView />;
}
