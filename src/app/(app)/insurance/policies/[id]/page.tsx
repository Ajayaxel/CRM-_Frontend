import { Suspense } from 'react';
import { InsurancePolicyDetail } from '@/features/verticals/insurance/insurance/screens/policy-detail';

// Next 15 hands dynamic segments to the page as a promise.
export default async function InsurancePolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    // The screen reads `?tab=` with useSearchParams, which needs a boundary.
    <Suspense fallback={null}>
      <InsurancePolicyDetail id={id} />
    </Suspense>
  );
}
