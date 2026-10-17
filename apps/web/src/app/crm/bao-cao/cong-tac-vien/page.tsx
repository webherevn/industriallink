import type { Metadata } from 'next';
import { CrmPartnerPaidReportPanel } from '@/components/crm/report-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Cộng tác viên · Báo cáo' };

export default function CrmPartnerPaidReportPage() {
  return <CrmPartnerPaidReportPanel />;
}
