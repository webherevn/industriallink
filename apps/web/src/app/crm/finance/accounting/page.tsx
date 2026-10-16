import type { Metadata } from 'next';
import { CrmAccountingPanel } from '@/components/crm/accounting-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Kế toán · CRM' };

export default function CrmAccountingPage() {
  return <CrmAccountingPanel />;
}
