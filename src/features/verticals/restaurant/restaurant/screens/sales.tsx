'use client';

/**
 * Sales reasons — the vocabulary a cancellation or a refund has to choose from.
 *
 * The API side has been complete and unused: `GET/POST/PUT/DELETE
 * /restaurant/sales/reasons` plus a `form-data` route for the category list.
 * The source manages them on `Sales/ManageReasons` with `Sales/ReasonsForm`.
 *
 * ONE TRAP, AND IT IS THE WHOLE REASON THIS SCREEN IS NOT THREE LINES:
 * the list route renames the column. `reasonListShape()` returns the `name`
 * column as `reason`, exactly as the source's Inertia payload does, while every
 * write contract takes `name` — and `GET /sales/reasons/:id` answers with the
 * raw row, so that one says `name` again. A column reading `r.name` off the
 * list is blank for every row; a form sending `reason` is a 422.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { reasons } from '../restaurant-client';
import type { RstReasonRow } from '../restaurant-client';

/** The list says `reason`; the show route and every write say `name`. */
const reasonText = (r: RstReasonRow) => r.reason ?? r.name ?? '—';

export function RestaurantReasons() {
  const { data: formData } = useQuery({
    queryKey: ['rst', 'reasons', 'form-data'],
    queryFn: () => reasons.formData(),
  });

  const columns: DataTableColumn<RstReasonRow>[] = [
    { key: 'reason', header: 'Reason', sortable: true, render: reasonText },
    {
      key: 'category', header: 'Used for', width: 160,
      render: (r) => (r.category
        ? r.category.charAt(0).toUpperCase() + r.category.slice(1)
        : '—'),
    },
    {
      key: 'status', header: 'Status', width: 130,
      render: (r) => (
        <Status tone={r.status === 'Active' ? 'active' : 'neutral'}>{r.status ?? '—'}</Status>
      ),
    },
  ];

  return (
    <ResourcePage<RstReasonRow>
      title="Sales reasons"
      subtitle="Why an order was cancelled, or a payment refunded."
      icon={Ban}
      queryKey={['rst', 'reasons']}
      load={() => reasons.list()}
      search={{ match: (r, q) => reasonText(r).toLowerCase().includes(q) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Reason', required: true,
          hint: 'Stored in a column called `name`, which the list route renames to `reason` on the way out.' },
        {
          name: 'category', label: 'Used for', type: 'select',
          // From the source's own `form-data`, which is `ReasonCategoryConsts`.
          // Both members are lowercase and the validator accepts nothing else.
          options: (formData?.categories ?? []).map((c) => ({
            label: c.charAt(0).toUpperCase() + c.slice(1),
            value: c,
          })),
          hint: 'Optional. A reason with no category is offered for both cancellations and refunds.',
        },
        {
          name: 'status', label: 'Status', type: 'select',
          // The source hard-codes these two in `SalesController`; there is no
          // constant and no endpoint that serves them, so they are repeated
          // here rather than invented.
          options: [
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' },
          ],
        },
      ]}
      // The form writes `name`, so the edit drawer has to translate back out of
      // the list's `reason`.
      toForm={(r) => ({
        name: reasonText(r) === '—' ? '' : reasonText(r),
        category: r.category ?? '',
        status: r.status ?? '',
      })}
      create={(body) => reasons.create(body)}
      update={(id, body) => reasons.update(id, body)}
      remove={(id) => reasons.remove(id)}
      emptyTitle="No cancellation or refund reasons yet"
    >
      <p className="ds-caption rst-footnote">
        Newest first — the source lists these with <code>latest()</code> and there is no other
        ordering. A reason&rsquo;s name is unique within the organisation, so two tenants can both
        have a &ldquo;Customer left&rdquo;.
      </p>
    </ResourcePage>
  );
}
