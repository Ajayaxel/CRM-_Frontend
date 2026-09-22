import { Suspense } from 'react';
import { HomeScreen } from '@/features/verticals/consulting/consultant';

export default function ConsultantHomePage() {
  return (
    <Suspense fallback={null}>
      <HomeScreen />
    </Suspense>
  );
}
