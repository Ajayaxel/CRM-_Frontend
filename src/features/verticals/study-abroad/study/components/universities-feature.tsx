'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GraduationCap, Plus, X, Trash2, BookOpen, Globe } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { University, Program, LEVELS, ProgramLevel, money } from '../study-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function UniversitiesFeature() {
  const qc = useQueryClient();
  const [addUni, setAddUni] = useState(false);
  const [addProg, setAddProg] = useState<University | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['study-unis'], queryFn: async () => (await api.get<University[]>('/study/universities')).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/study/universities/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-unis'] }); toast.success('Removed'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Universities & Programs</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your partner universities and the programs students can apply to.</p>
        </div>
        <button className="btn-primary" onClick={() => setAddUni(true)}><Plus size={15} /> Add university</button>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><GraduationCap size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No universities yet. Add your first partner.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((u) => {
          const expanded = open === u.id;
          return (
            <div key={u.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setOpen(expanded ? null : u.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15.5 }}>{u.name}</span>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><Globe size={11} style={{ marginRight: 3 }} />{u.country}{u.city ? `, ${u.city}` : ''}</span>
                    {u.ranking && <span className="badge" style={{ background: 'var(--gold-bg,#fdf2e2)', color: 'var(--gold,#c67c1e)' }}>#{u.ranking}</span>}
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{u._count?.programs ?? 0} programs · {u._count?.applications ?? 0} apps</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{u.commissionPct}% commission</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setAddProg(u)}><Plus size={13} /> Program</button>
                  <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(u.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              {expanded && <ProgramList universityId={u.id} />}
            </div>
          );
        })}
      </div>

      {addUni && <UniModal onClose={() => setAddUni(false)} onDone={() => qc.invalidateQueries({ queryKey: ['study-unis'] })} />}
      {addProg && <ProgModal university={addProg} onClose={() => setAddProg(null)} onDone={() => { qc.invalidateQueries({ queryKey: ['study-unis'] }); qc.invalidateQueries({ queryKey: ['study-programs', addProg.id] }); }} />}
    </div>
  );
}

function ProgramList({ universityId }: { universityId: string }) {
  const { data } = useQuery({ queryKey: ['study-programs', universityId], queryFn: async () => (await api.get<Program[]>('/study/programs', { params: { universityId } })).data });
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(data ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No programs yet.</div>}
      {(data ?? []).map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', borderRadius: 10, padding: 10 }}>
          <div><div style={{ fontWeight: 600, fontSize: 13 }}><BookOpen size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{p.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{p.level[0] + p.level.slice(1).toLowerCase()}{p.discipline ? ` · ${p.discipline}` : ''}{p.ieltsMin ? ` · IELTS ${p.ieltsMin}` : ''}{p.intakeMonths.length ? ` · ${p.intakeMonths.join('/')}` : ''}</div></div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--brand,#132376)' }}>{money(p.tuitionInr)}</div>
        </div>
      ))}
    </div>
  );
}

function UniModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', country: '', city: '', ranking: '', commissionPct: '15' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/study/universities', { name: f.name, country: f.country, city: f.city || undefined, ranking: f.ranking ? Number(f.ranking) : undefined, commissionPct: f.commissionPct ? Number(f.commissionPct) : undefined }), onSuccess: () => { onDone(); toast.success('University added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Add university" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="University of Toronto" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Country</label><input className="input" value={f.country} onChange={(e) => set('country', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">City</label><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">World ranking</label><input className="input" type="number" value={f.ranking} onChange={(e) => set('ranking', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Commission %</label><input className="input" type="number" value={f.commissionPct} onChange={(e) => set('commissionPct', e.target.value)} /></div>
      </div>
    </div>
    <Actions onClose={onClose} disabled={!f.name || !f.country || create.isPending} onSubmit={() => create.mutate()} label="Add" />
  </Overlay>;
}

function ProgModal({ university, onClose, onDone }: { university: University; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', level: 'BACHELORS', discipline: '', tuitionInr: '', intakeMonths: '', ieltsMin: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/study/programs', { universityId: university.id, name: f.name, level: f.level, discipline: f.discipline || undefined, tuitionInr: f.tuitionInr ? Number(f.tuitionInr) : undefined, ieltsMin: f.ieltsMin ? Number(f.ieltsMin) : undefined, intakeMonths: f.intakeMonths ? String(f.intakeMonths).split(',').map((x: string) => x.trim()).filter(Boolean) : [] }), onSuccess: () => { onDone(); toast.success('Program added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title={`Add program · ${university.name}`} onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Program name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="MSc Computer Science" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Level</label><select className="input" value={f.level} onChange={(e) => set('level', e.target.value)}>{LEVELS.map((l) => <option key={l} value={l}>{l[0] + l.slice(1).toLowerCase()}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="label">Discipline</label><input className="input" value={f.discipline} onChange={(e) => set('discipline', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Tuition ₹/yr</label><input className="input" type="number" value={f.tuitionInr} onChange={(e) => set('tuitionInr', e.target.value)} /></div>
        <div style={{ width: 100 }}><label className="label">IELTS min</label><input className="input" type="number" step="0.5" value={f.ieltsMin} onChange={(e) => set('ieltsMin', e.target.value)} /></div>
      </div>
      <div><label className="label">Intake months (comma)</label><input className="input" value={f.intakeMonths} onChange={(e) => set('intakeMonths', e.target.value)} placeholder="Sep, Jan" /></div>
    </div>
    <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add program" />
  </Overlay>;
}

function Actions({ onClose, disabled, onSubmit, label }: { onClose: () => void; disabled: boolean; onSubmit: () => void; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
