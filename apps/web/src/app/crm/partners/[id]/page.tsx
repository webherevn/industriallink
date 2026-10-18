import type { Metadata } from 'next';
import { CrmPartnerProfilePanel } from '@/components/crm/partner-profile-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Hồ sơ cộng tác viên · CRM' };

export default async function CrmPartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrmPartnerProfilePanel partnerId={id} />;
}
