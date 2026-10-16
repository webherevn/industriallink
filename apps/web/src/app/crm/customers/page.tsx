import type { Metadata } from 'next';
import { CrmCustomersPanel } from '@/components/crm/customers-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Khách hàng · CRM' };

export default function CrmCustomersPage() {
  return <CrmCustomersPanel />;
}
