'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Plus, X, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Procedure, money } from '../derma-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function ProceduresFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['derma-procedures'], queryFn: async () => (await api.get<Procedure[]>('/derma/procedures')).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/derma/procedures/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['derma-procedures'] }); toast.success('Removed'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Procedure Menu</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your aesthetic & dermatology procedures with pricing and default sessions.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New procedure</button>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Sparkles size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No procedures yet.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {(data ?? []).map((p) => (
          <div key={p.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                {p.category && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{p.category}</div>}
              </div>
              <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => del.mutate(p.id)}><Trash2 size={13} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand,#132376)' }}>{money(p.priceInr)}</span>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{p.sessionsDefault} session{p.sessionsDefault > 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>

      {compose && <ProcedureModal onClose={() => setCompose(false)} onDone={() => qc.invalidateQueries({ queryKey: ['derma-procedures'] })} />}
    </div>
  );
}

function ProcedureModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', category: '', sessionsDefault: '1', priceInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/derma/procedures', { name: f.name, category: f.category || undefined, sessionsDefault: f.sessionsDefault ? Number(f.sessionsDefault) : undefined, priceInr: Number(f.priceInr) || 0 }), onSuccess: () => { onDone(); toast.success('Procedure added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New procedure</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Botox — forehead" /></div>
          <div><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Injectables" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Default sessions</label><input className="input" type="number" value={f.sessionsDefault} onChange={(e) => set('sessionsDefault', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Price ₹</label><input className="input" type="number" value={f.priceInr} onChange={(e) => set('priceInr', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.name || !f.priceInr || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}
