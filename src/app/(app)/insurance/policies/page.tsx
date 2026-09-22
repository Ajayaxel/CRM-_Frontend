import { Suspense } from 'react';
import { InsurancePolicies } from '@/features/verticals/insurance/insurance/screens/policies';

export default function InsurancePoliciesPage() {
  return (
    <Suspense fallback={null}>
      <InsurancePolicies />
    </Suspense>
  );
}
