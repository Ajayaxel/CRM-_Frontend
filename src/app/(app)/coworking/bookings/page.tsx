import { Suspense } from 'react';
import { CoworkingBookings } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingBookings />
    </Suspense>
  );
}
