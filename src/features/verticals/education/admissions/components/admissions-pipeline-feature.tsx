'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Plus, X, LayoutGrid, ListFilter, GraduationCap, CheckCircle2, IndianRupee,
  BadgeCheck, MoreVertical, ChevronRight, ArrowRight, FileCheck, UploadCloud, FileText,
  Download, Trash2, UserCheck, AlertCircle,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { T } from '@/features/verticals/education/institute-dashboard';
import { academicYear } from '@/features/verticals/education/institute-dashboard';
import {
  AdmissionRow, AdmissionStage, STAGE_LABELS,
} from '../admissions-utils';

type ViewMode = 'kanban' | 'table';
type Paginated<T> = { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };

/* ── status tones (semantic, from the design system) ───────────────────────── */
const TONE = {
  neutral: { bg: '#f1f1f1', fg: T.ink2 },
  amber: { bg: T.amberBg, fg: T.amberDeep },
  success: { bg: T.successBg, fg: T.success },
  danger: { bg: T.dangerBg, fg: T.dangerText },
  brand: { bg: T.brandSubtle, fg: T.brandText },
} as const;

/* The five pipeline columns the design draws (ENROLLED/REJECTED live off-board). */
const COLUMNS: { stage: AdmissionStage; label: string; dot: string }[] = [
  { stage: 'APPLICATION', label: 'Applications', dot: T.brand },
  { stage: 'DOCUMENTS', label: 'Documents', dot: T.brand },
  { stage: 'VERIFICATION', label: 'Verification', dot: T.amber },
  { stage: 'COUNSELLING', label: 'Counselling', dot: T.brand },
  { stage: 'APPROVED', label: 'Approved', dot: T.brand },
];

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website enquiry', WALK_IN: 'Walk-in', REFERRAL: 'Referral',
  SOCIAL_MEDIA: 'Social media', PHONE: 'Phone enquiry', EMAIL: 'Email',
  ADVERTISEMENT: 'Advertisement', EVENT: 'Campus event', OTHER: 'Other',
};

const nameOf = (a: AdmissionRow) =>
  a.lead ? `${a.lead.firstName} ${a.lead.lastName ?? ''}`.trim()
    : a.student ? `${a.student.firstName} ${a.student.lastName ?? ''}`.trim()
    : 'Unknown applicant';

const daysSince = (iso?: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 0;

/** The per-card sub-status the design shows, derived from real fields. */
function deriveTag(a: AdmissionRow): { label: string; tone: keyof typeof TONE } {
  switch (a.stage) {
    case 'APPLICATION': return a.assignedTo ? { label: 'New', tone: 'neutral' } : { label: 'Unassigned', tone: 'amber' };
    case 'DOCUMENTS': return a.documentsVerified ? { label: 'Complete', tone: 'success' } : { label: 'Missing', tone: 'danger' };
    case 'VERIFICATION': return daysSince(a.appliedAt) > 5 ? { label: 'Overdue', tone: 'danger' } : { label: 'In review', tone: 'brand' };
    case 'COUNSELLING': return a.assignedTo ? { label: 'Booked', tone: 'success' } : { label: 'Waiting', tone: 'amber' };
    case 'APPROVED': return a.student ? { label: 'Enrolled', tone: 'brand' } : { label: 'Ready', tone: 'success' };
    case 'ENROLLED': return { label: 'Enrolled', tone: 'brand' };
    default: return { label: 'Rejected', tone: 'danger' };
  }
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const lakh = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n}`);

// ============================================================ main

function AdmissionsInner() {
  const qc = useQueryClient();
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission('admission.manage');
  const brand = (() => {
    const c = user?.organization?.primaryColor;
    return c && c.toLowerCase() !== '#4f46e5' ? c : T.brand;
  })();

  const [view, setView] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [stageFilter, setStageFilter] = useState<'' | AdmissionStage>('');
  const [counsellorFilter, setCounsellorFilter] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selected, setSelected] = useState<AdmissionRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admissions', search, courseFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: '1', limit: '100' });
      if (search) p.set('search', search);
      if (courseFilter) p.set('courseId', courseFilter);
      return (await api.get<Paginated<AdmissionRow>>(`/admissions?${p}`)).data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['courses-lite'],
    queryFn: async () => (await api.get<any[]>('/courses/lite')).data ?? [],
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get<any>('/users');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  // Drag a card onto another column → change its stage. The backend owns the
  // rules (e.g. APPROVED needs verified docs + payment), so an illegal drop
  // comes back as an error toast and the board refetches to its true state.
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: AdmissionStage }) => api.post(`/admissions/${id}/stage`, { stage }),
    onSuccess: (r: any) => { toast.success(`Moved to ${STAGE_LABELS[r.data.stage as AdmissionStage]}`); qc.invalidateQueries({ queryKey: ['admissions'] }); qc.invalidateQueries({ queryKey: ['institute-nav-summary'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const all = data?.data ?? [];
  const total = data?.meta.total ?? all.length;

  // client-side filters (search + course are already applied server-side)
  const filtered = useMemo(() => all.filter((a) =>
    (!stageFilter || a.stage === stageFilter) &&
    (!counsellorFilter || a.assignedTo?.id === counsellorFilter)), [all, stageFilter, counsellorFilter]);

  const byStage = (s: AdmissionStage) => filtered.filter((a) => a.stage === s);

  // KPIs — derived from the real records currently in scope
  const active = all.filter((a) => ['APPLICATION', 'DOCUMENTS', 'VERIFICATION', 'COUNSELLING', 'APPROVED'].includes(a.stage));
  const approved = all.filter((a) => a.stage === 'APPROVED');
  const enrolled = all.filter((a) => a.stage === 'ENROLLED');
  const newThisWeek = active.filter((a) => daysSince(a.createdAt) <= 7).length;
  const pendingFees = approved.reduce((s, a) => s + (a.course?.fee ?? 0), 0);

  return (
    <div style={{ fontFamily: T.font, color: T.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* page header */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: '-0.2px', margin: 0 }}>Admissions</h1>
          <p style={{ fontSize: 13, lineHeight: '18px', color: T.ink2, margin: '6px 0 0', maxWidth: 640 }}>
            Track prospective students from application through verification checks and counselling, to profile conversion.
          </p>
        </div>
        <ViewToggle view={view} setView={setView} brand={brand} />
        {canManage && (
          <button onClick={() => setRegisterOpen(true)} style={solidBtn(brand)}>
            <Plus size={16} strokeWidth={2.2} /> Register applicant
          </button>
        )}
      </div>

      {/* KPI row */}
      <div style={{ ...panel(), display: 'flex', alignItems: 'stretch', padding: '18px 4px' }}>
        <Kpi icon={<GraduationCap size={16} />} label="Active applicants" value={active.length}
          delta={newThisWeek > 0 ? `↑ ${newThisWeek}` : ''} caption="in pipeline across 5 stages" first />
        <KDiv />
        <Kpi icon={<CheckCircle2 size={16} />} label="Approved candidates" value={approved.length}
          unit="ready" caption="cleared for enrolment" />
        <KDiv />
        <Kpi icon={<IndianRupee size={16} />} label="Payment pending" value={approved.length}
          unit={pendingFees > 0 ? lakh(pendingFees) : ''} caption="held against admission" />
        <KDiv />
        <Kpi icon={<BadgeCheck size={16} />} label="Enrolled students" value={enrolled.length}
          unit="this intake" caption={`converted from ${total} applications`} />
      </div>

      {/* search + filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
          <Search size={17} color={T.ink3} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name or application number"
            style={{ width: '100%', height: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface,
              padding: '0 14px 0 42px', fontSize: 13, color: T.ink, outline: 'none' }} />
        </div>
        <FilterSelect label="Course" value={courseFilter} onChange={setCourseFilter}
          options={[{ v: '', l: 'All courses' }, ...courses.map((c: any) => ({ v: c.id, l: c.name ?? c.code }))]} />
        <FilterSelect label="Stage" value={stageFilter} onChange={(v) => setStageFilter(v as any)}
          options={[{ v: '', l: 'All stages' }, ...COLUMNS.map((c) => ({ v: c.stage, l: c.label }))]} />
        <FilterSelect label="Counsellor" value={counsellorFilter} onChange={setCounsellorFilter}
          options={[{ v: '', l: 'All' }, ...users.map((u: any) => ({ v: u.id, l: `${u.firstName} ${u.lastName ?? ''}`.trim() }))]} />
      </div>

      {/* states */}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {isLoading && <div style={panel()}><Empty text="Loading applicants…" /></div>}

      {!isLoading && !isError && view === 'kanban' && (
        <Board columns={COLUMNS} byStage={byStage} brand={brand}
          onCard={setSelected} onAdd={() => setRegisterOpen(true)} canManage={canManage} empty={filtered.length === 0} search={search}
          onMove={(id, stage) => move.mutate({ id, stage })} moving={move.isPending} />
      )}
      {!isLoading && !isError && view === 'table' && (
        <TableView rows={filtered} brand={brand} onRow={setSelected} search={search} />
      )}

      {registerOpen && (
        <RegisterModal brand={brand} courses={courses} users={users}
          onClose={() => setRegisterOpen(false)}
          onCreated={() => { setRegisterOpen(false); qc.invalidateQueries({ queryKey: ['admissions'] }); qc.invalidateQueries({ queryKey: ['institute-nav-summary'] }); }} />
      )}
      {selected && (
        <DetailDrawer adm={selected} brand={brand} canManage={canManage}
          onClose={() => setSelected(null)}
          onChanged={(row) => { setSelected(row); qc.invalidateQueries({ queryKey: ['admissions'] }); }}
          onGone={() => { setSelected(null); qc.invalidateQueries({ queryKey: ['admissions'] }); }} />
      )}
    </div>
  );
}

// ============================================================ header bits

function ViewToggle({ view, setView, brand }: { view: ViewMode; setView: (v: ViewMode) => void; brand: string }) {
  const seg = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? T.surface : 'transparent', color: active ? T.ink : T.ink3,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
  });
  return (
    <div style={{ display: 'inline-flex', background: '#eef0f0', borderRadius: 10, padding: 3, gap: 2, height: 40, alignItems: 'center' }}>
      <button style={seg(view === 'kanban')} onClick={() => setView('kanban')}><LayoutGrid size={15} /> Kanban view</button>
      <button style={seg(view === 'table')} onClick={() => setView('table')}><ListFilter size={15} /> Table view</button>
    </div>
  );
}

function Kpi({ icon, label, value, unit, delta, caption, first }: {
  icon: React.ReactNode; label: string; value: number; unit?: string; delta?: string; caption: string; first?: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '2px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.ink2 }}>
        <span style={{ color: T.iconDefault, display: 'inline-flex' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 590 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 10 }}>
        <span style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-0.4px' }}>{value.toLocaleString('en-IN')}</span>
        {unit && <span style={{ fontSize: 14, fontWeight: 510, color: T.ink2 }}>{unit}</span>}
        {delta && <span style={{ fontSize: 11, fontWeight: 590, color: T.success, letterSpacing: '.2px' }}>{delta}</span>}
      </div>
      <div style={{ fontSize: 12, color: T.ink3, marginTop: 8 }}>{caption}</div>
    </div>
  );
}
const KDiv = () => <div style={{ width: 1, background: T.border, flex: '0 0 1px', margin: '6px 0' }} />;

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <label style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', justifyContent: 'center',
      height: 44, minWidth: 150, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, cursor: 'pointer' }}>
      <span style={{ fontSize: 11, color: T.ink3, lineHeight: 1 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ appearance: 'none', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: T.ink,
          outline: 'none', cursor: 'pointer', marginTop: 2, paddingRight: 14, width: '100%' }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronRight size={14} color={T.ink3} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none' }} />
    </label>
  );
}

// ============================================================ kanban

/* Cards shown before the first "Show more"; each expansion adds STEP more. */
const INITIAL_CARDS = 2;
const STEP_CARDS = 8;

function Board({ columns, byStage, brand, onCard, onAdd, canManage, empty, search, onMove, moving }: {
  columns: typeof COLUMNS; byStage: (s: AdmissionStage) => AdmissionRow[]; brand: string;
  onCard: (a: AdmissionRow) => void; onAdd: () => void; canManage: boolean; empty: boolean; search: string;
  onMove: (id: string, stage: AdmissionStage) => void; moving: boolean;
}) {
  if (empty) return <div style={panel()}><Empty text={search ? 'No applicants match your search.' : 'No applicants in the pipeline yet.'} /></div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr))`, gap: 16, alignItems: 'start', overflowX: 'auto', opacity: moving ? 0.7 : 1 }}>
      {columns.map((col) => (
        <KanbanColumn key={col.stage} col={col} rows={byStage(col.stage)} brand={brand} onCard={onCard} onAdd={onAdd} canManage={canManage} onMove={onMove} />
      ))}
    </div>
  );
}

function KanbanColumn({ col, rows, brand, onCard, onAdd, canManage, onMove }: {
  col: typeof COLUMNS[number]; rows: AdmissionRow[]; brand: string;
  onCard: (a: AdmissionRow) => void; onAdd: () => void; canManage: boolean;
  onMove: (id: string, stage: AdmissionStage) => void;
}) {
  const [shown, setShown] = useState(INITIAL_CARDS);
  const [over, setOver] = useState(false);
  const visible = rows.slice(0, shown);
  const remaining = rows.length - shown;
  // First tap jumps to ~10, then loads STEP at a time.
  const nextShown = shown === INITIAL_CARDS ? INITIAL_CARDS + STEP_CARDS : shown + STEP_CARDS;
  const nextBatch = Math.min(remaining, nextShown - shown);

  const moreLink: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 30, borderRadius: 8,
    border: 'none', background: 'transparent', color: brand, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    try {
      const d = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (d?.id && d.from !== col.stage) onMove(d.id, col.stage);
    } catch { /* ignore malformed drops */ }
  };

  return (
    <div
      onDragOver={canManage ? (e) => { e.preventDefault(); if (!over) setOver(true); } : undefined}
      onDragLeave={canManage ? () => setOver(false) : undefined}
      onDrop={canManage ? handleDrop : undefined}
      style={{ background: over ? T.brandSubtle : '#f7f8f8', border: `${over ? 1.5 : 1}px ${over ? 'dashed' : 'solid'} ${over ? brand : T.border}`,
        borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 190, transition: 'background .12s, border-color .12s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: col.dot, flex: '0 0 8px' }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: T.ink2, textTransform: 'uppercase', flex: 1 }}>{col.label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.ink3, background: T.surface, borderRadius: 99, padding: '1px 8px', border: `1px solid ${T.border}` }}>{rows.length}</span>
        <MoreVertical size={15} color={T.ink3} />
      </div>

      {visible.map((a) => <ApplicantCard key={a.id} a={a} onClick={() => onCard(a)} draggable={canManage} />)}

      {remaining > 0 && (
        <button onClick={() => setShown(nextShown)} style={moreLink}>
          Show {nextBatch} more <ChevronRight size={13} style={{ transform: 'rotate(90deg)' }} />
        </button>
      )}
      {shown > INITIAL_CARDS && remaining <= 0 && rows.length > INITIAL_CARDS && (
        <button onClick={() => setShown(INITIAL_CARDS)} style={{ ...moreLink, color: T.ink3 }}>
          Show less <ChevronRight size={13} style={{ transform: 'rotate(-90deg)' }} />
        </button>
      )}

      {canManage && (
        <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32,
          borderRadius: 9, border: `1px dashed ${T.borderStrong}`, background: 'transparent', color: T.ink3, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Add applicant
        </button>
      )}
    </div>
  );
}

function ApplicantCard({ a, onClick, draggable }: { a: AdmissionRow; onClick: () => void; draggable?: boolean }) {
  const tag = deriveTag(a);
  const tone = TONE[tag.tone];
  const [dragging, setDragging] = useState(false);
  return (
    <button onClick={onClick}
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ id: a.id, from: a.stage })); e.dataTransfer.effectAllowed = 'move'; setDragging(true); } : undefined}
      onDragEnd={draggable ? () => setDragging(false) : undefined}
      style={{ textAlign: 'left', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: 12, cursor: draggable ? 'grab' : 'pointer', display: 'flex', flexDirection: 'column', gap: 6, opacity: dragging ? 0.4 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>{nameOf(a)}</span>
        <span style={{ flex: '0 0 auto', fontSize: 11, fontWeight: 600, background: tone.bg, color: tone.fg, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>{tag.label}</span>
      </div>
      <span style={{ fontSize: 12, color: T.ink3 }}>{a.course?.name ?? a.course?.code ?? '—'}</span>
    </button>
  );
}

// ============================================================ table

function TableView({ rows, brand, onRow, search }: { rows: AdmissionRow[]; brand: string; onRow: (a: AdmissionRow) => void; search: string }) {
  if (rows.length === 0) return <div style={panel()}><Empty text={search ? 'No applicants match your search.' : 'No applicants yet.'} /></div>;
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 590, letterSpacing: '.06em', color: T.ink3, padding: '0 12px 12px', textTransform: 'uppercase' };
  const td: React.CSSProperties = { padding: '13px 12px', fontSize: 13, color: T.ink, verticalAlign: 'middle' };
  return (
    <div style={{ ...panel(), padding: '8px 12px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
        <thead><tr>
          <th style={th}>Applicant</th><th style={th}>Application no</th><th style={th}>Course</th>
          <th style={th}>Stage</th><th style={th}>Counsellor</th><th style={th}>Applied</th><th style={{ ...th, textAlign: 'right' }}>Status</th>
        </tr></thead>
        <tbody>
          {rows.map((a) => {
            const tag = deriveTag(a); const tone = TONE[tag.tone];
            return (
              <tr key={a.id} onClick={() => onRow(a)} style={{ borderTop: `1px solid ${T.border}`, cursor: 'pointer' }}>
                <td style={{ ...td, fontWeight: 600 }}>{nameOf(a)}</td>
                <td style={{ ...td, color: T.ink2, fontVariantNumeric: 'tabular-nums' }}>{a.applicationNo}</td>
                <td style={{ ...td, color: T.ink2 }}>{a.course?.name ?? a.course?.code ?? '—'}</td>
                <td style={td}><span style={{ fontSize: 12, fontWeight: 600, color: brand }}>{STAGE_LABELS[a.stage]}</span></td>
                <td style={{ ...td, color: T.ink2 }}>{a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName ?? ''}`.trim() : '—'}</td>
                <td style={{ ...td, color: T.ink3 }}>{fmtDate(a.appliedAt)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, background: tone.bg, color: tone.fg, borderRadius: 6, padding: '3px 9px' }}>{tag.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================ register modal

function RegisterModal({ brand, courses, users, onClose, onCreated }: {
  brand: string; courses: any[]; users: any[]; onClose: () => void; onCreated: () => void;
}) {
  const ay = academicYear();
  const [f, setF] = useState({ name: '', phone: '', email: '', courseId: '', intake: `Semester 1 · ${ay}`, assignedToId: '', source: 'WEBSITE', note: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const create = useMutation({
    mutationFn: () => {
      const [first, ...rest] = f.name.trim().split(/\s+/);
      return api.post('/admissions', {
        firstName: first, lastName: rest.join(' ') || undefined,
        phone: f.phone.trim() || undefined, email: f.email.trim() || undefined,
        courseId: f.courseId, assignedToId: f.assignedToId || undefined,
        source: f.source || undefined, intake: f.intake || undefined, note: f.note.trim() || undefined,
      });
    },
    onSuccess: () => { toast.success('Applicant registered — added to Applications'); onCreated(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Applicant name is required';
    if (!f.courseId) e.courseId = 'Choose a target course';
    if (!f.intake) e.intake = 'Choose an intake';
    if (f.phone && !/^[+]?[\d\s-]{7,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number';
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Enter a valid email';
    setErr(e);
    if (Object.keys(e).length === 0) create.mutate();
  };

  const intakes = [`Semester 1 · ${ay}`, `Semester 2 · ${ay}`];
  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 'min(560px, 94vw)', maxHeight: '92vh', background: T.surface, borderRadius: 16, boxShadow: '0 24px 60px rgba(17,34,49,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 22px 14px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: T.ink }}>Register applicant</h2>
            <p style={{ fontSize: 12.5, color: T.ink3, margin: '5px 0 0' }}>Create an admission record manually. The applicant enters the pipeline at Applications.</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.ink3, padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FField label="Applicant name" error={err.name}>
            <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Enter full name" style={inp(!!err.name)} autoFocus />
          </FField>
          <Row>
            <FField label="Phone" error={err.phone}><input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" style={inp(!!err.phone)} /></FField>
            <FField label="Email" error={err.email}><input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" style={inp(!!err.email)} /></FField>
          </Row>
          <Row>
            <FField label="Target course" error={err.courseId}>
              <Select value={f.courseId} onChange={(v) => set('courseId', v)} invalid={!!err.courseId}
                options={[{ v: '', l: 'Select course' }, ...courses.map((c) => ({ v: c.id, l: c.name ?? c.code }))]} />
            </FField>
            <FField label="Intake" error={err.intake}>
              <Select value={f.intake} onChange={(v) => set('intake', v)} options={intakes.map((i) => ({ v: i, l: i }))} />
            </FField>
          </Row>
          <Row>
            <FField label="Nodal counsellor">
              <Select value={f.assignedToId} onChange={(v) => set('assignedToId', v)}
                options={[{ v: '', l: 'Assign later' }, ...users.map((u) => ({ v: u.id, l: `${u.firstName} ${u.lastName ?? ''}`.trim() }))]} />
            </FField>
            <FField label="Application source">
              <Select value={f.source} onChange={(v) => set('source', v)}
                options={Object.entries(SOURCE_LABELS).map(([v, l]) => ({ v, l }))} />
            </FField>
          </Row>
          <FField label="Note">
            <textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={2}
              placeholder="Context for the counsellor — referral, walk-in, campaign"
              style={{ ...inp(false), height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.4 }} />
          </FField>
          <div style={{ display: 'flex', gap: 10, background: T.brandSubtle, borderRadius: 10, padding: '11px 13px' }}>
            <AlertCircle size={16} color={brand} style={{ flex: '0 0 16px', marginTop: 1 }} />
            <span style={{ fontSize: 12, color: T.teal800, lineHeight: 1.4 }}>
              A registered applicant begins at <b>Applications</b> and cannot skip <b>Documents</b> or <b>Verification</b> — each stage is cleared in order.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={ghostBtn()}>Cancel</button>
          <button onClick={submit} disabled={create.isPending} style={{ ...solidBtn(brand), opacity: create.isPending ? 0.7 : 1 }}>
            {create.isPending ? 'Registering…' : 'Register applicant'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ============================================================ detail drawer

const ORDER: AdmissionStage[] = ['APPLICATION', 'DOCUMENTS', 'VERIFICATION', 'COUNSELLING', 'APPROVED', 'ENROLLED'];

function DetailDrawer({ adm, brand, canManage, onClose, onChanged, onGone }: {
  adm: AdmissionRow; brand: string; canManage: boolean;
  onClose: () => void; onChanged: (row: AdmissionRow) => void; onGone: () => void;
}) {
  const nextStage = ORDER[Math.min(ORDER.indexOf(adm.stage) + 1, ORDER.length - 1)];
  const canAdvance = adm.stage !== 'ENROLLED' && adm.stage !== 'REJECTED' && nextStage !== adm.stage;

  const advance = useMutation({
    mutationFn: () => api.post(`/admissions/${adm.id}/stage`, { stage: nextStage }),
    onSuccess: (r) => { toast.success(`Moved to ${STAGE_LABELS[r.data.stage as AdmissionStage]}`); onChanged(r.data); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/admissions/${adm.id}/stage`, { stage: 'REJECTED', rejectionReason: 'Rejected from review' }),
    onSuccess: (r) => { toast.success('Application rejected'); onChanged(r.data); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/admissions/${adm.id}`),
    onSuccess: () => { toast.success('Application deleted'); onGone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const row = (k: string, v?: string | null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12.5, color: T.ink3 }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );

  return (
    <Overlay onClose={onClose} align="right">
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 96vw)', height: '100vh', background: T.surface, boxShadow: '-16px 0 48px rgba(17,34,49,.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{nameOf(adm)}</div>
            <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{adm.applicationNo} · {STAGE_LABELS[adm.stage]}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.ink3, padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {row('Course', adm.course?.name ?? adm.course?.code)}
          {row('Counsellor', adm.assignedTo ? `${adm.assignedTo.firstName} ${adm.assignedTo.lastName ?? ''}`.trim() : 'Unassigned')}
          {row('Phone', adm.lead?.phone)}
          {row('Email', adm.lead?.email)}
          {row('Applied', fmtDate(adm.appliedAt))}
          {row('Documents', adm.documentsVerified ? 'Verified' : 'Pending')}
        </div>
        {canManage && (
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {canAdvance && (
              <button onClick={() => advance.mutate()} disabled={advance.isPending} style={solidBtn(brand)}>
                <ArrowRight size={16} /> Move to {STAGE_LABELS[nextStage]}
              </button>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              {adm.stage !== 'REJECTED' && adm.stage !== 'ENROLLED' && (
                <button onClick={() => reject.mutate()} disabled={reject.isPending} style={{ ...ghostBtn(), flex: 1, color: T.dangerText, borderColor: T.dangerBg }}>Reject</button>
              )}
              <button onClick={() => del.mutate()} disabled={del.isPending} style={{ ...ghostBtn(), flex: 1 }}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ============================================================ primitives

function Overlay({ children, onClose, align = 'center' }: { children: React.ReactNode; onClose: () => void; align?: 'center' | 'right' }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(17,34,49,.34)',
      display: 'flex', alignItems: align === 'center' ? 'center' : 'stretch', justifyContent: align === 'center' ? 'center' : 'flex-end', padding: align === 'center' ? 16 : 0 }}>
      {children}
    </div>
  );
}
const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
function FField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink2 }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: T.dangerText }}>{error}</span>}
    </label>
  );
}
function Select({ value, onChange, options, invalid }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; invalid?: boolean }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inp(!!invalid), appearance: 'none', cursor: 'pointer', paddingRight: 32 }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronRight size={15} color={T.ink3} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none' }} />
    </div>
  );
}
function Empty({ text }: { text: string }) { return <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 13, color: T.ink3 }}>{text}</div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ ...panel(), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 36 }}>
      <AlertCircle size={26} color={T.dangerText} />
      <div style={{ fontSize: 14, fontWeight: 600 }}>Couldn’t load admissions</div>
      <button onClick={onRetry} style={ghostBtn()}>Retry</button>
    </div>
  );
}

function panel(): React.CSSProperties { return { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, boxShadow: T.shadow }; }
function inp(invalid: boolean): React.CSSProperties {
  return { width: '100%', height: 42, borderRadius: 10, border: `1px solid ${invalid ? T.dangerText : T.border}`, background: T.surface, padding: '0 12px', fontSize: 13, color: T.ink, outline: 'none' };
}
function solidBtn(brand: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: brand, color: '#fff', whiteSpace: 'nowrap' };
}
function ghostBtn(): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${T.border}`, background: T.surface, color: T.ink };
}

export function AdmissionsPipelineFeature() {
  return (
    <Suspense fallback={<div style={{ color: T.ink3, padding: 24 }}>Loading…</div>}>
      <AdmissionsInner />
    </Suspense>
  );
}
