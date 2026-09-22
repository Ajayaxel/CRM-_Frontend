'use client';

/**
 * Menus — `MenuManagement/Menu/{Index,Create,Edit}`.
 *
 * A menu is a named window: a set of items, offered at a set of branches,
 * between two times, either every day or on one date. The API has been
 * complete since the port and the `menus` accessor sat unused.
 *
 * TWO FIELDS THE FORM HAS TO BE HONEST ABOUT.
 *
 * `is_online_visibility` and `is_menu_status` are `required|boolean` in
 * `MenuStoreRequest` — so the keys must be sent — and then `store()` FORCES
 * both to true after validation, whatever the payload said. Update honours
 * them. So on create both start ticked and say they cannot be turned off
 * there; showing them unticked would have been a lie before the user touched
 * anything.
 *
 * `date` is `required_if:is_all_day,false`. That is a cross-field rule and it
 * is left to the server: the form always sends the key, and an all-day menu
 * sends null, which the rule skips. A day-specific menu with no date gets the
 * source's own message — "The date field is required when is all day is
 * false." — rather than a client-side guess at when it applies.
 *
 * Both times are `date_format:H:i` on the way IN: 24-hour, zero-padded, NO
 * seconds. On the way OUT the column is a MySQL TIME and serialises WITH them,
 * `"11:00:00"`, so a form that echoed back what it read was a 422 on every
 * existing menu. `toForm` trims to HH:MM, which is also what an
 * `<input type="time">` emits.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { menu, menus, branches } from '../restaurant-client';
import type { RstMenuRow } from '../restaurant-client';

export function RestaurantMenus() {
  // Every item, not the first ten: the endpoint paginates at a hardcoded ten
  // and ignores `per_page`, so a menu builder that read one page would silently
  // offer a fraction of the menu.
  const { data: items = [] } = useQuery({
    queryKey: ['rst', 'menu', 'all-items'],
    queryFn: () => menu.allItems(),
  });
  const { data: branchList = [] } = useQuery({
    queryKey: ['rst', 'branches'],
    queryFn: () => branches.list(),
  });

  const columns: DataTableColumn<RstMenuRow>[] = [
    { key: 'name', header: 'Menu', sortable: true, render: (m) => m.name || '—' },
    {
      key: 'window', header: 'Window', width: 190,
      render: (m) => (m.is_all_day
        ? 'All day'
        : `${(m.date ?? '').slice(0, 10) || '—'} · ${(m.starting_time ?? '').slice(0, 5) || '—'}\u2013${(m.ending_time ?? '').slice(0, 5) || '—'}`),
    },
    {
      key: 'branches', header: 'Branches',
      render: (m) => (m.branches ?? []).map((b) => b.name).join(', ') || '—',
    },
    {
      key: 'items', header: 'Items', align: 'right', width: 90,
      // The list carries only the count; the items themselves arrive when a
      // row is opened.
      render: (m) => (m.menu_items_count ?? m.menu_items?.length ?? '—'),
    },
    {
      key: 'status', header: 'Status', width: 120,
      render: (m) => <Status tone={m.is_menu_status ? 'active' : 'neutral'}>{m.is_menu_status ? 'On' : 'Off'}</Status>,
    },
  ];

  return (
    <ResourcePage<RstMenuRow>
      title="Menus"
      singular="Menu"
      subtitle="What is served, where, and between which hours."
      icon={CalendarClock}
      queryKey={['rst', 'menus']}
      load={() => menus.list()}
      search={{ match: (m, q) => (m.name ?? '').toLowerCase().includes(q) }}
      // The index carries `menu_items_count` and NO items; only `show` has them.
      loadOne={(m) => menus.show(m.id)}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'is_all_day', label: 'All day', type: 'checkbox',
          hint: 'When this is off the menu applies to one date, and that date becomes required.' },
        { name: 'date', label: 'Date', type: 'date',
          hint: 'Required only when “All day” is off — the server decides, so leaving it blank on an all-day menu is fine.' },
        { name: 'starting_time', label: 'Starts', type: 'time', required: true },
        { name: 'ending_time', label: 'Ends', type: 'time', required: true },
        {
          name: 'branch_ids', label: 'Branches', type: 'multiselect', required: true,
          options: branchList.map((b) => ({ label: b.name, value: b.id })),
          hint: 'At least one. An empty list fails the `required` rule, not a minimum-size one.',
        },
        {
          name: 'menu_item_ids', label: 'Items', type: 'multiselect', required: true,
          options: items.map((i) => ({ label: i.name, value: i.id })),
          hint: 'At least one.',
        },
        { name: 'is_menu_status', label: 'Menu on', type: 'checkbox', createDefault: true,
          hint: 'Forced ON when a menu is created, whatever this says. It can be turned off afterwards by editing.' },
        { name: 'is_online_visibility', label: 'Visible online', type: 'checkbox', createDefault: true,
          hint: 'Also forced ON at create. Editable afterwards.' },
      ]}
      toForm={(m) => ({
        name: m.name ?? '',
        is_all_day: !!m.is_all_day,
        date: (m.date ?? '').slice(0, 10),
        // READ AND WRITE DISAGREE ON THE SHAPE OF A TIME. The column is a
        // MySQL TIME and serialises with seconds — `"11:00:00"` — while both
        // write contracts are `date_format:H:i` and reject anything with them.
        // Sending back what was read is therefore a 422 on every existing
        // menu: "The starting time must be in the format HH:MM."
        starting_time: (m.starting_time ?? '').slice(0, 5),
        ending_time: (m.ending_time ?? '').slice(0, 5),
        branch_ids: (m.branches ?? []).map((b) => b.id),
        menu_item_ids: (m.menu_items ?? []).map((i) => i.id),
        is_menu_status: !!m.is_menu_status,
        is_online_visibility: !!m.is_online_visibility,
      })}
      create={(body) => menus.create(body)}
      update={(id, body) => menus.update(id, body)}
      remove={(id) => menus.remove(id)}
    >
      <p className="ds-caption rst-footnote">
        Times are stored as <code>HH:MM</code> — 24-hour, no seconds. A menu created here is always
        switched on and visible online; both flags are forced at create and can only be changed by
        editing the menu afterwards.
      </p>
    </ResourcePage>
  );
}
