import { Suspense } from 'react';
import { CoworkingFloorPlan } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingFloorPlan />
    </Suspense>
  );
}
