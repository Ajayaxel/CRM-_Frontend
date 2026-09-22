'use client';

/**
 * Option sets — `MenuManagement/Options/{Index,OptionCreateForm}`.
 *
 * An option set is a named choice with priced values: "Size" with Small +1.00
 * and Large +2.00. Items reference them, and the menu item editor round-trips
 * an item's sets rather than editing them, because THIS is where they are
 * managed — the same split the source has.
 *
 * TWO VOCABULARY TRAPS, both the shape of RST-PARITY-009.
 *
 * `price_type` — `/menu/options/form-data` offers `["Fixed", "Percentage"]`
 * and the write contract validates `in:Fixed,Percent`. So the endpoint's own
 * dropdown feed advertises a value it then refuses. The select here offers what
 * the WRITER accepts; a value stored as `Percentage` shows blank and has to be
 * re-chosen, exactly as a lowercase discount type does.
 *
 * `currency_id` — `nullable` in the request and NOT NULL in the column, and
 * `createOption` runs no transaction. So a missing currency passes validation,
 * fails at the database AFTER the option row is written, and leaves a 500 and
 * an orphaned option with no values. That is pinned by the
 * `option.create.null-currency-orphans-the-option` scenario and is not fixed
 * here — the field is marked required in the form and says what happens, which
 * is as far as a client can honestly go without changing the contract.
 *
 * `branch_id` is `required|exists:branches,id`: a GLOBAL option cannot be made
 * through this endpoint, even though global options exist in the data (the
 * fixtures carry one with a null branch).
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { options, branches, rstNum } from '../restaurant-client';
import type { RstOptionRow } from '../restaurant-client';

export function RestaurantOptions() {
  const { data: formData } = useQuery({
    queryKey: ['rst', 'options', 'form-data'],
    queryFn: () => options.formData(),
  });
  // The only feed that carries the central currency rows. It is plan-capped and
  // may 403; the select is then empty and the hint below says why that matters.
  const { data: branchForm } = useQuery({
    queryKey: ['rst', 'branches', 'form-data'],
    queryFn: () => branches.formData(),
    retry: false,
  });

  const branchName = new Map((formData?.branches ?? []).map((b) => [b.id, b.name]));

  const columns: DataTableColumn<RstOptionRow>[] = [
    { key: 'name', header: 'Option set', sortable: true, render: (o) => o.name },
    { key: 'type', header: 'Type', width: 140, render: (o) => o.type || '—' },
    {
      key: 'branch', header: 'Branch', width: 150,
      // A null branch is a GLOBAL option — real in the data, and not creatable
      // through this endpoint.
      render: (o) => (o.branch_id ? branchName.get(o.branch_id) ?? o.branch_id : 'Global'),
    },
    {
      key: 'values', header: 'Values',
      render: (o) => (o.values ?? [])
        .map((v) => `${v.label ?? '—'} ${v.price_type === 'Percent' ? `${rstNum(v.price)}%` : `+${rstNum(v.price).toFixed(2)}`}`)
        .join(', ') || '—',
    },
    {
      key: 'required', header: 'Required', width: 110,
      render: (o) => <Status tone={o.required ? 'active' : 'neutral'}>{o.required ? 'Yes' : 'No'}</Status>,
    },
  ];

  return (
    <ResourcePage<RstOptionRow>
      title="Option sets"
      singular="Option set"
      subtitle="Priced choices an item can carry — sizes, extras, preparations."
      icon={SlidersHorizontal}
      queryKey={['rst', 'options']}
      load={() => options.list()}
      search={{ match: (o, q) => (o.name ?? '').toLowerCase().includes(q) || (o.values ?? []).some((v) => (v.label ?? '').toLowerCase().includes(q)) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'branch_id', label: 'Branch', type: 'select', required: true,
          options: (formData?.branches ?? []).map((b) => ({ label: b.name, value: b.id })),
          hint: 'Required — a global option set cannot be created here, even though global ones exist in the data.',
        },
        {
          name: 'type', label: 'Type', type: 'select', required: true,
          options: (formData?.types ?? []).map((t) => ({ label: t.label, value: t.value })),
        },
        { name: 'required', label: 'Required at the till', type: 'checkbox' },
        {
          name: 'values', label: 'Values', type: 'lines', lineKeepId: true,
          lineFields: [
            { name: 'label', label: 'Label' },
            { name: 'price', label: 'Price', type: 'number' },
            {
              name: 'price_type', label: 'Price type', type: 'select',
              // What the WRITER accepts. `form-data` offers `Percentage`,
              // which this endpoint rejects — so it is deliberately not used.
              options: [
                { label: 'Fixed', value: 'Fixed' },
                { label: 'Percent', value: 'Percent' },
              ],
            },
            {
              name: 'currency_id', label: 'Currency', type: 'select',
              options: (branchForm?.currencies ?? []).map((c) => ({ label: c.currency, value: c.id })),
            },
          ],
          hint: 'Every value needs a price, a price type AND a currency. A missing currency passes validation and then fails at the database, leaving a 500 and an option set with no values — the source does this too, so the form cannot save you from it.',
        },
      ]}
      toForm={(o) => ({
        name: o.name,
        branch_id: o.branch_id ?? '',
        type: o.type ?? '',
        required: !!o.required,
        // The read shape carries `menu_option_id`, timestamps and a joined
        // `currency` object that the write contract does not accept; only these
        // five keys go back.
        values: (o.values ?? []).map((v) => ({
          id: v.id,
          label: v.label ?? '',
          price: v.price ?? '',
          price_type: v.price_type ?? '',
          currency_id: v.currency_id ?? '',
        })),
      })}
      create={(body) => options.create(body)}
      update={(id, body) => options.update(id, body)}
      remove={(id) => options.remove(id)}
    >
      <p className="ds-caption rst-footnote">
        Menu items reference these sets; the item editor shows which ones an item carries but does
        not change them, because this is where they live. A value stored with a price type of
        &ldquo;Percentage&rdquo; shows blank above — the writer accepts &ldquo;Percent&rdquo; only.
      </p>
    </ResourcePage>
  );
}
