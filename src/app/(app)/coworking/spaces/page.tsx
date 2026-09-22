import { Suspense } from 'react';
import { CoworkingSpaces } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingSpaces />
    </Suspense>
  );
}
