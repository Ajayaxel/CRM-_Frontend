import { Suspense } from 'react';
import { InsuranceAgents } from '@/features/verticals/insurance/insurance/screens/agents';

export default function InsuranceAgentsPage() {
  return (
    <Suspense fallback={null}>
      <InsuranceAgents />
    </Suspense>
  );
}
