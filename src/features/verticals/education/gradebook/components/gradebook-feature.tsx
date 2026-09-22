'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Table2, ScrollText, Settings2, Sparkles, Send, Eye, X, Award, Plus, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Section, Subject, Term } from '@/features/verticals/education/academics';
import { GradeComponent, GradebookStats, GradingScheme, MarksMatrix, ReportCard, gradeColor } from '../gradebook-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function GradebookFeature() {
  const [tab, setTab] = useState<'marks' | 'reports' | 'setup'>('marks');
  const { data: stats } = useQuery({ queryKey: ['gb-stats'], queryFn: async () => (await api.get<GradebookStats>('/gradebook/stats')).data });
  const { data: terms } = useQuery({ queryKey: ['acad-terms'], queryFn: async () => (await api.get<Term[]>('/academics/terms')).data });
  const [termId, setTermId] = useState('');
  useEffect(() => { if (!termId && terms?.length) setTermId(terms.find((t) => t.isCurrent)?.id ?? terms[0].id); }, [terms, termId]);

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Gradebook & Report Cards</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Enter marks by component, roll them up with your grading scheme, and publish report cards to portals.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Components" value={stats?.components ?? 0} />
        <Stat label="Report cards" value={stats?.reportCards ?? 0} />
        <Stat label="Published" value={stats?.published ?? 0} accent="var(--success)" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {([['marks', 'Marks', Table2], ['reports', 'Report Cards', ScrollText], ['setup', 'Scheme & Components', Settings2]] as const).map(([k, l, Ic]) => (
          <button key={k} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? 'var(--brand,#132376)' : undefined, color: tab === k ? 'var(--brand,#132376)' : undefined }} onClick={() => setTab(k)}><Ic size={14} /> {l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <select className="input" style={{ height: 36, width: 180 }} value={termId} onChange={(e) => setTermId(e.target.value)}>{(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? ' (current)' : ''}</option>)}</select>
      </div>
      {tab === 'marks' && <MarksTab termId={termId} />}
      {tab === 'reports' && <ReportsTab termId={termId} />}
      {tab === 'setup' && <SetupTab />}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <div style={{ ...card, padding: '14px 16px' }}><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div>;
}

// ================= Marks =================
function MarksTab({ termId }: { termId: string }) {
  const qc = useQueryClient();
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const [subjectId, setSubjectId] = useState('');
  useEffect(() => { if (!subjectId && subjects?.length) setSubjectId(subjects[0].id); }, [subjects, subjectId]);
  const { data, refetch } = useQuery({ queryKey: ['gb-marks', termId, subjectId], enabled: !!termId && !!subjectId, queryFn: async () => (await api.get<MarksMatrix>('/gradebook/marks', { params: { termId, subjectId } })).data });
  const [edits, setEdits] = useState<Record<string, string>>({});
  useEffect(() => { setEdits({}); }, [termId, subjectId]);

  const save = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(edits);
      for (const [key, val] of entries) { const [studentId, componentId] = key.split(':'); await api.post('/gradebook/marks', { termId, subjectId, studentId, componentId, marksObtained: Number(val) || 0 }); }
    },
    onSuccess: () => { setEdits({}); refetch(); qc.invalidateQueries({ queryKey: ['gb-stats'] }); toast.success('Marks saved'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const compute = useMutation({ mutationFn: () => api.post('/gradebook/marks/compute', { termId, subjectId }), onSuccess: (r: any) => { refetch(); toast.success(`Pulled ${r.data.updated} LMS marks`); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  if (!subjects?.length) return <Empty text="Add subjects first (Academics)." />;
  const comps = data?.components ?? [];
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" style={{ height: 38, width: 240 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" style={{ height: 38 }} disabled={compute.isPending} onClick={() => compute.mutate()}><Sparkles size={14} /> Pull from LMS</button>
        <button className="btn-primary" style={{ height: 38 }} disabled={!Object.keys(edits).length || save.isPending} onClick={() => save.mutate()}>Save marks ({Object.keys(edits).length})</button>
      </div>
      {comps.length === 0 && <Empty text="Define grade components first (Scheme & Components tab)." />}
      {comps.length > 0 && (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead><tr><th style={th}>Student</th>{comps.map((c) => <th key={c.id} style={{ ...th, textAlign: 'center' }}>{c.name}<div style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink-3)' }}>{c.weight}% · /{c.maxMarks}</div></th>)}</tr></thead>
            <tbody>
              {(data?.students ?? []).map((s) => (
                <tr key={s.id}>
                  <td style={{ ...td, minWidth: 150 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.admissionNo}</div></td>
                  {comps.map((c) => {
                    const key = `${s.id}:${c.id}`; const val = edits[key] ?? (s.marks[c.id] ?? '');
                    return <td key={c.id} style={{ ...td, textAlign: 'center' }}><input className="input" style={{ width: 64, height: 32, textAlign: 'center', padding: 4 }} type="number" max={c.maxMarks} value={val} onChange={(e) => setEdits((x) => ({ ...x, [key]: e.target.value }))} /></td>;
                  })}
                </tr>
              ))}
              {(data?.students ?? []).length === 0 && <tr><td style={td} colSpan={comps.length + 1}><div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>No students enrolled in this subject's course.</div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ================= Report cards =================
function ReportsTab({ termId }: { termId: string }) {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({ queryKey: ['gb-cards', termId], enabled: !!termId, queryFn: async () => (await api.get<ReportCard[]>('/gradebook/report-cards', { params: { termId } })).data });
  const [view, setView] = useState<ReportCard | null>(null);
  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ['gb-stats'] }); };
  const generate = useMutation({ mutationFn: () => api.post('/gradebook/report-cards/generate', { termId }), onSuccess: (r: any) => { refresh(); toast.success(`Generated ${r.data.generated} report cards`); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const publishTerm = useMutation({ mutationFn: () => api.post('/gradebook/report-cards/publish-term', { termId }), onSuccess: (r: any) => { refresh(); toast.success(`Published ${r.data.published} report cards`); } });
  const toggle = useMutation({ mutationFn: (c: ReportCard) => api.post(`/gradebook/report-cards/${c.id}/${c.published ? 'unpublish' : 'publish'}`), onSuccess: () => { refresh(); } });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
        <button className="btn-secondary" style={{ height: 38 }} disabled={generate.isPending} onClick={() => generate.mutate()}><Sparkles size={14} /> Generate</button>
        <button className="btn-primary" style={{ height: 38 }} disabled={publishTerm.isPending || !(data?.length)} onClick={() => publishTerm.mutate()}><Send size={14} /> Publish all</button>
      </div>
      {!data?.length && <Empty text="No report cards. Enter marks, then Generate for this term." />}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {(data ?? []).map((c, i) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{c.data?.student?.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.data?.student?.admissionNo} · GPA {c.gpa}</div></div>
            <div style={{ width: 70, textAlign: 'right', fontWeight: 800, fontSize: 15, color: gradeColor(c.overallPct) }}>{c.overallPct}%</div>
            <span className="badge" style={{ background: 'var(--surface-2)', color: gradeColor(c.overallPct), minWidth: 34, justifyContent: 'center' }}>{c.overallGrade}</span>
            <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setView(c)}><Eye size={13} /> View</button>
            <button className="btn-secondary" style={{ height: 30, fontSize: 12, borderColor: c.published ? 'var(--success)' : undefined, color: c.published ? 'var(--success)' : undefined }} onClick={() => toggle.mutate(c)}>{c.published ? 'Published' : 'Publish'}</button>
          </div>
        ))}
      </div>
      {view && <ReportCardView card={view} onClose={() => setView(null)} />}
    </div>
  );
}

export function ReportCardView({ card, onClose }: { card: ReportCard; onClose: () => void }) {
  const subjects = card.data?.subjects ?? [];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={onClose} />
      <div style={{ ...card && {}, background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, position: 'relative', zIndex: 1, width: 640, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 12, background: 'var(--brand,#132376)', color: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><Award size={22} /></div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Report Card — {card.data?.term?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{card.data?.student?.name} · {card.data?.student?.admissionNo}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 18 }}>
          <Kpi label="Overall" value={`${card.overallPct}%`} color={gradeColor(card.overallPct)} />
          <Kpi label="Grade" value={card.overallGrade ?? '—'} color={gradeColor(card.overallPct)} />
          <Kpi label="GPA" value={String(card.gpa)} color="var(--ink-1)" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Subject</th>{subjects[0]?.components.map((c) => <th key={c.name} style={{ ...th, textAlign: 'center' }}>{c.name}</th>)}<th style={{ ...th, textAlign: 'center' }}>%</th><th style={{ ...th, textAlign: 'center' }}>Grade</th></tr></thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.subjectId}>
                <td style={td}><b>{s.code}</b> {s.name}</td>
                {s.components.map((c) => <td key={c.name} style={{ ...td, textAlign: 'center' }}>{c.obtained}</td>)}
                <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: gradeColor(s.percent) }}>{s.percent}</td>
                <td style={{ ...td, textAlign: 'center' }}><span className="badge" style={{ background: 'var(--surface-2)', color: gradeColor(s.percent) }}>{s.grade}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn-secondary" style={{ marginTop: 16, width: '100%' }} onClick={() => window.print()}>Print / Save PDF</button>
      </div>
    </div>
  );
}
function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return <div style={{ textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12, padding: '12px 22px', minWidth: 90 }}><div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</div></div>;
}

// ================= Setup =================
function SetupTab() {
  const qc = useQueryClient();
  const { data: scheme } = useQuery({ queryKey: ['gb-scheme'], queryFn: async () => (await api.get<GradingScheme>('/gradebook/scheme')).data });
  const { data: comps } = useQuery({ queryKey: ['gb-comps'], queryFn: async () => (await api.get<GradeComponent[]>('/gradebook/components')).data });
  const [addComp, setAddComp] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['gb-comps'] }); qc.invalidateQueries({ queryKey: ['gb-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/gradebook/components/${id}`), onSuccess: () => { refresh(); toast.success('Removed'); } });
  const totalWeight = (comps ?? []).reduce((s, c) => s + c.weight, 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 15 }}>Grade components</div><button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setAddComp(true)}><Plus size={12} /> Add</button></div>
        <div style={{ fontSize: 12, color: totalWeight === 100 ? 'var(--success)' : 'var(--gold,#c67c1e)', marginBottom: 10 }}>Total weight: {totalWeight}%{totalWeight !== 100 ? ' (should be 100)' : ' ✓'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(comps ?? []).map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.source} · out of {c.maxMarks}</div></div>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{c.weight}%</span>
              <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => del.mutate(c.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
        {addComp && <ComponentModal onClose={() => setAddComp(false)} onDone={() => { setAddComp(false); refresh(); }} />}
      </div>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Grading scheme — {scheme?.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(scheme?.bands ?? []).map((b) => (
            <div key={b.grade} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', borderRadius: 9, padding: '8px 12px' }}>
              <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-1)', minWidth: 34, justifyContent: 'center' }}>{b.grade}</span>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)' }}>≥ {b.min}%</span>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{b.point} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function ComponentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', weight: '20', maxMarks: '100', source: 'MANUAL' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/gradebook/components', { name: f.name, weight: Number(f.weight) || 0, maxMarks: Number(f.maxMarks) || 100, source: f.source }), onSuccess: () => { toast.success('Component added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 15 }}>New component</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Term Exam" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Weight %</label><input className="input" type="number" value={f.weight} onChange={(e) => set('weight', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Max marks</label><input className="input" type="number" value={f.maxMarks} onChange={(e) => set('maxMarks', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Source</label><select className="input" value={f.source} onChange={(e) => set('source', e.target.value)}>{['MANUAL', 'ASSIGNMENT', 'QUIZ'].map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>ASSIGNMENT/QUIZ components can be auto-filled from LMS data via “Pull from LMS”.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 10px', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, textAlign: 'left', borderBottom: '1px solid var(--line-soft)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--line-soft)', fontSize: 13 };
function Empty({ text }: { text: string }) { return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>; }
