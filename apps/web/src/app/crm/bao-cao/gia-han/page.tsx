import type { Metadata } from 'next';
import { CrmRenewalReportPanel } from '@/components/crm/report-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Gia hạn · CRM' };

export default function CrmRenewalReportPage() {
  return <CrmRenewalReportPanel />;
}
