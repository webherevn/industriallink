import type { Metadata } from 'next';
import { CrmCostsPanel } from '@/components/crm/marketing-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Chi phí · CRM' };

export default function CrmCostsPage() {
  return <CrmCostsPanel />;
}