'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal, Segmented, StatCard, humanStatus } from '../ui/kit';
import { DateRange, PERIODS, PageHead, Pagination, SearchBox, StatusSelect, fmtDate, money, toDateInput, useListState } from '../ui/common';
import { PAID_STATUSES, PAY_MODES, paiseRate, toneForPaidStatus } from '../ui/tone';

interface ChickPurchaseRow {
  id: string; reference: string; date: string; quantity: number;
  ratePaisePerChick: number; amountInr: number; paidStatus: string;
  supplier: { name: string };
  placements: { quantity: number }[];
}

interface ReconciliationReport {
  rows: { id: string; reference: string; date: string; supplier: string; purchased: number; placed: number; unplaced: number; amountInr: number }[];
  totals: { purchased: number; placedFromThese: number; placedInWindow: number; unplaced: number };
}

const VIEWS = ['Purchases', 'Reconciliation'];

export function PoultryChicks() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [view, setView] = useState('Purchases');
  const [creating, setCreating] = useState(false);
  const [period, setPeriod] = useState('this_month');
  const { state, set, params } = useListState();
  const [paidFilter, setPaidFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['py-chick-purchases', params, paidFilter],
    queryFn: async () => (await api.get<{ data: ChickPurchaseRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/chick-purchases',
      { params: { ...params, ...(paidFilter ? { paidStatus: paidFilter } : {}) } },
    )).data,
    enabled: view === 'Purchases',
  });

  const { data: recon, isLoading: reconLoading } = useQuery({
    queryKey: ['py-chick-reconciliation', period],
    queryFn: async () => (await api.get<ReconciliationReport>('/poultry/reports/chick-reconciliation', { params: { period } })).data,
    enabled: view === 'Reconciliation',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-chick-purchases'] });
    qc.invalidateQueries({ queryKey: ['py-chick-reconciliation'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const purchaseColumns: DataTableColumn<ChickPurchaseRow>[] = [
    { key: 'reference', header: 'Ref', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
    { key: 'date', header: 'Date', width: 110, render: (r) => fmtDate(r.date) },
    { key: 'supplier', header: 'Hatchery', render: (r) => r.supplier.name },
    { key: 'quantity', header: 'Chicks', align: 'right', width: 90, render: (r) => r.quantity.toLocaleString('en-IN') },
    { key: 'rate', header: 'Rate/chick', align: 'right', width: 100, render: (r) => paiseRate(r.ratePaisePerChick) },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (r) => money(r.amountInr) },
    { key: 'paidStatus', header: 'Paid', width: 100, render: (r) => <Badge tone={toneForPaidStatus(r.paidStatus)}>{humanStatus(r.paidStatus)}</Badge> },
    { key: 'placed', header: 'Placed', align: 'right', width: 130, render: (r) => {
      const placed = r.placements.reduce((sum, p) => sum + p.quantity, 0);
      return <span>{placed.toLocaleString('en-IN')} / {r.quantity.toLocaleString('en-IN')}</span>;
    } },
  ];

  const reconColumns: DataTableColumn<ReconciliationReport['rows'][number]>[] = [
    { key: 'reference', header: 'Ref', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
    { key: 'date', header: 'Date', width: 110, render: (r) => fmtDate(r.date) },
    { key: 'supplier', header: 'Hatchery', render: (r) => r.supplier },
    { key: 'purchased', header: 'Purchased', align: 'right', width: 100, render: (r) => r.purchased.toLocaleString('en-IN') },
    { key: 'placed', header: 'Placed', align: 'right', width: 100, render: (r) => r.placed.toLocaleString('en-IN') },
    { key: 'unplaced', header: 'Unplaced', align: 'right', width: 130, render: (r) => r.unplaced > 0
      ? <Badge tone="claim">{r.unplaced.toLocaleString('en-IN')} unplaced</Badge>
      : <span className="ds-caption">—</span> },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (r) => money(r.amountInr) },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Chicks"
        subtitle="Hatchery purchases and where every chick actually went"
        actions={canManage && (
          <button className="btn-primary" onClick={() => setCreating(true)}>New purchase</button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
        {view === 'Purchases' && (
          <>
            <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search reference, hatchery…" />
            <StatusSelect value={paidFilter} onChange={setPaidFilter} options={PAID_STATUSES} label="All paid states" />
            <DateRange from={state.from} to={state.to} onChange={(patch) => set(patch)} />
          </>
        )}
        {view === 'Reconciliation' && (
          <select className="input" style={{ maxWidth: 170 }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
            {PERIODS.filter((p) => p.key !== 'custom').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        )}
      </div>

      {view === 'Purchases' && (
        <>
          <Card flush>
            <DataTable
              rows={data?.data ?? []}
              columns={purchaseColumns}
              rowKey={(r) => r.id}
              loading={isLoading}
              empty={<EmptyState title="No chick purchases" body="Hatchery invoices land here and feed the placement reconciliation." actionLabel={canManage ? 'New purchase' : undefined} onAction={canManage ? () => setCreating(true) : undefined} />}
            />
          </Card>
          <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />
        </>
      )}

      {view === 'Reconciliation' && (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Purchased" value={(recon?.totals.purchased ?? 0).toLocaleString('en-IN')} />
            <StatCard label="Placed from these" value={(recon?.totals.placedFromThese ?? 0).toLocaleString('en-IN')} />
            <StatCard label="Placed in window" value={(recon?.totals.placedInWindow ?? 0).toLocaleString('en-IN')} />
            <StatCard label="Unplaced" value={(recon?.totals.unplaced ?? 0).toLocaleString('en-IN')} tone={(recon?.totals.unplaced ?? 0) > 0 ? 'claim' : 'active'} />
          </div>
          <Card flush>
            <DataTable
              rows={recon?.rows ?? []}
              columns={reconColumns}
              rowKey={(r) => r.id}
              loading={reconLoading}
              empty={<EmptyState title="Nothing to reconcile" body="No chick purchases in this period." compact />}
            />
          </Card>
        </>
      )}

      <NewPurchaseModal open={creating} onClose={() => setCreating(false)} onDone={invalidate} />
    </div>
  );
}

function NewPurchaseModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ supplierId: '', date: toDateInput(), quantity: '', rate: '', invoiceNo: '', payMode: 'CREDIT', ledgerCode: '' });
  const { data: suppliers } = useQuery({
    queryKey: ['py-suppliers-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/suppliers', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string }[]>('/poultry/accounts')).data,
    enabled: open && form.payMode !== 'CREDIT',
  });
  const save = useMutation({
    mutationFn: () => api.post('/poultry/chick-purchases', {
      supplierId: form.supplierId, date: form.date, quantity: Number(form.quantity),
      ratePaisePerChick: Math.round(Number(form.rate || 0) * 100),
      invoiceNo: form.invoiceNo || undefined,
      payMode: form.payMode, ledgerCode: form.payMode !== 'CREDIT' ? form.ledgerCode || undefined : undefined,
    }),
    onSuccess: () => { toast.success('Chick purchase recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="New chick purchase" width={640}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.supplierId || !form.quantity} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record purchase'}</button></>)}>
      <FormSection title="The purchase">
        <Field label="Hatchery" required>
          <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Choose…</option>
            {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Quantity" required><input className="input" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
        <Field label="Rate per chick (₹)"><input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
        <Field label="Invoice no"><input className="input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></Field>
      </FormSection>
      <FormSection title="Payment">
        <Field label="Mode" hint="Credit raises the hatchery's payable">
          <select className="input" value={form.payMode} onChange={(e) => setForm({ ...form, payMode: e.target.value })}>
            {PAY_MODES.map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
          </select>
        </Field>
        {form.payMode !== 'CREDIT' && (
          <Field label="Paid from account" required>
            <select className="input" value={form.ledgerCode} onChange={(e) => setForm({ ...form, ledgerCode: e.target.value })}>
              <option value="">Choose…</option>
              {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
            </select>
          </Field>
        )}
      </FormSection>
    </Modal>
  );
}
