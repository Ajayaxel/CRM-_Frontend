import { Suspense } from 'react';
import { RestaurantOrder } from '@/features/verticals/restaurant/restaurant';

// useSearchParams needs a Suspense boundary in the app router.
export default function RestaurantOrderPage() {
  return (
    <Suspense fallback={null}>
      <RestaurantOrder />
    </Suspense>
  );
}
