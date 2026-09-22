import { Suspense } from 'react';
import { InsuranceClients } from '@/features/verticals/insurance/insurance/screens/clients';

export default function InsuranceClientsPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceClients />
    </Suspense>
  );
}
