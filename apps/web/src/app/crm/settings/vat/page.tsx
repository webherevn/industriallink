import type { Metadata } from 'next';
import { CrmVatPanel } from '@/components/crm/vat-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Thuế suất · CRM' };

export default function CrmVatPage() {
  return <CrmVatPanel />;
}
