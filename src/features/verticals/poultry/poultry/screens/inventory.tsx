'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal, Segmented, humanStatus } from '../ui/kit';
import { DateRange, PageHead, Pagination, SearchBox, StatusSelect, fmtDate, money, toDateInput, useListState } from '../ui/common';
import { INV_CATEGORIES, PAY_MODES, paiseRate, toneForPaidStatus } from '../ui/tone';

interface ItemRow {
  id: string; code: string; name: string; category: string; unit: string;
  stockQty: number; stockValueInr: number; reorderLevel: number;
  belowReorder: boolean; isActive: boolean;
}

interface TxnRow {
  id: string; date: string; kind: string; qty: number;
  ratePaisePerUnit: number; amountInr: number; paidStatus?: string | null;
  item: { name: string; unit: string };
  supplier?: { name: string } | null;
  batch?: { code: string } | null;
}

const VIEWS = ['Stock', 'Movements'];
const TXN_KINDS = ['PURCHASE', 'ISSUE', 'ADJUSTMENT'];

const toneForTxnKind = (k: string) => (k === 'PURCHASE' ? 'active' : k === 'ISSUE' ? 'info' : 'renewal') as 'active' | 'info' | 'renewal';

const EMPTY_ITEM_FORM = { name: '', category: 'MEDICINE', unit: '', reorderLevel: '', isActive: true };

export function PoultryInventory() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [view, setView] = useState('Stock');
  const [modal, setModal] = useState<'item' | 'purchase' | 'adjust' | null>(null);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const { state, set, params } = useListState();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['py-inventory-items', params, categoryFilter],
    queryFn: async () => (await api.get<{ data: ItemRow[]; meta: { page: number; limit: number; total: number; totalPages: number }; register?: { authority: string; frozen: boolean; note?: string | null } }>(
      '/poultry/inventory/items',
      { params: { ...params, ...(categoryFilter ? { kind: categoryFilter } : {}) } },
    )).data,
    enabled: view === 'Stock',
  });

  const { data: txns, isLoading: txnsLoading } = useQuery({
    queryKey: ['py-inventory-txns', params, kindFilter],
    queryFn: async () => (await api.get<{ data: TxnRow[]; meta: { page: number; limit: number; total: number; totalPages: number }; register?: { authority: string; frozen: boolean; note?: string | null } }>(
      '/poultry/inventory/txns',
      { params: { ...params, ...(kindFilter ? { kind: kindFilter } : {}) } },
    )).data,
    enabled: view === 'Movements',
  });

  // The server says which system this register is true in. Once it is not the
  // authority, this screen is a record of the past: its numbers are shown, but
  // nothing on it offers to change them — the API would refuse, and a button
  // that always fails teaches people the screen is broken rather than history.
  const register = items?.register ?? txns?.register;
  const historical = !!register?.frozen;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-inventory-items'] });
    qc.invalidateQueries({ queryKey: ['py-inventory-txns'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const saveItem = useMutation({
    mutationFn: async () => {
      const body = {
        name: itemForm.name,
        category: itemForm.category,
        unit: itemForm.unit,
        reorderLevel: itemForm.reorderLevel ? Number(itemForm.reorderLevel) : 0,
        ...(editing ? { isActive: itemForm.isActive } : {}),
      };
      if (editing) return api.patch(`/poultry/inventory/items/${editing.id}`, body);
      return api.post('/poultry/inventory/items', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Item updated' : 'Item added');
      setModal(null); setEditing(null); setItemForm(EMPTY_ITEM_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openEdit = (i: ItemRow) => {
    setEditing(i);
    setItemForm({ name: i.name, category: i.category, unit: i.unit, reorderLevel: String(i.reorderLevel || ''), isActive: i.isActive });
    setModal('item');
  };

  const itemColumns: DataTableColumn<ItemRow>[] = [
    { key: 'code', header: 'Code', width: 90, render: (i) => <span style={{ fontWeight: 600 }}>{i.code}</span> },
    { key: 'name', header: 'Item' },
    { key: 'category', header: 'Category', width: 120, render: (i) => humanStatus(i.category) },
    { key: 'unit', header: 'Unit', width: 80 },
    { key: 'stockQty', header: 'Stock', align: 'right', width: 90, render: (i) => i.stockQty.toLocaleString('en-IN') },
    { key: 'stockValueInr', header: 'Value', align: 'right', width: 110, render: (i) => money(i.stockValueInr) },
    { key: 'reorderLevel', header: 'Reorder at', align: 'right', width: 100, render: (i) => i.reorderLevel.toLocaleString('en-IN') },
    { key: 'belowReorder', header: 'Level', width: 90, render: (i) => i.belowReorder ? <Badge tone="expired">Low</Badge> : <span className="ds-caption">—</span> },
  ];

  const txnColumns: DataTableColumn<TxnRow>[] = [
    { key: 'date', header: 'Date', width: 110, render: (t) => fmtDate(t.date) },
    { key: 'item', header: 'Item', render: (t) => t.item.name },
    { key: 'kind', header: 'Kind', width: 120, render: (t) => <Badge tone={toneForTxnKind(t.kind)}>{humanStatus(t.kind)}</Badge> },
    { key: 'qty', header: 'Qty', align: 'right', width: 100, render: (t) => `${t.qty} ${t.item.unit}` },
    { key: 'rate', header: 'Rate', align: 'right', width: 100, render: (t) => paiseRate(t.ratePaisePerUnit) },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (t) => money(t.amountInr) },
    { key: 'counterparty', header: 'Supplier / batch', render: (t) => t.supplier?.name ?? t.batch?.code ?? '—' },
    { key: 'paidStatus', header: 'Paid', width: 100, render: (t) => t.kind === 'PURCHASE' && t.paidStatus
      ? <Badge tone={toneForPaidStatus(t.paidStatus)}>{humanStatus(t.paidStatus)}</Badge>
      : <span className="ds-caption">—</span> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Store"
        subtitle={historical
          ? 'Legacy medicine and materials register — history, not current stock'
          : 'Medicine and materials — central stock and every movement in or out'}
        actions={canManage && !historical && (
          <>
            <button className="btn-secondary" onClick={() => setModal('adjust')}>Adjust</button>
            <button className="btn-secondary" onClick={() => setModal('purchase')}>Purchase stock</button>
            <button className="btn-primary" onClick={() => { setEditing(null); setItemForm(EMPTY_ITEM_FORM); setModal('item'); }}>New item</button>
          </>
        )}
      />

      {historical && (
        <Card>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone="expired">{register?.authority === 'SHARED_AUTHORITATIVE' ? 'HISTORICAL REGISTER' : 'FROZEN — MIGRATING'}</Badge>
            <span>{register?.note}</span>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
        {view === 'Stock' && (
          <>
            <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search item, code…" />
            <StatusSelect value={categoryFilter} onChange={setCategoryFilter} options={INV_CATEGORIES} label="All categories" />
          </>
        )}
        {view === 'Movements' && (
          <>
            <StatusSelect value={kindFilter} onChange={setKindFilter} options={TXN_KINDS} label="All movements" />
            <DateRange from={state.from} to={state.to} onChange={(patch) => set(patch)} />
          </>
        )}
      </div>

      {view === 'Stock' && (
        <>
          <Card flush>
            <DataTable
              rows={items?.data ?? []}
              columns={itemColumns}
              rowKey={(i) => i.id}
              loading={itemsLoading}
              onRowClick={canManage && !historical ? openEdit : undefined}
              empty={<EmptyState title="No items yet" body="Add medicines and materials to track their stock and issues." actionLabel={canManage ? 'New item' : undefined} onAction={canManage ? () => { setEditing(null); setItemForm(EMPTY_ITEM_FORM); setModal('item'); } : undefined} />}
            />
          </Card>
          <Pagination meta={items?.meta} onPage={(p) => set({ page: p })} />
        </>
      )}

      {view === 'Movements' && (
        <>
          <Card flush>
            <DataTable
              rows={txns?.data ?? []}
              columns={txnColumns}
              rowKey={(t) => t.id}
              loading={txnsLoading}
              empty={<EmptyState title="No movements" body="Purchases, issues and adjustments appear here." compact />}
            />
          </Card>
          <Pagination meta={txns?.meta} onPage={(p) => set({ page: p })} />
        </>
      )}

      <Modal
        open={modal === 'item'}
        onClose={() => { setModal(null); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New item'}
        width={560}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setModal(null); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={saveItem.isPending || !itemForm.name || !itemForm.unit} onClick={() => saveItem.mutate()}>
              {saveItem.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
            </button>
          </>
        )}
      >
        <FormSection title="The item">
          <Field label="Name" required>
            <input className="input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
          </Field>
          <Field label="Category" required>
            <select className="input" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>
              {INV_CATEGORIES.map((c) => <option key={c} value={c}>{humanStatus(c)}</option>)}
            </select>
          </Field>
          <Field label="Unit" required hint="bottle, kg, packet…">
            <input className="input" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
          </Field>
          <Field label="Reorder level">
            <input className="input" type="number" min={0} value={itemForm.reorderLevel} onChange={(e) => setItemForm({ ...itemForm, reorderLevel: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status" span={2}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={itemForm.isActive} onChange={(e) => setItemForm({ ...itemForm, isActive: e.target.checked })} />
                Active — available for purchases and issues
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>

      <PurchaseModal open={modal === 'purchase'} onClose={() => setModal(null)} onDone={invalidate} />
      <AdjustModal open={modal === 'adjust'} onClose={() => setModal(null)} onDone={invalidate} />
    </div>
  );
}

function PurchaseModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ itemId: '', supplierId: '', date: toDateInput(), qty: '', rate: '', invoiceNo: '', payMode: 'CREDIT', ledgerCode: '' });
  const { data: items } = useQuery({
    queryKey: ['py-items-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; unit: string }[] }>('/poultry/inventory/items', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
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
  const item = (items ?? []).find((i) => i.id === form.itemId);
  const save = useMutation({
    mutationFn: () => api.post('/poultry/inventory/txns', {
      kind: 'PURCHASE', itemId: form.itemId, supplierId: form.supplierId, date: form.date,
      qty: Number(form.qty), ratePaisePerUnit: Math.round(Number(form.rate || 0) * 100),
      invoiceNo: form.invoiceNo || undefined,
      payMode: form.payMode, ledgerCode: form.payMode !== 'CREDIT' ? form.ledgerCode || undefined : undefined,
    }),
    onSuccess: () => { toast.success('Stock purchased'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Purchase stock" width={640}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.itemId || !form.supplierId || !form.qty} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record purchase'}</button></>)}>
      <FormSection title="The purchase">
        <Field label="Item" required>
          <select className="input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">Choose…</option>
            {(items ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field label="Supplier" required>
          <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Choose…</option>
            {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label={`Quantity${item ? ` (${item.unit})` : ''}`} required>
          <input className="input" type="number" min={0.01} step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        </Field>
        <Field label="Rate per unit (₹)"><input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
        <Field label="Invoice no"><input className="input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></Field>
      </FormSection>
      <FormSection title="Payment">
        <Field label="Mode" hint="Credit raises the supplier's payable">
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

function AdjustModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ itemId: '', date: toDateInput(), qty: '', reason: '' });
  const { data: items } = useQuery({
    queryKey: ['py-items-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; unit: string }[] }>('/poultry/inventory/items', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const item = (items ?? []).find((i) => i.id === form.itemId);
  const save = useMutation({
    mutationFn: () => api.post('/poultry/inventory/txns', {
      kind: 'ADJUSTMENT', itemId: form.itemId, date: form.date, qty: Number(form.qty), reason: form.reason,
    }),
    onSuccess: () => { toast.success('Stock adjusted'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Adjust stock" subtitle="A signed correction — negative writes stock off, positive writes it in." width={520}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.itemId || !form.qty || !form.reason} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Adjust'}</button></>)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="label">Item
          <select className="input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">Choose…</option>
            {(items ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label className="label">Date
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="label">Quantity (signed{item ? `, ${item.unit}` : ''})
          <input className="input" type="number" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        </label>
        <label className="label">Reason
          <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Stock count, breakage, expiry…" />
        </label>
      </div>
    </Modal>
  );
}
