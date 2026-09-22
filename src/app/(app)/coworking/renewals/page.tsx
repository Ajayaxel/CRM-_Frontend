import { Suspense } from 'react';
import { CoworkingRenewals } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingRenewals />
    </Suspense>
  );
}
