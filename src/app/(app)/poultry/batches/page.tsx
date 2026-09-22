import { Suspense } from 'react';
import { PoultryBatches } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryBatches />
    </Suspense>
  );
}
