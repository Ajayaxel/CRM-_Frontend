'use client';

/**
 * Reports — Figma 124:2382 (light) / 128:10157 (dark).
 *
 * THERE IS NO REPORTS ENDPOINT. The port exposes orders, ingredients, seating,
 * menu, POS sessions and settings; nothing aggregates. So every figure here is
 * derived on the client from the order list, and the window is bounded by what
 * that list returns rather than by a date range the server understands.
 *
 * That bound is stated on screen rather than hidden. A "Total sales" that
 * silently covers only the most recent page of orders is the kind of number
 * somebody quotes in a meeting, and it would be wrong.
 *
 * The frame's "+12% from yesterday" deltas are omitted throughout for the same
 * reason as the Home tiles: there is no prior-period figure to compare against,
 * and a fabricated one is worse than none.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Receipt, TrendingUp, Trophy } from 'lucide-react';
import { RestaurantPage, RestaurantSection } from '../ui/page-shell';
import { BarList, Card, DataTable, EmptyState, Skeleton, StatCard, money } from '../ui/kit';
import { ReportTabs } from '../ui/report-tabs';
import type { DataTableColumn } from '../ui/kit';
import { orders as ordersApi, rstNum } from '../restaurant-client';
import { LoadFailed } from '../ui/load-state';
import type { RstOrderRow } from '../restaurant-client';

const WINDOWS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const;

const CANCELLED = new Set(['cancelled', 'void', 'voided']);

export function RestaurantReports() {
  const [days, setDays] = useState<number>(7);

  // 500 is the ceiling this screen reads. Stated below the tiles, because the
  // difference between "all sales" and "the last 500 orders" matters.

  const { data: all = [], isLoading, error: loadError } = useQuery({
    queryKey: ['rst', 'orders', 'reports'],
    queryFn: () => ordersApi.allList(),
  });

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d.getTime();
  }, [days]);

  const inWindow = useMemo(() => all.filter((o) => {
    if (CANCELLED.has((o.status ?? '').toLowerCase())) return false;
    if (!o.created_at) return false;
    const t = new Date(o.created_at).getTime();
    return !Number.isNaN(t) && t >= since;
  }), [all, since]);

  const revenue = inWindow.reduce((s, o) => s + rstNum(o.total), 0);
  const avg = inWindow.length ? revenue / inWindow.length : 0;

  /** Day-by-day takings across the window, oldest first. */
  const daily = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.set(d.toDateString(), 0);
    }
    for (const o of inWindow) {
      const key = new Date(o.created_at!).toDateString();
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + rstNum(o.total));
    }
    return [...buckets.entries()].map(([k, v]) => ({
      label: new Date(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      value: Math.round(v),
    }));
  }, [inWindow, days]);

  /**
   * Top sellers, by quantity across every line in the window.
   *
   * ALWAYS EMPTY from this data, and deliberately kept rather than deleted.
   * `GET /orders` loads branch, user, discount and customer — the source's own
   * relation set — and NOT items, so `o.items` is undefined on every row here.
   * The "Top seller" tile read `—` and this table read "No item lines in this
   * window" for a tenant with six orders and lines on all of them.
   *
   * Deleting it would hide a real product gap behind a tidier screen. It stays,
   * with the footnote saying what it needs: an endpoint that returns lines, or
   * an item count on the order list. Both are backend work the source does not
   * do either, so inventing one here would be the port disagreeing with itself.
   */
  const topItems = useMemo(() => {
    const agg = new Map<string, { name: string; qty: number; amount: number }>();
    for (const o of inWindow) {
      for (const li of o.items ?? []) {
        const name = li.name ?? 'Unnamed item';
        const cur = agg.get(name) ?? { name, qty: 0, amount: 0 };
        cur.qty += li.quantity ?? 0;
        cur.amount += li.total != null ? rstNum(li.total) : rstNum(li.unit_price) * (li.quantity ?? 0);
        agg.set(name, cur);
      }
    }
    return [...agg.values()].sort((a, b) => b.qty - a.qty);
  }, [inWindow]);

  /** Order-type mix — the frame draws a payment donut, but payment method is
      not on the order list response; order type is. */
  const typeMix = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of inWindow) {
      const k = (o.order_type ?? 'unknown').toLowerCase().replace(/_/g, ' ');
      m.set(k, (m.get(k) ?? 0) + rstNum(o.total));
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [inWindow]);

  const columns: DataTableColumn<{ name: string; qty: number; amount: number }>[] = [
    { key: 'name', header: 'Item', sortable: true, render: (r) => r.name },
    { key: 'qty', header: 'Sold', align: 'right', width: 90, sortable: true, render: (r) => r.qty },
    { key: 'amount', header: 'Revenue', align: 'right', width: 130, render: (r) => money(r.amount) },
  ];

  return (
    <RestaurantPage
      title="Reports"
      subtitle="Derived from the order list — there is no reporting endpoint behind this yet."
      actions={
        <>
        <ReportTabs />
        <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Reporting window">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              role="tab"
              aria-selected={days === w.days}
              className={`rst-seg-item${days === w.days ? ' is-on' : ''}`}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </button>
          ))}
        </div>
        </>
      }
    >
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Revenue" value={isLoading ? '—' : money(revenue)}
          hint={isLoading ? undefined : 'Excludes cancelled orders'} tone="sales" icon={TrendingUp} />
        <StatCard label="Orders" value={isLoading ? '—' : inWindow.length}
          hint={isLoading ? undefined : `In the last ${days} days`} tone="info" icon={Receipt} />
        <StatCard label="Average order" value={isLoading ? '—' : money(avg)}
          hint={isLoading ? undefined : 'Revenue ÷ orders'} tone="neutral" icon={BarChart3} />
        <StatCard label="Top seller" value={isLoading ? '—' : (topItems[0]?.name ?? '—')}
          hint={isLoading ? undefined : topItems[0] ? `${topItems[0].qty} sold` : 'Order list carries no lines'}
          tone="active" icon={Trophy} />
      </div>

      <div className="rst-home-split">
        <RestaurantSection title="Daily takings">
          {loadError ? <LoadFailed what="the order history" />
            : isLoading ? <Skeleton rows={3} height={40} />
            : daily.every((d) => d.value === 0)
              ? <EmptyState icon={BarChart3} title="No takings in this window" compact />
              : <BarList items={daily} format={money} />}
        </RestaurantSection>

        <RestaurantSection title="By order type">
          {loadError ? <LoadFailed what="the order history" />
            : isLoading ? <Skeleton rows={3} height={34} />
            : typeMix.length === 0
              ? <EmptyState icon={Receipt} title="Nothing to split" compact />
              : <BarList items={typeMix} format={money} />}
        </RestaurantSection>
      </div>

      <RestaurantSection title="Top selling items">
        {loadError ? <LoadFailed what="the order history" />
          : isLoading ? <Skeleton rows={4} height={40} /> : (
          <DataTable
            rows={topItems.slice(0, 15)}
            columns={columns}
            rowKey={(r) => r.name}
            empty={(
              <EmptyState
                icon={Trophy}
                title="The order list does not carry item lines"
                body="Not an empty window — see the note below."
                compact
              />
            )}
          />
        )}
      </RestaurantSection>

      <p className="ds-caption rst-footnote">
        These figures are computed in the browser from every page of the order list, then filtered
        to the selected window. The list paginates at ten and ignores `per_page` — that is the
        source's behaviour, not a limit of this screen — so a long history means many requests, and
        the client stops at fifty pages and says so in the console rather than quietly reporting a
        partial total. The designs also show a payment-method breakdown and “vs yesterday” deltas;
        payment method is not on the order list response and no prior-period figure exists, so
        neither is shown rather than estimated. A real reporting endpoint would fix all of it.
      </p>
    </RestaurantPage>
  );
}
