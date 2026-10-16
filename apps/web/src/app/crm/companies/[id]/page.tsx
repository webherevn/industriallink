import type { Metadata } from 'next';
import { CrmCompanyPanel } from '@/components/crm/company-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Hồ sơ công ty · CRM' };

export default async function CrmCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrmCompanyPanel companyId={id} />;
}
