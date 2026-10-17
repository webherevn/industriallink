import type { Metadata } from 'next';
import { CrmBusinessReportsPanel } from '@/components/crm/business-reports-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Báo cáo · CRM' };

export default function CrmBusinessReportsPage() {
  return <CrmBusinessReportsPanel />;
}
