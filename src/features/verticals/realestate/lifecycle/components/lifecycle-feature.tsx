'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, ShieldCheck, FileCheck2, X, Check, Ban, Unlock, RotateCcw, Printer } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const th: React.CSSProperties = { padding: '10px 10px', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, textAlign: 'left', borderBottom: '1px solid var(--line-soft)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--line-soft)', fontSize: 13 };
function Empty({ text }: { text: string }) { return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>; }

interface OnboardingRow {
  id: string; studentId: string; progress: number; total: number; completedAt: string | null;
  idCardIssued: boolean; uniformIssued: boolean; handbookShared: boolean; codeOfConductAccepted: boolean; orientationAttended: boolean;
  sectionId?: string | null; pfaFacultyId?: string | null;
  student: { admissionNo: string; firstName: string; lastName?: string | null };
}
interface GateReport {
  studentId: string; evaluatedAt: string;
  LMS: GateDecision; ATTENDANCE: GateDecision; EXAM: GateDecision; HALL_TICKET: GateDecision; CERTIFICATE: GateDecision;
}
interface GateDecision { allowed: boolean; reasons: string[]; overridden?: boolean }

const CHECK_ITEMS: [keyof OnboardingRow & string, string][] = [
  ['idCardIssued', 'ID card issued'],
  ['uniformIssued', 'Uniform distributed'],
  ['handbookShared', 'Handbook shared'],
  ['codeOfConductAccepted', 'Code of conduct accepted'],
  ['orientationAttended', 'Orientation attended'],
];
const GATES: (keyof Omit<GateReport, 'studentId' | 'evaluatedAt'>)[] = ['LMS', 'ATTENDANCE', 'EXAM', 'HALL_TICKET', 'CERTIFICATE'];

export function LifecycleFeature() {
  const [tab, setTab] = useState<'onboarding' | 'gate'>('onboarding');
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Onboarding & Access</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          The orientation checklist is the LMS key: every item done → LMS opens. One evaluator decides every gate, and every "no" carries its reasons.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([['onboarding', 'Onboarding', ClipboardCheck], ['gate', 'Access Gate', ShieldCheck]] as const).map(([k, l, Ic]) => (
          <button key={k} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? 'var(--brand,#132376)' : undefined, color: tab === k ? 'var(--brand,#132376)' : undefined }} onClick={() => setTab(k)}><Ic size={14} /> {l}</button>
        ))}
      </div>
      {tab === 'onboarding' && <OnboardingTab />}
      {tab === 'gate' && <GateTab />}
    </div>
  );
}

function OnboardingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['onboarding-list'], queryFn: async () => (await api.get<OnboardingRow[]>('/student-onboarding')).data });
  const [open, setOpen] = useState<OnboardingRow | null>(null);
  if (isLoading) return <Empty text="Loading onboarding…" />;
  if (!data?.length) return <Empty text="No students in onboarding. Records open automatically when an admission is converted." />;
  return (
    <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead><tr><th style={th}>Student</th><th style={th}>Checklist</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}></th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <td style={td}><b>{r.student.admissionNo}</b> {r.student.firstName} {r.student.lastName ?? ''}</td>
              <td style={{ ...td, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 7, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(r.progress / r.total) * 100}%`, height: '100%', background: r.progress === r.total ? 'var(--success,#1e874b)' : 'var(--brand,#132376)' }} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.progress}/{r.total}</span>
                </div>
              </td>
              <td style={td}>
                {r.completedAt
                  ? <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--success,#1e874b)' }}>Completed — LMS open</span>
                  : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--gold,#c67c1e)' }}>In progress — LMS closed</span>}
              </td>
              <td style={{ ...td, textAlign: 'right' }}><button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setOpen(r)}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && <OnboardingDrawer row={open} onClose={() => { setOpen(null); qc.invalidateQueries({ queryKey: ['onboarding-list'] }); }} />}
    </div>
  );
}

function OnboardingDrawer({ row, onClose }: { row: OnboardingRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: fresh, refetch } = useQuery({
    queryKey: ['onboarding', row.studentId],
    queryFn: async () => (await api.get<OnboardingRow>(`/student-onboarding/students/${row.studentId}`)).data,
    initialData: row,
  });
  const patch = useMutation({
    mutationFn: (body: Record<string, boolean>) => api.patch(`/student-onboarding/students/${row.studentId}`, body),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['onboarding-list'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const complete = useMutation({
    mutationFn: () => api.post(`/student-onboarding/students/${row.studentId}/complete`),
    onSuccess: () => { toast.success('Onboarding complete — LMS opened'); refetch(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reopen = useMutation({
    mutationFn: () => api.post(`/student-onboarding/students/${row.studentId}/reopen`, { reason: 'Reopened from onboarding screen' }),
    onSuccess: () => { toast.success('Reopened — LMS closed until completion'); refetch(); },
  });
  const r = fresh ?? row;
  const allDone = CHECK_ITEMS.every(([k]) => (r as any)[k]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{r.student.firstName} {r.student.lastName ?? ''} — orientation</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 14 }}>Ticking every item and completing is what opens the LMS. Nothing else does.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CHECK_ITEMS.map(([key, label]) => {
            const on = (r as any)[key] as boolean;
            return (
              <button key={key} className="btn-secondary" disabled={!!r.completedAt || patch.isPending}
                style={{ justifyContent: 'flex-start', height: 40, borderColor: on ? 'var(--success,#1e874b)' : undefined, color: on ? 'var(--success,#1e874b)' : undefined }}
                onClick={() => patch.mutate({ [key]: !on })}>
                {on ? <Check size={15} /> : <span style={{ width: 15, height: 15, border: '1.5px solid var(--line-soft)', borderRadius: 4, display: 'inline-block' }} />} {label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          {r.completedAt
            ? <button className="btn-secondary" onClick={() => reopen.mutate()}><RotateCcw size={13} /> Reopen</button>
            : <button className="btn-primary" disabled={!allDone || complete.isPending} title={allDone ? '' : 'Every item must be done first'} onClick={() => complete.mutate()}>Complete — open LMS</button>}
        </div>
      </div>
    </div>
  );
}

// ================= Access gate =================
interface StudentLite { id: string; admissionNo: string; firstName: string; lastName?: string | null }

function GateTab() {
  const { data: students } = useQuery({
    queryKey: ['students-lite'],
    queryFn: async () => (await api.get<any>('/students', { params: { limit: 100 } })).data?.data as StudentLite[],
  });
  const [studentId, setStudentId] = useState('');
  useEffect(() => { if (!studentId && students?.length) setStudentId(students[0].id); }, [students, studentId]);
  const qc = useQueryClient();
  const { data: report, isLoading } = useQuery({
    queryKey: ['gate', studentId], enabled: !!studentId,
    queryFn: async () => (await api.get<GateReport>(`/access-gate/students/${studentId}`)).data,
  });
  const [overriding, setOverriding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const override = useMutation({
    mutationFn: (gate: string) => api.post(`/access-gate/students/${studentId}/override`, { gate, reason }),
    onSuccess: () => { toast.success('Override granted (audited)'); setOverriding(null); setReason(''); qc.invalidateQueries({ queryKey: ['gate', studentId] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  if (!students?.length) return <Empty text="No students yet." />;
  return (
    <div>
      <select className="input" style={{ height: 38, width: 300, marginBottom: 12 }} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
        {students.map((s) => <option key={s.id} value={s.id}>{s.admissionNo} · {s.firstName} {s.lastName ?? ''}</option>)}
      </select>
      {isLoading && <Empty text="Evaluating gates…" />}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GATES.map((g) => {
            const d = report[g];
            return (
              <div key={g} style={{ ...card, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {d.allowed ? <Unlock size={18} style={{ color: 'var(--success,#1e874b)', marginTop: 2 }} /> : <Ban size={18} style={{ color: 'var(--danger,#c0392b)', marginTop: 2 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{g.replace('_', ' ')} {d.overridden && <span className="badge" style={{ marginLeft: 6, background: 'var(--surface-2)', color: 'var(--gold,#c67c1e)' }}>overridden</span>}</div>
                  {d.reasons.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)' }}>{d.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
                  {d.allowed && !d.reasons.length && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>No restrictions.</div>}
                  {overriding === g && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input className="input" style={{ flex: 1, height: 34 }} placeholder="Reason (required, audited)…" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <button className="btn-primary" style={{ height: 34, fontSize: 12 }} disabled={!reason.trim() || override.isPending} onClick={() => override.mutate(g)}>Grant</button>
                      <button className="btn-secondary" style={{ height: 34, fontSize: 12 }} onClick={() => { setOverriding(null); setReason(''); }}>Cancel</button>
                    </div>
                  )}
                </div>
                {!d.allowed && overriding !== g && (
                  <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setOverriding(g)}>Override…</button>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Evaluated {new Date(report.evaluatedAt).toLocaleTimeString('en-IN')} — decisions are computed live from onboarding + fees; overrides are the only stored state.</div>
        </div>
      )}
    </div>
  );
}
