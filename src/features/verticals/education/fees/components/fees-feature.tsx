'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Receipt, Wallet, AlertTriangle, Plus, X, Trash2, BellRing, IndianRupee, UserPlus } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Concession, FeeInvoice, FeeStats, FeeStructure, STATUS_META, money, fmtDate } from '../fees-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const TABS = ['Invoices', 'Assign', 'Structures', 'Concessions'] as const;

export function FeesFeature() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Invoices');
  const { data: stats } = useQuery({ queryKey: ['fee-stats'], queryFn: async () => (await api.get<FeeStats>('/fees/stats')).data });
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Fees</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Fee structures, scholarships, installment invoices and receipts — dues surface on student & parent portals.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat icon={<Receipt size={17} />} label="Billed" value={money(stats?.totalBilled)} />
        <Stat icon={<Wallet size={17} />} label="Collected" value={money(stats?.totalCollected)} accent="var(--success)" />
        <Stat icon={<IndianRupee size={17} />} label="Outstanding" value={money(stats?.outstanding)} accent="var(--gold,#c67c1e)" />
        <Stat icon={<AlertTriangle size={17} />} label="Overdue invoices" value={stats?.overdueInvoices ?? 0} accent="var(--danger,#c0392b)" />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === t ? 'var(--brand,#132376)' : undefined, color: tab === t ? 'var(--brand,#132376)' : undefined }} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Invoices' && <InvoicesTab />}
      {tab === 'Assign' && <AssignTab />}
      {tab === 'Structures' && <StructuresTab />}
      {tab === 'Concessions' && <ConcessionsTab />}
    </div>
  );
}
function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ?? 'var(--ink-2)' }}>{icon}</div><div><div style={{ fontSize: 18, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div></div>;
}

// ================= Invoices =================
function InvoicesTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data } = useQuery({ queryKey: ['fee-invoices', status], queryFn: async () => (await api.get<FeeInvoice[]>('/fees/invoices', { params: { status: status || undefined } })).data });
  const { data: students } = useQuery({ queryKey: ['students-lite'], queryFn: async () => (await api.get<any>('/students', { params: { limit: 100 } })).data.data ?? [] });
  const nameOf = (id: string) => { const s = (students ?? []).find((x: any) => x.id === id); return s ? `${s.firstName} ${s.lastName ?? ''}`.trim() : id.slice(0, 6); };
  const [pay, setPay] = useState<FeeInvoice | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['fee-invoices'] }); qc.invalidateQueries({ queryKey: ['fee-stats'] }); };
  const remind = useMutation({ mutationFn: () => api.post('/fees/reminders/run'), onSuccess: (r: any) => { toast.success(`${r.data.reminded} overdue reminder(s) sent via Omni`); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {['', 'DUE', 'PARTIAL', 'OVERDUE', 'PAID'].map((s) => <button key={s || 'all'} className="btn-secondary" style={{ height: 32, fontSize: 12, borderColor: status === s ? 'var(--brand,#132376)' : undefined }} onClick={() => setStatus(s)}>{s || 'All'}</button>)}
        <div style={{ flex: 1 }} />
        <button className="btn-primary" style={{ height: 34 }} disabled={remind.isPending} onClick={() => remind.mutate()}><BellRing size={14} /> Remind overdue</button>
      </div>
      {!data?.length && <Empty text="No invoices. Assign a fee structure to students." />}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {(data ?? []).map((inv, i) => {
          const m = STATUS_META[inv.status]; const bal = inv.amountInr - inv.paidInr;
          return (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{nameOf(inv.studentId)} <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontFamily: 'var(--mono)', fontSize: 11.5 }}>{inv.number}</span></div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{inv.title} · due {fmtDate(inv.dueDate)}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{money(inv.amountInr)}</div>{inv.paidInr > 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>paid {money(inv.paidInr)}</div>}</div>
              <span className="badge" style={{ background: m.bg, color: m.fg, minWidth: 60, justifyContent: 'center' }}>{m.label}</span>
              {inv.status !== 'PAID' && <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setPay(inv)}>Collect {money(bal)}</button>}
            </div>
          );
        })}
      </div>
      {pay && <PaymentModal invoice={pay} name={nameOf(pay.studentId)} onClose={() => setPay(null)} onDone={() => { setPay(null); refresh(); }} />}
    </div>
  );
}
function PaymentModal({ invoice, name, onClose, onDone }: { invoice: FeeInvoice; name: string; onClose: () => void; onDone: () => void }) {
  const bal = invoice.amountInr - invoice.paidInr;
  const [f, setF] = useState({ amountInr: String(bal), method: 'CASH', reference: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const [receipt, setReceipt] = useState<any>(null);
  const pay = useMutation({ mutationFn: () => api.post('/fees/payments', { invoiceId: invoice.id, amountInr: Number(f.amountInr) || 0, method: f.method, reference: f.reference || undefined }), onSuccess: (r: any) => { setReceipt(r.data); toast.success('Payment recorded'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title={receipt ? 'Receipt' : `Collect payment — ${name}`} onClose={receipt ? onDone : onClose}>
      {receipt ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>{receipt.receipt.number}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--success)', margin: '6px 0' }}>{money(receipt.receipt.amountInr)}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{invoice.number} · balance {money(receipt.invoice.balance)} · {receipt.invoice.status}</div>
          <button className="btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={onDone}>Done</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>{invoice.number} · {invoice.title} · balance {money(bal)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Amount ₹</label><input className="input" type="number" max={bal} value={f.amountInr} onChange={(e) => set('amountInr', e.target.value)} /></div><div style={{ width: 140 }}><label className="label">Method</label><select className="input" value={f.method} onChange={(e) => set('method', e.target.value)}>{['CASH', 'ONLINE', 'CARD', 'UPI', 'CHEQUE', 'BANK'].map((m) => <option key={m}>{m}</option>)}</select></div></div>
            <div><label className="label">Reference <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label><input className="input" value={f.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Txn / cheque no." /></div>
          </div>
          <Actions onClose={onClose} disabled={!f.amountInr || pay.isPending} onSubmit={() => pay.mutate()} label="Record payment" />
        </>
      )}
    </Overlay>
  );
}

// ================= Assign =================
function AssignTab() {
  const qc = useQueryClient();
  const { data: structures } = useQuery({ queryKey: ['fee-structures'], queryFn: async () => (await api.get<FeeStructure[]>('/fees/structures')).data });
  const { data: concessions } = useQuery({ queryKey: ['concessions'], queryFn: async () => (await api.get<Concession[]>('/fees/concessions')).data });
  const { data: students } = useQuery({ queryKey: ['students-lite'], queryFn: async () => (await api.get<any>('/students', { params: { limit: 100 } })).data.data ?? [] });
  const [f, setF] = useState({ studentId: '', feeStructureId: '', concessionId: '', startDate: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const assign = useMutation({ mutationFn: () => api.post('/fees/assign', { studentId: f.studentId, feeStructureId: f.feeStructureId, concessionId: f.concessionId || undefined, startDate: f.startDate ? new Date(f.startDate).toISOString() : undefined }), onSuccess: (r: any) => { toast.success(`Assigned · ${r.data.invoices} invoices for net ${money(r.data.net)}`); qc.invalidateQueries({ queryKey: ['fee-invoices'] }); qc.invalidateQueries({ queryKey: ['fee-stats'] }); setF({ studentId: '', feeStructureId: '', concessionId: '', startDate: '' }); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ ...card, padding: 22, maxWidth: 560 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}><UserPlus size={16} style={{ verticalAlign: -2 }} /> Assign fee structure</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>Generates the installment invoices automatically.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Student</label><select className="input" value={f.studentId} onChange={(e) => set('studentId', e.target.value)}><option value="">Select student…</option>{(students ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName ?? ''} · {s.admissionNo}</option>)}</select></div>
        <div><label className="label">Fee structure</label><select className="input" value={f.feeStructureId} onChange={(e) => set('feeStructureId', e.target.value)}><option value="">Select structure…</option>{(structures ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} · {money(s.totalInr)} · {s.installments} inst.</option>)}</select></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Concession <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label><select className="input" value={f.concessionId} onChange={(e) => set('concessionId', e.target.value)}><option value="">None</option>{(concessions ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === 'PERCENT' ? c.value + '%' : money(c.value)})</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Start date</label><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><button className="btn-primary" disabled={!f.studentId || !f.feeStructureId || assign.isPending} onClick={() => assign.mutate()}>Assign & generate invoices</button></div>
    </div>
  );
}

// ================= Structures =================
function StructuresTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['fee-structures'], queryFn: async () => (await api.get<FeeStructure[]>('/fees/structures')).data });
  const [add, setAdd] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['fee-structures'] });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/fees/structures/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> New structure</button></div>
      {!data?.length && <Empty text="No fee structures yet." />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {(data ?? []).map((s) => (
          <div key={s.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}</div><button className="btn-secondary" style={{ height: 26, width: 26, padding: 0 }} onClick={() => del.mutate(s.id)}><Trash2 size={12} /></button></div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{money(s.totalInr)}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.installments} installments · {s._count?.studentFees ?? 0} assigned</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 10 }}>{s.items.map((it, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-2)' }}><span>{it.name}</span><span>{money(it.amountInr)}</span></div>)}</div>
          </div>
        ))}
      </div>
      {add && <StructureModal onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
    </div>
  );
}
function StructureModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [installments, setInstallments] = useState('3');
  const [items, setItems] = useState<{ name: string; amountInr: string }[]>([{ name: 'Tuition Fee', amountInr: '' }]);
  const total = items.reduce((s, i) => s + (Number(i.amountInr) || 0), 0);
  const setItem = (i: number, patch: any) => setItems((x) => x.map((it, j) => j === i ? { ...it, ...patch } : it));
  const create = useMutation({ mutationFn: () => api.post('/fees/structures', { name, installments: Number(installments) || 1, items: items.filter((i) => i.name && i.amountInr).map((i) => ({ name: i.name, amountInr: Number(i.amountInr) })) }), onSuccess: () => { toast.success('Structure created'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New fee structure" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="B.Tech 2026 Annual" /></div><div style={{ width: 110 }}><label className="label">Installments</label><input className="input" type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} /></div></div>
        <div>
          <label className="label">Fee items · total {money(total)}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <input className="input" style={{ flex: 1 }} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Fee head" />
                <input className="input" style={{ width: 120 }} type="number" value={it.amountInr} onChange={(e) => setItem(i, { amountInr: e.target.value })} placeholder="₹" />
                {items.length > 1 && <button onClick={() => setItems((x) => x.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={14} /></button>}
              </div>
            ))}
          </div>
          <button className="btn-secondary" style={{ height: 28, fontSize: 12, marginTop: 6 }} onClick={() => setItems((x) => [...x, { name: '', amountInr: '' }])}><Plus size={12} /> Item</button>
        </div>
      </div>
      <Actions onClose={onClose} disabled={!name || total === 0 || create.isPending} onSubmit={() => create.mutate()} label="Create" />
    </Overlay>
  );
}

// ================= Concessions =================
function ConcessionsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['concessions'], queryFn: async () => (await api.get<Concession[]>('/fees/concessions')).data });
  const [add, setAdd] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['concessions'] });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/fees/concessions/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> New concession</button></div>
      {!data?.length && <Empty text="No scholarships/discounts yet." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data ?? []).map((c) => (
          <div key={c.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{c.name}</div>
            <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{c.type === 'PERCENT' ? `${c.value}%` : money(c.value)}</span>
            <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => del.mutate(c.id)}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      {add && <ConcessionModal onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
    </div>
  );
}
function ConcessionModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', type: 'PERCENT', value: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/fees/concessions', { name: f.name, type: f.type, value: Number(f.value) || 0 }), onSuccess: () => { toast.success('Added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New concession" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Merit Scholarship" /></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ width: 140 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="PERCENT">Percent %</option><option value="FLAT">Flat ₹</option></select></div><div style={{ flex: 1 }}><label className="label">Value</label><input className="input" type="number" value={f.value} onChange={(e) => set('value', e.target.value)} /></div></div>
      </div>
      <Actions onClose={onClose} disabled={!f.name || !f.value || create.isPending} onSubmit={() => create.mutate()} label="Add" />
    </Overlay>
  );
}

// shared
function Empty({ text }: { text: string }) { return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>; }
function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}
function Actions({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
