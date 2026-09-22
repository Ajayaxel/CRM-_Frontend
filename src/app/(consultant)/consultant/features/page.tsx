import { Suspense } from 'react';
import { FeaturesScreen } from '@/features/verticals/consulting/consultant';

export default function FeaturesPage() {
  return (
    <Suspense fallback={null}>
      <FeaturesScreen />
    </Suspense>
  );
}
