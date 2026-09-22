'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DailyLiveScreen } from '@/features/verticals/poultry/poultry';

function Inner() {
  const params = useSearchParams();
  return <DailyLiveScreen initialBatchId={params.get('batch') ?? undefined} />;
}

export default function DailyLivePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
