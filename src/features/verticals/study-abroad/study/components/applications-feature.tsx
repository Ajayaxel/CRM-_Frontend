'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GraduationCap, Plus, X, Plane, ChevronRight } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Application, Program, StudyStats, STAGES, STAGE_META, ApplicationStage } from '../study-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const NEXT: Partial<Record<ApplicationStage, ApplicationStage>> = { SHORTLISTED: 'APPLIED', APPLIED: 'OFFER', OFFER: 'ACCEPTED', ACCEPTED: 'VISA', VISA: 'ENROLLED' };

export function ApplicationsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data: stats } = useQuery({ queryKey: ['study-stats'], queryFn: async () => (await api.get<StudyStats>('/study/stats')).data });
  const { data: board } = useQuery({ queryKey: ['study-board'], queryFn: async () => (await api.get<{ stage: ApplicationStage; applications: Application[] }[]>('/study/applications/board')).data });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['study-board'] }); qc.invalidateQueries({ queryKey: ['study-stats'] }); };
  const move = useMutation({ mutationFn: ({ id, stage }: { id: string; stage: ApplicationStage }) => api.patch(`/study/applications/${id}/stage`, { stage }), onSuccess: () => { invalidate(); toast.success('Stage updated'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Applications</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Track student applications from shortlist to enrolment.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New application</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Applications" value={stats?.applications ?? 0} />
        <Stat label="Offers" value={stats?.offers ?? 0} accent="var(--gold,#E6A23C)" />
        <Stat label="In visa" value={stats?.inVisa ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Enrolled" value={stats?.enrolled ?? 0} accent="var(--success)" />
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {(board ?? []).map((col) => (
          <div key={col.stage} style={{ minWidth: 240, flex: '0 0 240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_META[col.stage].color }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{STAGE_META[col.stage].label}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{col.applications.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.applications.map((a) => (
                <div key={a.id} style={{ ...card, padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.studentName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3 }}>{a.program?.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{a.university?.name} · {a.university?.country}{a.intake ? ` · ${a.intake}` : ''}</div>
                  {a.visaStatus && <span className="badge" style={{ background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)', marginTop: 6 }}><Plane size={10} style={{ marginRight: 3 }} />Visa: {a.visaStatus}</span>}
                  {NEXT[col.stage] && <button className="btn-secondary" style={{ height: 28, fontSize: 11.5, marginTop: 8, width: '100%' }} onClick={() => move.mutate({ id: a.id, stage: NEXT[col.stage]! })}>Move to {STAGE_META[NEXT[col.stage]!].label} <ChevronRight size={12} /></button>}
                </div>
              ))}
              {col.applications.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 0' }}>—</div>}
            </div>
          </div>
        ))}
      </div>

      {compose && <AppModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function AppModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: programs } = useQuery({ queryKey: ['study-programs'], queryFn: async () => (await api.get<Program[]>('/study/programs')).data });
  const [f, setF] = useState<any>({ studentName: '', studentPhone: '', programId: '', intake: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/study/applications', { ...f, programId: f.programId || undefined }), onSuccess: () => { onDone(); toast.success('Application created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><GraduationCap size={18} /> New application</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Student name</label><input className="input" value={f.studentName} onChange={(e) => set('studentName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.studentPhone} onChange={(e) => set('studentPhone', e.target.value)} /></div>
          </div>
          <div><label className="label">Program</label><select className="input" value={f.programId} onChange={(e) => set('programId', e.target.value)}><option value="">Select program…</option>{(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.university?.name}</option>)}</select></div>
          <div><label className="label">Intake</label><input className="input" value={f.intake} onChange={(e) => set('intake', e.target.value)} placeholder="Sep 2026" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.studentName || !f.programId || create.isPending} onClick={() => create.mutate()}>Create</button>
        </div>
      </div>
    </div>
  );
}
