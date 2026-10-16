import type { Metadata } from 'next';
import { CrmNotificationsPanel } from '@/components/crm/notifications-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Thông báo · CRM' };

export default function CrmNotificationsPage() {
  return <CrmNotificationsPanel />;
}
