import { Suspense } from 'react';
import { CalendarScreen } from '@/features/verticals/consulting/consultant';

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarScreen />
    </Suspense>
  );
}
