'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays, CheckCircle2, XCircle, AlertTriangle, ClipboardCheck, Users, ShieldCheck,
  Download, BellRing, X, User, MapPin,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Section } from '@/features/verticals/education/academics';
import { T } from '@/features/verticals/education/institute-dashboard';
import {
  AttStats, AttStatus, SectionOverview, SessionOpen, TodayResponse,
} from '../attendance-client';

/* ── teal tokens ─────────────────────────────────────────────────────────── */
const brand = T.brand;
const panel: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow };
const inp: React.CSSProperties = { height: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, padding: '0 12px', fontSize: 13, color: T.ink, outline: 'none' };

const STATUS_TONE: Record<AttStatus, { short: string; bg: string; fg: string }> = {
  PRESENT: { short: 'P', bg: T.successBg, fg: T.success },
  LATE: { short: 'L', bg: T.amberBg, fg: T.amberDeep },
  ABSENT: { short: 'A', bg: T.dangerBg, fg: T.dangerText },
  EXCUSED: { short: 'E', bg: '#eef0f2', fg: T.ink2 },
};
const pctColor = (pct: number | null) => (pct == null ? T.ink3 : pct < 75 ? T.dangerText : pct < 85 ? T.amberDeep : T.success);
const todayStr = () => new Date().toISOString().slice(0, 10);

function solidBtn(): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: brand, color: '#fff', whiteSpace: 'nowrap' };
}
function ghostBtn(): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${T.border}`, background: T.surface, color: T.ink, whiteSpace: 'nowrap' };
}
function Empty({ text }: { text: string }) { return <div style={{ ...panel, padding: 44, textAlign: 'center', color: T.ink3, fontSize: 13.5, lineHeight: 1.5 }}>{text}</div>; }

type Tab = 'mark' | 'course' | 'biometric';

export function AttendanceFeature() {
  const [tab, setTab] = useState<Tab>('mark');
  const { data: stats } = useQuery({ queryKey: ['att-stats'], queryFn: async () => (await api.get<AttStats>('/attendance/stats')).data });
  const present = stats?.overallPct;
  const absent = present == null ? null : Math.max(0, 100 - present);

  const tabs = [
    ['mark', 'Mark attendance', ClipboardCheck],
    ['course', 'Course wise', Users],
    ['biometric', 'Biometric', ShieldCheck],
  ] as const;

  return (
    <div style={{ fontFamily: T.font, color: T.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: '-0.2px', margin: 0 }}>Attendance</h1>
        <p style={{ fontSize: 13, lineHeight: '18px', color: T.ink2, margin: '6px 0 0' }}>Mark class attendance from the timetable, track per-student %, and alert on shortage.</p>
      </div>

      {/* KPI row */}
      <div style={{ ...panel, display: 'flex', alignItems: 'stretch', padding: '18px 4px' }}>
        <Kpi icon={<CalendarDays size={16} />} label="Sessions today" value={stats?.todaySessions} />
        <KDiv />
        <Kpi icon={<CheckCircle2 size={16} />} label="Overall present %" value={present} suffix="%" color={T.success} />
        <KDiv />
        <Kpi icon={<XCircle size={16} />} label="Overall absent %" value={absent} suffix="%" color={T.dangerText} />
        <KDiv />
        <Kpi icon={<AlertTriangle size={16} />} label="Below 75%" value={stats?.belowThreshold} color={T.dangerText} />
      </div>

      {/* tabs */}
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

      {tab === 'mark' && <MarkTab />}
      {tab === 'course' && <CourseTab />}
      {tab === 'biometric' && (
        <Empty text="No biometric records yet. Biometric attendance marking is not available on this campus — keep marking sessions manually until the devices are enrolled." />
      )}
    </div>
  );
}

function Kpi({ icon, label, value, suffix, color }: { icon: React.ReactNode; label: string; value?: number | null; suffix?: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '2px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.ink2 }}>
        <span style={{ color: T.iconDefault, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 590 }}>{label}</span>
      </div>
      <div style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-0.4px', marginTop: 10, color: color ?? T.ink }}>
        {value == null ? '—' : `${value}${suffix ?? ''}`}
      </div>
    </div>
  );
}
const KDiv = () => <div style={{ width: 1, background: T.border, flex: '0 0 1px', margin: '6px 0' }} />;

// ============================== Mark attendance ==============================
function MarkTab() {
  const { data: sections } = useQuery({ queryKey: ['acad-sections'], queryFn: async () => (await api.get<Section[]>('/academics/sections')).data });
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(todayStr());
  useEffect(() => { if (!sectionId && sections?.length) setSectionId(sections[0].id); }, [sections, sectionId]);

  const { data, refetch } = useQuery({
    queryKey: ['att-today', sectionId, date], enabled: !!sectionId,
    queryFn: async () => (await api.get<TodayResponse>('/attendance/today', { params: { sectionId, date } })).data,
  });
  const [openEntry, setOpenEntry] = useState<{ timetableEntryId: string } | null>(null);

  if (!sections?.length) return <Empty text="Create a section and timetable first (Academics)." />;
  const classes = data?.classes ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select style={{ ...inp, width: 340, cursor: 'pointer' }} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.batch?.course?.name ? `${s.batch.course.name} · ` : ''}{s.batch?.name} · Sec {s.name}</option>)}
        </select>
        <div style={{ position: 'relative' }}>
          <input type="date" style={{ ...inp, width: 190 }} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {classes.length === 0 && <Empty text="No classes scheduled for this section on this day." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {classes.map((c) => {
          const marked = c.status === 'MARKED';
          return (
            <div key={c.timetableEntryId} style={{ ...panel, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 52, height: 44, borderRadius: 10, background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink2 }}>{c.slot?.startTime ?? '—'}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.subject?.code} · {c.subject?.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.ink3, marginTop: 3, flexWrap: 'wrap' }}>
                  <span>{c.slot?.name}{c.slot ? ` · ${c.slot.startTime}–${c.slot.endTime}` : ''}</span>
                  {c.faculty?.name && <><span>·</span><User size={13} /><span>{c.faculty.name}</span></>}
                  {c.room?.name && <><span>·</span><MapPin size={13} /><span>{c.room.name}</span></>}
                </div>
              </div>
              {marked && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: T.success }}>
                  <CheckCircle2 size={15} /> {c.markedCount} marked
                </span>
              )}
              <button style={solidBtn()} onClick={() => setOpenEntry({ timetableEntryId: c.timetableEntryId })}>{marked ? 'Edit' : 'Mark'}</button>
            </div>
          );
        })}
      </div>
      {openEntry && <MarkModal timetableEntryId={openEntry.timetableEntryId} date={date} onClose={() => setOpenEntry(null)} onDone={() => { setOpenEntry(null); refetch(); }} />}
    </div>
  );
}

function MarkModal({ timetableEntryId, date, onClose, onDone }: { timetableEntryId: string; date: string; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState<SessionOpen | null>(null);
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  useEffect(() => {
    api.post<SessionOpen>('/attendance/sessions', { timetableEntryId, date }).then((r) => {
      setData(r.data);
      const init: Record<string, AttStatus> = {};
      r.data.roster.forEach((s) => { init[s.id] = s.status ?? 'PRESENT'; });
      setMarks(init);
    }).catch((e) => toast.error(apiErrorMessage(e)));
  }, [timetableEntryId, date]);

  const save = useMutation({
    mutationFn: () => api.post(`/attendance/sessions/${data!.session.id}/mark`, { records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['att-stats'] }); qc.invalidateQueries({ queryKey: ['att-overview'] }); qc.invalidateQueries({ queryKey: ['att-today'] }); toast.success('Attendance saved'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const counts = useMemo(() => { const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<AttStatus, number>; Object.values(marks).forEach((s) => c[s]++); return c; }, [marks]);

  return (
    <Overlay title={data ? `${data.class.subject?.code} · ${data.class.section?.name ? `Sec ${data.class.section.name}` : ''} · ${data.session.date}` : 'Loading…'} onClose={onClose}>
      {!data ? <div style={{ padding: 30, textAlign: 'center', color: T.ink3 }}>Loading roster…</div> : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={{ ...ghostBtn(), height: 32 }} onClick={() => setMarks((m) => Object.fromEntries(Object.keys(m).map((k) => [k, 'PRESENT'])) as any)}>All present</button>
            <div style={{ flex: 1 }} />
            {(['PRESENT', 'LATE', 'ABSENT'] as AttStatus[]).map((st) => (
              <span key={st} style={{ fontSize: 11, fontWeight: 700, background: STATUS_TONE[st].bg, color: STATUS_TONE[st].fg, borderRadius: 6, padding: '3px 9px' }}>{STATUS_TONE[st].short} {counts[st]}</span>
            ))}
          </div>
          <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.roster.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.ink3, fontSize: 13 }}>No students enrolled in this section&rsquo;s batch.</div>}
            {data.roster.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 12px' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: T.brandSubtle, color: T.brandText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{s.firstName.slice(0, 1)}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.firstName} {s.lastName ?? ''}</div><div style={{ fontSize: 11, color: T.ink3 }}>{s.admissionNo}</div></div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['PRESENT', 'LATE', 'ABSENT'] as AttStatus[]).map((st) => {
                    const on = marks[s.id] === st; const m = STATUS_TONE[st];
                    return <button key={st} onClick={() => setMarks((x) => ({ ...x, [s.id]: st }))} style={{ width: 34, height: 30, borderRadius: 8, cursor: 'pointer', border: on ? `1px solid ${m.fg}` : `1px solid ${T.border}`, background: on ? m.bg : T.surface, color: on ? m.fg : T.ink3, fontWeight: 700, fontSize: 12.5 }}>{m.short}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button style={ghostBtn()} onClick={onClose}>Cancel</button>
            <button style={{ ...solidBtn(), opacity: save.isPending || data.roster.length === 0 ? 0.6 : 1 }} disabled={save.isPending || data.roster.length === 0} onClick={() => save.mutate()}>Save attendance ({data.roster.length})</button>
          </div>
        </>
      )}
    </Overlay>
  );
}

// ============================== Course wise ==============================
function CourseTab() {
  const qc = useQueryClient();
  const { data: sections } = useQuery({ queryKey: ['acad-sections'], queryFn: async () => (await api.get<Section[]>('/academics/sections')).data });
  const [sectionId, setSectionId] = useState('');
  useEffect(() => { if (!sectionId && sections?.length) setSectionId(sections[0].id); }, [sections, sectionId]);
  const { data } = useQuery({ queryKey: ['att-overview', sectionId], enabled: !!sectionId, queryFn: async () => (await api.get<SectionOverview>(`/attendance/sections/${sectionId}/overview`)).data });

  const runAlerts = useMutation({ mutationFn: () => api.post('/attendance/shortage/run', { threshold: 75 }), onSuccess: (r: any) => { toast.success(`${r.data.alerted} shortage alert(s) sent`); qc.invalidateQueries({ queryKey: ['att-stats'] }); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const exportCsv = async () => {
    try { const res = await api.get('/attendance/export', { params: { sectionId }, responseType: 'blob' }); const url = URL.createObjectURL(res.data as Blob); const a = document.createElement('a'); a.href = url; a.download = 'attendance.csv'; a.click(); URL.revokeObjectURL(url); }
    catch { toast.error('Export failed'); }
  };

  if (!sections?.length) return <Empty text="Create sections and mark attendance first." />;
  const rows = data?.students ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...inp, width: 340, cursor: 'pointer' }} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.batch?.name} · Sec {s.name}</option>)}
        </select>
        <button style={ghostBtn()} onClick={exportCsv}><Download size={15} /> Export CSV</button>
        <button style={{ ...solidBtn(), opacity: runAlerts.isPending ? 0.6 : 1 }} disabled={runAlerts.isPending} onClick={() => runAlerts.mutate()}><BellRing size={15} /> Alert shortage (&lt;75%)</button>
      </div>
      <div style={{ fontSize: 12.5, color: T.ink3 }}>{data?.sessions ?? 0} marked sessions · {rows.length} students</div>
      <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
        {rows.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>{s.admissionNo} · {s.attended}/{s.total} classes</div>
            </div>
            <div style={{ width: 160, height: 8, borderRadius: 99, background: '#eef0f2', overflow: 'hidden' }}><div style={{ width: `${s.pct ?? 0}%`, height: '100%', background: pctColor(s.pct) }} /></div>
            <div style={{ width: 54, textAlign: 'right', fontWeight: 800, fontSize: 15, color: pctColor(s.pct) }}>{s.pct != null ? `${s.pct}%` : '—'}</div>
            {s.pct != null && s.pct < 75 && <span style={{ fontSize: 11, fontWeight: 700, background: T.dangerBg, color: T.dangerText, borderRadius: 6, padding: '3px 9px' }}>Short</span>}
          </div>
        ))}
        {rows.length === 0 && <div style={{ padding: 44, textAlign: 'center', color: T.ink3, fontSize: 13 }}>No attendance recorded yet.</div>}
      </div>
    </div>
  );
}

// ============================== shared ==============================
function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,34,49,.34)' }} onClick={onClose} />
      <div style={{ ...panel, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 16, boxShadow: '0 24px 60px rgba(17,34,49,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
