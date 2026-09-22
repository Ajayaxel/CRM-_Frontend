import { Suspense } from 'react';
import { VerticalsScreen } from '@/features/verticals/consulting/consultant';

export default function VerticalsPage() {
  return (
    <Suspense fallback={null}>
      <VerticalsScreen />
    </Suspense>
  );
}
