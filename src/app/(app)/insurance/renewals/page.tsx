import { Suspense } from 'react';
import { InsuranceRenewalCenter } from '@/features/verticals/insurance/insurance/screens/renewal-center';

export default function InsuranceRenewalsPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceRenewalCenter />
    </Suspense>
  );
}
