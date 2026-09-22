import { Suspense } from 'react';
import { CoworkingServices } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingServices />
    </Suspense>
  );
}
