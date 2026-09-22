import { Suspense } from 'react';
import { CoworkingMemberships } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingMemberships />
    </Suspense>
  );
}
