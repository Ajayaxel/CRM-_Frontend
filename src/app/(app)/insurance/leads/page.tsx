import { Suspense } from 'react';
import { InsuranceLeads } from '@/features/verticals/insurance/insurance/screens/leads';

export default function InsuranceLeadsPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceLeads />
    </Suspense>
  );
}
