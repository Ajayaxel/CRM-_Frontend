'use client';

/**
 * Quotations — the proposal a lead is sent.
 *
 * Totals are recomputed from the lines by the server on every write, never
 * trusted from the client, and a twelve-month proposal quotes twelve months of
 * the recurring lines plus the one-off charges once. Accepting one raises a
 * contract that COPIES the numbers, so editing the proposal afterwards cannot
 * change what was signed.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, FileText, Plus, Send, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Skeleton,
  humanStatus, type DataTableColumn,
} from '../ui/kit';
import { toneForQuotationStatus } from '../ui/tone';
import {
  Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, money, toDateInput, useListState,
} from '../ui/common';

interface QuotationRow {
  id: string; reference: string; title?: string | null; status: string;
  totalInr: number; subtotalInr: number; taxInr: number; discountInr: number; depositInr: number;
  durationMonths: number; users: number; startDate?: string | null; expiresAt?: string | null;
  customer?: { id: string; name: string; reference: string } | null;
  lead?: { id: string; name: string; reference: string } | null;
  plan?: { id: string; name: string } | null;
  _count?: { lines: number };
}

interface Line { kind: string; description: string; quantity: string; unitPriceInr: string }

export function CoworkingQuotations() {
  const qc = useQueryClient();
  const { state, set, params } = useListState();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cw-quotations', params],
    queryFn: async () => (await api.get<{ data: QuotationRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/quotations', { params })).data,
  });

  const columns: DataTableColumn<QuotationRow>[] = [
    {
      key: 'reference', header: 'Proposal', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.reference}</span>
          <span className="ds-caption">{r.title || r.plan?.name || '—'}</span>
        </span>
      ),
    },
    { key: 'who', header: 'For', render: (r) => r.customer?.name ?? r.lead?.name ?? '—' },
    { key: 'durationMonths', header: 'Term', render: (r) => `${r.durationMonths} month${r.durationMonths === 1 ? '' : 's'} · ${r.users} user${r.users === 1 ? '' : 's'}` },
    { key: 'totalInr', header: 'Total', align: 'right', sortable: true, render: (r) => money(r.totalInr) },
    { key: 'expiresAt', header: 'Valid until', render: (r) => fmtDate(r.expiresAt) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={toneForQuotationStatus(r.status)}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Quotations"
        subtitle="What you offered, and what came of it."
        actions={<button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />New quotation</button>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Reference, customer…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setOpenId(r.id)}
          empty={<EmptyState compact icon={FileText} title="No quotations yet" body="Turn a qualified lead into a priced offer." actionLabel="New quotation" onAction={() => setNewOpen(true)} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      {newOpen && <QuotationEditor onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); qc.invalidateQueries({ queryKey: ['cw-quotations'] }); }} />}
      {openId && <QuotationRecord id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function QuotationEditor({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    leadId: '', customerId: '', planId: '', title: '', users: '1', startDate: toDateInput(),
    durationMonths: '12', discountPct: '0', taxPct: '5', depositInr: '0', terms: '', notes: '',
    expiresAt: toDateInput(new Date(Date.now() + 14 * 86400000)),
  });
  const [lines, setLines] = useState<Line[]>([{ kind: 'RECURRING', description: '', quantity: '1', unitPriceInr: '0' }]);

  const { data: leads } = useQuery({
    queryKey: ['cw-leads-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; reference: string }[] }>('/coworking/leads', { params: { limit: 200, status: 'OPEN' } })).data.data,
  });
  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; reference: string }[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
  });
  const { data: plans } = useQuery({
    queryKey: ['cw-plans-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; priceInr: number }[] }>('/coworking/plans', { params: { limit: 100, status: 'ACTIVE' } })).data.data,
  });

  const create = useMutation({
    mutationFn: () => api.post('/coworking/quotations', {
      leadId: form.leadId || undefined,
      customerId: form.customerId || undefined,
      planId: form.planId || undefined,
      title: form.title.trim() || undefined,
      users: Number(form.users) || 1,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      durationMonths: Number(form.durationMonths) || 1,
      discountPct: Number(form.discountPct) || 0,
      taxPct: Number(form.taxPct) || 0,
      depositInr: Number(form.depositInr) || 0,
      terms: form.terms.trim() || undefined,
      notes: form.notes.trim() || undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      lines: lines.filter((l) => l.description.trim()).map((l) => ({
        kind: l.kind, description: l.description.trim(),
        quantity: Number(l.quantity) || 1, unitPriceInr: Number(l.unitPriceInr) || 0,
      })),
    }),
    onSuccess: () => { toast.success('Quotation created'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const recurring = lines.filter((l) => l.kind === 'RECURRING').reduce((n, l) => n + (Number(l.quantity) || 1) * (Number(l.unitPriceInr) || 0), 0);
  const oneTime = lines.filter((l) => l.kind === 'ONE_TIME').reduce((n, l) => n + (Number(l.quantity) || 1) * (Number(l.unitPriceInr) || 0), 0);
  const months = Number(form.durationMonths) || 1;
  const subtotal = oneTime + recurring * months;
  const discount = Math.round((subtotal * (Number(form.discountPct) || 0)) / 100);
  const tax = Math.round(((subtotal - discount) * (Number(form.taxPct) || 0)) / 100);
  const total = subtotal - discount + tax + (Number(form.depositInr) || 0);

  return (
    <Drawer
      open onClose={onClose} title="New quotation" width={620}
      actions={
        <button className="btn-primary btn-sm" disabled={(!form.leadId && !form.customerId) || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <FormSection title="For whom">
        <Field label="Lead">
          <select className="input" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value, customerId: '' })}>
            <option value="">—</option>
            {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.reference})</option>)}
          </select>
        </Field>
        <Field label="or Customer">
          <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, leadId: '' })}>
            <option value="">—</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.reference})</option>)}
          </select>
        </Field>
        <Field label="Title" span={2}><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Private office for 6, 12 months" /></Field>
        <Field label="Plan">
          <select className="input" value={form.planId} onChange={(e) => {
            setForm({ ...form, planId: e.target.value });
            const p = plans?.find((x) => x.id === e.target.value);
            if (p) setLines((ls) => [{ kind: 'RECURRING', description: p.name, quantity: form.users, unitPriceInr: String(p.priceInr) }, ...ls.filter((l) => l.description.trim())]);
          }}>
            <option value="">—</option>
            {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Users"><input className="input" type="number" min={1} value={form.users} onChange={(e) => setForm({ ...form, users: e.target.value })} /></Field>
        <Field label="Starts"><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="Months"><input className="input" type="number" min={1} value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} /></Field>
      </FormSection>

      <FormSection title="Charges" description="Recurring lines are multiplied by the term; one-off lines are charged once.">
        <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select className="input" style={{ width: 118 }} value={l.kind} aria-label="Charge kind"
                onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}>
                <option value="RECURRING">Recurring</option>
                <option value="ONE_TIME">One-off</option>
              </select>
              <input className="input" placeholder="Description" value={l.description}
                onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
              <input className="input" style={{ width: 68 }} type="number" min={1} value={l.quantity} aria-label="Quantity"
                onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
              <input className="input" style={{ width: 96 }} type="number" min={0} value={l.unitPriceInr} aria-label="Unit price"
                onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unitPriceInr: e.target.value } : x))} />
              <button className="btn-ghost btn-sm" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn-ghost btn-sm" style={{ justifySelf: 'start' }}
            onClick={() => setLines([...lines, { kind: 'RECURRING', description: '', quantity: '1', unitPriceInr: '0' }])}>
            <Plus size={13} style={{ marginRight: 6 }} />Add a line
          </button>
        </div>
      </FormSection>

      <FormSection title="Adjustments">
        <Field label="Discount %"><input className="input" type="number" min={0} max={100} value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: e.target.value })} /></Field>
        <Field label="Tax %"><input className="input" type="number" min={0} max={100} value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value })} /></Field>
        <Field label="Deposit"><input className="input" type="number" min={0} value={form.depositInr} onChange={(e) => setForm({ ...form, depositInr: e.target.value })} /></Field>
        <Field label="Valid until"><input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
        <Field label="Terms" span={2}><textarea className="input" rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></Field>
      </FormSection>

      <Card pad={16}>
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          <div style={{ display: 'flex' }}><span>Recurring × {months}</span><span style={{ marginLeft: 'auto' }}>{money(recurring * months)}</span></div>
          <div style={{ display: 'flex' }}><span>One-off</span><span style={{ marginLeft: 'auto' }}>{money(oneTime)}</span></div>
          <div style={{ display: 'flex' }}><span>Discount</span><span style={{ marginLeft: 'auto' }}>−{money(discount)}</span></div>
          <div style={{ display: 'flex' }}><span>Tax</span><span style={{ marginLeft: 'auto' }}>{money(tax)}</span></div>
          <div style={{ display: 'flex', fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--hairline)' }}>
            <span>Total</span><span style={{ marginLeft: 'auto' }}>{money(total)}</span>
          </div>
        </div>
        <div className="ds-caption" style={{ marginTop: 8 }}>An estimate — the server recomputes it from the lines when you save.</div>
      </Card>
    </Drawer>
  );
}

interface QuotationDetail extends QuotationRow {
  lines: { id: string; kind: string; description: string; quantity: number; unitPriceInr: number; amountInr: number }[];
  terms?: string | null; notes?: string | null; rejectReason?: string | null;
  oneTimeInr: number; recurringInr: number; taxPct: number;
  contracts: { id: string; reference: string; status: string }[];
}

function QuotationRecord({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: q, isLoading } = useQuery({
    queryKey: ['cw-quotation', id],
    queryFn: async () => (await api.get<QuotationDetail>(`/coworking/quotations/${id}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cw-quotation', id] });
    qc.invalidateQueries({ queryKey: ['cw-quotations'] });
  };

  const setStatus = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => api.patch(`/coworking/quotations/${id}/status`, { status, reason }),
    onSuccess: () => { toast.success('Updated'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const duplicate = useMutation({
    mutationFn: () => api.post(`/coworking/quotations/${id}/duplicate`, {}),
    onSuccess: () => { toast.success('Duplicated'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const toContract = useMutation({
    mutationFn: () => api.post(`/coworking/quotations/${id}/contract`, {}),
    onSuccess: (res) => {
      toast.success(`Contract ${(res.data as { reference: string }).reference} raised`);
      invalidate();
      qc.invalidateQueries({ queryKey: ['cw-contracts'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose}
      title={q?.reference ?? 'Quotation'}
      subtitle={q ? (q.title ?? q.customer?.name ?? q.lead?.name ?? undefined) : undefined}
      width={580}
      actions={q && <Badge tone={toneForQuotationStatus(q.status)}>{humanStatus(q.status)}</Badge>}
    >
      {isLoading || !q ? (
        <Skeleton rows={4} height={60} />
      ) : (
        <div style={{ display: 'grid', gap: 22 }}>
          <DetailGrid>
            <Detail label="For" value={q.customer?.name ?? q.lead?.name} />
            <Detail label="Plan" value={q.plan?.name} />
            <Detail label="Term" value={`${q.durationMonths} month(s)`} />
            <Detail label="Users" value={q.users} />
            <Detail label="Starts" value={fmtDate(q.startDate)} />
            <Detail label="Valid until" value={fmtDate(q.expiresAt)} />
          </DetailGrid>

          <table className="ds-table ds-table-dense">
            <thead><tr><th>Item</th><th>Kind</th><th className="ds-col-num">Qty</th><th className="ds-col-num">Amount</th></tr></thead>
            <tbody>
              {q.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.description}</td>
                  <td className="ds-caption">{humanStatus(l.kind)}</td>
                  <td className="ds-col-num">{l.quantity}</td>
                  <td className="ds-col-num">{money(l.amountInr)}</td>
                </tr>
              ))}
              <tr><td colSpan={3}>Subtotal</td><td className="ds-col-num">{money(q.subtotalInr)}</td></tr>
              {q.discountInr > 0 && <tr><td colSpan={3}>Discount</td><td className="ds-col-num">−{money(q.discountInr)}</td></tr>}
              <tr><td colSpan={3}>Tax ({q.taxPct}%)</td><td className="ds-col-num">{money(q.taxInr)}</td></tr>
              {q.depositInr > 0 && <tr><td colSpan={3}>Deposit</td><td className="ds-col-num">{money(q.depositInr)}</td></tr>}
              <tr><td colSpan={3} style={{ fontWeight: 700 }}>Total</td><td className="ds-col-num" style={{ fontWeight: 700 }}>{money(q.totalInr)}</td></tr>
            </tbody>
          </table>

          {q.terms && <div><h3 className="ds-h3" style={{ marginBottom: 6 }}>Terms</h3><p className="ds-body" style={{ whiteSpace: 'pre-wrap' }}>{q.terms}</p></div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {q.status === 'DRAFT' && (
              <button className="btn-primary btn-sm" onClick={() => setStatus.mutate({ status: 'SENT' })}>
                <Send size={13} style={{ marginRight: 6 }} />Send it
              </button>
            )}
            {['SENT', 'VIEWED'].includes(q.status) && (
              <>
                <button className="btn-primary btn-sm" onClick={() => setStatus.mutate({ status: 'ACCEPTED' })}>Mark accepted</button>
                <button className="btn-ghost btn-sm" onClick={() => {
                  const reason = window.prompt('Why was it rejected?');
                  if (reason) setStatus.mutate({ status: 'REJECTED', reason });
                }}>Mark rejected</button>
              </>
            )}
            {q.status === 'ACCEPTED' && q.contracts.length === 0 && (
              <button className="btn-primary btn-sm" disabled={toContract.isPending} onClick={() => toContract.mutate()}>Raise the contract</button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => duplicate.mutate()}>
              <Copy size={13} style={{ marginRight: 6 }} />Duplicate
            </button>
          </div>

          {q.contracts.length > 0 && (
            <Card pad={14}>
              <div className="ds-caption">Contract</div>
              {q.contracts.map((c) => (
                <div key={c.id} style={{ fontSize: 13, marginTop: 3 }}>{c.reference} · {humanStatus(c.status)}</div>
              ))}
            </Card>
          )}

          {q.rejectReason && (
            <Card pad={14} tone="expired">
              <div className="ds-caption">Rejected because</div>
              <div style={{ fontSize: 13, marginTop: 3 }}>{q.rejectReason}</div>
            </Card>
          )}
        </div>
      )}
    </Drawer>
  );
}
