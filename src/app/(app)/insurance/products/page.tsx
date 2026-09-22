import { Suspense } from 'react';
import { InsuranceProducts } from '@/features/verticals/insurance/insurance/screens/products';

export default function InsuranceProductsPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceProducts />
    </Suspense>
  );
}
