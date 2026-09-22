import { Suspense } from 'react';
import { SearchScreen } from '@/features/verticals/consulting/consultant';

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchScreen />
    </Suspense>
  );
}
