'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Target, Grid3x3, Link2, BarChart3, Users, Plus, Trash2, X, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Subject, Term } from '@/features/verticals/education/academics';
import {
  CoAttainmentRow, CoPoMap, CourseOutcome, ObeOverview, OutcomeMap, PoAttainmentRow,
  ProgramOutcome, StudentAttainment, attainColor, levelColor,
} from '../obe-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const th: React.CSSProperties = { padding: '10px 10px', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, textAlign: 'left', borderBottom: '1px solid var(--line-soft)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--line-soft)', fontSize: 13 };
function Empty({ text }: { text: string }) { return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>; }

interface CourseLite { id: string; name: string; code: string }

export function ObeFeature() {
  const [tab, setTab] = useState<'outcomes' | 'matrix' | 'maps' | 'attainment'>('outcomes');
  const { data: overview } = useQuery({ queryKey: ['obe-overview'], queryFn: async () => (await api.get<ObeOverview>('/obe/overview')).data });
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Outcome-Based Education</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          Program Outcomes live on the <b>program</b> (Course), Course Outcomes on each <b>subject</b>. Map COs to POs, tie assessments to COs, and attainment follows the marks.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Program outcomes" value={overview?.poCount ?? 0} />
        <Stat label="Course outcomes" value={overview?.coCount ?? 0} />
        <Stat label="CO → PO links" value={overview?.mapCount ?? 0} />
        <Stat label="Instrument maps" value={overview?.instrumentMapCount ?? 0} accent="var(--success)" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['outcomes', 'Outcomes', Target], ['matrix', 'CO → PO Matrix', Grid3x3], ['maps', 'Assessment Links', Link2], ['attainment', 'Attainment', BarChart3]] as const).map(([k, l, Ic]) => (
          <button key={k} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? 'var(--brand,#132376)' : undefined, color: tab === k ? 'var(--brand,#132376)' : undefined }} onClick={() => setTab(k)}><Ic size={14} /> {l}</button>
        ))}
      </div>
      {tab === 'outcomes' && <OutcomesTab />}
      {tab === 'matrix' && <MatrixTab />}
      {tab === 'maps' && <MapsTab />}
      {tab === 'attainment' && <AttainmentTab />}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <div style={{ ...card, padding: '14px 16px' }}><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div>;
}

// ================= Outcomes =================
function OutcomesTab() {
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ['courses-lite'], queryFn: async () => (await api.get<CourseLite[]>('/courses/lite')).data });
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const { data: pos, isLoading: posLoading } = useQuery({ queryKey: ['obe-pos'], queryFn: async () => (await api.get<ProgramOutcome[]>('/obe/pos')).data });
  const { data: cos, isLoading: cosLoading } = useQuery({ queryKey: ['obe-cos'], queryFn: async () => (await api.get<CourseOutcome[]>('/obe/cos')).data });
  const [addPo, setAddPo] = useState(false);
  const [addCo, setAddCo] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['obe-pos'] }); qc.invalidateQueries({ queryKey: ['obe-cos'] }); qc.invalidateQueries({ queryKey: ['obe-overview'] }); };
  const delPo = useMutation({ mutationFn: (id: string) => api.delete(`/obe/pos/${id}`), onSuccess: () => { refresh(); toast.success('Removed'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const delCo = useMutation({ mutationFn: (id: string) => api.delete(`/obe/cos/${id}`), onSuccess: () => { refresh(); toast.success('Removed'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>Program Outcomes</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>What a graduate of the whole program can do</div></div>
          <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setAddPo(true)}><Plus size={12} /> Add PO</button>
        </div>
        {posLoading && <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>}
        {!posLoading && !pos?.length && <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>No program outcomes yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(pos ?? []).map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', alignItems: 'flex-start' }}>
              <span className="badge" style={{ background: 'var(--brand,#132376)', color: '#fff', minWidth: 42, justifyContent: 'center' }}>{p.code}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{p.statement}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{p.course?.name} · {p._count?.coPoMaps ?? 0} CO links</div>
              </div>
              <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => delPo.mutate(p.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>Course Outcomes</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>What passing one subject demonstrates</div></div>
          <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setAddCo(true)}><Plus size={12} /> Add CO</button>
        </div>
        {cosLoading && <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>}
        {!cosLoading && !cos?.length && <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>No course outcomes yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(cos ?? []).map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', alignItems: 'flex-start' }}>
              <span className="badge" style={{ background: 'var(--surface)', color: 'var(--brand,#132376)', minWidth: 42, justifyContent: 'center', border: '1px solid var(--line-soft)' }}>{c.code}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{c.statement}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  {c.subject?.code} · threshold {c.thresholdPct}% · target {c.targetPct}% · {c._count?.outcomeMaps ?? 0} instruments
                </div>
              </div>
              <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => delCo.mutate(c.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
      {addPo && <PoModal courses={courses ?? []} onClose={() => setAddPo(false)} onDone={() => { setAddPo(false); refresh(); }} />}
      {addCo && <CoModal subjects={subjects ?? []} onClose={() => setAddCo(false)} onDone={() => { setAddCo(false); refresh(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 480, maxWidth: '100%', padding: 22, borderRadius: 18, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>{footer}</div>
      </div>
    </div>
  );
}

function PoModal({ courses, onClose, onDone }: { courses: CourseLite[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ courseId: courses[0]?.id ?? '', code: 'PO1', statement: '' });
  const create = useMutation({
    mutationFn: () => api.post('/obe/pos', f),
    onSuccess: () => { toast.success('Program outcome added'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title="New Program Outcome" onClose={onClose} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.courseId || !f.code || !f.statement || create.isPending} onClick={() => create.mutate()}>Add</button></>}>
      <div><label className="label">Program</label><select className="input" value={f.courseId} onChange={(e) => setF((s) => ({ ...s, courseId: e.target.value }))}>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className="label">Code</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} placeholder="PO1" /></div>
      <div><label className="label">Statement</label><textarea className="input" style={{ minHeight: 70 }} value={f.statement} onChange={(e) => setF((s) => ({ ...s, statement: e.target.value }))} placeholder="Demonstrate effective management knowledge." /></div>
    </Modal>
  );
}

function CoModal({ subjects, onClose, onDone }: { subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ subjectId: subjects[0]?.id ?? '', code: 'CO1', statement: '', thresholdPct: '60', targetPct: '60' });
  const create = useMutation({
    mutationFn: () => api.post('/obe/cos', { ...f, thresholdPct: Number(f.thresholdPct) || 60, targetPct: Number(f.targetPct) || 60 }),
    onSuccess: () => { toast.success('Course outcome added'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title="New Course Outcome" onClose={onClose} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.subjectId || !f.code || !f.statement || create.isPending} onClick={() => create.mutate()}>Add</button></>}>
      <div><label className="label">Subject</label><select className="input" value={f.subjectId} onChange={(e) => setF((s) => ({ ...s, subjectId: e.target.value }))}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></div>
      <div><label className="label">Code</label><input className="input" value={f.code} onChange={(e) => setF((s) => ({ ...s, code: e.target.value }))} placeholder="CO1" /></div>
      <div><label className="label">Statement</label><textarea className="input" style={{ minHeight: 70 }} value={f.statement} onChange={(e) => setF((s) => ({ ...s, statement: e.target.value }))} placeholder="Apply marketing frameworks to business cases." /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Student threshold %</label><input className="input" type="number" value={f.thresholdPct} onChange={(e) => setF((s) => ({ ...s, thresholdPct: e.target.value }))} /></div>
        <div style={{ flex: 1 }}><label className="label">Cohort target %</label><input className="input" type="number" value={f.targetPct} onChange={(e) => setF((s) => ({ ...s, targetPct: e.target.value }))} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Defaults of 60/60 are BMN Connects defaults, not an accreditation mandate — set your institute's policy here.</div>
    </Modal>
  );
}

// ================= Matrix =================
function MatrixTab() {
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ['courses-lite'], queryFn: async () => (await api.get<CourseLite[]>('/courses/lite')).data });
  const [courseId, setCourseId] = useState('');
  useEffect(() => { if (!courseId && courses?.length) setCourseId(courses[0].id); }, [courses, courseId]);
  const { data, isLoading } = useQuery({
    queryKey: ['obe-matrix', courseId], enabled: !!courseId,
    queryFn: async () => (await api.get<{ pos: ProgramOutcome[]; cos: (CourseOutcome & { subject: { code: string } })[]; maps: CoPoMap[] }>(`/obe/matrix/${courseId}`)).data,
  });
  const upsert = useMutation({
    mutationFn: (p: { courseOutcomeId: string; programOutcomeId: string; strength: number }) => api.post('/obe/copo', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obe-matrix', courseId] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/obe/copo/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obe-matrix', courseId] }),
  });
  if (!courses?.length) return <Empty text="Create a program (course) first." />;
  const mapFor = (coId: string, poId: string) => data?.maps.find((m) => m.courseOutcomeId === coId && m.programOutcomeId === poId);
  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <select className="input" style={{ height: 38, width: 260 }} value={courseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Click a cell to cycle strength — · 1 · 2 · 3 (accreditation convention: 1 slight, 2 moderate, 3 substantial)</div>
      </div>
      {isLoading && <Empty text="Loading matrix…" />}
      {!isLoading && (!data?.pos.length || !data?.cos.length) && <Empty text="Add program outcomes and course outcomes first — the matrix crosses them." />}
      {!isLoading && !!data?.pos.length && !!data?.cos.length && (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 480, width: '100%' }}>
            <thead><tr><th style={th}>CO \ PO</th>{data.pos.map((p) => <th key={p.id} style={{ ...th, textAlign: 'center' }} title={p.statement}>{p.code}</th>)}</tr></thead>
            <tbody>
              {data.cos.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }} title={c.statement}><b>{c.subject?.code}</b> {c.code}</td>
                  {data.pos.map((p) => {
                    const m = mapFor(c.id, p.id);
                    return (
                      <td key={p.id} style={{ ...td, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => {
                          if (!m) upsert.mutate({ courseOutcomeId: c.id, programOutcomeId: p.id, strength: 1 });
                          else if (m.strength >= 3) remove.mutate(m.id);
                          else upsert.mutate({ courseOutcomeId: c.id, programOutcomeId: p.id, strength: m.strength + 1 });
                        }}>
                        {m ? <span className="badge" style={{ background: m.strength === 3 ? 'var(--brand,#132376)' : 'var(--surface-2)', color: m.strength === 3 ? '#fff' : 'var(--ink-1)', minWidth: 28, justifyContent: 'center' }}>{m.strength}</span> : <span style={{ color: 'var(--line-soft)' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ================= Assessment links =================
function MapsTab() {
  const qc = useQueryClient();
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const [subjectId, setSubjectId] = useState('');
  useEffect(() => { if (!subjectId && subjects?.length) setSubjectId(subjects[0].id); }, [subjects, subjectId]);
  const { data: maps } = useQuery({ queryKey: ['obe-maps', subjectId], enabled: !!subjectId, queryFn: async () => (await api.get<OutcomeMap[]>('/obe/maps', { params: { subjectId } })).data });
  const { data: unmapped } = useQuery({ queryKey: ['obe-unmapped', subjectId], enabled: !!subjectId, queryFn: async () => (await api.get<{ assessments: { id: string; title: string; kind: string }[]; assignments: { id: string; title: string }[]; gradeComponents: { id: string; name: string }[] }>(`/obe/unmapped/${subjectId}`)).data });
  const { data: cos } = useQuery({ queryKey: ['obe-cos-sub', subjectId], enabled: !!subjectId, queryFn: async () => (await api.get<CourseOutcome[]>('/obe/cos', { params: { subjectId } })).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['obe-maps', subjectId] }); qc.invalidateQueries({ queryKey: ['obe-unmapped', subjectId] }); qc.invalidateQueries({ queryKey: ['obe-overview'] }); };
  const create = useMutation({ mutationFn: (p: any) => api.post('/obe/maps', p), onSuccess: () => { refresh(); toast.success('Linked'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/obe/maps/${id}`), onSuccess: () => { refresh(); toast.success('Unlinked'); } });
  const [pick, setPick] = useState<{ kind: 'assessmentId' | 'assignmentId' | 'gradeComponentId'; id: string; label: string } | null>(null);
  if (!subjects?.length) return <Empty text="Add subjects first (Academics)." />;
  return (
    <div>
      <select className="input" style={{ height: 38, width: 260, marginBottom: 12 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Not yet counted in OBE</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 12 }}>Marks from these instruments do not reach any outcome. Link each to a CO.</div>
          {!unmapped || (!unmapped.assessments.length && !unmapped.assignments.length && !unmapped.gradeComponents.length)
            ? <div style={{ fontSize: 13, color: 'var(--success)', padding: 8 }}>Everything with marks is mapped. ✓</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unmapped.assessments.map((a) => <UnmappedRow key={a.id} label={`${a.kind === 'EXAM' ? 'Exam' : 'Quiz'} · ${a.title}`} onLink={() => setPick({ kind: 'assessmentId', id: a.id, label: a.title })} />)}
                {unmapped.assignments.map((a) => <UnmappedRow key={a.id} label={`Assignment · ${a.title}`} onLink={() => setPick({ kind: 'assignmentId', id: a.id, label: a.title })} />)}
                {unmapped.gradeComponents.map((g) => <UnmappedRow key={g.id} label={`Component · ${g.name}`} onLink={() => setPick({ kind: 'gradeComponentId', id: g.id, label: g.name })} />)}
              </div>
            )}
        </div>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Linked instruments</div>
          {!maps?.length && <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: 8 }}>No links yet for this subject.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(maps ?? []).map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px' }}>
                <span className="badge" style={{ background: 'var(--surface)', color: 'var(--brand,#132376)', border: '1px solid var(--line-soft)' }}>{m.courseOutcome?.code}</span>
                <div style={{ flex: 1, fontSize: 12.5 }}>{m.assessment?.title ?? m.assignment?.title ?? m.gradeComponent?.name}</div>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{m.weightPct}%</span>
                <button className="btn-secondary" style={{ height: 26, width: 26, padding: 0 }} onClick={() => remove.mutate(m.id)}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {pick && (
        <Modal title={`Link "${pick.label}" to a CO`} onClose={() => setPick(null)} footer={<button className="btn-secondary" onClick={() => setPick(null)}>Close</button>}>
          {!cos?.length && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>This subject has no COs yet — add them in the Outcomes tab first.</div>}
          {(cos ?? []).map((c) => (
            <button key={c.id} className="btn-secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: '10px 12px' }}
              onClick={() => { create.mutate({ courseOutcomeId: c.id, [pick.kind]: pick.id }); setPick(null); }}>
              <b style={{ marginRight: 8 }}>{c.code}</b> <span style={{ fontSize: 12.5, whiteSpace: 'normal' }}>{c.statement}</span>
            </button>
          ))}
        </Modal>
      )}
    </div>
  );
}
function UnmappedRow({ label, onLink }: { label: string; onLink: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ flex: 1, fontSize: 12.5 }}>{label}</div>
      <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={onLink}><Link2 size={12} /> Link to CO</button>
    </div>
  );
}

// ================= Attainment =================
function AttainmentTab() {
  const { data: terms } = useQuery({ queryKey: ['acad-terms'], queryFn: async () => (await api.get<Term[]>('/academics/terms')).data });
  const [termId, setTermId] = useState('');
  useEffect(() => { if (!termId && terms?.length) setTermId(terms.find((t) => t.isCurrent)?.id ?? terms[0].id); }, [terms, termId]);
  const [view, setView] = useState<'co' | 'po'>('co');
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: view === 'co' ? 'var(--brand,#132376)' : undefined, color: view === 'co' ? 'var(--brand,#132376)' : undefined }} onClick={() => setView('co')}>CO attainment</button>
        <button className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: view === 'po' ? 'var(--brand,#132376)' : undefined, color: view === 'po' ? 'var(--brand,#132376)' : undefined }} onClick={() => setView('po')}>PO attainment</button>
        <div style={{ flex: 1 }} />
        <select className="input" style={{ height: 36, width: 180 }} value={termId} onChange={(e) => setTermId(e.target.value)}>{(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? ' (current)' : ''}</option>)}</select>
      </div>
      {view === 'co' ? <CoAttainment termId={termId} /> : <PoAttainment termId={termId} />}
    </div>
  );
}

function CoAttainment({ termId }: { termId: string }) {
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const [subjectId, setSubjectId] = useState('');
  useEffect(() => { if (!subjectId && subjects?.length) setSubjectId(subjects[0].id); }, [subjects, subjectId]);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['obe-co-att', subjectId, termId], enabled: !!subjectId && !!termId,
    queryFn: async () => (await api.get<CoAttainmentRow[]>('/obe/attainment/co', { params: { subjectId, termId } })).data,
  });
  const [openCo, setOpenCo] = useState<string | null>(null);
  if (!subjects?.length) return <Empty text="Add subjects first (Academics)." />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <select className="input" style={{ height: 38, width: 260 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <button className="btn-secondary" style={{ height: 38 }} disabled={isFetching} onClick={() => refetch()}><RefreshCw size={14} /> {isFetching ? 'Computing…' : 'Recompute'}</button>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Reads recompute automatically when marks changed since the last calculation.</div>
      </div>
      {isLoading && <Empty text="Computing attainment…" />}
      {!isLoading && !data?.length && <Empty text="No course outcomes for this subject yet." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((co) => (
          <div key={co.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setOpenCo(openCo === co.id ? null : co.id)}>
              {openCo === co.id ? <ChevronDown size={16} style={{ marginTop: 3, color: 'var(--ink-3)' }} /> : <ChevronRight size={16} style={{ marginTop: 3, color: 'var(--ink-3)' }} />}
              <span className="badge" style={{ background: 'var(--brand,#132376)', color: '#fff', minWidth: 42, justifyContent: 'center' }}>{co.code}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{co.statement}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                  {co.instruments.length ? `Measured by: ${co.instruments.join(', ')}` : 'No instruments linked — attainment cannot be measured'} · threshold {co.thresholdPct}% · target {co.targetPct}%
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {co.sections.map((s) => (
                  <div key={s.sectionId} style={{ textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px', minWidth: 86 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: attainColor(s.attainedPct, co.targetPct) }}>{s.attainedPct}%</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{s.section} · L{s.level}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{s.attained}/{s.evaluated} students</div>
                  </div>
                ))}
                {!co.sections.length && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>no cohort data</span>}
              </div>
            </div>
            {openCo === co.id && <CoStudents coId={co.id} termId={termId} threshold={co.thresholdPct} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoStudents({ coId, termId, threshold }: { coId: string; termId: string; threshold: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['obe-co-students', coId, termId],
    queryFn: async () => (await api.get<StudentAttainment[]>(`/obe/attainment/co/${coId}/students`, { params: { termId } })).data,
  });
  if (isLoading) return <div style={{ padding: '14px 0 4px 26px', fontSize: 12.5, color: 'var(--ink-3)' }}>Loading students…</div>;
  const withEvidence = (data ?? []).filter((r) => r.evidenceCount > 0);
  const without = (data ?? []).length - withEvidence.length;
  return (
    <div style={{ marginTop: 12, paddingLeft: 26 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Student</th><th style={{ ...th, textAlign: 'center' }}>Score</th><th style={{ ...th, textAlign: 'center' }}>Evidence</th><th style={{ ...th, textAlign: 'center' }}>Attained</th></tr></thead>
        <tbody>
          {withEvidence.map((r) => (
            <tr key={r.id}>
              <td style={td}><b>{r.student.admissionNo}</b> {r.student.firstName} {r.student.lastName ?? ''}</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: r.scorePct >= threshold ? 'var(--success)' : 'var(--danger,#c0392b)' }}>{r.scorePct}%</td>
              <td style={{ ...td, textAlign: 'center' }}>{r.evidenceCount}</td>
              <td style={{ ...td, textAlign: 'center' }}>{r.attained ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {without > 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', padding: '8px 0' }}>{without} enrolled student{without > 1 ? 's have' : ' has'} no graded evidence yet — excluded from cohort figures, not counted as failed.</div>}
    </div>
  );
}

function PoAttainment({ termId }: { termId: string }) {
  const { data: courses } = useQuery({ queryKey: ['courses-lite'], queryFn: async () => (await api.get<CourseLite[]>('/courses/lite')).data });
  const [courseId, setCourseId] = useState('');
  useEffect(() => { if (!courseId && courses?.length) setCourseId(courses[0].id); }, [courses, courseId]);
  const { data, isLoading } = useQuery({
    queryKey: ['obe-po-att', courseId, termId], enabled: !!courseId && !!termId,
    queryFn: async () => (await api.get<PoAttainmentRow[]>('/obe/attainment/po', { params: { courseId, termId } })).data,
  });
  if (!courses?.length) return <Empty text="Create a program (course) first." />;
  return (
    <div>
      <select className="input" style={{ height: 38, width: 260, marginBottom: 12 }} value={courseId} onChange={(e) => setCourseId(e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      {isLoading && <Empty text="Rolling CO attainment up to POs…" />}
      {!isLoading && !data?.length && <Empty text="No program outcomes yet." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((po) => (
          <div key={po.id} style={{ ...card, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span className="badge" style={{ background: 'var(--brand,#132376)', color: '#fff', minWidth: 42, justifyContent: 'center' }}>{po.code}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5 }}>{po.statement}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {po.contributingCos.length
                  ? `From ${po.contributingCos.length} COs: ${po.contributingCos.map((c) => `${c.subject}·${c.code}(${c.strength})`).join(', ')}`
                  : 'No CO mappings — nothing rolls up to this PO'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {po.sections.map((s) => (
                <div key={s.sectionId} style={{ textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px', minWidth: 86 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: levelColor(s.level) }}>{s.attainedPct}%</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{s.section} · L{s.level}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{s.attained}/{s.evaluated} students</div>
                </div>
              ))}
              {!po.sections.length && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>no cohort data</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
