import type { Metadata } from 'next';
import { CrmPipelineReportPanel } from '@/components/crm/report-panels';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Phễu cơ hội · CRM' };

export default function CrmPipelineReportPage() {
  return <CrmPipelineReportPanel />;
}
