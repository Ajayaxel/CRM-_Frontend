import { Suspense } from 'react';
import { CoworkingPlans } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingPlans />
    </Suspense>
  );
}
