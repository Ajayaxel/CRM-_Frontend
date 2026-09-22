import { Suspense } from 'react';
import { PoultryBatchDetail } from '@/features/verticals/poultry/poultry/screens/batch-detail';

// Next 15 hands dynamic segments to the page as a promise.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <PoultryBatchDetail id={id} />
    </Suspense>
  );
}
