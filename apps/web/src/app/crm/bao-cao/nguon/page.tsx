import type { Metadata } from 'next';
import { CrmLeadSourceReportPanel } from '@/components/crm/report-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Nguồn tiềm năng · CRM' };

export default function CrmLeadSourceReportPage() {
  return <CrmLeadSourceReportPanel />;
}
