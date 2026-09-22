import { Suspense } from 'react';
import { PoultryCalendar } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryCalendar />
    </Suspense>
  );
}
