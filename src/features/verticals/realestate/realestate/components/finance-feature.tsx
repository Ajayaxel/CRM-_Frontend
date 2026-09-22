'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { Receipt, Plus, X, Trash2, Send, ArrowRightLeft, ArrowRight, IndianRupee, AlertTriangle, FileText, Wallet } from 'lucide-react';
import { taxLabel } from '@/lib/org-locale';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Invoice, FinanceStats, InvoiceKind, InvoiceCategory, InvoiceItem, PaymentMethod,
  INVOICE_STATUS_META, money,
} from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
// Invoice categories suited to each business type (all valid InvoiceCategory enum values).
const CATS_BY_VERTICAL: Record<string, InvoiceCategory[]> = {
  DIGITAL_AGENCY: ['DEVELOPMENT', 'DESIGN', 'CONSULTING', 'RETAINER', 'SUBSCRIPTION', 'HOSTING', 'SUPPORT', 'LICENSE', 'SERVICE', 'OTHER'],
  CONSULTING: ['CONSULTING', 'RETAINER', 'SERVICE', 'SUBSCRIPTION', 'SUPPORT', 'OTHER'],
  REAL_ESTATE: ['RENT', 'MAINTENANCE', 'COMMISSION', 'SALE', 'DEPOSIT', 'SERVICE', 'OTHER'],
  HOTEL: ['SERVICE', 'SALE', 'RENT', 'OTHER'],
  STUDY_ABROAD: ['SERVICE', 'CONSULTING', 'SALE', 'OTHER'],
  LEGAL: ['SERVICE', 'CONSULTING', 'RETAINER', 'OTHER'],
};
const DEFAULT_CATS: InvoiceCategory[] = ['SERVICE', 'SALE', 'SUBSCRIPTION', 'PRODUCT', 'SUPPORT', 'OTHER'];
const catsFor = (vertical?: string): InvoiceCategory[] => CATS_BY_VERTICAL[vertical ?? ''] ?? DEFAULT_CATS;
const METHODS: PaymentMethod[] = ['CASH', 'BANK', 'ONLINE', 'CARD', 'CHEQUE'];
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

async function downloadJson(name: string, url: string) {
  try {
    const data = (await api.get(url)).data;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.json`; a.click(); URL.revokeObjectURL(a.href);
    toast.success(`${name}.json downloaded`);
  } catch (e) { toast.error(apiErrorMessage(e)); }
}

export function FinanceFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [kind, setKind] = useState<InvoiceKind | ''>('');

  const { data: stats } = useQuery({ queryKey: ['fin-stats'], queryFn: async () => (await api.get<FinanceStats>('/finance/stats')).data });
  const { data } = useQuery({ queryKey: ['fin-invoices', kind], queryFn: async () => (await api.get<{ data: Invoice[] }>('/finance/invoices', { params: { kind: kind || undefined, limit: 80 } })).data.data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Finance &amp; Accounting</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Billing, collections, and a full double-entry ledger — P&amp;L, balance sheet, {taxLabel()}.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New</button>
      </div>

      {/* The ledger, statements and filings moved to the Accounts control centre.
          Leaving a second copy of them here is exactly the fragmentation that
          redesign set out to remove — so this is a door, not a duplicate. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, borderBottom: '1px solid var(--line-soft)', paddingBottom: 2 }}>
        <span style={{ padding: '8px 4px', marginBottom: -3, fontSize: 14, fontWeight: 700, color: 'var(--brand,#132376)', borderBottom: '2px solid var(--brand,#132376)' }}>Billing</span>
        <span style={{ flex: 1 }} />
        <Link href="/accounting" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none', padding: '6px 4px' }}>
          Ledger, statements &amp; {taxLabel()} <ArrowRight size={14} />
        </Link>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat icon={<Wallet size={18} />} label="Outstanding" value={money(stats?.outstanding ?? 0)} accent="var(--gold,#E6A23C)" />
        <Stat icon={<AlertTriangle size={18} />} label="Overdue" value={money(stats?.overdue ?? 0)} accent="var(--danger,#c0392b)" />
        <Stat icon={<IndianRupee size={18} />} label="Collected this month" value={money(stats?.collectedThisMonth ?? 0)} accent="var(--success)" />
        <Stat icon={<FileText size={18} />} label="Open quotations" value={stats?.quotations ?? 0} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['', 'INVOICE', 'QUOTATION'] as const).map((k) => (
          <button key={k || 'all'} className="btn-secondary" style={{ height: 34, fontSize: 12.5, borderColor: kind === k ? 'var(--brand,#132376)' : undefined }} onClick={() => setKind(k)}>{k === '' ? 'All' : k === 'INVOICE' ? 'Invoices' : 'Quotations'}</button>
        ))}
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Receipt size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No documents yet. Create a quotation or invoice.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((i) => {
          const st = INVOICE_STATUS_META[i.status];
          return (
            <div key={i.id} onClick={() => setOpenId(i.id)} style={{ ...card, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>{i.kind === 'QUOTATION' ? <FileText size={19} /> : <Receipt size={19} />}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{i.number}</span>
                  <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{i.category}</span>
                  {i.overdue && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Overdue</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{i.customerName} · {i._count?.items ?? i.items?.length ?? 0} items · due {fmtDate(i.dueDate)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--brand,#132376)' }}>{money(i.totalInr)}</div>
                {i.amountPaidInr > 0 && i.amountPaidInr < i.totalInr && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{money(i.amountPaidInr)} paid</div>}
              </div>
            </div>
          );
        })}
      </div>

      {(compose || editInvoice) && <InvoiceModal edit={editInvoice ?? undefined} onClose={() => { setCompose(false); setEditInvoice(null); }} onDone={() => { qc.invalidateQueries({ queryKey: ['fin-invoices'] }); qc.invalidateQueries({ queryKey: ['fin-stats'] }); }} />}
      {openId && <InvoiceDrawer id={openId} onClose={() => setOpenId(null)} onEdit={(inv) => setEditInvoice(inv)} />}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ?? 'var(--ink-2)' }}>{icon}</div>
      <div><div style={{ fontSize: 19, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div>
    </div>
  );
}

function InvoiceDrawer({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit?: (inv: Invoice) => void }) {
  const qc = useQueryClient();
  const [pay, setPay] = useState({ amountInr: '', method: 'BANK' as PaymentMethod });
  const { data: inv } = useQuery({ queryKey: ['fin-invoice', id], queryFn: async () => (await api.get<Invoice>(`/finance/invoices/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['fin-invoice', id] }); qc.invalidateQueries({ queryKey: ['fin-invoices'] }); qc.invalidateQueries({ queryKey: ['fin-stats'] }); };

  const send = useMutation({ mutationFn: () => api.post(`/finance/invoices/${id}/send`), onSuccess: () => { refresh(); toast.success('Marked as sent'); } });
  const convert = useMutation({ mutationFn: () => api.post(`/finance/invoices/${id}/convert`), onSuccess: () => { refresh(); onClose(); toast.success('Converted to invoice'); } });
  const record = useMutation({ mutationFn: () => api.post(`/finance/invoices/${id}/payments`, { amountInr: Number(pay.amountInr), method: pay.method }), onSuccess: () => { refresh(); setPay({ amountInr: '', method: 'BANK' }); toast.success('Payment recorded'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const del = useMutation({ mutationFn: () => api.delete(`/finance/invoices/${id}`), onSuccess: () => { refresh(); onClose(); toast.success('Deleted'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const cancel = useMutation({ mutationFn: () => api.post(`/finance/invoices/${id}/cancel`), onSuccess: () => { refresh(); toast.success('Invoice cancelled & ledger reversed'); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  if (!inv) return null;
  const st = INVOICE_STATUS_META[inv.status];
  const balance = inv.totalInr - inv.amountPaidInr;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 500, maxWidth: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', animation: 'slideIn .3s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{inv.number}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{inv.customerName} · {inv.category}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{inv.kind === 'QUOTATION' ? 'Quotation' : 'Invoice'}</span>
            {inv.dueDate && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Due {fmtDate(inv.dueDate)}</span>}
          </div>

          {inv.kind !== 'QUOTATION' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => downloadJson(`${inv.number}-einvoice`, `/finance/invoices/${id}/einvoice`)}><FileText size={13} /> e-Invoice JSON</button>
              <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => downloadJson(`${inv.number}-ewaybill`, `/finance/invoices/${id}/ewaybill`)}><FileText size={13} /> e-Way Bill JSON</button>
            </div>
          )}

          {/* Line items */}
          <div style={{ ...card, padding: 0, marginBottom: 14, overflow: 'hidden' }}>
            {(inv.items ?? []).map((it, idx) => (
              <div key={it.id ?? idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: idx ? '1px solid var(--line-soft)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-2)' }}>{it.description} <span style={{ color: 'var(--ink-3)' }}>× {it.quantity}</span></span>
                <span style={{ fontWeight: 600 }}>{money(it.amountInr)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line-soft)', padding: '10px 14px', fontSize: 13 }}>
              <Row label="Subtotal" value={money(inv.subtotalInr)} />
              <Row label={`${taxLabel()} (${inv.vatPct}%)`} value={money(inv.vatInr)} />
              <Row label="Total" value={money(inv.totalInr)} bold />
              {inv.amountPaidInr > 0 && <Row label="Paid" value={money(inv.amountPaidInr)} accent="var(--success)" />}
              {balance > 0 && inv.kind === 'INVOICE' && <Row label="Balance" value={money(balance)} accent="var(--gold,#E6A23C)" />}
            </div>
          </div>

          {/* Actions */}
          {inv.status === 'DRAFT' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { onEdit?.(inv); onClose(); }}><FileText size={14} /> Edit</button>
              <button className="btn-secondary" style={{ flex: 1, color: 'var(--danger,#c0392b)', borderColor: 'var(--danger,#c0392b)' }} disabled={del.isPending} onClick={() => { if (confirm(`Delete ${inv.number}? This cannot be undone.`)) del.mutate(); }}><Trash2 size={14} /> Delete</button>
            </div>
          )}
          {inv.status === 'DRAFT' && inv.kind === 'INVOICE' && <button className="btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={() => send.mutate()}><Send size={14} /> Mark as sent</button>}
          {inv.status !== 'DRAFT' && inv.status !== 'CANCELLED' && (
            <button className="btn-secondary" style={{ width: '100%', marginBottom: 8, color: 'var(--danger,#c0392b)', borderColor: 'var(--danger,#c0392b)' }} disabled={cancel.isPending} onClick={() => { if (confirm(`Cancel ${inv.number}? Its ledger entries (sale${inv.amountPaidInr ? ' and payments' : ''}) will be reversed. Refund the customer separately if needed.`)) cancel.mutate(); }}><X size={14} /> Cancel invoice</button>
          )}
          {inv.kind === 'QUOTATION' && inv.status !== 'CANCELLED' && <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => convert.mutate()}><ArrowRightLeft size={14} /> Convert to invoice</button>}

          {inv.kind === 'INVOICE' && inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
            <div style={{ ...card, padding: 14, marginBottom: 14, background: 'var(--surface-2)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Record payment</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" type="number" style={{ flex: 1 }} placeholder={`Balance ${money(balance)}`} value={pay.amountInr} onChange={(e) => setPay({ ...pay, amountInr: e.target.value })} />
                <select className="input" style={{ width: 110 }} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>{METHODS.map((m) => <option key={m} value={m}>{m[0] + m.slice(1).toLowerCase()}</option>)}</select>
                <button className="btn-primary" disabled={!pay.amountInr || record.isPending} onClick={() => record.mutate()}>Add</button>
              </div>
            </div>
          )}

          {(inv.payments ?? []).length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Payments</div>
              {(inv.payments ?? []).map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span style={{ color: 'var(--ink-2)' }}>{p.method} · {fmtDate(p.paidAt)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>{money(p.amountInr)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontWeight: bold ? 700 : 400, fontSize: bold ? 14.5 : 13, color: accent ?? 'var(--ink-1)' }}><span style={{ color: accent ?? 'var(--ink-3)' }}>{label}</span><span>{value}</span></div>;
}

function InvoiceModal({ onClose, onDone, edit }: { onClose: () => void; onDone: () => void; edit?: Invoice }) {
  const { user } = useAuth();
  const cats = catsFor(user?.organization?.vertical);
  const [f, setF] = useState<any>(edit
    ? { customerName: edit.customerName, customerPhone: edit.customerPhone ?? '', kind: edit.kind, category: edit.category, vatPct: String(edit.vatPct), dueDate: edit.dueDate ? edit.dueDate.slice(0, 10) : '' }
    : { customerName: '', customerPhone: '', kind: 'INVOICE' as InvoiceKind, category: cats[0], vatPct: '5', dueDate: '' });
  const [items, setItems] = useState<InvoiceItem[]>(edit?.items?.length
    ? edit.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPriceInr: it.unitPriceInr }))
    : [{ description: '', quantity: 1, unitPriceInr: 0 }]);
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const setItem = (i: number, patch: Partial<InvoiceItem>) => setItems((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const subtotal = items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPriceInr || 0), 0);
  const vat = Math.round(subtotal * (Number(f.vatPct) || 0) / 100);

  const create = useMutation({
    mutationFn: () => {
      const body = {
        customerName: f.customerName, customerPhone: f.customerPhone || undefined, kind: f.kind, category: f.category,
        vatPct: Number(f.vatPct) || 0, dueDate: f.dueDate || undefined,
        items: items.filter((it) => it.description).map((it) => ({ description: it.description, quantity: Number(it.quantity) || 1, unitPriceInr: Number(it.unitPriceInr) || 0 })),
      };
      return edit ? api.patch(`/finance/invoices/${edit.id}`, body) : api.post('/finance/invoices', body);
    },
    onSuccess: () => { onDone(); toast.success(edit ? 'Saved' : 'Created'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const valid = f.customerName && items.some((it) => it.description && it.unitPriceInr);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 600, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{edit ? 'Edit' : 'New'} {f.kind === 'QUOTATION' ? 'quotation' : 'invoice'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Document</label><select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="INVOICE">Invoice</option><option value="QUOTATION">Quotation</option></select></div>
            <div style={{ flex: 1 }}><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{cats.map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Customer name</label><input className="input" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 110 }}><label className="label">{taxLabel()} %</label><input className="input" type="number" value={f.vatPct} onChange={(e) => set('vatPct', e.target.value)} /></div>
            {f.kind === 'INVOICE' && <div style={{ flex: 1 }}><label className="label">Due date</label><input className="input" type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>}
          </div>
          <div>
            <label className="label">Line items</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                  <input className="input" style={{ width: 60 }} type="number" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
                  <input className="input" style={{ width: 110 }} type="number" placeholder="each" value={it.unitPriceInr || ''} onChange={(e) => setItem(i, { unitPriceInr: Number(e.target.value) })} />
                  {items.length > 1 && <button onClick={() => setItems((l) => l.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><Trash2 size={15} /></button>}
                </div>
              ))}
            </div>
            <button className="btn-secondary" style={{ marginTop: 8, height: 32, fontSize: 12.5 }} onClick={() => setItems((l) => [...l, { description: '', quantity: 1, unitPriceInr: 0 }])}><Plus size={13} /> Add item</button>
          </div>
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
            <Row label="Subtotal" value={money(subtotal)} />
            <Row label={`${taxLabel()} (${f.vatPct || 0}%)`} value={money(vat)} />
            <Row label="Total" value={money(subtotal + vat)} bold />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>{edit ? 'Save changes' : `Create ${f.kind === 'QUOTATION' ? 'quotation' : 'invoice'}`}</button>
        </div>
      </div>
    </div>
  );
}
