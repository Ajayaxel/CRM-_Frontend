import { Suspense } from 'react';
import { DocumentsScreen } from '@/features/verticals/consulting/consultant';

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsScreen />
    </Suspense>
  );
}
