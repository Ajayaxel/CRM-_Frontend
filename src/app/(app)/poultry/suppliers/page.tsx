import { Suspense } from 'react';
import { PoultrySuppliers } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultrySuppliers />
    </Suspense>
  );
}
