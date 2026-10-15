import { Suspense } from 'react';
import { RecruiterTopup } from '@/components/recruiter-billing-topup';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterTopup />
    </Suspense>
  );
}
