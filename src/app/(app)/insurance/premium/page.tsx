import { Suspense } from 'react';
import { InsurancePremiumCollection } from '@/features/verticals/insurance/insurance/screens/premium-collection';

export default function InsurancePremiumPage() {
  return (
    <Suspense fallback={null}>
      <InsurancePremiumCollection />
    </Suspense>
  );
}
