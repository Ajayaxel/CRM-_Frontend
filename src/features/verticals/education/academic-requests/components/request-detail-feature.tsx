'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle2, Clock, GraduationCap, CalendarClock, X, ChevronRight, AlertTriangle, DoorOpen, Users,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { T } from '@/features/verticals/education/institute-dashboard';
import { RequestDetail, Candidate, TYPE_LABEL, STATUS_LABEL, STATUS_ORDER, RequestStatus } from '../academic-requests-client';

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius };
const btnP: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, border: 'none', background: T.brand, color: '#fff' };
const btnS: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, background: T.surface, color: T.ink, border: `1px solid ${T.border}` };

const RESOLUTIONS = [
  'Add two extra hours this week',
  'Extend the subject into the buffer week',
  'Reallocate the backlog to a substitute',
  'Reduce scope with department approval',
];

export function RequestDetailFeature({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: r, isLoading } = useQuery({ queryKey: ['acad-request', id], queryFn: async () => (await api.get<RequestDetail>(`/academic-requests/${id}`)).data });
  const [showResolve, setShowResolve] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['acad-request', id] }); qc.invalidateQueries({ queryKey: ['acad-requests'] }); };

  const act = (path: string, ok: string, body?: any) => useMutation({
    mutationFn: async () => (await api.post(`/academic-requests/${id}/${path}`, body ?? {})).data,
    onSuccess: () => { toast.success(ok); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const review = act('review', 'Taken under review');
  const complete = act('complete', 'Marked completed');
  const reject = useMutation({
    mutationFn: async (reason: string) => (await api.post(`/academic-requests/${id}/reject`, { reason })).data,
    onSuccess: () => { toast.success('Request rejected'); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const modify = useMutation({
    mutationFn: async (note: string) => (await api.post(`/academic-requests/${id}/modification`, { note })).data,
    onSuccess: () => { toast.success('Modification requested'); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !r) return <div style={{ padding: 40, color: T.ink3, fontFamily: T.font }}>Loading request…</div>;
  const st = statusTone(r.status);

  return (
    <div style={{ animation: 'fadeUp .4s ease', fontFamily: T.font, color: T.ink }}>
      <button onClick={() => router.push('/academic-requests')} style={{ ...btnS, height: 30, marginBottom: 14 }}><ArrowLeft size={14} /> Request queue</button>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{r.code} · {TYPE_LABEL[r.type]}</h1>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.fg }}>{STATUS_LABEL[r.status].toUpperCase()}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#eef0f2', color: T.ink2 }}>{r.priority[0] + r.priority.slice(1).toLowerCase()} priority</span>
          </div>
          <p style={{ fontSize: 13.5, color: T.ink2, margin: '6px 0 0' }}>
            {r.subject?.name} · {r.batch ? `${r.batch.name} — Division ${r.batch.division}` : ''} · Raised by {r.requesterName ?? '—'}
          </p>
          {r.reason && <p style={{ fontSize: 13, color: T.ink3, margin: '6px 0 0' }}>“{r.reason}”</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.status === 'SUBMITTED' && <button style={btnP} disabled={review.isPending} onClick={() => review.mutate()}>Take under review</button>}
          {r.status === 'UNDER_REVIEW' && <>
            <button style={btnS} onClick={() => { const n = prompt('What modification is needed?'); if (n) modify.mutate(n); }}>Request modification</button>
            <button style={{ ...btnS, color: T.danger }} onClick={() => { const n = prompt('Reason for rejection?'); if (n) reject.mutate(n); }}>Reject</button>
            <button style={btnP} onClick={() => setShowResolve(true)}>Approve changes</button>
          </>}
          {r.status === 'APPROVED' && <button style={btnP} onClick={() => setShowResolve(true)}><CalendarClock size={15} /> Resolve &amp; schedule</button>}
          {r.status === 'SCHEDULED' && <button style={btnP} disabled={complete.isPending} onClick={() => complete.mutate()}><CheckCircle2 size={15} /> Mark completed</button>}
          {(r.status === 'SUBMITTED' || r.status === 'APPROVED') && <button style={{ ...btnS, color: T.danger }} onClick={() => { const n = prompt('Reason for rejection?'); if (n) reject.mutate(n); }}>Reject</button>}
        </div>
      </div>

      {/* status tracker */}
      <div style={{ ...card, padding: '16px 20px', marginBottom: 16 }}><Stepper status={r.status} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {/* academic context */}
          {r.academic && (
            <Panel icon={<GraduationCap size={16} />} title="Academic context">
              {r.academic.behindHours != null && r.academic.behindHours > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.amberBg, color: T.amberDeep, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, fontWeight: 600 }}>
                  <AlertTriangle size={15} /> {r.subject?.name} is {r.academic.behindHours} h behind plan
                </div>
              )}
              <Grid items={[
                ['Subject', r.academic.subject ?? '—'],
                ['Completion', `${r.academic.completionPct}%`],
                ['Planned hours', `${r.academic.plannedHours} h`],
                ['Completed', `${r.academic.completedHours} h`],
                ['Remaining', `${r.academic.remainingHours} h`],
                ['Additional requested', `+${r.academic.additionalHours} h`],
                ['Planned completion', r.academic.plannedCompletion ? new Date(r.academic.plannedCompletion).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
              ]} />
            </Panel>
          )}
          {/* operational context */}
          {r.operational && (
            <Panel icon={<CalendarClock size={16} />} title="Operational context">
              <Grid items={[
                ['Faculty free periods', `${r.operational.facultyFreePeriods}`],
                ['Batch free periods', `${r.operational.batchFreePeriods}`],
                ['Batch weekly load', `${r.operational.batchWeeklyLoad}`],
                ['Faculty weekly load', `${r.operational.facultyWeeklyLoad}`],
              ]} />
              {r.operational.otherSubjects.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: T.ink3, marginBottom: 6 }}>Other subjects in the same batch</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.operational.otherSubjects.map((s) => <span key={s} style={{ fontSize: 11.5, fontWeight: 600, background: T.bg, border: `1px solid ${T.border}`, padding: '3px 9px', borderRadius: 7 }}>{s}</span>)}
                  </div>
                </div>
              )}
            </Panel>
          )}
          {/* scheduled outcome or candidate slots */}
          {r.scheduled ? (
            <Panel icon={<CheckCircle2 size={16} />} title="Scheduled">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                <span style={{ fontWeight: 700 }}>{r.scheduled.day} · {r.scheduled.slot}</span>
                <span style={{ color: T.ink3 }}>{r.scheduled.time}</span>
                {r.scheduled.room && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.ink3 }}><DoorOpen size={13} /> {r.scheduled.room}</span>}
              </div>
              {r.resolutionNote && <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 8 }}>Resolution: {r.resolutionNote}</div>}
            </Panel>
          ) : r.candidates.length > 0 ? (
            <Panel icon={<CalendarClock size={16} />} title="Candidate slots considered">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ textAlign: 'left', color: T.ink3, fontSize: 10.5 }}><th style={{ padding: '6px 8px', fontWeight: 700 }}>SLOT</th><th style={{ padding: '6px 8px', fontWeight: 700 }}>AVAILABILITY</th><th style={{ padding: '6px 8px', fontWeight: 700 }}>ROOM</th></tr></thead>
                <tbody>
                  {r.candidates.map((c) => (
                    <tr key={`${c.dayOfWeek}:${c.timeSlotId}`} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '9px 8px', fontWeight: 600 }}>{c.day} {c.slot}<div style={{ fontSize: 11, color: T.ink3, fontWeight: 400 }}>{c.time}</div></td>
                      <td style={{ padding: '9px 8px', color: T.success }}>{c.availability}</td>
                      <td style={{ padding: '9px 8px', color: T.ink2 }}>{c.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}
        </div>

        {/* status history */}
        <Panel icon={<Clock size={16} />} title="Status history">
          <div style={{ display: 'grid', gap: 0 }}>
            {r.history.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: i === 0 ? T.brand : T.border, marginTop: 4 }} />
                  {i < r.history.length - 1 && <span style={{ flex: 1, width: 1, background: T.border }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{STATUS_LABEL[h.to as RequestStatus] ?? h.to}</div>
                  <div style={{ fontSize: 11.5, color: T.ink3 }}>{h.actor} · {new Date(h.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  {h.note && <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 2 }}>{h.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {showResolve && <ResolveModal r={r} onClose={() => setShowResolve(false)} onDone={() => { setShowResolve(false); refresh(); }} />}
    </div>
  );
}

function Stepper({ status }: { status: RequestStatus }) {
  if (status === 'REJECTED') {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.dangerText, fontSize: 13, fontWeight: 700 }}><X size={16} /> Rejected — this request will not be scheduled.</div>;
  }
  const at = STATUS_ORDER.indexOf(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {STATUS_ORDER.map((s, i) => (
        <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', background: i <= at ? T.brand : T.bg, border: `1px solid ${i <= at ? T.brand : T.border}`, color: i <= at ? '#fff' : T.ink3, fontSize: 11, fontWeight: 700 }}>
            {i < at ? <CheckCircle2 size={13} /> : i + 1}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: i === at ? 700 : 500, color: i <= at ? T.ink : T.ink3 }}>{STATUS_LABEL[s]}</span>
          {i < STATUS_ORDER.length - 1 && <ChevronRight size={14} style={{ color: T.ink3, margin: '0 4px' }} />}
        </span>
      ))}
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center' }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
function Grid({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 14 }}>
      {items.map(([k, v]) => <div key={k}><div style={{ fontSize: 11, color: T.ink3 }}>{k}</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{v}</div></div>)}
    </div>
  );
}

function ResolveModal({ r, onClose, onDone }: { r: RequestDetail; onClose: () => void; onDone: () => void }) {
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [cand, setCand] = useState<Candidate | null>(r.candidates[0] ?? null);
  const isApprove = r.status === 'UNDER_REVIEW';

  const approve = useMutation({
    mutationFn: async () => (await api.post(`/academic-requests/${r.id}/approve`, { note: resolution })).data,
    onSuccess: () => { toast.success('Approved'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const schedule = useMutation({
    mutationFn: async () => (await api.post(`/academic-requests/${r.id}/schedule`, { dayOfWeek: cand!.dayOfWeek, timeSlotId: cand!.timeSlotId, roomId: cand!.roomId, resolution })).data,
    onSuccess: () => { toast.success('Scheduled into the timetable'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,34,49,.42)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 620, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: T.shadow, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{TYPE_LABEL[r.type]}</h2>
            {r.academic?.behindHours ? <p style={{ fontSize: 13, color: T.ink2, margin: '4px 0 0' }}>{r.subject?.name} is {r.academic.behindHours} h behind plan</p> : null}
          </div>
          <button style={{ ...btnS, height: 34, width: 34, padding: 0, justifyContent: 'center' }} onClick={onClose}><X size={15} /></button>
        </div>

        {r.academic && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '16px 0', padding: 14, background: T.bg, borderRadius: 12 }}>
            <Kv k="Planned" v={`${r.academic.plannedHours} h`} /><Kv k="Delivered" v={`${r.academic.completedHours} h`} /><Kv k="Remaining" v={`${r.academic.remainingHours} h`} />
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 10px' }}>How should this be resolved?</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {RESOLUTIONS.map((opt, i) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${resolution === opt ? T.brand : T.border}`, background: resolution === opt ? T.brandSubtle : T.surface }}>
              <input type="radio" checked={resolution === opt} onChange={() => setResolution(opt)} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{opt}</span>
              {i === 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.success, background: T.successBg, padding: '2px 8px', borderRadius: 999 }}>Recommended</span>}
            </label>
          ))}
        </div>

        {!isApprove && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, margin: '18px 0 10px' }}>Into which slot?</div>
            {r.candidates.length === 0 ? <div style={{ fontSize: 12.5, color: T.ink3 }}>No free slot is available right now — free a slot on the timetable first.</div> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {r.candidates.map((c) => (
                  <label key={`${c.dayOfWeek}:${c.timeSlotId}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${cand?.timeSlotId === c.timeSlotId && cand?.dayOfWeek === c.dayOfWeek ? T.brand : T.border}` }}>
                    <input type="radio" checked={cand?.timeSlotId === c.timeSlotId && cand?.dayOfWeek === c.dayOfWeek} onChange={() => setCand(c)} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.day} · {c.slot} <span style={{ color: T.ink3, fontWeight: 400 }}>{c.time}</span></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.ink3 }}><DoorOpen size={12} /> {c.room}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button style={btnS} onClick={onClose}>Cancel</button>
          {isApprove
            ? <button style={{ ...btnP, opacity: approve.isPending ? 0.6 : 1 }} disabled={approve.isPending} onClick={() => approve.mutate()}>Approve change</button>
            : <button style={{ ...btnP, opacity: !cand || schedule.isPending ? 0.6 : 1 }} disabled={!cand || schedule.isPending} onClick={() => schedule.mutate()}>Confirm &amp; schedule</button>}
        </div>
      </div>
    </div>
  );
}
function Kv({ k, v }: { k: string; v: string }) { return <div><div style={{ fontSize: 11, color: T.ink3 }}>{k}</div><div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{v}</div></div>; }

function statusTone(s: RequestStatus) {
  const m: Record<RequestStatus, { bg: string; fg: string }> = {
    SUBMITTED: { bg: T.brandSubtle, fg: T.brandText }, UNDER_REVIEW: { bg: '#eef0f2', fg: T.ink2 },
    APPROVED: { bg: T.successBg, fg: T.success }, REJECTED: { bg: T.dangerBg, fg: T.dangerText },
    SCHEDULED: { bg: '#fbe3da', fg: '#8c2f1b' }, COMPLETED: { bg: T.successBg, fg: T.success },
  };
  return m[s];
}
