import { Suspense } from 'react';
import { ActivityScreen } from '@/features/verticals/consulting/consultant';

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityScreen />
    </Suspense>
  );
}
