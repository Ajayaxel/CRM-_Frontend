import { Suspense } from 'react';
import { PoultryPickups } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryPickups />
    </Suspense>
  );
}
