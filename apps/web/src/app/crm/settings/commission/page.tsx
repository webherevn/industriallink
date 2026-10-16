import type { Metadata } from 'next';
import { CrmCommissionPanel } from '@/components/crm/commission-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Hoa hồng · CRM' };

export default function CrmCommissionPage() {
  return <CrmCommissionPanel />;
}
