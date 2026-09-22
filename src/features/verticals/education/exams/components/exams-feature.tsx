'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, X, Ticket, Users, CheckCircle2, AlertTriangle, BadgeCheck, Send,
  ClipboardList, ChevronRight, ChevronDown, ShieldAlert, PenLine, Download,
  SlidersHorizontal, Info,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Subject } from '@/features/verticals/education/academics';
import { T, academicYear } from '@/features/verticals/education/institute-dashboard';
import {
  AllocationResult, Backlog, ExamDetail, ExamRow, ExamStatus, EXAM_FLOW,
  EXAM_KIND_LABEL, EXAM_STATUS_LABEL, MarkEntry, PaperSeats, SeatRow,
  backlogReason, canApprove, canEnterMarks, canPublish, canSchedule,
  fmtDateTime, markError,
} from '../exams-client';

/* ------------------------------------------------------------------ tokens */

const card: React.CSSProperties = {
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius,
};
const STATUS_TONE: Record<ExamStatus, { bg: string; fg: string }> = {
  SETUP:            { bg: '#f2f2f2',      fg: T.ink3 },
  SCHEDULED:        { bg: T.brandSubtle,  fg: T.brandText },
  IN_PROGRESS:      { bg: T.amberBg,      fg: T.amberDeep },
  RESULTS_ENTERED:  { bg: T.amberBg,      fg: T.amberDeep },
  RESULTS_APPROVED: { bg: T.teal100,      fg: T.teal700 },
  PUBLISHED:        { bg: T.successBg,    fg: T.success },
};

const btnBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px',
  borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
  border: '1px solid transparent', whiteSpace: 'nowrap',
};
const primaryBtn: React.CSSProperties = { ...btnBase, background: T.brand, color: '#fff' };
const outlineBtn: React.CSSProperties = { ...btnBase, background: T.surface, color: T.ink, border: `1px solid ${T.border}` };
const brandOutlineBtn: React.CSSProperties = { ...btnBase, background: T.surface, color: T.brandText, border: `1px solid ${T.brand}` };
const selectStyle: React.CSSProperties = {
  height: 44, width: '100%', border: `1px solid ${T.border}`, borderRadius: 12,
  padding: '0 12px', fontSize: 14, color: T.ink, background: T.surface, fontFamily: T.font,
  appearance: 'none', cursor: 'pointer',
};

/* --------------------------------------------------------------- main view */

export function ExamsFeature() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<'exams' | 'backlogs'>('exams');
  // Staged filter selection vs the applied filter (applied on "View examinations").
  const [courseSel, setCourseSel] = useState('');
  const [semSel, setSemSel] = useState('');
  const [filter, setFilter] = useState<{ courseId: string; termId: string }>({ courseId: '', termId: '' });
  // The schedule loads only after "View examinations" — matching the Figma
  // landing (node 1344:15601), which prompts for a course before showing rows.
  const [applied, setApplied] = useState(false);

  /**
   * The UI mirrors the server's keys — it does not replace them. Every action
   * is enforced again by @RequirePermissions on the route; hiding a button is
   * courtesy, the guard is the control.
   */
  const { hasPermission } = useAuth();
  const canManage = hasPermission('exam.manage');
  const canPublishResults = hasPermission('exam.publish');
  const canGrade = hasPermission('assessment.grade');

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => (await api.get<ExamRow[]>('/exams')).data,
  });
  const { data: backlogs } = useQuery({
    queryKey: ['exam-backlogs'],
    queryFn: async () => (await api.get<Backlog[]>('/exams/backlogs')).data,
  });
  const { data: courses } = useQuery({
    queryKey: ['courses-lite'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/courses/lite')).data,
  });
  const { data: terms } = useQuery({
    queryKey: ['acad-terms'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/academics/terms')).data,
  });

  const filtered = useMemo(() => (exams ?? []).filter((e) =>
    (!filter.courseId || e.courseId === filter.courseId) &&
    (!filter.termId || e.termId === filter.termId),
  ), [exams, filter]);

  const papers = filtered.reduce((n, e) => n + (e._count?.schedules ?? 0), 0);

  // Two-line dropdown options — every subline derived from the real exam list,
  // never a fixed sample. A course/term with no exams says so honestly.
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const courseOptions = useMemo(() => (courses ?? []).map((c) => {
    const es = (exams ?? []).filter((e) => e.courseId === c.id);
    const ps = es.reduce((n, e) => n + (e._count?.schedules ?? 0), 0);
    return { id: c.id, label: c.name, meta: es.length ? `${plural(es.length, 'examination')} · ${plural(ps, 'paper')}` : 'No examinations yet' };
  }), [courses, exams]);
  const termOptions = useMemo(() => (terms ?? []).map((t) => {
    const es = (exams ?? []).filter((e) => e.termId === t.id);
    const ps = es.reduce((n, e) => n + (e._count?.schedules ?? 0), 0);
    let meta: string;
    if (!es.length) meta = 'No examinations scheduled';
    else if (es.every((e) => e.status === 'PUBLISHED')) meta = 'Results published';
    else if (es.every((e) => e.status === 'SETUP')) meta = 'Setup not started';
    else meta = `${plural(es.length, 'examination')} · ${plural(ps, 'paper')}`;
    return { id: t.id, label: t.name, meta };
  }), [terms, exams]);

  const exportSchedule = async () => {
    try {
      const res = await api.get('/exams/export', {
        params: { ...(filter.courseId ? { courseId: filter.courseId } : {}), ...(filter.termId ? { termId: filter.termId } : {}) },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'examination-schedule.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(apiErrorMessage(e)); }
  };

  const [showNew, setShowNew] = useState(false);

  return (
    <div style={{ animation: 'fadeUp .4s ease', fontFamily: T.font, color: T.ink }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: T.ink }}>Examinations</h1>
          <p style={{ fontSize: 14, color: T.ink2, margin: '6px 0 0' }}>
            Set up examinations, schedule papers, seat the cohort, issue hall tickets and publish results.
          </p>
        </div>
        {applied && <button style={outlineBtn} onClick={exportSchedule}><Download size={15} /> Export schedule</button>}
        {canManage && <button style={primaryBtn} onClick={() => setShowNew(true)}><Plus size={15} /> New examination</button>}
      </div>

      {/* filter card */}
      <div style={{ ...card, padding: 20, marginBottom: 16, boxShadow: T.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center' }}>
            <SlidersHorizontal size={17} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Filter examinations</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12.5, color: T.ink3 }}>Choose a course and semester to load its examination schedule</span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Choose course" style={{ flex: 1, minWidth: 220 }}>
            <Dropdown heading="Courses" placeholder="Select a course" active={!!courseSel}
              options={courseOptions} value={courseSel} onChange={setCourseSel} />
          </Field>
          <Field label="Choose semester" style={{ flex: 1, minWidth: 220 }}>
            <Dropdown heading="Semesters" placeholder="Select a semester"
              options={termOptions} value={semSel} onChange={setSemSel} />
          </Field>
          <button style={outlineBtn} onClick={() => { setCourseSel(''); setSemSel(''); setFilter({ courseId: '', termId: '' }); setApplied(false); }}>Reset</button>
          <button style={applied ? brandOutlineBtn : primaryBtn} onClick={() => { setFilter({ courseId: courseSel, termId: semSel }); setApplied(true); }}>View examinations</button>
        </div>
      </div>

      {!applied ? (
        <div style={{ ...card, padding: '56px 28px', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${T.border}`, display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: T.ink3 }}>
            <ClipboardList size={19} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>No course selected</div>
          <div style={{ fontSize: 13, color: T.ink3, marginTop: 6 }}>Choose a course and semester, then select View examinations to load the schedule.</div>
        </div>
      ) : (
        <>
          {/* tabs + meta */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <TabBtn active={tab === 'exams'} icon={<ClipboardList size={14} />} label="Examinations" count={filtered.length} onClick={() => setTab('exams')} />
            <TabBtn active={tab === 'backlogs'} icon={<AlertTriangle size={14} />} label="Backlogs" count={backlogs?.length ?? 0} tone="danger" onClick={() => setTab('backlogs')} />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: T.ink3 }}>
              {filtered.length} examination{filtered.length === 1 ? '' : 's'} · {papers} paper{papers === 1 ? '' : 's'} · Academic year {academicYear()}
            </span>
          </div>

          {tab === 'backlogs' ? <BacklogsTab /> : (
            isLoading ? <Empty text="Loading examinations…" />
            : !filtered.length ? (
              <Empty text="No examinations for this course and semester. Adjust the filter, or create one." />
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {filtered.map((e) => (
                  <ExamCard key={e.id} exam={e} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} canManage={canManage} canPublishResults={canPublishResults} canGrade={canGrade} />
                ))}
              </div>
            )
          )}
        </>
      )}

      {showNew && <NewExamModal courses={courses ?? []} terms={terms ?? []} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function Field({ label, style, children }: { label: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

interface DropdownOption { id: string; label: string; meta: string }
function Dropdown({ heading, placeholder, options, value, onChange, active }: {
  heading: string; placeholder: string; options: DropdownOption[]; value: string; onChange: (v: string) => void; active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const on = open || active;
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{
        ...selectStyle, borderColor: on ? T.brand : T.border, display: 'flex', alignItems: 'center', textAlign: 'left',
      }}>
        <span style={{ flex: 1, color: selected ? T.ink : T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} style={{ color: T.ink3, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 41,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow,
            padding: 6, maxHeight: 320, overflowY: 'auto',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: T.ink3, padding: '8px 10px 6px' }}>{heading.toUpperCase()}</div>
            {options.length === 0 && <div style={{ padding: '10px', fontSize: 12.5, color: T.ink3 }}>Nothing to show yet.</div>}
            {options.map((o) => {
              const sel = o.id === value;
              return (
                <button key={o.id} type="button" onClick={() => { onChange(sel ? '' : o.id); setOpen(false); }} style={{
                  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 10px', borderRadius: 8, background: sel ? T.brandSubtle : 'transparent',
                }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: sel ? T.brandText : T.ink }}>{o.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: T.ink3, marginTop: 1 }}>{o.meta}</span>
                  </span>
                  {sel && <CheckCircle2 size={15} style={{ color: T.brandText }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TabBtn({ active, icon, label, count, tone, onClick }: { active: boolean; icon: React.ReactNode; label: string; count: number; tone?: 'danger'; onClick: () => void }) {
  const fg = active ? T.brandText : T.ink2;
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 10,
      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, color: fg,
      background: active ? T.brandSubtle : 'transparent', border: `1px solid ${active ? T.brand : T.border}`,
    }}>
      {icon} {label}
      <span style={{
        fontSize: 11.5, fontWeight: 700, minWidth: 20, textAlign: 'center', padding: '1px 6px', borderRadius: 999,
        background: tone === 'danger' ? T.dangerBg : active ? T.surface : '#f2f2f2',
        color: tone === 'danger' ? T.dangerText : fg,
      }}>{count}</span>
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...card, padding: 28, textAlign: 'center', color: T.ink3, fontSize: 13.5 }}>{text}</div>;
}

function StatusPill({ status }: { status: ExamStatus }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.SETUP;
  return (
    <span style={{ background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>
      {EXAM_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** The lifecycle, drawn. A registrar should see the stage without decoding an enum. */
function Flow({ status }: { status: ExamStatus }) {
  const at = EXAM_FLOW.indexOf(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {EXAM_FLOW.map((s, i) => (
        <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontSize: 11.5, fontWeight: i <= at ? 700 : 500,
            color: i < at ? T.success : i === at ? T.brandText : T.ink3,
          }}>{EXAM_STATUS_LABEL[s]}</span>
          {i < EXAM_FLOW.length - 1 && <ChevronRight size={11} style={{ color: T.ink3 }} />}
        </span>
      ))}
    </div>
  );
}

function ExamCard({ exam, open, onToggle, canManage, canPublishResults, canGrade }: { exam: ExamRow; open: boolean; onToggle: () => void; canManage: boolean; canPublishResults: boolean; canGrade: boolean }) {
  return (
    <div style={{ ...card, boxShadow: open ? T.shadow : undefined }}>
      <button onClick={onToggle} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', padding: '16px 18px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15.5, fontWeight: 700, color: T.ink }}>{exam.name}</span>
              <StatusPill status={exam.status} />
              <span style={{ fontSize: 12, color: T.ink3 }}>{EXAM_KIND_LABEL[exam.kind] ?? exam.kind}</span>
            </div>
            <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 5 }}>
              {exam._count?.schedules ?? 0} paper{(exam._count?.schedules ?? 0) === 1 ? '' : 's'}
              {exam.term?.name ? ` · ${exam.term.name}` : ''}
              {exam.course?.name ? ` · ${exam.course.name}` : ''}
            </div>
          </div>
          <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s', color: T.ink3 }} />
        </div>
        <div style={{ marginTop: 12 }}><Flow status={exam.status} /></div>
      </button>
      {open && <ExamDetailPanel examId={exam.id} status={exam.status} canManage={canManage} canPublishResults={canPublishResults} canGrade={canGrade} />}
    </div>
  );
}

function ExamDetailPanel({ examId, status, canManage, canPublishResults, canGrade }: { examId: string; status: ExamStatus; canManage: boolean; canPublishResults: boolean; canGrade: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => (await api.get<ExamDetail>(`/exams/${examId}`)).data,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['exam', examId] }); qc.invalidateQueries({ queryKey: ['exams'] }); };

  const act = (path: string, ok: string) => async () => {
    try { await api.post(path); toast.success(ok); refresh(); }
    catch (e) { toast.error(apiErrorMessage(e)); }
  };

  if (isLoading) return <div style={{ padding: 18, borderTop: `1px solid ${T.border}`, fontSize: 13, color: T.ink3 }}>Loading papers…</div>;

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: 18 }}>
      {canSchedule(status) && canManage && <AddPaper examId={examId} onDone={refresh} />}

      {!data?.schedules.length ? (
        <div style={{ fontSize: 13, color: T.ink3, padding: '8px 0' }}>
          No papers scheduled yet. Add one to seat students and issue hall tickets.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {data.schedules.map((s) => <PaperRow key={s.id} schedule={s} onChanged={refresh} canManage={canManage} canGrade={canGrade} examStatus={status} />)}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {canApprove(status) && canPublishResults && (
          <button style={{ ...outlineBtn, height: 36 }} onClick={act(`/exams/${examId}/approve`, 'Results approved')}>
            <BadgeCheck size={15} /> Approve results
          </button>
        )}
        {canPublish(status) && canPublishResults && (
          <button style={{ ...primaryBtn, height: 36 }} onClick={act(`/exams/${examId}/publish`, 'Results published')}>
            <Send size={15} /> Publish results
          </button>
        )}
        {!canApprove(status) && !canPublish(status) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: T.ink2 }}>
            <Info size={15} style={{ color: T.ink3 }} />
            {status === 'PUBLISHED'
              ? 'Results are published and visible to students.'
              : 'Enter marks against each paper to move this examination forward.'}
          </div>
        )}
      </div>
    </div>
  );
}

function AddPaper({ examId, onDone }: { examId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMin, setDurationMin] = useState(180);
  const [maxMarks, setMaxMarks] = useState(100);
  const [passMarks, setPassMarks] = useState(40);
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });

  const inp: React.CSSProperties = { height: 38, border: `1px solid ${T.border}`, borderRadius: 10, padding: '0 10px', fontSize: 12.5, fontFamily: T.font, color: T.ink, background: T.surface };

  const add = useMutation({
    mutationFn: async () => (await api.post(`/exams/${examId}/schedules`, { subjectId, startsAt, durationMin, maxMarks, passMarks })).data,
    onSuccess: () => { toast.success('Paper scheduled'); setOpen(false); setStartsAt(''); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!open) return <button style={{ ...outlineBtn, height: 34, fontSize: 12.5 }} onClick={() => setOpen(true)}><Plus size={14} /> Schedule a paper</button>;
  return (
    <div style={{ ...card, background: T.bg, padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select style={{ ...inp, width: 220 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
        <option value="">Select subject…</option>
        {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
      </select>
      <input style={{ ...inp, width: 210 }} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      <input style={{ ...inp, width: 90 }} type="number" value={durationMin} onChange={(e) => setDurationMin(+e.target.value)} title="Duration (minutes)" />
      <input style={{ ...inp, width: 80 }} type="number" value={maxMarks} onChange={(e) => setMaxMarks(+e.target.value)} title="Max marks" />
      <input style={{ ...inp, width: 80 }} type="number" value={passMarks} onChange={(e) => setPassMarks(+e.target.value)} title="Pass marks" />
      <button style={{ ...primaryBtn, height: 38, fontSize: 12.5 }} disabled={!subjectId || !startsAt || add.isPending} onClick={() => add.mutate()}>
        {add.isPending ? 'Scheduling…' : 'Schedule'}
      </button>
      <button style={{ ...outlineBtn, height: 38, width: 38, padding: 0, justifyContent: 'center' }} onClick={() => setOpen(false)}><X size={14} /></button>
    </div>
  );
}

function PaperRow({ schedule, onChanged, canManage, canGrade, examStatus }: {
  schedule: any; onChanged: () => void; canManage: boolean; canGrade: boolean; examStatus: ExamStatus;
}) {
  const [alloc, setAlloc] = useState<AllocationResult | null>(null);
  const [sheet, setSheet] = useState(false);

  const allocate = useMutation({
    mutationFn: async () => (await api.post<AllocationResult>(`/exams/schedules/${schedule.id}/allocate-seats`)).data,
    onSuccess: (r) => { setAlloc(r); toast.success(`Seated ${r.seated}${r.refused ? ` · ${r.refused} refused` : ''}`); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
            {schedule.subject?.code} — {schedule.subject?.name}
          </div>
          <div style={{ fontSize: 12, color: T.ink3, marginTop: 3 }}>
            {fmtDateTime(schedule.startsAt)} · {schedule.durationMin} min · {schedule.maxMarks} marks (pass {schedule.passMarks})
            {schedule.room?.name ? ` · Room ${schedule.room.name}` : ''}
            {schedule.section?.name ? ` · ${schedule.section.name}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 12, color: T.ink3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Users size={13} /> {schedule._count?.seats ?? 0} seated
        </span>
        {canManage && (
          <button style={{ ...outlineBtn, height: 32, fontSize: 12 }} disabled={allocate.isPending} onClick={() => allocate.mutate()}>
            <Ticket size={13} /> {allocate.isPending ? 'Seating…' : 'Allocate seats'}
          </button>
        )}
        {/* Open to anyone who can see the exam; the sheet is read-only without assessment.grade. */}
        <button style={{ ...outlineBtn, height: 32, fontSize: 12 }} onClick={() => setSheet(!sheet)}>
          <PenLine size={13} /> {sheet ? 'Close sheet' : 'Marks & hall tickets'}
        </button>
      </div>

      {/* The refusals are the useful half — these are the students a registrar must chase. */}
      {alloc && (
        <div style={{ marginTop: 10, borderTop: `1px dashed ${T.border}`, paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: T.ink2 }}>
            <CheckCircle2 size={12} style={{ verticalAlign: -2, color: T.success }} /> {alloc.seated} seated
            {alloc.refused > 0 && <> · <ShieldAlert size={12} style={{ verticalAlign: -2, color: T.danger }} /> {alloc.refused} refused by the access gate</>}
          </div>
          {alloc.overCapacity && (
            <div style={{ marginTop: 6, fontSize: 12, color: T.amberDeep }}>
              <AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {alloc.overCapacity}
            </div>
          )}
          {alloc.refusals?.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {alloc.refusals.map((r) => (
                <div key={r.studentId} style={{ fontSize: 12, background: T.dangerBg, borderRadius: 8, padding: '6px 10px', color: T.ink }}>
                  <strong>{r.admissionNo}</strong> {r.name}
                  <div style={{ color: T.ink2, marginTop: 2 }}>{r.reasons.join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sheet && <MarksSheet scheduleId={schedule.id} canGrade={canGrade} canIssue={canManage} examStatus={examStatus} onChanged={onChanged} />}
    </div>
  );
}

/**
 * The paper's seated cohort: one row per student, mark and hall ticket side by
 * side. Marks are held locally and submitted together — the API validates every
 * row before writing any, so a partial save cannot happen.
 */
function MarksSheet({ scheduleId, canGrade, canIssue, examStatus, onChanged }: {
  scheduleId: string; canGrade: boolean; canIssue: boolean; examStatus: ExamStatus; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, { marks: string; absent: boolean }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['exam-seats', scheduleId],
    queryFn: async () => (await api.get<PaperSeats>(`/exams/schedules/${scheduleId}/seats`)).data,
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['exam-seats', scheduleId] }); onChanged(); };

  const rowOf = (seat: SeatRow) =>
    draft[seat.studentId] ?? {
      marks: seat.marksObtained === null || seat.marksObtained === undefined ? '' : String(seat.marksObtained),
      absent: seat.absent,
    };

  const set = (studentId: string, patch: Partial<{ marks: string; absent: boolean }>) =>
    setDraft((d) => ({ ...d, [studentId]: { ...(d[studentId] ?? { marks: '', absent: false }), ...patch } }));

  const save = useMutation({
    mutationFn: async (rows: MarkEntry[]) => (await api.post(`/exams/schedules/${scheduleId}/marks`, { rows })).data,
    onSuccess: (r: any) => { toast.success(`${r?.entered ?? 0} result(s) recorded`); setDraft({}); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const issue = useMutation({
    mutationFn: async (seatId: string) => (await api.post(`/exams/seats/${seatId}/hall-ticket`)).data,
    onSuccess: (r: any) => { toast.success(`Hall ticket ${r?.hallTicketSerial ?? 'issued'}`); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) return <div style={{ marginTop: 10, fontSize: 12.5, color: T.ink3 }}>Loading the sheet…</div>;
  if (!data) return null;
  if (!data.seats.length) {
    return (
      <div style={{ marginTop: 10, borderTop: `1px dashed ${T.border}`, paddingTop: 10, fontSize: 12.5, color: T.ink3 }}>
        Nobody is seated for this paper yet. Allocate seats first — marks and hall tickets both hang off a seat.
      </div>
    );
  }

  const locked = !canEnterMarks(examStatus);
  const errors = data.seats
    .map((seat) => { const r = rowOf(seat); const err = markError(r.marks, r.absent, data.maxMarks); return err ? `${seat.admissionNo}: ${err}` : null; })
    .filter(Boolean) as string[];

  const pending: MarkEntry[] = Object.entries(draft)
    .map(([studentId, r]) =>
      r.absent ? { studentId, absent: true }
      : r.marks.trim() === '' ? null
      : { studentId, marksObtained: Number(r.marks) })
    .filter(Boolean) as MarkEntry[];

  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: T.ink3, fontSize: 11.5 };

  return (
    <div style={{ marginTop: 10, borderTop: `1px dashed ${T.border}`, paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 12.5, color: T.ink }}>{data.subject}</strong>
        <span style={{ fontSize: 11.5, color: T.ink3 }}>{data.seats.length} seated · out of {data.maxMarks}, pass {data.passMarks}</span>
        <div style={{ flex: 1 }} />
        {locked && (
          <span style={{ fontSize: 11.5, color: T.ink3 }}>
            {examStatus === 'SETUP' ? 'Schedule a paper before entering marks.' : 'Results are approved — marks can no longer be edited.'}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={th}>Seat</th><th style={th}>Admission no</th><th style={th}>Student</th>
              <th style={th}>Hall ticket</th><th style={{ ...th, width: 110 }}>Marks</th><th style={{ ...th, width: 80 }}>Absent</th>
            </tr>
          </thead>
          <tbody>
            {data.seats.map((seat) => {
              const r = rowOf(seat);
              const err = markError(r.marks, r.absent, data.maxMarks);
              const failing = !r.absent && r.marks.trim() !== '' && !err && Number(r.marks) < data.passMarks;
              return (
                <tr key={seat.seatId} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '7px 8px', fontVariantNumeric: 'tabular-nums', color: T.ink2 }}>{seat.seatNo}</td>
                  <td style={{ padding: '7px 8px', fontWeight: 600, color: T.ink }}>{seat.admissionNo}</td>
                  <td style={{ padding: '7px 8px', color: T.ink }}>{seat.name}</td>
                  <td style={{ padding: '7px 8px' }}>
                    {seat.hallTicketSerial ? (
                      <span style={{ fontSize: 11.5, color: T.success, fontVariantNumeric: 'tabular-nums' }}>
                        <BadgeCheck size={12} style={{ verticalAlign: -2 }} /> {seat.hallTicketSerial}
                      </span>
                    ) : canIssue ? (
                      <button style={{ ...outlineBtn, height: 26, fontSize: 11, padding: '0 10px' }} disabled={issue.isPending} onClick={() => issue.mutate(seat.seatId)}>
                        <Download size={12} /> Issue
                      </button>
                    ) : (
                      <span style={{ fontSize: 11.5, color: T.ink3 }}>Not issued</span>
                    )}
                  </td>
                  <td style={{ padding: '7px 8px' }}>
                    <input
                      style={{ height: 28, width: 90, fontSize: 12, border: `1px solid ${err ? T.danger : failing ? T.amber : T.border}`, borderRadius: 8, padding: '0 8px', fontFamily: T.font, color: T.ink }}
                      inputMode="numeric" placeholder="—" disabled={!canGrade || locked || r.absent}
                      value={r.absent ? '' : r.marks} onChange={(e) => set(seat.studentId, { marks: e.target.value })}
                    />
                    {err && <div style={{ fontSize: 10.5, color: T.danger, marginTop: 2 }}>{err}</div>}
                  </td>
                  <td style={{ padding: '7px 8px' }}>
                    <input type="checkbox" disabled={!canGrade || locked} checked={r.absent} onChange={(e) => set(seat.studentId, { absent: e.target.checked })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canGrade && !locked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button style={{ ...primaryBtn, height: 32, fontSize: 12 }} disabled={!pending.length || errors.length > 0 || save.isPending} onClick={() => save.mutate(pending)}>
            {save.isPending ? 'Saving…' : `Save ${pending.length || ''} mark${pending.length === 1 ? '' : 's'}`.trim()}
          </button>
          {errors.length > 0 && (
            <span style={{ fontSize: 11.5, color: T.danger }}>
              <AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {errors.join(' · ')}
            </span>
          )}
          {!errors.length && !pending.length && (
            <span style={{ fontSize: 11.5, color: T.ink3 }}>Type a mark, or tick absent, to record a result.</span>
          )}
        </div>
      )}
    </div>
  );
}

function NewExamModal({ courses, terms, onClose }: { courses: { id: string; name: string }[]; terms: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'INTERNAL' | 'FINAL' | 'SUPPLEMENTARY' | 'RE_EXAM'>('FINAL');
  const [courseId, setCourseId] = useState('');
  const [termId, setTermId] = useState('');

  const create = useMutation({
    mutationFn: async () => (await api.post('/exams', {
      name: name.trim(), kind, ...(courseId ? { courseId } : {}), ...(termId ? { termId } : {}),
    })).data,
    onSuccess: () => { toast.success('Examination created'); qc.invalidateQueries({ queryKey: ['exams'] }); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,34,49,.34)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 460, maxWidth: '100%', boxShadow: T.shadow, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: T.ink, flex: 1 }}>New examination</h2>
          <button style={{ ...outlineBtn, height: 34, width: 34, padding: 0, justifyContent: 'center' }} onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Name">
            <input style={{ ...selectStyle, appearance: 'auto', cursor: 'text' }} placeholder="e.g. End-semester Examination" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Type">
            <select style={selectStyle} value={kind} onChange={(e) => setKind(e.target.value as any)}>
              {Object.entries(EXAM_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Course">
            <select style={selectStyle} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Not set</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <select style={selectStyle} value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">Not set</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button style={outlineBtn} onClick={onClose}>Cancel</button>
          <button style={primaryBtn} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create examination'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BacklogsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['exam-backlogs'],
    queryFn: async () => (await api.get<Backlog[]>('/exams/backlogs')).data,
  });
  if (isLoading) return <Empty text="Loading backlogs…" />;
  if (!data?.length) return <Empty text="No backlogs. A backlog appears when a published result is below the pass mark and has not since been cleared." />;
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {data.map((b, i) => (
        <div key={b.resultId} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.border}` : undefined, fontSize: 13, color: T.ink }}>
          <span style={{ width: 130, fontWeight: 600 }}>{b.admissionNo}</span>
          <span style={{ flex: 1 }}>{b.name}</span>
          <span style={{ width: 160, color: T.ink2 }}>{b.subject}</span>
          <span style={{ width: 150, color: T.ink3 }}>{b.exam}</span>
          <span style={{ width: 140, color: T.danger, fontSize: 12 }}>{backlogReason(b)}</span>
        </div>
      ))}
    </div>
  );
}
