import { Suspense } from 'react';
import { PoultryMoney } from '@/features/verticals/poultry/poultry';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoultryMoney />
    </Suspense>
  );
}
