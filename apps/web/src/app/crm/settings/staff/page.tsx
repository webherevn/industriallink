import type { Metadata } from 'next';
import { CrmStaffDirectoryPanel } from '@/components/crm/staff-directory-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Nhân sự · CRM' };

export default function CrmStaffDirectoryPage() {
  return <CrmStaffDirectoryPanel />;
}
