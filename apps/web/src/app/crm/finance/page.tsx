import type { Metadata } from 'next';
import { CrmFinancePanel } from '@/components/crm/finance-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Công nợ & VAT · CRM' };

export default function CrmFinancePage() {
  return <CrmFinancePanel />;
}
