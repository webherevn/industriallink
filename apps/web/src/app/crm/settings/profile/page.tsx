import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CrmStaffProfilePanel } from '@/components/crm/staff-profile-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Hồ sơ nhân sự · CRM' };

export default function CrmStaffProfilePage() {
  return (
    <Suspense fallback={null}>
      <CrmStaffProfilePanel />
    </Suspense>
  );
}
