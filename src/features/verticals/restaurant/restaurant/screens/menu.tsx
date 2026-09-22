'use client';

/**
 * Menu — the screen the sidebar has been advertising with nowhere to go.
 *
 * `lib/nav.ts` has carried a `Menu` entry pointing at `/restaurant/menu` since
 * the vertical was registered, and no page existed: every restaurant user
 * clicking it got a 404. The API side was never the problem — all four menu
 * contracts (`items`, `items/{item}`, `categories`, `categories/{category}`)
 * are PARITY_VERIFIED.
 *
 * Read-only on purpose. Creating and editing menu items is a real screen with
 * variations, modifiers, option sets, taxes and images behind it, and the write
 * contracts for those carry rules the parity work documented in detail — four
 * different absent-key behaviours between create and edit alone. Shipping a
 * half-built editor would be worse than shipping a list that tells the truth;
 * the list is what the dead link owed the user.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers3, ListTree, EyeOff } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, DataTable, EmptyState, Skeleton, StatCard, Status } from '../ui/kit';
import type { DataTableColumn, Tone } from '../ui/kit';
import { menu } from '../restaurant-client';
import { LoadFailed } from '../ui/load-state';
import { rstPrice } from '../ui/totals';
import type { RstCategoryRow, RstMenuItemRow } from '../restaurant-client';

const ALL = '__all__';

/**
 * An item belongs to a category through EITHER the scalar
 * `menu_item_category_id` or the `categories` pivot, and the source keeps both
 * in step — the POS reads the scalar while the admin list reads the pivot.
 * Filtering on one alone hides items that are filed through the other.
 */
function inCategory(item: RstMenuItemRow, categoryId: string): boolean {
  if (item.menu_item_category_id === categoryId) return true;
  return (item.categories ?? []).some((c) => c.id === categoryId);
}

export function RestaurantMenu() {
  const [category, setCategory] = useState<string>(ALL);

  const { data: categories = [], isLoading: catsLoading, error: catsError } = useQuery({
    queryKey: ['rst', 'menu', 'categories'],
    queryFn: () => menu.categories(),
  });
  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ['rst', 'menu', 'items'],
    queryFn: () => menu.allItems(),
  });

  const shown = useMemo(
    () => (category === ALL ? items : items.filter((i) => inCategory(i, category))),
    [items, category],
  );

  // `is_active` is the column the API sends. An item with no flag at all is
  // treated as active, which is the column's own default.
  const hidden = items.filter((i) => i.is_active === false);

  const categoryNames = useMemo(
    () => new Map(categories.map((c: RstCategoryRow) => [c.id, c.name])),
    [categories],
  );

  const columns: DataTableColumn<RstMenuItemRow>[] = [
    { key: 'name', header: 'Item', sortable: true, render: (i) => i.name },
    {
      key: 'category', header: 'Category', width: 180,
      render: (i) => {
        const names = new Set<string>();
        if (i.menu_item_category_id) {
          const n = categoryNames.get(i.menu_item_category_id);
          if (n) names.add(n);
        }
        for (const c of i.categories ?? []) names.add(c.name);
        return names.size ? [...names].join(', ') : '—';
      },
    },
    {
      key: 'price', header: 'Price', align: 'right', width: 120,
      // Never formatted with a hardcoded symbol — see the note in
      // restaurant-client.ts. The org's real currency decides.
      // A price column, not a headline tile — minor units matter here.
      render: (i) => rstPrice(i.price),
    },
    {
      key: 'status', header: 'Status', width: 130,
      render: (i) => (
        <Status tone={(i.is_active === false ? 'expired' : 'active') as Tone}>
          {i.is_active === false ? 'Hidden' : 'On the menu'}
        </Status>
      ),
    },
  ];

  return (
    <RestaurantPage
      title="Menu"
      subtitle="Everything the kitchen can be asked for, and what it costs."
      // This screen reads. Editing an item, its recipe, its categories and its
      // taxes happens on the Items screen, and a read-only overview with no way
      // through to it is a dead end.
      actions={(
        <>
          <a className="btn-secondary btn-sm" href="/restaurant/categories">Categories</a>
          <a className="btn-primary btn-sm" href="/restaurant/items">Manage items</a>
        </>
      )}
    >
      <div className="ds-grid ds-grid-kpi">
        <StatCard
          label="Items"
          value={itemsLoading ? '—' : items.length}
          hint={itemsLoading ? undefined : `${categories.length} categories`}
          tone="info"
          icon={Layers3}
        />
        <StatCard
          label="Categories"
          value={catsLoading ? '—' : categories.length}
          tone="neutral"
          icon={ListTree}
        />
        <StatCard
          label="Hidden"
          value={itemsLoading ? '—' : hidden.length}
          hint={itemsLoading ? undefined : 'Not orderable today'}
          tone={hidden.length ? 'renewal' : 'neutral'}
          icon={EyeOff}
        />
      </div>

      <Card pad={14}>
        <div className="rst-filters">
          <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Category filter">
            <button
              role="tab"
              aria-selected={category === ALL}
              className={`rst-seg-item${category === ALL ? ' is-on' : ''}`}
              onClick={() => setCategory(ALL)}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={category === c.id}
                className={`rst-seg-item${category === c.id ? ' is-on' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        {itemsError || catsError ? (
          <LoadFailed what="the menu" />
        ) : itemsLoading ? (
          <Skeleton rows={6} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Layers3}
            title={items.length === 0 ? 'No menu items yet' : 'Nothing in this category'}
            body={
              items.length === 0
                ? 'Items added in the POS or the admin API will appear here.'
                : 'Every item is filed under a different category.'
            }
          />
        ) : (
          <DataTable rows={shown} columns={columns} rowKey={(i) => i.id} />
        )}
      </Card>
    </RestaurantPage>
  );
}
