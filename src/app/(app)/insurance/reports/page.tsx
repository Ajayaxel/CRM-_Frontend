import { Suspense } from 'react';
import { InsuranceAnalytics } from '@/features/verticals/insurance/insurance/screens/analytics';

export default function InsuranceReportsPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceAnalytics />
    </Suspense>
  );
}
