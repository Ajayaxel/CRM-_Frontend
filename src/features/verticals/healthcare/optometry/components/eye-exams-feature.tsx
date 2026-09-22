'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Plus, X, Glasses } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Patient, Provider, patientName } from '@/features/verticals/healthcare/practice';
import { EyeExam, OptoStats, dpt } from '../optometry-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function EyeExamsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [rxFor, setRxFor] = useState<EyeExam | null>(null);
  const { data: stats } = useQuery({ queryKey: ['opto-stats'], queryFn: async () => (await api.get<OptoStats>('/optometry/stats')).data });
  const { data } = useQuery({ queryKey: ['opto-exams'], queryFn: async () => (await api.get<EyeExam[]>('/optometry/exams')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['opto-exams'] }); qc.invalidateQueries({ queryKey: ['opto-stats'] }); };

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Eye Exams</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Refraction records (OD/OS) and optical prescriptions.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New exam</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Exams" value={stats?.exams ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Catalogue items" value={stats?.catalogueItems ?? 0} />
        <Stat label="Dispenses" value={stats?.dispenses ?? 0} />
        <Stat label="Sales (mo)" value={`₹${(stats?.opticalSalesThisMonth ?? 0).toLocaleString('en-IN')}`} accent="var(--success)" />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Eye size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No eye exams yet.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((e) => (
          <div key={e.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{e.patient ? patientName(e.patient) : 'Exam'} <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>{e.patient?.mrn}</span></div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-IN') : ''}{e.ipd ? ` · IPD ${e.ipd}mm` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(e.prescriptions ?? []).map((rx) => <span key={rx.id} className="badge" style={{ background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)' }}><Glasses size={11} style={{ marginRight: 3 }} />{rx.kind}</span>)}
                <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setRxFor(e)}>+ Rx</button>
              </div>
            </div>
            <RefractionTable e={e} />
          </div>
        ))}
      </div>

      {compose && <ExamModal onClose={() => setCompose(false)} onDone={refresh} />}
      {rxFor && <RxModal exam={rxFor} onClose={() => setRxFor(null)} onDone={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function RefractionTable({ e }: { e: EyeExam }) {
  const cell: React.CSSProperties = { padding: '5px 8px', fontSize: 12.5, textAlign: 'center', fontFamily: 'var(--mono)' };
  const head: React.CSSProperties = { ...cell, fontWeight: 700, color: 'var(--ink-3)', fontFamily: 'inherit', fontSize: 11 };
  return (
    <div style={{ marginTop: 12, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380, background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden' }}>
        <thead><tr><th style={head}>Eye</th><th style={head}>SPH</th><th style={head}>CYL</th><th style={head}>AXIS</th><th style={head}>ADD</th></tr></thead>
        <tbody>
          <tr><td style={{ ...cell, fontWeight: 700 }}>OD (R)</td><td style={cell}>{dpt(e.odSphere)}</td><td style={cell}>{dpt(e.odCyl)}</td><td style={cell}>{e.odAxis ?? '—'}</td><td style={cell}>{dpt(e.odAdd)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700 }}>OS (L)</td><td style={cell}>{dpt(e.osSphere)}</td><td style={cell}>{dpt(e.osCyl)}</td><td style={cell}>{e.osAxis ?? '—'}</td><td style={cell}>{dpt(e.osAdd)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function ExamModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: patients } = useQuery({ queryKey: ['practice-patients', ''], queryFn: async () => (await api.get<Patient[]>('/practice/patients')).data });
  const { data: providers } = useQuery({ queryKey: ['practice-providers'], queryFn: async () => (await api.get<Provider[]>('/practice/providers')).data });
  const [f, setF] = useState<any>({ patientId: '', providerId: '', odSphere: '', odCyl: '', odAxis: '', odAdd: '', osSphere: '', osCyl: '', osAxis: '', osAdd: '', ipd: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const create = useMutation({
    mutationFn: () => api.post('/optometry/exams', {
      patientId: f.patientId, providerId: f.providerId || undefined,
      odSphere: num(f.odSphere), odCyl: num(f.odCyl), odAxis: num(f.odAxis), odAdd: num(f.odAdd),
      osSphere: num(f.osSphere), osCyl: num(f.osCyl), osAxis: num(f.osAxis), osAdd: num(f.osAdd), ipd: num(f.ipd),
    }),
    onSuccess: () => { onDone(); toast.success('Exam recorded'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const eyeRow = (prefix: 'od' | 'os', label: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</span>
      <input className="input" style={{ height: 34 }} type="number" step="0.25" value={f[`${prefix}Sphere`]} onChange={(e) => set(`${prefix}Sphere`, e.target.value)} placeholder="SPH" />
      <input className="input" style={{ height: 34 }} type="number" step="0.25" value={f[`${prefix}Cyl`]} onChange={(e) => set(`${prefix}Cyl`, e.target.value)} placeholder="CYL" />
      <input className="input" style={{ height: 34 }} type="number" value={f[`${prefix}Axis`]} onChange={(e) => set(`${prefix}Axis`, e.target.value)} placeholder="AXIS" />
      <input className="input" style={{ height: 34 }} type="number" step="0.25" value={f[`${prefix}Add`]} onChange={(e) => set(`${prefix}Add`, e.target.value)} placeholder="ADD" />
    </div>
  );
  return (
    <Overlay title="New eye exam" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Patient</label><select className="input" value={f.patientId} onChange={(e) => set('patientId', e.target.value)}><option value="">Select…</option>{(patients ?? []).map((p) => <option key={p.id} value={p.id}>{patientName(p)} · {p.mrn}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Optometrist</label><select className="input" value={f.providerId} onChange={(e) => set('providerId', e.target.value)}><option value="">—</option>{(providers ?? []).map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></div>
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' }}><span>Eye</span><span>Sph</span><span>Cyl</span><span>Axis</span><span>Add</span></div>
          {eyeRow('od', 'OD (R)')}
          {eyeRow('os', 'OS (L)')}
        </div>
        <div style={{ width: 140 }}><label className="label">IPD (mm)</label><input className="input" type="number" step="0.5" value={f.ipd} onChange={(e) => set('ipd', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.patientId || create.isPending} onClick={() => create.mutate()}>Save exam</button></div>
    </Overlay>
  );
}

function RxModal({ exam, onClose, onDone }: { exam: EyeExam; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ kind: 'GLASSES', validUntil: '', notes: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/optometry/prescriptions', { patientId: exam.patientId, examId: exam.id, kind: f.kind, validUntil: f.validUntil || undefined, notes: f.notes || undefined }), onSuccess: () => { onDone(); toast.success('Prescription issued'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="Issue optical prescription" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="GLASSES">Glasses</option><option value="CONTACTS">Contacts</option></select></div>
          <div style={{ flex: 1 }}><label className="label">Valid until</label><input className="input" type="date" value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} /></div>
        </div>
        <div><label className="label">Notes</label><input className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Progressive lenses, AR coating…" /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>Issue</button></div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
