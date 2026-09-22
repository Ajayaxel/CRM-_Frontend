'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Stethoscope, Plus, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Provider } from '../practice-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function ProvidersFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['practice-providers'], queryFn: async () => (await api.get<Provider[]>('/practice/providers')).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Providers</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>The doctors and clinicians who see patients.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Add provider</button>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Stethoscope size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No providers yet.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {(data ?? []).map((p) => (
          <div key={p.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 42, height: 42, borderRadius: 99, background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Stethoscope size={19} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.displayName}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{p.specialty ?? 'General'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {p.regNo && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Reg {p.regNo}</span>}
              {p.roomNo && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Room {p.roomNo}</span>}
            </div>
          </div>
        ))}
      </div>

      {compose && <ProviderModal onClose={() => setCompose(false)} onDone={() => qc.invalidateQueries({ queryKey: ['practice-providers'] })} />}
    </div>
  );
}

function ProviderModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ displayName: '', specialty: '', regNo: '', roomNo: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/practice/providers', { displayName: f.displayName, specialty: f.specialty || undefined, regNo: f.regNo || undefined, roomNo: f.roomNo || undefined }), onSuccess: () => { onDone(); toast.success('Provider added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Add provider</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Name</label><input className="input" value={f.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Dr. Sana Rao" /></div>
          <div><label className="label">Specialty</label><input className="input" value={f.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="General Medicine" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Reg No.</label><input className="input" value={f.regNo} onChange={(e) => set('regNo', e.target.value)} /></div>
            <div style={{ width: 110 }}><label className="label">Room</label><input className="input" value={f.roomNo} onChange={(e) => set('roomNo', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.displayName || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}
