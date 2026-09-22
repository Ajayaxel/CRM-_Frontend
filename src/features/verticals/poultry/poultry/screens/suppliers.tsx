'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Card, DataTable, DataTableColumn, Drawer, EmptyState, Field, FormSection, Modal, Segmented, StatCard, humanStatus } from '../ui/kit';
import { Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect, fmtDate, money, toDateInput, useListState } from '../ui/common';
import { SUPPLIER_CATEGORIES } from '../ui/tone';

interface SupplierRow {
  id: string; code: string; name: string; category: string;
  phone?: string | null; email?: string | null; address?: string | null;
  gstin?: string | null; paymentTermsDays: number; notes?: string | null;
}

interface StatementRow {
  date: string; ref: string; particulars: string;
  debitInr: number; creditInr: number; balanceInr: number;
}

interface OutstandingRow {
  supplierId: string; name: string; openingInr: number; purchasesInr: number;
  paidInr: number; balance: number; paymentTermsDays: number; category: string;
}

const VIEWS = ['Suppliers', 'Outstanding'];
const PAYMENT_MODES = ['CASH', 'BANK', 'UPI'];

const EMPTY_FORM = {
  name: '', category: 'FEED', phone: '', email: '', address: '', gstin: '',
  paymentTermsDays: '', openingPayableInr: '', notes: '',
};

export function PoultrySuppliers() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const canFinance = hasPermission('poultry.finance');
  const [view, setView] = useState('Suppliers');
  const { state, set, params } = useListState();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<SupplierRow | null>(null);
  const [tab, setTab] = useState('Statement');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [paying, setPaying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['py-suppliers', params, categoryFilter],
    queryFn: async () => (await api.get<{ data: SupplierRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/suppliers',
      { params: { ...params, ...(categoryFilter ? { kind: categoryFilter } : {}) } },
    )).data,
    enabled: view === 'Suppliers',
  });

  const { data: outstanding, isLoading: outstandingLoading } = useQuery({
    queryKey: ['py-suppliers-outstanding'],
    queryFn: async () => (await api.get<OutstandingRow[]>('/poultry/suppliers/outstanding')).data,
    enabled: view === 'Outstanding',
  });

  const { data: statement } = useQuery({
    queryKey: ['py-supplier-statement', selected?.id],
    queryFn: async () => (await api.get<{ supplier: { name: string }; rows: StatementRow[]; closingInr: number }>(
      `/poultry/suppliers/${selected!.id}/statement`,
    )).data,
    enabled: !!selected && tab === 'Statement',
  });

  const { data: balance } = useQuery({
    queryKey: ['py-supplier-balance', selected?.id],
    queryFn: async () => (await api.get<{ openingInr: number; purchasesInr: number; paidInr: number; balance: number }>(
      `/poultry/suppliers/${selected!.id}/balance`,
    )).data,
    enabled: !!selected && tab === 'Statement',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-suppliers'] });
    qc.invalidateQueries({ queryKey: ['py-suppliers-outstanding'] });
    qc.invalidateQueries({ queryKey: ['py-supplier-statement'] });
    qc.invalidateQueries({ queryKey: ['py-supplier-balance'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        category: form.category,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        gstin: form.gstin || undefined,
        paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : 0,
        openingPayableInr: form.openingPayableInr ? Number(form.openingPayableInr) : undefined,
        notes: form.notes || undefined,
      };
      if (editing) return api.patch(`/poultry/suppliers/${editing.id}`, body);
      return api.post('/poultry/suppliers', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Supplier updated' : 'Supplier added');
      setCreating(false); setEditing(null); setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openEdit = (s: SupplierRow) => {
    setEditing(s);
    setForm({
      name: s.name, category: s.category, phone: s.phone ?? '', email: s.email ?? '',
      address: s.address ?? '', gstin: s.gstin ?? '',
      paymentTermsDays: String(s.paymentTermsDays || ''), openingPayableInr: '', notes: s.notes ?? '',
    });
  };

  const columns: DataTableColumn<SupplierRow>[] = [
    { key: 'code', header: 'Code', width: 90, render: (s) => <span style={{ fontWeight: 600 }}>{s.code}</span> },
    { key: 'name', header: 'Supplier' },
    { key: 'category', header: 'Category', width: 120, render: (s) => humanStatus(s.category) },
    { key: 'phone', header: 'Phone', width: 140, render: (s) => s.phone ?? <span className="ds-caption">—</span> },
    { key: 'paymentTermsDays', header: 'Terms', align: 'right', width: 90, render: (s) => `${s.paymentTermsDays}d` },
  ];

  const outstandingColumns: DataTableColumn<OutstandingRow>[] = [
    { key: 'name', header: 'Supplier', render: (s) => <span style={{ fontWeight: 600 }}>{s.name}</span> },
    { key: 'category', header: 'Category', width: 120, render: (s) => humanStatus(s.category) },
    { key: 'openingInr', header: 'Opening', align: 'right', width: 110, render: (s) => money(s.openingInr) },
    { key: 'purchasesInr', header: 'Purchases', align: 'right', width: 110, render: (s) => money(s.purchasesInr) },
    { key: 'paidInr', header: 'Paid', align: 'right', width: 110, render: (s) => money(s.paidInr) },
    { key: 'balance', header: 'Balance', align: 'right', width: 120, render: (s) => <strong>{money(s.balance)}</strong> },
    { key: 'paymentTermsDays', header: 'Terms', align: 'right', width: 80, render: (s) => `${s.paymentTermsDays}d` },
  ];

  const statementRows = (statement?.rows ?? []).map((r, i) => ({ ...r, _key: String(i) }));
  const statementColumns: DataTableColumn<StatementRow & { _key: string }>[] = [
    { key: 'date', header: 'Date', width: 100, render: (r) => fmtDate(r.date) },
    { key: 'ref', header: 'Ref', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.ref}</span> },
    { key: 'particulars', header: 'Particulars' },
    { key: 'debitInr', header: 'Debit', align: 'right', width: 100, render: (r) => r.debitInr ? money(r.debitInr) : '—' },
    { key: 'creditInr', header: 'Credit', align: 'right', width: 100, render: (r) => r.creditInr ? money(r.creditInr) : '—' },
    { key: 'balanceInr', header: 'Balance', align: 'right', width: 110, render: (r) => money(r.balanceInr) },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Suppliers"
        subtitle="Hatcheries, feed companies and stores — what we bought and what we owe"
        actions={canManage && (
          <button className="btn-primary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setCreating(true); }}>New supplier</button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
        {view === 'Suppliers' && (
          <>
            <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search supplier, code…" />
            <StatusSelect value={categoryFilter} onChange={setCategoryFilter} options={SUPPLIER_CATEGORIES} label="All categories" />
          </>
        )}
      </div>

      {view === 'Suppliers' && (
        <>
          <Card flush>
            <DataTable
              rows={data?.data ?? []}
              columns={columns}
              rowKey={(s) => s.id}
              loading={isLoading}
              onRowClick={(s) => { setSelected(s); setTab('Statement'); }}
              empty={<EmptyState title="No suppliers yet" body="Add the hatcheries, feed companies and stores you buy from." actionLabel={canManage ? 'New supplier' : undefined} onAction={canManage ? () => setCreating(true) : undefined} />}
            />
          </Card>
          <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />
        </>
      )}

      {view === 'Outstanding' && (
        <Card flush>
          <DataTable
            rows={[...(outstanding ?? [])].sort((a, b) => b.balance - a.balance)}
            columns={outstandingColumns}
            rowKey={(s) => s.supplierId}
            loading={outstandingLoading}
            empty={<EmptyState title="Nothing outstanding" body="No supplier balances right now." compact />}
          />
        </Card>
      )}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.code} · ${humanStatus(selected.category)}` : undefined}
        tabs={['Statement', 'Details']}
        activeTab={tab}
        onTab={setTab}
        width={720}
      >
        {selected && tab === 'Statement' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <StatCard label="Opening" value={money(balance?.openingInr)} />
              <StatCard label="Purchases" value={money(balance?.purchasesInr)} />
              <StatCard label="Paid" value={money(balance?.paidInr)} />
              <StatCard label="Balance" value={money(balance?.balance)} tone={(balance?.balance ?? 0) > 0 ? 'claim' : 'active'} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn-secondary btn-sm" href={`/api/poultry/suppliers/${selected.id}/statement.csv`} download>Export CSV</a>
              {canFinance && (
                <button className="btn-primary btn-sm" onClick={() => setPaying(true)}>Record payment</button>
              )}
            </div>
            <Card flush>
              <DataTable
                rows={statementRows}
                columns={statementColumns}
                rowKey={(r) => r._key}
                dense
                empty={<div className="ds-caption" style={{ padding: 16 }}>No entries on the statement.</div>}
              />
            </Card>
            <div style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 650 }}>
              Closing balance: {money(statement?.closingInr)}
            </div>
          </div>
        )}
        {selected && tab === 'Details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DetailGrid>
              <Detail label="Code" value={selected.code} />
              <Detail label="Category" value={humanStatus(selected.category)} />
              <Detail label="Phone" value={selected.phone ?? '—'} />
              <Detail label="Email" value={selected.email ?? '—'} />
              <Detail label="GSTIN" value={selected.gstin ?? '—'} />
              <Detail label="Payment terms" value={`${selected.paymentTermsDays} days`} />
              <Detail label="Address" value={selected.address ?? '—'} />
              <Detail label="Notes" value={selected.notes ?? '—'} />
            </DetailGrid>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canManage && <button className="btn-secondary btn-sm" onClick={() => openEdit(selected)}>Edit</button>}
              {canFinance && <button className="btn-primary btn-sm" onClick={() => setPaying(true)}>Record payment</button>}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New supplier'}
        width={720}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add supplier'}
            </button>
          </>
        )}
      >
        <FormSection title="Identity">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Category" required>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {SUPPLIER_CATEGORIES.map((c) => <option key={c} value={c}>{humanStatus(c)}</option>)}
            </select>
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Address" span={2}>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="GSTIN">
            <input className="input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          </Field>
        </FormSection>
        <FormSection title="Terms">
          <Field label="Payment terms (days)">
            <input className="input" type="number" min={0} value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} />
          </Field>
          {!editing && (
            <Field label="Opening payable (₹)">
              <input className="input" type="number" min={0} value={form.openingPayableInr} onChange={(e) => setForm({ ...form, openingPayableInr: e.target.value })} />
            </Field>
          )}
          <Field label="Notes" span={2}>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormSection>
      </Modal>

      {selected && (
        <PaymentModal
          open={paying}
          onClose={() => setPaying(false)}
          supplier={selected}
          onDone={invalidate}
        />
      )}
    </div>
  );
}

function PaymentModal({ open, onClose, supplier, onDone }: { open: boolean; onClose: () => void; supplier: SupplierRow; onDone: () => void }) {
  const [form, setForm] = useState({ date: toDateInput(), amount: '', mode: 'CASH', ledgerCode: '', notes: '' });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string }[]>('/poultry/accounts')).data,
    enabled: open,
  });
  const save = useMutation({
    mutationFn: () => api.post('/poultry/supplier-payments', {
      supplierId: supplier.id, date: form.date, amountInr: Number(form.amount),
      mode: form.mode, ledgerCode: form.ledgerCode, notes: form.notes || undefined,
    }),
    onSuccess: () => { toast.success('Payment recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Record payment" subtitle={`Pays down ${supplier.name}'s balance`} width={560}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.amount || !form.ledgerCode} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record payment'}</button></>)}>
      <FormSection title="The payment">
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Amount (₹)" required>
          <input className="input" type="number" min={1} step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Mode" required>
          <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
          </select>
        </Field>
        <Field label="Paid from account" required>
          <select className="input" value={form.ledgerCode} onChange={(e) => setForm({ ...form, ledgerCode: e.target.value })}>
            <option value="">Choose…</option>
            {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Notes" span={2}>
          <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormSection>
    </Modal>
  );
}
