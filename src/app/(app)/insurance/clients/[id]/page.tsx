import { Suspense } from 'react';
import { InsuranceClientDetail } from '@/features/verticals/insurance/insurance/screens/client-detail';

// Next 15 hands dynamic segments to the page as a promise.
export default async function InsuranceClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    // The screen reads `?tab=` with useSearchParams, which needs a boundary.
    <Suspense fallback={null}>
      <InsuranceClientDetail id={id} />
    </Suspense>
  );
}
