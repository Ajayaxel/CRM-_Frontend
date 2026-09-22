'use client';

/**
 * Inventory — Figma 94:548 (light) / 98:1280 (dark).
 *
 * Three KPI tiles over a table of ingredients with a stock status.
 *
 * TWO of the designed tiles cannot be computed from what the schema holds, and
 * neither is faked: "Inventory value" needs a unit cost that lives on purchase
 * lines rather than on the ingredient, and "Needs attention" needs a reorder
 * threshold that exists nowhere at all.
 *
 * "Inventory value" is the one tile in the frame with no source. Ingredients
 * carry a quantity; they do NOT carry a unit cost — cost lives
 * on purchase lines (RstPurchaseItem), and valuing stock properly means picking
 * a costing method (FIFO, weighted average, last cost) which is an accounting
 * decision nobody has made. Rather than multiply by a number that does not
 * exist, the third tile counts what is actually known: how many ingredients are
 * out of stock. The frame's figure would have been a plausible-looking lie in
 * the place a manager is most likely to trust it.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, PackageX, TriangleAlert } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, DataTable, EmptyState, Skeleton, StatCard, Status } from '../ui/kit';
import type { DataTableColumn, Tone } from '../ui/kit';
import { inventory, rstNum } from '../restaurant-client';
import { LoadFailed } from '../ui/load-state';
import type { RstIngredientRow } from '../restaurant-client';

type Level = 'out' | 'good' | 'untracked';

/**
 * What can honestly be said about stock, given what the schema holds.
 *
 * There is no per-ingredient threshold ANYWHERE — not on the target model, not
 * in the column mapping, and not on the source's `ingredients` table. This
 * screen used to read `i.threshold`, which meant every ingredient came back
 * "untracked" and the "Needs attention" tile could only ever show zero. The
 * nearest real concept is `branches.low_stock_alerts`, a boolean toggle with no
 * figure behind it: the feature is unbuilt in the source, not lost in the port.
 *
 * So the levels collapse to what `quantity` alone supports — on hand, none, or
 * not counted — and the footnote says why there is no reorder column, rather
 * than the screen implying one exists and is always satisfied.
 */
function levelOf(i: RstIngredientRow): Level {
  if (i.quantity == null) return 'untracked';
  // A decimal COLUMN, so it arrives as a string — `<= 0` on one works only by
  // coercion, which is not something to leave to the engine's rules.
  return rstNum(i.quantity) <= 0 ? 'out' : 'good';
}

const LEVEL: Record<Level, { label: string; tone: Tone }> = {
  out: { label: 'Out of stock', tone: 'expired' },
  good: { label: 'In stock', tone: 'active' },
  untracked: { label: 'Not counted', tone: 'neutral' },
};

const FILTERS = ['All', 'Out of stock', 'In stock', 'Not counted'] as const;

export function RestaurantInventory() {
  const [filter, setFilter] = useState<string>('All');

  const { data: rows = [], isLoading, error: loadError } = useQuery({
    queryKey: ['rst', 'ingredients'],
    queryFn: () => inventory.ingredients({ per_page: 500 }),
  });

  const levelled = useMemo(
    () => rows.map((r) => ({ row: r, level: levelOf(r) })),
    [rows],
  );

  const counted = levelled.filter((x) => x.level !== 'untracked');
  const out = levelled.filter((x) => x.level === 'out');
  const untracked = levelled.filter((x) => x.level === 'untracked');

  const shown = useMemo(() => levelled.filter((x) => {
    if (filter === 'Out of stock') return x.level === 'out';
    if (filter === 'In stock') return x.level === 'good';
    if (filter === 'Not counted') return x.level === 'untracked';
    return true;
  }), [levelled, filter]);

  const columns: DataTableColumn<{ row: RstIngredientRow; level: Level }>[] = [
    { key: 'name', header: 'Ingredient', sortable: true, render: (x) => x.row.name },
    {
      key: 'qty', header: 'On hand', align: 'right', width: 120,
      render: (x) => x.row.quantity == null ? '—' : `${x.row.quantity} ${x.row.unit?.name ?? ''}`.trim(),
    },
    {
      key: 'status', header: 'Status', width: 170,
      render: (x) => <Status tone={LEVEL[x.level].tone}>{LEVEL[x.level].label}</Status>,
    },
  ];

  return (
    <RestaurantPage
      title="Inventory"
      subtitle="What is on hand, and what has run out."
    >
      <div className="ds-grid ds-grid-kpi">
        <StatCard
          label="Tracked ingredients"
          value={isLoading ? '—' : rows.length}
          hint={isLoading ? undefined : `${untracked.length} with no count recorded`}
          tone="info"
          icon={Boxes}
        />
        <StatCard
          label="Counted"
          value={isLoading ? '—' : counted.length}
          hint={isLoading ? undefined : 'Carrying a quantity'}
          tone="neutral"
          icon={TriangleAlert}
        />
        <StatCard
          label="Out of stock"
          value={isLoading ? '—' : out.length}
          hint={isLoading ? undefined : 'On hand is zero or less'}
          tone={out.length ? 'expired' : 'neutral'}
          icon={PackageX}
        />
      </div>

      <Card pad={14}>
        <div className="rst-filters">
          <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Stock filter">
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
          <span className="ds-caption rst-filter-count">
            {isLoading ? '' : `${shown.length} of ${rows.length}`}
          </span>
        </div>
      </Card>

      {loadError ? (
        <LoadFailed what="the ingredient list" />
      ) : isLoading ? (
        <Skeleton rows={5} height={44} />
      ) : (
        <Card pad={0}>
          <DataTable
            rows={shown}
            columns={columns}
            rowKey={(x) => x.row.id}
            empty={<EmptyState icon={Boxes} title="Nothing here" compact />}
          />
        </Card>
      )}

      <p className="ds-caption rst-footnote">
        Two tiles the designs ask for are absent, and for the same reason: the number behind each
        one does not exist. “Inventory value” needs a unit cost, and cost lives on purchase lines
        rather than on the ingredient, so valuing stock means choosing a costing method (FIFO,
        weighted average, last cost) — an accounting decision, not a display one. “Needs attention”
        needs a per-ingredient reorder threshold, and there is no such column on the target model,
        in the column mapping, or on the source's own `ingredients` table; the nearest thing is a
        `low_stock_alerts` boolean on the branch with no figure behind it. This screen counts what
        is known instead of showing figures it cannot stand behind.
      </p>
    </RestaurantPage>
  );
}
