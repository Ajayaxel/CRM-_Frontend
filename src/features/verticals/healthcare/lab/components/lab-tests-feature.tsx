'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FlaskConical, Plus, X, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { LabTest, money } from '../lab-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function LabTestsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['lab-tests'], queryFn: async () => (await api.get<LabTest[]>('/lab/tests')).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/lab/tests/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-tests'] }); toast.success('Removed'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Test Catalogue</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your diagnostic tests with sample types, TAT and reference ranges.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New test</button>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><FlaskConical size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No tests yet.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {(data ?? []).map((t) => (
          <div key={t.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 6, color: 'var(--ink-2)' }}>{t.code}</span><span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span></div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{[t.sampleType, t.category, t.tatHours ? `${t.tatHours}h TAT` : null].filter(Boolean).join(' · ')}</div>
                {t.refRange && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--mono)' }}>Ref: {t.refRange}</div>}
              </div>
              <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => del.mutate(t.id)}><Trash2 size={12} /></button>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--brand,#132376)', marginTop: 10 }}>{money(t.priceInr)}</div>
          </div>
        ))}
      </div>

      {compose && <TestModal onClose={() => setCompose(false)} onDone={() => qc.invalidateQueries({ queryKey: ['lab-tests'] })} />}
    </div>
  );
}

function TestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ code: '', name: '', category: '', sampleType: 'Blood', priceInr: '', tatHours: '', refRange: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/lab/tests', { code: f.code, name: f.name, category: f.category || undefined, sampleType: f.sampleType || undefined, priceInr: Number(f.priceInr) || 0, tatHours: f.tatHours ? Number(f.tatHours) : undefined, refRange: f.refRange || undefined }), onSuccess: () => { onDone(); toast.success('Test added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New test</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 120 }}><label className="label">Code</label><input className="input" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="CBC" /></div>
            <div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Complete Blood Count" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Sample type</label><input className="input" value={f.sampleType} onChange={(e) => set('sampleType', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Haematology" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Price ₹</label><input className="input" type="number" value={f.priceInr} onChange={(e) => set('priceInr', e.target.value)} /></div>
            <div style={{ width: 100 }}><label className="label">TAT (h)</label><input className="input" type="number" value={f.tatHours} onChange={(e) => set('tatHours', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Ref range</label><input className="input" value={f.refRange} onChange={(e) => set('refRange', e.target.value)} placeholder="70-100" /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.code || !f.name || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}
