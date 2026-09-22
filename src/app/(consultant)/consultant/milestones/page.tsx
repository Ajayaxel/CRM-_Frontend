import { Suspense } from 'react';
import { MilestonesScreen } from '@/features/verticals/consulting/consultant';

export default function MilestonesPage() {
  return (
    <Suspense fallback={null}>
      <MilestonesScreen />
    </Suspense>
  );
}
