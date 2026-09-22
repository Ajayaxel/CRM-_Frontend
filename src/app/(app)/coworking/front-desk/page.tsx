import { Suspense } from 'react';
import { CoworkingFrontDesk } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingFrontDesk />
    </Suspense>
  );
}
