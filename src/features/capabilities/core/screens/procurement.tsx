'use client';

/**
 * Procurement: request → approval → order → receipt → bill.
 *
 * The screen is built around the one thing people get wrong about this chain:
 * an order is a COMMITMENT, not a cost. So the commitments board leads with two
 * separate numbers — goods promised but not delivered, and goods delivered but
 * not invoiced — because those are two different people's problems, and the
 * second one is the GRNI balance an accountant has to clear.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, PackageCheck, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge, Card, DataTable, EmptyState, Field, FormSection, Modal, SectionTitle, Segmented,
  Skeleton, StatCard, type DataTableColumn, type Tone,
} from '@/features/verticals/insurance/insurance/ui/kit';
import { PageHead, TableNote, fmtDate, fromPaise, humanise, money, qty, toDateInput } from '../ui';

interface Request {
  id: string; reference: string; title: string; status: string; estimatedInr: number;
  neededBy: string | null; createdAt: string;
  costCenter?: { code: string; name: string } | null;
  items: { id: string; description: string; uom: string; qty: number; estUnitPaise: number }[];
}

interface OrderLine {
  id: string; description: string; uom: string; qty: number; unitPaise: number; gstRate: number;
  amountInr: number; receivedQty: number; billedQty: number;
  pendingReceiptQty: number; pendingBillQty: number; overBilledQty: number;
  item?: { code: string; name: string; uom: string } | null;
  location?: { id: string; code: string; name: string } | null;
}

interface Order {
  id: string; reference: string; status: string; orderDate: string; expectedDate: string | null;
  subtotalInr: number; taxInr: number; totalInr: number; interState: boolean;
  vendor: { id: string; name: string; gstin?: string | null };
  costCenter?: { id: string; code: string; name: string } | null;
  items: OrderLine[];
  receipts?: { id: string; reference: string; receivedAt: string; location: { name: string } }[];
  bills?: { id: string; billNumber: string; totalInr: number; status: string }[];
  orderedQty: number; receivedQty: number; billedQty: number;
  pendingReceiptQty: number; pendingBillQty: number;
}

interface Commitments {
  rows: {
    id: string; reference: string; vendor: string; status: string;
    orderDate: string; expectedDate: string | null;
    totalInr: number; undeliveredInr: number; uninvoicedInr: number; overdue: boolean;
    costCenter?: { code: string; name: string } | null;
  }[];
  totals: { undeliveredInr: number; uninvoicedInr: number; overdueOrders: number };
}

const VIEWS = ['Commitments', 'Requests', 'Orders', 'Receipts'];

const statusTone = (s: string): Tone => {
  if (s === 'APPROVED' || s === 'RECEIVED' || s === 'BILLED') return 'active';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'expired';
  if (s === 'SUBMITTED') return 'renewal';
  return 'info';
};

export function ProcurementScreen() {
  const qc = useQueryClient();
  const [view, setView] = useState(VIEWS[0]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [receiving, setReceiving] = useState<Order | null>(null);

  const commitments = useQuery({
    queryKey: ['core', 'commitments'], queryFn: async () => (await api.get<Commitments>('/core/commitments')).data,
    enabled: view === 'Commitments',
  });
  const requests = useQuery({
    queryKey: ['core', 'purchase-requests'], queryFn: async () => (await api.get<Request[]>('/core/purchase-requests')).data,
    enabled: view === 'Requests' || orderOpen,
  });
  const orders = useQuery({
    queryKey: ['core', 'purchase-orders'], queryFn: async () => (await api.get<Order[]>('/core/purchase-orders')).data,
    enabled: view === 'Orders' || view === 'Commitments',
  });
  const receipts = useQuery({
    queryKey: ['core', 'goods-receipts'], queryFn: async () => (await api.get<any[]>('/core/goods-receipts')).data,
    enabled: view === 'Receipts',
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['core'] });
  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) =>
      (await api.post(`/core/purchase-requests/${id}/${approve ? 'approve' : 'reject'}`, {})).data,
    onSuccess: (_d, v) => { toast.success(v.approve ? 'Request approved' : 'Request rejected'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not decide'),
  });
  const bill = useMutation({
    mutationFn: async (orderId: string) => (await api.post('/core/bills/from-order', { orderId })).data,
    onSuccess: () => { toast.success('Supplier bill raised'); setOpenOrder(null); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not raise the bill'),
  });

  const openDetail = async (id: string) => {
    const { data } = await api.get<Order>(`/core/purchase-orders/${id}`);
    setOpenOrder(data);
  };

  return (
    <div className="ds-page">
      <PageHead
        title="Procurement"
        subtitle="Request, approve, order, receive, bill. Only the receipt and the bill touch the ledger — an order is a promise, and a promise is not an expense."
        actions={(
          <>
            <button className="btn-secondary" onClick={() => setRequestOpen(true)}>New request</button>
            <button className="btn-primary" onClick={() => setOrderOpen(true)}>New order</button>
          </>
        )}
      />

      <div style={{ marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>

      {view === 'Commitments' && (commitments.isLoading ? <Skeleton rows={4} /> : (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Ordered, not delivered" value={money(commitments.data?.totals.undeliveredInr ?? 0)} hint="a commitment — nothing is posted for it" />
            <StatCard
              label="Received, not invoiced"
              value={money(commitments.data?.totals.uninvoicedInr ?? 0)}
              hint="sits in Goods Received Not Invoiced until the bill arrives"
              tone="renewal"
            />
            <StatCard
              label="Overdue orders"
              value={String(commitments.data?.totals.overdueOrders ?? 0)}
              hint="past their expected date with goods still outstanding"
              tone={(commitments.data?.totals.overdueOrders ?? 0) > 0 ? 'expired' : 'neutral'}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Card flush>
              <DataTable
                columns={[
                  { key: 'reference', header: 'Order', sortable: true, render: (r: any) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
                  { key: 'vendor', header: 'Supplier', sortable: true, render: (r: any) => r.vendor },
                  { key: 'costCenter', header: 'Cost centre', render: (r: any) => (r.costCenter ? r.costCenter.code : '—') },
                  { key: 'expectedDate', header: 'Expected', sortable: true, render: (r: any) => fmtDate(r.expectedDate) },
                  { key: 'undeliveredInr', header: 'Undelivered', align: 'right', sortable: true, render: (r: any) => money(r.undeliveredInr) },
                  { key: 'uninvoicedInr', header: 'Uninvoiced', align: 'right', sortable: true, render: (r: any) => money(r.uninvoicedInr) },
                  { key: 'overdue', header: '', render: (r: any) => (r.overdue ? <Badge tone="expired">Overdue</Badge> : <Badge tone={statusTone(r.status)}>{humanise(r.status)}</Badge>) },
                ] as DataTableColumn<any>[]}
                rows={commitments.data?.rows ?? []}
                rowKey={(r) => r.id}
                onRowClick={(r) => openDetail(r.id)}
                empty="Nothing outstanding — every order is delivered and invoiced."
              />
              <TableNote>
                A line that sits in &ldquo;received, not invoiced&rdquo; for months is usually a receipt nobody
                billed rather than a slow supplier.
              </TableNote>
            </Card>
          </div>
        </>
      ))}

      {view === 'Requests' && (requests.isLoading ? <Skeleton rows={3} /> : (requests.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No purchase requests" body="A request is how someone asks to buy something. Whoever approves it cannot be the person who raised it." actionLabel="New request" onAction={() => setRequestOpen(true)} />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'reference', header: 'Request', sortable: true, render: (r: Request) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.reference} · {r.title}</div>
                  <div className="ds-caption">{r.items.length} line{r.items.length === 1 ? '' : 's'}{r.costCenter ? ` · ${r.costCenter.code}` : ''}</div>
                </div>
              ) },
              { key: 'neededBy', header: 'Needed by', sortable: true, render: (r: Request) => fmtDate(r.neededBy) },
              { key: 'estimatedInr', header: 'Estimate', align: 'right', sortable: true, render: (r: Request) => money(r.estimatedInr) },
              { key: 'status', header: 'Status', render: (r: Request) => <Badge tone={statusTone(r.status)}>{humanise(r.status)}</Badge> },
              { key: 'actions', header: '', render: (r: Request) => (
                r.status === 'SUBMITTED' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-primary" onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</button>
                    <button className="btn-secondary" onClick={() => decide.mutate({ id: r.id, approve: false })}>Reject</button>
                  </div>
                ) : null
              ) },
            ] as DataTableColumn<Request>[]}
            rows={requests.data ?? []}
            rowKey={(r) => r.id}
          />
          <TableNote>Approving your own request is refused by the server, not merely hidden here.</TableNote>
        </Card>
      ))}

      {view === 'Orders' && (orders.isLoading ? <Skeleton rows={3} /> : (orders.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={ShoppingCart} title="No purchase orders" body="An order records what was agreed with a supplier — quantity, price and where it should be delivered." actionLabel="New order" onAction={() => setOrderOpen(true)} />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'reference', header: 'Order', sortable: true, render: (o: Order) => <span style={{ fontWeight: 600 }}>{o.reference}</span> },
              { key: 'vendor', header: 'Supplier', sortable: true, render: (o: Order) => o.vendor.name },
              { key: 'orderDate', header: 'Placed', sortable: true, render: (o: Order) => fmtDate(o.orderDate) },
              { key: 'totalInr', header: 'Value', align: 'right', sortable: true, render: (o: Order) => money(o.totalInr) },
              { key: 'received', header: 'Received', align: 'right', render: (o: Order) => `${qty(o.receivedQty)} / ${qty(o.orderedQty)}` },
              { key: 'billed', header: 'Billed', align: 'right', render: (o: Order) => qty(o.billedQty) },
              { key: 'status', header: '', render: (o: Order) => <Badge tone={statusTone(o.status)}>{humanise(o.status)}</Badge> },
            ] as DataTableColumn<Order>[]}
            rows={orders.data ?? []}
            rowKey={(o) => o.id}
            onRowClick={(o) => openDetail(o.id)}
          />
          <TableNote>Status is computed from the line quantities, never typed — a status column somebody can edit eventually disagrees with what was actually delivered.</TableNote>
        </Card>
      ))}

      {view === 'Receipts' && (receipts.isLoading ? <Skeleton rows={3} /> : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'reference', header: 'Receipt', sortable: true, render: (r: any) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
              { key: 'order', header: 'Order', render: (r: any) => `${r.order?.reference ?? '—'} · ${r.order?.vendor?.name ?? ''}` },
              { key: 'location', header: 'Into', render: (r: any) => r.location?.name ?? '—' },
              { key: 'receivedAt', header: 'Received', sortable: true, render: (r: any) => fmtDate(r.receivedAt) },
              { key: 'lines', header: 'Lines', align: 'right', render: (r: any) => String(r._count?.items ?? 0) },
            ] as DataTableColumn<any>[]}
            rows={receipts.data ?? []}
            rowKey={(r) => r.id}
            empty="Nothing received yet."
          />
          <TableNote>
            Each receipt raises stock and accrues the liability into Goods Received Not Invoiced. The bill
            later clears that accrual rather than charging the cost a second time.
          </TableNote>
        </Card>
      ))}

      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} onSaved={invalidate} />
      <OrderModal open={orderOpen} onClose={() => setOrderOpen(false)} requests={requests.data ?? []} onSaved={invalidate} />
      <OrderDetail
        order={openOrder}
        onClose={() => setOpenOrder(null)}
        onReceive={() => { setReceiving(openOrder); setOpenOrder(null); }}
        onBill={() => openOrder && bill.mutate(openOrder.id)}
        billing={bill.isPending}
      />
      <ReceiveModal order={receiving} onClose={() => setReceiving(null)} onSaved={invalidate} />
    </div>
  );
}

function OrderDetail({ order, onClose, onReceive, onBill, billing }: {
  order: Order | null; onClose: () => void; onReceive: () => void; onBill: () => void; billing: boolean;
}) {
  if (!order) return null;
  const canReceive = order.pendingReceiptQty > 0 && order.status !== 'CANCELLED';
  const canBill = order.pendingBillQty > 0;
  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={`${order.reference} · ${order.vendor.name}`}
      subtitle={`Placed ${fmtDate(order.orderDate)}${order.expectedDate ? ` · expected ${fmtDate(order.expectedDate)}` : ''}${order.costCenter ? ` · ${order.costCenter.code}` : ''}`}
      width={980}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {canReceive && <button className="btn-secondary" onClick={onReceive}>Receive goods</button>}
          {canBill && (
            <button className="btn-primary" disabled={billing} onClick={onBill}>
              {billing ? 'Raising…' : `Bill ${qty(order.pendingBillQty)} received`}
            </button>
          )}
        </>
      )}
    >
      <div className="ds-grid ds-grid-kpi" style={{ marginBottom: 16 }}>
        <StatCard label="Order value" value={money(order.totalInr)} hint={`${money(order.subtotalInr)} + ${money(order.taxInr)} tax`} />
        <StatCard label="Still to arrive" value={qty(order.pendingReceiptQty)} hint="ordered minus received" />
        <StatCard label="Received, not billed" value={qty(order.pendingBillQty)} hint="what a supplier bill may cover" tone={order.pendingBillQty > 0 ? 'renewal' : 'neutral'} />
      </div>

      <SectionTitle sub="A bill may only cover what has been received — that is what makes a three-way match possible.">Lines</SectionTitle>
      <Card flush>
        <DataTable
          dense
          columns={[
            { key: 'description', header: 'Item', render: (l: OrderLine) => (
              <div>
                <div style={{ fontWeight: 600 }}>{l.item?.name ?? l.description}</div>
                {l.location && <div className="ds-caption">to {l.location.name}</div>}
              </div>
            ) },
            { key: 'qty', header: 'Ordered', align: 'right', render: (l: OrderLine) => qty(l.qty, l.uom) },
            { key: 'unitPaise', header: 'Rate', align: 'right', render: (l: OrderLine) => fromPaise(l.unitPaise) },
            { key: 'receivedQty', header: 'Received', align: 'right', render: (l: OrderLine) => qty(l.receivedQty, l.uom) },
            { key: 'billedQty', header: 'Billed', align: 'right', render: (l: OrderLine) => qty(l.billedQty, l.uom) },
            { key: 'pendingReceiptQty', header: 'Pending', align: 'right', render: (l: OrderLine) => (
              l.overBilledQty > 0
                ? <Badge tone="expired">Billed {qty(l.overBilledQty)} beyond receipt</Badge>
                : qty(l.pendingReceiptQty, l.uom)
            ) },
            { key: 'amountInr', header: 'Amount', align: 'right', render: (l: OrderLine) => money(l.amountInr) },
          ] as DataTableColumn<OrderLine>[]}
          rows={order.items}
          rowKey={(l) => l.id}
        />
      </Card>

      {(order.receipts?.length ?? 0) > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle>Receipts</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {order.receipts!.map((r) => (
              <div key={r.id} className="ds-caption">{r.reference} · {fmtDate(r.receivedAt)} · into {r.location.name}</div>
            ))}
          </div>
        </div>
      )}
      {(order.bills?.length ?? 0) > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle>Bills</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {order.bills!.map((b) => (
              <div key={b.id} className="ds-caption">{b.billNumber} · {money(b.totalInr)} · {humanise(b.status)}</div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function RequestModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [costCenterId, setCentre] = useState('');
  const [lines, setLines] = useState([{ description: '', uom: 'nos', qty: '', estUnitPaise: '' }]);
  const centres = useQuery({
    queryKey: ['core', 'cost-centers'],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string }[]>('/core/cost-centers')).data,
    enabled: open,
  });
  const save = useMutation({
    mutationFn: async () => (await api.post('/core/purchase-requests', {
      title: title.trim(),
      neededBy: neededBy || undefined,
      costCenterId: costCenterId || undefined,
      items: lines.filter((l) => l.description.trim() && Number(l.qty) > 0).map((l) => ({
        description: l.description.trim(), uom: l.uom, qty: Number(l.qty),
        estUnitPaise: l.estUnitPaise ? Math.round(Number(l.estUnitPaise) * 100) : undefined,
      })),
    })).data,
    onSuccess: () => { toast.success('Request submitted'); setTitle(''); setLines([{ description: '', uom: 'nos', qty: '', estUnitPaise: '' }]); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not submit'),
  });
  const usable = title.trim().length >= 2 && lines.some((l) => l.description.trim() && Number(l.qty) > 0);
  return (
    <Modal
      open={open} onClose={onClose} title="New purchase request" width={860}
      subtitle="Submitted for approval. Whoever approves it must be someone other than you."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !usable} onClick={() => save.mutate()}>
            {save.isPending ? 'Submitting…' : 'Submit for approval'}
          </button>
        </>
      )}
    >
      <FormSection title="Request">
        <Field label="What is it for" required><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Property maintenance supplies & spares" /></Field>
        <Field label="Needed by"><input className="input" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></Field>
        <Field label="Cost centre" span={2}>
          <select className="input" value={costCenterId} onChange={(e) => setCentre(e.target.value)}>
            <option value="">—</option>
            {(centres.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
      </FormSection>
      <FormSection title="Lines">
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 2 }} placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input className="input" style={{ width: 90 }} placeholder="Unit" value={l.uom} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, uom: e.target.value } : x)))} />
              <input className="input" style={{ width: 110 }} type="number" step="0.001" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <input className="input" style={{ width: 130 }} type="number" step="0.01" placeholder="Est. rate ₹" value={l.estUnitPaise} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, estUnitPaise: e.target.value } : x)))} />
              <button className="btn-secondary" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>−</button>
            </div>
          ))}
          <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setLines([...lines, { description: '', uom: 'nos', qty: '', estUnitPaise: '' }])}>Add a line</button>
        </div>
      </FormSection>
    </Modal>
  );
}

function OrderModal({ open, onClose, requests, onSaved }: {
  open: boolean; onClose: () => void; requests: Request[]; onSaved: () => void;
}) {
  const [vendorId, setVendor] = useState('');
  const [requestId, setRequestId] = useState('');
  const [expectedDate, setExpected] = useState('');
  const [costCenterId, setCentre] = useState('');
  const [locationId, setLocation] = useState('');
  const [interState, setInterState] = useState(false);
  const [lines, setLines] = useState([{ description: '', uom: 'nos', qty: '', unitPaise: '', gstRate: '18' }]);

  const vendors = useQuery({
    queryKey: ['core', 'vendors'],
    queryFn: async () => (await api.get<{ id: string; name: string; kind: string }[]>('/purchasing/parties', { params: { kind: 'VENDOR' } })).data,
    enabled: open,
  });
  const centres = useQuery({
    queryKey: ['core', 'cost-centers'],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string }[]>('/core/cost-centers')).data,
    enabled: open,
  });
  const locations = useQuery({
    queryKey: ['core', 'locations'],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string }[]>('/core/locations')).data,
    enabled: open,
  });

  // Pull the approved request's lines in, so an order is not retyped from a
  // request somebody already itemised.
  const chosen = requests.find((r) => r.id === requestId);
  React.useEffect(() => {
    if (!chosen) return;
    setLines(chosen.items.map((i) => ({
      description: i.description, uom: i.uom, qty: String(i.qty),
      unitPaise: i.estUnitPaise ? String(i.estUnitPaise / 100) : '', gstRate: '18',
    })));
    if (chosen.costCenter) {
      const match = (centres.data ?? []).find((c) => c.code === chosen.costCenter!.code);
      if (match) setCentre(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + Math.round((Number(l.unitPaise) || 0) * 100 * (Number(l.qty) || 0) / 100), 0);
    const tax = lines.reduce((s, l) => {
      const amt = Math.round((Number(l.unitPaise) || 0) * 100 * (Number(l.qty) || 0) / 100);
      return s + Math.round((amt * (Number(l.gstRate) || 0)) / 100);
    }, 0);
    return { sub, tax, total: sub + tax };
  }, [lines]);

  const save = useMutation({
    mutationFn: async () => (await api.post('/core/purchase-orders', {
      vendorId,
      requestId: requestId || undefined,
      expectedDate: expectedDate || undefined,
      costCenterId: costCenterId || undefined,
      interState,
      items: lines.filter((l) => l.description.trim() && Number(l.qty) > 0).map((l) => ({
        description: l.description.trim(), uom: l.uom,
        qty: Number(l.qty),
        unitPaise: Math.round((Number(l.unitPaise) || 0) * 100),
        gstRate: Number(l.gstRate) || 0,
        locationId: locationId || undefined,
      })),
    })).data,
    onSuccess: () => { toast.success('Purchase order placed'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not place the order'),
  });
  const usable = !!vendorId && lines.some((l) => l.description.trim() && Number(l.qty) > 0);

  return (
    <Modal
      open={open} onClose={onClose} title="New purchase order" width={720}
      subtitle="Nothing is posted when an order is placed. The ledger moves when the goods arrive."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !usable} onClick={() => save.mutate()}>
            {save.isPending ? 'Placing…' : `Place order · ${money(totals.total)}`}
          </button>
        </>
      )}
    >
      <FormSection title="Order">
        <Field label="Supplier" required>
          <select className="input" value={vendorId} onChange={(e) => setVendor(e.target.value)}>
            <option value="">Choose…</option>
            {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <Field label="Against request" hint="Only an approved request can be ordered.">
          <select className="input" value={requestId} onChange={(e) => setRequestId(e.target.value)}>
            <option value="">Direct order</option>
            {requests.filter((r) => r.status === 'APPROVED').map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.title}</option>)}
          </select>
        </Field>
        <Field label="Expected"><input className="input" type="date" value={expectedDate} onChange={(e) => setExpected(e.target.value)} /></Field>
        <Field label="Cost centre">
          <select className="input" value={costCenterId} onChange={(e) => setCentre(e.target.value)}>
            <option value="">—</option>
            {(centres.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
        <Field label="Deliver to" hint="Where the goods will be received into stock.">
          <select className="input" value={locationId} onChange={(e) => setLocation(e.target.value)}>
            <option value="">—</option>
            {(locations.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </Field>
        <Field label="Place of supply">
          <select className="input" value={interState ? 'inter' : 'intra'} onChange={(e) => setInterState(e.target.value === 'inter')}>
            <option value="intra">Same state — CGST + SGST</option>
            <option value="inter">Other state — IGST</option>
          </select>
        </Field>
      </FormSection>
      <FormSection title="Lines">
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 2 }} placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input className="input" style={{ width: 80 }} placeholder="Unit" value={l.uom} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, uom: e.target.value } : x)))} />
              <input className="input" style={{ width: 100 }} type="number" step="0.001" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <input className="input" style={{ width: 120 }} type="number" step="0.01" placeholder="Rate ₹" value={l.unitPaise} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitPaise: e.target.value } : x)))} />
              <select className="input" style={{ width: 90 }} value={l.gstRate} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, gstRate: e.target.value } : x)))}>
                {['0', '3', '5', '12', '18', '28'].map((g) => <option key={g} value={g}>{g}%</option>)}
              </select>
              <button className="btn-secondary" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>−</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setLines([...lines, { description: '', uom: 'nos', qty: '', unitPaise: '', gstRate: '18' }])}>Add a line</button>
            <span className="ds-caption">{money(totals.sub)} + {money(totals.tax)} tax = <strong>{money(totals.total)}</strong></span>
          </div>
        </div>
      </FormSection>
    </Modal>
  );
}

function ReceiveModal({ order, onClose, onSaved }: { order: Order | null; onClose: () => void; onSaved: () => void }) {
  const [locationId, setLocation] = useState('');
  const [vendorDocNo, setDoc] = useState('');
  const [receivedAt, setReceivedAt] = useState(toDateInput());
  const [rows, setRows] = useState<Record<string, { qty: string; batchNo: string; expiryDate: string; rejectedQty: string }>>({});

  const locations = useQuery({
    queryKey: ['core', 'locations'],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string }[]>('/core/locations')).data,
    enabled: !!order,
  });

  React.useEffect(() => {
    if (!order) return;
    // Default to receiving everything still outstanding — the common case, and
    // the one that should not need typing.
    setRows(Object.fromEntries(order.items.map((l) => [l.id, {
      qty: String(l.pendingReceiptQty || 0), batchNo: '', expiryDate: '', rejectedQty: '',
    }])));
    setLocation(order.items.find((l) => l.location)?.location?.id ?? '');
  }, [order]);

  const save = useMutation({
    mutationFn: async () => (await api.post('/core/goods-receipts', {
      orderId: order!.id,
      locationId,
      receivedAt,
      vendorDocNo: vendorDocNo || undefined,
      items: Object.entries(rows)
        .filter(([, v]) => Number(v.qty) > 0 || Number(v.rejectedQty) > 0)
        .map(([orderItemId, v]) => ({
          orderItemId,
          qty: Number(v.qty) || 0,
          batchNo: v.batchNo || undefined,
          expiryDate: v.expiryDate || undefined,
          rejectedQty: v.rejectedQty ? Number(v.rejectedQty) : undefined,
        })),
    })).data,
    onSuccess: () => { toast.success('Goods received'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not receive'),
  });

  if (!order) return null;
  return (
    <Modal
      open={!!order} onClose={onClose} title={`Receive against ${order.reference}`} width={940}
      subtitle="Stock rises and the liability is accrued into Goods Received Not Invoiced — the goods are owed for whether or not the bill has arrived."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !locationId} onClick={() => save.mutate()}>
            {save.isPending ? 'Receiving…' : 'Receive'}
          </button>
        </>
      )}
    >
      <FormSection title="Receipt">
        <Field label="Into" required>
          <select className="input" value={locationId} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Choose…</option>
            {(locations.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </Field>
        <Field label="Received on" required><input className="input" type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} /></Field>
        <Field label="Delivery note" hint="The supplier's own challan number."><input className="input" value={vendorDocNo} onChange={(e) => setDoc(e.target.value)} /></Field>
      </FormSection>
      <FormSection title="Lines">
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {order.items.filter((l) => l.pendingReceiptQty > 0).map((l) => (
            <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{l.item?.name ?? l.description}</div>
                <div className="ds-caption">{qty(l.pendingReceiptQty, l.uom)} outstanding</div>
              </div>
              <input className="input" style={{ width: 110 }} type="number" step="0.001" placeholder="Accepted" value={rows[l.id]?.qty ?? ''} onChange={(e) => setRows({ ...rows, [l.id]: { ...rows[l.id], qty: e.target.value } })} />
              <input className="input" style={{ width: 110 }} type="number" step="0.001" placeholder="Rejected" value={rows[l.id]?.rejectedQty ?? ''} onChange={(e) => setRows({ ...rows, [l.id]: { ...rows[l.id], rejectedQty: e.target.value } })} />
              {l.item && (
                <>
                  <input className="input" style={{ width: 120 }} placeholder="Batch" value={rows[l.id]?.batchNo ?? ''} onChange={(e) => setRows({ ...rows, [l.id]: { ...rows[l.id], batchNo: e.target.value } })} />
                  <input className="input" style={{ width: 150 }} type="date" value={rows[l.id]?.expiryDate ?? ''} onChange={(e) => setRows({ ...rows, [l.id]: { ...rows[l.id], expiryDate: e.target.value } })} />
                </>
              )}
            </div>
          ))}
          <p className="ds-caption">
            A rejected quantity never entered the store, so it is not received and never becomes owed for.
          </p>
        </div>
      </FormSection>
    </Modal>
  );
}

export const ProcurementIcon = PackageCheck;
