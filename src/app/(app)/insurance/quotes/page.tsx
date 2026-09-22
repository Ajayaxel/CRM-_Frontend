import { Suspense } from 'react';
import { InsuranceQuotes } from '@/features/verticals/insurance/insurance/screens/quotes';

export default function InsuranceQuotesPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceQuotes />
    </Suspense>
  );
}
