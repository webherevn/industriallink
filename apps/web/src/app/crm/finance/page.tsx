import type { Metadata } from 'next';
import { CrmFinancePanel } from '@/components/crm/finance-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Hóa đơn · CRM' };

export default async function CrmFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  return <CrmFinancePanel initialQuery={query} />;
}
