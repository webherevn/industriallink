import type { Metadata } from 'next';
import { CrmSignupsPanel } from '@/components/crm/signups-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Đăng ký chưa trả · CRM' };

export default async function CrmSignupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  return <CrmSignupsPanel initialQuery={query} />;
}
