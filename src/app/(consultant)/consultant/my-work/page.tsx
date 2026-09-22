import { Suspense } from 'react';
import { MyWorkScreen } from '@/features/verticals/consulting/consultant';

export default function MyWorkPage() {
  return (
    <Suspense fallback={null}>
      <MyWorkScreen />
    </Suspense>
  );
}
