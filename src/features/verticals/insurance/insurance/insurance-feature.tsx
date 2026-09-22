'use client';

import { InsuranceDashboard } from './screens/dashboard';

/**
 * Compatibility shell. The broking console used to be one tabbed page here;
 * it is now real routed pages under /insurance/* (see lib/nav.ts). Anything
 * still importing `InsuranceFeature` lands on the dashboard.
 */
export function InsuranceFeature() {
  return <InsuranceDashboard />;
}
