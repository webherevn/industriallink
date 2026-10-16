import type { Metadata } from 'next';
import { CrmInboxPanel } from '@/components/crm/inbox-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Khách tự mua · CRM' };

export default function CrmInboxPage() {
  return <CrmInboxPanel />;
}
