import type { Metadata } from 'next';
import { CrmReconciliationPanel } from '@/components/crm/reconciliation-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Đối soát · CRM' };

export default function CrmReconciliationPage() {
  return <CrmReconciliationPanel />;
}
