import { Suspense } from 'react';
import { PoultryExpenses } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryExpenses />
    </Suspense>
  );
}
