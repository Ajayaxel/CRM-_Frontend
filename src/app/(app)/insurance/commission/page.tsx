import { Suspense } from 'react';
import { InsuranceCommission } from '@/features/verticals/insurance/insurance/screens/claims';

export default function InsuranceCommissionPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceCommission />
    </Suspense>
  );
}
