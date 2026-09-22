import { Suspense } from 'react';
import { PoultryFarmers } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryFarmers />
    </Suspense>
  );
}
