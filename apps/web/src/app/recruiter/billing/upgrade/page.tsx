import { Suspense } from 'react';
import { RecruiterPlanUpgrade } from '@/components/recruiter-billing-upgrade';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterPlanUpgrade />
    </Suspense>
  );
}
