import type { Metadata } from 'next';
import { CrmQuoteReportPanel } from '@/components/crm/report-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Báo giá · Báo cáo' };

export default function CrmQuoteReportPage() {
  return <CrmQuoteReportPanel />;
}
