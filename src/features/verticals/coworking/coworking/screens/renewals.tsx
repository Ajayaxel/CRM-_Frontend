'use client';

/**
 * The renewal queue.
 *
 * A renewal record exists from the day a membership is created and points at
 * its current end date, so "what is expiring" is a query rather than a
 * calculation somebody has to remember to run. Reminders go out at 30, 15, 7
 * and 1 day, once per offset ever.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, humanStatus, type DataTableColumn } from '../ui/kit';
import { toneForRenewalStatus } from '../ui/tone';
import {
  DateRange, Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, money, relativeDays, useListState,
} from '../ui/common';

interface RenewalRow {
  id: string; reference: string; status: string; expiryDate: string; renewalDate: string;
  periodMonths: number; amountInr: number; remindersSent: number[]; notes?: string | null;
  membership: {
    id: string; reference: string; seats: number; endDate: string;
    customer: { id: string; name: string; email?: string | null; phone?: string | null };
    plan: { id: string; name: string };
    space?: { id: string; name: string } | null;
  };
  oldPlan?: { id: string; name: string } | null;
  newPlan?: { id: string; name: string } | null;
}

export function CoworkingRenewals() {
  const qc = useQueryClient();
  const { state, set, params } = useListState({ status: '' });
  const [open, setOpen] = useState<RenewalRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cw-renewals', params],
    queryFn: async () => (await api.get<{ data: RenewalRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/renewals', { params })).data,
  });

  const { data: plans } = useQuery({
    queryKey: ['cw-plans-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; priceInr: number }[] }>('/coworking/plans', { params: { limit: 100, status: 'ACTIVE' } })).data.data,
  });

  const columns: DataTableColumn<RenewalRow>[] = [
    {
      key: 'customer', header: 'Member',
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.membership.customer.name}</span>
          <span className="ds-caption">{r.membership.plan.name} · {r.reference}</span>
        </span>
      ),
    },
    { key: 'space', header: 'Space', render: (r) => r.membership.space?.name ?? <span className="ds-caption">Flexible</span> },
    {
      key: 'expiryDate', header: 'Expires', sortable: true,
      render: (r) => <span><span style={{ display: 'block' }}>{fmtDate(r.expiryDate)}</span><span className="ds-caption">{relativeDays(r.expiryDate)}</span></span>,
    },
    { key: 'amountInr', header: 'Amount', align: 'right', sortable: true, render: (r) => money(r.amountInr) },
    { key: 'remindersSent', header: 'Reminders', render: (r) => r.remindersSent.length ? r.remindersSent.map((d) => `${d}d`).join(', ') : <span className="ds-caption">None yet</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={toneForRenewalStatus(r.status)}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead title="Renewals" subtitle="Every membership term coming to an end." />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Member or reference…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['UPCOMING', 'DUE', 'IN_PROGRESS', 'RENEWED', 'EXPIRED', 'CANCELLED']} />
        <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setOpen(r)}
          empty={<EmptyState compact icon={RefreshCw} title="Nothing to renew" body="Renewal records appear as soon as a membership exists." />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      {open && (
        <RenewalDrawer
          renewal={open}
          plans={plans ?? []}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            qc.invalidateQueries({ queryKey: ['cw-renewals'] });
            qc.invalidateQueries({ queryKey: ['cw-memberships'] });
            qc.invalidateQueries({ queryKey: ['cw-dashboard'] });
          }}
        />
      )}
    </div>
  );
}

function RenewalDrawer({
  renewal, plans, onClose, onDone,
}: {
  renewal: RenewalRow;
  plans: { id: string; name: string; priceInr: number }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [newPlanId, setNewPlanId] = useState('');
  const [periodMonths, setPeriodMonths] = useState(String(renewal.periodMonths || 1));
  const [amountInr, setAmountInr] = useState(String(renewal.amountInr));
  const [createInvoice, setCreateInvoice] = useState(true);
  const [notes, setNotes] = useState('');

  const renew = useMutation({
    mutationFn: () => api.post(`/coworking/renewals/${renewal.id}/renew`, {
      newPlanId: newPlanId || undefined,
      periodMonths: Number(periodMonths) || 1,
      amountInr: Number(amountInr) || 0,
      createInvoice,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Renewed'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/coworking/renewals/${renewal.id}/status`, { status }),
    onSuccess: () => { toast.success('Updated'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const done = renewal.status === 'RENEWED' || renewal.status === 'CANCELLED';

  return (
    <Drawer
      open onClose={onClose}
      title={renewal.membership.customer.name}
      subtitle={`${renewal.reference} · expires ${fmtDate(renewal.expiryDate)}`}
      width={520}
      actions={<Badge tone={toneForRenewalStatus(renewal.status)}>{humanStatus(renewal.status)}</Badge>}
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <DetailGrid>
          <Detail label="Membership" value={renewal.membership.reference} />
          <Detail label="Current plan" value={renewal.oldPlan?.name ?? renewal.membership.plan.name} />
          <Detail label="Space" value={renewal.membership.space?.name ?? 'Flexible'} />
          <Detail label="Seats" value={renewal.membership.seats} />
          <Detail label="Expires" value={`${fmtDate(renewal.expiryDate)} (${relativeDays(renewal.expiryDate)})`} />
          <Detail label="Reminders sent" value={renewal.remindersSent.length ? renewal.remindersSent.map((d) => `${d} days`).join(', ') : 'None yet'} />
          <Detail label="Email" value={renewal.membership.customer.email} />
          <Detail label="Phone" value={renewal.membership.customer.phone} />
        </DetailGrid>

        {done ? (
          <Card pad={14}>
            <div style={{ fontSize: 13 }}>
              This renewal is {humanStatus(renewal.status).toLowerCase()}
              {renewal.newPlan ? ` on ${renewal.newPlan.name}` : ''}. The next one opens automatically against the new term.
            </div>
          </Card>
        ) : (
          <>
            <FormSection title="Renew" description="The new term starts where the old one ended, so a renewal processed late does not cost the member the difference.">
              <Field label="Plan" hint="Leave blank to keep the current plan.">
                <select className="input" value={newPlanId} onChange={(e) => {
                  setNewPlanId(e.target.value);
                  const p = plans.find((x) => x.id === e.target.value);
                  if (p) setAmountInr(String(p.priceInr * renewal.membership.seats));
                }}>
                  <option value="">Keep {renewal.membership.plan.name}</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.priceInr)}</option>)}
                </select>
              </Field>
              <Field label="Months"><input className="input" type="number" min={1} value={periodMonths} onChange={(e) => setPeriodMonths(e.target.value)} /></Field>
              <Field label="Amount"><input className="input" type="number" min={0} value={amountInr} onChange={(e) => setAmountInr(e.target.value)} /></Field>
              <Field label="Notes" span={2}><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={createInvoice} onChange={(e) => setCreateInvoice(e.target.checked)} />
                  Raise the renewal invoice
                </label>
              </div>
            </FormSection>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-primary btn-sm" disabled={renew.isPending} onClick={() => renew.mutate()}>
                {renew.isPending ? 'Renewing…' : 'Renew now'}
              </button>
              {renewal.status !== 'IN_PROGRESS' && (
                <button className="btn-ghost btn-sm" onClick={() => setStatus.mutate('IN_PROGRESS')}>Mark in progress</button>
              )}
              <button className="btn-ghost btn-sm" onClick={() => setStatus.mutate('CANCELLED')}>Not renewing</button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
