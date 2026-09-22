import { Suspense } from 'react';
import { PoultryAlerts } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryAlerts />
    </Suspense>
  );
}
