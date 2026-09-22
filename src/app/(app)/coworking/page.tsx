import { Suspense } from 'react';
import { CoworkingDashboard } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingDashboard />
    </Suspense>
  );
}
