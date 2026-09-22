import { Suspense } from 'react';
import { CoworkingCustomers } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingCustomers />
    </Suspense>
  );
}
