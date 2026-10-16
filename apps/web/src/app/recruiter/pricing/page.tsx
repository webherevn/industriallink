import type { Metadata } from 'next';
import { RecruiterPricingPage } from '@/components/recruiter-pricing-page';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = {
  title: 'Bảng giá & Credit',
  robots: NOINDEX_ROBOTS,
};

export default function Page() {
  return <RecruiterPricingPage />;
}
