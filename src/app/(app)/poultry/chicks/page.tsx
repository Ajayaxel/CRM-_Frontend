import { Suspense } from 'react';
import { PoultryChicks } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryChicks />
    </Suspense>
  );
}
