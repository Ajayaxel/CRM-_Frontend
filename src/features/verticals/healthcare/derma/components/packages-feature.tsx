'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layers, Plus, X, Camera, Check, Images } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Patient, patientName } from '@/features/verticals/healthcare/practice';
import {
  ClinicalPhoto, DermaStats, Package, PACKAGE_META, PHASES, PHASE_META, Procedure, money,
} from '../derma-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function PackagesFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [gallery, setGallery] = useState<Package | null>(null);
  const { data: stats } = useQuery({ queryKey: ['derma-stats'], queryFn: async () => (await api.get<DermaStats>('/derma/stats')).data });
  const { data } = useQuery({ queryKey: ['derma-packages'], queryFn: async () => (await api.get<Package[]>('/derma/packages')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['derma-packages'] }); qc.invalidateQueries({ queryKey: ['derma-stats'] }); };
  const consume = useMutation({ mutationFn: (id: string) => api.post(`/derma/packages/${id}/session`, {}), onSuccess: () => { refresh(); toast.success('Session recorded'); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Packages</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Session packages with before/after photo records.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Sell package</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Active" value={stats?.activePackages ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Completed" value={stats?.completedPackages ?? 0} accent="var(--success)" />
        <Stat label="Package revenue" value={money(stats?.packageRevenue ?? 0)} accent="var(--gold,#E6A23C)" />
        <Stat label="Photos" value={stats?.photos ?? 0} />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Layers size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No packages sold yet.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {(data ?? []).map((p) => {
          const m = PACKAGE_META[p.status];
          const pct = p.totalSessions ? Math.round((p.usedSessions / p.totalSessions) * 100) : 0;
          const left = p.totalSessions - p.usedSessions;
          return (
            <div key={p.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <Ring pct={pct} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{p.patient ? `${patientName(p.patient)} · ${p.patient.mrn}` : ''}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{money(p.priceInr)}</span>
                    {(p._count?.photos ?? 0) > 0 && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><Images size={11} style={{ marginRight: 3 }} />{p._count?.photos}</span>}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 12 }}>{p.usedSessions}/{p.totalSessions} sessions used · {left} left</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="btn-primary" style={{ height: 32, flex: 1, fontSize: 12.5 }} disabled={p.status !== 'ACTIVE' || left <= 0 || consume.isPending} onClick={() => consume.mutate(p.id)}><Check size={13} /> Record session</button>
                <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setGallery(p)}><Camera size={13} /> Photos</button>
              </div>
            </div>
          );
        })}
      </div>

      {compose && <SellModal onClose={() => setCompose(false)} onDone={refresh} />}
      {gallery && <GalleryModal pkg={gallery} onClose={() => setGallery(null)} onDone={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function Ring({ pct }: { pct: number }) {
  const col = pct >= 100 ? 'var(--success)' : 'var(--brand,#132376)';
  return (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: `conic-gradient(${col} ${pct * 3.6}deg, var(--surface-2) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: col }}>{pct}%</div>
    </div>
  );
}

function SellModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: procedures } = useQuery({ queryKey: ['derma-procedures'], queryFn: async () => (await api.get<Procedure[]>('/derma/procedures')).data });
  const { data: patients } = useQuery({ queryKey: ['practice-patients', ''], queryFn: async () => (await api.get<Patient[]>('/practice/patients')).data });
  const [f, setF] = useState<any>({ patientId: '', procedureId: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/derma/packages', { patientId: f.patientId, procedureId: f.procedureId }), onSuccess: () => { onDone(); toast.success('Package sold'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="Sell package" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Patient</label><select className="input" value={f.patientId} onChange={(e) => set('patientId', e.target.value)}><option value="">Select…</option>{(patients ?? []).map((p) => <option key={p.id} value={p.id}>{patientName(p)} · {p.mrn}</option>)}</select></div>
        <div><label className="label">Procedure</label><select className="input" value={f.procedureId} onChange={(e) => set('procedureId', e.target.value)}><option value="">Select…</option>{(procedures ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.priceInr)} · {p.sessionsDefault}×</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.patientId || !f.procedureId || create.isPending} onClick={() => create.mutate()}>Sell</button></div>
    </Overlay>
  );
}

function GalleryModal({ pkg, onClose, onDone }: { pkg: Package; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const pid = pkg.patientId;
  const [adding, setAdding] = useState(false);
  const { data: photos } = useQuery({ queryKey: ['derma-photos', pid], enabled: !!pid, queryFn: async () => (await api.get<ClinicalPhoto[]>(`/derma/photos/${pid}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['derma-photos', pid] }); onDone(); };

  return (
    <Overlay title={`Photos · ${pkg.name}`} onClose={onClose} wide>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setAdding(true)}><Plus size={12} /> Add photo</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {PHASES.map((ph) => (
          <div key={ph}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: PHASE_META[ph].color }} /><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{PHASE_META[ph].label}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(photos ?? []).filter((p) => p.phase === ph).map((p) => (
                <div key={p.id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
                  {p.consent ? (
                    <img src={p.url} alt={p.caption ?? ph} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', background: 'var(--surface-2)' }} />
                  ) : (
                    <div style={{ height: 110, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, color: 'var(--ink-3)', fontSize: 11, textAlign: 'center', padding: 8 }}>
                      <Camera size={18} style={{ opacity: 0.5 }} />Consent required to view
                    </div>
                  )}
                  {p.caption && <div style={{ fontSize: 11, padding: '5px 7px', color: 'var(--ink-3)' }}>{p.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {adding && <PhotoModal patientId={pid} packageId={pkg.id} onClose={() => setAdding(false)} onDone={refresh} />}
    </Overlay>
  );
}

function PhotoModal({ patientId, packageId, onClose, onDone }: { patientId: string; packageId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ url: '', phase: 'BEFORE', consent: true, caption: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/derma/photos', { patientId, packageId, url: f.url, phase: f.phase, consent: f.consent, caption: f.caption || undefined }), onSuccess: () => { onDone(); toast.success('Photo added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="Add photo" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Image URL</label><input className="input" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Phase</label><select className="input" value={f.phase} onChange={(e) => set('phase', e.target.value)}>{PHASES.map((p) => <option key={p} value={p}>{PHASE_META[p].label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Caption</label><input className="input" value={f.caption} onChange={(e) => set('caption', e.target.value)} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /> Patient consented to store &amp; display this clinical image</label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.url || create.isPending} onClick={() => create.mutate()}>Add</button></div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: wide ? 620 : 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
