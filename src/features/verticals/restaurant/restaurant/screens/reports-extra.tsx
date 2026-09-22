'use client';

/**
 * The other two reports the source has: `Reports/CancelledOrders` and
 * `Reports/StockReport`.
 *
 * Like the sales report beside them, both are derived on the client. There is
 * no reporting endpoint on either system, so the window is bounded by what the
 * list returns rather than by a date range a server understands, and that bound
 * is stated on screen instead of hidden.
 *
 * TWO OF THE SOURCE'S SIX CANCELLED-ORDER COLUMNS CANNOT BE FILLED.
 *
 * `Reports/CancelledOrders.vue` shows Order ID, Branch, Cancel Reason,
 * Cancelled By, Total and Timestamp. `RstOrder` has no cancellation columns at
 * all — only `status`. The `cancellation_reason` and `cancelled_by_user_id`
 * columns in this schema belong to `RstTable`, which is a different thing being
 * cancelled. So the two columns are absent and the screen says why, rather than
 * rendering two empty ones and letting a reader assume nobody filled them in.
 *
 * And the action behind the report does not work on either system: cancelling
 * an order answers 500 on the source and on the port alike — RST-PARITY-019,
 * still OPEN — so this table is expected to be empty on a healthy tenant. It is
 * kept for the same reason the sales report keeps its always-empty top-seller
 * table: deleting it would hide a real product gap behind a tidier screen.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, PackageOpen } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, DataTable, EmptyState, Skeleton, StatCard, money } from '../ui/kit';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { LoadFailed } from '../ui/load-state';
import { ReportTabs } from '../ui/report-tabs';
import { orders as ordersApi, inventory as inventoryApi, rstNum } from '../restaurant-client';
import type { RstOrderRow, RstIngredientRow } from '../restaurant-client';

/** The same spellings the sales report excludes, so the two agree. */
const CANCELLED = new Set(['cancelled', 'canceled', 'void', 'voided']);

export function RestaurantCancelledOrdersReport() {
  const { data: all = [], isLoading, error } = useQuery({
    queryKey: ['rst', 'orders', 'reports'],
    queryFn: () => ordersApi.allList(),
  });

  const cancelled = useMemo(
    () => all.filter((o) => CANCELLED.has((o.status ?? '').toLowerCase())),
    [all],
  );
  const value = cancelled.reduce((s, o) => s + rstNum(o.total), 0);

  const columns: DataTableColumn<RstOrderRow>[] = [
    { key: 'reference_no', header: 'Order', sortable: true, render: (o) => o.reference_no || o.id },
    { key: 'branch', header: 'Branch', render: (o) => o.branch?.name ?? '—' },
    { key: 'status', header: 'Status', width: 120, render: (o) => o.status ?? '—' },
    { key: 'total', header: 'Total', align: 'right', width: 120, render: (o) => money(rstNum(o.total)) },
    {
      key: 'created_at', header: 'Timestamp', width: 190,
      render: (o) => (o.created_at ? new Date(o.created_at).toLocaleString() : '—'),
    },
  ];

  return (
    <RestaurantPage
      title="Cancelled orders"
      subtitle="Derived from the order list — there is no reporting endpoint behind this yet."
      actions={<ReportTabs />}
    >
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Cancelled" value={isLoading ? '—' : cancelled.length} tone="neutral" icon={Ban} />
        <StatCard label="Value" value={isLoading ? '—' : money(value)} tone="neutral" icon={Ban} />
      </div>

      <Card pad={0}>
        {error ? (
          <LoadFailed what="orders" />
        ) : isLoading ? (
          <Skeleton rows={5} height={44} />
        ) : (
          <DataTable
            rows={cancelled}
            columns={columns}
            rowKey={(o) => o.id}
            empty={<EmptyState icon={Ban} title="No cancelled orders" compact />}
          />
        )}
      </Card>

      <p className="ds-caption rst-footnote">
        The source&rsquo;s version of this report also shows a cancel reason and who cancelled the
        order. Neither is a column on an order — the cancellation fields in this schema belong to a
        TABLE, which is a different thing being cancelled — so they are left out rather than shown
        empty. Expect this table to stay empty in any case: cancelling an order answers 500 on both
        systems (RST-PARITY-019, open), so orders do not reach a cancelled status through the
        supported path.
      </p>
    </RestaurantPage>
  );
}

export function RestaurantStockReport() {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['rst', 'ingredients'],
    queryFn: () => inventoryApi.ingredients() as Promise<RstIngredientRow[]>,
  });

  const out = rows.filter((r) => rstNum(r.quantity) <= 0);

  const columns: DataTableColumn<RstIngredientRow>[] = [
    { key: 'name', header: 'Ingredient', sortable: true, render: (r) => r.name },
    { key: 'branch', header: 'Branch', render: (r) => r.branch?.name ?? '—' },
    {
      key: 'quantity', header: 'Current stock', align: 'right', width: 150,
      // `quantity` is the stock on hand and arrives as a decimal STRING; the
      // separate `stock` field on the same row is not it.
      render: (r) => `${rstNum(r.quantity)}${r.unit?.symbol ? ` ${r.unit.symbol}` : ''}`,
    },
    {
      key: 'status', header: 'Status', width: 130,
      render: (r) => (rstNum(r.quantity) > 0
        ? <Status tone="active">In stock</Status>
        : <Status tone="neutral">Out of stock</Status>),
    },
  ];

  return (
    <RestaurantPage
      title="Stock report"
      subtitle="Ingredient stock on hand, as the inventory list reports it."
      actions={<ReportTabs />}
    >
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Ingredients" value={isLoading ? '—' : rows.length} tone="info" icon={PackageOpen} />
        <StatCard
          label="Out of stock"
          value={isLoading ? '—' : out.length}
          tone={out.length ? 'renewal' : 'neutral'}
          icon={PackageOpen}
        />
      </div>

      <Card pad={0}>
        {error ? (
          <LoadFailed what="ingredients" />
        ) : isLoading ? (
          <Skeleton rows={5} height={44} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            empty={<EmptyState icon={PackageOpen} title="No ingredients yet" compact />}
          />
        )}
      </Card>

      <p className="ds-caption rst-footnote">
        Status is in-stock or out-of-stock only. A &ldquo;low stock&rdquo; band would need a reorder
        threshold per ingredient, and no such column exists on either system — so no third state is
        invented here. Stock is configuration on this surface: nothing in the port moves it
        automatically (RST-PARITY-001 → A).
      </p>
    </RestaurantPage>
  );
}
