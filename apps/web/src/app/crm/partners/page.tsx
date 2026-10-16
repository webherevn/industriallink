import type { Metadata } from 'next';
import { CrmPartnersPanel } from '@/components/crm/partners-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Cộng tác viên · CRM' };

export default function CrmPartnersPage() {
  return <CrmPartnersPanel />;
}
