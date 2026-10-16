import type { Metadata } from 'next';
import { RecruiterPartnerPanel } from '@/components/recruiter-partner-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { title: 'Cộng tác viên', robots: NOINDEX_ROBOTS };

export default function RecruiterPartnerPage() {
  return <RecruiterPartnerPanel />;
}
