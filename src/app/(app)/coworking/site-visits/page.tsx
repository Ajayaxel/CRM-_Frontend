import { Suspense } from 'react';
import { CoworkingSiteVisits } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingSiteVisits />
    </Suspense>
  );
}
