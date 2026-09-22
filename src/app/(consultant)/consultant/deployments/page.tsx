import { Suspense } from 'react';
import { DeploymentsScreen } from '@/features/verticals/consulting/consultant';

export default function DeploymentsPage() {
  return (
    <Suspense fallback={null}>
      <DeploymentsScreen />
    </Suspense>
  );
}
