import type { Metadata } from 'next';
import { CrmPayoutDayPanel } from '@/components/crm/payout-day-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Ngày chi · CRM' };

export default function CrmPayoutDayPage() {
  return <CrmPayoutDayPanel />;
}
