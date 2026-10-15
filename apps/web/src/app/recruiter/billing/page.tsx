import { Suspense } from 'react';
import { RecruiterBillingHub } from '@/components/recruiter-billing-hub';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterBillingHub />
    </Suspense>
  );
}
