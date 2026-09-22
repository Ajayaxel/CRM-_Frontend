'use client';

/**
 * Invoices — list, edit, and print onto the tenant's letterhead.
 *
 * The API already did the hard part: it computes totals, picks GST or VAT from
 * the tenant's own regime, and splits CGST/SGST/IGST only where that is a real
 * thing. So this screen deliberately does NOT recompute tax; it shows what the
 * server returns. A UI that does its own tax arithmetic will eventually disagree
 * with the books, and the customer holds the copy that disagrees.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Printer, Send, Trash2, Ban, Wallet, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useOrgConfig } from '@/lib/org-locale';
import { useAuthStore } from '@/features/foundation/auth';
import { Badge } from '@/features/verticals/insurance/insurance/ui/kit';

type Item = { id?: string; description: string; quantity: number; unitPriceInr: number; amountInr?: number };
type Invoice = {
  id: string; number: string; kind: string; category: string; status: string;
  customerName: string; customerPhone?: string | null; customerEmail?: string | null;
  issueDate: string; dueDate?: string | null; notes?: string | null;
  subtotalInr: number; vatPct: number; vatInr: number; totalInr: number;
  amountPaidInr: number; interState?: boolean;
  cgstInr?: number; sgstInr?: number; igstInr?: number;
  items: Item[];
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'neutral', SENT: 'sales', PARTIAL: 'renewal', PAID: 'active',
  OVERDUE: 'expired', CANCELLED: 'expired',
};

export function InvoicesFeature() {
  const qc = useQueryClient();
  const org = useOrgConfig();
  const [editing, setEditing] = useState<Invoice | 'new' | null>(null);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery<{ data: Invoice[]; meta?: any } | Invoice[]>({
    queryKey: ['invoices', status],
    queryFn: async () => (await api.get(`/finance/invoices${status ? `?status=${status}` : ''}`)).data,
  });
  const rows: Invoice[] = Array.isArray(data) ? data : (data?.data ?? []);

  const money = org.money;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="ds-h1">Invoices</h1>
          <p className="ds-caption" style={{ margin: '4px 0 0' }}>
            {rows.length} document{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          <Plus size={15} /> New invoice
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['', 'DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={status === s ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm'}
            style={status === s ? { borderColor: 'var(--navy)', color: 'var(--navy)' } : undefined}
          >
            {s ? s[0] + s.slice(1).toLowerCase() : 'All'}
          </button>
        ))}
      </div>

      <div className="ds-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
        ) : !rows.length ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No invoices yet</div>
            <div className="ds-caption">Raise one when you bill a customer — it prints on your letterhead.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ds-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Number</th><th>Customer</th><th>Issued</th><th>Due</th>
                  <th className="num">Total</th><th className="num">Balance</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => {
                  const balance = inv.totalInr - (inv.amountPaidInr ?? 0);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.number}</td>
                      <td>{inv.customerName}</td>
                      <td className="ds-caption">{new Date(inv.issueDate).toLocaleDateString(org.locale)}</td>
                      <td className="ds-caption">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(org.locale) : '—'}</td>
                      <td className="num">{money(inv.totalInr)}</td>
                      {/* Zero balance shows an em dash, not a currency zero — a paid
                          invoice reads as settled rather than as owing nothing. */}
                      <td className="num" style={{ fontWeight: balance > 0 ? 600 : 400 }}>
                        {balance > 0 ? money(balance) : '—'}
                      </td>
                      <td>
                        <Badge tone={(STATUS_TONE[inv.status] ?? 'neutral') as any}>
                          {inv.status[0] + inv.status.slice(1).toLowerCase()}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-ghost btn-sm"
                          title="Print on your letterhead"
                          onClick={() => {
                            const token = useAuthStore.getState().accessToken;
                            const url = `/api/invoice-documents/GENERAL/${inv.id}/print${token ? `?token=${encodeURIComponent(token)}` : ''}`;
                            window.open(url, '_blank', 'noopener');
                          }}
                        >
                          <Printer size={14} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setEditing(inv)}>Open</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <InvoiceEditor
          invoice={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function InvoiceEditor({
  invoice, onClose, onSaved,
}: { invoice: Invoice | null; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const org = useOrgConfig();
  const isDraft = !invoice || invoice.status === 'DRAFT';

  const [f, setF] = useState({
    customerName: invoice?.customerName ?? '',
    customerEmail: invoice?.customerEmail ?? '',
    customerPhone: invoice?.customerPhone ?? '',
    dueDate: invoice?.dueDate ? invoice.dueDate.slice(0, 10) : '',
    notes: invoice?.notes ?? '',
    category: invoice?.category ?? 'SERVICE',
  });
  const [items, setItems] = useState<Item[]>(
    invoice?.items?.length
      ? invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceInr: i.unitPriceInr }))
      : [{ description: '', quantity: 1, unitPriceInr: 0 }],
  );
  const [pay, setPay] = useState('');

  // Shown as a guide only. The server computes the authoritative figures
  // including tax, and the saved invoice reflects those — this is here so
  // somebody typing lines can see roughly where they are.
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + Math.round((i.quantity || 0) * (i.unitPriceInr || 0)), 0),
    [items],
  );

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, dueDate: f.dueDate || undefined, items: items.filter((i) => i.description.trim()) };
      return invoice
        ? api.patch(`/finance/invoices/${invoice.id}`, body)
        : api.post('/finance/invoices', body);
    },
    onSuccess: () => { toast.success(invoice ? 'Invoice updated' : 'Invoice created'); onSaved(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const run = (path: string, ok: string, body?: any) =>
    api.post(`/finance/invoices/${invoice!.id}/${path}`, body ?? {})
      .then(() => { toast.success(ok); qc.invalidateQueries({ queryKey: ['invoices'] }); onSaved(); })
      .catch((e) => toast.error(apiErrorMessage(e)));

  const money = org.money;
  const setItem = (idx: number, patch: Partial<Item>) =>
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', width: 'min(720px,100%)', height: '100%', overflowY: 'auto', padding: 24, animation: 'slideIn .18s ease' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{invoice ? invoice.number : 'New invoice'}</div>
            {invoice && (
              <div className="ds-caption">
                {invoice.status[0] + invoice.status.slice(1).toLowerCase()}
                {!isDraft && ' · sent documents cannot be edited'}
              </div>
            )}
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={17} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Customer</label>
              <input className="input" disabled={!isDraft} value={f.customerName}
                onChange={(e) => setF({ ...f, customerName: e.target.value })} />
            </div>
            <div>
              <label className="label">Due date</label>
              <input className="input" type="date" disabled={!isDraft} value={f.dueDate}
                onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Email</label>
              <input className="input" disabled={!isDraft} value={f.customerEmail}
                onChange={(e) => setF({ ...f, customerEmail: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" disabled={!isDraft} value={f.customerPhone}
                onChange={(e) => setF({ ...f, customerPhone: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Lines</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 100px 32px', gap: 6, alignItems: 'center' }}>
                  <input className="input" placeholder="Description" disabled={!isDraft}
                    value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} />
                  <input className="input num" type="number" min={1} disabled={!isDraft}
                    value={it.quantity} onChange={(e) => setItem(idx, { quantity: Number(e.target.value) || 0 })} />
                  <input className="input num" type="number" min={0} disabled={!isDraft}
                    value={it.unitPriceInr} onChange={(e) => setItem(idx, { unitPriceInr: Number(e.target.value) || 0 })} />
                  <div className="ds-caption num" style={{ textAlign: 'right' }}>
                    {money(Math.round((it.quantity || 0) * (it.unitPriceInr || 0)))}
                  </div>
                  <button className="btn-ghost btn-sm" disabled={!isDraft || items.length === 1}
                    onClick={() => setItems((c) => c.filter((_, i) => i !== idx))}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {isDraft && (
              <button className="btn-ghost btn-sm" style={{ marginTop: 6 }}
                onClick={() => setItems((c) => [...c, { description: '', quantity: 1, unitPriceInr: 0 }])}>
                <Plus size={13} /> Add line
              </button>
            )}
          </div>

          {/* The server's figures when we have them; the running subtotal only
              while drafting something that has never been saved. */}
          <div style={{ marginLeft: 'auto', width: 260, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Row label="Subtotal" value={money(invoice?.subtotalInr ?? subtotal)} />
            {invoice && invoice.vatInr > 0 && (
              (invoice.cgstInr ?? 0) > 0 ? (
                <>
                  <Row label={`CGST ${invoice.vatPct / 2}%`} value={money(invoice.cgstInr!)} />
                  <Row label={`SGST ${invoice.vatPct / 2}%`} value={money(invoice.sgstInr!)} />
                </>
              ) : (
                <Row label={`${invoice.interState && org.isGst ? 'IGST' : org.taxLabel} ${invoice.vatPct}%`} value={money(invoice.vatInr)} />
              )
            )}
            {invoice && <Row label="Total" value={money(invoice.totalInr)} strong />}
            {invoice && (invoice.amountPaidInr ?? 0) > 0 && (
              <Row label="Paid" value={money(invoice.amountPaidInr)} />
            )}
            {invoice && <Row label="Balance" value={money(invoice.totalInr - (invoice.amountPaidInr ?? 0))} strong />}
            {!invoice && <div className="ds-caption">{org.taxLabel} is applied by the server on save, from your tax regime.</div>}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} disabled={!isDraft} value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
            {invoice && (
              <>
                <button className="btn-secondary btn-sm"
                  onClick={() => window.open(`/api/invoice-documents/GENERAL/${invoice.id}/print`, '_blank', 'noopener')}>
                  <Printer size={14} /> Print
                </button>
                {invoice.status === 'DRAFT' && (
                  <button className="btn-secondary btn-sm" onClick={() => run('send', 'Marked as sent')}>
                    <Send size={14} /> Mark sent
                  </button>
                )}
                {!['PAID', 'CANCELLED'].includes(invoice.status) && (
                  <button className="btn-secondary btn-sm" onClick={() => run('cancel', 'Invoice cancelled')}>
                    <Ban size={14} /> Cancel
                  </button>
                )}
              </>
            )}
            {isDraft && (
              <button className="btn-primary btn-sm" disabled={save.isPending || !f.customerName.trim()}
                onClick={() => save.mutate()}>
                {save.isPending ? 'Saving…' : invoice ? 'Save changes' : 'Create invoice'}
              </button>
            )}
          </div>

          {invoice && !['CANCELLED'].includes(invoice.status) && invoice.totalInr > (invoice.amountPaidInr ?? 0) && (
            <div className="ds-card" style={{ padding: 14, marginTop: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Record a payment</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input num" type="number" placeholder="Amount" value={pay}
                  onChange={(e) => setPay(e.target.value)} />
                <button className="btn-secondary" disabled={!pay}
                  onClick={() => run('payments', 'Payment recorded', { amountInr: Number(pay) }).then(() => setPay(''))}>
                  <Wallet size={14} /> Record
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: strong ? 700 : 400 }}>
      <span style={{ color: strong ? 'var(--ink)' : 'var(--ink-2)' }}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
