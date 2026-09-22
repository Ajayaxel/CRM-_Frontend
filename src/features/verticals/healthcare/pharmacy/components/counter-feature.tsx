'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShoppingCart, Plus, X, Trash2, FileText, Check } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Dispense, Drug, RX_META, RxIntake, RxStatus, money } from '../pharmacy-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function CounterFeature() {
  const qc = useQueryClient();
  const [addRx, setAddRx] = useState(false);
  const { data: drugs } = useQuery({ queryKey: ['pharm-drugs'], queryFn: async () => (await api.get<Drug[]>('/pharmacy/drugs')).data });
  const { data: rx } = useQuery({ queryKey: ['pharm-rx'], queryFn: async () => (await api.get<RxIntake[]>('/pharmacy/rx')).data });
  const { data: dispenses } = useQuery({ queryKey: ['pharm-dispenses'], queryFn: async () => (await api.get<Dispense[]>('/pharmacy/dispenses')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['pharm-dispenses'] }); qc.invalidateQueries({ queryKey: ['pharm-drugs'] }); qc.invalidateQueries({ queryKey: ['pharm-rx'] }); qc.invalidateQueries({ queryKey: ['pharm-stats'] }); qc.invalidateQueries({ queryKey: ['pharm-expiry'] }); };
  const setRx = useMutation({ mutationFn: ({ id, status }: { id: string; status: RxStatus }) => api.patch(`/pharmacy/rx/${id}/status`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharm-rx'] }); toast.success('Updated'); } });

  const [cart, setCart] = useState<{ drugId: string; name: string; qty: number; priceInr: number; stock: number }[]>([]);
  const [customer, setCustomer] = useState('');
  const [rxId, setRxId] = useState('');
  const addToCart = (id: string) => {
    const d = (drugs ?? []).find((x) => x.id === id); if (!d) return;
    setCart((c) => (c.some((l) => l.drugId === id) ? c : [...c, { drugId: d.id, name: d.brand ?? d.genericName, qty: 1, priceInr: d.priceInr, stock: d.stock }]));
  };
  const setQty = (i: number, q: number) => setCart((c) => c.map((l, idx) => (idx === i ? { ...l, qty: Math.max(1, q) } : l)));
  const rmLine = (i: number) => setCart((c) => c.filter((_, idx) => idx !== i));
  const total = cart.reduce((s, l) => s + l.priceInr * l.qty, 0);
  const checkout = useMutation({
    mutationFn: () => api.post('/pharmacy/dispenses', { customerName: customer || undefined, rxIntakeId: rxId || undefined, items: cart.map((l) => ({ drugId: l.drugId, name: l.name, qty: l.qty, priceInr: l.priceInr })) }),
    onSuccess: (r: any) => { refresh(); toast.success(`Dispensed ${r.data.reference}`); setCart([]); setCustomer(''); setRxId(''); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Counter</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Capture prescriptions and dispense at the counter.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Dispense cart */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><ShoppingCart size={16} /> Dispense</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input className="input" style={{ flex: 1 }} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" />
            <select className="input" style={{ width: 130 }} value="" onChange={(e) => { if (e.target.value) addToCart(e.target.value); }}><option value="">+ Add drug</option>{(drugs ?? []).map((d) => <option key={d.id} value={d.id}>{d.brand ?? d.genericName}</option>)}</select>
          </div>
          {rx && rx.filter((r) => r.status !== 'DISPENSED' && r.status !== 'REJECTED').length > 0 && (
            <select className="input" style={{ marginBottom: 12 }} value={rxId} onChange={(e) => setRxId(e.target.value)}><option value="">Link a prescription (optional)…</option>{rx.filter((r) => r.status !== 'DISPENSED' && r.status !== 'REJECTED').map((r) => <option key={r.id} value={r.id}>{r.patientName}{r.doctorName ? ` · Dr ${r.doctorName}` : ''}</option>)}</select>
          )}
          {cart.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cart is empty. Add drugs above.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cart.map((l, i) => (
              <div key={l.drugId} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 30px', gap: 8, alignItems: 'center' }}>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div><div style={{ fontSize: 11, color: l.stock < l.qty ? 'var(--danger,#c0392b)' : 'var(--ink-3)' }}>{l.stock} in stock</div></div>
                <input className="input" style={{ height: 34 }} type="number" value={l.qty} onChange={(e) => setQty(i, Number(e.target.value))} />
                <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{money(l.priceInr * l.qty)}</div>
                <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => rmLine(i)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 14, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{money(total)}</span>
              <button className="btn-primary" disabled={checkout.isPending} onClick={() => checkout.mutate()}><Check size={15} /> Dispense &amp; bill</button>
            </div>
          )}
        </div>

        {/* Rx queue */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} /> Prescriptions</span>
            <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setAddRx(true)}><Plus size={12} /> Capture</button>
          </div>
          {(rx ?? []).length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No prescriptions captured.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(rx ?? []).map((r) => {
              const m = RX_META[r.status];
              return (
                <div key={r.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{r.patientName}</span>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                  </div>
                  {r.doctorName && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>Dr {r.doctorName}</div>}
                  {r.status === 'RECEIVED' && <button className="btn-secondary" style={{ height: 26, fontSize: 11, marginTop: 8 }} onClick={() => setRx.mutate({ id: r.id, status: 'VERIFIED' })}>Verify</button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent dispenses */}
      {(dispenses ?? []).length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '22px 0 10px' }}>Recent dispenses</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(dispenses ?? []).slice(0, 6).map((d) => (
              <div key={d.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{d.reference}</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>{d.customerName ?? 'Walk-in'} · {d.items.map((i) => `${i.name}×${i.qty}`).join(', ')}</span>
                <span style={{ fontWeight: 700 }}>{money(d.totalInr)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {addRx && <RxModal onClose={() => setAddRx(false)} onDone={() => qc.invalidateQueries({ queryKey: ['pharm-rx'] })} />}
    </div>
  );
}

function RxModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ patientName: '', patientPhone: '', doctorName: '', imageUrl: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/pharmacy/rx', { patientName: f.patientName, patientPhone: f.patientPhone || undefined, doctorName: f.doctorName || undefined, imageUrl: f.imageUrl || undefined }), onSuccess: () => { onDone(); toast.success('Prescription captured'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Capture prescription</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Patient</label><input className="input" value={f.patientName} onChange={(e) => set('patientName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.patientPhone} onChange={(e) => set('patientPhone', e.target.value)} /></div>
          </div>
          <div><label className="label">Prescribing doctor</label><input className="input" value={f.doctorName} onChange={(e) => set('doctorName', e.target.value)} /></div>
          <div><label className="label">Rx image URL</label><input className="input" value={f.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.patientName || create.isPending} onClick={() => create.mutate()}>Capture</button></div>
      </div>
    </div>
  );
}
