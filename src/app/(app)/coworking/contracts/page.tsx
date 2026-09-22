import { Suspense } from 'react';
import { CoworkingContracts } from '@/features/verticals/coworking/coworking';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CoworkingContracts />
    </Suspense>
  );
}
