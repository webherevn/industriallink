import type { Metadata } from 'next';
import { CrmPipelinePanel } from '@/components/crm/pipeline-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Phễu bán gói · CRM' };

export default function CrmPipelinePage() {
  return <CrmPipelinePanel />;
}
