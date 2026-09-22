import { Suspense } from 'react';
import { CoworkingBilling } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingBilling />
    </Suspense>
  );
}
