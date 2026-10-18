import type { Metadata } from 'next';
import { CrmQuoteFormPanel } from '@/components/crm/quote-form-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Mẫu tờ báo giá · CRM' };

export default function CrmQuoteFormPage() {
  return <CrmQuoteFormPanel />;
}
