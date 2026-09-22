import { Suspense } from 'react';
import { PoultrySettings } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultrySettings />
    </Suspense>
  );
}
