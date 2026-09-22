'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays, ListChecks, BarChart3, Users, Plus, X, CheckCircle2, CalendarClock,
  Ban, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Section, Subject, Term } from '@/features/verticals/education/academics';
import { T } from '@/features/verticals/education/institute-dashboard';
import { CourseOutcome, FacultyPerf, METHOD_LABEL, SessionPlan, SubjectPerf, SyllabusRow, WeakStudent } from '../obe-client';

/* ── teal design tokens (AIMER ERP) ─────────────────────────────────────────── */
const brand = T.brand;
const panel: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow };
const th: React.CSSProperties = { padding: '0 12px 12px', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: T.ink3, fontWeight: 590, textAlign: 'left', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '13px 12px', borderTop: `1px solid ${T.border}`, fontSize: 13, color: T.ink };
const inp: React.CSSProperties = { height: 42, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, padding: '0 12px', fontSize: 13, color: T.ink, outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 6 };

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PLANNED: { bg: '#f1f1f1', fg: T.ink2 },
  PUBLISHED: { bg: T.brandSubtle, fg: T.brandText },
  COMPLETED: { bg: T.successBg, fg: T.success },
  RESCHEDULED: { bg: T.amberBg, fg: T.amberDeep },
  CANCELLED: { bg: T.dangerBg, fg: T.dangerText },
};
const title = (s: string) => s[0] + s.slice(1).toLowerCase();

function solidBtn(): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: brand, color: '#fff', whiteSpace: 'nowrap' };
}
function ghostBtn(): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${T.border}`, background: T.surface, color: T.ink, whiteSpace: 'nowrap' };
}
function badge(tone: { bg: string; fg: string }): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: tone.bg, color: tone.fg, borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap' };
}
function Empty({ text }: { text: string }) { return <div style={{ ...panel, padding: 40, textAlign: 'center', color: T.ink3, fontSize: 13.5 }}>{text}</div>; }

export function SessionsFeature() {
  const [tab, setTab] = useState<'plans' | 'syllabus' | 'faculty' | 'weak'>('plans');
  const tabs = [
    ['plans', 'Session Plans', CalendarDays],
    ['syllabus', 'Syllabus Completion', ListChecks],
    ['faculty', 'Faculty Performance', BarChart3],
    ['weak', 'Weak Students', Users],
  ] as const;
  return (
    <div style={{ fontFamily: T.font, color: T.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: '-0.2px', margin: 0 }}>Session Planning &amp; Academic Intelligence</h1>
        <p style={{ fontSize: 13, lineHeight: '18px', color: T.ink2, margin: '6px 0 0' }}>Plan what each class teaches, mark delivery as it happens, and watch syllabus completion and faculty performance follow.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(([k, l, Ic]) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 10,
              border: `1px solid ${on ? brand : T.border}`, background: on ? T.brandSubtle : T.surface, color: on ? T.brandText : T.ink2, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              <Ic size={15} color={on ? brand : T.iconDefault} /> {l}
            </button>
          );
        })}
      </div>
      {tab === 'plans' && <PlansTab />}
      {tab === 'syllabus' && <SyllabusTab />}
      {tab === 'faculty' && <FacultyTab />}
      {tab === 'weak' && <WeakTab />}
    </div>
  );
}

// ================= Plans =================
function PlansTab() {
  const qc = useQueryClient();
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { if (!subjectId && subjects?.length) setSubjectId(subjects[0].id); }, [subjects, subjectId]);
  const { data: plans, isLoading } = useQuery({
    queryKey: ['session-plans', subjectId, status], enabled: !!subjectId,
    queryFn: async () => (await api.get<SessionPlan[]>('/session-plans', { params: { subjectId, ...(status ? { status } : {}) } })).data,
  });
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<SessionPlan | null>(null);
  const [rescheduling, setRescheduling] = useState<SessionPlan | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['session-plans'] }); qc.invalidateQueries({ queryKey: ['syllabus'] }); };
  const publish = useVerb('publish', refresh); const unpublish = useVerb('unpublish', refresh);
  const cancel = useVerb('cancel', refresh); const reopen = useVerb('reopen', refresh);

  if (!subjects?.length) return <Empty text="Add subjects first (Academics)." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...inp, width: 300, cursor: 'pointer' }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
        <select style={{ ...inp, width: 180, cursor: 'pointer' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['PLANNED', 'PUBLISHED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED'].map((s) => <option key={s} value={s}>{title(s)}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={solidBtn()} onClick={() => setCreating(true)}><Plus size={16} strokeWidth={2.2} /> Plan a session</button>
      </div>
      {isLoading && <Empty text="Loading session plans…" />}
      {!isLoading && !plans?.length && <Empty text="No session plans yet for this subject. Plan the first class." />}
      {!!plans?.length && (
        <div style={{ ...panel, padding: '8px 12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Topic</th><th style={th}>Method</th><th style={th}>COs</th><th style={th}>Duration</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {plans.map((p) => {
                const past = new Date(p.plannedDate) < new Date() && (p.status === 'PLANNED' || p.status === 'PUBLISHED');
                const tone = STATUS_TONE[p.status] ?? STATUS_TONE.PLANNED;
                return (
                  <tr key={p.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {new Date(p.plannedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {past && <span title="Past its planned date and not delivered"><AlertTriangle size={12} style={{ marginLeft: 6, color: T.amber, verticalAlign: -1 }} /></span>}
                    </td>
                    <td style={td}><div style={{ fontWeight: 600 }}>{p.topic}</div>{p.deviationReason && <div style={{ fontSize: 11, color: T.ink3 }}>{p.deviationReason}</div>}</td>
                    <td style={{ ...td, color: T.ink2 }}>{METHOD_LABEL[p.method]}</td>
                    <td style={{ ...td, color: T.ink2 }}>{p.outcomes.length ? p.outcomes.map((o) => o.courseOutcome.code).join(', ') : <span style={{ color: T.ink3 }}>—</span>}</td>
                    <td style={{ ...td, color: T.ink2 }}>{p.status === 'COMPLETED' && p.actualDurationMin != null ? `${p.actualDurationMin}m (planned ${p.plannedDurationMin}m)` : `${p.plannedDurationMin}m`}</td>
                    <td style={td}><span style={badge(tone)}>{title(p.status)}</span></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {p.status === 'PLANNED' && <ActionBtn title="Publish to faculty portal" onClick={() => publish.mutate(p.id)}><CheckCircle2 size={13} /> Publish</ActionBtn>}
                      {p.status === 'PUBLISHED' && <>
                        <ActionBtn title="Mark delivered" onClick={() => setCompleting(p)}><CheckCircle2 size={13} /> Delivered</ActionBtn>
                        <ActionBtn title="Move to another date" onClick={() => setRescheduling(p)}><CalendarClock size={13} /> Reschedule</ActionBtn>
                        <ActionBtn title="Back to draft" onClick={() => unpublish.mutate(p.id)}><RotateCcw size={13} /></ActionBtn>
                      </>}
                      {p.status === 'PLANNED' && <>
                        <ActionBtn title="Move to another date" onClick={() => setRescheduling(p)}><CalendarClock size={13} /></ActionBtn>
                        <ActionBtn title="Cancel this session" onClick={() => { if (confirm(`Cancel "${p.topic}"?`)) cancel.mutate(p.id); }}><Ban size={13} /></ActionBtn>
                      </>}
                      {p.status === 'PUBLISHED' && <ActionBtn title="Cancel this session" onClick={() => { if (confirm(`Cancel "${p.topic}"?`)) cancel.mutate(p.id); }}><Ban size={13} /></ActionBtn>}
                      {p.status === 'CANCELLED' && <ActionBtn title="Reopen as planned" onClick={() => reopen.mutate(p.id)}><RotateCcw size={13} /> Reopen</ActionBtn>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {creating && <PlanModal subjectId={subjectId} onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />}
      {completing && <CompleteModal plan={completing} onClose={() => setCompleting(null)} onDone={() => { setCompleting(null); refresh(); }} />}
      {rescheduling && <RescheduleModal plan={rescheduling} onClose={() => setRescheduling(null)} onDone={() => { setRescheduling(null); refresh(); }} />}
    </div>
  );
}
function useVerb(verb: string, refresh: () => void) {
  return useMutation({ mutationFn: (id: string) => api.post(`/session-plans/${id}/${verb}`, {}), onSuccess: refresh, onError: (e) => toast.error(apiErrorMessage(e)) });
}
function ActionBtn({ children, onClick, title: t }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return <button title={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, fontSize: 11.5, marginLeft: 6, padding: '0 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.ink2, cursor: 'pointer' }} onClick={onClick}>{children}</button>;
}

function Modal({ title: t, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,34,49,.34)' }} onClick={onClose} />
      <div style={{ ...panel, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 16, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(17,34,49,.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3 }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>{footer}</div>
      </div>
    </div>
  );
}

function PlanModal({ subjectId, onClose, onDone }: { subjectId: string; onClose: () => void; onDone: () => void }) {
  const { data: sections } = useQuery({ queryKey: ['acad-sections'], queryFn: async () => (await api.get<Section[]>('/academics/sections')).data });
  const { data: cos } = useQuery({ queryKey: ['obe-cos-sub', subjectId], queryFn: async () => (await api.get<CourseOutcome[]>('/obe/cos', { params: { subjectId } })).data });
  const [f, setF] = useState({ topic: '', description: '', method: 'LECTURE', plannedDate: new Date().toISOString().slice(0, 10), plannedDurationMin: '60', sectionId: '' });
  const [coIds, setCoIds] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: () => api.post('/session-plans', {
      subjectId, topic: f.topic, description: f.description || undefined, method: f.method,
      plannedDate: f.plannedDate, plannedDurationMin: Number(f.plannedDurationMin) || 60,
      sectionId: f.sectionId || undefined, courseOutcomeIds: coIds,
    }),
    onSuccess: () => { toast.success('Session planned'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title="Plan a session" onClose={onClose} footer={<><button style={ghostBtn()} onClick={onClose}>Cancel</button><button style={{ ...solidBtn(), opacity: !f.topic || create.isPending ? 0.6 : 1 }} disabled={!f.topic || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Planning…' : 'Plan'}</button></>}>
      <div><label style={labelStyle}>Topic</label><input style={inp} value={f.topic} onChange={(e) => setF((s) => ({ ...s, topic: e.target.value }))} placeholder="Segmentation, Targeting & Positioning" /></div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>Date</label><input style={inp} type="date" value={f.plannedDate} onChange={(e) => setF((s) => ({ ...s, plannedDate: e.target.value }))} /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Method</label><select style={{ ...inp, cursor: 'pointer' }} value={f.method} onChange={(e) => setF((s) => ({ ...s, method: e.target.value }))}><option value="LECTURE">Lecture</option><option value="CASE_STUDY">Case Study</option><option value="ACTIVITY">Activity</option></select></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Minutes</label><input style={inp} type="number" value={f.plannedDurationMin} onChange={(e) => setF((s) => ({ ...s, plannedDurationMin: e.target.value }))} /></div>
      </div>
      <div><label style={labelStyle}>Section (optional)</label><select style={{ ...inp, cursor: 'pointer' }} value={f.sectionId} onChange={(e) => setF((s) => ({ ...s, sectionId: e.target.value }))}><option value="">All sections</option>{(sections ?? []).map((s) => <option key={s.id} value={s.id}>{s.batch?.name} · {s.name}</option>)}</select></div>
      <div>
        <label style={labelStyle}>Course outcomes this session teaches toward</label>
        {!cos?.length && <div style={{ fontSize: 12, color: T.ink3 }}>No COs defined for this subject yet (OBE → Outcomes).</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {(cos ?? []).map((c) => {
            const on = coIds.includes(c.id);
            return <button key={c.id} type="button" title={c.statement} style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 7, padding: '4px 10px', border: `1px solid ${on ? brand : T.border}`, background: on ? brand : T.surface, color: on ? '#fff' : T.ink2 }} onClick={() => setCoIds((x) => on ? x.filter((i) => i !== c.id) : [...x, c.id])}>{c.code}</button>;
          })}
        </div>
      </div>
      <div><label style={labelStyle}>Notes (optional)</label><textarea style={{ ...inp, height: 'auto', minHeight: 56, padding: '10px 12px', resize: 'vertical' }} value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
    </Modal>
  );
}

function CompleteModal({ plan, onClose, onDone }: { plan: SessionPlan; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ actualDurationMin: String(plan.plannedDurationMin), deviationReason: '' });
  const complete = useMutation({
    mutationFn: () => api.post(`/session-plans/${plan.id}/complete`, { actualDurationMin: Number(f.actualDurationMin) || plan.plannedDurationMin, deviationReason: f.deviationReason || undefined }),
    onSuccess: () => { toast.success('Marked delivered'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title={`Deliver — ${plan.topic}`} onClose={onClose} footer={<><button style={ghostBtn()} onClick={onClose}>Cancel</button><button style={{ ...solidBtn(), opacity: complete.isPending ? 0.6 : 1 }} disabled={complete.isPending} onClick={() => complete.mutate()}>Mark delivered</button></>}>
      <div><label style={labelStyle}>Actual duration (minutes)</label><input style={inp} type="number" value={f.actualDurationMin} onChange={(e) => setF((s) => ({ ...s, actualDurationMin: e.target.value }))} /></div>
      <div><label style={labelStyle}>Deviation from plan (optional)</label><textarea style={{ ...inp, height: 'auto', minHeight: 56, padding: '10px 12px', resize: 'vertical' }} value={f.deviationReason} onChange={(e) => setF((s) => ({ ...s, deviationReason: e.target.value }))} placeholder="Ran short — carried the case discussion to the next class." /></div>
    </Modal>
  );
}

function RescheduleModal({ plan, onClose, onDone }: { plan: SessionPlan; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ plannedDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), reason: '' });
  const resched = useMutation({
    mutationFn: () => api.post(`/session-plans/${plan.id}/reschedule`, { plannedDate: f.plannedDate, reason: f.reason || undefined }),
    onSuccess: () => { toast.success('Rescheduled — a successor plan was created'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title={`Reschedule — ${plan.topic}`} onClose={onClose} footer={<><button style={ghostBtn()} onClick={onClose}>Cancel</button><button style={{ ...solidBtn(), opacity: resched.isPending ? 0.6 : 1 }} disabled={resched.isPending} onClick={() => resched.mutate()}>Reschedule</button></>}>
      <div><label style={labelStyle}>New date</label><input style={inp} type="date" value={f.plannedDate} onChange={(e) => setF((s) => ({ ...s, plannedDate: e.target.value }))} /></div>
      <div><label style={labelStyle}>Reason</label><input style={inp} value={f.reason} onChange={(e) => setF((s) => ({ ...s, reason: e.target.value }))} placeholder="Faculty travel / holiday…" /></div>
    </Modal>
  );
}

// ================= Syllabus completion =================
function SyllabusTab() {
  const { data, isLoading } = useQuery({ queryKey: ['syllabus'], queryFn: async () => (await api.get<SyllabusRow[]>('/session-plans/syllabus/completion')).data });
  if (isLoading) return <Empty text="Loading syllabus completion…" />;
  if (!data?.length) return <Empty text="No subjects yet." />;
  const misconfigured = data.filter((r) => !r.hoursConfigured);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!!misconfigured.length && (
        <div style={{ ...panel, borderColor: T.amber, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertTriangle size={16} color={T.amber} />
          <div style={{ fontSize: 12.5, color: T.ink2 }}>{misconfigured.length} subject{misconfigured.length > 1 ? 's have' : ' has'} no total teaching hours configured — hour-based completion cannot be calculated for {misconfigured.map((m) => m.code).join(', ')}. Set hours in Academics → Subjects.</div>
        </div>
      )}
      <div style={{ ...panel, padding: '8px 12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead><tr><th style={th}>Subject</th><th style={th}>Faculty</th><th style={{ ...th, textAlign: 'center' }}>Planned</th><th style={{ ...th, textAlign: 'center' }}>Delivered</th><th style={{ ...th, textAlign: 'center' }}>Pending</th><th style={{ ...th, textAlign: 'center' }}>Overdue</th><th style={th}>Session completion</th><th style={{ ...th, textAlign: 'center' }}>Hours</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.subjectId}>
                <td style={td}><b>{r.code}</b> {r.name}{r.delayed && <span style={{ ...badge(STATUS_TONE.RESCHEDULED), marginLeft: 8 }}>delayed</span>}</td>
                <td style={{ ...td, color: T.ink2 }}>{r.faculty ?? <span style={{ color: T.ink3 }}>unassigned</span>}</td>
                <td style={{ ...td, textAlign: 'center' }}>{r.planned}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{r.completed}</td>
                <td style={{ ...td, textAlign: 'center' }}>{r.pending}</td>
                <td style={{ ...td, textAlign: 'center', color: r.overdue ? T.dangerText : undefined }}>{r.overdue || '—'}</td>
                <td style={{ ...td, minWidth: 170 }}>
                  {r.completionPct === null ? <span style={{ color: T.ink3, fontSize: 12 }}>no sessions planned</span> : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 7, background: '#eef0f2', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${r.completionPct}%`, height: '100%', background: r.completionPct >= 80 ? T.success : r.completionPct >= 50 ? T.amber : brand }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 42 }}>{r.completionPct}%</span>
                    </div>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {r.hoursConfigured ? <span style={{ fontWeight: 600 }}>{r.hoursDeliveredPct}%<span style={{ color: T.ink3, fontWeight: 400, fontSize: 11 }}> of {r.totalHours}h</span></span> : <span title={r.warning ?? ''} style={{ color: T.amber, fontSize: 12 }}>not configured</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= Faculty performance =================
function FacultyTab() {
  const { data, isLoading } = useQuery({ queryKey: ['obe-faculty'], queryFn: async () => (await api.get<FacultyPerf[]>('/obe/analytics/faculty')).data });
  if (isLoading) return <Empty text="Scoring faculty…" />;
  if (!data?.length) return <Empty text="No active faculty yet." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: T.ink3 }}>
        Effectiveness = 40% delivery rate + 30% student rating + 30% class attendance, renormalised when a component has no data yet.
      </div>
      <div style={{ ...panel, padding: '8px 12px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr><th style={th}>Faculty</th><th style={{ ...th, textAlign: 'center' }}>Planned</th><th style={{ ...th, textAlign: 'center' }}>Delivered</th><th style={{ ...th, textAlign: 'center' }}>Delivery rate</th><th style={{ ...th, textAlign: 'center' }}>Student rating</th><th style={{ ...th, textAlign: 'center' }}>Class attendance</th><th style={{ ...th, textAlign: 'center' }}>Effectiveness</th></tr></thead>
          <tbody>
            {data.map((f) => (
              <tr key={f.facultyId}>
                <td style={td}><div style={{ fontWeight: 600 }}>{f.name}</div><div style={{ fontSize: 11, color: T.ink3 }}>{f.department ?? ''}</div></td>
                <td style={{ ...td, textAlign: 'center' }}>{f.sessionsPlanned}</td>
                <td style={{ ...td, textAlign: 'center' }}>{f.sessionsDelivered}</td>
                <td style={{ ...td, textAlign: 'center' }}>{f.deliveryRatePct !== null ? `${f.deliveryRatePct}%` : <Na />}</td>
                <td style={{ ...td, textAlign: 'center' }}>{f.avgRating !== null ? `${f.avgRating} / 5 (${f.ratings})` : <Na />}</td>
                <td style={{ ...td, textAlign: 'center' }}>{f.classAttendancePct !== null ? `${f.classAttendancePct}%` : <Na />}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: f.effectivenessPct === null ? T.ink3 : f.effectivenessPct >= 75 ? T.success : f.effectivenessPct >= 50 ? T.amberDeep : T.dangerText }}>
                  {f.effectivenessPct !== null ? `${f.effectivenessPct}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Na() { return <span style={{ color: T.ink3, fontSize: 12 }}>no data</span>; }

// ================= Weak students =================
function WeakTab() {
  const { data: terms } = useQuery({ queryKey: ['acad-terms'], queryFn: async () => (await api.get<Term[]>('/academics/terms')).data });
  const [termId, setTermId] = useState('');
  useEffect(() => { if (!termId && terms?.length) setTermId(terms.find((t) => t.isCurrent)?.id ?? terms[0].id); }, [terms, termId]);
  const { data, isLoading } = useQuery({
    queryKey: ['obe-weak', termId], enabled: !!termId,
    queryFn: async () => (await api.get<WeakStudent[]>('/obe/analytics/weak-students', { params: { termId } })).data,
  });
  const { data: subjectPerf } = useQuery({
    queryKey: ['obe-subject-perf', termId], enabled: !!termId,
    queryFn: async () => (await api.get<SubjectPerf[]>('/obe/analytics/subjects', { params: { termId } })).data,
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <select style={{ ...inp, height: 40, width: 190, cursor: 'pointer' }} value={termId} onChange={(e) => setTermId(e.target.value)}>{(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? ' (current)' : ''}</option>)}</select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ ...panel, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Students needing attention</div>
          <div style={{ fontSize: 12, color: T.ink3, marginBottom: 12 }}>Flagged for average outcome score below 50% or attendance below 75% — with the reason, never just a flag.</div>
          {isLoading && <div style={{ padding: 16, color: T.ink3, fontSize: 13 }}>Analysing…</div>}
          {!isLoading && !data?.length && <div style={{ padding: 16, color: T.success, fontSize: 13 }}>No students currently flagged. ✓</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data ?? []).map((s) => (
              <div key={s.studentId} style={{ background: T.bg, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</span> <span style={{ fontSize: 11.5, color: T.ink3 }}>{s.admissionNo}{s.batch ? ` · ${s.batch}` : ''}</span></div>
                  {s.avgCoPct !== undefined && <span style={badge({ bg: T.dangerBg, fg: T.dangerText })}>CO {s.avgCoPct}%</span>}
                  {s.attendancePct !== undefined && <span style={badge(STATUS_TONE.RESCHEDULED)}>Att {s.attendancePct}%</span>}
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: T.ink2 }}>{s.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...panel, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Subject pass rates</div>
          {!subjectPerf?.filter((s) => s.students > 0).length && <div style={{ fontSize: 13, color: T.ink3 }}>No marks entered for this term yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(subjectPerf ?? []).filter((s) => s.students > 0).map((s) => (
              <div key={s.subjectId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 90, fontSize: 12.5, fontWeight: 600 }}>{s.code}</div>
                <div style={{ flex: 1, height: 7, background: '#eef0f2', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${s.passPct ?? 0}%`, height: '100%', background: (s.passPct ?? 0) >= 80 ? T.success : (s.passPct ?? 0) >= 50 ? T.amber : T.dangerText }} />
                </div>
                <div style={{ fontSize: 12, minWidth: 110, textAlign: 'right', color: T.ink2 }}>{s.passed}/{s.students} pass · avg {s.avgPct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
