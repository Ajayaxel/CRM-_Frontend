'use client';

/**
 * Customers and companies — the 360 view.
 *
 * Individuals and companies are one table with a `kind`, because everything
 * hung off them is the same: memberships, bookings, contracts, documents,
 * invoices and the communication history. Two tables would have meant two of
 * every relation and a screen that could only ever show half a customer.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, User } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Segmented,
  Skeleton, Timeline, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { toneForInvoiceStatus, toneForMembershipStatus } from '../ui/tone';
import {
  Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, fmtDateTime, money, relativeDays, useListState,
} from '../ui/common';

interface CustomerRow {
  id: string; reference: string; kind: string; name: string; email?: string | null; phone?: string | null;
  companyName?: string | null; status: string; createdAt: string;
  _count: { memberships: number; bookings: number; contacts: number; contracts: number };
  memberships: { id: string; reference: string; endDate: string; plan: { name: string } }[];
}

const emptyCustomer = {
  kind: 'INDIVIDUAL', name: '', email: '', phone: '', companyName: '',
  registrationNo: '', taxId: '', idType: '', idNumber: '',
  address: '', city: '', country: '', billingEmail: '', paymentTermsDays: '0', notes: '',
};

export function CoworkingCustomers() {
  const qc = useQueryClient();
  const { state, set, params } = useListState({ sort: 'createdAt', dir: 'desc' });
  const [kind, setKind] = useState<'All' | 'People' | 'Companies'>('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(emptyCustomer);

  const listParams = { ...params, ...(kind === 'People' ? { type: 'INDIVIDUAL' } : kind === 'Companies' ? { type: 'COMPANY' } : {}) };

  const { data, isLoading } = useQuery({
    queryKey: ['cw-customers', listParams],
    queryFn: async () => (await api.get<{ data: CustomerRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/customers', { params: listParams })).data,
  });

  const create = useMutation({
    mutationFn: () => api.post('/coworking/customers', {
      kind: form.kind,
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      registrationNo: form.registrationNo.trim() || undefined,
      taxId: form.taxId.trim() || undefined,
      idType: form.idType.trim() || undefined,
      idNumber: form.idNumber.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      billingEmail: form.billingEmail.trim() || undefined,
      paymentTermsDays: Number(form.paymentTermsDays) || 0,
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Customer added'); setNewOpen(false); setForm(emptyCustomer); qc.invalidateQueries({ queryKey: ['cw-customers'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: 'name', header: 'Customer', sortable: true,
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {r.kind === 'COMPANY' ? <Building2 size={14} style={{ color: 'var(--ink-3)', flex: 'none' }} /> : <User size={14} style={{ color: 'var(--ink-3)', flex: 'none' }} />}
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            <span className="ds-caption">{r.reference}{r.companyName && r.kind !== 'COMPANY' ? ` · ${r.companyName}` : ''}</span>
          </span>
        </div>
      ),
    },
    { key: 'phone', header: 'Contact', render: (r) => r.phone || r.email || '—' },
    {
      key: 'memberships', header: 'Membership',
      render: (r) => r.memberships.length
        ? <span><span style={{ display: 'block' }}>{r.memberships[0].plan.name}</span><span className="ds-caption">expires {relativeDays(r.memberships[0].endDate)}</span></span>
        : <span className="ds-caption">None</span>,
    },
    { key: 'bookings', header: 'Bookings', align: 'right', render: (r) => r._count.bookings },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'ACTIVE' ? 'active' : r.status === 'BLACKLISTED' ? 'expired' : 'neutral'}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Customers"
        subtitle="People and companies, and everything they have with you."
        actions={
          <>
            <Segmented options={['All', 'People', 'Companies']} value={kind} onChange={(v) => { setKind(v as typeof kind); set({ page: 1 }); }} />
            <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />Add customer</button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Name, reference, phone…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['ACTIVE', 'INACTIVE', 'BLACKLISTED']} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setOpenId(r.id)}
          empty={<EmptyState compact icon={User} title="No customers yet" body="Convert a lead, or add one directly." actionLabel="Add customer" onAction={() => setNewOpen(true)} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Drawer
        open={newOpen} onClose={() => setNewOpen(false)} title="Add a customer" width={560}
        actions={<button className="btn-primary btn-sm" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>Save</button>}
      >
        <FormSection title="Who">
          <Field label="Type">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="COMPANY">Company</option>
            </select>
          </Field>
          <Field label={form.kind === 'COMPANY' ? 'Company name' : 'Full name'} required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          {form.kind === 'INDIVIDUAL' && (
            <>
              <Field label="Works for"><input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
              <Field label="ID type"><input className="input" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })} placeholder="Passport / Emirates ID" /></Field>
              <Field label="ID number"><input className="input" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></Field>
            </>
          )}
          {form.kind === 'COMPANY' && (
            <>
              <Field label="Registration no."><input className="input" value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} /></Field>
              <Field label="Tax ID"><input className="input" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></Field>
            </>
          )}
        </FormSection>

        <FormSection title="Billing">
          <Field label="Billing email"><input className="input" type="email" value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} /></Field>
          <Field label="Payment terms (days)"><input className="input" type="number" min={0} value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} /></Field>
          <Field label="Address" span={2}><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="City"><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="Country"><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
          <Field label="Notes" span={2}><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </FormSection>
      </Drawer>

      {openId && <CustomerRecord id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────── customer 360 */

interface CustomerDetail extends CustomerRow {
  address?: string | null; city?: string | null; country?: string | null;
  billingEmail?: string | null; paymentTermsDays: number; notes?: string | null;
  idType?: string | null; idNumber?: string | null; registrationNo?: string | null; taxId?: string | null;
  contacts: { id: string; name: string; email?: string | null; phone?: string | null; designation?: string | null; isPrimary: boolean }[];
  memberships: { id: string; reference: string; status: string; startDate: string; endDate: string; seats: number; plan: { id: string; name: string }; space?: { id: string; name: string } | null }[];
  bookings: { id: string; reference: string; startAt: string; status: string; totalInr: number; space: { name: string } }[];
  contracts: { id: string; reference: string; status: string; startDate: string; endDate: string; valueInr: number }[];
  quotations: { id: string; reference: string; status: string; totalInr: number }[];
  siteVisits: { id: string; reference: string; scheduledAt: string; status: string }[];
  invoices: { id: string; number: string; status: string; totalInr: number; amountPaidInr: number; issueDate: string }[];
  documents: { id: string; name: string; createdAt: string }[];
  activities: { id: string; kind: string; title: string; body?: string | null; at: string }[];
  totals: { billedInr: number; paidInr: number; outstandingInr: number; bookings: number };
}

function CustomerRecord({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [contact, setContact] = useState({ name: '', email: '', phone: '', designation: '' });

  const { data: c, isLoading } = useQuery({
    queryKey: ['cw-customer', id],
    queryFn: async () => (await api.get<CustomerDetail>(`/coworking/customers/${id}`)).data,
  });

  const addContact = useMutation({
    mutationFn: () => api.post(`/coworking/customers/${id}/contacts`, {
      name: contact.name.trim(),
      email: contact.email.trim() || undefined,
      phone: contact.phone.trim() || undefined,
      designation: contact.designation.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Contact added'); setContact({ name: '', email: '', phone: '', designation: '' }); qc.invalidateQueries({ queryKey: ['cw-customer', id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const removeContact = useMutation({
    mutationFn: (contactId: string) => api.delete(`/coworking/contacts/${contactId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cw-customer', id] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose}
      title={c?.name ?? 'Customer'}
      subtitle={c ? `${c.reference} · ${humanStatus(c.kind)}` : undefined}
      tabs={['Overview', 'Memberships', 'Bookings', 'Money', 'Timeline']}
      activeTab={tab} onTab={setTab}
      counts={{ Memberships: c?.memberships.length, Bookings: c?.bookings.length, Money: c?.invoices.length }}
      width={620}
    >
      {isLoading || !c ? (
        <Skeleton rows={4} height={60} />
      ) : tab === 'Overview' ? (
        <div style={{ display: 'grid', gap: 22 }}>
          <DetailGrid>
            <Detail label="Email" value={c.email} />
            <Detail label="Phone" value={c.phone} />
            <Detail label="Billing email" value={c.billingEmail} />
            <Detail label="Payment terms" value={`${c.paymentTermsDays} days`} />
            <Detail label="Address" value={[c.address, c.city, c.country].filter(Boolean).join(', ') || '—'} />
            <Detail label={c.kind === 'COMPANY' ? 'Registration' : 'ID'} value={c.kind === 'COMPANY' ? c.registrationNo : `${c.idType ?? ''} ${c.idNumber ?? ''}`.trim()} />
            <Detail label="Billed" value={money(c.totals.billedInr)} />
            <Detail label="Outstanding" value={money(c.totals.outstandingInr)} />
          </DetailGrid>

          <div>
            <h3 className="ds-h3" style={{ marginBottom: 8 }}>Contacts</h3>
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {c.contacts.map((p) => (
                <div key={p.id} className="ds-list-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 560 }}>{p.name}{p.isPrimary ? ' · primary' : ''}</div>
                    <div className="ds-caption">{[p.designation, p.email, p.phone].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => removeContact.mutate(p.id)} aria-label="Remove contact"><Trash2 size={12} /></button>
                </div>
              ))}
              {!c.contacts.length && <div className="ds-caption">None yet.</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
              <input className="input" placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              <input className="input" placeholder="Role" value={contact.designation} onChange={(e) => setContact({ ...contact, designation: e.target.value })} />
              <input className="input" placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              <input className="input" placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              <button className="btn-ghost btn-sm" disabled={!contact.name.trim() || addContact.isPending} onClick={() => addContact.mutate()}>Add contact</button>
            </div>
          </div>

          {c.documents.length > 0 && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Documents</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {c.documents.map((d) => (
                  <div key={d.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                    <span>{d.name}</span>
                    <span className="ds-caption" style={{ marginLeft: 'auto' }}>{fmtDate(d.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.notes && <div><h3 className="ds-h3" style={{ marginBottom: 6 }}>Notes</h3><p className="ds-body">{c.notes}</p></div>}
        </div>
      ) : tab === 'Memberships' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {c.memberships.map((m) => (
            <Card key={m.id} pad={14}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.plan.name}</div>
                  <div className="ds-caption">{m.reference} · {m.seats} seat(s){m.space ? ` · ${m.space.name}` : ''}</div>
                </div>
                <Badge tone={toneForMembershipStatus(m.status)}>{humanStatus(m.status)}</Badge>
              </div>
              <div className="ds-caption" style={{ marginTop: 8 }}>{fmtDate(m.startDate)} → {fmtDate(m.endDate)} ({relativeDays(m.endDate)})</div>
            </Card>
          ))}
          {c.contracts.map((k) => (
            <Card key={k.id} pad={14}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Contract {k.reference}</div>
                  <div className="ds-caption">{fmtDate(k.startDate)} → {fmtDate(k.endDate)} · {money(k.valueInr)}</div>
                </div>
                <Badge tone={k.status === 'ACTIVE' ? 'active' : k.status === 'EXPIRING' ? 'renewal' : 'neutral'}>{humanStatus(k.status)}</Badge>
              </div>
            </Card>
          ))}
          {!c.memberships.length && !c.contracts.length && <EmptyState compact title="No memberships yet" />}
        </div>
      ) : tab === 'Bookings' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {c.bookings.map((b) => (
            <div key={b.id} className="ds-list-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13 }}>{b.space.name}</div>
                <div className="ds-caption">{b.reference} · {fmtDateTime(b.startAt)}</div>
              </div>
              <span className="ds-caption">{money(b.totalInr)}</span>
            </div>
          ))}
          {c.siteVisits.map((v) => (
            <div key={v.id} className="ds-list-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13 }}>Site visit {v.reference}</div>
                <div className="ds-caption">{fmtDateTime(v.scheduledAt)} · {humanStatus(v.status)}</div>
              </div>
            </div>
          ))}
          {!c.bookings.length && !c.siteVisits.length && <EmptyState compact title="No bookings yet" />}
        </div>
      ) : tab === 'Money' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <DetailGrid>
            <Detail label="Billed" value={money(c.totals.billedInr)} />
            <Detail label="Collected" value={money(c.totals.paidInr)} />
            <Detail label="Outstanding" value={money(c.totals.outstandingInr)} />
          </DetailGrid>
          <div style={{ display: 'grid', gap: 8 }}>
            {c.invoices.map((i) => (
              <div key={i.id} className="ds-list-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{i.number}</div>
                  <div className="ds-caption">{fmtDate(i.issueDate)}</div>
                </div>
                <span style={{ fontSize: 13 }}>{money(i.totalInr)}</span>
                <Badge tone={toneForInvoiceStatus(i.status)}>{humanStatus(i.status)}</Badge>
              </div>
            ))}
            {!c.invoices.length && <div className="ds-caption">Nothing invoiced yet.</div>}
          </div>
          {c.quotations.length > 0 && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Proposals</h3>
              {c.quotations.map((q) => (
                <div key={q.id} className="ds-list-row">
                  <span style={{ fontSize: 13 }}>{q.reference}</span>
                  <span className="ds-caption" style={{ marginLeft: 'auto' }}>{money(q.totalInr)} · {humanStatus(q.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        !c.activities.length ? <EmptyState compact title="Nothing recorded yet" /> : (
          <Timeline items={c.activities.map((a) => ({ at: a.at, title: a.title, detail: a.body ?? undefined }))} />
        )
      )}
    </Drawer>
  );
}
