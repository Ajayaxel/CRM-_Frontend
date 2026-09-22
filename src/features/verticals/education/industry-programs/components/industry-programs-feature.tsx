'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays, PlayCircle, CheckCircle2, Users, Plus, Download, X, Search,
  MapPin, Clock, ChevronLeft, ChevronRight, CalendarRange, Link2, Smile,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { T, academicYear } from '@/features/verticals/education/institute-dashboard';
import {
  Program, ProgramType, ProgramStatus, ProgramListResponse, ProgramStats,
  TopDepartment, ProgramImpact, TYPE_LABEL,
} from '../industry-programs-client';

/* ------------------------------------------------------------------ tokens */
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius };
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', borderRadius: 12,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, border: '1px solid transparent', whiteSpace: 'nowrap',
};
const primaryBtn: React.CSSProperties = { ...btn, background: T.brand, color: '#fff' };
const outlineBtn: React.CSSProperties = { ...btn, background: T.surface, color: T.ink, border: `1px solid ${T.border}` };
const selectStyle: React.CSSProperties = {
  height: 40, border: `1px solid ${T.border}`, borderRadius: 10, padding: '0 30px 0 12px', fontSize: 13,
  color: T.ink, background: T.surface, fontFamily: T.font, cursor: 'pointer',
  appearance: 'none', backgroundImage: 'linear-gradient(45deg,transparent 50%,#9a9a9a 50%),linear-gradient(135deg,#9a9a9a 50%,transparent 50%)',
  backgroundPosition: 'calc(100% - 15px) 17px,calc(100% - 10px) 17px', backgroundSize: '5px 5px,5px 5px', backgroundRepeat: 'no-repeat',
};

const STATUS_TONE: Record<ProgramStatus, { bg: string; fg: string; label: string }> = {
  UPCOMING:  { bg: T.successBg, fg: T.success,   label: 'Upcoming' },
  ONGOING:   { bg: T.amberBg,   fg: T.amberDeep, label: 'Ongoing' },
  COMPLETED: { bg: T.brandSubtle, fg: T.brandText, label: 'Completed' },
  SCHEDULED: { bg: '#f2f2f2',   fg: T.ink3,      label: 'Scheduled' },
};
const TYPE_TONE: Record<ProgramType, string> = { EVENT: T.brandText, WORKSHOP: '#7a5603', INDUSTRY_VISIT: '#5b3e8c' };

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const fmtTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
const fmtDay = (iso?: string | null) => { const d = iso ? new Date(iso) : null; return d ? { m: MONTHS[d.getMonth()], d: d.getDate(), y: d.getFullYear() } : { m: '', d: '', y: '' }; };

type Tab = 'ALL' | ProgramType;
const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All Programs' }, { key: 'EVENT', label: 'Events' },
  { key: 'WORKSHOP', label: 'Workshops' }, { key: 'INDUSTRY_VISIT', label: 'Industry Visits' },
];

/* --------------------------------------------------------------- main view */
export function IndustryProgramsFeature() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('industry.manage');

  const [tab, setTab] = useState<Tab>('ALL');
  const [status, setStatus] = useState('ALL');
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const pageSize = 5;

  const { data: stats } = useQuery({ queryKey: ['ip-stats'], queryFn: async () => (await api.get<ProgramStats>('/industry-programs/stats')).data });
  const { data: highlights } = useQuery({ queryKey: ['ip-highlights'], queryFn: async () => (await api.get<Program[]>('/industry-programs/highlights')).data });
  const { data: topDepts } = useQuery({ queryKey: ['ip-top-depts'], queryFn: async () => (await api.get<TopDepartment[]>('/industry-programs/top-departments')).data });
  const { data: impact } = useQuery({ queryKey: ['ip-impact'], queryFn: async () => (await api.get<ProgramImpact>('/industry-programs/impact')).data });
  const { data: courses } = useQuery({ queryKey: ['courses-lite'], queryFn: async () => (await api.get<{ id: string; name: string }[]>('/courses/lite')).data });

  const params = useMemo(() => ({
    type: tab, status, ...(dept ? { courseId: dept } : {}), ...(q.trim() ? { q: q.trim() } : {}),
    page: String(page), pageSize: String(pageSize),
  }), [tab, status, dept, q, page]);

  const { data: list, isLoading } = useQuery({
    queryKey: ['ip-list', params],
    queryFn: async () => (await api.get<ProgramListResponse>('/industry-programs', { params })).data,
  });

  const resetPage = () => setPage(1);

  const exportCsv = async () => {
    try {
      const res = await api.get('/industry-programs/export', {
        params: { type: tab, status, ...(dept ? { courseId: dept } : {}) }, responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = 'industry-programs.csv'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(apiErrorMessage(e)); }
  };

  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div style={{ animation: 'fadeUp .4s ease', fontFamily: T.font, color: T.ink }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Industry Programs</h1>
          <p style={{ fontSize: 14, color: T.ink2, margin: '6px 0 0' }}>
            Manage and track industry events, workshops, and industry visits happening across the institution.
          </p>
        </div>
        {canManage && <button style={primaryBtn} onClick={() => setShowNew(true)}><Plus size={15} /> Create program</button>}
        <button style={outlineBtn} onClick={exportCsv}><Download size={15} /> Export</button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi label="Upcoming" value={stats?.upcoming} unit="Programs" sub="Next 30 days" icon={<CalendarDays size={17} />} tint={T.amberBg} fg={T.amberDeep} />
        <Kpi label="Ongoing" value={stats?.ongoing} unit="Programs" sub="Live now" icon={<PlayCircle size={17} />} tint={T.brandSubtle} fg={T.brandText} />
        <Kpi label="Completed" value={stats?.completed} unit="Programs" sub="This academic year" icon={<CheckCircle2 size={17} />} tint={T.successBg} fg={T.success} />
        <Kpi label="Total Participants" value={stats?.totalParticipants} sub="Across all programs" icon={<Users size={17} />} tint={T.brandSubtle} fg={T.brandText} big />
      </div>

      {/* tabs + calendar view */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap', borderBottom: `1px solid ${T.border}` }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); resetPage(); }} style={{
            all: 'unset', cursor: 'pointer', padding: '10px 14px', fontSize: 13.5, fontWeight: 600,
            color: tab === t.key ? T.brandText : T.ink2, borderBottom: `2px solid ${tab === t.key ? T.brand : 'transparent'}`, marginBottom: -1,
          }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.ink3 }}>
          <CalendarRange size={14} /> {academicYear()}
        </span>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: T.ink3 }} />
          <input value={q} onChange={(e) => { setQ(e.target.value); resetPage(); }} placeholder="Search programs or speakers…"
            style={{ height: 40, width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 10, padding: '0 12px 0 34px', fontSize: 13, fontFamily: T.font, color: T.ink, background: T.surface }} />
        </div>
        <select style={selectStyle} value={tab} onChange={(e) => { setTab(e.target.value as Tab); resetPage(); }}>
          <option value="ALL">Type · All</option>
          <option value="EVENT">Events</option><option value="WORKSHOP">Workshops</option><option value="INDUSTRY_VISIT">Industry Visits</option>
        </select>
        <select style={selectStyle} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="ALL">Status · All</option>
          <option value="UPCOMING">Upcoming</option><option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option><option value="SCHEDULED">Scheduled</option>
        </select>
        <select style={selectStyle} value={dept} onChange={(e) => { setDept(e.target.value); resetPage(); }}>
          <option value="">Department · All</option>
          {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* body: list + rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }}>
        <div>
          {isLoading ? <Empty text="Loading programs…" />
            : !list?.items.length ? <Empty text="No programs match these filters." />
            : (
              <div style={{ display: 'grid', gap: 12 }}>
                {list.items.map((p) => <ProgramCard key={p.id} p={p} />)}
              </div>
            )}
          {list && list.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
              <span style={{ fontSize: 12.5, color: T.ink3 }}>
                Showing {(list.page - 1) * list.pageSize + 1} to {Math.min(list.page * list.pageSize, list.total)} of {list.total} programs
              </span>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <PagerBtn disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /></PagerBtn>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 6).map((n) => (
                  <button key={n} onClick={() => setPage(n)} style={{
                    all: 'unset', cursor: 'pointer', minWidth: 30, height: 30, borderRadius: 8, textAlign: 'center', lineHeight: '30px',
                    fontSize: 12.5, fontWeight: 600, color: n === page ? '#fff' : T.ink2, background: n === page ? T.brand : 'transparent', border: `1px solid ${n === page ? T.brand : T.border}`,
                  }}>{n}</button>
                ))}
                <PagerBtn disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={15} /></PagerBtn>
              </div>
            </div>
          )}
        </div>

        {/* right rail */}
        <div style={{ display: 'grid', gap: 16 }}>
          <RailCard title="Upcoming Highlights">
            {!highlights?.length ? <RailEmpty text="Nothing upcoming yet." /> : highlights.map((h) => {
              const d = fmtDay(h.startsAt);
              return (
                <div key={h.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: `1px solid ${T.border}` }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <CalendarDays size={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</div>
                    <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>{d.m} {d.d}, {d.y} · {fmtTime(h.startsAt)}</div>
                    {h.venue && <div style={{ fontSize: 11.5, color: T.ink3 }}>{h.venue}</div>}
                  </div>
                </div>
              );
            })}
          </RailCard>

          <RailCard title="Top Departments" subtitle="By participation">
            {!topDepts?.length ? <RailEmpty text="No participation yet." /> : topDepts.map((d, i) => {
              const max = topDepts[0]?.participants || 1;
              return (
                <div key={d.courseId ?? i} style={{ padding: '9px 0', borderTop: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: T.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.department}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{d.participants.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: T.bg, marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((d.participants / max) * 100)}%`, background: T.brand, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </RailCard>

          <RailCard title="Program Impact" subtitle="This year">
            <ImpactRow icon={<Users size={16} />} value={impact?.totalParticipants?.toLocaleString() ?? '—'} label="Total Participants" />
            <ImpactRow icon={<Link2 size={16} />} value={impact?.industryCollaborations?.toLocaleString() ?? '—'} label="Industry Collaborations" />
            <ImpactRow icon={<Smile size={16} />} value={impact?.studentSatisfaction != null ? `${impact.studentSatisfaction}%` : 'No ratings yet'} label="Student Satisfaction" muted={impact?.studentSatisfaction == null} />
          </RailCard>
        </div>
      </div>

      {showNew && <CreateModal courses={courses ?? []} onClose={() => setShowNew(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */
function Kpi({ label, value, unit, sub, icon, tint, fg, big }: { label: string; value?: number; unit?: string; sub: string; icon: React.ReactNode; tint: string; fg: string; big?: boolean }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 13, color: T.ink2, flex: 1 }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: tint, color: fg, display: 'grid', placeItems: 'center' }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
        <span style={{ fontSize: big ? 30 : 30, fontWeight: 800, letterSpacing: '-.02em', color: T.ink }}>
          {value == null ? '—' : value.toLocaleString()}
        </span>
        {unit && <span style={{ fontSize: 13, color: T.ink3 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 12, color: T.ink3, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function ProgramCard({ p }: { p: Program }) {
  const d = fmtDay(p.startsAt);
  const tone = STATUS_TONE[p.status];
  const isVisit = p.type === 'INDUSTRY_VISIT';
  return (
    <div style={{ ...card, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 78, flexShrink: 0, background: T.bg, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 0' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.brandText, letterSpacing: '.04em' }}>{d.m}</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>{d.d}</span>
        <span style={{ fontSize: 11, color: T.ink3 }}>{d.y}</span>
      </div>
      <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', color: TYPE_TONE[p.type], background: T.bg, border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 6 }}>
            {TYPE_LABEL[p.type].toUpperCase()}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', background: tone.bg, color: tone.fg, padding: '3px 9px', borderRadius: 999 }}>
            {tone.label.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{p.title}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: T.ink3, marginTop: 5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> {fmtTime(p.startsAt)}{p.endsAt ? ` – ${fmtTime(p.endsAt)}` : ''}</span>
          {p.venue && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> {p.venue}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          {isVisit ? (
            <Field label="Department" value={p.department ?? '—'} />
          ) : (
            <Field label="Speaker" value={p.speakerName ?? '—'} sub={p.speakerAffiliation ?? undefined} />
          )}
          {isVisit ? <Field label="Participants" value={`${p.participants}`} sub="Students" /> : <Field label="Department" value={p.department ?? '—'} />}
          {isVisit ? <Field label="Faculty in-charge" value={p.facultyInCharge ?? '—'} /> : <Field label="Participants" value={`${p.participants}`} sub="Registered" />}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.ink3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}

function RailCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, flex: 1 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11.5, color: T.ink3 }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
function RailEmpty({ text }: { text: string }) { return <div style={{ fontSize: 12.5, color: T.ink3, padding: '10px 0' }}>{text}</div>; }
function ImpactRow({ icon, value, label, muted }: { icon: React.ReactNode; value: string; label: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${T.border}` }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: muted ? 13 : 17, fontWeight: muted ? 500 : 800, color: muted ? T.ink3 : T.ink }}>{value}</div>
        <div style={{ fontSize: 11.5, color: T.ink3 }}>{label}</div>
      </div>
    </div>
  );
}
function PagerBtn({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button disabled={disabled} onClick={onClick} style={{ all: 'unset', cursor: disabled ? 'default' : 'pointer', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: disabled ? T.ink3 : T.ink2, border: `1px solid ${T.border}`, opacity: disabled ? 0.5 : 1 }}>{children}</button>;
}
function Empty({ text }: { text: string }) { return <div style={{ ...card, padding: 40, textAlign: 'center', color: T.ink3, fontSize: 13.5 }}>{text}</div>; }

function CreateModal({ courses, onClose }: { courses: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: faculty } = useQuery({ queryKey: ['faculty'], queryFn: async () => (await api.get<{ id: string; name: string }[]>('/faculty')).data.map((f: any) => ({ id: f.id, name: f.name })) });
  const [f, setF] = useState({ type: 'EVENT' as ProgramType, title: '', startsAt: '', endsAt: '', venue: '', speakerName: '', speakerAffiliation: '', courseId: '', facultyInChargeId: '', partner: '', participants: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const create = useMutation({
    mutationFn: async () => (await api.post('/industry-programs', {
      ...f, participants: f.participants ? Number(f.participants) : 0,
      courseId: f.courseId || undefined, facultyInChargeId: f.facultyInChargeId || undefined, endsAt: f.endsAt || undefined,
    })).data,
    onSuccess: () => {
      toast.success('Program created');
      ['ip-list', 'ip-stats', 'ip-highlights', 'ip-top-depts', 'ip-impact'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const isVisit = f.type === 'INDUSTRY_VISIT';
  const inp: React.CSSProperties = { height: 40, width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 10, padding: '0 12px', fontSize: 13.5, fontFamily: T.font, color: T.ink, background: T.surface };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,34,49,.34)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: T.shadow, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>Create program</h2>
          <button style={{ ...outlineBtn, height: 34, width: 34, padding: 0, justifyContent: 'center' }} onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Type</span>
            <select style={{ ...inp, cursor: 'pointer' }} value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="EVENT">Event</option><option value="WORKSHOP">Workshop</option><option value="INDUSTRY_VISIT">Industry Visit</option>
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Title</span>
            <input style={inp} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. TechTalk: The Future of AI" autoFocus />
          </label>
          <label><span style={lbl}>Starts at</span><input style={inp} type="datetime-local" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></label>
          <label><span style={lbl}>Ends at</span><input style={inp} type="datetime-local" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></label>
          <label><span style={lbl}>Venue</span><input style={inp} value={f.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Auditorium A" /></label>
          <label><span style={lbl}>Department</span>
            <select style={{ ...inp, cursor: 'pointer' }} value={f.courseId} onChange={(e) => set('courseId', e.target.value)}>
              <option value="">Not set</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {!isVisit && <label><span style={lbl}>Speaker</span><input style={inp} value={f.speakerName} onChange={(e) => set('speakerName', e.target.value)} placeholder="Dr. Rohan Mehta" /></label>}
          {!isVisit && <label><span style={lbl}>Affiliation</span><input style={inp} value={f.speakerAffiliation} onChange={(e) => set('speakerAffiliation', e.target.value)} placeholder="AI Lead, Google" /></label>}
          {isVisit && <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Faculty in-charge</span>
            <select style={{ ...inp, cursor: 'pointer' }} value={f.facultyInChargeId} onChange={(e) => set('facultyInChargeId', e.target.value)}>
              <option value="">Not set</option>{(faculty ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select></label>}
          <label><span style={lbl}>Participants</span><input style={inp} type="number" value={f.participants} onChange={(e) => set('participants', e.target.value)} placeholder="0" /></label>
          <label><span style={lbl}>Industry partner</span><input style={inp} value={f.partner} onChange={(e) => set('partner', e.target.value)} placeholder="e.g. Google" /></label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button style={outlineBtn} onClick={onClose}>Cancel</button>
          <button style={primaryBtn} disabled={!f.title.trim() || !f.startsAt || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create program'}
          </button>
        </div>
      </div>
    </div>
  );
}
