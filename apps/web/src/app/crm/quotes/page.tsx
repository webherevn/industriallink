import type { Metadata } from 'next';
import { CrmQuotesPanel } from '@/components/crm/quotes-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Báo giá · CRM' };

export default function CrmQuotesPage() {
  return <CrmQuotesPanel />;
}
