import { Suspense } from 'react';
import { PoultryDashboard } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryDashboard />
    </Suspense>
  );
}
