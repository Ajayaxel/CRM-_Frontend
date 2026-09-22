import { Suspense } from 'react';
import { PoultryStalls } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryStalls />
    </Suspense>
  );
}
