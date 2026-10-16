import type { Metadata } from 'next';
import { CrmReconciliationPanel } from '@/components/crm/reconciliation-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Đối soát · CRM' };

export default async function CrmReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  return <CrmReconciliationPanel initialQuery={query} />;
}
