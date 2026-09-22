'use client';

/**
 * Floors, zones, registers, sessions, cash movements, users and roles.
 *
 * These are the screens the Laravel app has under SeatPlan, Pos and
 * UserManagement. The write surfaces are deliberately narrow: `PUT` on a floor,
 * a register, a session and a role all answer 500 in the source — route-model
 * binding resolves on the central connection, and `?->id` runs against a string
 * — so an edit form here would post into an endpoint that cannot succeed on
 * either system. Those screens read, and say why they only read.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, LayoutGrid, Calculator, Wallet, UserCog, ShieldCheck } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import {
  seating, posAdmin, people2, branches,
} from '../restaurant-client';
import type {
  RstFloorRow, RstZoneRow, RstRegisterRow, RstSessionRow, RstCashMovementRow,
  RstUserRow, RstRoleRow,
} from '../restaurant-client';
import { rstPrice } from '../ui/totals';

/**
 * Why a screen leaves out an edit form. Worded so it reads correctly after
 * either lead-in: the ones that are wholly read-only say so themselves, and
 * Floors — which can create and delete — must not be labelled read-only.
 */
const DEAD_WRITE =
  'The source\'s update route for this resource answers 500 on every request — '
  + 'route-model binding resolves against the central connection rather than the tenant\'s — so a '
  + 'form here would post into an endpoint that cannot succeed on either system. Reproducing that '
  + 'failure is deliberate.';

export function RestaurantFloors() {
  // `FloorDto` requires `branch_id`, so a form without this select cannot save
  // at all. The source reads its options from `getAllBranchesList()` — every
  // branch, not just the active ones — so a floor can be created on a branch
  // that is currently switched off.
  const { data: branchOptions = [] } = useQuery({
    queryKey: ['rst', 'branches'],
    queryFn: () => branches.list(),
  });
  const columns: DataTableColumn<RstFloorRow>[] = [
    { key: 'name', header: 'Floor', sortable: true, render: (f) => f.name },
    { key: 'branch', header: 'Branch', render: (f) => (f as { branch?: { name?: string } }).branch?.name ?? '—' },
    {
      key: 'active', header: 'Status', width: 120,
      render: (f) => <Status tone={f.is_active ? 'active' : 'neutral'}>{f.is_active ? 'Active' : 'Inactive'}</Status>,
    },
  ];
  return (
    <ResourcePage<RstFloorRow>
      title="Floors"
      subtitle="The rooms a table can stand in."
      icon={Layers}
      queryKey={['rst', 'floors']}
      load={() => seating.floors()}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'branch_id', label: 'Branch', type: 'select', required: true,
          options: branchOptions.map((b) => ({ label: b.name, value: b.id })),
        },
        { name: 'is_active', label: 'Active', type: 'checkbox',
          hint: 'A floor defaults to INACTIVE on create — an omitted flag stores 0. A zone defaults to active. Same screen, opposite rules.' },
      ]}
      toForm={(f) => ({ name: f.name, branch_id: f.branch_id ?? '', is_active: !!f.is_active })}
      create={(body) => seating.createFloor(body as Partial<RstFloorRow>)}
      remove={(id) => seating.removeFloor(id)}
    >
      <p className="ds-caption rst-footnote">
        Creating and deleting work; editing does not. {DEAD_WRITE}
      </p>
    </ResourcePage>
  );
}

export function RestaurantZones() {
  const { data: branchOptions = [] } = useQuery({
    queryKey: ['rst', 'branches'],
    queryFn: () => branches.list(),
  });
  const { data: floorOptions = [] } = useQuery({
    queryKey: ['rst', 'floors'],
    queryFn: () => seating.floors(),
  });
  const columns: DataTableColumn<RstZoneRow>[] = [
    { key: 'name', header: 'Zone', sortable: true, render: (z) => z.name },
    { key: 'floor', header: 'Floor', render: (z) => (z as { floor?: { name?: string } }).floor?.name ?? '—' },
    { key: 'branch', header: 'Branch', render: (z) => (z as { branch?: { name?: string } }).branch?.name ?? '—' },
    {
      key: 'active', header: 'Status', width: 120,
      render: (z) => <Status tone={z.is_active ? 'active' : 'neutral'}>{z.is_active ? 'Active' : 'Inactive'}</Status>,
    },
  ];
  return (
    <ResourcePage<RstZoneRow>
      title="Zones"
      subtitle="Sections within a floor."
      icon={LayoutGrid}
      queryKey={['rst', 'zones']}
      load={() => seating.zones()}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'branch_id', label: 'Branch', type: 'select', required: true,
          options: branchOptions.map((b) => ({ label: b.name, value: b.id })),
        },
        {
          name: 'floor_id', label: 'Floor', type: 'select', required: true,
          options: floorOptions.map((f) => ({ label: f.name, value: f.id })),
        },
        // `is_active` is deliberately NOT offered: a zone is hard-coded ACTIVE
        // on create and whatever the client sends for the flag is discarded.
        // A checkbox here would be a control with nothing behind it.
      ]}
      create={(body) => seating.createZone(body as Partial<RstZoneRow>)}
      remove={(id) => seating.removeZone(id)}
    >
      <p className="ds-caption rst-footnote">
        A zone is hard-coded ACTIVE on create — the source ignores whatever the client sends for
        that flag — so no Active control is offered. That is the opposite of how a floor behaves,
        where an omitted flag stores INACTIVE. Editing a zone is not offered either: the update
        route answers 500. {DEAD_WRITE}
      </p>
    </ResourcePage>
  );
}

export function RestaurantRegisters() {
  const { data: branchOptions = [] } = useQuery({
    queryKey: ['rst', 'branches'],
    queryFn: () => branches.list(),
  });
  const columns: DataTableColumn<RstRegisterRow>[] = [
    { key: 'name', header: 'Register', sortable: true, render: (r) => r.name },
    { key: 'code', header: 'Code', width: 130, render: (r) => r.code || '—' },
    { key: 'branch', header: 'Branch', render: (r) => r.branch?.name ?? '—' },
    {
      key: 'status', header: 'Status', width: 130,
      render: (r) => <Status tone={r.status === 'Active' ? 'active' : 'neutral'}>{r.status ?? '—'}</Status>,
    },
  ];
  return (
    <ResourcePage<RstRegisterRow>
      title="Registers"
      subtitle="The drawers a session can be opened against."
      icon={Calculator}
      queryKey={['rst', 'registers']}
      load={() => posAdmin.registers()}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'branch_id', label: 'Branch', type: 'select', required: true,
          options: branchOptions.map((b) => ({ label: b.name, value: b.id })),
        },
        { name: 'code', label: 'Code', required: true,
          hint: 'Unique across the organisation here; the source\u2019s uniqueness was per tenant database.' },
        { name: 'note', label: 'Note', type: 'textarea' },
        // `status` is accepted by the validator and IGNORED on create — a new
        // register is always Active — so it is not offered.
      ]}
      create={(body) => posAdmin.createRegister(body)}
    >
      <p className="ds-caption rst-footnote">
        A register can be created but not edited or deleted: both routes answer 500 in the source.
        Its status is forced to Active on create whatever the payload says, so there is no control
        for it. {DEAD_WRITE}
      </p>
    </ResourcePage>
  );
}

export function RestaurantCashMovements() {
  const columns: DataTableColumn<RstCashMovementRow>[] = [
    { key: 'direction', header: 'Direction', width: 110,
      render: (m) => <Status tone={m.direction === 'in' ? 'active' : 'renewal'}>{m.direction ?? '—'}</Status> },
    { key: 'reason', header: 'Reason', render: (m) => m.reason || '—' },
    { key: 'before', header: 'Before', align: 'right', width: 120, render: (m) => rstPrice(m.balance_before) },
    { key: 'amount', header: 'Amount', align: 'right', width: 120, render: (m) => rstPrice(m.amount) },
    { key: 'after', header: 'After', align: 'right', width: 120, render: (m) => rstPrice(m.balance_after) },
  ];
  return (
    <ResourcePage<RstCashMovementRow>
      title="Cash movements"
      subtitle="Every hand in the drawer, with the balance either side of it."
      icon={Wallet}
      queryKey={['rst', 'cash-movements']}
      load={() => posAdmin.cashMovements()}
      page={(n) => posAdmin.cashMovementsPage(n)}
      columns={columns}
      fields={[]}
      canWrite={false}
      emptyTitle="No cash movements recorded"
    />
  );
}

export function RestaurantUsers() {
  const columns: DataTableColumn<RstUserRow>[] = [
    { key: 'name', header: 'User', sortable: true, render: (u) => u.name || '—' },
    { key: 'email', header: 'Email', render: (u) => u.email || '—' },
    { key: 'roles', header: 'Roles', render: (u) => (u.roles ?? []).map((r) => r.name).join(', ') || '—' },
    {
      key: 'status', header: 'Status', width: 120,
      render: (u) => <Status tone={u.status === 'active' ? 'active' : 'neutral'}>{u.status ?? '—'}</Status>,
    },
  ];
  return (
    <ResourcePage<RstUserRow>
      title="Users"
      subtitle="Who can work the till."
      icon={UserCog}
      queryKey={['rst', 'users']}
      load={() => people2.users()}
      columns={columns}
      fields={[]}
      remove={(id) => people2.removeUser(id)}
    >
      <p className="ds-caption rst-footnote">
        A user can be removed and nothing else. Creating one answers 500 on both systems — the role
        lookup runs under the wrong guard — and both update verbs answer 500 as well, so there is
        no form here. Deleting works for every user EXCEPT the organisation&rsquo;s first, which is
        protected and answers &ldquo;Main user cannot be deleted.&rdquo;
      </p>
    </ResourcePage>
  );
}

export function RestaurantRoles() {
  const { data: roleForm } = useQuery({
    queryKey: ['rst', 'roles', 'form-data'],
    queryFn: () => people2.roleFormData(),
  });
  const columns: DataTableColumn<RstRoleRow>[] = [
    { key: 'name', header: 'Role', sortable: true, render: (r) => r.name },
    {
      key: 'permissions', header: 'Permissions', align: 'right', width: 140,
      render: (r) => (r.permissions ?? []).length || '—',
    },
  ];
  return (
    <ResourcePage<RstRoleRow>
      title="Roles"
      subtitle="What a seat at the till is allowed to do."
      icon={ShieldCheck}
      queryKey={['rst', 'roles']}
      load={() => people2.roles()}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'permissions', label: 'Permissions', type: 'multiselect',
          // 275 of them. Grouped on the segment before the first dot — which is
          // how the catalogue is already organised — because a flat wrap of 275
          // checkboxes is a list nobody can find anything in.
          options: (roleForm?.permissions ?? []).map((p) => ({
            label: p.name,
            value: p.name,
            group: p.name.includes('.') ? p.name.split('.')[0] : 'general',
          })),
          hint: 'Sent as permission NAMES, not ids — the source grants by name.',
        },
      ]}
      create={(body) => people2.createRole(body)}
    >
      <p className="ds-caption rst-footnote">
        A role can be created but not edited: the update route answers 500 in the source. Creating
        one is verified except for the permission timestamps, which the platform&rsquo;s permission
        model does not carry (RST-PARITY-014). The permission count above is real; the grants are
        the tenant&rsquo;s own.
      </p>
    </ResourcePage>
  );
}
