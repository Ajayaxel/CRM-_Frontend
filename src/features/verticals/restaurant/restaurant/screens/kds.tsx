'use client';

/**
 * Kitchen display — Figma 114:1503 (light) / 114:2071 (dark).
 *
 * The in-house board. Tickets are columns of KOT lines; the filter row is
 * All / Cooking / Completed / Pending plus a Dine-in / Delivery split, exactly
 * as the frame draws it.
 *
 * It speaks the WEB vocabulary — pending|cooking|completed — because that is
 * what /restaurant/kitchen-view puts on the wire. It does no translating: the
 * API owns the mapping onto the stored canonical five (RST-PARITY-005), and a
 * second mapping here is how the two would drift apart again.
 *
 * A ticket in `accepted` or `dispatched` never appears. That is not a gap to
 * fill — the source web KDS could not render those states either.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Soup } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, EmptyState, Skeleton } from '../ui/kit';
import { apiErrorMessage } from '@/lib/api';
import { LoadFailed } from '../ui/load-state';
import { kitchen } from '../restaurant-client';
import { KdsBoard } from '../components/kds-board';
import { WEB_ACTION_LABEL, nextWebStatus } from '../ui/kds';
import type { KdsTicket } from '../ui/kds';

const FILTERS = ['All', 'Pending', 'Cooking', 'Completed'] as const;
const SERVICE = ['All', 'Dine in', 'Delivery'] as const;

export function RestaurantKds() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('All');
  const [service, setService] = useState<string>('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['rst', 'kds', 'web'],
    queryFn: () => kitchen.view(),
    // A kitchen board that lags is worse than no board.
    refetchInterval: 15_000,
  });

  /**
   * `/kitchen-view` answers an OBJECT — `{orders, selectedBranchId}` — where
   * `/captain/kds` answers a bare array. The two boards read different
   * endpoints and the source shapes them differently, which is preserved.
   *
   * This screen was written with the captain board's assumption:
   * `Array.isArray(data) ? data : []`. The object never passed that test, so
   * the pass was permanently clear — the kitchen board could not show a ticket
   * at all, however many were waiting. Found on the screen walk with one seeded
   * ticket that the API was returning correctly the whole time.
   */
  const tickets: KdsTicket[] = Array.isArray(data)
    ? (data as KdsTicket[])
    : (((data as { orders?: KdsTicket[] } | undefined)?.orders) ?? []);

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      // The web surface identifies the order in the BODY, not the path, and
      // validates order_id as `exists:orders,id` — a bad id is a 422, not a 404.
      kitchen.changeStatus({ order_id: id, status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rst', 'kds', 'web'] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const shown = useMemo(() => tickets.filter((t) => {
    if (filter !== 'All' && (t.status ?? '').toLowerCase() !== filter.toLowerCase()) return false;
    if (service !== 'All') {
      const type = (t.type ?? '').toLowerCase().replace(/[_-]/g, ' ');
      if (!type.includes(service.toLowerCase())) return false;
    }
    return true;
  }), [tickets, filter, service]);

  return (
    <RestaurantPage
      title="Kitchen"
      subtitle="Every open ticket in the branch. Tickets are not routed per kitchen — that is configuration only."
    >
      <Card pad={14}>
        <div className="rst-filters">
          <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Ticket status">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`rst-seg-item${filter === f ? ' is-on' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Service type">
            {SERVICE.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={service === s}
                className={`rst-seg-item${service === s ? ' is-on' : ''}`}
                onClick={() => setService(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="ds-caption rst-filter-count">
            {isLoading ? '' : `${shown.length} ticket${shown.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </Card>

      {error ? (
        /* A board that renders "the pass is clear" when the API is down is the
           most dangerous empty state in this vertical: the kitchen believes
           there is nothing to cook. */
        <Card pad={0}><LoadFailed what="the kitchen board" /></Card>
      ) : isLoading ? (
        <Skeleton rows={3} height={200} />
      ) : shown.length === 0 ? (
        <Card pad={0}>
          <EmptyState
            icon={Soup}
            title={tickets.length ? 'Nothing matches these filters' : 'The pass is clear'}
            body={tickets.length ? undefined : 'New tickets appear here the moment they are sent to the kitchen.'}
          />
        </Card>
      ) : (
        <KdsBoard
          tickets={shown}
          busyId={advance.isPending ? advance.variables?.id : undefined}
          nextFor={(t) => {
            const next = nextWebStatus(t.status);
            return next ? { label: WEB_ACTION_LABEL[next] ?? next, run: () => advance.mutate({ id: t.id, status: next }) } : null;
          }}
        />
      )}
    </RestaurantPage>
  );
}
