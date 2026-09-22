'use client';

import { Suspense } from 'react';
import { TravelCrmWorkspace } from './travel-crm-workspace';

export type TravelTab = string;

interface Props {
  defaultTab?: string;
}

/**
 * The Suspense boundary is load-bearing, not decorative.
 *
 * TravelCrmWorkspace calls useSearchParams(), which opts a route out of static
 * prerendering unless it sits inside a boundary. Without one, `next build`
 * fails at export time — and it takes the WHOLE build with it, so every travel
 * page and every other vertical stops shipping too. Four web deploys failed on
 * exactly this while the API deployed fine beside them.
 *
 * It is fixed here rather than on the pages because all 23 travel routes render
 * this wrapper. `/travel/b2b` was merely the first one the exporter reached.
 */
export function TravelWorkspace({ defaultTab = 'cockpit' }: Props) {
  return (
    <Suspense fallback={null}>
      <TravelCrmWorkspace defaultTab={defaultTab} />
    </Suspense>
  );
}
