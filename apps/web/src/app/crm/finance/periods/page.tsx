import type { Metadata } from 'next';
import { CrmPeriodsPanel } from '@/components/crm/periods-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Kỳ chốt · CRM' };

export default function CrmPeriodsPage() {
  return <CrmPeriodsPanel />;
}
