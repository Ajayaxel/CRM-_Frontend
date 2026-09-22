import { Suspense } from 'react';
import { PoultryInventory } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryInventory />
    </Suspense>
  );
}
