'use client';

import { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileCheck, Lock, GraduationCap, AlertTriangle, FileDown, Users, CheckCircle2,
  Clock4, ArrowRight, X, ShieldCheck, IndianRupee, FileText, UserCheck,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { T, academicYear } from '@/features/verticals/education/institute-dashboard';

type Status = 'ACTIVATED' | 'READY' | 'BLOCKED' | 'PENDING';
interface JourneyStep { key: string; label: string; supporting: string; completed: number; total: number }
interface CohortRow {
  studentId: string; name: string; admissionNo: string; course: string;
  admission: string; documents: string; finance: string; academic: string; services: string;
  division: string; advisor: string; blocker: string; blockerDetail: string; status: Status;
}
interface Overview {
  total: number;
  kpis: {
    awaiting: { value: number; deltaThisWeek: number };
    documentsPending: { value: number };
    financePending: { value: number };
    readyForActivation: { value: number };
    activated: { value: number };
  };
  tabs: { onboarding: number; activation: number };
  journey: JourneyStep[];
  cohort: CohortRow[];
  attention: number;
  requirements: { label: string; met: boolean; count: number }[];
  outstanding: number;
}

const STATUS_TONE: Record<Status, { bg: string; fg: string }> = {
  ACTIVATED: { bg: T.successBg, fg: T.success },
  READY: { bg: T.brandSubtle, fg: T.brandText },
  BLOCKED: { bg: T.dangerBg, fg: T.dangerText },
  PENDING: { bg: T.amberBg, fg: T.amberDeep },
};

const pct = (c: number, t: number) => (t > 0 ? Math.round((c / t) * 100) : 0);
const goodCell = (v: string) => v !== 'Pending' && !/pending/i.test(v);

function Inner() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const brand = (() => { const c = user?.organization?.primaryColor; return c && c.toLowerCase() !== '#4f46e5' ? c : T.brand; })();
  const [tab, setTab] = useState<'onboarding' | 'activation'>('onboarding');
  const [openRow, setOpenRow] = useState<CohortRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-onboarding-overview'],
    queryFn: async () => (await api.get<Overview>('/student-onboarding/overview')).data,
  });

  const exportReport = () => {
    if (!data) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['Student', 'Admission no', 'Course', 'Admission', 'Documents', 'Finance', 'Academic', 'Services', 'Status'];
    const body = data.cohort.map((c) => [c.name, c.admissionNo, c.course, c.admission, c.documents, c.finance, c.academic, c.services, c.status].map(esc).join(','));
    const csv = [head.map(esc).join(','), ...body].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `student-onboarding-${academicYear()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Onboarding report exported');
  };

  const k = data?.kpis;

  return (
    <div style={{ fontFamily: T.font, color: T.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* page header */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: '-0.2px', margin: 0 }}>Student onboarding</h1>
          <p style={{ fontSize: 13, lineHeight: '18px', color: T.ink2, margin: '6px 0 0' }}>
            {data ? `${data.kpis.awaiting.value} admitted students completing institutional onboarding before activation` : 'Post-admission institutional onboarding and student activation.'}
          </p>
        </div>
        <button onClick={exportReport} style={ghostBtn(brand)}><FileDown size={16} strokeWidth={1.9} /> Export report</button>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Tab active={tab === 'onboarding'} onClick={() => setTab('onboarding')} icon={<FileCheck size={15} />} label="Onboarding" count={data?.tabs.onboarding} brand={brand} />
        <Tab active={tab === 'activation'} onClick={() => setTab('activation')} icon={<ShieldCheck size={15} />} label="Activation gate" count={data?.tabs.activation} brand={brand} />
      </div>

      {/* KPI row */}
      <div style={{ ...panel(), display: 'flex', alignItems: 'stretch', padding: '18px 4px' }}>
        <Kpi icon={<GraduationCap size={16} />} label="Awaiting onboarding" value={k?.awaiting.value}
          delta={k?.awaiting.deltaThisWeek ? `↑ ${k.awaiting.deltaThisWeek}` : ''} deltaTone={T.success} caption="admitted and awaiting activation" />
        <KDiv />
        <Kpi icon={<FileText size={16} />} label="Documents pending" value={k?.documentsPending.value} unit="students"
          caption="incomplete verification" />
        <KDiv />
        <Kpi icon={<IndianRupee size={16} />} label="Finance clearance pending" value={k?.financePending.value} unit="students"
          caption="outstanding admission / fee" />
        <KDiv />
        <Kpi icon={<CheckCircle2 size={16} />} label="Ready for activation" value={k?.readyForActivation.value}
          caption="all mandatory requirements met" />
      </div>

      {isError && <div style={panel()}><Empty text="Couldn’t load onboarding." action={<button onClick={() => refetch()} style={ghostBtn(brand)}>Retry</button>} /></div>}
      {isLoading && <div style={panel()}><Empty text="Loading onboarding…" /></div>}

      {data && tab === 'onboarding' && (
        <>
          <JourneyCard steps={data.journey} activated={data.kpis.activated.value} total={data.total} brand={brand} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
            <CohortCard rows={data.cohort} attention={data.attention} total={data.total} brand={brand} onOpen={setOpenRow} />
            <ActivationCard requirements={data.requirements} outstanding={data.outstanding} total={data.total} activated={data.kpis.activated.value} brand={brand} />
          </div>
        </>
      )}

      {data && tab === 'activation' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: 16, alignItems: 'start' }}>
          <ActivationCard requirements={data.requirements} outstanding={data.outstanding} total={data.total} activated={data.kpis.activated.value} brand={brand} />
          <CohortCard rows={data.cohort} attention={data.attention} total={data.total} brand={brand} onOpen={setOpenRow} title="Students awaiting activation" />
        </div>
      )}

      {openRow && (
        <ActivationDrawer row={openRow} brand={brand} onClose={() => setOpenRow(null)}
          onChanged={() => { qc.invalidateQueries({ queryKey: ['student-onboarding-overview'] }); qc.invalidateQueries({ queryKey: ['institute-nav-summary'] }); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- tabs + kpi

function Tab({ active, onClick, icon, label, count, brand }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number; brand: string;
}) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 10,
      border: `1px solid ${active ? brand : T.border}`, background: active ? T.brandSubtle : T.surface, color: active ? T.brandText : T.ink2,
      fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
      <span style={{ color: active ? brand : T.iconDefault, display: 'inline-flex' }}>{icon}</span>
      {label}
      {count != null && (
        <span style={{ fontSize: 11, fontWeight: 700, background: active ? brand : '#eef0f2', color: active ? '#fff' : T.ink2, borderRadius: 999, padding: '1px 8px' }}>{count}</span>
      )}
    </button>
  );
}

function Kpi({ icon, label, value, unit, delta, deltaTone, caption }: {
  icon: React.ReactNode; label: string; value?: number; unit?: string; delta?: string; deltaTone?: string; caption: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '2px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.ink2 }}>
        <span style={{ color: T.iconDefault, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 590 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 10 }}>
        <span style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-0.4px' }}>{value == null ? '—' : value.toLocaleString('en-IN')}</span>
        {unit && <span style={{ fontSize: 14, fontWeight: 510, color: T.ink2 }}>{unit}</span>}
        {delta && <span style={{ fontSize: 11, fontWeight: 590, color: deltaTone, letterSpacing: '.2px' }}>{delta}</span>}
      </div>
      <div style={{ fontSize: 12, color: T.ink3, marginTop: 8 }}>{caption}</div>
    </div>
  );
}
const KDiv = () => <div style={{ width: 1, background: T.border, flex: '0 0 1px', margin: '6px 0' }} />;

// ---------------------------------------------------------------- journey

function JourneyCard({ steps, activated, total, brand }: { steps: JourneyStep[]; activated: number; total: number; brand: string }) {
  return (
    <div style={panel()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={tile(32)}><UserCheck size={17} color={brand} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>Student activation journey</div>
          <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 2 }}>An admitted student becomes an active institutional student only when every requirement is met — LMS, library and portal are provisioned after activation.</div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        {steps.map((s, i) => {
          const p = pct(s.completed, s.total);
          const last = i === steps.length - 1;
          const done = p >= 100;
          return (
            <div key={s.key} style={{ display: 'flex', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 26px' }}>
                <span style={{ width: 26, height: 26, borderRadius: 99, flex: '0 0 26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, background: done ? brand : T.brandSubtle, color: done ? '#fff' : T.brandText, border: done ? 'none' : `1.5px solid ${brand}` }}>
                  {done ? '✓' : i + 1}
                </span>
                {!last && <span style={{ width: 2, flex: 1, background: T.border, marginTop: 4, marginBottom: 4, minHeight: 30 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: T.ink }}>{s.label}</span>
                  <span style={{ fontSize: 12.5, color: T.ink3, fontVariantNumeric: 'tabular-nums' }}>{s.completed} of {s.total}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <div style={{ flex: 1, height: 8, background: '#eef0f2', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: brand, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink2, width: 38, textAlign: 'right' }}>{p}%</span>
                </div>
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 7 }}>{s.supporting}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cohort

function CohortCard({ rows, attention, total, brand, onOpen, title }: {
  rows: CohortRow[]; attention: number; total: number; brand: string; onOpen: (r: CohortRow) => void; title?: string;
}) {
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 590, letterSpacing: '.04em', color: T.ink3, padding: '0 8px 10px', textTransform: 'uppercase' };
  const td: React.CSSProperties = { padding: '12px 8px', fontSize: 12.5, verticalAlign: 'middle' };
  const cell = (v: string) => <span style={{ color: goodCell(v) ? T.ink : T.amberDeep, fontWeight: goodCell(v) ? 500 : 600 }}>{v}</span>;
  return (
    <div style={panel()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={tile(32)}><Users size={17} color={brand} /></span>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: T.ink }}>{title ?? 'Onboarding cohort'}</span>
        <span style={{ fontSize: 12.5, color: T.ink3 }}>{attention} of {total}</span>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead><tr>
            <th style={th}>Student</th><th style={th}>Admission</th><th style={th}>Documents</th><th style={th}>Finance</th><th style={th}>Academic</th><th style={th}>Services</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Action</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const tone = STATUS_TONE[r.status];
              return (
                <tr key={r.studentId} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: T.ink, fontSize: 13 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>{r.admissionNo} · {r.course}</div>
                  </td>
                  <td style={td}>{cell(r.admission)}</td>
                  <td style={td}>{cell(r.documents)}</td>
                  <td style={td}>{cell(r.finance)}</td>
                  <td style={td}>{cell(r.academic)}</td>
                  <td style={td}>{cell(r.services)}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.02em', background: tone.bg, color: tone.fg, borderRadius: 6, padding: '3px 9px' }}>{r.status}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => onOpen(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'transparent', color: brand, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      {r.status === 'READY' ? 'Activate' : 'Open'} <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8}><Empty text="Every admitted student has been activated — nothing pending." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- activation gate

function ActivationCard({ requirements, outstanding, total, activated, brand }: {
  requirements: { label: string; met: boolean; count: number }[]; outstanding: number; total: number; activated: number; brand: string;
}) {
  return (
    <div style={panel()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={tile(32)}><ShieldCheck size={17} color={brand} /></span>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>Student activation</span>
      </div>
      <p style={{ fontSize: 12.5, color: T.ink3, lineHeight: 1.5, margin: '12px 0 14px' }}>
        A student is activated only when every mandatory institutional requirement is met. The rule is enforced by the system, not by the administrator.
      </p>
      <div>
        {requirements.map((r, i) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
            {r.met ? <CheckCircle2 size={17} color={T.success} /> : <Clock4 size={17} color={T.amber} />}
            <span style={{ flex: 1, fontSize: 13, color: T.ink }}>{r.label}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: r.met ? T.success : T.amberDeep }}>{r.met ? 'Met' : `${r.count}/${total}`}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, background: T.amberBg, borderRadius: 10, padding: '11px 13px', marginTop: 14 }}>
        <AlertTriangle size={16} color={T.amberDeep} style={{ flex: '0 0 16px', marginTop: 1 }} />
        <span style={{ fontSize: 12, color: T.amberDeep, lineHeight: 1.4 }}>
          {outstanding} of {total} students have at least one requirement outstanding.
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.5, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
        On activation the ERP provisions downstream services — student portal, library and any LMS integration. {activated} of {total} activated so far.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- activation drawer

const CHECKS: { key: string; label: string }[] = [
  { key: 'orientationAttended', label: 'Orientation / induction attended' },
  { key: 'codeOfConductAccepted', label: 'Code of conduct accepted' },
  { key: 'idCardIssued', label: 'Student ID card issued' },
  { key: 'uniformIssued', label: 'Uniform / kit issued' },
  { key: 'handbookShared', label: 'Student handbook shared' },
];

function ActivationDrawer({ row, brand, onClose, onChanged }: { row: CohortRow; brand: string; onClose: () => void; onChanged: () => void }) {
  const { data: rec, refetch } = useQuery({
    queryKey: ['onboarding-student', row.studentId],
    queryFn: async () => (await api.get<any>(`/student-onboarding/students/${row.studentId}`)).data,
  });

  const toggle = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) => api.patch(`/student-onboarding/students/${row.studentId}`, { [key]: value }),
    onSuccess: () => { refetch(); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const complete = useMutation({
    mutationFn: () => api.post(`/student-onboarding/students/${row.studentId}/complete`, {}),
    onSuccess: () => { toast.success('Student activated'); refetch(); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reopen = useMutation({
    mutationFn: () => api.post(`/student-onboarding/students/${row.studentId}/reopen`, { reason: 'Reopened from onboarding' }),
    onSuccess: () => { toast.success('Onboarding reopened'); refetch(); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const activated = !!rec?.completedAt;
  const allChecks = rec && CHECKS.every((c) => rec[c.key]);
  const gate: { label: string; ok: boolean }[] = [
    { label: 'Admission confirmed', ok: goodCell(row.admission) },
    { label: `Documents ${row.documents}`, ok: goodCell(row.documents) },
    { label: `Finance ${row.finance.toLowerCase()}`, ok: goodCell(row.finance) },
    { label: `Academic ${row.academic.toLowerCase()}`, ok: goodCell(row.academic) },
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(17,34,49,.34)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 96vw)', height: '100vh', background: T.surface, boxShadow: '-16px 0 48px rgba(17,34,49,.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{row.name}</div>
            <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{row.admissionNo} · {row.course} · {row.division}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.ink3, padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {/* institutional status (read-only, from real records) */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: T.ink3, textTransform: 'uppercase', marginBottom: 8 }}>Institutional status</div>
          {gate.map((g) => (
            <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${T.border}` }}>
              {g.ok ? <CheckCircle2 size={16} color={T.success} /> : <Clock4 size={16} color={T.amber} />}
              <span style={{ flex: 1, fontSize: 13, color: T.ink }}>{g.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: `1px solid ${T.border}`, fontSize: 13 }}>
            <span style={{ color: T.ink3 }}>Advisor</span><span style={{ fontWeight: 600 }}>{row.advisor}</span>
          </div>

          {/* induction & declarations checklist (editable) */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: T.ink3, textTransform: 'uppercase', margin: '18px 0 8px' }}>Induction &amp; declarations</div>
          {CHECKS.map((c) => {
            const on = !!rec?.[c.key];
            return (
              <button key={c.key} onClick={() => toggle.mutate({ key: c.key, value: !on })} disabled={toggle.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '11px 0', borderTop: `1px solid ${T.border}`, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, flex: '0 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? brand : T.surface, border: `1.5px solid ${on ? brand : T.borderStrong}`, color: '#fff' }}>
                  {on && <CheckCircle2 size={14} />}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: T.ink }}>{c.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activated ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.success, fontWeight: 600 }}><ShieldCheck size={16} /> Student is active</div>
              <button onClick={() => reopen.mutate()} disabled={reopen.isPending} style={ghostBtn(brand)}>Reopen onboarding</button>
            </>
          ) : (
            <>
              <button onClick={() => complete.mutate()} disabled={complete.isPending || !allChecks}
                title={allChecks ? '' : 'Every induction & declaration item must be complete first'}
                style={{ ...solidBtn(brand), opacity: allChecks ? 1 : 0.5, cursor: allChecks ? 'pointer' : 'not-allowed' }}>
                <ShieldCheck size={16} /> Activate student
              </button>
              {!allChecks && <div style={{ fontSize: 11.5, color: T.ink3, textAlign: 'center' }}>Activation unlocks only when every mandatory item is complete.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- primitives

function panel(): React.CSSProperties { return { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, boxShadow: T.shadow }; }
function tile(size: number): React.CSSProperties { return { width: size, height: size, flex: `0 0 ${size}px`, borderRadius: 9, background: T.brandSubtle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }; }
function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 13, color: T.ink3, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>{text}{action}</div>;
}
function ghostBtn(brand: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${brand}`, background: T.brandSubtle, color: T.brandText, whiteSpace: 'nowrap' };
}
function solidBtn(brand: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: brand, color: '#fff', whiteSpace: 'nowrap' };
}

export function StudentOnboardingFeature() {
  return (
    <Suspense fallback={<div style={{ color: T.ink3, padding: 24 }}>Loading…</div>}>
      <Inner />
    </Suspense>
  );
}
