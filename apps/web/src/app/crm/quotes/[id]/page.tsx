import type { Metadata } from 'next';
import { CrmQuoteSheet } from '@/components/crm/quote-sheet';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Tờ báo giá · CRM' };

export default async function CrmQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrmQuoteSheet quoteId={id} />;
}
