import type { Metadata } from 'next';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';
import { CandidatePartnerView } from './candidate-partner-view';

export const metadata: Metadata = { title: 'Cộng tác viên', robots: NOINDEX_ROBOTS };

export default function CandidatePartnerDashboardPage() {
  return <CandidatePartnerView />;
}
