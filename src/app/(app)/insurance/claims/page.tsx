import { Suspense } from 'react';
import { InsuranceClaims } from '@/features/verticals/insurance/insurance/screens/claims';

export default function InsuranceClaimsPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceClaims />
    </Suspense>
  );
}
