import type { Metadata } from 'next';
import { CrmRenewalsPanel } from '@/components/crm/renewals-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Gia hạn · CRM' };

export default function CrmRenewalsPage() {
  return <CrmRenewalsPanel />;
}
