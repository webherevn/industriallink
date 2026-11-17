import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { PartnerIntroView } from '@/components/partner-intro-view';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { title: 'Cộng tác viên | inlink', robots: NOINDEX_ROBOTS };

export default function CandidatePartnerPage() {
  return (
    <AppShell>
      <PartnerIntroView />
    </AppShell>
  );
}
