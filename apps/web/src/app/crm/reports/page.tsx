import type { Metadata } from 'next';
import { CrmReportsPanel } from '@/components/crm/reports-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Báo cáo · CRM' };

export default function CrmReportsPage() {
  return <CrmReportsPanel />;
}
