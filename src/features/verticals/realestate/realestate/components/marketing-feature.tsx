'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone, Plus, X, Trash2, Copy, ExternalLink, Users } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Property } from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

interface LeadForm { id: string; name: string; publicKey: string; headline: string; source: string; submissions: number; propertyId?: string | null; active: boolean }

export function MarketingFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['lead-forms'], queryFn: async () => (await api.get<LeadForm[]>('/realestate/forms')).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/realestate/forms/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-forms'] }); toast.success('Form deleted'); } });
  const link = (k: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/leadform.html?form=${k}`;
  const totalLeads = (data ?? []).reduce((s, f) => s + f.submissions, 0);

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Marketing</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Landing lead-capture forms that feed straight into your CRM pipeline.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New lead form</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
        <Stat label="Active forms" value={(data ?? []).filter((f) => f.active).length} />
        <Stat label="Leads captured" value={totalLeads} accent="var(--success)" />
        <Stat label="Campaigns" value="Omni" hint="Broadcasts & journeys in Engage" />
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Megaphone size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No lead forms yet. Create one, share the link, and leads flow into your CRM.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((f) => (
          <div key={f.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{f.name}</span>
                  <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{f.source}</span>
                  <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><Users size={11} style={{ marginRight: 3 }} />{f.submissions} leads</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>{f.headline}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <code style={{ flex: 1, fontSize: 11.5, background: 'var(--surface-3)', padding: '8px 10px', borderRadius: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link(f.publicKey)}</code>
                  <button className="btn-secondary" style={{ height: 34, width: 36, padding: 0 }} onClick={() => { navigator.clipboard.writeText(link(f.publicKey)); toast.success('Link copied'); }}><Copy size={14} /></button>
                  <a className="btn-secondary" style={{ height: 34, width: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} href={link(f.publicKey)} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
                </div>
              </div>
              <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0, flexShrink: 0 }} onClick={() => del.mutate(f.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {compose && <FormModal onClose={() => setCompose(false)} onDone={() => qc.invalidateQueries({ queryKey: ['lead-forms'] })} />}
    </div>
  );
}

function Stat({ label, value, accent, hint }: { label: string; value: number | string; accent?: string; hint?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function FormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: props } = useQuery({ queryKey: ['props-all'], queryFn: async () => (await api.get<{ data: Property[] }>('/properties', { params: { limit: 100 } })).data.data });
  const [f, setF] = useState<any>({ name: '', headline: 'Enquire about this property', subheadline: '', buttonText: 'Request a callback', source: 'WEBSITE', propertyId: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/realestate/forms', { ...f, propertyId: f.propertyId || undefined }),
    onSuccess: () => { onDone(); toast.success('Lead form created'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 540, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>New lead form</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Form name (internal)</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Marina Apartment Enquiry" /></div>
          <div><label className="label">Headline</label><input className="input" value={f.headline} onChange={(e) => set('headline', e.target.value)} /></div>
          <div><label className="label">Subheadline (optional)</label><input className="input" value={f.subheadline} onChange={(e) => set('subheadline', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Button text</label><input className="input" value={f.buttonText} onChange={(e) => set('buttonText', e.target.value)} /></div>
            <div style={{ width: 150 }}><label className="label">Source</label><select className="input" value={f.source} onChange={(e) => set('source', e.target.value)}><option value="WEBSITE">Website</option><option value="ADVERTISEMENT">Advertisement</option><option value="SOCIAL_MEDIA">Social media</option></select></div>
          </div>
          <div><label className="label">Promote a property (optional)</label><select className="input" value={f.propertyId} onChange={(e) => set('propertyId', e.target.value)}><option value="">— None —</option>{(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.title}</option>)}</select></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>Create form</button>
        </div>
      </div>
    </div>
  );
}
