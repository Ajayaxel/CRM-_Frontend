'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserCircle2, Plus, X, Link2, Check, Building2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Agent } from '../agentportal-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function AgentsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['agents'], queryFn: async () => (await api.get<Agent[]>('/agent-portal/agents')).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Agents</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your sales agents, their assigned listings and a public link to share.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New agent</button>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><UserCircle2 size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No agents yet. Add one to start assigning listings.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {(data ?? []).map((a) => <AgentCard key={a.id} a={a} />)}
      </div>

      {compose && <AgentModal onClose={() => setCompose(false)} onDone={() => qc.invalidateQueries({ queryKey: ['agents'] })} />}
    </div>
  );
}

function AgentCard({ a }: { a: Agent }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/a/${a.slug}` : `/a/${a.slug}`;
  const copy = () => { navigator.clipboard?.writeText(link); setCopied(true); toast.success('Public link copied'); setTimeout(() => setCopied(false), 1400); };
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 46, height: 46, borderRadius: 99, background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 46px' }}>
          {a.photoUrl ? <img src={a.photoUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserCircle2 size={26} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{[a.phone, a.email].filter(Boolean).join(' · ') || 'No contact'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><Building2 size={11} style={{ marginRight: 3 }} />{a._count?.properties ?? 0} listings</span>
        {!a.active && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Inactive</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, background: 'var(--surface-2)', borderRadius: 9, padding: '8px 10px' }}>
        <Link2 size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>/a/{a.slug}</span>
        <button className="btn-secondary" style={{ height: 28, fontSize: 11.5 }} onClick={copy}>{copied ? <><Check size={12} /> Copied</> : 'Copy link'}</button>
      </div>
      <a className="btn-secondary" href={`/a/${a.slug}`} target="_blank" rel="noopener" style={{ marginTop: 8, width: '100%', justifyContent: 'center', height: 32, fontSize: 12.5 }}>Open public page →</a>
    </div>
  );
}

function AgentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', phone: '', email: '', bio: '', photoUrl: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/agent-portal/agents', { name: f.name, phone: f.phone || undefined, email: f.email || undefined, bio: f.bio || undefined, photoUrl: f.photoUrl || undefined }), onSuccess: () => { onDone(); toast.success('Agent added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 480, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New agent</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Omar Sheikh" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
          </div>
          <div><label className="label">Photo URL</label><input className="input" value={f.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://…" /></div>
          <div><label className="label">Bio</label><input className="input" value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="10 yrs · luxury apartments in Marina" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}
