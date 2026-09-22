'use client';

/**
 * Modifiers — `MenuManagement/Modifiers/{Index,Form}`.
 *
 * A modifier is a named group of priced add-ons ("Extras": Cheese +1.00, Bacon
 * +2.00) attached to menu items and services.
 *
 * THIS SCREEN SITS ON THE ONE CONTRACT THAT CANNOT BE BODY-COMPARED, and that
 * is worth stating plainly. RST-PARITY-017: the source has NO admin JSON API
 * for modifiers — `MenuModifierController` is a WEB controller that validates,
 * writes in a transaction and returns a redirect. The port implemented a full
 * admin REST surface instead. So the endpoints behind this screen are real,
 * Prisma-backed and organisation-scoped, but they have no source counterpart to
 * replay against; only the captain contracts (`POST /add-modifier`,
 * `GET /get-modifiers`) are parity-verified.
 *
 * The WORKFLOW is the source's, though — its own screen manages exactly these
 * fields — so leaving the console without one would drop a feature the product
 * has, not avoid an unverified one.
 *
 * TWO ABSENT-KEY RULES, both documented on the DTO and both handled by sending
 * every field: `apply_sets` and `apply_services` CLEAR on both create and
 * update when omitted. The child rows are called `modifiers` on the way IN and
 * `items` on the way OUT — one more read/write rename, like the recipe's
 * `ingredient`/`ingredient_id`.
 *
 * `branch_id` omitted on create means "the caller's own branch", not "no
 * branch" — so the select is offered but not required, and says so.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Blocks } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { modifiers, rstNum } from '../restaurant-client';
import type { RstModifierRow } from '../restaurant-client';

export function RestaurantModifiers() {
  const { data: formData } = useQuery({
    queryKey: ['rst', 'modifiers', 'form-data'],
    queryFn: () => modifiers.formData(),
  });

  const branchName = new Map((formData?.branches ?? []).map((b) => [b.id, b.name]));

  const columns: DataTableColumn<RstModifierRow>[] = [
    { key: 'name', header: 'Modifier', sortable: true, render: (m) => m.name },
    {
      key: 'branch', header: 'Branch', width: 150,
      render: (m) => (m.branch_id ? branchName.get(m.branch_id) ?? m.branch_id : 'All branches'),
    },
    {
      key: 'items', header: 'Add-ons',
      render: (m) => (m.items ?? [])
        .map((i) => `${i.name ?? '—'} +${rstNum(i.price).toFixed(2)}`)
        .join(', ') || '—',
    },
    {
      key: 'applied', header: 'Applied to', width: 170,
      render: (m) => {
        const items = m.menu_items?.length ?? 0;
        const svcs = m.services?.length ?? 0;
        if (!items && !svcs) return '—';
        return [items && `${items} item${items > 1 ? 's' : ''}`,
          svcs && `${svcs} service${svcs > 1 ? 's' : ''}`].filter(Boolean).join(', ');
      },
    },
    {
      key: 'active', header: 'Status', width: 120,
      render: (m) => <Status tone={m.is_active ? 'active' : 'neutral'}>{m.is_active ? 'Active' : 'Inactive'}</Status>,
    },
  ];

  return (
    <ResourcePage<RstModifierRow>
      title="Modifiers"
      singular="Modifier"
      subtitle="Priced add-ons attached to items and services."
      icon={Blocks}
      queryKey={['rst', 'modifiers']}
      load={() => modifiers.list()}
      search={{ match: (m, q) => (m.name ?? '').toLowerCase().includes(q) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'branch_id', label: 'Branch', type: 'select',
          options: (formData?.branches ?? []).map((b) => ({ label: b.name, value: b.id })),
          hint: 'Optional. Left empty on create the source uses the caller’s own branch rather than storing none.',
        },
        { name: 'is_active', label: 'Active', type: 'checkbox' },
        {
          name: 'modifiers', label: 'Add-ons', type: 'lines', lineKeepId: true,
          lineFields: [
            { name: 'name', label: 'Name' },
            { name: 'price', label: 'Price', type: 'number' },
          ],
          hint: 'Sent under the key `modifiers` and read back under `items` — the same idea named twice.',
        },
        {
          name: 'apply_sets', label: 'Menu items', type: 'multiselect',
          options: (formData?.menuItems ?? []).map((i) => ({ label: i.name, value: i.id })),
          hint: 'Absent CLEARS on both create and update, so this form always sends it.',
        },
        {
          name: 'apply_services', label: 'Services', type: 'multiselect',
          options: (formData?.services ?? []).map((s) => ({ label: s.name, value: s.id })),
        },
      ]}
      toForm={(m) => ({
        name: m.name,
        branch_id: m.branch_id ?? '',
        is_active: m.is_active !== false,
        // READ `items` → WRITE `modifiers`.
        modifiers: (m.items ?? []).map((i) => ({
          id: i.id, name: i.name ?? '', price: i.price ?? '',
        })),
        // The pivots come back resolved to {id, name}; the writer wants ids.
        apply_sets: (m.menu_items ?? []).map((i) => i.id),
        apply_services: (m.services ?? []).map((s) => s.id),
      })}
      create={(body) => modifiers.create(body)}
      update={(id, body) => modifiers.update(id, body)}
      remove={(id) => modifiers.remove(id)}
    >
      <p className="ds-caption rst-footnote">
        The source manages modifiers through a web controller that answers with a redirect, not a
        JSON API, so these endpoints have no counterpart to compare against — RST-PARITY-017. They
        are implemented and tenant-scoped; what cannot be produced is a body comparison.
      </p>
    </ResourcePage>
  );
}
