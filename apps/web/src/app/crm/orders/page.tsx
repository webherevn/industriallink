import type { Metadata } from 'next';
import { CrmOrdersPanel } from '@/components/crm/orders-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Đơn hàng · CRM' };

export default function CrmOrdersPage() {
  return <CrmOrdersPanel />;
}
