import type { Metadata } from 'next';
import { CrmPartnersPanel } from '@/components/crm/partners-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Cộng tác viên · CRM' };

export default async function CrmPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  return <CrmPartnersPanel initialQuery={query} />;
}
