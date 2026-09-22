import { Suspense } from 'react';
import { PoultryFeed } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryFeed />
    </Suspense>
  );
}
