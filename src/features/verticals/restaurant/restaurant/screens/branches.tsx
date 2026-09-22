'use client';

/**
 * Branches — the entity three other screens already depend on and none of them
 * could manage.
 *
 * The floors, suppliers and discounts forms all offer a branch select fed from
 * `GET /branches`, and until now the only way to get a branch into that list
 * was a seed or the API directly. `Branches/{Index,Create,Edit}` in the source
 * is a first-class screen; the ported API has had full CRUD the whole time.
 *
 * TWO THINGS THIS SCREEN HAS TO GET RIGHT.
 *
 * `is_active` on UPDATE is `['boolean']` with no `nullable`, and the repository
 * writes it straight through — so an update that OMITS the flag deactivates the
 * branch. The scaffold always sends every declared field, prefilled from the
 * stored row, so the key is never absent; that is what makes the checkbox safe
 * here rather than a way to switch a branch off by editing its phone number.
 *
 * `payment_method` is validated against TWO different lists depending on which
 * endpoint writes it. Create and update accept `PaymentTypeConsts` — cash,
 * card, bank_transfer, mobile_wallet — while `PATCH /branches/payment-method`
 * accepts `PaymentGatewayConsts`, which drops bank_transfer and mobile_wallet
 * and adds upi, digital_wallets and online_gateway. This form writes through
 * create/update, so it offers the first list, from the server's own form-data.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { branches } from '../restaurant-client';
import type { RstBranchRow } from '../restaurant-client';

/** `takeaway` → `Takeaway`, using the server's own labels where it sent them. */
const labelFor = (opts: { name: string; value: string }[] | undefined, v: string) =>
  opts?.find((o) => o.value === v)?.name ?? v;

export function RestaurantBranches() {
  // A 403 here is the plan's branch cap, refused at the form rather than at the
  // save. `retry: false` so a deliberate refusal is not hammered four times.
  const { data: formData, error: formError } = useQuery({
    queryKey: ['rst', 'branches', 'form-data'],
    queryFn: () => branches.formData(),
    retry: false,
  });

  const columns: DataTableColumn<RstBranchRow>[] = [
    { key: 'name', header: 'Branch', sortable: true, render: (b) => b.name },
    { key: 'phone', header: 'Phone', width: 160, render: (b) => b.phone || '—' },
    { key: 'address', header: 'Address', render: (b) => b.address || '—' },
    {
      key: 'order_type', header: 'Order types',
      render: (b) => (b.order_type ?? []).map((t) => labelFor(formData?.orderTypes, t)).join(', ') || '—',
    },
    {
      key: 'active', header: 'Status', width: 120,
      render: (b) => <Status tone={b.is_active ? 'active' : 'neutral'}>{b.is_active ? 'Active' : 'Inactive'}</Status>,
    },
  ];

  return (
    <ResourcePage<RstBranchRow>
      title="Branches"
      singular="Branch"
      subtitle="The places this restaurant trades from."
      icon={Building2}
      queryKey={['rst', 'branches']}
      load={() => branches.list()}
      search={{ match: (b, q) => [b.name, b.phone, b.address].some((v) => (v ?? '').toLowerCase().includes(q)) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'registration_number', label: 'Registration number' },
        {
          name: 'country_id', label: 'Country', type: 'select',
          options: (formData?.countries ?? []).map((c) => ({ label: c.name, value: c.id })),
        },
        {
          name: 'currency_id', label: 'Currency', type: 'select',
          options: (formData?.currencies ?? []).map((c) => ({ label: c.currency, value: c.id })),
        },
        {
          name: 'time_zone_id', label: 'Time zone', type: 'select',
          options: (formData?.timezones ?? []).map((t) => ({ label: t.label ?? t.name, value: t.id })),
        },
        {
          name: 'order_type', label: 'Order types', type: 'multiselect',
          options: (formData?.orderTypes ?? []).map((o) => ({ label: o.name, value: o.value })),
        },
        {
          name: 'payment_method', label: 'Payment methods', type: 'multiselect',
          options: (formData?.paymentMethods ?? []).map((p) => ({ label: p.name, value: p.value })),
          hint: 'These four are what create and update accept. The separate payment-method endpoint accepts a different list — it drops two of these and adds UPI, digital wallets and online gateway.',
        },
        { name: 'cash_difference_threshold', label: 'Cash difference threshold', type: 'number' },
        { name: 'is_active', label: 'Active', type: 'checkbox',
          hint: 'Always sent. On update the source writes this flag straight through, so an edit that omitted it would switch the branch off.' },
        // `low_stock_alerts`, `opening_time` and `closing_time` are columns on
        // the row and are in NEITHER write contract — low_stock_alerts has its
        // own `PATCH /branches/inventory-setup`, and the two times are written
        // by nothing at all. Offering any of them here would 422.
      ]}
      toForm={(b) => ({
        name: b.name, email: b.email ?? '', phone: b.phone ?? '', address: b.address ?? '',
        registration_number: b.registration_number ?? '',
        country_id: b.country_id ?? '', currency_id: b.currency_id ?? '',
        time_zone_id: b.time_zone_id ?? '',
        order_type: b.order_type ?? [], payment_method: b.payment_method ?? [],
        cash_difference_threshold: b.cash_difference_threshold ?? '',
        is_active: !!b.is_active,
      })}
      create={(body) => branches.create(body)}
      update={(id, body) => branches.update(id, body)}
      remove={(id) => branches.remove(id)}
    >
      {formError ? (
        <p className="ds-caption rst-footnote">
          The branch form is unavailable — <code>/branches/form-data</code> was refused, which is
          how the source reports that the subscription&rsquo;s branch limit has been reached. The
          list below still reads; creating another branch needs a higher plan.
        </p>
      ) : (
        <p className="ds-caption rst-footnote">
          Opening and closing times and the low-stock alert flag are columns on a branch that
          neither write contract accepts — the alert flag has its own endpoint and the two times
          are written by nothing, so none of the three is offered here.
        </p>
      )}
    </ResourcePage>
  );
}
