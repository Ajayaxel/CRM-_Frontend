'use client';

/**
 * Memberships — the recurring clients.
 *
 * The dashboard strip at the top is the answer to "how is the recurring book
 * doing": active, expiring, renewals due and MRR, all counted from the rows in
 * the list underneath rather than from anywhere else.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Receipt, RefreshCw, Users2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Skeleton,
  StatCard, Timeline, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { toneForInvoiceStatus, toneForMembershipStatus } from '../ui/tone';
import {
  DateRange, Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, money, relativeDays, toDateInput, useListState,
} from '../ui/common';

interface MembershipRow {
  id: string; reference: string; status: string; startDate: string; endDate: string;
  seats: number; priceInr: number; discountInr: number; billingCycle: string;
  includedHours: number; usedHours: number; includedDays: number; usedDays: number; autoRenew: boolean;
  customer: { id: string; name: string; reference: string; kind: string; email?: string | null };
  plan: { id: string; name: string; type: string; billingCycle: string };
  space?: { id: string; name: string; code: string } | null;
  _count: { users: number; bookings: number };
}

export function CoworkingMemberships() {
  const qc = useQueryClient();
  const { state, set, params } = useListState({ sort: 'endDate', dir: 'asc' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data: dash } = useQuery({
    queryKey: ['cw-membership-dashboard'],
    queryFn: async () => (await api.get<{ active: number; expiring: number; expired: number; renewalsDue: number; renewalsUpcoming: number; mrrInr: number; arrInr: number }>('/coworking/memberships/dashboard')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['cw-memberships', params],
    queryFn: async () => (await api.get<{ data: MembershipRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/memberships', { params })).data,
  });

  const columns: DataTableColumn<MembershipRow>[] = [
    {
      key: 'customer', header: 'Member', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.customer.name}</span>
          <span className="ds-caption">{r.reference} · {r.plan.name}</span>
        </span>
      ),
    },
    { key: 'space', header: 'Space', render: (r) => r.space?.name ?? <span className="ds-caption">Flexible</span> },
    { key: 'seats', header: 'Seats', align: 'right', render: (r) => `${r._count.users}/${r.seats}` },
    {
      key: 'usage', header: 'Allowance',
      render: (r) => r.includedHours > 0
        ? `${r.usedHours}/${r.includedHours} h`
        : r.includedDays > 0 ? `${r.usedDays}/${r.includedDays} d` : <span className="ds-caption">Unlimited</span>,
    },
    { key: 'priceInr', header: 'Price', align: 'right', sortable: true, render: (r) => money(r.priceInr * r.seats - r.discountInr) },
    {
      key: 'endDate', header: 'Expires', sortable: true,
      render: (r) => <span><span style={{ display: 'block' }}>{fmtDate(r.endDate)}</span><span className="ds-caption">{relativeDays(r.endDate)}</span></span>,
    },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge tone={toneForMembershipStatus(r.status)}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Memberships"
        subtitle="Recurring clients, their space and their allowance."
        actions={<button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />New membership</button>}
      />

      {dash && (
        <div className="ds-grid ds-grid-kpi" style={{ marginBottom: 20 }}>
          <StatCard label="Active" value={dash.active} icon={Users2} tone="active" />
          <StatCard label="Expiring in 30 days" value={dash.expiring} tone="renewal" />
          <StatCard label="Renewals due" value={dash.renewalsDue} icon={RefreshCw} tone="claim" />
          <StatCard label="MRR" value={money(dash.mrrInr)} tone="info" />
          <StatCard label="ARR" value={money(dash.arrInr)} tone="info" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Member, reference…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['DRAFT', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRING', 'EXPIRED', 'CANCELLED']} />
        <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setOpenId(r.id)}
          empty={<EmptyState compact icon={Users2} title="No memberships yet" body="Sell a plan to a customer and the renewal clock starts." actionLabel="New membership" onAction={() => setNewOpen(true)} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      {newOpen && <NewMembership onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); qc.invalidateQueries({ queryKey: ['cw-memberships'] }); }} />}
      {openId && <MembershipRecord id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ────────────────────────────────────────────────── new membership */

function NewMembership({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    customerId: '', planId: '', spaceId: '', startDate: toDateInput(),
    periods: '1', seats: '1', priceInr: '', discountInr: '0', autoRenew: true, createInvoice: true, notes: '',
  });

  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; reference: string }[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
  });
  const { data: plans } = useQuery({
    queryKey: ['cw-plans-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; priceInr: number; userLimit: number; billingCycle: string }[] }>('/coworking/plans', { params: { limit: 100, status: 'ACTIVE' } })).data.data,
  });
  const { data: spaces } = useQuery({
    queryKey: ['cw-spaces-picker-all'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; code: string }[] }>('/coworking/spaces', { params: { limit: 200 } })).data.data,
  });

  const plan = plans?.find((p) => p.id === form.planId);

  const create = useMutation({
    mutationFn: () => api.post('/coworking/memberships', {
      customerId: form.customerId, planId: form.planId,
      spaceId: form.spaceId || undefined,
      startDate: new Date(form.startDate).toISOString(),
      periods: Number(form.periods) || 1,
      seats: Number(form.seats) || 1,
      priceInr: form.priceInr === '' ? undefined : Number(form.priceInr),
      discountInr: Number(form.discountInr) || 0,
      autoRenew: form.autoRenew,
      notes: form.notes.trim() || undefined,
      createInvoice: form.createInvoice,
    }),
    onSuccess: () => { toast.success('Membership created'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose} title="New membership" width={540}
      actions={
        <button className="btn-primary btn-sm" disabled={!form.customerId || !form.planId || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
      }
    >
      <FormSection title="Who and what">
        <Field label="Customer" required span={2}>
          <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Choose…</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.reference})</option>)}
          </select>
        </Field>
        <Field label="Plan" required span={2}>
          <select className="input" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
            <option value="">Choose…</option>
            {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.priceInr)} / {humanStatus(p.billingCycle).toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Assigned space" hint="Dedicated desks and private offices only.">
          <select className="input" value={form.spaceId} onChange={(e) => setForm({ ...form, spaceId: e.target.value })}>
            <option value="">Flexible / hot desk</option>
            {(spaces ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Seats" hint={plan ? `Plan allows ${plan.userLimit}.` : undefined}>
          <input className="input" type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
        </Field>
      </FormSection>

      <FormSection title="Term and money">
        <Field label="Starts"><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="Periods" hint="How many billing cycles the term runs for."><input className="input" type="number" min={1} value={form.periods} onChange={(e) => setForm({ ...form, periods: e.target.value })} /></Field>
        <Field label="Price override" hint={plan ? `Plan price is ${money(plan.priceInr)}.` : undefined}>
          <input className="input" type="number" min={0} value={form.priceInr} onChange={(e) => setForm({ ...form, priceInr: e.target.value })} placeholder={plan ? String(plan.priceInr) : ''} />
        </Field>
        <Field label="Discount"><input className="input" type="number" min={0} value={form.discountInr} onChange={(e) => setForm({ ...form, discountInr: e.target.value })} /></Field>
        <Field label="Notes" span={2}><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })} />
            Renew automatically
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={form.createInvoice} onChange={(e) => setForm({ ...form, createInvoice: e.target.checked })} />
            Raise the first invoice now (includes setup fee and deposit)
          </label>
        </div>
      </FormSection>
    </Drawer>
  );
}

/* ─────────────────────────────────────────────── membership record */

interface MembershipDetail extends MembershipRow {
  users: { id: string; name: string; email?: string | null; isActive: boolean }[];
  addOns: { id: string; quantity: number; unitPriceInr: number; service: { name: string } }[];
  renewals: { id: string; reference: string; status: string; renewalDate: string; amountInr: number }[];
  bookings: { id: string; reference: string; startAt: string; space: { name: string } }[];
  activities: { id: string; title: string; body?: string | null; at: string }[];
  invoices: { id: string; number: string; status: string; totalInr: number; amountPaidInr: number; issueDate: string }[];
  allowance: {
    hours: { included: number; used: number; left: number };
    days: { included: number; used: number; left: number };
    seats: { limit: number; used: number };
  };
  notes?: string | null;
}

function MembershipRecord({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [usage, setUsage] = useState({ hours: '', days: '' });

  const { data: m, isLoading } = useQuery({
    queryKey: ['cw-membership', id],
    queryFn: async () => (await api.get<MembershipDetail>(`/coworking/memberships/${id}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cw-membership', id] });
    qc.invalidateQueries({ queryKey: ['cw-memberships'] });
    qc.invalidateQueries({ queryKey: ['cw-membership-dashboard'] });
  };

  const recordUsage = useMutation({
    mutationFn: () => api.post(`/coworking/memberships/${id}/usage`, {
      hours: usage.hours ? Number(usage.hours) : undefined,
      days: usage.days ? Number(usage.days) : undefined,
    }),
    onSuccess: () => { toast.success('Usage recorded'); setUsage({ hours: '', days: '' }); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const invoice = useMutation({
    mutationFn: () => api.post(`/coworking/memberships/${id}/invoice`, {}),
    onSuccess: () => { toast.success('Invoice raised'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => api.post(`/coworking/memberships/${id}/cancel`, { reason }),
    onSuccess: () => { toast.success('Membership cancelled'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose}
      title={m?.customer.name ?? 'Membership'}
      subtitle={m ? `${m.reference} · ${m.plan.name}` : undefined}
      tabs={['Overview', 'Usage', 'Money', 'History']}
      activeTab={tab} onTab={setTab}
      width={580}
      actions={m && <Badge tone={toneForMembershipStatus(m.status)}>{humanStatus(m.status)}</Badge>}
    >
      {isLoading || !m ? (
        <Skeleton rows={4} height={60} />
      ) : tab === 'Overview' ? (
        <div style={{ display: 'grid', gap: 22 }}>
          <DetailGrid>
            <Detail label="Plan" value={m.plan.name} />
            <Detail label="Space" value={m.space?.name ?? 'Flexible'} />
            <Detail label="Term" value={`${fmtDate(m.startDate)} → ${fmtDate(m.endDate)}`} />
            <Detail label="Expires" value={relativeDays(m.endDate)} />
            <Detail label="Seats" value={`${m.allowance.seats.used} of ${m.allowance.seats.limit}`} />
            <Detail label="Price" value={money(m.priceInr * m.seats - m.discountInr)} />
            <Detail label="Auto-renew" value={m.autoRenew ? 'Yes' : 'No'} />
            <Detail label="Bookings" value={m._count.bookings} />
          </DetailGrid>

          {m.users.length > 0 && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Named users</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {m.users.map((u) => (
                  <div key={u.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                    <span>{u.name}</span>
                    <span className="ds-caption" style={{ marginLeft: 'auto' }}>{u.email ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {m.addOns.length > 0 && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Recurring services</h3>
              {m.addOns.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                  <span>{a.service.name} × {a.quantity}</span>
                  <span className="ds-caption" style={{ marginLeft: 'auto' }}>{money(a.unitPriceInr * a.quantity)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-ghost btn-sm" disabled={invoice.isPending} onClick={() => invoice.mutate()}>
              <Receipt size={13} style={{ marginRight: 6 }} />Raise an invoice
            </button>
            {m.status !== 'CANCELLED' && (
              <button
                className="btn-danger btn-sm"
                onClick={() => {
                  const reason = window.prompt('Why is the membership being cancelled?');
                  if (reason) cancel.mutate(reason);
                }}
              >Cancel membership</button>
            )}
          </div>

          {m.notes && <div><h3 className="ds-h3" style={{ marginBottom: 6 }}>Notes</h3><p className="ds-body">{m.notes}</p></div>}
        </div>
      ) : tab === 'Usage' ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <DetailGrid>
            <Detail label="Included hours" value={m.allowance.hours.included || '—'} />
            <Detail label="Used" value={m.allowance.hours.used} />
            <Detail label="Left" value={m.allowance.hours.left} />
            <Detail label="Included days" value={m.allowance.days.included || '—'} />
            <Detail label="Used" value={m.allowance.days.used} />
            <Detail label="Left" value={m.allowance.days.left} />
          </DetailGrid>

          {(m.allowance.hours.used > m.allowance.hours.included || m.allowance.days.used > m.allowance.days.included) && (
            <Card pad={14} tone="renewal">
              <div style={{ fontSize: 13 }}>
                Beyond the allowance. The next invoice bills the overage at the plan&apos;s extra rates.
              </div>
            </Card>
          )}

          <div>
            <h3 className="ds-h3" style={{ marginBottom: 8 }}>Record usage outside the booking system</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" min={0} placeholder="Hours" value={usage.hours} onChange={(e) => setUsage({ ...usage, hours: e.target.value })} />
              <input className="input" type="number" min={0} placeholder="Days" value={usage.days} onChange={(e) => setUsage({ ...usage, days: e.target.value })} />
              <button className="btn-primary btn-sm" disabled={(!usage.hours && !usage.days) || recordUsage.isPending} onClick={() => recordUsage.mutate()}>Record</button>
            </div>
          </div>

          {m.bookings.length > 0 && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Recent bookings</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {m.bookings.map((b) => (
                  <div key={b.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                    <span>{b.space.name}</span>
                    <span className="ds-caption" style={{ marginLeft: 'auto' }}>{fmtDate(b.startAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : tab === 'Money' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {m.invoices.map((i) => (
            <div key={i.id} className="ds-list-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13 }}>{i.number}</div>
                <div className="ds-caption">{fmtDate(i.issueDate)}</div>
              </div>
              <span style={{ fontSize: 13 }}>{money(i.amountPaidInr)} / {money(i.totalInr)}</span>
              <Badge tone={toneForInvoiceStatus(i.status)}>{humanStatus(i.status)}</Badge>
            </div>
          ))}
          {!m.invoices.length && <div className="ds-caption">Nothing invoiced yet.</div>}

          {m.renewals.length > 0 && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Renewals</h3>
              {m.renewals.map((r) => (
                <div key={r.id} className="ds-list-row">
                  <span style={{ fontSize: 13 }}>{r.reference}</span>
                  <span className="ds-caption" style={{ marginLeft: 'auto' }}>{fmtDate(r.renewalDate)} · {money(r.amountInr)} · {humanStatus(r.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        !m.activities.length ? <EmptyState compact title="Nothing recorded yet" /> : (
          <Timeline items={m.activities.map((a) => ({ at: a.at, title: a.title, detail: a.body ?? undefined }))} />
        )
      )}
    </Drawer>
  );
}
