'use client';

/**
 * Discounts, suppliers, units and customers.
 *
 * `discount_type` is RST-PARITY-009 and the reason this form uses a fixed
 * select rather than free text: FIVE vocabularies write to that one column
 * across the admin and mobile surfaces, and only two of them are matched at
 * settlement. The admin API accepts `Percentage`/`Amount`; the mobile add
 * endpoint accepts `Amount`/`percentage` and its edit endpoint accepts
 * `fixed`/`percentage`, so a discount created on a phone can be uneditable
 * there and a `fixed` one silently discounts nothing.
 *
 * The select offers only what THIS endpoint accepts. It does not attempt to
 * reconcile the five — that is a decision, and inventing it here would make the
 * console disagree with the till.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Percent, Truck, Ruler, Users } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import {
  discounts, inventory, customers as customersApi, branches, rstNum,
} from '../restaurant-client';
import type {
  RstDiscountRow, RstSupplierRow, RstUnitRow, RstCustomerRow,
} from '../restaurant-client';
import { rstPrice } from '../ui/totals';

export function RestaurantDiscounts() {
  // Branches, categories and products come from the source's own form feed
  // rather than from the list endpoints, because that feed is what decides
  // which of them a discount may be scoped to: branches are filtered to the
  // active ones, categories and products deliberately are not.
  const { data: formData } = useQuery({
    queryKey: ['rst', 'discounts', 'form-data'],
    queryFn: () => discounts.formData(),
  });
  const columns: DataTableColumn<RstDiscountRow>[] = [
    { key: 'title', header: 'Discount', sortable: true, render: (d) => d.title || '—' },
    { key: 'type', header: 'Type', width: 140, render: (d) => d.discount_type || '—' },
    {
      key: 'value', header: 'Value', align: 'right', width: 110,
      // A percentage is not money. Matching on the lowercased spelling covers
      // `Percentage` from the console and `percentage` from the phone; a
      // `fixed` row — which the mobile edit endpoint accepts and settlement
      // then ignores — falls through to the currency form, which is what it
      // was stored as.
      render: (d) => (String(d.discount_type ?? '').toLowerCase() === 'percentage'
        ? `${rstNum(d.value)}%`
        : rstPrice(d.value)),
    },
    {
      key: 'from_app', header: 'Source', width: 120,
      render: (d) => (d.from_app ? 'Mobile app' : 'Console'),
    },
    {
      key: 'active', header: 'Status', width: 120,
      render: (d) => <Status tone={d.is_active ? 'active' : 'neutral'}>{d.is_active ? 'Active' : 'Inactive'}</Status>,
    },
  ];
  return (
    <ResourcePage<RstDiscountRow>
      title="Discounts"
      subtitle="What can come off a bill, and who may take it off."
      icon={Percent}
      queryKey={['rst', 'discounts']}
      load={() => discounts.list()}
      search={{ placeholder: 'Search discounts', match: (d, q) => (d.title ?? '').toLowerCase().includes(q) || (d.discount_type ?? '').toLowerCase().includes(q) }}
      columns={columns}
      fields={[
        { name: 'title', label: 'Title', required: true },
        {
          name: 'discount_type', label: 'Type', type: 'select', required: true,
          // What the ADMIN endpoint accepts. Deliberately NOT the `types` list
          // from `/discounts/form-data`: that one is lowercase and the
          // validator rejects it. The mobile endpoints accept yet other
          // spellings of the same two ideas — RST-PARITY-009.
          options: [
            { label: 'Percentage', value: 'Percentage' },
            { label: 'Amount', value: 'Amount' },
          ],
          hint: 'Only `percentage` and `Percentage` are matched at settlement. A discount stored with any other spelling — `amount` and `fixed` both occur — shows BLANK here, because the admin endpoint accepts neither: it cannot be saved again until a type is chosen, and choosing one rewrites the stored spelling.',
        },
        { name: 'value', label: 'Value', type: 'number', required: true },
        // All four are `required`, not nullable. An unbounded discount cannot
        // be expressed through this endpoint, so the form cannot omit them.
        { name: 'max_discount', label: 'Max discount', type: 'number', required: true },
        { name: 'min_spend', label: 'Min spend', type: 'number', required: true },
        { name: 'max_spend', label: 'Max spend', type: 'number', required: true },
        { name: 'start_date', label: 'Start date', type: 'date', required: true },
        { name: 'end_date', label: 'End date', type: 'date', required: true,
          hint: 'Must be on or after the start date.' },
        { name: 'usage_limit', label: 'Usage limit', type: 'number', required: true },
        { name: 'per_customer_limit', label: 'Per customer limit', type: 'number', required: true },
        {
          name: 'branch_id', label: 'Branches', type: 'multiselect', required: true,
          options: (formData?.branches ?? []).map((b) => ({ label: b.name, value: b.id })),
          hint: 'An array under a singular name, and at least one is required.',
        },
        {
          name: 'order_type', label: 'Order types', type: 'multiselect', required: true,
          options: (formData?.orderTypes ?? []).map((o) => ({ label: o.name, value: o.value })),
        },
        {
          name: 'available_day', label: 'Available days', type: 'multiselect', required: true,
          options: (formData?.availableDays ?? []).map((d) => ({ label: d.name, value: d.value })),
        },
        {
          name: 'type', label: 'Scope', type: 'select',
          options: [
            { label: 'Bill wise', value: 'bill_wise' },
            { label: 'Product wise', value: 'product_wise' },
          ],
        },
        {
          name: 'category_id', label: 'Categories', type: 'multiselect',
          options: (formData?.categories ?? []).map((c) => ({ label: c.name, value: c.id })),
        },
        {
          name: 'product_id', label: 'Products', type: 'multiselect',
          options: (formData?.products ?? []).map((p) => ({ label: p.name, value: p.id })),
        },
        { name: 'note', label: 'Note', type: 'textarea' },
        { name: 'is_active', label: 'Active', type: 'checkbox' },
        // `apply_after_taxes` and `require_passcode` are deliberately ABSENT.
        // They are columns on the table and `$fillable` on the model, but the
        // only endpoints that validate them are the two MOBILE APP discount
        // routes — neither `DiscountStoreRequest` nor `DiscountUpdateRequest`
        // lists them, so the admin API cannot set either one. A console-created
        // discount is therefore always `false` for both, and offering a
        // checkbox here would be a control with nothing behind it.
      ]}
      toForm={(d) => ({
        title: d.title ?? '', discount_type: d.discount_type ?? '', value: d.value ?? '',
        max_discount: d.max_discount ?? '', min_spend: d.min_spend ?? '',
        max_spend: d.max_spend ?? '',
        // The column is a full timestamp; <input type="date"> takes the date half.
        start_date: (d.start_date ?? '').slice(0, 10),
        end_date: (d.end_date ?? '').slice(0, 10),
        usage_limit: d.usage_limit ?? '', per_customer_limit: d.per_customer_limit ?? '',
        branch_id: d.branch_id ?? [], order_type: d.order_type ?? [],
        available_day: d.available_day ?? [], category_id: d.category_id ?? [],
        product_id: d.product_id ?? [], type: d.type ?? '', note: d.note ?? '',
        is_active: d.is_active !== false,
      })}
      create={(body) => discounts.create(body)}
      update={(id, body) => discounts.update(id, body)}
      remove={(id) => discounts.remove(id)}
    >
      <p className="ds-caption rst-footnote">
        Two of a discount&rsquo;s flags — <code>require_passcode</code> and{' '}
        <code>apply_after_taxes</code> — can only be set from the mobile app. No admin
        endpoint validates them, so a discount created here always has both off and
        nothing on this screen can change that.
      </p>
    </ResourcePage>
  );
}

export function RestaurantSuppliers() {
  // `SupplierDto.branch_id` is required, so the select is not optional dressing.
  const { data: branchOptions = [] } = useQuery({
    queryKey: ['rst', 'branches'],
    queryFn: () => branches.list(),
  });
  const columns: DataTableColumn<RstSupplierRow>[] = [
    { key: 'name', header: 'Supplier', sortable: true, render: (s) => s.name },
    { key: 'email', header: 'Email', render: (s) => s.email || '—' },
    { key: 'phone', header: 'Phone', width: 150, render: (s) => s.phone || '—' },
    { key: 'branch', header: 'Branch', width: 160, render: (s) => s.branch?.name ?? '—' },
  ];
  return (
    <ResourcePage<RstSupplierRow>
      title="Suppliers"
      subtitle="Who the kitchen buys from."
      icon={Truck}
      queryKey={['rst', 'suppliers']}
      load={() => inventory.suppliers() as Promise<RstSupplierRow[]>}
      search={{ placeholder: 'Search suppliers', match: (s, q) => [s.name, s.email, s.phone].some((v) => (v ?? '').toLowerCase().includes(q)) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'branch_id', label: 'Branch', type: 'select', required: true,
          options: branchOptions.map((b) => ({ label: b.name, value: b.id })),
        },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'address', label: 'Address', type: 'textarea' },
      ]}
      toForm={(s) => ({
        name: s.name, branch_id: s.branch_id ?? s.branch?.id ?? '', email: s.email ?? '',
        phone: s.phone ?? '', address: s.address ?? '',
      })}
      create={(body) => inventory.createSupplier(body)}
      update={(id, body) => inventory.updateSupplier(id, body)}
      remove={(id) => inventory.removeSupplier(id)}
    >
      <p className="ds-caption rst-footnote">
        Create and update share one request class, so the same five fields apply to both. The form
        posts all of them every time and fills them from the stored row first — which is what makes
        the source&rsquo;s absent-key rules irrelevant here: a key is never absent.
      </p>
    </ResourcePage>
  );
}

export function RestaurantUnits() {
  const columns: DataTableColumn<RstUnitRow>[] = [
    { key: 'name', header: 'Unit', sortable: true, render: (u) => u.name },
    { key: 'symbol', header: 'Symbol', width: 110, render: (u) => u.symbol || '—' },
    { key: 'short', header: 'Short name', width: 130, render: (u) => u.short_name || '—' },
    { key: 'type', header: 'Type', width: 130, render: (u) => u.type || '—' },
  ];
  return (
    <ResourcePage<RstUnitRow>
      title="Units"
      subtitle="How stock is counted."
      icon={Ruler}
      queryKey={['rst', 'units']}
      load={() => inventory.units() as Promise<RstUnitRow[]>}
      search={{ placeholder: 'Search units', match: (u, q) => [u.name, u.symbol, u.type].some((v) => (v ?? '').toLowerCase().includes(q)) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true,
          hint: 'Required on create. On update it is `sometimes`, so the source would accept an edit that omitted it — this form always sends it.' },
        { name: 'symbol', label: 'Symbol' },
        { name: 'short_name', label: 'Short name' },
        { name: 'precision', label: 'Precision' },
        { name: 'type', label: 'Type' },
      ]}
      toForm={(u) => ({
        name: u.name, symbol: u.symbol ?? '', short_name: u.short_name ?? '',
        precision: u.precision ?? '', type: u.type ?? '',
      })}
      create={(body) => inventory.createUnit(body)}
      update={(id, body) => inventory.updateUnit(id, body)}
      remove={(id) => inventory.removeUnit(id)}
    >
      <p className="ds-caption rst-footnote">
        `add-unit` clears any column the payload omits while `edit-unit` preserves it — the same
        five columns, opposite rules. The form covers all five and prefills them from the row, so
        neither rule can bite: nothing is ever omitted, and nothing the user did not touch changes.
      </p>
    </ResourcePage>
  );
}

/** `name`, `first_name` and `last_name` are three columns for one idea. */
const customerName = (c: RstCustomerRow) =>
  c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';

export function RestaurantCustomers() {
  const columns: DataTableColumn<RstCustomerRow>[] = [
    { key: 'name', header: 'Customer', sortable: true, render: customerName },
    { key: 'phone', header: 'Phone', width: 160, render: (c) => c.phone || '—' },
    { key: 'email', header: 'Email', render: (c) => c.email || '—' },
    { key: 'city', header: 'City', width: 140, render: (c) => c.city || '—' },
  ];
  return (
    <ResourcePage<RstCustomerRow>
      title="Customers"
      subtitle="Everyone the till has taken a name for."
      icon={Users}
      queryKey={['rst', 'customers']}
      // `/customers` paginates at fifteen and ignores `per_page`. Reading
      // `data` off it showed fifteen customers of any number, with nothing on
      // screen to say so.
      load={() => customersApi.list() as Promise<RstCustomerRow[]>}
      page={(n) => customersApi.page(n)}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'phone', label: 'Phone', required: true,
          hint: 'Required on create. On update it is optional but the column is NOT NULL, so clearing it fails at the database rather than at validation.' },
        { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'email', label: 'Email', updateOnly: true,
          hint: 'Editing only. `StoreCustomerRequest` has no rule for email, so an address given at create is accepted, discarded and never stored — the field is hidden there rather than losing what you type.' },
      ]}
      toForm={(c) => ({
        name: c.name ?? '', phone: c.phone ?? '', address: c.address ?? '', email: c.email ?? '',
      })}
      create={(body) => customersApi.create(body)}
      update={(id, body) => customersApi.update(id, body)}
      remove={(id) => customersApi.remove(id)}
    >
      <p className="ds-caption rst-footnote">
        A customer carries THREE name columns — `name`, `first_name` and `last_name`. Neither admin
        write contract mentions the other two, so this form writes `name` only, exactly as the
        source console does; the captain app writes all three. The list above therefore falls back
        to `first_name last_name` for anyone the phone created.
      </p>
    </ResourcePage>
  );
}
