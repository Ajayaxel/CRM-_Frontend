'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award, Briefcase, Bus, ChevronRight, Gauge, MessageSquare, Plus,
  Sliders, Users, X, Info,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { JoinButton, MeetingDraft, MeetingFields, MeetingJoin, emptyMeeting, meetingError, meetingPayload } from '@/features/capabilities/meetings';
import {
  BAND_TONE, BoardRow, DEV_KIND_LABEL, DevActivity, DevKind, DevParticipation,
  DevProgram, INTERNSHIP_NEXT, INTERNSHIP_STATUS_LABEL, INTERNSHIP_TONE,
  IndustrialVisit, Internship, InternshipReport, InternshipStatus, MockInterview,
  PARTICIPATION_TONE, Readiness, ReadinessWeights, WEIGHT_LABEL,
  fmtDate, fmtInr, fmtMonth, fullName, requiresScore, scoreText,
} from '../student-success-client';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16,
};

type Tab = 'readiness' | 'programmes' | 'internships' | 'visits' | 'mocks';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'readiness', label: 'Readiness', icon: Gauge },
  { key: 'programmes', label: 'Programmes', icon: Award },
  { key: 'internships', label: 'Internships', icon: Briefcase },
  { key: 'visits', label: 'Industrial visits', icon: Bus },
  { key: 'mocks', label: 'Mock interviews', icon: MessageSquare },
];

export function StudentSuccessFeature() {
  const [tab, setTab] = useState<Tab>('readiness');
  /**
   * Three different keys guard this one screen, because the API guards it with
   * three. Development and industry are separate responsibilities in the BRD
   * and a coordinator may hold one without the other. Hiding a control is
   * courtesy; @RequirePermissions on the route is the control.
   */
  const { hasPermission } = useAuth();
  const canDev = hasPermission('student.development');
  const canIndustry = hasPermission('industry.manage');

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Student success</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          Clubs, challenges and development programmes, internships and industrial visits, mock
          interviews — and the placement readiness score they all feed.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className="btn-secondary"
            style={{
              height: 36, fontSize: 12.5,
              borderColor: tab === key ? 'var(--brand,#132376)' : undefined,
              color: tab === key ? 'var(--brand,#132376)' : undefined,
            }}
            onClick={() => setTab(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'readiness' && <ReadinessTab canManage={canDev} />}
      {tab === 'programmes' && <ProgrammesTab canManage={canDev} />}
      {tab === 'internships' && <InternshipsTab canManage={canIndustry} />}
      {tab === 'visits' && <VisitsTab canManage={canIndustry} />}
      {tab === 'mocks' && <MocksTab canManage={canDev} />}
    </div>
  );
}

// ---------------------------------------------------------------- shared

function Empty({ text }: { text: string }) {
  return <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>;
}

function Pill({ text, tone }: { text: string; tone: { bg: string; fg: string } }) {
  return (
    <span style={{ background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>
      {text}
    </span>
  );
}

/**
 * A student picker. Every write on this screen starts by naming a student.
 *
 * Searchable, not a dump of the roll. `/students` caps `limit` at 100
 * (PaginationDto) and REJECTS anything larger with a 400 — so a picker that
 * asks for 500 does not return 500 students, it returns none, silently, and
 * looks like an institute with no students. Searching server-side is also the
 * only thing that still works at four figures.
 */
function StudentPicker({ value, onChange, placeholder = 'Select student…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['students-lite', search],
    queryFn: async () =>
      (await api.get<any>('/students', { params: { limit: 100, ...(search.trim() ? { search: search.trim() } : {}) } })).data?.data ?? [],
  });
  const rows = data ?? [];
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <input
        className="input" style={{ height: 34, width: 130 }} placeholder="Search…"
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <select className="input" style={{ height: 34, minWidth: 210 }} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{rows.length ? placeholder : 'No students match'}</option>
        {rows.map((s: any) => (
          <option key={s.id} value={s.id}>{s.admissionNo} · {s.firstName} {s.lastName ?? ''}</option>
        ))}
      </select>
    </span>
  );
}

// ---------------------------------------------------------------- readiness

function ReadinessTab({ canManage }: { canManage: boolean }) {
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);

  const { data: board, isLoading } = useQuery({
    queryKey: ['readiness-board'],
    queryFn: async () => (await api.get<BoardRow[]>('/student-success/readiness-board')).data,
  });

  const scored = (board ?? []).filter((r) => r.score !== null);
  const mean = scored.length
    ? Math.round((scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) * 10) / 10
    : null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        <Stat label="On the board" value={board?.length ?? 0} />
        <Stat label="Scored" value={scored.length} />
        {/* Unscored is not "zero readiness" — it is "nothing measured yet". */}
        <Stat label="Not yet scored" value={(board?.length ?? 0) - scored.length} accent="var(--ink-3)" />
        <Stat label="Cohort mean" value={mean === null ? '—' : mean} accent="var(--brand,#132376)" />
      </div>

      {canManage && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => setShowWeights(!showWeights)}>
            <Sliders size={14} /> {showWeights ? 'Hide weights' : 'Readiness weights'}
          </button>
        </div>
      )}
      {showWeights && canManage && <WeightsEditor onDone={() => setShowWeights(false)} />}

      {isLoading ? <Empty text="Scoring the cohort…" />
        : !board?.length ? <Empty text="Nobody is enrolled yet. The readiness board scores enrolled students." />
        : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {board.map((r, i) => (
              <div key={r.studentId}>
                <button
                  onClick={() => setOpenStudent(openStudent === r.studentId ? null : r.studentId)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                    borderTop: i ? '1px solid var(--line-soft)' : undefined, background: 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  }}
                >
                  <span style={{ width: 26, color: 'var(--ink-4,#9aa1ab)', fontSize: 12 }}>{i + 1}</span>
                  <span style={{ width: 130, fontWeight: 600 }}>{r.admissionNo}</span>
                  <span style={{ flex: 1 }}>{r.name}</span>
                  {r.excludedCount > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--ink-4,#9aa1ab)' }}>
                      {r.excludedCount} not counted
                    </span>
                  )}
                  {r.band && <Pill text={r.band} tone={BAND_TONE[r.band] ?? BAND_TONE.Ready} />}
                  <span style={{ width: 60, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.score === null ? 'var(--ink-4,#9aa1ab)' : undefined }}>
                    {scoreText(r.score)}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--ink-4,#9aa1ab)', transform: openStudent === r.studentId ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                </button>
                {openStudent === r.studentId && <ReadinessBreakdown studentId={r.studentId} />}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
    </div>
  );
}

/**
 * The number, and why it is that number.
 *
 * The API returns which components counted, what each was worth, and a
 * sentence for each one that did not. A readiness score a student cannot be
 * told the reason for is not usable in a placement conversation, so all of it
 * is rendered — including the exclusions, which are the actionable half.
 */
function ReadinessBreakdown({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['readiness', studentId],
    queryFn: async () => (await api.get<Readiness>(`/student-success/students/${studentId}/readiness`)).data,
  });
  if (isLoading) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>Working out the score…</div>;
  if (!data) return null;

  const countedWeight = data.components.filter((c) => c.counted).reduce((a, c) => a + c.weight, 0);

  return (
    <div style={{ padding: '4px 16px 16px', background: 'var(--surface-2,#fafbfc)' }}>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {data.components.map((c) => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, opacity: c.counted ? 1 : 0.55 }}>
            <span style={{ width: 150 }}>{c.label}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
              {c.counted && (
                <div style={{ width: `${Math.min(100, c.value ?? 0)}%`, height: '100%', background: 'var(--brand,#132376)' }} />
              )}
            </div>
            <span style={{ width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {c.counted ? c.value : '—'}
            </span>
            {/*
              The weight shown is the RENORMALISED one when components are
              excluded, because that is the weight that actually applied. Showing
              the configured 25 next to a score built from 80 points of weight
              would not add up on screen.
            */}
            <span style={{ width: 62, textAlign: 'right', fontSize: 11, color: 'var(--ink-3)' }}>
              {c.counted && countedWeight > 0 ? `${Math.round((c.weight / countedWeight) * 100)}%` : `${c.weight}%`}
            </span>
            <span style={{ flex: 1.2, fontSize: 11, color: 'var(--ink-3)' }}>{c.note}</span>
          </div>
        ))}
      </div>

      {data.excluded.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-2)', background: 'var(--info-bg,#e8f0fe)', borderRadius: 8, padding: '8px 10px' }}>
          <Info size={12} style={{ verticalAlign: -2 }} />{' '}
          Not counted, so the remaining weights were renormalised — this student is not being
          scored as if they failed these: {data.excluded.join(' · ')}
        </div>
      )}
    </div>
  );
}

function WeightsEditor({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['readiness-weights'],
    queryFn: async () => (await api.get<ReadinessWeights>('/student-success/readiness-weights')).data,
  });
  const [draft, setDraft] = useState<Partial<ReadinessWeights>>({});
  const current = { ...(data ?? {} as ReadinessWeights), ...draft } as ReadinessWeights;
  const total = Object.values(current).reduce((a, n) => a + (Number(n) || 0), 0);

  const save = useMutation({
    mutationFn: async () => (await api.post('/student-success/readiness-weights', current)).data,
    onSuccess: () => {
      toast.success('Weights saved');
      qc.invalidateQueries({ queryKey: ['readiness-weights'] });
      qc.invalidateQueries({ queryKey: ['readiness-board'] });
      qc.invalidateQueries({ queryKey: ['readiness'] });
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!data) return null;
  return (
    <div style={{ ...card, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 10 }}>
        What readiness is made of. These do not have to sum to 100 — a component with no data is
        excluded and the rest are renormalised, so the ratio between them is what matters.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {(Object.keys(WEIGHT_LABEL) as (keyof ReadinessWeights)[]).map((k) => (
          <div key={k}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>{WEIGHT_LABEL[k]}</div>
            <input
              className="input" style={{ height: 32, width: 90 }} inputMode="numeric"
              value={current[k] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) || 0 }))}
            />
          </div>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ink-3)', paddingBottom: 8 }}>sums to {total}</span>
        <button className="btn-primary" style={{ height: 32, fontSize: 12 }} disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save weights'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- programmes

function ProgrammesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<DevKind>('SRC');
  const [name, setName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['dev-programs'],
    queryFn: async () => (await api.get<DevProgram[]>('/student-success/programs')).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/student-success/programs', { kind, name: name.trim() })).data,
    onSuccess: () => { toast.success('Programme created'); setName(''); setAdding(false); qc.invalidateQueries({ queryKey: ['dev-programs'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      {canManage && (
        <div style={{ marginBottom: 12 }}>
          {!adding ? (
            <button className="btn-primary" style={{ height: 36, fontSize: 12.5 }} onClick={() => setAdding(true)}>
              <Plus size={14} /> New programme
            </button>
          ) : (
            <div style={{ ...card, padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="input" style={{ height: 34, width: 200 }} value={kind} onChange={(e) => setKind(e.target.value as DevKind)}>
                {(Object.keys(DEV_KIND_LABEL) as DevKind[]).map((k) => <option key={k} value={k}>{DEV_KIND_LABEL[k]}</option>)}
              </select>
              <input className="input" style={{ height: 34, width: 260 }} placeholder="Programme name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
              <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => setAdding(false)}><X size={14} /></button>
            </div>
          )}
        </div>
      )}

      {isLoading ? <Empty text="Loading programmes…" />
        : !data?.length ? <Empty text="No programmes yet. A programme is a club, a management challenge or a development programme; activities hang off it." />
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.map((p) => (
              <div key={p.id} style={card}>
                <button
                  onClick={() => setOpen(open === p.id ? null : p.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {DEV_KIND_LABEL[p.kind]} · {p._count?.activities ?? 0} activities · {p._count?.members ?? 0} members
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--ink-4,#9aa1ab)', transform: open === p.id ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                </button>
                {open === p.id && <ProgrammePanel program={p} canManage={canManage} />}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function ProgrammePanel({ program, canManage }: { program: DevProgram; canManage: boolean }) {
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [maxPoints, setMaxPoints] = useState(10);
  const [openActivity, setOpenActivity] = useState<string | null>(null);

  const { data: activities } = useQuery({
    queryKey: ['dev-activities', program.id],
    queryFn: async () => (await api.get<DevActivity[]>('/student-success/activities', { params: { programId: program.id } })).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['dev-activities', program.id] });
    qc.invalidateQueries({ queryKey: ['dev-programs'] });
  };

  const addMember = useMutation({
    mutationFn: async () => (await api.post(`/student-success/programs/${program.id}/members`, { studentId })).data,
    onSuccess: () => { toast.success('Member added'); setStudentId(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addActivity = useMutation({
    mutationFn: async () => (await api.post('/student-success/activities', { programId: program.id, title: title.trim(), maxPoints })).data,
    onSuccess: () => { toast.success('Activity added'); setTitle(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ borderTop: '1px solid var(--line-soft)', padding: 16 }}>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <StudentPicker value={studentId} onChange={setStudentId} placeholder="Add a member…" />
          <button className="btn-secondary" style={{ height: 34, fontSize: 12 }} disabled={!studentId || addMember.isPending} onClick={() => addMember.mutate()}>
            <Users size={13} /> Add member
          </button>
          <div style={{ width: 1, background: 'var(--line-soft)' }} />
          <input className="input" style={{ height: 34, width: 200 }} placeholder="Activity title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" style={{ height: 34, width: 90 }} inputMode="numeric" title="Points a full participation is worth" value={maxPoints} onChange={(e) => setMaxPoints(Number(e.target.value) || 0)} />
          <button className="btn-secondary" style={{ height: 34, fontSize: 12 }} disabled={!title.trim() || addActivity.isPending} onClick={() => addActivity.mutate()}>
            <Plus size={13} /> Add activity
          </button>
        </div>
      )}

      {!activities?.length ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          No activities yet. Points are awarded per activity, so nothing counts towards development
          until one exists and a participation is evaluated.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {activities.map((a) => (
            <div key={a.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {fmtDate(a.scheduledAt)} · worth {a.maxPoints} points · {a._count?.participations ?? 0} registered
                  </div>
                </div>
                <button className="btn-secondary" style={{ height: 30, fontSize: 11.5 }} onClick={() => setOpenActivity(openActivity === a.id ? null : a.id)}>
                  {openActivity === a.id ? 'Close' : 'Participants'}
                </button>
              </div>
              {openActivity === a.id && <ActivityParticipants activity={a} canManage={canManage} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityParticipants({ activity, canManage }: { activity: DevActivity; canManage: boolean }) {
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [points, setPoints] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ['dev-participants', activity.id],
    queryFn: async () => (await api.get<DevParticipation[]>(`/student-success/activities/${activity.id}/participants`)).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['dev-participants', activity.id] });
    qc.invalidateQueries({ queryKey: ['dev-activities', activity.programId] });
    // An evaluation changes the development component of readiness.
    qc.invalidateQueries({ queryKey: ['readiness-board'] });
    qc.invalidateQueries({ queryKey: ['readiness'] });
  };

  const register = useMutation({
    mutationFn: async () => (await api.post(`/student-success/activities/${activity.id}/register`, { studentId })).data,
    onSuccess: () => { toast.success('Registered'); setStudentId(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const evaluate = useMutation({
    mutationFn: async ({ id, pts }: { id: string; pts: number }) =>
      (await api.patch(`/student-success/participations/${id}/evaluate`, { points: pts })).data,
    onSuccess: () => { toast.success('Evaluated'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ marginTop: 10, borderTop: '1px dashed var(--line-soft)', paddingTop: 10 }}>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <StudentPicker value={studentId} onChange={setStudentId} placeholder="Register a student…" />
          <button className="btn-secondary" style={{ height: 34, fontSize: 12 }} disabled={!studentId || register.isPending} onClick={() => register.mutate()}>
            Register
          </button>
        </div>
      )}
      {!data?.length ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nobody registered yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {data.map((p) => {
            const draft = points[p.id] ?? (p.points === null ? '' : String(p.points));
            const n = Number(draft);
            const bad = draft !== '' && (!Number.isFinite(n) || n < 0 || n > activity.maxPoints);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                <span style={{ width: 120, fontWeight: 600 }}>{p.student.admissionNo}</span>
                <span style={{ flex: 1 }}>{fullName(p.student)}</span>
                <Pill text={p.status.replace('_', ' ').toLowerCase()} tone={PARTICIPATION_TONE[p.status]} />
                {/*
                  Null points means NOT EVALUATED, which is different from zero
                  points — the scoring service excludes the former and counts
                  the latter. The empty field says so rather than showing 0.
                */}
                <input
                  className="input"
                  style={{ height: 28, width: 80, fontSize: 12, borderColor: bad ? 'var(--danger,#c0392b)' : undefined }}
                  placeholder={`0–${activity.maxPoints}`}
                  disabled={!canManage}
                  value={draft}
                  onChange={(e) => setPoints((d) => ({ ...d, [p.id]: e.target.value }))}
                />
                {canManage && (
                  <button
                    className="btn-secondary" style={{ height: 28, fontSize: 11 }}
                    disabled={draft === '' || bad || evaluate.isPending}
                    onClick={() => evaluate.mutate({ id: p.id, pts: n })}
                  >
                    {p.evaluatedAt ? 'Re-evaluate' : 'Evaluate'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- internships

function InternshipsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [role, setRole] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['internships'],
    queryFn: async () => (await api.get<Internship[]>('/student-success/internships')).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/student-success/internships', { studentId, role: role.trim() || undefined })).data,
    onSuccess: () => { toast.success('Internship recorded'); setStudentId(''); setRole(''); setAdding(false); qc.invalidateQueries({ queryKey: ['internships'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      {canManage && (
        <div style={{ marginBottom: 12 }}>
          {!adding ? (
            <button className="btn-primary" style={{ height: 36, fontSize: 12.5 }} onClick={() => setAdding(true)}>
              <Plus size={14} /> New internship
            </button>
          ) : (
            <div style={{ ...card, padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StudentPicker value={studentId} onChange={setStudentId} />
              <input className="input" style={{ height: 34, width: 220 }} placeholder="Role (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
              <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={!studentId || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? 'Recording…' : 'Record'}
              </button>
              <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => setAdding(false)}><X size={14} /></button>
            </div>
          )}
        </div>
      )}

      {isLoading ? <Empty text="Loading internships…" />
        : !data?.length ? <Empty text="No internships recorded. A new internship starts at Eligible, or Allocated once a company is named." />
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.map((i) => (
              <div key={i.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {i.student.admissionNo} · {fullName(i.student)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {i.company?.name ?? 'No company yet'}
                      {i.role ? ` · ${i.role}` : ''}
                      {i.startDate ? ` · ${fmtDate(i.startDate)} → ${fmtDate(i.endDate)}` : ''}
                      {i.stipendInr ? ` · ${fmtInr(i.stipendInr)}` : ''}
                      {` · ${i._count?.reports ?? 0} monthly reports`}
                    </div>
                  </div>
                  {i.finalScore !== null && i.finalScore !== undefined && (
                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{i.finalScore}/100</span>
                  )}
                  <Pill text={INTERNSHIP_STATUS_LABEL[i.status]} tone={INTERNSHIP_TONE[i.status]} />
                  <button className="btn-secondary" style={{ height: 30, fontSize: 11.5 }} onClick={() => setOpen(open === i.id ? null : i.id)}>
                    {open === i.id ? 'Close' : 'Open'}
                  </button>
                </div>
                {open === i.id && <InternshipPanel internship={i} canManage={canManage} />}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function InternshipPanel({ internship, canManage }: { internship: Internship; canManage: boolean }) {
  const qc = useQueryClient();
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const [month, setMonth] = useState('');
  const [summary, setSummary] = useState('');

  const { data: reports } = useQuery({
    queryKey: ['internship-reports', internship.id],
    queryFn: async () => (await api.get<InternshipReport[]>(`/student-success/internships/${internship.id}/reports`)).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['internships'] });
    qc.invalidateQueries({ queryKey: ['internship-reports', internship.id] });
    // A completed internship's final score is a readiness input.
    qc.invalidateQueries({ queryKey: ['readiness-board'] });
    qc.invalidateQueries({ queryKey: ['readiness'] });
  };

  const move = useMutation({
    mutationFn: async (to: InternshipStatus) =>
      (await api.patch(`/student-success/internships/${internship.id}/status`, {
        status: to,
        ...(requiresScore(to) ? { finalScore: Number(score) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      })).data,
    onSuccess: () => { toast.success('Status updated'); setScore(''); setNote(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addReport = useMutation({
    mutationFn: async () => (await api.post(`/student-success/internships/${internship.id}/reports`, { month, summary: summary.trim() })).data,
    onSuccess: () => { toast.success('Report added'); setMonth(''); setSummary(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const next = INTERNSHIP_NEXT[internship.status] ?? [];

  return (
    <div style={{ borderTop: '1px solid var(--line-soft)', padding: 16 }}>
      {canManage && (
        next.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>
            {INTERNSHIP_STATUS_LABEL[internship.status]} is a final state — there is nowhere left to move.
            {internship.withdrawnReason ? ` Reason: ${internship.withdrawnReason}` : ''}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            {/*
              Only the transitions the server accepts from here. EVALUATED also
              needs a score, so the field appears with it rather than after a
              rejected request explains the requirement.
            */}
            {next.some(requiresScore) && (
              <input className="input" style={{ height: 32, width: 120 }} inputMode="numeric" placeholder="Score 0–100" value={score} onChange={(e) => setScore(e.target.value)} />
            )}
            <input className="input" style={{ height: 32, width: 200 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            {next.map((to) => {
              const blocked = requiresScore(to) && !(Number(score) >= 0 && Number(score) <= 100 && score !== '');
              return (
                <button
                  key={to} className="btn-secondary" style={{ height: 32, fontSize: 12 }}
                  disabled={blocked || move.isPending}
                  title={blocked ? 'Evaluation needs a score between 0 and 100' : undefined}
                  onClick={() => move.mutate(to)}
                >
                  {INTERNSHIP_STATUS_LABEL[to]}
                </button>
              );
            })}
          </div>
        )
      )}

      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Monthly reports</div>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ height: 32, width: 150 }} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <input className="input" style={{ height: 32, width: 280 }} placeholder="What happened this month" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={!month || !summary.trim() || addReport.isPending} onClick={() => addReport.mutate()}>
            Add report
          </button>
        </div>
      )}
      {!reports?.length ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No reports yet. One per month; a second for the same month is refused.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {reports.map((r) => (
            <div key={r.id} style={{ fontSize: 12.5, borderLeft: '2px solid var(--line-soft)', paddingLeft: 10 }}>
              <strong>{fmtMonth(r.month)}</strong>
              {r.hours ? <span style={{ color: 'var(--ink-3)' }}> · {r.hours}h</span> : null}
              {r.mentorRating ? <span style={{ color: 'var(--ink-3)' }}> · mentor {r.mentorRating}/5</span> : null}
              <div style={{ color: 'var(--ink-2)' }}>{r.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- visits

function VisitsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [visitDate, setVisitDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => (await api.get<IndustrialVisit[]>('/student-success/visits')).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/student-success/visits', {
      title: title.trim(), location: location.trim() || undefined, visitDate: visitDate || undefined,
    })).data,
    onSuccess: () => { toast.success('Visit planned'); setTitle(''); setLocation(''); setVisitDate(''); setAdding(false); qc.invalidateQueries({ queryKey: ['visits'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      {canManage && (
        <div style={{ marginBottom: 12 }}>
          {!adding ? (
            <button className="btn-primary" style={{ height: 36, fontSize: 12.5 }} onClick={() => setAdding(true)}>
              <Plus size={14} /> Plan a visit
            </button>
          ) : (
            <div style={{ ...card, padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input" style={{ height: 34, width: 240 }} placeholder="Visit title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              <input className="input" style={{ height: 34, width: 180 }} placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
              <input className="input" style={{ height: 34, width: 160 }} type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? 'Planning…' : 'Plan'}
              </button>
              <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => setAdding(false)}><X size={14} /></button>
            </div>
          )}
        </div>
      )}

      {isLoading ? <Empty text="Loading visits…" />
        : !data?.length ? <Empty text="No industrial visits planned." />
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.map((v) => (
              <div key={v.id} style={{ ...card, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {v.company?.name ? `${v.company.name} · ` : ''}{v.location ?? 'No location'} · {fmtDate(v.visitDate)} · {v._count?.participants ?? 0} attending
                  </div>
                </div>
                <Pill text={v.status.toLowerCase()} tone={v.status === 'COMPLETED' ? BAND_TONE.Ready : { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' }} />
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------- mocks

function MocksTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  // A mock interview is held in a room, in the app, or on Zoom/Meet/Teams.
  const [meeting, setMeeting] = useState<MeetingDraft>(emptyMeeting());

  const { data, isLoading } = useQuery({
    queryKey: ['mock-interviews'],
    queryFn: async () => (await api.get<MockInterview[]>('/student-success/mock-interviews')).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['mock-interviews'] });
    qc.invalidateQueries({ queryKey: ['readiness-board'] });
    qc.invalidateQueries({ queryKey: ['readiness'] });
  };

  const create = useMutation({
    mutationFn: async () => (await api.post('/student-success/mock-interviews', {
      studentId,
      interviewerName: interviewerName.trim() || undefined,
      venue: meeting.format === 'IN_PERSON' ? (meeting.place.trim() || undefined) : undefined,
      ...meetingPayload(meeting),
    })).data,
    onSuccess: () => { toast.success('Mock interview scheduled'); setStudentId(''); setInterviewerName(''); setMeeting(emptyMeeting()); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const score = useMutation({
    mutationFn: async ({ id, s }: { id: string; s: number }) =>
      (await api.patch(`/student-success/mock-interviews/${id}`, { score: s })).data,
    onSuccess: () => { toast.success('Scored'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      {canManage && (
        <div style={{ ...card, padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <StudentPicker value={studentId} onChange={setStudentId} />
          <input className="input" style={{ height: 34, width: 200 }} placeholder="Interviewer" value={interviewerName} onChange={(e) => setInterviewerName(e.target.value)} />
          <button
            className="btn-primary" style={{ height: 34, fontSize: 12.5 }}
            disabled={!studentId || !!meetingError(meeting) || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus size={14} /> Schedule
          </button>
          <div style={{ width: '100%' }}>
            <MeetingFields value={meeting} onChange={setMeeting} placeLabel="Interview room" />
          </div>
        </div>
      )}

      {isLoading ? <Empty text="Loading mock interviews…" />
        : !data?.length ? <Empty text="No mock interviews yet. A completed interview's score is one of the five readiness inputs." />
        : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {data.map((m, i) => {
              const draft = scores[m.id] ?? (m.score === null || m.score === undefined ? '' : String(m.score));
              const n = Number(draft);
              const bad = draft !== '' && (!Number.isFinite(n) || n < 0 || n > 100);
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderTop: i ? '1px solid var(--line-soft)' : undefined, fontSize: 12.5, flexWrap: 'wrap' }}>
                  <span style={{ width: 120, fontWeight: 600 }}>{m.student.admissionNo}</span>
                  <span style={{ flex: 1, minWidth: 120 }}>{fullName(m.student)}</span>
                  <span style={{ width: 150, color: 'var(--ink-3)', fontSize: 11.5 }}>
                    {m.interviewerName ?? 'No interviewer'} · {fmtDate(m.scheduledAt)}
                  </span>
                  <JoinButton join={(m as MockInterview & { join?: MeetingJoin }).join} size="sm" />
                  <Pill
                    text={m.status.replace('_', ' ').toLowerCase()}
                    tone={m.status === 'COMPLETED' ? BAND_TONE.Ready : { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' }}
                  />
                  <input
                    className="input"
                    style={{ height: 28, width: 84, fontSize: 12, borderColor: bad ? 'var(--danger,#c0392b)' : undefined }}
                    placeholder="0–100" disabled={!canManage} value={draft}
                    onChange={(e) => setScores((d) => ({ ...d, [m.id]: e.target.value }))}
                  />
                  {canManage && (
                    <button
                      className="btn-secondary" style={{ height: 28, fontSize: 11 }}
                      disabled={draft === '' || bad || score.isPending}
                      onClick={() => score.mutate({ id: m.id, s: n })}
                    >
                      {/* Scoring is what marks it COMPLETED — the API infers the status from it. */}
                      {m.score === null || m.score === undefined ? 'Score' : 'Re-score'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
