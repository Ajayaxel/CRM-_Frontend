import { Suspense } from 'react';
import { PoultrySettlements } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultrySettlements />
    </Suspense>
  );
}
