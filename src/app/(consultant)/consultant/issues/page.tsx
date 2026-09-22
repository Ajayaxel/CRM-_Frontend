import { Suspense } from 'react';
import { IssuesScreen } from '@/features/verticals/consulting/consultant';

export default function IssuesPage() {
  return (
    <Suspense fallback={null}>
      <IssuesScreen />
    </Suspense>
  );
}
