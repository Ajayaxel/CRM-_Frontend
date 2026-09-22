'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Badge, Card, DataTable, DataTableColumn, Drawer, EmptyState, Field, FormSection,
  Modal, SectionTitle, StatCard, humanStatus,
} from '../ui/kit';
import { Detail, DetailGrid, PageHead, Pagination, SearchBox, fmtDate, money, toDateInput, useListState } from '../ui/common';
import { paiseRate } from '../ui/tone';

interface PartyRow {
  id: string; code: string; name: string; phone?: string | null; address?: string | null;
  paymentTermsDays: number; businessTerms?: string | null; openingReceivableInr: number;
  openingDate: string; isActive: boolean; notes?: string | null;
  defaultRatePaisePerKg: number;
  /** Set when this customer is another company in the same group. */
  counterpartyOrgId?: string | null;
}

interface PartyBalance {
  partyId: string; name: string; openingInr: number; salesInr: number; receiptsInr: number;
  balance: number; suppliedKg: number; suppliedBirds: number;
}

interface StatementRow {
  date: string; ref: string; particulars: string; debitInr: number; creditInr: number;
  balanceInr: number; mode?: string | null; voucherNo?: string | null;
}

interface PartySaleRow {
  id: string; reference: string; date: string; birds: number; weightKg: number;
  ratePaisePerKg: number; amountInr: number; party: { name: string };
}

interface PartyReceiptRow {
  id: string; reference: string; date: string; amountInr: number; mode: string;
  voucherNo?: string | null; party: { name: string };
}

interface PickupOption { id: string; reference: string; weightKg: number; batch: { code: string } }

const DRAWER_TABS = ['Statement', 'Activity', 'Details'];

export function PoultryParties() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canSupply = hasPermission('poultry.supply');
  const { state, set, params } = useListState({ sort: 'name', dir: 'asc' });
  const [active, setActive] = useState<PartyRow | null>(null);
  const [tab, setTab] = useState('Statement');
  const [modal, setModal] = useState<'create' | 'edit' | 'supply' | 'receipt' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['py-parties', params],
    queryFn: async () => (await api.get<{ data: PartyRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/parties', { params },
    )).data,
  });
  const { data: dash } = useQuery({
    queryKey: ['py-dashboard'],
    queryFn: async () => (await api.get<{ supply: { partyReceivableInr: number; monthSalesInr: number } }>('/poultry/dashboard')).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-parties'] });
    qc.invalidateQueries({ queryKey: ['py-party-balance'] });
    qc.invalidateQueries({ queryKey: ['py-party-statement'] });
    qc.invalidateQueries({ queryKey: ['py-party-sales'] });
    qc.invalidateQueries({ queryKey: ['py-party-receipts'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const columns: DataTableColumn<PartyRow>[] = [
    { key: 'code', header: 'Code', width: 100, render: (p) => <span style={{ fontWeight: 600 }}>{p.code}</span> },
    { key: 'name', header: 'Party', render: (p) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{p.name}</div>
        {p.address && <div className="ds-caption">{p.address}</div>}
      </div>
    ) },
    { key: 'phone', header: 'Phone', width: 140, render: (p) => p.phone ?? <span className="ds-caption">—</span> },
    { key: 'paymentTermsDays', header: 'Terms', align: 'right', width: 90, render: (p) => `${p.paymentTermsDays}d` },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Party supply"
        subtitle="Chicken-supply party leaders — what they took, what they paid, what remains"
        actions={canSupply && (
          <>
            <button className="btn-secondary" onClick={() => setModal('supply')}>Record supply</button>
            <button className="btn-secondary" onClick={() => setModal('receipt')}>Record receipt</button>
            <button className="btn-primary" onClick={() => setModal('create')}>New party</button>
          </>
        )}
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Party receivable" value={money(dash?.supply.partyReceivableInr)} tone="sales" hint="Across every active party" />
        <StatCard label="Month supply sales" value={money(dash?.supply.monthSalesInr)} tone="active" hint="Billed to parties this month" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search party, code, phone…" />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(p) => p.id}
          loading={isLoading}
          onRowClick={(p) => { setActive(p); setTab('Statement'); }}
          empty={<EmptyState title="No parties yet" body="Add the party leaders you supply chicken to." actionLabel={canSupply ? 'New party' : undefined} onAction={canSupply ? () => setModal('create') : undefined} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Drawer
        open={!!active && modal !== 'edit'}
        onClose={() => setActive(null)}
        title={active?.name ?? ''}
        subtitle={active ? `${active.code}${active.phone ? ` · ${active.phone}` : ''}` : undefined}
        tabs={DRAWER_TABS}
        activeTab={tab}
        onTab={setTab}
        width={720}
      >
        {active && tab === 'Statement' && <PartyStatement party={active} />}
        {active && tab === 'Activity' && <PartyActivity partyId={active.id} />}
        {active && tab === 'Details' && (
          <PartyDetails party={active} canEdit={canSupply} onEdit={() => setModal('edit')} />
        )}
      </Drawer>

      <PartyModal
        open={modal === 'create' || modal === 'edit'}
        editing={modal === 'edit' ? active : null}
        onClose={() => setModal(null)}
        onDone={(updated) => { invalidate(); if (updated) setActive(updated); }}
      />
      <SupplyModal open={modal === 'supply'} party={active} onClose={() => setModal(null)} onDone={invalidate} />
      <ReceiptModal open={modal === 'receipt'} party={active} onClose={() => setModal(null)} onDone={invalidate} />
    </div>
  );
}

function PartyStatement({ party }: { party: PartyRow }) {
  const { data: balance } = useQuery({
    queryKey: ['py-party-balance', party.id],
    queryFn: async () => (await api.get<PartyBalance>(`/poultry/parties/${party.id}/balance`)).data,
  });
  const { data: statement } = useQuery({
    queryKey: ['py-party-statement', party.id],
    queryFn: async () => (await api.get<{ rows: StatementRow[]; closingInr: number }>(`/poultry/parties/${party.id}/statement`)).data,
  });

  const columns: DataTableColumn<StatementRow>[] = [
    { key: 'date', header: 'Date', width: 100, render: (r) => fmtDate(r.date) },
    { key: 'ref', header: 'Ref', width: 90, render: (r) => <span style={{ fontWeight: 600 }}>{r.ref}</span> },
    { key: 'particulars', header: 'Particulars', render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div>{r.particulars}</div>
        {(r.mode || r.voucherNo) && <div className="ds-caption">{[r.mode, r.voucherNo].filter(Boolean).join(' · ')}</div>}
      </div>
    ) },
    { key: 'debitInr', header: 'Debit', align: 'right', width: 100, render: (r) => (r.debitInr ? money(r.debitInr) : <span className="ds-caption">—</span>) },
    { key: 'creditInr', header: 'Credit', align: 'right', width: 100, render: (r) => (r.creditInr ? money(r.creditInr) : <span className="ds-caption">—</span>) },
    { key: 'balanceInr', header: 'Balance', align: 'right', width: 110, render: (r) => money(r.balanceInr) },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Outstanding" value={money(balance?.balance)} tone={(balance?.balance ?? 0) > 0 ? 'sales' : 'active'} hint={`opening ${money(balance?.openingInr)}`} />
        <StatCard label="Supplied" value={money(balance?.salesInr)} hint={`${(balance?.suppliedKg ?? 0).toLocaleString('en-IN')} kg · ${(balance?.suppliedBirds ?? 0).toLocaleString('en-IN')} birds`} />
        <StatCard label="Received" value={money(balance?.receiptsInr)} tone="active" />
      </div>
      <SectionTitle
        sub="Every supply and receipt, oldest first"
        action={<a className="btn-secondary btn-sm" href={`/api/poultry/parties/${party.id}/statement.csv`}>Export CSV</a>}
      >Statement</SectionTitle>
      <Card flush>
        <DataTable
          rows={statement?.rows ?? []}
          columns={columns}
          rowKey={(r) => `${r.ref}|${r.date}|${r.balanceInr}`}
          dense
          empty={<div className="ds-caption" style={{ padding: 16 }}>Nothing on the statement yet.</div>}
        />
      </Card>
    </div>
  );
}

function PartyActivity({ partyId }: { partyId: string }) {
  const { data: sales } = useQuery({
    queryKey: ['py-party-sales', partyId],
    queryFn: async () => (await api.get<{ data: PartySaleRow[] }>('/poultry/party-sales', { params: { partyId, limit: 25 } })).data.data,
  });
  const { data: receipts } = useQuery({
    queryKey: ['py-party-receipts', partyId],
    queryFn: async () => (await api.get<{ data: PartyReceiptRow[] }>('/poultry/party-receipts', { params: { partyId, limit: 25 } })).data.data,
  });

  return (
    <div>
      <SectionTitle sub="The last 25 supplies">Supplies</SectionTitle>
      <Card flush>
        <DataTable
          rows={sales ?? []}
          columns={[
            { key: 'reference', header: 'Ref', width: 100, render: (s) => <span style={{ fontWeight: 600 }}>{s.reference}</span> },
            { key: 'date', header: 'Date', width: 100, render: (s) => fmtDate(s.date) },
            { key: 'weightKg', header: 'Kg', align: 'right', width: 80, render: (s) => s.weightKg.toLocaleString('en-IN') },
            { key: 'rate', header: 'Rate/kg', align: 'right', width: 90, render: (s) => paiseRate(s.ratePaisePerKg) },
            { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (s) => money(s.amountInr) },
          ] as DataTableColumn<PartySaleRow>[]}
          rowKey={(s) => s.id}
          dense
          empty={<div className="ds-caption" style={{ padding: 16 }}>No supplies yet.</div>}
        />
      </Card>
      <SectionTitle sub="The last 25 receipts">Receipts</SectionTitle>
      <Card flush>
        <DataTable
          rows={receipts ?? []}
          columns={[
            { key: 'reference', header: 'Ref', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
            { key: 'date', header: 'Date', width: 100, render: (r) => fmtDate(r.date) },
            { key: 'mode', header: 'Mode', width: 90, render: (r) => humanStatus(r.mode) },
            { key: 'voucherNo', header: 'Voucher', render: (r) => r.voucherNo ?? <span className="ds-caption">—</span> },
            { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (r) => money(r.amountInr) },
          ] as DataTableColumn<PartyReceiptRow>[]}
          rowKey={(r) => r.id}
          dense
          empty={<div className="ds-caption" style={{ padding: 16 }}>No receipts yet.</div>}
        />
      </Card>
    </div>
  );
}

function PartyDetails({ party, canEdit, onEdit }: { party: PartyRow; canEdit: boolean; onEdit: () => void }) {
  return (
    <div>
      <SectionTitle action={canEdit ? <button className="btn-secondary btn-sm" onClick={onEdit}>Edit</button> : undefined}>
        Master record
      </SectionTitle>
      <DetailGrid>
        <Detail label="Code" value={party.code} />
        <Detail label="Name" value={party.name} />
        <Detail label="Phone" value={party.phone ?? '—'} />
        <Detail label="Address" value={party.address ?? '—'} />
        <Detail label="Payment terms" value={`${party.paymentTermsDays} days`} />
        <Detail label="Business terms" value={party.businessTerms ?? '—'} />
        <Detail label="Opening receivable" value={money(party.openingReceivableInr)} />
        <Detail label="Opening date" value={fmtDate(party.openingDate)} />
        <Detail label="Active" value={party.isActive ? 'Yes' : 'No'} />
        <Detail label="Notes" value={party.notes ?? '—'} />
      </DetailGrid>
      <InterCompanyControl party={party} />
    </div>
  );
}

/**
 * Whether this customer is another company in the same group.
 *
 * It decides whether a sale to it is revenue or an inter-company movement the
 * group eliminates, so it is set deliberately, by someone who can manage the
 * company, from the group's own companies only — and the server refuses
 * anything else.
 */
function InterCompanyControl({ party }: { party: PartyRow }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const options = useQuery({
    queryKey: ['py-intercompany-options'],
    queryFn: async () => (await api.get<{ grouped: boolean; companies: { id: string; name: string }[] }>('/poultry/parties/inter-company-options')).data,
  });
  const [choice, setChoice] = React.useState(party.counterpartyOrgId ?? '');
  React.useEffect(() => { setChoice(party.counterpartyOrgId ?? ''); }, [party.id, party.counterpartyOrgId]);
  const save = useMutation({
    mutationFn: async () => (await api.post(`/poultry/parties/${party.id}/inter-company`, { counterpartyOrgId: choice || null })).data,
    onSuccess: () => {
      toast.success(choice ? 'Marked as a group company' : 'No longer a group company');
      qc.invalidateQueries({ queryKey: ['py-parties'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const current = options.data?.companies.find((c) => c.id === party.counterpartyOrgId);

  return (
    <div style={{ marginTop: 14 }}>
      <SectionTitle sub="Sales to a group company are inter-company: they are eliminated in group reporting, not counted as revenue.">
        Group company
      </SectionTitle>
      {options.isLoading ? <span className="ds-caption">Loading…</span>
        : options.isError ? <span className="ds-caption">Group companies could not be loaded.</span>
          : !options.data?.grouped ? <p className="ds-caption">This company is not in a group, so no customer can be a group company.</p>
            : canManage ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select className="input" style={{ maxWidth: 320 }} value={choice} onChange={(e) => setChoice(e.target.value)}>
                  <option value="">Not a group company</option>
                  {options.data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn-secondary btn-sm" disabled={save.isPending || choice === (party.counterpartyOrgId ?? '')} onClick={() => save.mutate()}>
                  {save.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : <span>{current ? current.name : 'Not a group company'}</span>}
    </div>
  );
}

const EMPTY_PARTY_FORM = { name: '', phone: '', address: '', paymentTermsDays: '', businessTerms: '', openingReceivableInr: '', defaultRate: '', notes: '' };

function PartyModal({ open, editing, onClose, onDone }: {
  open: boolean; editing: PartyRow | null; onClose: () => void; onDone: (updated: PartyRow | null) => void;
}) {
  const [form, setForm] = useState(EMPTY_PARTY_FORM);
  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, phone: editing.phone ?? '', address: editing.address ?? '',
      paymentTermsDays: String(editing.paymentTermsDays || ''), businessTerms: editing.businessTerms ?? '',
      openingReceivableInr: String(editing.openingReceivableInr || ''),
      defaultRate: editing.defaultRatePaisePerKg ? String(editing.defaultRatePaisePerKg / 100) : '',
      notes: editing.notes ?? '',
    } : EMPTY_PARTY_FORM);
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : 0,
        businessTerms: form.businessTerms || undefined,
        defaultRatePaisePerKg: form.defaultRate ? Math.round(Number(form.defaultRate) * 100) : 0,
        notes: form.notes || undefined,
        ...(editing ? {} : { openingReceivableInr: form.openingReceivableInr ? Number(form.openingReceivableInr) : 0 }),
      };
      if (editing) return (await api.patch<PartyRow>(`/poultry/parties/${editing.id}`, body)).data;
      return (await api.post<PartyRow>('/poultry/parties', body)).data;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Party updated' : 'Party added');
      onClose();
      onDone(editing ? row : null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'New party'}
      width={680}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add party'}
          </button>
        </>
      )}
    >
      <FormSection title="Identity">
        <Field label="Name" required>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Address" span={2}>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="Terms">
        <Field label="Payment terms (days)">
          <input className="input" type="number" min={0} value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} />
        </Field>
        {!editing && (
          <Field label="Opening receivable (₹)" hint="Locked once documents exist">
            <input className="input" type="number" min={0} value={form.openingReceivableInr} onChange={(e) => setForm({ ...form, openingReceivableInr: e.target.value })} />
          </Field>
        )}
        <Field label="Default rate (₹/kg)" hint="Prefills the rate when recording a supply">
          <input className="input" type="number" min={0} step="0.01" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: e.target.value })} />
        </Field>
        <Field label="Business terms" span={2}>
          <input className="input" value={form.businessTerms} onChange={(e) => setForm({ ...form, businessTerms: e.target.value })} />
        </Field>
        <Field label="Notes" span={2}>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormSection>
    </Modal>
  );
}

function SupplyModal({ open, party, onClose, onDone }: {
  open: boolean; party: PartyRow | null; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({ partyId: '', date: toDateInput(), pickupId: '', birds: '', weightKg: '', rate: '', notes: '' });
  React.useEffect(() => {
    if (open) setForm({
      partyId: party?.id ?? '', date: toDateInput(), pickupId: '', birds: '', weightKg: '',
      rate: party && party.defaultRatePaisePerKg > 0 ? String(party.defaultRatePaisePerKg / 100) : '',
      notes: '',
    });
  }, [open, party]);

  const { data: parties } = useQuery({
    queryKey: ['py-parties-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; defaultRatePaisePerKg: number }[] }>('/poultry/parties', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: pickups } = useQuery({
    queryKey: ['py-pickups-lite'],
    queryFn: async () => (await api.get<{ data: PickupOption[] }>('/poultry/pickups', { params: { limit: 50 } })).data.data,
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => api.post('/poultry/party-sales', {
      partyId: form.partyId,
      date: form.date,
      pickupId: form.pickupId || undefined,
      birds: Number(form.birds || 0),
      weightKg: Number(form.weightKg),
      ratePaisePerKg: Math.round(Number(form.rate || 0) * 100),
      notes: form.notes || undefined,
    }),
    onSuccess: () => { toast.success('Supply recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record supply"
      subtitle="Birds handed to a party leader — raises their receivable"
      width={640}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.partyId || !form.weightKg || !form.rate} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Record supply'}
          </button>
        </>
      )}
    >
      <FormSection title="The supply">
        <Field label="Party" required>
          <select
            className="input" value={form.partyId}
            onChange={(e) => {
              const id = e.target.value;
              setForm((f) => {
                const sel = (parties ?? []).find((p) => p.id === id);
                const rate = f.rate === '' && sel && sel.defaultRatePaisePerKg > 0 ? String(sel.defaultRatePaisePerKg / 100) : f.rate;
                return { ...f, partyId: id, rate };
              });
            }}
          >
            <option value="">Choose…</option>
            {(parties ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="From pickup" hint="Links the supply to the farm it left">
          <select className="input" value={form.pickupId} onChange={(e) => setForm({ ...form, pickupId: e.target.value })}>
            <option value="">Not from a recorded pickup</option>
            {(pickups ?? []).map((p) => <option key={p.id} value={p.id}>{`${p.reference} · ${p.batch.code} · ${p.weightKg}kg`}</option>)}
          </select>
        </Field>
        <Field label="Birds">
          <input className="input" type="number" min={0} value={form.birds} onChange={(e) => setForm({ ...form, birds: e.target.value })} />
        </Field>
        <Field label="Weight (kg)" required>
          <input className="input" type="number" min={0} step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
        </Field>
        <Field label="Rate per kg (₹)" required>
          <input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
        </Field>
        <Field label="Notes" span={2}>
          <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormSection>
    </Modal>
  );
}

function ReceiptModal({ open, party, onClose, onDone }: {
  open: boolean; party: PartyRow | null; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({ partyId: '', date: toDateInput(), amountInr: '', mode: 'CASH', ledgerCode: '' });
  React.useEffect(() => {
    if (open) setForm({ partyId: party?.id ?? '', date: toDateInput(), amountInr: '', mode: 'CASH', ledgerCode: '' });
  }, [open, party]);

  const { data: parties } = useQuery({
    queryKey: ['py-parties-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/parties', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string; kind: string }[]>('/poultry/accounts')).data,
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => api.post('/poultry/party-receipts', {
      partyId: form.partyId,
      date: form.date,
      amountInr: Number(form.amountInr),
      mode: form.mode,
      ledgerCode: form.ledgerCode,
    }),
    onSuccess: () => { toast.success('Receipt recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record receipt"
      subtitle="Money in from a party — reduces their receivable"
      width={560}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.partyId || !form.amountInr || !form.ledgerCode} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Record receipt'}
          </button>
        </>
      )}
    >
      <FormSection title="The receipt">
        <Field label="Party" required>
          <select className="input" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
            <option value="">Choose…</option>
            {(parties ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Amount (₹)" required>
          <input className="input" type="number" min={1} value={form.amountInr} onChange={(e) => setForm({ ...form, amountInr: e.target.value })} />
        </Field>
        <Field label="Mode" required>
          <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            {['CASH', 'BANK', 'UPI'].map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
          </select>
        </Field>
        <Field label="Into account" required>
          <select className="input" value={form.ledgerCode} onChange={(e) => setForm({ ...form, ledgerCode: e.target.value })}>
            <option value="">Choose…</option>
            {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
          </select>
        </Field>
      </FormSection>
    </Modal>
  );
}
