'use client';

import { useMemo } from 'react';
import { useOrgUsers, useTeam } from '../api';
import type { PersonOption } from '../ui/cells';

/**
 * Everyone who can be assigned work, annotated with their current load.
 *
 * The load figure is what turns a people picker into a decision aid rather than
 * a list of names (spec §14). Workload comes from the same endpoint the Team
 * screen uses, so the number in the picker and the number in the table agree.
 */
export function usePeople(verticalId?: string): PersonOption[] {
  const { data: users = [] } = useOrgUsers();
  const { data: workload = [] } = useTeam(verticalId);

  return useMemo(() => {
    const load = new Map(workload.map((w) => [w.user.id, w]));
    return users
      .map((u) => ({
        id: u.id,
        name: u.name,
        role: load.get(u.id)?.role ?? u.role ?? null,
        activeTasks: load.get(u.id)?.activeTasks,
      }))
      // Busiest last is unhelpful; alphabetical keeps the list predictable and
      // the load figure does the ranking work.
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, workload]);
}
