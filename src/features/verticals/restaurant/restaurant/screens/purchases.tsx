'use client';

/**
 * Purchases — `Inventory/Purchases/{index,purchaseForm}`.
 *
 * A purchase is a header plus lines: a branch, a supplier, tax and discount,
 * and one or more `{ingredient_id, quantity, unit_cost}` rows validated with
 * `@ValidateNested({ each: true })`. It is the first screen here that needs a
 * repeating sub-form, which is what `type: 'lines'` is.
 *
 * THREE THINGS THE SOURCE DOES THAT THE FORM MUST NOT FIGHT.
 *
 * `total` is accepted by the validator and then OVERWRITTEN by the recomputed
 * figure. So it is not a field — a number a user typed and the server silently
 * replaced would be worse than no control at all. The stored total is shown in
 * the list, where it is the server's answer rather than anyone's input.
 *
 * `quantity` is `integer` on the way in — half a kilo cannot be purchased even
 * though the stock column is decimal — and comes back as the decimal string
 * `"3.00"`. Echoing that back fails `@IsInt`, so `toForm` re-integers it. The
 * same asymmetry as the menu times, in a different column.
 *
 * The index carries the header and NO lines; only `show` is `with('items')`.
 * The row is hydrated through `loadOne` when its drawer opens, because an edit
 * form fed from the index would open with no lines and rewrite the purchase
 * without them. There is no line count in the list for the same reason — the
 * list genuinely does not know it, and a column reading `items?.length` would
 * have shown a dash for every row.
 *
 * `discount` is `min:0` and rejected outright when negative. `tax` has NO min
 * rule, so a negative tax passes validation and is caught only by the clamp in
 * `calculateTotal` — two independent guards, one of which is reachable.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { inventory } from '../restaurant-client';
import type { RstPurchaseRow } from '../restaurant-client';
import { rstPrice } from '../ui/totals';

export function RestaurantPurchases() {
  const { data: formData } = useQuery({
    queryKey: ['rst', 'purchases', 'form-data'],
    queryFn: () => inventory.purchaseFormData(),
  });

  const columns: DataTableColumn<RstPurchaseRow>[] = [
    { key: 'reference_no', header: 'Reference', sortable: true, render: (p) => p.reference_no || '—' },
    { key: 'supplier', header: 'Supplier', render: (p) => p.supplier?.name ?? '—' },
    { key: 'branch', header: 'Branch', width: 150, render: (p) => p.branch?.name ?? '—' },
    // The server's recomputed figure, not anything that was typed.
    { key: 'total', header: 'Total', align: 'right', width: 120, render: (p) => rstPrice(p.total) },
  ];

  return (
    <ResourcePage<RstPurchaseRow>
      title="Purchases"
      singular="Purchase"
      subtitle="What the kitchen bought, and from whom."
      icon={PackagePlus}
      queryKey={['rst', 'purchases']}
      load={() => inventory.purchases()}
      search={{ placeholder: 'Search by reference or supplier', match: (p, q) => (p.reference_no ?? '').toLowerCase().includes(q) || (p.supplier?.name ?? '').toLowerCase().includes(q) }}
      // `items` appears on `show` alone — fetched when a row is opened.
      loadOne={(p) => inventory.purchase(p.id)}
      columns={columns}
      fields={[
        {
          name: 'branch_id', label: 'Branch', type: 'select', required: true,
          options: (formData?.branches ?? []).map((b) => ({ label: b.name, value: b.id })),
        },
        {
          name: 'supplier_id', label: 'Supplier', type: 'select', required: true,
          options: (formData?.suppliers ?? []).map((s) => ({ label: s.name, value: s.id })),
        },
        { name: 'reference_no', label: 'Reference number' },
        { name: 'expected_date', label: 'Expected date', type: 'date' },
        { name: 'tax', label: 'Tax', type: 'number',
          hint: 'No minimum is enforced here — a negative tax passes validation and is only clamped when the total is computed.' },
        { name: 'discount', label: 'Discount', type: 'number',
          hint: 'Rejected outright when negative, unlike tax.' },
        { name: 'status', label: 'Status' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
        {
          name: 'items', label: 'Lines', type: 'lines', required: true,
          lineFields: [
            {
              name: 'ingredient_id', label: 'Ingredient', type: 'select',
              options: (formData?.ingredients ?? []).map((i) => ({ label: i.name, value: i.id })),
            },
            { name: 'quantity', label: 'Quantity', type: 'number' },
            { name: 'unit_cost', label: 'Unit cost', type: 'number' },
          ],
          hint: 'At least one line. Quantity is a whole number — the stock column is decimal but the purchase contract is not.',
        },
        // `total` and `currency_id` are deliberately absent. The total is
        // recomputed and overwritten server-side; the currency is set from the
        // branch and is not something this form should guess at.
      ]}
      toForm={(p) => ({
        branch_id: p.branch_id ?? '', supplier_id: p.supplier_id ?? '',
        reference_no: p.reference_no ?? '',
        expected_date: (p.expected_date ?? '').slice(0, 10),
        tax: p.tax ?? '', discount: p.discount ?? '',
        status: p.status ?? '', notes: p.notes ?? '',
        items: (p.items ?? []).map((i) => ({
          ingredient_id: i.ingredient_id ?? '',
          // `"3.00"` fails `@IsInt`. Back to a whole number before it is sent.
          quantity: i.quantity == null ? '' : String(Math.trunc(Number(i.quantity))),
          unit_cost: i.unit_cost ?? '',
        })),
      })}
      create={(body) => inventory.createPurchase(body)}
      update={(id, body) => inventory.updatePurchase(id, body)}
      remove={(id) => inventory.removePurchase(id)}
    >
      <p className="ds-caption rst-footnote">
        The total is not a field. Whatever a client sends is discarded and recomputed from the
        lines, tax and discount, so the figure above is the server&rsquo;s and always matches what
        was stored.
      </p>
    </ResourcePage>
  );
}
