'use client';

/**
 * Billing — invoices, payments and refunds.
 *
 * On the platform's own Invoice / Payment tables, so a coworking invoice reaches
 * the P&L and the tax return without anybody wiring it there. Partial payments
 * are first-class; overpayment is refused rather than stored.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Plus, Receipt, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Modal, Segmented,
  Skeleton, StatCard, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { toneForInvoiceStatus } from '../ui/tone';
import {
  DateRange, Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, money, toDateInput, useListState,
} from '../ui/common';

interface InvoiceRow {
  id: string; number: string; status: string; category: string;
  customerName: string; customerEmail?: string | null;
  issueDate: string; dueDate?: string | null;
  subtotalInr: number; vatInr: number; totalInr: number; amountPaidInr: number;
  items: { id: string; description: string; quantity: number; unitPriceInr: number; amountInr: number }[];
  payments: { id: string; amountInr: number; method: string; reference?: string | null; paidAt: string }[];
}

export function CoworkingBilling() {
  const qc = useQueryClient();
  const { state, set, params } = useListState({ sort: 'issueDate', dir: 'desc' });
  const [view, setView] = useState<'All' | 'Outstanding'>('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cw-invoices', params],
    queryFn: async () => (await api.get<{
      data: InvoiceRow[];
      meta: { page: number; limit: number; total: number; totalPages: number };
      totals: { billedInr: number; collectedInr: number; outstandingInr: number };
    }>('/coworking/invoices', { params })).data,
    enabled: view === 'All',
  });

  const { data: outstanding, isLoading: outLoading } = useQuery({
    queryKey: ['cw-outstanding'],
    queryFn: async () => (await api.get<(InvoiceRow & { outstandingInr: number; daysOverdue: number })[]>('/coworking/invoices/outstanding')).data,
    enabled: view === 'Outstanding',
  });

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      key: 'number', header: 'Invoice', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.number}</span>
          <span className="ds-caption">{humanStatus(r.category)}</span>
        </span>
      ),
    },
    { key: 'customerName', header: 'Customer' },
    { key: 'issueDate', header: 'Issued', sortable: true, render: (r) => fmtDate(r.issueDate) },
    { key: 'dueDate', header: 'Due', sortable: true, render: (r) => fmtDate(r.dueDate) },
    { key: 'totalInr', header: 'Total', align: 'right', sortable: true, render: (r) => money(r.totalInr) },
    { key: 'amountPaidInr', header: 'Paid', align: 'right', render: (r) => money(r.amountPaidInr) },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge tone={toneForInvoiceStatus(r.status)}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Billing"
        subtitle="What has been invoiced, collected and is still owed."
        actions={
          <>
            <Segmented options={['All', 'Outstanding']} value={view} onChange={(v) => setView(v as 'All' | 'Outstanding')} />
            <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />New invoice</button>
          </>
        }
      />

      {view === 'All' && data?.totals && (
        <div className="ds-grid ds-grid-kpi" style={{ marginBottom: 20 }}>
          <StatCard label="Billed" value={money(data.totals.billedInr)} icon={Receipt} tone="info" />
          <StatCard label="Collected" value={money(data.totals.collectedInr)} icon={Banknote} tone="active" />
          <StatCard label="Outstanding" value={money(data.totals.outstandingInr)} tone="renewal" />
        </div>
      )}

      {view === 'All' ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Invoice number or customer…" />
            <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']} />
            <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />
          </div>
          <Card flush>
            <DataTable
              rows={data?.data ?? []}
              columns={columns}
              rowKey={(r) => r.id}
              loading={isLoading}
              onRowClick={(r) => setOpenId(r.id)}
              empty={<EmptyState compact icon={Receipt} title="Nothing invoiced yet" body="Bookings and memberships raise invoices; you can also raise one by hand." />}
            />
          </Card>
          <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />
        </>
      ) : (
        <Card flush>
          <DataTable
            rows={outstanding ?? []}
            columns={[
              ...columns.slice(0, 4),
              { key: 'outstandingInr', header: 'Owed', align: 'right', render: (r) => money((r as InvoiceRow & { outstandingInr: number }).outstandingInr) },
              {
                key: 'daysOverdue', header: 'Overdue',
                render: (r) => {
                  const days = (r as InvoiceRow & { daysOverdue: number }).daysOverdue;
                  return days > 0 ? <Badge tone="expired">{days} days</Badge> : <span className="ds-caption">Not yet</span>;
                },
              },
            ]}
            rowKey={(r) => r.id}
            loading={outLoading}
            onRowClick={(r) => setOpenId(r.id)}
            empty={<EmptyState compact icon={Banknote} title="Nothing outstanding" body="Every invoice is settled." />}
          />
        </Card>
      )}

      {newOpen && <NewInvoice onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); qc.invalidateQueries({ queryKey: ['cw-invoices'] }); }} />}
      {openId && <InvoiceRecord id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function NewInvoice({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState(toDateInput(new Date(Date.now() + 14 * 86400000)));
  const [taxPct, setTaxPct] = useState('5');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ description: '', quantity: '1', unitPriceInr: '0' }]);

  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; reference: string }[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
  });

  const create = useMutation({
    mutationFn: () => api.post('/coworking/invoices', {
      customerId: customerId || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      taxPct: Number(taxPct) || 0,
      notes: notes.trim() || undefined,
      lines: lines.filter((l) => l.description.trim()).map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity) || 1,
        unitPriceInr: Number(l.unitPriceInr) || 0,
      })),
    }),
    onSuccess: () => { toast.success('Invoice raised'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const subtotal = lines.reduce((n, l) => n + (Number(l.quantity) || 1) * (Number(l.unitPriceInr) || 0), 0);
  const tax = Math.round((subtotal * (Number(taxPct) || 0)) / 100);

  return (
    <Drawer
      open onClose={onClose} title="New invoice" width={560}
      actions={
        <button className="btn-primary btn-sm" disabled={!customerId || !lines.some((l) => l.description.trim()) || create.isPending} onClick={() => create.mutate()}>
          Raise it
        </button>
      }
    >
      <FormSection title="Customer">
        <Field label="Customer" required span={2}>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Choose…</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.reference})</option>)}
          </select>
        </Field>
        <Field label="Due date"><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="Tax %"><input className="input" type="number" min={0} max={100} value={taxPct} onChange={(e) => setTaxPct(e.target.value)} /></Field>
      </FormSection>

      <FormSection title="Lines">
        <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input className="input" placeholder="Description" value={l.description}
                onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
              <input className="input" style={{ width: 68 }} type="number" min={1} value={l.quantity} aria-label="Quantity"
                onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
              <input className="input" style={{ width: 100 }} type="number" min={0} value={l.unitPriceInr} aria-label="Unit price"
                onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unitPriceInr: e.target.value } : x))} />
              <button className="btn-ghost btn-sm" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setLines([...lines, { description: '', quantity: '1', unitPriceInr: '0' }])}>
            <Plus size={13} style={{ marginRight: 6 }} />Add a line
          </button>
        </div>
        <Field label="Notes" span={2}><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </FormSection>

      <Card pad={14}>
        <div style={{ display: 'grid', gap: 5, fontSize: 13 }}>
          <div style={{ display: 'flex' }}><span>Subtotal</span><span style={{ marginLeft: 'auto' }}>{money(subtotal)}</span></div>
          <div style={{ display: 'flex' }}><span>Tax</span><span style={{ marginLeft: 'auto' }}>{money(tax)}</span></div>
          <div style={{ display: 'flex', fontWeight: 700 }}><span>Total</span><span style={{ marginLeft: 'auto' }}>{money(subtotal + tax)}</span></div>
        </div>
      </Card>
    </Drawer>
  );
}

function InvoiceRecord({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK');
  const [reference, setReference] = useState('');

  const { data: inv, isLoading } = useQuery({
    queryKey: ['cw-invoice', id],
    queryFn: async () => (await api.get<InvoiceRow & {
      booking?: { id: string; reference: string; space: { name: string } } | null;
      membership?: { id: string; reference: string; plan: { name: string } } | null;
      customer?: { id: string; name: string } | null;
    }>(`/coworking/invoices/${id}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cw-invoice', id] });
    qc.invalidateQueries({ queryKey: ['cw-invoices'] });
    qc.invalidateQueries({ queryKey: ['cw-outstanding'] });
    qc.invalidateQueries({ queryKey: ['cw-dashboard'] });
  };

  const pay = useMutation({
    mutationFn: () => api.post(`/coworking/invoices/${id}/payments`, {
      amountInr: Number(amount) || 0, method, reference: reference.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Payment recorded'); setPayOpen(false); setAmount(''); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const refund = useMutation({
    mutationFn: ({ amountInr, reason }: { amountInr: number; reason: string }) => api.post(`/coworking/invoices/${id}/refund`, { amountInr, reason }),
    onSuccess: () => { toast.success('Refund recorded'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const outstanding = inv ? inv.totalInr - inv.amountPaidInr : 0;

  return (
    <>
      <Drawer
        open onClose={onClose} title={inv?.number ?? 'Invoice'} subtitle={inv?.customerName} width={560}
        actions={inv && <Badge tone={toneForInvoiceStatus(inv.status)}>{humanStatus(inv.status)}</Badge>}
      >
        {isLoading || !inv ? (
          <Skeleton rows={4} height={60} />
        ) : (
          <div style={{ display: 'grid', gap: 22 }}>
            <DetailGrid>
              <Detail label="Issued" value={fmtDate(inv.issueDate)} />
              <Detail label="Due" value={fmtDate(inv.dueDate)} />
              <Detail label="Category" value={humanStatus(inv.category)} />
              <Detail label="Outstanding" value={money(outstanding)} />
              <Detail label="Booking" value={inv.booking?.reference} />
              <Detail label="Membership" value={inv.membership?.reference} />
            </DetailGrid>

            <table className="ds-table ds-table-dense">
              <thead><tr><th>Item</th><th className="ds-col-num">Qty</th><th className="ds-col-num">Amount</th></tr></thead>
              <tbody>
                {inv.items.map((i) => (
                  <tr key={i.id}><td>{i.description}</td><td className="ds-col-num">{i.quantity}</td><td className="ds-col-num">{money(i.amountInr)}</td></tr>
                ))}
                <tr><td colSpan={2}>Subtotal</td><td className="ds-col-num">{money(inv.subtotalInr)}</td></tr>
                <tr><td colSpan={2}>Tax</td><td className="ds-col-num">{money(inv.vatInr)}</td></tr>
                <tr><td colSpan={2} style={{ fontWeight: 700 }}>Total</td><td className="ds-col-num" style={{ fontWeight: 700 }}>{money(inv.totalInr)}</td></tr>
              </tbody>
            </table>

            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Payments</h3>
              {inv.payments.length === 0 ? (
                <div className="ds-caption">Nothing collected yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {inv.payments.map((p) => (
                    <div key={p.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span>{money(p.amountInr)} · {humanStatus(p.method)}</span>
                      <span className="ds-caption" style={{ marginLeft: 'auto' }}>{fmtDate(p.paidAt)}{p.reference ? ` · ${p.reference}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {outstanding > 0 && !['CANCELLED', 'REFUNDED'].includes(inv.status) && (
                <button className="btn-primary btn-sm" onClick={() => { setAmount(String(outstanding)); setPayOpen(true); }}>
                  Record a payment
                </button>
              )}
              {inv.amountPaidInr > 0 && (
                <button className="btn-ghost btn-sm" onClick={() => {
                  const raw = window.prompt(`Refund how much? (up to ${inv.amountPaidInr})`, String(inv.amountPaidInr));
                  if (!raw) return;
                  const reason = window.prompt('Why?') ?? '';
                  refund.mutate({ amountInr: Number(raw), reason });
                }}>Refund</button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={payOpen} onClose={() => setPayOpen(false)} title="Record a payment" width={440}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPayOpen(false)}>Cancel</button>
            <button className="btn-primary" style={{ marginLeft: 'auto' }} disabled={!amount || pay.isPending} onClick={() => pay.mutate()}>Record</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Amount" hint={`${money(outstanding)} outstanding. More than that is refused.`}>
            <input className="input" type="number" min={1} max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {['CASH', 'CARD', 'BANK', 'ONLINE', 'CHEQUE'].map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
            </select>
          </Field>
          <Field label="Reference"><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / transaction id" /></Field>
        </div>
      </Modal>
    </>
  );
}
