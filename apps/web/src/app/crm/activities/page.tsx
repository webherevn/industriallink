import type { Metadata } from 'next';
import { CrmActivitiesPanel } from '@/components/crm/activities-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Nhật ký · CRM' };

export default function CrmActivitiesPage() {
  return <CrmActivitiesPanel />;
}
