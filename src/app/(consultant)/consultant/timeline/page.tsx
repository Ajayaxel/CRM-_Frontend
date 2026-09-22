import { Suspense } from 'react';
import { TimelineScreen } from '@/features/verticals/consulting/consultant';

export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <TimelineScreen />
    </Suspense>
  );
}
