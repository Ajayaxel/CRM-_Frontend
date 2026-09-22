import { Suspense } from 'react';
import { CoworkingReports } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingReports />
    </Suspense>
  );
}
