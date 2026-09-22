'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Glasses, Plus, X, Trash2, ShoppingCart } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Patient, patientName } from '@/features/verticals/healthcare/practice';
import { Dispense, DISPENSE_META, OpticalProduct, PRODUCT_LABEL, PRODUCT_TYPES, money } from '../optometry-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function OpticalShopFeature() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'catalogue' | 'dispensing'>('catalogue');
  const [addProd, setAddProd] = useState(false);
  const [dispense, setDispense] = useState(false);
  const { data: products } = useQuery({ queryKey: ['opto-products'], queryFn: async () => (await api.get<OpticalProduct[]>('/optometry/products')).data });
  const { data: dispenses } = useQuery({ queryKey: ['opto-dispenses'], queryFn: async () => (await api.get<Dispense[]>('/optometry/dispenses')).data });
  const refreshP = () => qc.invalidateQueries({ queryKey: ['opto-products'] });
  const refreshD = () => { qc.invalidateQueries({ queryKey: ['opto-dispenses'] }); qc.invalidateQueries({ queryKey: ['opto-products'] }); qc.invalidateQueries({ queryKey: ['opto-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/optometry/products/${id}`), onSuccess: () => { refreshP(); toast.success('Removed'); } });
  const pay = useMutation({ mutationFn: ({ id, amountInr }: { id: string; amountInr: number }) => api.post(`/optometry/dispenses/${id}/pay`, { amountInr }), onSuccess: () => { refreshD(); toast.success('Payment recorded'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Optical Shop</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Frames &amp; lens catalogue and dispensing sales.</p>
        </div>
        {tab === 'catalogue'
          ? <button className="btn-primary" onClick={() => setAddProd(true)}><Plus size={15} /> Add product</button>
          : <button className="btn-primary" onClick={() => setDispense(true)}><ShoppingCart size={15} /> New dispense</button>}
      </div>

      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, marginBottom: 18 }}>
        {(['catalogue', 'dispensing'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? 'var(--ink-1)' : 'var(--ink-3)' }}>{t === 'catalogue' ? 'Catalogue' : 'Dispensing'}</button>
        ))}
      </div>

      {tab === 'catalogue' && (
        <>
          {(products ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Glasses size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No products yet.</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
            {(products ?? []).map((p) => (
              <div key={p.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{[PRODUCT_LABEL[p.type], p.brand].filter(Boolean).join(' · ')}</div></div>
                  <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => del.mutate(p.id)}><Trash2 size={12} /></button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand,#132376)' }}>{money(p.priceInr)}</span>
                  <span className="badge" style={{ background: p.stock > 0 ? 'var(--surface-2)' : 'var(--danger-bg,#fce8e8)', color: p.stock > 0 ? 'var(--ink-3)' : 'var(--danger,#c0392b)' }}>{p.stock} in stock</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'dispensing' && (
        <>
          {(dispenses ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><ShoppingCart size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No dispenses yet.</div></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(dispenses ?? []).map((d) => {
              const m = DISPENSE_META[d.status];
              const due = d.totalInr - d.paidInr;
              return (
                <div key={d.id} style={{ ...card, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.reference}</span><span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span></div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{d.patient ? `${patientName(d.patient)} · ${d.patient.mrn}` : ''}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6 }}>{d.items.map((it) => `${it.label}${(it.qty ?? 1) > 1 ? ` ×${it.qty}` : ''}`).join(' · ')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{money(d.totalInr)}</div>
                      {due > 0 && <button className="btn-secondary" style={{ height: 28, fontSize: 12, marginTop: 8 }} onClick={() => pay.mutate({ id: d.id, amountInr: due })}>Collect {money(due)}</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {addProd && <ProductModal onClose={() => setAddProd(false)} onDone={refreshP} />}
      {dispense && <DispenseModal products={products ?? []} onClose={() => setDispense(false)} onDone={refreshD} />}
    </div>
  );
}

function ProductModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', type: 'FRAME', brand: '', priceInr: '', stock: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/optometry/products', { name: f.name, type: f.type, brand: f.brand || undefined, priceInr: Number(f.priceInr) || 0, stock: f.stock ? Number(f.stock) : undefined }), onSuccess: () => { onDone(); toast.success('Product added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Add product" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ray-Ban Wayfarer" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{PRODUCT_TYPES.map((t) => <option key={t} value={t}>{PRODUCT_LABEL[t]}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="label">Brand</label><input className="input" value={f.brand} onChange={(e) => set('brand', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Price ₹</label><input className="input" type="number" value={f.priceInr} onChange={(e) => set('priceInr', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Stock</label><input className="input" type="number" value={f.stock} onChange={(e) => set('stock', e.target.value)} /></div>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.name || !f.priceInr || create.isPending} onClick={() => create.mutate()}>Add</button></div>
  </Overlay>;
}

function DispenseModal({ products, onClose, onDone }: { products: OpticalProduct[]; onClose: () => void; onDone: () => void }) {
  const { data: patients } = useQuery({ queryKey: ['practice-patients', ''], queryFn: async () => (await api.get<Patient[]>('/practice/patients')).data });
  const [patientId, setPatientId] = useState('');
  const [lines, setLines] = useState<{ productId: string; label: string; qty: string; priceInr: string }[]>([]);
  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id); if (!p) return;
    setLines((l) => [...l, { productId: p.id, label: p.name, qty: '1', priceInr: String(p.priceInr) }]);
  };
  const setLine = (i: number, k: string, v: string) => setLines((l) => l.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const rm = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
  const total = lines.reduce((s, l) => s + (Number(l.priceInr) || 0) * (Number(l.qty) || 1), 0);
  const create = useMutation({
    mutationFn: () => api.post('/optometry/dispenses', { patientId, items: lines.map((l) => ({ productId: l.productId || undefined, label: l.label, qty: Number(l.qty) || 1, priceInr: Number(l.priceInr) || 0 })) }),
    onSuccess: () => { onDone(); toast.success('Dispensed'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return <Overlay title="New dispense" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Patient</label><select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Select…</option>{(patients ?? []).map((p) => <option key={p.id} value={p.id}>{patientName(p)} · {p.mrn}</option>)}</select></div>
      <div><label className="label">Add from catalogue</label><select className="input" value="" onChange={(e) => { if (e.target.value) addProduct(e.target.value); }}><option value="">Pick a product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.priceInr)}</option>)}</select></div>
      {lines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 54px 90px 30px', gap: 6, alignItems: 'center' }}>
              <input className="input" style={{ height: 34 }} value={l.label} onChange={(e) => setLine(i, 'label', e.target.value)} />
              <input className="input" style={{ height: 34 }} type="number" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} />
              <input className="input" style={{ height: 34 }} type="number" value={l.priceInr} onChange={(e) => setLine(i, 'priceInr', e.target.value)} />
              <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => rm(i)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 16 }}>{money(total)}</div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!patientId || !lines.length || create.isPending} onClick={() => create.mutate()}>Dispense</button></div>
  </Overlay>;
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
