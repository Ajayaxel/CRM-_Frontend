import { Suspense } from 'react';
import { PoultryReports } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryReports />
    </Suspense>
  );
}
