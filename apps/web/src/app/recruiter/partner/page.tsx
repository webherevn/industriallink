import type { Metadata } from 'next';
import { PartnerIntroView } from '@/components/partner-intro-view';
import { RecruiterShell } from '@/components/recruiter-shell';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { title: 'Cộng tác viên', robots: NOINDEX_ROBOTS };

export default function RecruiterPartnerPage() {
  return (
    <RecruiterShell>
      <PartnerIntroView />
    </RecruiterShell>
  );
}
