'use client';

/**
 * Shared stock: items, locations, what is on hand, and how it got there.
 *
 * Every quantity on this screen is a sum over movements. There is no balance
 * column behind it, which is why the movement log and the stock board can never
 * disagree — they are the same numbers read two ways.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeftRight, Boxes, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge, Card, DataTable, EmptyState, Field, FormSection, Modal, Segmented, Skeleton, StatCard,
  type DataTableColumn,
} from '@/features/verticals/insurance/insurance/ui/kit';
import { PageHead, TableNote, fmtDate, fromPaise, humanise, money, qty, toDateInput } from '../ui';

interface Item {
  id: string; code: string; name: string; category: string | null; uom: string;
  tracking: string; shelfLifeDays: number | null; minStockQty: number; reorderQty: number;
  stockAccountCode: string; expenseAccountCode: string; isActive: boolean;
  onHandQty: number; reservedQty: number; availableQty: number;
  stockValueInr: number; unitCostPaise: number; belowReorder: boolean;
}

interface Location {
  id: string; code: string; name: string; kind: string; isActive: boolean;
  costCenter?: { id: string; code: string; name: string } | null;
}

interface BoardRow {
  itemId: string; locationId: string; onHandQty: number; stockValueInr: number; unitCostPaise: number; belowReorder: boolean;
  item: { code: string; name: string; uom: string; category: string | null } | null;
  location: { code: string; name: string; kind: string } | null;
}

interface Move {
  id: string; kind: string; date: string; qty: number; unitCostPaise: number; valueInr: number;
  reason: string | null; notes: string | null; sourceType: string;
  item: { code: string; name: string; uom: string };
  location: { code: string; name: string };
  batch: { batchNo: string; expiryDate: string | null } | null;
}

interface ExpiryRow {
  id: string; batchNo: string; expiryDate: string | null; onHandQty: number; daysToExpiry: number | null; expired: boolean;
  item: { code: string; name: string; uom: string };
  location: { code: string; name: string };
}

const VIEWS = ['Stock', 'Items', 'Locations', 'Movements', 'Expiry'];

export function CoreInventoryScreen() {
  const qc = useQueryClient();
  const [view, setView] = useState(VIEWS[0]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const items = useQuery({ queryKey: ['core', 'items'], queryFn: async () => (await api.get<Item[]>('/core/items')).data });
  const locations = useQuery({ queryKey: ['core', 'locations'], queryFn: async () => (await api.get<Location[]>('/core/locations')).data });
  const board = useQuery({
    queryKey: ['core', 'stock'], queryFn: async () => (await api.get<BoardRow[]>('/core/stock')).data,
    enabled: view === 'Stock',
  });
  const moves = useQuery({
    queryKey: ['core', 'moves'], queryFn: async () => (await api.get<Move[]>('/core/stock/moves')).data,
    enabled: view === 'Movements',
  });
  const expiry = useQuery({
    queryKey: ['core', 'expiry'], queryFn: async () => (await api.get<ExpiryRow[]>('/core/stock/expiry')).data,
    enabled: view === 'Expiry',
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['core'] });
  const totalValue = (items.data ?? []).reduce((s, i) => s + i.stockValueInr, 0);
  const lowCount = (items.data ?? []).filter((i) => i.belowReorder).length;

  return (
    <div className="ds-page">
      <PageHead
        title="Stock"
        subtitle="One movement table for the whole company. Balances are the sum of movements — nothing is stored, so nothing can drift."
        actions={(
          <>
            <button className="btn-secondary" onClick={() => setTransferOpen(true)}>Transfer</button>
            <button className="btn-primary" onClick={() => setMoveOpen(true)}>Record a movement</button>
          </>
        )}
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Stock value" value={money(totalValue)} hint="what is on the shelves, at moving average" />
        <StatCard label="Items" value={String((items.data ?? []).length)} hint={`${(locations.data ?? []).length} locations`} />
        <StatCard label="Below reorder" value={String(lowCount)} hint="items under their minimum" tone={lowCount > 0 ? 'renewal' : 'neutral'} />
      </div>

      <div style={{ margin: '18px 0 14px' }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>

      {view === 'Stock' && (board.isLoading ? <Skeleton rows={4} /> : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'item', header: 'Item', sortable: true, render: (r: BoardRow) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.item?.name ?? '—'}</div>
                  <div className="ds-caption">{r.item?.code} {r.item?.category ? `· ${r.item.category}` : ''}</div>
                </div>
              ) },
              { key: 'location', header: 'Location', sortable: true, render: (r: BoardRow) => `${r.location?.code ?? ''} · ${r.location?.name ?? '—'}` },
              { key: 'onHandQty', header: 'On hand', align: 'right', sortable: true, render: (r: BoardRow) => qty(r.onHandQty, r.item?.uom) },
              { key: 'unitCostPaise', header: 'Unit cost', align: 'right', sortable: true, render: (r: BoardRow) => fromPaise(r.unitCostPaise) },
              { key: 'stockValueInr', header: 'Value', align: 'right', sortable: true, render: (r: BoardRow) => money(r.stockValueInr) },
              { key: 'belowReorder', header: '', render: (r: BoardRow) => (r.belowReorder ? <Badge tone="renewal">Below minimum</Badge> : null) },
            ] as DataTableColumn<BoardRow>[]}
            rows={board.data ?? []}
            rowKey={(r) => `${r.itemId}-${r.locationId}`}
            empty="Nothing on hand anywhere yet."
          />
          <TableNote>
            Unit cost is the moving average of what is still on the shelf — not the last purchase price,
            which would re-price everything every time a supplier changed its rate.
          </TableNote>
        </Card>
      ))}

      {view === 'Items' && (items.isLoading ? <Skeleton rows={4} /> : (items.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={Boxes} title="No items yet" body="Materials, spare parts, supplies, equipment — anything the company holds and consumes." actionLabel="Add an item" onAction={() => setItemOpen(true)} />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'name', header: 'Item', sortable: true, render: (i: Item) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{i.name}</div>
                  <div className="ds-caption">{i.code} · {i.uom}{i.category ? ` · ${i.category}` : ''}</div>
                </div>
              ) },
              { key: 'tracking', header: 'Tracking', sortable: true, render: (i: Item) => (
                i.tracking === 'NONE' ? <span className="ds-caption">Fungible</span> : <Badge tone="info">{humanise(i.tracking)}</Badge>
              ) },
              { key: 'onHandQty', header: 'On hand', align: 'right', sortable: true, render: (i: Item) => qty(i.onHandQty, i.uom) },
              { key: 'availableQty', header: 'Available', align: 'right', sortable: true, render: (i: Item) => qty(i.availableQty, i.uom) },
              { key: 'minStockQty', header: 'Minimum', align: 'right', render: (i: Item) => (i.minStockQty ? qty(i.minStockQty, i.uom) : '—') },
              { key: 'stockValueInr', header: 'Value', align: 'right', sortable: true, render: (i: Item) => money(i.stockValueInr) },
              { key: 'flags', header: '', render: (i: Item) => (i.belowReorder ? <Badge tone="renewal">Reorder</Badge> : !i.isActive ? <Badge tone="neutral">Inactive</Badge> : null) },
            ] as DataTableColumn<Item>[]}
            rows={items.data ?? []}
            rowKey={(i) => i.id}
          />
          <TableNote>Available is on hand minus anything reserved against a document.</TableNote>
        </Card>
      ))}

      {view === 'Locations' && (locations.isLoading ? <Skeleton rows={3} /> : (locations.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={MapPin} title="No locations yet" body="A central depot, site store, warehouse, branch, or service vehicle." actionLabel="Add a location" onAction={() => setLocationOpen(true)} />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'name', header: 'Location', sortable: true, render: (l: Location) => <span style={{ fontWeight: 600 }}>{l.code} · {l.name}</span> },
              { key: 'kind', header: 'Kind', sortable: true, render: (l: Location) => humanise(l.kind) },
              { key: 'costCenter', header: 'Cost centre', render: (l: Location) => (l.costCenter ? `${l.costCenter.code} · ${l.costCenter.name}` : <span className="ds-caption">None</span>) },
              { key: 'isActive', header: '', render: (l: Location) => (l.isActive ? null : <Badge tone="neutral">Inactive</Badge>) },
            ] as DataTableColumn<Location>[]}
            rows={locations.data ?? []}
            rowKey={(l) => l.id}
          />
          <TableNote>A movement inherits its location's cost centre, so the money side lands in the right place without anyone tagging it twice.</TableNote>
        </Card>
      ))}

      {view === 'Movements' && (moves.isLoading ? <Skeleton rows={4} /> : (
        <Card flush>
          <DataTable
            dense
            columns={[
              { key: 'date', header: 'Date', sortable: true, render: (m: Move) => fmtDate(m.date) },
              { key: 'kind', header: 'Kind', sortable: true, render: (m: Move) => <Badge tone={m.qty >= 0 ? 'active' : 'info'}>{humanise(m.kind)}</Badge> },
              { key: 'item', header: 'Item', render: (m: Move) => m.item.name },
              { key: 'location', header: 'Location', render: (m: Move) => m.location.name },
              { key: 'batch', header: 'Batch', render: (m: Move) => (m.batch ? `${m.batch.batchNo}${m.batch.expiryDate ? ` · exp ${fmtDate(m.batch.expiryDate)}` : ''}` : '—') },
              { key: 'qty', header: 'Qty', align: 'right', sortable: true, render: (m: Move) => qty(m.qty, m.item.uom) },
              { key: 'valueInr', header: 'Value', align: 'right', render: (m: Move) => money(m.valueInr) },
              { key: 'sourceType', header: 'Source', render: (m: Move) => <span className="ds-caption">{m.reason ?? m.sourceType}</span> },
            ] as DataTableColumn<Move>[]}
            rows={moves.data ?? []}
            rowKey={(m) => m.id}
            empty="No movements recorded yet."
          />
          <TableNote>Quantity is signed: a receipt adds, an issue subtracts, and an adjustment is whichever the correction was.</TableNote>
        </Card>
      ))}

      {view === 'Expiry' && (expiry.isLoading ? <Skeleton rows={3} /> : (expiry.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={AlertTriangle} title="Nothing expiring in the next 60 days" body="Batches already finished are not listed — a used-up batch is not a problem, however expired." />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'item', header: 'Item', render: (r: ExpiryRow) => <span style={{ fontWeight: 600 }}>{r.item.name}</span> },
              { key: 'batchNo', header: 'Batch', render: (r: ExpiryRow) => r.batchNo },
              { key: 'location', header: 'Location', render: (r: ExpiryRow) => r.location.name },
              { key: 'onHandQty', header: 'On hand', align: 'right', sortable: true, render: (r: ExpiryRow) => qty(r.onHandQty, r.item.uom) },
              { key: 'expiryDate', header: 'Expires', sortable: true, render: (r: ExpiryRow) => fmtDate(r.expiryDate) },
              { key: 'daysToExpiry', header: '', render: (r: ExpiryRow) => (
                r.expired ? <Badge tone="expired">Expired</Badge> : <Badge tone="renewal">{r.daysToExpiry} days</Badge>
              ) },
            ] as DataTableColumn<ExpiryRow>[]}
            rows={expiry.data ?? []}
            rowKey={(r) => r.id}
          />
          <TableNote>Expired stock is refused at issue, not merely flagged here.</TableNote>
        </Card>
      ))}

      <MoveModal open={moveOpen} onClose={() => setMoveOpen(false)} items={items.data ?? []} locations={locations.data ?? []} onSaved={invalidate} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} items={items.data ?? []} locations={locations.data ?? []} onSaved={invalidate} />
      <ItemModal open={itemOpen} onClose={() => setItemOpen(false)} onSaved={invalidate} />
      <LocationModal open={locationOpen} onClose={() => setLocationOpen(false)} onSaved={invalidate} />
    </div>
  );
}

function MoveModal({ open, onClose, items, locations, onSaved }: {
  open: boolean; onClose: () => void; items: Item[]; locations: Location[]; onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({ itemId: '', locationId: '', kind: 'RECEIPT', date: toDateInput(), qty: '', unitCostPaise: '', batchNo: '', expiryDate: '', reason: '' });
  const item = items.find((i) => i.id === form.itemId);
  const needsBatch = item?.tracking === 'BATCH' && form.kind === 'RECEIPT';

  const save = useMutation({
    mutationFn: async () => (await api.post('/core/stock/moves', {
      itemId: form.itemId, locationId: form.locationId, kind: form.kind, date: form.date,
      qty: Number(form.qty),
      unitCostPaise: form.unitCostPaise ? Math.round(Number(form.unitCostPaise) * 100) : undefined,
      batchNo: form.batchNo || undefined,
      expiryDate: form.expiryDate || undefined,
      reason: form.reason || undefined,
    })).data,
    onSuccess: () => { toast.success('Movement recorded'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not record the movement'),
  });

  return (
    <Modal
      open={open} onClose={onClose} title="Record a stock movement" width={720}
      subtitle="A receipt is valued at what was paid; an issue at the moving average of what is on hand."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.itemId || !form.locationId || !form.qty} onClick={() => save.mutate()}>
            {save.isPending ? 'Recording…' : 'Record'}
          </button>
        </>
      )}
    >
      <FormSection title="Movement">
        <Field label="Item" required>
          <select className="input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">Choose…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
          </select>
        </Field>
        <Field label="Location" required>
          <select className="input" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
            <option value="">Choose…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </Field>
        <Field label="Kind">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="RECEIPT">Receipt — stock in</option>
            <option value="ISSUE">Issue — consumed</option>
            <option value="RETURN">Return — unused, coming back</option>
            <option value="ADJUSTMENT">Adjustment — a correction</option>
          </select>
        </Field>
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label={`Quantity${item ? ` (${item.uom})` : ''}`} required hint={form.kind === 'ADJUSTMENT' ? 'Negative to write stock off.' : undefined}>
          <input className="input" type="number" step="0.001" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        </Field>
        <Field label="Rate per unit (₹)" hint={form.kind === 'RECEIPT' ? 'What was paid.' : 'Leave empty to use the moving average.'}>
          <input className="input" type="number" step="0.01" value={form.unitCostPaise} onChange={(e) => setForm({ ...form, unitCostPaise: e.target.value })} />
        </Field>
        {(needsBatch || item?.tracking === 'BATCH') && (
          <>
            <Field label="Batch number" required={needsBatch}>
              <input className="input" value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
            </Field>
            <Field label="Expires" hint={item?.shelfLifeDays ? `Defaults to ${item.shelfLifeDays} days from receipt.` : undefined}>
              <input className="input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>
          </>
        )}
        {form.kind === 'ADJUSTMENT' && (
          <Field label="Reason" required span={2} hint="A stock correction nobody explained is indistinguishable from a mistake.">
            <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        )}
      </FormSection>
    </Modal>
  );
}

function TransferModal({ open, onClose, items, locations, onSaved }: {
  open: boolean; onClose: () => void; items: Item[]; locations: Location[]; onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({ itemId: '', fromLocationId: '', toLocationId: '', date: toDateInput(), qty: '' });
  const save = useMutation({
    mutationFn: async () => (await api.post('/core/stock/transfers', { ...form, qty: Number(form.qty) })).data,
    onSuccess: () => { toast.success('Stock transferred'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not transfer'),
  });
  return (
    <Modal
      open={open} onClose={onClose} title="Transfer stock" width={640}
      subtitle="Booked as two movements that point at each other, so neither location's history has a gap. Nothing is posted — value did not leave the company, only the shelf."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.itemId || !form.fromLocationId || !form.toLocationId || !form.qty} onClick={() => save.mutate()}>
            {save.isPending ? 'Transferring…' : 'Transfer'}
          </button>
        </>
      )}
    >
      <FormSection title="Transfer">
        <Field label="Item" required>
          <select className="input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">Choose…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
          </select>
        </Field>
        <Field label="Quantity" required><input className="input" type="number" step="0.001" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
        <Field label="From" required>
          <select className="input" value={form.fromLocationId} onChange={(e) => setForm({ ...form, fromLocationId: e.target.value })}>
            <option value="">Choose…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </Field>
        <Field label="To" required>
          <select className="input" value={form.toLocationId} onChange={(e) => setForm({ ...form, toLocationId: e.target.value })}>
            <option value="">Choose…</option>
            {locations.filter((l) => l.id !== form.fromLocationId).map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
      </FormSection>
    </Modal>
  );
}

function ItemModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ name: '', category: '', uom: 'nos', tracking: 'NONE', shelfLifeDays: '', minStockQty: '', expenseAccountCode: '5030' });
  const save = useMutation({
    mutationFn: async () => (await api.post('/core/items', {
      name: form.name.trim(), category: form.category || undefined, uom: form.uom, tracking: form.tracking,
      shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : undefined,
      minStockQty: form.minStockQty ? Number(form.minStockQty) : undefined,
      expenseAccountCode: form.expenseAccountCode || undefined,
    })).data,
    onSuccess: () => { toast.success('Item added'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not add the item'),
  });
  return (
    <Modal
      open={open} onClose={onClose} title="New item" width={680}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || form.name.trim().length < 2} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Add item'}
          </button>
        </>
      )}
    >
      <FormSection title="Item">
        <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 18W Round LED Recessed Panel" /></Field>
        <Field label="Category"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Electrical / Maintenance" /></Field>
        <Field label="Unit"><input className="input" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} placeholder="PCS" /></Field>
        <Field label="Tracking" hint="Batch for anything with an expiry date or lot number.">
          <select className="input" value={form.tracking} onChange={(e) => setForm({ ...form, tracking: e.target.value })}>
            <option value="NONE">None</option>
            <option value="BATCH">Batch &amp; expiry</option>
            <option value="SERIAL">Serial</option>
          </select>
        </Field>
        {form.tracking === 'BATCH' && (
          <Field label="Shelf life (days)" hint="Used to date a batch when the receipt does not say.">
            <input className="input" type="number" value={form.shelfLifeDays} onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })} />
          </Field>
        )}
        <Field label="Minimum stock" hint="Zero means not tracked, never 'order nothing'.">
          <input className="input" type="number" step="0.001" value={form.minStockQty} onChange={(e) => setForm({ ...form, minStockQty: e.target.value })} />
        </Field>
        <Field label="Consumption account" hint="Where an issue lands in the P&L.">
          <input className="input" value={form.expenseAccountCode} onChange={(e) => setForm({ ...form, expenseAccountCode: e.target.value })} />
        </Field>
      </FormSection>
    </Modal>
  );
}

function LocationModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ name: '', kind: 'WAREHOUSE', costCenterId: '' });
  const centres = useQuery({
    queryKey: ['core', 'cost-centers'],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string }[]>('/core/cost-centers')).data,
    enabled: open,
  });
  const save = useMutation({
    mutationFn: async () => (await api.post('/core/locations', {
      name: form.name.trim(), kind: form.kind, costCenterId: form.costCenterId || undefined,
    })).data,
    onSuccess: () => { toast.success('Location added'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not add the location'),
  });
  return (
    <Modal
      open={open} onClose={onClose} title="New location" width={620}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || form.name.trim().length < 2} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Add location'}
          </button>
        </>
      )}
    >
      <FormSection title="Location">
        <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Central store" /></Field>
        <Field label="Kind">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="WAREHOUSE">Warehouse / Depot</option>
            <option value="SITE">Property / Site</option>
            <option value="OUTLET">Branch / Office</option>
            <option value="VEHICLE">Service Vehicle</option>
          </select>
        </Field>
        <Field label="Cost centre" span={2} hint="Movements here inherit this centre, so their money side is tagged without anyone repeating it.">
          <select className="input" value={form.costCenterId} onChange={(e) => setForm({ ...form, costCenterId: e.target.value })}>
            <option value="">None</option>
            {(centres.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
      </FormSection>
    </Modal>
  );
}

export const InventoryIcon = ArrowLeftRight;
