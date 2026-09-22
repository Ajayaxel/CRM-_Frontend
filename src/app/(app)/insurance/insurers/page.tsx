import { Suspense } from 'react';
import { InsuranceInsurers } from '@/features/verticals/insurance/insurance/screens/analytics';

export default function InsuranceInsurersPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceInsurers />
    </Suspense>
  );
}
