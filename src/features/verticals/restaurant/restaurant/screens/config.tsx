'use client';

/**
 * The reference-data screens: cuisines, kitchens and services.
 *
 * Each is an Index/Create/Edit trio in the Laravel app and a single page with a
 * drawer here. The differences that matter are declared, not scaffolded:
 *
 *   - cuisines and kitchens carry `status`, NOT `is_active`. Two spellings of
 *     one idea in one schema, preserved rather than harmonised.
 *   - a service's `is_active` defaults to true on create and keeps its stored
 *     value on edit, which is why the checkbox is populated from the row.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChefHat, Soup, ConciergeBell } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { cuisines, kitchens, services } from '../restaurant-client';
import type { RstCuisineRow, RstKitchenRow, RstServiceRow } from '../restaurant-client';
import { rstPrice } from '../ui/totals';

const activeCell = (on?: boolean | null) => (
  <Status tone={on ? 'active' : 'neutral'}>{on ? 'Active' : 'Inactive'}</Status>
);

export function RestaurantCuisines() {
  const columns: DataTableColumn<RstCuisineRow>[] = [
    { key: 'name', header: 'Cuisine', sortable: true, render: (c) => c.name },
    { key: 'description', header: 'Description', render: (c) => c.description || '—' },
  ];
  return (
    <ResourcePage<RstCuisineRow>
      title="Cuisines"
      subtitle="What the kitchens cook."
      icon={ChefHat}
      queryKey={['rst', 'cuisines']}
      load={() => cuisines.list()}
      search={{ match: (c, q) => (c.name ?? '').toLowerCase().includes(q) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      toForm={(c) => ({ name: c.name, description: c.description ?? '' })}
      create={(body) => cuisines.create(body as Partial<RstCuisineRow>)}
      update={(id, body) => cuisines.update(id, body as Partial<RstCuisineRow>)}
      remove={(id) => cuisines.remove(id)}
      // Deliberately NOT a form field. `CuisineUpdateRequest` validates only
      // `name` and `description`, so a `status` sent to PUT is dropped by
      // `$request->validated()` and the row comes back unchanged with a 200 —
      // a checkbox here would report success and change nothing. The source
      // has no status control on its edit screen either, only this switch.
      toggle={{ value: (c) => !!c.status, call: (c) => cuisines.toggleStatus(c.id) }}
    />
  );
}

export function RestaurantKitchens() {
  // `KitchenUpdateRequest` takes `cuisines` as an array of cuisine ids, so the
  // options are the cuisine list itself — including the de-activated ones,
  // which the source does not filter out here either.
  const { data: cuisineOptions = [] } = useQuery({
    queryKey: ['rst', 'cuisines'],
    queryFn: () => cuisines.list(),
  });
  const columns: DataTableColumn<RstKitchenRow>[] = [
    { key: 'name', header: 'Kitchen', sortable: true, render: (k) => k.name },
    {
      key: 'cuisines', header: 'Cuisines',
      render: (k) => (k.cuisines ?? []).map((c) => c.name).join(', ') || '—',
    },
  ];
  return (
    <ResourcePage<RstKitchenRow>
      title="Kitchens"
      subtitle="Where tickets are cooked — configuration only."
      icon={Soup}
      queryKey={['rst', 'kitchens']}
      load={() => kitchens.list()}
      search={{ match: (k, q) => (k.name ?? '').toLowerCase().includes(q) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        {
          name: 'cuisines', label: 'Cuisines', type: 'multiselect',
          options: cuisineOptions.map((c) => ({ label: c.name, value: c.id })),
          hint: 'Sent as an array of ids. Omitting the key leaves the existing links alone; sending an empty array clears them.',
        },
        { name: 'status', label: 'Active', type: 'checkbox',
          hint: 'Unlike cuisines, a kitchen\u2019s status IS accepted here \u2014 the source offers both this and the switch on the row.' },
      ]}
      toForm={(k) => ({
        name: k.name, description: k.description ?? '', status: !!k.status,
        // The row carries full cuisine objects; the write contract wants ids.
        cuisines: (k.cuisines ?? []).map((c) => c.id),
      })}
      create={(body) => kitchens.create(body)}
      update={(id, body) => kitchens.update(id, body)}
      remove={(id) => kitchens.remove(id)}
      toggle={{ value: (k) => !!k.status, call: (k) => kitchens.toggleStatus(k.id) }}
    >
      <p className="ds-caption rst-footnote">
        Kitchens are configuration, not routing. KOTs carry no kitchen id, so every ticket appears
        on every kitchen display in the branch — assigning cuisines here does not split the board.
      </p>
    </ResourcePage>
  );
}

export function RestaurantServices() {
  const columns: DataTableColumn<RstServiceRow>[] = [
    { key: 'name', header: 'Service', sortable: true, render: (s) => s.name },
    { key: 'duration', header: 'Duration', width: 110, render: (s) => s.duration || '—' },
    { key: 'price', header: 'Price', align: 'right', width: 120, render: (s) => rstPrice(s.price) },
    { key: 'status', header: 'Status', width: 130, render: (s) => activeCell(s.is_active) },
  ];
  return (
    <ResourcePage<RstServiceRow>
      title="Services"
      subtitle="Charged alongside food — covers, corkage, anything timed."
      icon={ConciergeBell}
      queryKey={['rst', 'services']}
      load={() => services.list()}
      search={{ match: (s, q) => (s.name ?? '').toLowerCase().includes(q) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'price', label: 'Price', type: 'number', required: true },
        { name: 'duration', label: 'Duration' },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'is_active', label: 'Active', type: 'checkbox',
          hint: 'Defaults to active on create; an edit that omits it keeps the stored value.' },
      ]}
      toForm={(s) => ({
        name: s.name, price: s.price ?? '', duration: s.duration ?? '',
        description: s.description ?? '', is_active: s.is_active !== false,
      })}
      create={(body) => services.create(body)}
      update={(id, body) => services.update(id, body)}
      remove={(id) => services.remove(id)}
    />
  );
}
