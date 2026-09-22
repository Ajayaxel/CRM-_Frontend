import { Suspense } from 'react';
import { InsuranceInsurerDetail } from '@/features/verticals/insurance/insurance/screens/insurer-detail';

// Next 15 hands dynamic segments to the page as a promise.
export default async function InsuranceInsurerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    // The screen reads `?tab=` with useSearchParams, which needs a boundary.
    <Suspense fallback={null}>
      <InsuranceInsurerDetail id={id} />
    </Suspense>
  );
}
