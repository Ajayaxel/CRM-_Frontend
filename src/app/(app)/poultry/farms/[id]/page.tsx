import { Suspense } from 'react';
import { PoultryFarmDetail } from '@/features/verticals/poultry/poultry/screens/farm-detail';

// Next 15 hands dynamic segments to the page as a promise.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <PoultryFarmDetail id={id} />
    </Suspense>
  );
}
