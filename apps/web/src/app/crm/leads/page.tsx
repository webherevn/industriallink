import type { Metadata } from 'next';
import { CrmLeadsPanel } from '@/components/crm/leads-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Lead · CRM' };

export default function CrmLeadsPage() {
  return <CrmLeadsPanel />;
}
