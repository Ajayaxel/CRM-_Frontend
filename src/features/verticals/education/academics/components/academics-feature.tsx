'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  CalendarClock, BookOpen, LayoutGrid, Building2, Clock, GraduationCap, Plus, X, Trash2,
  Check, Star, DoorOpen, Link2, UserPlus, CalendarRange, SlidersHorizontal, Users,
  ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { T, academicYear as currentAcademicYear } from '@/features/verticals/education/institute-dashboard';
import {
  DAYS, AcademicYear, Term, Subject, Section, Room, TimeSlot, TimetableEntry, Faculty, CourseLite, BatchLite, AcademicsStats,
} from '../academics-client';

/* ------------------------------------------------------------------ tokens */
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius };
const btnP: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, border: 'none', background: T.brand, color: '#fff' };
const btnS: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, background: T.surface, color: T.ink, border: `1px solid ${T.border}` };
const inp: React.CSSProperties = { height: 40, width: '100%', boxSizing: 'border-box', border: `1px solid ${T.border}`, borderRadius: 10, padding: '0 12px', fontSize: 13.5, fontFamily: T.font, color: T.ink, background: T.surface };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 };

const TABS = [
  { key: 'timetable', label: 'Timetable', icon: CalendarClock },
  { key: 'subjects', label: 'Subjects', icon: BookOpen },
  { key: 'sections', label: 'Sections', icon: LayoutGrid },
  { key: 'setup', label: 'Years & Terms', icon: GraduationCap },
  { key: 'rooms', label: 'Rooms & Periods', icon: Building2 },
  { key: 'faculty', label: 'Faculty', icon: GraduationCap },
] as const;

const SETUP_TABS = TABS.filter((t) => t.key !== 'timetable');

export function AcademicsFeature() {
  const [mode, setMode] = useState<'timetable' | 'setup'>('timetable');
  if (mode === 'setup') return <SetupView onBack={() => setMode('timetable')} />;
  return <WeeklyTimetable onManage={() => setMode('setup')} />;
}

/** Master data (subjects, sections, years, rooms, faculty) — kept out of the
 * operational weekly board and reached with "Manage master data". */
function SetupView({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<(typeof SETUP_TABS)[number]['key']>('subjects');
  const { data: stats } = useQuery({ queryKey: ['acad-stats'], queryFn: async () => (await api.get<AcademicsStats>('/academics/stats')).data });
  return (
    <div style={{ animation: 'fadeUp .4s ease', fontFamily: T.font, color: T.ink }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Academic master data</h1>
          <p style={{ fontSize: 14, color: T.ink2, margin: '6px 0 0' }}>Years, subjects, sections, rooms, periods and faculty — the backbone the weekly timetable schedules against.</p>
        </div>
        <button style={btnS} onClick={onBack}><CalendarClock size={14} /> Back to weekly timetable</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        <Stat icon={<BookOpen size={17} />} label="Subjects" value={stats?.subjects ?? 0} />
        <Stat icon={<LayoutGrid size={17} />} label="Sections" value={stats?.sections ?? 0} />
        <Stat icon={<Building2 size={17} />} label="Rooms" value={stats?.rooms ?? 0} />
        <Stat icon={<GraduationCap size={17} />} label="Faculty" value={stats?.faculty ?? 0} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', borderBottom: `1px solid ${T.border}` }}>
        {SETUP_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px',
            fontSize: 13.5, fontWeight: 600, color: tab === t.key ? T.brandText : T.ink2,
            borderBottom: `2px solid ${tab === t.key ? T.brand : 'transparent'}`, marginBottom: -1,
          }}><t.icon size={14} /> {t.label}</button>
        ))}
      </div>
      {tab === 'subjects' && <SubjectsTab />}
      {tab === 'sections' && <SectionsTab />}
      {tab === 'setup' && <SetupTab />}
      {tab === 'rooms' && <RoomsTab />}
      {tab === 'faculty' && <FacultyTab />}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: T.brandSubtle, display: 'grid', placeItems: 'center', color: T.brandText }}>{icon}</div>
      <div><div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div><div style={{ fontSize: 12, color: T.ink3 }}>{label}</div></div>
    </div>
  );
}

// ============================== Timetable ==============================
interface Ctx { termId: string; courseId: string; sectionId: string }

const KIND_TONE: Record<string, { bg: string; br: string; fg: string; label: string }> = {
  REGULAR: { bg: T.surface, br: T.border, fg: T.ink, label: 'Regular' },
  LAB: { bg: '#e6f4ea', br: '#bfe6cf', fg: '#0a5c41', label: 'Lab' },
  TUTORIAL: { bg: T.brandSubtle, br: T.teal100, fg: T.brandText, label: 'Tutorial' },
  EXTRA: { bg: '#fdf3d7', br: '#f0dca6', fg: '#7a5603', label: 'Extra class' },
  REPLACEMENT: { bg: '#fdecdf', br: '#f2cba6', fg: '#b45309', label: 'Replacement' },
};
const CONFLICT_TONE = { bg: T.dangerBg, br: '#eeb4a3', fg: T.dangerText };
const CONFLICT_LABEL: Record<string, string> = { FACULTY: 'Faculty clash', BATCH: 'Batch clash', ROOM: 'Room clash', AVAILABILITY: 'On leave', DUPLICATE: 'Duplicate' };

interface Conflict { id: string; type: string; day: string; slot: string; title: string; detail: string; rule: string; action: string; removableEntryId: string; entries: { id: string; label: string; room: string | null; kind: string }[] }
interface ConflictResp { summary: Record<string, number>; sublines: Record<string, string | null>; conflicts: Conflict[]; flags: Record<string, string> }

function WeeklyTimetable({ onManage }: { onManage: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: sections } = useQuery({ queryKey: ['acad-sections'], queryFn: async () => (await api.get<Section[]>('/academics/sections')).data });
  const { data: terms } = useQuery({ queryKey: ['acad-terms'], queryFn: async () => (await api.get<Term[]>('/academics/terms')).data });
  const { data: courses } = useQuery({ queryKey: ['courses-lite'], queryFn: async () => (await api.get<CourseLite[]>('/courses/lite')).data });
  const { data: slots } = useQuery({ queryKey: ['acad-slots'], queryFn: async () => (await api.get<TimeSlot[]>('/academics/timeslots')).data });
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const { data: faculty } = useQuery({ queryKey: ['faculty'], queryFn: async () => (await api.get<Faculty[]>('/faculty')).data });
  const { data: rooms } = useQuery({ queryKey: ['acad-rooms'], queryFn: async () => (await api.get<Room[]>('/academics/rooms')).data });

  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [picking, setPicking] = useState(true);
  const [view, setView] = useState<'week' | 'day' | 'list'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [cell, setCell] = useState<{ day: number; slot: TimeSlot } | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TimetableEntry | null>(null);

  const { data: entries } = useQuery({
    queryKey: ['acad-timetable', ctx?.sectionId, ctx?.termId], enabled: !!ctx?.sectionId,
    queryFn: async () => (await api.get<TimetableEntry[]>('/academics/timetable', { params: { sectionId: ctx!.sectionId, termId: ctx!.termId || undefined } })).data,
  });
  const { data: conflicts } = useQuery({
    queryKey: ['acad-conflicts', ctx?.termId], enabled: !!ctx,
    queryFn: async () => (await api.get<ConflictResp>('/academics/timetable/conflicts', { params: { termId: ctx!.termId || undefined } })).data,
  });
  const { data: awaiting } = useQuery({ queryKey: ['acad-awaiting'], queryFn: async () => (await api.get<any[]>('/academic-requests/awaiting')).data });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['acad-timetable'] }); qc.invalidateQueries({ queryKey: ['acad-conflicts'] }); qc.invalidateQueries({ queryKey: ['acad-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/academics/timetable/${id}`), onSuccess: () => { refresh(); toast.success('Class removed'); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  const byCell = useMemo(() => { const m = new Map<string, TimetableEntry>(); (entries ?? []).forEach((e) => m.set(`${e.dayOfWeek}:${e.timeSlotId}`, e)); return m; }, [entries]);
  const flags = conflicts?.flags ?? {};

  if (!sections?.length) return <Empty text="Create a section first (master data) to build a timetable." />;
  if (!slots?.length) return <Empty text="Define time periods first (master data)." />;

  const section = sections.find((s) => s.id === ctx?.sectionId);
  const term = terms?.find((t) => t.id === ctx?.termId);
  const course = courses?.find((c) => c.id === ctx?.courseId);
  const weekRange = mondayWeekRange(weekOffset);
  const todayDow = (new Date().getDay() + 6) % 7;
  const shownDays = view === 'day' ? [Math.min(todayDow, 4)] : [0, 1, 2, 3, 4];

  const openModal = (
    <>
      {picking && <SelectTimetableModal terms={terms ?? []} courses={courses ?? []} sections={sections ?? []} initial={ctx} onClose={() => setPicking(false)} onApply={(c) => { setCtx(c); setPicking(false); }} />}
      {(cell || adding) && ctx && (
        <AddClassModal preset={cell ?? undefined} sectionId={ctx.sectionId} termId={ctx.termId} slots={slots ?? []} subjects={subjects ?? []} faculty={(faculty ?? []).filter((f) => f.active)} rooms={rooms ?? []}
          onClose={() => { setCell(null); setAdding(false); }} onDone={() => { setCell(null); setAdding(false); refresh(); }} />
      )}
      {editing && ctx && (
        <EditEntryModal entry={editing} slots={slots ?? []} subjects={subjects ?? []} faculty={(faculty ?? []).filter((f) => f.active)} rooms={rooms ?? []}
          onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh(); }} onDelete={() => { del.mutate(editing.id); setEditing(null); }} />
      )}
    </>
  );

  if (!ctx) return (
    <div style={{ fontFamily: T.font, color: T.ink }}>
      <div style={{ ...card, padding: '56px 28px', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><CalendarClock size={21} /></div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>No timetable selected</div>
        <div style={{ fontSize: 13, color: T.ink3, marginTop: 6 }}>Choose a semester, programme and batch to load its weekly grid.</div>
        <button style={{ ...btnP, margin: '16px auto 0' }} onClick={() => setPicking(true)}>Select timetable</button>
      </div>
      {openModal}
    </div>
  );

  return (
    <div style={{ animation: 'fadeUp .4s ease', fontFamily: T.font, color: T.ink }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Weekly timetable</h1>
          <p style={{ fontSize: 13.5, color: T.ink2, margin: '6px 0 0' }}>
            {term?.name} · {course?.name ?? section?.batch?.course?.name} · Batch {section?.batch?.name} — Division {section?.name} · {weekRange}
          </p>
        </div>
        <button style={btnS} onClick={onManage}>Manage master data</button>
        <button style={btnS} onClick={() => setPicking(true)}><SlidersHorizontal size={14} /> Change selection</button>
        <button style={btnP} onClick={() => setAdding(true)}><Plus size={15} /> Add class</button>
      </div>

      {/* context chips + week nav */}
      <div style={{ ...card, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Chip label="Semester" value={term?.name ?? '—'} />
        <Chip label="Course" value={course?.code ?? course?.name ?? '—'} />
        <Chip label="Batch" value={`${section?.name} — Div ${section?.name}`} />
        <div style={{ flex: 1 }} />
        <button style={iconBtn} onClick={() => setWeekOffset((w) => w - 1)}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 150, textAlign: 'center' }}>{weekRange}</span>
        <button style={iconBtn} onClick={() => setWeekOffset((w) => w + 1)}><ChevronRight size={16} /></button>
        <button style={{ ...pillBtn, ...(weekOffset === 0 ? pillActive : {}) }} onClick={() => setWeekOffset(0)}>Today</button>
        {(['week', 'day', 'list'] as const).map((v) => <button key={v} style={{ ...pillBtn, ...(view === v ? pillActive : {}) }} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
      </div>

      {/* conflict summary */}
      {conflicts && <ConflictSummary c={conflicts} onOpenQueue={() => router.push('/academic-requests')} />}

      {/* grid / day / list */}
      {view === 'list'
        ? <ListView entries={entries ?? []} slots={slots ?? []} flags={flags} onEdit={setEditing} />
        : (
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: view === 'day' ? 320 : 820 }}>
              <thead><tr>
                <th style={thStyle}>Time</th>
                {shownDays.map((d) => <th key={d} style={{ ...thStyle, ...(d === todayDow && weekOffset === 0 ? { color: T.brandText } : {}) }}>{DAYS[d]}</th>)}
              </tr></thead>
              <tbody>
                {(slots ?? []).map((slot) => (
                  <tr key={slot.id}>
                    <td style={{ ...tdStyle, background: T.bg, minWidth: 110 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{slot.name}</div>
                      <div style={{ fontSize: 11, color: T.ink3 }}>{slot.startTime}–{slot.endTime}</div>
                    </td>
                    {shownDays.map((day) => {
                      const e = byCell.get(`${day}:${slot.id}`);
                      const flag = e ? flags[e.id] : undefined;
                      return (
                        <td key={day} style={tdStyle}>
                          {e ? <ClassCard e={e} flag={flag} onClick={() => setEditing(e)} onResolve={() => router.push('/academic-requests')} /> :
                            <button onClick={() => setCell({ day, slot })} style={{ width: '100%', height: 46, border: `1px dashed ${T.border}`, borderRadius: 10, background: 'transparent', cursor: 'pointer', color: T.ink3, display: 'grid', placeItems: 'center' }}><Plus size={14} /></button>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', margin: '10px 2px', fontSize: 11.5, color: T.ink3 }}>
        {Object.entries(KIND_TONE).map(([k, t]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: t.bg, border: `1px solid ${t.br}` }} /> {t.label}</span>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CONFLICT_TONE.bg, border: `1px solid ${CONFLICT_TONE.br}` }} /> Conflict</span>
        <span>· Click a flagged class to open conflict resolution</span>
      </div>

      {/* resolution queue + awaiting */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start', marginTop: 8 }}>
        <ResolutionQueue conflicts={conflicts?.conflicts ?? []} onResolve={(id) => del.mutate(id)} onOpenRequests={() => router.push('/academic-requests')} />
        <AwaitingPanel rows={awaiting ?? []} onOpen={(id) => router.push(`/academic-requests/${id}`)} />
      </div>

      {openModal}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 999, padding: '5px 11px' }}><span style={{ color: T.ink3 }}>{label}</span><strong>{value}</strong></span>;
}
const iconBtn: React.CSSProperties = { all: 'unset', cursor: 'pointer', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', border: `1px solid ${T.border}`, color: T.ink2 };
const pillBtn: React.CSSProperties = { all: 'unset', cursor: 'pointer', height: 30, padding: '0 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: T.ink2, border: `1px solid ${T.border}`, display: 'inline-flex', alignItems: 'center' };
const pillActive: React.CSSProperties = { background: T.brandSubtle, color: T.brandText, borderColor: T.brand };

function ClassCard({ e, flag, onClick, onResolve }: { e: TimetableEntry; flag?: string; onClick: () => void; onResolve: () => void }) {
  const tone = flag ? CONFLICT_TONE : KIND_TONE[(e as any).kind ?? 'REGULAR'] ?? KIND_TONE.REGULAR;
  return (
    <div onClick={onClick} style={{ background: tone.bg, border: `1px solid ${tone.br}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {flag && <AlertTriangle size={12} style={{ color: CONFLICT_TONE.fg, flexShrink: 0 }} />}
        <div style={{ fontWeight: 700, fontSize: 12, color: (tone as any).fg }}>{e.subject?.code}</div>
      </div>
      <div style={{ fontSize: 10.5, color: T.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.faculty?.name}{e.room ? ` · ${e.room.name}` : ''}</div>
      {flag
        ? <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 9.5, fontWeight: 700, color: CONFLICT_TONE.fg, background: '#fff', border: `1px solid ${CONFLICT_TONE.br}`, padding: '1px 6px', borderRadius: 5 }}>{CONFLICT_LABEL[flag]}</span><button onClick={(ev) => { ev.stopPropagation(); onResolve(); }} style={{ all: 'unset', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: CONFLICT_TONE.fg }}>Resolve →</button></div>
        : (e as any).kind && (e as any).kind !== 'REGULAR' ? <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9.5, fontWeight: 700, color: (tone as any).fg, background: '#fff', border: `1px solid ${tone.br}`, padding: '1px 6px', borderRadius: 5 }}>{(KIND_TONE[(e as any).kind] ?? KIND_TONE.REGULAR).label}</span> : null}
    </div>
  );
}

function ConflictSummary({ c, onOpenQueue }: { c: ConflictResp; onOpenQueue: () => void }) {
  const tiles = [
    { key: 'faculty', label: 'Faculty conflict', icon: <Users size={14} /> }, { key: 'batch', label: 'Batch conflict', icon: <LayoutGrid size={14} /> },
    { key: 'room', label: 'Room conflict', icon: <DoorOpen size={14} /> }, { key: 'availability', label: 'Availability', icon: <Clock size={14} /> },
    { key: 'duplicate', label: 'Duplicate entry', icon: <BookOpen size={14} /> },
  ];
  return (
    <div style={{ ...card, padding: 18, marginBottom: 14, borderColor: c.summary.unresolved ? '#eeb4a3' : T.border }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <AlertTriangle size={17} style={{ color: c.summary.unresolved ? T.danger : T.ink3 }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Conflicts in this week</span>
        <span style={{ fontSize: 12.5, color: T.ink3 }}>{c.summary.unresolved} unresolved · validation runs again before any change is applied</span>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenQueue} style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: T.brandText, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Open resolution queue <ChevronRight size={14} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 0 }}>
        {tiles.map((t, i) => {
          const n = c.summary[t.key] ?? 0;
          return (
            <div key={t.key} style={{ padding: '4px 16px', borderLeft: i ? `1px solid ${T.border}` : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.ink2, fontWeight: 600 }}><span style={{ color: n ? T.danger : T.ink3 }}>{t.icon}</span> {t.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: n ? T.danger : T.ink, margin: '2px 0' }}>{n}</div>
              <div style={{ fontSize: 11, color: T.ink3, minHeight: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sublines[t.key] ?? (n ? '' : 'None detected')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResolutionQueue({ conflicts, onResolve, onOpenRequests }: { conflicts: Conflict[]; onResolve: (entryId: string) => void; onOpenRequests: () => void }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Conflict resolution queue</span>
        {conflicts.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, background: T.dangerBg, color: T.dangerText, padding: '2px 8px', borderRadius: 999 }}>{conflicts.length} blocking</span>}
        <div style={{ flex: 1 }} />
        <button onClick={onOpenRequests} style={{ all: 'unset', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: T.brandText }}>Requests →</button>
      </div>
      <p style={{ fontSize: 12, color: T.ink3, margin: '0 0 8px' }}>The system recommends — the authorised administrator decides. Nothing is applied automatically.</p>
      {conflicts.length === 0 ? <div style={{ fontSize: 12.5, color: T.ink3, padding: '10px 0' }}>No conflicts — the timetable is clean.</div> :
        conflicts.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: T.dangerBg, color: T.dangerText, display: 'grid', placeItems: 'center', flexShrink: 0 }}><AlertTriangle size={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.dangerText, background: T.dangerBg, padding: '2px 8px', borderRadius: 999 }}>{CONFLICT_LABEL[c.type]}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 3 }}>{c.detail}</div>
              <div style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>Rule — {c.rule.toLowerCase()}</div>
            </div>
            <button style={{ ...btnP, height: 32, alignSelf: 'center' }} onClick={() => onResolve(c.removableEntryId)}>{c.action === 'REASSIGN' ? 'Reassign' : 'Resolve'}</button>
          </div>
        ))}
    </div>
  );
}

function AwaitingPanel({ rows, onOpen }: { rows: any[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>Awaiting scheduling</div>
      <p style={{ fontSize: 12, color: T.ink3, margin: '2px 0 8px' }}>Academic requests that still need a timetable slot.</p>
      {rows.length === 0 ? <div style={{ fontSize: 12.5, color: T.ink3, padding: '8px 0' }}>Nothing awaiting.</div> :
        rows.map((r) => (
          <div key={r.id} onClick={() => onOpen(r.id)} style={{ padding: '11px 0', borderTop: `1px solid ${T.border}`, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.code}</span>
              <span style={{ fontSize: 10, fontWeight: 700, background: T.bg, border: `1px solid ${T.border}`, color: T.ink2, padding: '2px 7px', borderRadius: 999 }}>{r.status.replace('_', ' ')}</span>
            </div>
            <div style={{ fontSize: 12.5, color: T.ink, marginTop: 3 }}>{r.subject?.name ?? '—'}{r.hoursRequested ? ` · +${r.hoursRequested} h` : ''}</div>
            <div style={{ fontSize: 11, color: T.ink3 }}>{r.completionPct != null ? `${r.completionPct}% complete` : ''}{r.batch ? ` · ${r.batch.name}` : ''}</div>
          </div>
        ))}
    </div>
  );
}

function ListView({ entries, slots, flags, onEdit }: { entries: TimetableEntry[]; slots: TimeSlot[]; flags: Record<string, string>; onEdit: (e: TimetableEntry) => void }) {
  const slotOrder = new Map(slots.map((s, i) => [s.id, i]));
  const sorted = [...entries].sort((a, b) => a.dayOfWeek - b.dayOfWeek || (slotOrder.get(a.timeSlotId)! - slotOrder.get(b.timeSlotId)!));
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {sorted.length === 0 ? <Empty text="No classes scheduled." /> : sorted.map((e, i) => {
        const flag = flags[e.id]; const tone = flag ? CONFLICT_TONE : KIND_TONE[(e as any).kind ?? 'REGULAR'];
        return (
          <div key={e.id} onClick={() => onEdit(e)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.border}` : undefined, cursor: 'pointer' }}>
            <span style={{ width: 6, height: 34, borderRadius: 3, background: tone.br }} />
            <div style={{ width: 130 }}><div style={{ fontWeight: 600, fontSize: 12.5 }}>{DAYS[e.dayOfWeek]}</div><div style={{ fontSize: 11, color: T.ink3 }}>{e.timeSlot?.name} · {e.timeSlot?.startTime}–{e.timeSlot?.endTime}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.subject?.code} · {e.subject?.name}</div><div style={{ fontSize: 11.5, color: T.ink3 }}>{e.faculty?.name}{e.room ? ` · ${e.room.name}` : ''}</div></div>
            {flag && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.dangerText, background: T.dangerBg, padding: '3px 9px', borderRadius: 999 }}>{CONFLICT_LABEL[flag]}</span>}
          </div>
        );
      })}
    </div>
  );
}

function mondayWeekRange(offset: number) {
  const now = new Date(); const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now); mon.setDate(now.getDate() - dow + offset * 7);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${f(mon)} – ${f(sun)} ${sun.getFullYear()}`;
}

/** The Figma "Select the timetable you want" modal — gates the weekly grid. */

/** The Figma "Select the timetable you want" modal — gates the weekly grid. */
function SelectTimetableModal({ terms, courses, sections, initial, onClose, onApply }: {
  terms: Term[]; courses: CourseLite[]; sections: Section[]; initial: Ctx | null; onClose: () => void; onApply: (c: Ctx) => void;
}) {
  const [termId, setTermId] = useState(initial?.termId ?? terms.find((t) => t.isCurrent)?.id ?? '');
  const [courseId, setCourseId] = useState(initial?.courseId ?? '');
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? '');

  // Sections belonging to the chosen programme (course). Reset the batch when the programme changes.
  const courseSections = useMemo(
    () => sections.filter((s) => !courseId || s.batch?.courseId === courseId),
    [sections, courseId],
  );
  useEffect(() => { if (sectionId && !courseSections.some((s) => s.id === sectionId)) setSectionId(''); }, [courseId]); // eslint-disable-line

  const section = sections.find((s) => s.id === sectionId);
  const canApply = !!(termId && courseId && sectionId);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,34,49,.42)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 480, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: T.shadow, padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center', flexShrink: 0 }}><CalendarClock size={19} /></span>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Select the timetable you want</h2>
            <p style={{ fontSize: 13, color: T.ink3, margin: '4px 0 0' }}>Choose the academic context. The weekly grid loads only after all three are selected.</p>
          </div>
        </div>

        {/* academic year — inherited, read-only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <CalendarRange size={15} style={{ color: T.ink3 }} />
          <span style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>Academic year</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{currentAcademicYear()}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: T.ink3 }}>Inherited from the top navigation</span>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <span style={lbl}>Semester <span style={{ color: T.danger }}>*</span></span>
            <select style={{ ...inp, cursor: 'pointer', borderColor: termId ? T.brand : T.border }} value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">Select a semester…</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.academicYear?.name ? ` · ${t.academicYear.name}` : ''}{t.isCurrent ? ' (current)' : ''}</option>)}
            </select>
            <div style={helpStyle}>{terms.length} semester{terms.length === 1 ? '' : 's'} configured for this programme</div>
          </div>

          <div>
            <span style={lbl}>Course / Programme <span style={{ color: T.danger }}>*</span></span>
            <select style={{ ...inp, cursor: 'pointer', borderColor: courseId ? T.brand : T.border }} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Select a programme…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={helpStyle}>Only programmes you administer are listed</div>
          </div>

          <div>
            <span style={lbl}>Batch &amp; Division <span style={{ color: T.danger }}>*</span></span>
            <select style={{ ...inp, cursor: 'pointer', borderColor: sectionId ? T.brand : T.border }} value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!courseId}>
              <option value="">{courseId ? 'Select a batch & division…' : 'Choose a programme first'}</option>
              {courseSections.map((s) => <option key={s.id} value={s.id}>{s.batch?.name} — Section {s.name}</option>)}
            </select>
            <div style={helpStyle}>
              {section
                ? `${typeof section.students === 'number' ? section.students : 0} students${section.capacity ? ` · capacity ${section.capacity}` : ''}`
                : 'Sections are drawn from the selected programme'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
          <span style={{ fontSize: 11.5, color: T.ink3, flex: 1 }}>Conflicts are re-validated each time a timetable is opened.</span>
          <button style={btnS} onClick={onClose}>Cancel</button>
          <button style={{ ...btnP, opacity: canApply ? 1 : 0.5, pointerEvents: canApply ? 'auto' : 'none' }} onClick={() => canApply && onApply({ termId, courseId, sectionId })}>View timetable</button>
        </div>
      </div>
    </div>
  );
}
const helpStyle: React.CSSProperties = { fontSize: 11.5, color: T.ink3, marginTop: 6 };

const thStyle: React.CSSProperties = { padding: '11px 10px', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: T.ink3, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${T.border}` };
const tdStyle: React.CSSProperties = { padding: 8, borderBottom: `1px solid ${T.border}`, verticalAlign: 'top', width: `${100 / 7}%` };

const KIND_OPTS = [['REGULAR', 'Regular'], ['LAB', 'Lab'], ['TUTORIAL', 'Tutorial'], ['EXTRA', 'Extra class'], ['REPLACEMENT', 'Replacement']] as const;

function AddClassModal({ preset, sectionId, termId, slots, subjects, faculty, rooms, onClose, onDone }: {
  preset?: { day: number; slot: TimeSlot }; sectionId: string; termId: string; slots: TimeSlot[]; subjects: Subject[]; faculty: Faculty[]; rooms: Room[]; onClose: () => void; onDone: () => void;
}) {
  const [f, setF] = useState({ subjectId: '', facultyId: '', roomId: '', kind: 'REGULAR', dayOfWeek: preset ? String(preset.day) : '0', timeSlotId: preset?.slot.id ?? (slots[0]?.id ?? '') });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { const s = subjects.find((x) => x.id === f.subjectId); if (s?.facultyId && !f.facultyId) set('facultyId', s.facultyId); }, [f.subjectId]); // eslint-disable-line
  const create = useMutation({
    mutationFn: () => api.post('/academics/timetable', { sectionId, termId: termId || undefined, dayOfWeek: Number(f.dayOfWeek), timeSlotId: f.timeSlotId, subjectId: f.subjectId, facultyId: f.facultyId, roomId: f.roomId || undefined, kind: f.kind }),
    onSuccess: () => { toast.success('Class scheduled'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Overlay title="Add class" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!preset && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><span style={lbl}>Day</span><select style={{ ...inp, cursor: 'pointer' }} value={f.dayOfWeek} onChange={(e) => set('dayOfWeek', e.target.value)}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
            <div style={{ flex: 1 }}><span style={lbl}>Period</span><select style={{ ...inp, cursor: 'pointer' }} value={f.timeSlotId} onChange={(e) => set('timeSlotId', e.target.value)}>{slots.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}</select></div>
          </div>
        )}
        {preset && <div style={{ fontSize: 12.5, color: T.ink3 }}>{DAYS[preset.day]} · {preset.slot.name} ({preset.slot.startTime}–{preset.slot.endTime})</div>}
        <div><span style={lbl}>Subject</span><select style={{ ...inp, cursor: 'pointer' }} value={f.subjectId} onChange={(e) => set('subjectId', e.target.value)}><option value="">Select subject…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><span style={lbl}>Lecturer</span><select style={{ ...inp, cursor: 'pointer' }} value={f.facultyId} onChange={(e) => set('facultyId', e.target.value)}><option value="">Select lecturer…</option>{faculty.map((fa) => <option key={fa.id} value={fa.id}>{fa.name}</option>)}</select></div>
          <div style={{ width: 150 }}><span style={lbl}>Type</span><select style={{ ...inp, cursor: 'pointer' }} value={f.kind} onChange={(e) => set('kind', e.target.value)}>{KIND_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div><span style={lbl}>Room <span style={{ color: T.ink3, fontWeight: 400 }}>(optional)</span></span><select style={{ ...inp, cursor: 'pointer' }} value={f.roomId} onChange={(e) => set('roomId', e.target.value)}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ''}</option>)}</select></div>
      </div>
      <Actions onClose={onClose} disabled={!f.subjectId || !f.facultyId || !f.timeSlotId || create.isPending} onSubmit={() => create.mutate()} label="Schedule" />
    </Overlay>
  );
}

function EditEntryModal({ entry, slots, subjects, faculty, rooms, onClose, onDone, onDelete }: {
  entry: TimetableEntry; slots: TimeSlot[]; subjects: Subject[]; faculty: Faculty[]; rooms: Room[]; onClose: () => void; onDone: () => void; onDelete: () => void;
}) {
  const [f, setF] = useState({ subjectId: entry.subjectId ?? '', facultyId: entry.facultyId ?? '', roomId: entry.roomId ?? '', kind: entry.kind ?? 'REGULAR', dayOfWeek: String(entry.dayOfWeek), timeSlotId: entry.timeSlotId });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => api.patch(`/academics/timetable/${entry.id}`, { subjectId: f.subjectId, facultyId: f.facultyId, roomId: f.roomId || null, kind: f.kind, dayOfWeek: Number(f.dayOfWeek), timeSlotId: f.timeSlotId }),
    onSuccess: () => { toast.success('Class updated'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Overlay title={`Edit · ${entry.subject?.code}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><span style={lbl}>Day</span><select style={{ ...inp, cursor: 'pointer' }} value={f.dayOfWeek} onChange={(e) => set('dayOfWeek', e.target.value)}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          <div style={{ flex: 1 }}><span style={lbl}>Period</span><select style={{ ...inp, cursor: 'pointer' }} value={f.timeSlotId} onChange={(e) => set('timeSlotId', e.target.value)}>{slots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div><span style={lbl}>Subject</span><select style={{ ...inp, cursor: 'pointer' }} value={f.subjectId} onChange={(e) => set('subjectId', e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><span style={lbl}>Lecturer</span><select style={{ ...inp, cursor: 'pointer' }} value={f.facultyId} onChange={(e) => set('facultyId', e.target.value)}>{faculty.map((fa) => <option key={fa.id} value={fa.id}>{fa.name}</option>)}</select></div>
          <div style={{ width: 150 }}><span style={lbl}>Type</span><select style={{ ...inp, cursor: 'pointer' }} value={f.kind} onChange={(e) => set('kind', e.target.value)}>{KIND_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div><span style={lbl}>Room</span><select style={{ ...inp, cursor: 'pointer' }} value={f.roomId} onChange={(e) => set('roomId', e.target.value)}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnS, color: T.danger }} onClick={onDelete}><Trash2 size={14} /> Remove</button>
        <div style={{ flex: 1 }} />
        <button style={btnS} onClick={onClose}>Cancel</button>
        <button style={{ ...btnP, opacity: save.isPending ? 0.6 : 1 }} disabled={save.isPending} onClick={() => save.mutate()}>Save</button>
      </div>
    </Overlay>
  );
}

// ============================== Subjects ==============================
function SubjectsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const { data: courses } = useQuery({ queryKey: ['courses-lite'], queryFn: async () => (await api.get<CourseLite[]>('/courses/lite')).data });
  const { data: faculty } = useQuery({ queryKey: ['faculty'], queryFn: async () => (await api.get<Faculty[]>('/faculty')).data });
  const [add, setAdd] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['acad-subjects'] }); qc.invalidateQueries({ queryKey: ['acad-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/academics/subjects/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });

  return (
    <div>
      <TabHead title="Subjects & papers" onAdd={() => setAdd(true)} addLabel="New subject" />
      {!data?.length && <Empty text="No subjects yet. Add subjects and map each to a default lecturer." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data ?? []).map((s) => (
          <div key={s.id} style={{ ...card, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, background: T.brandSubtle, color: T.brandText, padding: '4px 9px', borderRadius: 7 }}>{s.code}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div><div style={{ fontSize: 12, color: T.ink3 }}>{s.course?.name ?? 'No course'} · {s.credits} credits{s.faculty ? ` · ${s.faculty.name}` : ''}</div></div>
            <button style={{ ...btnS, height: 32, width: 34, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => del.mutate(s.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {add && <AddSubjectModal courses={courses ?? []} faculty={(faculty ?? []).filter((f) => f.active)} onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
    </div>
  );
}
function AddSubjectModal({ courses, faculty, onClose, onDone }: { courses: CourseLite[]; faculty: Faculty[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', name: '', courseId: '', facultyId: '', credits: '3' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/academics/subjects', { code: f.code, name: f.name, courseId: f.courseId || undefined, facultyId: f.facultyId || undefined, credits: Number(f.credits) || 3 }), onSuccess: () => { toast.success('Subject added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New subject" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 130 }}><span style={lbl}>Code</span><input style={inp} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="CS101" /></div>
          <div style={{ flex: 1 }}><span style={lbl}>Name</span><input style={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Intro to Programming" /></div>
          <div style={{ width: 90 }}><span style={lbl}>Credits</span><input style={inp} type="number" value={f.credits} onChange={(e) => set('credits', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><span style={lbl}>Course</span><select style={{ ...inp, cursor: 'pointer' }} value={f.courseId} onChange={(e) => set('courseId', e.target.value)}><option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div style={{ flex: 1 }}><span style={lbl}>Default lecturer</span><select style={{ ...inp, cursor: 'pointer' }} value={f.facultyId} onChange={(e) => set('facultyId', e.target.value)}><option value="">—</option>{faculty.map((fa) => <option key={fa.id} value={fa.id}>{fa.name}</option>)}</select></div>
        </div>
      </div>
      <Actions onClose={onClose} disabled={!f.code || !f.name || create.isPending} onSubmit={() => create.mutate()} label="Add subject" />
    </Overlay>
  );
}

// ============================== Sections ==============================
function SectionsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['acad-sections'], queryFn: async () => (await api.get<Section[]>('/academics/sections')).data });
  const { data: batches } = useQuery({ queryKey: ['batches-lite'], queryFn: async () => (await api.get<{ data: BatchLite[] }>('/courses/batches', { params: { limit: 100 } })).data.data });
  const [add, setAdd] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['acad-sections'] }); qc.invalidateQueries({ queryKey: ['acad-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/academics/sections/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  return (
    <div>
      <TabHead title="Class sections" onAdd={() => setAdd(true)} addLabel="New section" />
      {!data?.length && <Empty text="No sections. Divide a batch into sections (A, B, …) to schedule classes." />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
        {(data ?? []).map((s) => (
          <div key={s.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>Section {s.name}</div><div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{s.batch?.course?.name ? `${s.batch.course.name} · ` : ''}{s.batch?.name}</div></div>
              <button style={{ ...btnS, height: 28, width: 28, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => del.mutate(s.id)}><Trash2 size={12} /></button>
            </div>
            <div style={{ fontSize: 12, color: T.ink3, marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Users size={12} /> {typeof s.students === 'number' ? `${s.students} students` : `Capacity ${s.capacity || '—'}`}</div>
          </div>
        ))}
      </div>
      {add && <AddSectionModal batches={batches ?? []} onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
    </div>
  );
}
function AddSectionModal({ batches, onClose, onDone }: { batches: BatchLite[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ batchId: '', name: '', capacity: '40' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/academics/sections', { batchId: f.batchId, name: f.name, capacity: Number(f.capacity) || 0 }), onSuccess: () => { toast.success('Section added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New section" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><span style={lbl}>Batch</span><select style={{ ...inp, cursor: 'pointer' }} value={f.batchId} onChange={(e) => set('batchId', e.target.value)}><option value="">Select batch…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.course?.name ? `${b.course.name} · ` : ''}{b.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><span style={lbl}>Section name</span><input style={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="A" /></div>
          <div style={{ width: 120 }}><span style={lbl}>Capacity</span><input style={inp} type="number" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></div>
        </div>
      </div>
      <Actions onClose={onClose} disabled={!f.batchId || !f.name || create.isPending} onSubmit={() => create.mutate()} label="Add section" />
    </Overlay>
  );
}

// ============================== Setup (years/terms) ==============================
function SetupTab() {
  const qc = useQueryClient();
  const { data: years } = useQuery({ queryKey: ['acad-years'], queryFn: async () => (await api.get<AcademicYear[]>('/academics/years')).data });
  const [addYear, setAddYear] = useState(false);
  const [addTermFor, setAddTermFor] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['acad-years'] }); qc.invalidateQueries({ queryKey: ['acad-terms'] }); qc.invalidateQueries({ queryKey: ['acad-stats'] }); };
  const setCurYear = useMutation({ mutationFn: (id: string) => api.post(`/academics/years/${id}/current`, {}), onSuccess: () => { refresh(); toast.success('Set as current year'); } });
  const setCurTerm = useMutation({ mutationFn: (id: string) => api.post(`/academics/terms/${id}/current`, {}), onSuccess: () => { refresh(); toast.success('Set as current term'); } });
  const delYear = useMutation({ mutationFn: (id: string) => api.delete(`/academics/years/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  return (
    <div>
      <TabHead title="Academic years & terms" onAdd={() => setAddYear(true)} addLabel="New year" />
      {!years?.length && <Empty text="Define an academic year (e.g. 2026-27) and its terms/semesters." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(years ?? []).map((y) => (
          <div key={y.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{y.name}</div>
              {y.isCurrent ? <span style={{ fontSize: 11, fontWeight: 700, background: T.successBg, color: T.success, padding: '3px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11} /> Current</span>
                : <button style={{ ...btnS, height: 26, fontSize: 11.5 }} onClick={() => setCurYear.mutate(y.id)}><Star size={11} /> Set current</button>}
              <div style={{ flex: 1 }} />
              <button style={{ ...btnS, height: 28, fontSize: 12 }} onClick={() => setAddTermFor(y.id)}><Plus size={12} /> Term</button>
              <button style={{ ...btnS, height: 28, width: 28, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => delYear.mutate(y.id)}><Trash2 size={12} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {(y.terms ?? []).length === 0 && <span style={{ fontSize: 12, color: T.ink3 }}>No terms yet.</span>}
              {(y.terms ?? []).map((t) => (
                <div key={t.id} style={{ background: T.bg, borderRadius: 9, padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
                  {t.isCurrent ? <span style={{ fontSize: 11, fontWeight: 700, background: T.successBg, color: T.success, padding: '2px 8px', borderRadius: 999 }}>Current</span>
                    : <button onClick={() => setCurTerm.mutate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.brandText, fontSize: 11 }}>set current</button>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {addYear && <AddYearModal onClose={() => setAddYear(false)} onDone={() => { setAddYear(false); refresh(); }} />}
      {addTermFor && <AddTermModal yearId={addTermFor} onClose={() => setAddTermFor(null)} onDone={() => { setAddTermFor(null); refresh(); }} />}
    </div>
  );
}
function AddYearModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', isCurrent: true });
  const create = useMutation({ mutationFn: () => api.post('/academics/years', f), onSuccess: () => { toast.success('Year added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New academic year" onClose={onClose}>
      <div><span style={lbl}>Name</span><input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="2026-27" /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.ink2, marginTop: 14 }}><input type="checkbox" checked={f.isCurrent} onChange={(e) => setF({ ...f, isCurrent: e.target.checked })} /> Set as current year</label>
      <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add year" />
    </Overlay>
  );
}
function AddTermModal({ yearId, onClose, onDone }: { yearId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', isCurrent: false });
  const create = useMutation({ mutationFn: () => api.post('/academics/terms', { academicYearId: yearId, ...f }), onSuccess: () => { toast.success('Term added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New term / semester" onClose={onClose}>
      <div><span style={lbl}>Name</span><input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Semester 1" /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.ink2, marginTop: 14 }}><input type="checkbox" checked={f.isCurrent} onChange={(e) => setF({ ...f, isCurrent: e.target.checked })} /> Set as current term</label>
      <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add term" />
    </Overlay>
  );
}

// ============================== Rooms & Periods ==============================
function RoomsTab() {
  const qc = useQueryClient();
  const { data: rooms } = useQuery({ queryKey: ['acad-rooms'], queryFn: async () => (await api.get<Room[]>('/academics/rooms')).data });
  const { data: slots } = useQuery({ queryKey: ['acad-slots'], queryFn: async () => (await api.get<TimeSlot[]>('/academics/timeslots')).data });
  const [addRoom, setAddRoom] = useState(false);
  const [addSlot, setAddSlot] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['acad-rooms'] }); qc.invalidateQueries({ queryKey: ['acad-slots'] }); qc.invalidateQueries({ queryKey: ['acad-stats'] }); };
  const delRoom = useMutation({ mutationFn: (id: string) => api.delete(`/academics/rooms/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  const delSlot = useMutation({ mutationFn: (id: string) => api.delete(`/academics/timeslots/${id}`), onSuccess: () => { refresh(); toast.success('Deleted'); } });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
      <div>
        <TabHead title="Rooms & resources" onAdd={() => setAddRoom(true)} addLabel="Room" />
        {!rooms?.length && <Empty text="Add classrooms, labs and halls." />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(rooms ?? []).map((r) => (
            <div key={r.id} style={{ ...card, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <DoorOpen size={15} style={{ color: T.ink3 }} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}{r.code ? <span style={{ color: T.ink3, fontWeight: 400 }}> · {r.code}</span> : ''}</div><div style={{ fontSize: 11.5, color: T.ink3 }}>{r.type} · cap {r.capacity || '—'}</div></div>
              <button style={{ ...btnS, height: 28, width: 28, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => delRoom.mutate(r.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <TabHead title="Time periods" onAdd={() => setAddSlot(true)} addLabel="Period" />
        {!slots?.length && <Empty text="Define daily periods (e.g. Period 1 · 09:00–10:00)." />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(slots ?? []).map((s) => (
            <div key={s.id} style={{ ...card, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={15} style={{ color: T.ink3 }} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div><div style={{ fontSize: 11.5, color: T.ink3 }}>{s.startTime}–{s.endTime}</div></div>
              <button style={{ ...btnS, height: 28, width: 28, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => delSlot.mutate(s.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>
      {addRoom && <AddRoomModal onClose={() => setAddRoom(false)} onDone={() => { setAddRoom(false); refresh(); }} />}
      {addSlot && <AddSlotModal order={(slots ?? []).length} onClose={() => setAddSlot(false)} onDone={() => { setAddSlot(false); refresh(); }} />}
    </div>
  );
}
function AddRoomModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', code: '', type: 'Classroom', capacity: '40' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/academics/rooms', { name: f.name, code: f.code || undefined, type: f.type, capacity: Number(f.capacity) || 0 }), onSuccess: () => { toast.success('Room added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New room" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><span style={lbl}>Name</span><input style={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Room 101" /></div><div style={{ width: 110 }}><span style={lbl}>Code</span><input style={inp} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="R-101" /></div></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><span style={lbl}>Type</span><select style={{ ...inp, cursor: 'pointer' }} value={f.type} onChange={(e) => set('type', e.target.value)}>{['Classroom', 'Lab', 'Seminar', 'Auditorium'].map((t) => <option key={t}>{t}</option>)}</select></div><div style={{ width: 120 }}><span style={lbl}>Capacity</span><input style={inp} type="number" value={f.capacity} onChange={(e) => set('capacity', e.target.value)} /></div></div>
      </div>
      <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add room" />
    </Overlay>
  );
}
function AddSlotModal({ order, onClose, onDone }: { order: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: `Period ${order + 1}`, startTime: '09:00', endTime: '10:00' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/academics/timeslots', { ...f, order }), onSuccess: () => { toast.success('Period added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New time period" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><span style={lbl}>Name</span><input style={inp} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><span style={lbl}>Start</span><input style={inp} type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} /></div><div style={{ flex: 1 }}><span style={lbl}>End</span><input style={inp} type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} /></div></div>
      </div>
      <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add period" />
    </Overlay>
  );
}

// ============================== Faculty ==============================
function FacultyTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['faculty'], queryFn: async () => (await api.get<Faculty[]>('/faculty')).data });
  const [add, setAdd] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['faculty'] }); qc.invalidateQueries({ queryKey: ['acad-stats'] }); };
  const invite = useMutation({ mutationFn: (id: string) => api.post(`/faculty/${id}/invite`, {}), onSuccess: (r: any) => { refresh(); const link = r.data?.link; if (link) { navigator.clipboard?.writeText(link); toast.success('Lecturer invite link copied'); } else toast.success('Invite issued'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div>
      <TabHead title="Faculty / lecturers" onAdd={() => setAdd(true)} addLabel="New lecturer" />
      {!data?.length && <Empty text="Add lecturers, then map them to subjects and the timetable." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data ?? []).map((f) => (
          <div key={f.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{f.name.slice(0, 1)}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div><div style={{ fontSize: 12, color: T.ink3 }}>{f.designation ?? 'Lecturer'}{f.department ? ` · ${f.department}` : ''}{f.email ? ` · ${f.email}` : ''}</div></div>
            {f.portalUser?.status === 'ACTIVE' ? <span style={{ fontSize: 11, fontWeight: 700, background: T.successBg, color: T.success, padding: '3px 9px', borderRadius: 999 }}>Portal active</span>
              : f.portalUser?.status === 'INVITED' ? <span style={{ fontSize: 11, fontWeight: 700, background: T.amberBg, color: T.amberDeep, padding: '3px 9px', borderRadius: 999 }}>Invited</span>
              : <button style={{ ...btnS, height: 30 }} disabled={!f.email || invite.isPending} onClick={() => invite.mutate(f.id)}><UserPlus size={13} /> Invite login</button>}
          </div>
        ))}
      </div>
      {add && <AddFacultyModal onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
    </div>
  );
}
function AddFacultyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', email: '', department: '', designation: 'Lecturer', invite: true });
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/faculty', { name: f.name, email: f.email || undefined, department: f.department || undefined, designation: f.designation, invite: f.invite && !!f.email }),
    onSuccess: (r: any) => { const link = r.data?.link; if (link) { navigator.clipboard?.writeText(link); toast.success('Lecturer added · invite link copied'); } else toast.success('Lecturer added'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Overlay title="New lecturer" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><span style={lbl}>Name</span><input style={inp} value={f.name} onChange={(e) => set('name', e.target.value)} /></div><div style={{ width: 150 }}><span style={lbl}>Designation</span><input style={inp} value={f.designation} onChange={(e) => set('designation', e.target.value)} /></div></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><span style={lbl}>Email</span><input style={inp} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div><div style={{ flex: 1 }}><span style={lbl}>Department</span><input style={inp} value={f.department} onChange={(e) => set('department', e.target.value)} placeholder="Computer Science" /></div></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.ink2 }}><input type="checkbox" checked={f.invite} onChange={(e) => set('invite', e.target.checked)} /> <Link2 size={13} /> Also issue a lecturer portal login (needs email)</label>
      </div>
      <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add lecturer" />
    </Overlay>
  );
}

// ============================== Shared bits ==============================
function TabHead({ title, onAdd, addLabel }: { title: string; onAdd: () => void; addLabel: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button style={btnP} onClick={onAdd}><Plus size={15} /> {addLabel}</button></div>;
}
function Empty({ text }: { text: string }) {
  return <div style={{ ...card, padding: 44, textAlign: 'center', color: T.ink3, fontSize: 13.5 }}>{text}</div>;
}
function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,34,49,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24, boxShadow: T.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}><div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3 }}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}
function Actions({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}><button style={btnS} onClick={onClose}>Cancel</button><button style={{ ...btnP, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }} onClick={onSubmit}>{label}</button></div>;
}
