'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText, ListChecks, HelpCircle, Plus, X, Trash2, Clock, AlertTriangle, CheckCircle2, Copy,
  Shuffle, Search, BarChart3, Award, Repeat, EyeOff, MinusCircle,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Subject } from '@/features/verticals/education/academics';
import {
  Assessment, Assignment, AsmtStats, Attempt, AttemptStats, ItemAnalysis, QOption, Question, QuestionDifficulty, QuestionType,
  QTYPE_LABEL, DIFFICULTY_LABEL, DIFFICULTY_COLOR, HAS_OPTIONS, Submission, fmtDate,
} from '../assessments-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const TABS = [{ key: 'assignments', label: 'Assignments', icon: FileText }, { key: 'bank', label: 'Question Bank', icon: HelpCircle }, { key: 'quizzes', label: 'Quizzes & Exams', icon: ListChecks }] as const;

export function AssessmentsFeature() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('assignments');
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const { data: stats } = useQuery({ queryKey: ['asmt-stats'], queryFn: async () => (await api.get<AsmtStats>('/assessments/stats')).data });
  const [subjectId, setSubjectId] = useState('');
  useEffect(() => { if (!subjectId && subjects?.length) setSubjectId(subjects[0].id); }, [subjects, subjectId]);

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Assignments & Assessments</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Assignments with submissions, a reusable question bank, and auto-graded quizzes.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Assignments" value={stats?.assignments ?? 0} />
        <Stat label="Questions" value={stats?.questions ?? 0} />
        <Stat label="Quizzes" value={stats?.assessments ?? 0} />
        <Stat label="Awaiting grading" value={stats?.pendingGrading ?? 0} accent="var(--gold,#c67c1e)" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map((t) => <button key={t.key} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === t.key ? 'var(--brand,#132376)' : undefined, color: tab === t.key ? 'var(--brand,#132376)' : undefined }} onClick={() => setTab(t.key)}><t.icon size={14} /> {t.label}</button>)}
        <div style={{ flex: 1 }} />
        <select className="input" style={{ height: 36, width: 220 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
      </div>
      {tab === 'assignments' && <AssignmentsTab subjectId={subjectId} />}
      {tab === 'bank' && <BankTab subjectId={subjectId} />}
      {tab === 'quizzes' && <QuizzesTab subjectId={subjectId} />}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <div style={{ ...card, padding: '14px 16px' }}><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div>;
}

// ================= Assignments =================
function AssignmentsTab({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['assignments', subjectId], enabled: !!subjectId, queryFn: async () => (await api.get<Assignment[]>('/assessments/assignments', { params: { subjectId } })).data });
  const [add, setAdd] = useState(false);
  const [openSubs, setOpenSubs] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['assignments'] }); qc.invalidateQueries({ queryKey: ['asmt-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/assessments/assignments/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  return (
    <div>
      <Head onAdd={() => setAdd(true)} label="New assignment" />
      {!data?.length && <Empty text="No assignments yet." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data ?? []).map((a) => (
          <div key={a.id} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={18} style={{ color: 'var(--ink-3)' }} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Due {fmtDate(a.dueAt)} · {a.maxMarks} marks · {a._count?.submissions ?? 0} submissions</div></div>
            <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setOpenSubs(a.id)}>Submissions</button>
            <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(a.id)}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      {add && <AssignmentModal subjectId={subjectId} onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
      {openSubs && <SubmissionsDrawer assignmentId={openSubs} onClose={() => setOpenSubs(null)} />}
    </div>
  );
}
function AssignmentModal({ subjectId, onClose, onDone }: { subjectId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', instructions: '', dueAt: '', maxMarks: '20' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/assessments/assignments', { subjectId, title: f.title, instructions: f.instructions || undefined, dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : undefined, maxMarks: Number(f.maxMarks) || 100 }), onSuccess: () => { toast.success('Assignment created'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New assignment" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div><label className="label">Instructions</label><textarea className="input" rows={3} style={{ resize: 'vertical' }} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Due date</label><input className="input" type="datetime-local" value={f.dueAt} onChange={(e) => set('dueAt', e.target.value)} /></div><div style={{ width: 110 }}><label className="label">Max marks</label><input className="input" type="number" value={f.maxMarks} onChange={(e) => set('maxMarks', e.target.value)} /></div></div>
      </div>
      <Actions onClose={onClose} disabled={!f.title || create.isPending} onSubmit={() => create.mutate()} label="Create" />
    </Overlay>
  );
}
function SubmissionsDrawer({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['submissions', assignmentId], queryFn: async () => (await api.get<{ assignment: Assignment; submissions: Submission[] }>(`/assessments/assignments/${assignmentId}/submissions`)).data });
  const [grading, setGrading] = useState<Submission | null>(null);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 520, maxWidth: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{data?.assignment.title ?? 'Submissions'}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        {!data?.submissions.length && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No submissions yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data?.submissions ?? []).map((s) => (
            <div key={s.id} style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.student?.firstName} {s.student?.lastName ?? ''}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.student?.admissionNo}</div></div>
                {s.isLate && <span className="badge" style={{ background: 'var(--gold-bg,#fdf2e2)', color: 'var(--gold,#c67c1e)' }}>Late</span>}
                {s.duplicateFlag && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><Copy size={10} style={{ marginRight: 3 }} />Duplicate</span>}
                {s.status === 'GRADED' ? <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>{s.marks}/{data?.assignment.maxMarks}</span>
                  : <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setGrading(s)}>Grade</button>}
              </div>
              {s.text && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'auto' }}>{s.text}</div>}
            </div>
          ))}
        </div>
      </div>
      {grading && <GradeModal submission={grading} max={data?.assignment.maxMarks ?? 100} onClose={() => setGrading(null)} onDone={() => { setGrading(null); qc.invalidateQueries({ queryKey: ['submissions', assignmentId] }); }} />}
    </>
  );
}
function GradeModal({ submission, max, onClose, onDone }: { submission: Submission; max: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ marks: String(submission.marks ?? ''), feedback: submission.feedback ?? '' });
  const grade = useMutation({ mutationFn: () => api.post(`/assessments/submissions/${submission.id}/grade`, { marks: Number(f.marks) || 0, feedback: f.feedback || undefined }), onSuccess: () => { toast.success('Graded'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title={`Grade — ${submission.student?.firstName}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Marks (out of {max})</label><input className="input" type="number" max={max} value={f.marks} onChange={(e) => setF({ ...f, marks: e.target.value })} /></div>
        <div><label className="label">Feedback</label><textarea className="input" rows={3} style={{ resize: 'vertical' }} value={f.feedback} onChange={(e) => setF({ ...f, feedback: e.target.value })} /></div>
      </div>
      <Actions onClose={onClose} disabled={f.marks === '' || grade.isPending} onSubmit={() => grade.mutate()} label="Save grade" />
    </Overlay>
  );
}

// ================= Question bank =================
const ALL_TYPES: QuestionType[] = ['MCQ', 'MULTI', 'TRUE_FALSE', 'NUMERIC', 'SHORT', 'LONG'];

function TypeBadge({ t }: { t: QuestionType }) {
  return <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{QTYPE_LABEL[t]}</span>;
}
function DiffBadge({ d }: { d: QuestionDifficulty }) {
  const c = DIFFICULTY_COLOR[d] ?? DIFFICULTY_COLOR.MEDIUM;
  return <span className="badge" style={{ background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>{DIFFICULTY_LABEL[d] ?? d}</span>;
}

function BankTab({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['questions', subjectId], enabled: !!subjectId, queryFn: async () => (await api.get<Question[]>('/assessments/questions', { params: { subjectId } })).data });
  const [add, setAdd] = useState(false);
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('');
  const [fDiff, setFDiff] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['questions'] }); qc.invalidateQueries({ queryKey: ['asmt-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/assessments/questions/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  const shown = useMemo(() => (data ?? []).filter((x) =>
    (!q || x.text.toLowerCase().includes(q.toLowerCase())) && (!fType || x.type === fType) && (!fDiff || x.difficulty === fDiff)), [data, q, fType, fDiff]);
  const totalMarks = shown.reduce((s, x) => s + x.marks, 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
          <input className="input" style={{ height: 36, paddingLeft: 30 }} placeholder="Search questions…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ height: 36, width: 150 }} value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">All types</option>{ALL_TYPES.map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
        </select>
        <select className="input" style={{ height: 36, width: 130 }} value={fDiff} onChange={(e) => setFDiff(e.target.value)}>
          <option value="">All levels</option>{(['EASY', 'MEDIUM', 'HARD'] as QuestionDifficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> New question</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>{shown.length} question{shown.length === 1 ? '' : 's'} · {totalMarks} marks total</div>
      {!shown.length && <Empty text={data?.length ? 'No questions match these filters.' : 'No questions. Build a bank to reuse across quizzes.'} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map((x) => (
          <div key={x.id} style={{ ...card, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <TypeBadge t={x.type} />
              <DiffBadge d={x.difficulty} />
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{x.text}</div>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{x.marks} mk</span>
              <button className="btn-secondary" style={{ height: 26, width: 26, padding: 0 }} onClick={() => del.mutate(x.id)}><Trash2 size={12} /></button>
            </div>
            {HAS_OPTIONS.includes(x.type) && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {x.options.map((o, i) => <span key={i} style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 7, background: o.correct ? 'var(--success-bg,#e6f4ea)' : 'var(--surface-2)', color: o.correct ? 'var(--success,#1e874b)' : 'var(--ink-2)' }}>{o.correct ? '✓ ' : ''}{o.text}</span>)}
              </div>
            )}
            {(x.type === 'SHORT' || x.type === 'NUMERIC') && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>Answer: <b style={{ color: 'var(--ink-2)' }}>{x.correctAnswer}</b>{x.type === 'NUMERIC' && String(x.correctAnswer ?? '').includes('|') && <span> (value ± tolerance)</span>}{x.type === 'SHORT' && String(x.correctAnswer ?? '').includes('|') && <span> (any of these accepted)</span>}</div>}
            {x.type === 'LONG' && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>Marked manually in the grading queue.</div>}
            {x.explanation && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6, fontStyle: 'italic' }}>Explanation: {x.explanation}</div>}
          </div>
        ))}
      </div>
      {add && <QuestionModal subjectId={subjectId} onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
    </div>
  );
}

function QuestionModal({ subjectId, onClose, onDone }: { subjectId: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<QuestionType>('MCQ');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('MEDIUM');
  const [text, setText] = useState('');
  const [marks, setMarks] = useState('1');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<QOption[]>([{ text: '', correct: true }, { text: '', correct: false }]);
  const [shortAnswer, setShortAnswer] = useState('');
  const [numValue, setNumValue] = useState('');
  const [numTol, setNumTol] = useState('');
  const setOpt = (i: number, patch: Partial<QOption>) => setOptions((o) => o.map((x, j) => j === i ? { ...x, ...patch } : x));

  // Switching type has to leave the option list valid for the new type.
  useEffect(() => {
    if (type === 'TRUE_FALSE') setOptions([{ text: 'True', correct: true }, { text: 'False', correct: false }]);
    else if (HAS_OPTIONS.includes(type)) {
      setOptions((o) => {
        const base = o.length >= 2 && o[0].text !== 'True' ? o : [{ text: '', correct: true }, { text: '', correct: false }];
        // MCQ allows exactly one correct answer — keep the first tick only.
        if (type === 'MCQ') { let seen = false; return base.map((x) => { const keep = !!x.correct && !seen; if (x.correct) seen = true; return { ...x, correct: keep }; }); }
        return base;
      });
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const correctAnswer = type === 'NUMERIC' ? (numTol.trim() ? `${numValue.trim()}|${numTol.trim()}` : numValue.trim()) : type === 'SHORT' ? shortAnswer.trim() : undefined;
  const filledOptions = options.filter((o) => o.text.trim());
  const nCorrect = filledOptions.filter((o) => o.correct).length;

  // Mirror the server's rules so the teacher sees the problem before saving.
  const problem = (() => {
    if (!text.trim()) return 'Enter the question text';
    if (HAS_OPTIONS.includes(type)) {
      if (filledOptions.length < 2) return 'Add at least two options';
      if (nCorrect < 1) return 'Mark at least one correct option';
      if (type === 'MCQ' && nCorrect > 1) return 'Multiple choice allows only one correct option — switch to Multi-select';
    }
    if (type === 'SHORT' && !shortAnswer.trim()) return 'Enter the correct answer';
    if (type === 'NUMERIC') {
      if (!numValue.trim()) return 'Enter the correct value';
      if (isNaN(Number(numValue))) return 'The correct value must be a number';
      if (numTol.trim() && isNaN(Number(numTol))) return 'Tolerance must be a number';
    }
    return null;
  })();

  const create = useMutation({
    mutationFn: () => api.post('/assessments/questions', {
      subjectId, type, difficulty, text: text.trim(), marks: Number(marks) || 1,
      options: HAS_OPTIONS.includes(type) ? filledOptions : undefined,
      correctAnswer, explanation: explanation.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Question added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Overlay title="New question" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>{ALL_TYPES.map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}</select>
          </div>
          <div style={{ width: 130 }}><label className="label">Difficulty</label>
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}>{(['EASY', 'MEDIUM', 'HARD'] as QuestionDifficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select>
          </div>
          <div style={{ width: 90 }}><label className="label">Marks</label><input className="input" type="number" min={1} value={marks} onChange={(e) => setMarks(e.target.value)} /></div>
        </div>
        <div><label className="label">Question</label><textarea className="input" rows={2} style={{ resize: 'vertical' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to ask?" /></div>

        {HAS_OPTIONS.includes(type) && (
          <div>
            <label className="label">
              Options <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>({type === 'MULTI' ? 'tick every correct answer — partial credit is awarded' : 'tick the correct one'})</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {options.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {type === 'MULTI'
                    ? <input type="checkbox" checked={!!o.correct} onChange={(e) => setOpt(i, { correct: e.target.checked })} />
                    : <input type="radio" name="correct" checked={!!o.correct} onChange={() => setOptions((os) => os.map((x, j) => ({ ...x, correct: j === i })))} />}
                  <input className="input" style={{ flex: 1 }} value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} disabled={type === 'TRUE_FALSE'} placeholder={`Option ${i + 1}`} />
                  {type !== 'TRUE_FALSE' && options.length > 2 && <button onClick={() => setOptions((os) => os.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={14} /></button>}
                </div>
              ))}
            </div>
            {type !== 'TRUE_FALSE' && <button className="btn-secondary" style={{ height: 28, fontSize: 12, marginTop: 6 }} onClick={() => setOptions((o) => [...o, { text: '', correct: false }])}><Plus size={12} /> Option</button>}
          </div>
        )}

        {type === 'SHORT' && (
          <div>
            <label className="label">Accepted answer(s)</label>
            <input className="input" value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} placeholder="paris|the city of paris" />
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Case-insensitive. Separate alternatives with <b>|</b> — any one of them scores full marks.</div>
          </div>
        )}

        {type === 'NUMERIC' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Correct value</label><input className="input" value={numValue} onChange={(e) => setNumValue(e.target.value)} placeholder="9.81" /></div>
            <div style={{ flex: 1 }}><label className="label">Tolerance (±, optional)</label><input className="input" value={numTol} onChange={(e) => setNumTol(e.target.value)} placeholder="0.05" /></div>
          </div>
        )}

        {type === 'LONG' && <div style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 8, padding: '9px 11px' }}>Long-answer questions can't be auto-marked — every attempt containing one lands in the grading queue for a teacher to score.</div>}

        <div><label className="label">Explanation <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional — shown to students with their result)</span></label>
          <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why the correct answer is correct." />
        </div>

        {problem && <div style={{ fontSize: 12, color: 'var(--danger,#c0392b)', background: 'var(--danger-bg,#fce8e8)', borderRadius: 8, padding: '8px 10px' }}>{problem}</div>}
      </div>
      <Actions onClose={onClose} disabled={!!problem || create.isPending} onSubmit={() => create.mutate()} label="Add question" />
    </Overlay>
  );
}

// ================= Quizzes =================
function QuizzesTab({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['assessments', subjectId], enabled: !!subjectId, queryFn: async () => (await api.get<Assessment[]>('/assessments/assessments', { params: { subjectId } })).data });
  const { data: queue } = useQuery({ queryKey: ['grading-queue'], queryFn: async () => (await api.get<Attempt[]>('/assessments/grading-queue')).data });
  const [add, setAdd] = useState(false);
  const [openAtt, setOpenAtt] = useState<string | null>(null);
  const [grading, setGrading] = useState<Attempt | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['assessments'] }); qc.invalidateQueries({ queryKey: ['grading-queue'] }); qc.invalidateQueries({ queryKey: ['asmt-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/assessments/assessments/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  return (
    <div>
      <Head onAdd={() => setAdd(true)} label="New quiz" />
      {(queue ?? []).length > 0 && (
        <div style={{ ...card, padding: 16, marginBottom: 14, background: 'var(--gold-bg,#fdf2e2)', border: '1px solid color-mix(in srgb, var(--gold,#c67c1e) 25%, var(--line-soft))' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold,#c67c1e)', marginBottom: 8 }}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> Grading queue — {queue!.length} attempt(s) with essays</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue!.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 9, padding: '8px 11px' }}>
                <div style={{ flex: 1, fontSize: 12.5 }}><b>{a.student?.firstName} {a.student?.lastName ?? ''}</b> · {a.assessment?.subject?.code} {a.assessment?.title} · objective {a.autoScore}</div>
                <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setGrading(a)}><CheckCircle2 size={12} /> Grade essays</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {!data?.length && <Empty text="No quizzes. Create one from your question bank." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data ?? []).map((a) => (
          <div key={a.id} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ListChecks size={18} style={{ color: 'var(--ink-3)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title} <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{a.kind}</span></div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}><Clock size={11} style={{ verticalAlign: -1 }} /> {a.durationMin}min · {a.totalMarks} marks · {a._count?.questions ?? 0} questions · {a._count?.attempts ?? 0} attempts</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {a.passMarks > 0 && <Chip icon={Award}>Pass {a.passMarks}/{a.totalMarks}</Chip>}
                {a.maxAttempts > 1 && <Chip icon={Repeat}>{a.maxAttempts} attempts</Chip>}
                {(a.shuffleQuestions || a.shuffleOptions) && <Chip icon={Shuffle}>{a.shuffleQuestions && a.shuffleOptions ? 'Shuffled' : a.shuffleQuestions ? 'Questions shuffled' : 'Options shuffled'}</Chip>}
                {a.negativeMarkPct > 0 && <Chip icon={MinusCircle}>−{a.negativeMarkPct}% wrong</Chip>}
                {!a.showAnswers && <Chip icon={EyeOff}>Answers hidden</Chip>}
              </div>
            </div>
            <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setOpenAtt(a.id)}>Results</button>
            <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(a.id)}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      {add && <QuizModal subjectId={subjectId} onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
      {openAtt && <AttemptsDrawer assessmentId={openAtt} onClose={() => setOpenAtt(null)} />}
      {grading && <GradeAttemptModal attempt={grading} onClose={() => setGrading(null)} onDone={() => { setGrading(null); refresh(); }} />}
    </div>
  );
}
function Chip({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return <span style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 6, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon size={10} />{children}</span>;
}

function QuizModal({ subjectId, onClose, onDone }: { subjectId: string; onClose: () => void; onDone: () => void }) {
  const { data: questions } = useQuery({ queryKey: ['questions', subjectId], queryFn: async () => (await api.get<Question[]>('/assessments/questions', { params: { subjectId } })).data });
  const [f, setF] = useState({ title: '', kind: 'QUIZ', durationMin: '15', dueAt: '', instructions: '' });
  const [settings, setSettings] = useState({ passPct: '40', maxAttempts: '1', negativeMarkPct: '0', shuffleQuestions: false, shuffleOptions: false, showAnswers: true });
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('');

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const shown = useMemo(() => (questions ?? []).filter((x) => (!q || x.text.toLowerCase().includes(q.toLowerCase())) && (!fType || x.type === fType)), [questions, q, fType]);
  const pickedQs = (questions ?? []).filter((x) => picked.includes(x.id));
  const total = pickedQs.reduce((s, x) => s + x.marks, 0);
  const hasEssay = pickedQs.some((x) => x.type === 'LONG');
  // Pass mark is authored as a percentage — far more natural than a raw number that
  // shifts every time a question is added or removed.
  const passMarks = Math.round((total * (Number(settings.passPct) || 0)) / 100);

  const create = useMutation({
    mutationFn: () => api.post('/assessments/assessments', {
      subjectId, title: f.title, kind: f.kind, durationMin: Number(f.durationMin) || 20,
      instructions: f.instructions || undefined, dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : undefined,
      questionIds: picked, passMarks,
      maxAttempts: Number(settings.maxAttempts) || 1,
      negativeMarkPct: Number(settings.negativeMarkPct) || 0,
      shuffleQuestions: settings.shuffleQuestions, shuffleOptions: settings.shuffleOptions, showAnswers: settings.showAnswers,
    }),
    onSuccess: () => { toast.success('Quiz created'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Overlay title="New quiz / exam" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div style={{ width: 110 }}><label className="label">Kind</label><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="QUIZ">Quiz</option><option value="EXAM">Exam</option></select></div>
          <div style={{ width: 95 }}><label className="label">Minutes</label><input className="input" type="number" min={1} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Instructions <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label><input className="input" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} placeholder="Shown before the student starts" /></div>
          <div style={{ width: 210 }}><label className="label">Closes at <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label><input className="input" type="datetime-local" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></div>
        </div>

        <div>
          <label className="label">Questions from the bank</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
              <input className="input" style={{ height: 32, paddingLeft: 28, fontSize: 12.5 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" style={{ height: 32, width: 145, fontSize: 12.5 }} value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">All types</option>{ALL_TYPES.map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
            </select>
            <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setPicked((p) => { const ids = shown.map((x) => x.id); return ids.every((i) => p.includes(i)) ? p.filter((i) => !ids.includes(i)) : [...new Set([...p, ...ids])]; })}>
              {shown.length > 0 && shown.every((x) => picked.includes(x.id)) ? 'Clear' : 'Select all'}
            </button>
          </div>
          <div style={{ maxHeight: '30vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--line-soft)', borderRadius: 10, padding: 8 }}>
            {shown.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: 8 }}>{questions?.length ? 'Nothing matches those filters.' : "No questions in this subject's bank yet."}</div>}
            {shown.map((x) => (
              <label key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: picked.includes(x.id) ? 'color-mix(in srgb, var(--brand,#132376) 8%, var(--surface))' : 'var(--surface-2)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.includes(x.id)} onChange={() => toggle(x.id)} />
                <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-3)', fontSize: 10 }}>{QTYPE_LABEL[x.type]}</span>
                <DiffBadge d={x.difficulty} />
                <span style={{ flex: 1, fontSize: 12.5 }}>{x.text}</span><span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{x.marks}mk</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
            <b style={{ color: 'var(--ink-2)' }}>{picked.length}</b> picked · <b style={{ color: 'var(--ink-2)' }}>{total}</b> marks · pass at <b style={{ color: 'var(--ink-2)' }}>{passMarks}</b>
            {hasEssay && <span style={{ color: 'var(--gold,#c67c1e)' }}> · contains an essay, so results wait for manual marking</span>}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Rules</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Pass mark (%)</label><input className="input" type="number" min={0} max={100} value={settings.passPct} onChange={(e) => setSettings({ ...settings, passPct: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="label">Attempts allowed</label><input className="input" type="number" min={1} max={20} value={settings.maxAttempts} onChange={(e) => setSettings({ ...settings, maxAttempts: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="label">Negative marking (%)</label><input className="input" type="number" min={0} max={100} value={settings.negativeMarkPct} onChange={(e) => setSettings({ ...settings, negativeMarkPct: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Toggle checked={settings.shuffleQuestions} onChange={(v) => setSettings({ ...settings, shuffleQuestions: v })} label="Shuffle question order" hint="Each student sees the questions in a different order." />
            <Toggle checked={settings.shuffleOptions} onChange={(v) => setSettings({ ...settings, shuffleOptions: v })} label="Shuffle answer options" hint="Options are reordered per student — marking is unaffected." />
            <Toggle checked={settings.showAnswers} onChange={(v) => setSettings({ ...settings, showAnswers: v })} label="Reveal answers after submitting" hint="Students see the correct answers and your explanations on their result screen." />
          </div>
          {Number(settings.negativeMarkPct) > 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>A wrong answer loses {settings.negativeMarkPct}% of that question's marks. Unanswered questions are never penalised, and a paper can't drop below zero.</div>}
        </div>
      </div>
      <Actions onClose={onClose} disabled={!f.title || picked.length === 0 || create.isPending} onSubmit={() => create.mutate()} label="Create quiz" />
    </Overlay>
  );
}
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span><span style={{ fontSize: 13 }}>{label}</span>{hint && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)' }}>{hint}</span>}</span>
    </label>
  );
}

function GradeAttemptModal({ attempt, onClose, onDone }: { attempt: Attempt & { toGrade?: { questionId: string; text: string; marks: number; answer: any }[] }; onClose: () => void; onDone: () => void }) {
  const items = attempt.toGrade ?? [];
  const [marks, setMarks] = useState<Record<string, string>>({});
  const manual = items.reduce((s, it) => s + (Number(marks[it.questionId]) || 0), 0);
  const over = items.find((it) => (Number(marks[it.questionId]) || 0) > it.marks);
  const grade = useMutation({
    mutationFn: () => api.post(`/assessments/attempts/${attempt.id}/grade`, { grades: items.map((it) => ({ questionId: it.questionId, marks: Number(marks[it.questionId]) || 0 })) }),
    onSuccess: () => { toast.success('Attempt graded'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Overlay title={`Grade essays — ${attempt.student?.firstName ?? ''} ${attempt.student?.lastName ?? ''}`} onClose={onClose} wide>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>{attempt.assessment?.title} · auto-marked objective score <b style={{ color: 'var(--ink-2)' }}>{attempt.autoScore}</b></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!items.length && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No essay answers on this attempt.</div>}
        {items.map((it) => (
          <div key={it.questionId} style={{ ...card, padding: 13 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 7 }}>{it.text}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--surface-2)', borderRadius: 8, padding: '9px 11px', whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
              {String(it.answer ?? '').trim() || <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Left blank</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
              <label className="label" style={{ margin: 0 }}>Marks</label>
              <input className="input" type="number" min={0} max={it.marks} step={1} style={{ width: 90, height: 32 }} value={marks[it.questionId] ?? ''} onChange={(e) => setMarks((m) => ({ ...m, [it.questionId]: e.target.value }))} />
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>out of {it.marks}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12.5 }}>Final score: <b>{attempt.autoScore + manual}</b> ({attempt.autoScore} objective + {manual} essay)</div>
      {over && <div style={{ fontSize: 12, color: 'var(--danger,#c0392b)', marginTop: 6 }}>A question can't score more than it's worth ({over.marks}).</div>}
      <Actions onClose={onClose} disabled={!!over || grade.isPending} onSubmit={() => grade.mutate()} label="Save grades" />
    </Overlay>
  );
}

function AttemptsDrawer({ assessmentId, onClose }: { assessmentId: string; onClose: () => void }) {
  const [view, setView] = useState<'students' | 'questions'>('students');
  const { data } = useQuery({ queryKey: ['attempts', assessmentId], queryFn: async () => (await api.get<{ assessment: Assessment; attempts: Attempt[]; stats: AttemptStats }>(`/assessments/assessments/${assessmentId}/attempts`)).data });
  const { data: ia } = useQuery({ queryKey: ['item-analysis', assessmentId], enabled: view === 'questions', queryFn: async () => (await api.get<ItemAnalysis>(`/assessments/assessments/${assessmentId}/item-analysis`)).data });
  const s = data?.stats;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 560, maxWidth: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{data?.assessment.title ?? 'Results'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>

        {s && s.submitted > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            <MiniStat label="Submitted" value={String(s.submitted)} />
            <MiniStat label="Average" value={s.avgScore != null ? `${s.avgScore}/${data?.assessment.totalMarks}` : '—'} />
            <MiniStat label="Passed" value={String(s.passed)} color="var(--success,#1e874b)" />
            <MiniStat label="Failed" value={String(s.failed)} color="var(--danger,#c0392b)" />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn-secondary" style={{ height: 32, fontSize: 12, borderColor: view === 'students' ? 'var(--brand,#132376)' : undefined, color: view === 'students' ? 'var(--brand,#132376)' : undefined }} onClick={() => setView('students')}>By student</button>
          <button className="btn-secondary" style={{ height: 32, fontSize: 12, borderColor: view === 'questions' ? 'var(--brand,#132376)' : undefined, color: view === 'questions' ? 'var(--brand,#132376)' : undefined }} onClick={() => setView('questions')}><BarChart3 size={12} /> By question</button>
        </div>

        {view === 'students' && <>
          {!data?.attempts.length && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No attempts yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.attempts ?? []).map((a) => (
              <div key={a.id} style={{ ...card, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.student?.firstName} {a.student?.lastName ?? ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{a.student?.admissionNo}{a.attemptNo > 1 ? ` · attempt ${a.attemptNo}` : ''}</div>
                </div>
                {a.lateSubmit && <span className="badge" style={{ background: 'var(--gold-bg,#fdf2e2)', color: 'var(--gold,#c67c1e)' }}>Late</span>}
                {a.status === 'IN_PROGRESS' ? <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>In progress</span>
                  : a.needsGrading ? <span className="badge" style={{ background: 'var(--gold-bg,#fdf2e2)', color: 'var(--gold,#c67c1e)' }}>Needs grading</span>
                  : <>
                      {a.passed != null && <span className="badge" style={{ background: a.passed ? 'var(--success-bg,#e6f4ea)' : 'var(--danger-bg,#fce8e8)', color: a.passed ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)' }}>{a.passed ? 'Pass' : 'Fail'}</span>}
                      <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{a.totalScore ?? a.autoScore}/{data?.assessment.totalMarks}</span>
                    </>}
              </div>
            ))}
          </div>
        </>}

        {view === 'questions' && <>
          {!ia?.items.length && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No data yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(ia?.items ?? []).map((it, i) => (
              <div key={it.questionId} style={{ ...card, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{it.text}</div>
                  <TypeBadge t={it.type} />
                </div>
                {it.type === 'LONG' ? <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 7 }}>Manually marked — no automatic statistics.</div> : (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ width: `${it.correctPct ?? 0}%`, height: '100%', background: (it.correctPct ?? 0) >= 70 ? 'var(--success,#1e874b)' : (it.correctPct ?? 0) >= 40 ? 'var(--gold,#c67c1e)' : 'var(--danger,#c0392b)' }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 5 }}>
                      {it.attempted === 0 ? 'Not attempted yet' : <>{it.correctPct}% correct · {it.correct} of {it.attempted} answered it right</>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>}
      </div>
    </>
  );
}
function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ ...card, padding: '9px 11px' }}><div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div><div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{label}</div></div>;
}

// shared
function Head({ onAdd, label }: { onAdd: () => void; label: string }) { return <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn-primary" onClick={onAdd}><Plus size={15} /> {label}</button></div>; }
function Empty({ text }: { text: string }) { return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>; }
function Overlay({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: wide ? 600 : 480, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}
function Actions({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
