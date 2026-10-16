import { Suspense } from 'react';
import { RecruiterSourcingActivate } from '@/components/recruiter-billing-sourcing-activate';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterSourcingActivate />
    </Suspense>
  );
}
