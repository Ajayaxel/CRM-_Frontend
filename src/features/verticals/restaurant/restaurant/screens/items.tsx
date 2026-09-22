'use client';

/**
 * Menu items — `MenuManagement/Items/{Index,Create,Edit}`.
 *
 * The last of the source's management screens, and the one with the most ways
 * to destroy data quietly. `MenuItemUpdateRequest` validates a wide, forgiving
 * payload and the repository then treats FOUR of its keys as "absent means
 * throw the existing value away":
 *
 *     ingredients   absent → the whole recipe is DELETED
 *     category_ids  absent → every category link is removed
 *     salesTaxIds   absent → every tax link is removed
 *     image_path    absent → the stored image is cleared
 *     is_active     absent → the item is ACTIVATED
 *
 * and a fifth that is worse because it looks harmless: an option re-submitted
 * without its `values` array does not keep them — `writeOptionValues` runs with
 * `prune = true` on that branch and deletes every value the option had.
 * Measured, not assumed: re-posting an option set's two values with their ids
 * stripped left FOUR rows, and posting none at all leaves zero.
 *
 * So this editor sends EVERYTHING, every time, read back from the row:
 *
 *   - `options` and `image_path` are `hidden` fields — carried, never shown.
 *     Option sets are edited on their own screen, which is where the source
 *     puts them too.
 *   - `salesTaxIds` comes from an ADDITIVE endpoint. Neither item read contract
 *     includes taxes and both are PARITY_VERIFIED, so `GET /menu/items/
 *     tax-assignment` was added rather than widening a verified body. Without
 *     it the assignment is unreadable, and every save would clear a
 *     money-affecting field.
 *   - the recipe is renamed on the way out. The read says `ingredient_id` and
 *     `loss_pct`; the write wants `ingredient` and `lossPct` — camelCase, alone
 *     among its snake_case neighbours — and `selectRecipeLines` drops any line
 *     whose `ingredient` is falsy, so getting this wrong loses the recipe
 *     silently rather than erroring.
 *
 * `variations` IS TWO THINGS AT ONCE, and this screen can only edit one of them.
 *
 * `MenuItem` declares a VARCHAR column named `variations` cast to `'array'` AND
 * a `hasMany` relation of the same name. The admin routes never eager-load the
 * relation, so here the key is the COLUMN — and because the cast is symmetric,
 * a value the admin wrote as `Small, Large` is stored json-encoded and reads
 * back as that same string.
 *
 * The mobile app writes an ARRAY to the same column (and rows to the relation
 * besides), so the column can hold `[{name, price, …}]`. This form cannot
 * represent that — the admin write contract is `nullable|string|max:255` — and
 * an absent `variations` CLEARS the column on both systems, so editing such an
 * item through the admin API destroys the app's value. That is the source's
 * behaviour, reproduced rather than papered over; the field says so.
 *
 * `variant` and `tax` are validated by the source and then never written —
 * `MenuItem::create()` does not list them — so they are not offered.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { UtensilsCrossed } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { menu, inventory } from '../restaurant-client';
import type { RstMenuItemRow, RstIngredientRow } from '../restaurant-client';
import { rstPrice } from '../ui/totals';

export function RestaurantItems() {
  const { data: formData } = useQuery({
    queryKey: ['rst', 'items', 'form-data'],
    queryFn: () => menu.itemsFormData(),
    retry: false,
  });
  const { data: ingredients = [] } = useQuery({
    queryKey: ['rst', 'ingredients'],
    queryFn: () => inventory.ingredients() as Promise<RstIngredientRow[]>,
  });
  const { data: taxes } = useQuery({
    queryKey: ['rst', 'items', 'taxes'],
    queryFn: () => menu.itemTaxes(),
  });

  const columns: DataTableColumn<RstMenuItemRow>[] = [
    {
      key: 'name',
      header: 'Item',
      sortable: true,
      render: (i) => {
        const imageSrc = i.image_path || (i as any).image_full_path || (i as any).image_url;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={i.name}
                style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', background: 'var(--bg-subtle, #f3f4f6)' }}
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-subtle, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3, #9ca3af)' }}>
                <UtensilsCrossed size={16} />
              </div>
            )}
            <span>{i.name}</span>
          </div>
        );
      },
    },
    {
      key: 'categories', header: 'Categories',
      render: (i) => (i.categories ?? []).map((c) => c.name).join(', ') || '—',
    },
    { key: 'price', header: 'Price', align: 'right', width: 110, render: (i) => rstPrice(i.price) },
    {
      key: 'active', header: 'Status', width: 120,
      render: (i) => <Status tone={i.is_active ? 'active' : 'neutral'}>{i.is_active ? 'Active' : 'Inactive'}</Status>,
    },
  ];

  return (
    <ResourcePage<RstMenuItemRow>
      title="Menu items"
      singular="Menu item"
      subtitle="What can be ordered, what it costs, and what goes into it."
      icon={UtensilsCrossed}
      queryKey={['rst', 'items']}
      load={() => menu.allItems()}
      // Every page is loaded, so this searches the whole menu rather than a
      // slice of it — which is what makes a client-side filter honest here.
      search={{ placeholder: 'Search items', match: (i, q) => (i.name ?? '').toLowerCase().includes(q) }}
      /**
       * The index carries options WITHOUT their values, and no taxes at all.
       * Saving from that would prune every option value and clear every tax, so
       * the row is read in full — and its tax ids fetched — before the drawer
       * becomes editable.
       */
      loadOne={async (row) => {
        const [full, tax] = await Promise.all([
          menu.item(row.id),
          menu.itemTaxes(row.id),
        ]);
        return { ...full, salesTaxIds: tax.assigned } as RstMenuItemRow & { salesTaxIds: string[] };
      }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'price', label: 'Price', type: 'number' },
        {
          name: 'image_path',
          label: 'Item Image',
          type: 'image',
          hint: 'Optional image for the item. Upload a photo or provide an image URL.',
        },
        {
          name: 'menu_item_category_id', label: 'Primary category', type: 'select',
          options: (formData?.categories ?? []).map((c) => ({ label: c.name, value: c.id })),
        },
        {
          name: 'category_ids', label: 'Categories', type: 'multiselect',
          options: (formData?.categories ?? []).map((c) => ({ label: c.name, value: c.id })),
          hint: 'Written to a JSON column AND a pivot table — the source keeps both. Clearing this removes every link.',
        },
        {
          name: 'salesTaxIds', label: 'Sales taxes', type: 'multiselect',
          options: (taxes?.available ?? []).map((t) => ({
            label: `${t.name} (${t.percentage}%)`, value: t.id,
          })),
          hint: 'camelCase, alone among its neighbours — the source spells it that way. Clearing this removes every tax from the item.',
        },
        { name: 'variations', label: 'Variations',
          hint: 'Free text, max 255. If the mobile app wrote structured variations onto this item they cannot be shown here and saving will clear them — the admin contract takes a string and an absent value clears the column, on the source too.' },
        { name: 'is_active', label: 'Active', type: 'checkbox',
          hint: 'Always sent. An omitted flag ACTIVATES the item — the opposite of what a half-filled form would intend.' },
        {
          name: 'ingredients', label: 'Recipe', type: 'lines',
          lineFields: [
            {
              name: 'ingredient', label: 'Ingredient', type: 'select',
              options: ingredients.map((g) => ({ label: g.name, value: g.id })),
            },
            { name: 'quantity', label: 'Quantity', type: 'number' },
            { name: 'lossPct', label: 'Loss %', type: 'number' },
            { name: 'note', label: 'Note' },
          ],
          hint: 'Configuration only — RST-PARITY-001 → A. Nothing here moves stock. Removing every line deletes the recipe.',
        },
        { name: 'options', label: 'Option sets', hidden: true },
      ]}
      toForm={(i) => ({
        name: i.name,
        price: i.price ?? '',
        menu_item_category_id: i.menu_item_category_id ?? '',
        // The pivot is the reliable read; the JSON column is null on rows that
        // were seeded through the relation.
        category_ids: (i.categories ?? []).map((c) => c.id),
        salesTaxIds: (i as { salesTaxIds?: string[] }).salesTaxIds ?? [],
        variations: typeof i.variations === 'string' ? i.variations : '',
        is_active: i.is_active !== false,
        // READ → WRITE rename. `ingredient_id` → `ingredient`, `loss_pct` →
        // `lossPct`; a line whose `ingredient` is falsy is dropped on the way
        // in, so a missed rename loses the recipe without an error.
        ingredients: (i.ingredients ?? []).map((r) => ({
          ingredient: r.ingredient_id ?? '',
          quantity: r.quantity ?? '',
          lossPct: r.loss_pct ?? '',
          note: r.note ?? '',
        })),
        image_path: i.image_path ?? '',
        // Only the keys the write contract declares. The read shape also
        // carries `branch_id`, `display_name`, timestamps and a joined
        // `currency` object, none of which it accepts.
        options: (i.options ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          type: o.type ?? '',
          required: !!o.required,
          values: (o.values ?? []).map((v) => ({
            id: v.id,
            label: v.label ?? '',
            price: v.price ?? 0,
            price_type: v.price_type ?? 'Fixed',
            currency_id: v.currency_id ?? '',
          })),
        })),
      })}
      create={(body) => menu.createItem(body as Partial<RstMenuItemRow>)}
      update={(id, body) => menu.updateItem(id, body as Partial<RstMenuItemRow>)}
      remove={(id) => menu.removeItem(id)}
    >
      <p className="ds-caption rst-footnote">
        Option sets are carried through this form untouched and are edited on the Option sets
        screen. Item image is optional and can be uploaded or linked via URL.
      </p>
    </ResourcePage>
  );
}
