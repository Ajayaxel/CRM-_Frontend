'use client';

/**
 * Captain / online-orders board — Figma 176:579 (light) / 178:1323 (dark).
 *
 * The frame splits tickets by channel (Swiggy / Zomato / Our Own) and adds a
 * dispatch step the in-house board does not have: Accept order → Mark ready →
 * Dispatch. It speaks the CANONICAL vocabulary, because that is what
 * /restaurant/captain/kds puts on the wire.
 *
 * TWO THINGS IN THE FRAME HAVE NO BACKING, and are not faked here:
 *
 *  · CHANNEL. The frame's Swiggy / Zomato / Our Own tabs imply an aggregator
 *    field on the ticket. `kdsOrders` returns id, number, time, type, table,
 *    status, branch_id, items and notes — there is no channel. `RstDeliveryOrder`
 *    exists as a model but the KDS query does not join it. So the tabs filter on
 *    order TYPE, which is real, and the channel tabs are not drawn as if they
 *    worked. Wiring them means widening kdsOrders, which is a backend change.
 *  · OTP and ETA. Drawn on every card in the frame; neither is in the response
 *    nor on RstOrder. Omitted rather than mocked — a rider OTP that is actually
 *    a placeholder is worse than an absent one.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bike, Truck } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, EmptyState, Skeleton } from '../ui/kit';
import { LoadFailed } from '../ui/load-state';
import { apiErrorMessage } from '@/lib/api';
import { kitchen } from '../restaurant-client';
import { KdsBoard } from '../components/kds-board';
import { CAPTAIN_ACTION_LABEL, nextCaptainStatus } from '../ui/kds';
import type { KdsTicket } from '../ui/kds';

const TYPES = ['All', 'Dine in', 'Takeaway', 'Delivery'] as const;

export function RestaurantKdsOnline() {
  const qc = useQueryClient();
  const [type, setType] = useState<string>('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['rst', 'kds', 'captain'],
    queryFn: () => kitchen.captainKds(),
    refetchInterval: 15_000,
  });

  const tickets: KdsTicket[] = Array.isArray(data) ? (data as KdsTicket[]) : [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rst', 'kds', 'captain'] });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      kitchen.captainChangeStatus(id, { kitchen_status: status }),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Dispatch is its OWN endpoint, not a value passed to /status.
  const dispatch = useMutation({
    mutationFn: (id: string) => kitchen.captainDispatch(id),
    onSuccess: () => { toast.success('Order dispatched'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const shown = useMemo(() => tickets.filter((t) => {
    if (type === 'All') return true;
    const k = (t.type ?? '').toLowerCase().replace(/[_-]/g, ' ');
    return k.includes(type.toLowerCase());
  }), [tickets, type]);

  return (
    <RestaurantPage
      title="Online orders"
      subtitle="Accept, cook and dispatch. Delivery-partner channels are not yet on the ticket — see the note below."
    >
      <Card pad={14}>
        <div className="rst-filters">
          <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Order type">
            {TYPES.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={type === t}
                className={`rst-seg-item${type === t ? ' is-on' : ''}`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="ds-caption rst-filter-count">
            {isLoading ? '' : `${shown.length} ticket${shown.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </Card>

      {error ? (
        <Card pad={0}><LoadFailed what="the online board" /></Card>
      ) : isLoading ? (
        <Skeleton rows={3} height={200} />
      ) : shown.length === 0 ? (
        <Card pad={0}>
          <EmptyState icon={Bike} title="No online orders right now" />
        </Card>
      ) : (
        <KdsBoard
          tickets={shown}
          busyId={advance.isPending ? advance.variables?.id : dispatch.isPending ? dispatch.variables : undefined}
          nextFor={(t) => {
            const next = nextCaptainStatus(t.status);
            return next
              ? { label: CAPTAIN_ACTION_LABEL[next] ?? next, run: () => advance.mutate({ id: t.id, status: next }) }
              : null;
          }}
          extraActions={(t) =>
            // Only an accepted ticket can be dispatched; before that the button
            // would post a step the kitchen has not reached.
            (t.status ?? '').toLowerCase() === 'accepted' ? (
              <button
                className="btn-secondary btn-sm"
                disabled={dispatch.isPending}
                onClick={() => dispatch.mutate(t.id)}
              >
                <Truck size={14} /> Dispatch
              </button>
            ) : null
          }
        />
      )}

      <p className="ds-caption rst-footnote">
        The designs split this board by delivery partner (Swiggy, Zomato, own fleet) and show a
        rider OTP and ETA on each card. None of the three is on the KDS response or on the order
        model today, so the tabs above filter by order type instead and no OTP is shown. Wiring
        the partner channel means widening the KDS query to join delivery orders.
      </p>
    </RestaurantPage>
  );
}
