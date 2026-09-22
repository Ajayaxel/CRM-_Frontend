import { Suspense } from 'react';
import { PoultryParties } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryParties />
    </Suspense>
  );
}
