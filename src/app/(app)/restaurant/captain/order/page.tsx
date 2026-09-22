import { Suspense } from 'react';
import { CaptainOrder } from '@/features/verticals/restaurant/restaurant';

export default function CaptainOrderPage() {
  return (
    <Suspense fallback={null}>
      <CaptainOrder />
    </Suspense>
  );
}
