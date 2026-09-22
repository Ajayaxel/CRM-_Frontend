import { Suspense } from 'react';
import { PoultryFarms } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryFarms />
    </Suspense>
  );
}
