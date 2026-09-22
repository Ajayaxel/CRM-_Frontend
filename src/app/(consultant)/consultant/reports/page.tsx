import { Suspense } from 'react';
import { ReportsScreen } from '@/features/verticals/consulting/consultant';

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsScreen />
    </Suspense>
  );
}
