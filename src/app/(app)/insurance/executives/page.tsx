import { Suspense } from 'react';
import { InsuranceExecutives } from '@/features/verticals/insurance/insurance/screens/executives';

export default function InsuranceExecutivesPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceExecutives />
    </Suspense>
  );
}
