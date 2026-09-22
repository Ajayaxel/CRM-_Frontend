import { Suspense } from 'react';
import { InsuranceClaimDetail } from '@/features/verticals/insurance/insurance/screens/claim-detail';

export default async function InsuranceClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <InsuranceClaimDetail id={id} />
    </Suspense>
  );
}
