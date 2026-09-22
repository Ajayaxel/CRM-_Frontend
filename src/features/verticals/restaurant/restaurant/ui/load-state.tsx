'use client';

/**
 * "This did not load" — as distinct from "there is nothing here".
 *
 * Every restaurant screen but one destructured `{ data = [] }` from its query
 * and nothing else, so a failed request produced an empty array and rendered
 * the empty state. The menu list 422'd on a query parameter for weeks' worth of
 * commits and showed "No menu items yet"; the home screen's order list did the
 * same and reported "No orders yet today" for a tenant that had orders.
 *
 * An empty state is a claim about the DATA. Making it also the failure state
 * turns every outage into a lie about the tenant's business, and the person
 * reading it has no way to tell the difference. Anything that renders a list
 * from a query should render this instead when the query failed.
 */

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { EmptyState } from './kit';

export function LoadFailed({
  what, hint,
}: {
  /** What could not be loaded, lower case: "menu items", "the order history". */
  what: string;
  /** What still works, when something does. Reassurance beats an error code. */
  hint?: string;
}) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title={`Could not load ${what}`}
      body={hint ?? 'The request failed. Reload to try again.'}
    />
  );
}
