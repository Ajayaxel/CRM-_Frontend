import { Suspense } from 'react';
import { TeamScreen } from '@/features/verticals/consulting/consultant';

export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <TeamScreen />
    </Suspense>
  );
}
