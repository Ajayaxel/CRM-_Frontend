import { Suspense } from 'react';
import { PoultryBatchStatement } from '@/features/verticals/poultry/poultry/screens/batch-statement';

// Next 15 hands dynamic segments to the page as a promise.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <PoultryBatchStatement id={id} />
    </Suspense>
  );
}
