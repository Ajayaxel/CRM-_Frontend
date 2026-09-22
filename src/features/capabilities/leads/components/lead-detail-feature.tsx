'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, Phone, Mail, BookOpen, Calendar, Pencil, Trash2, Check, Clock, FileText, UploadCloud,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { SolarLeadPanel } from '@/features/verticals/solar/solar/components/solar-lead-panel';
import { leadVocab } from '@/lib/shell-copy';
import {
  LeadStage, SOURCE_LABELS, ScoreBreakdown, avatarStyle, leadInitials, leadName, scoreColor,
  scoreGrade, GRADE_META, gradeBadgeStyle, stageBadgeStyle, stageMeta, formatValue,
} from '../leads-utils';
import { formatDate } from '@/lib/utils';
import { labelFor } from '@/lib/org-locale';

type Tab = 'overview' | 'timeline' | 'notes' | 'tasks' | 'documents';

export function LeadDetailFeature({ id }: { id: string }) {
  const [editing, setEditing] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [mf, setMf] = useState({ subject: '', body: '' });
  const [followUp, setFollowUp] = useState(false);
  const [ff, setFf] = useState({ title: '', dueDate: '' });
  const [ef, setEf] = useState({ firstName: '', lastName: '', phone: '', email: '', priority: 'MEDIUM', expectedValue: '' });

  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, user } = useAuth();
  const vertical = user?.organization?.vertical;
  const vocab = leadVocab(vertical);
  const [tab, setTab] = useState<Tab>('overview');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => (await api.get(`/leads/${id}`)).data,
  });
  const { data: stages } = useQuery({
    queryKey: ['leads-stages'],
    queryFn: async () => (await api.get<LeadStage[]>('/leads/stages')).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['lead', id] });
    qc.invalidateQueries({ queryKey: ['lead-timeline', id] });
  };

  const changeStage = useMutation({
    mutationFn: (stageId: string) => api.patch(`/leads/${id}/stage`, { stageId }),
    onSuccess: () => { invalidate(); toast.success('Stage updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const convert = useMutation({
    mutationFn: () => api.post(`/leads/${id}/convert`, {}),
    onSuccess: (r) => { invalidate(); toast.success(`Converted to admission — ${r.data.admission.applicationNo}`); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  /**
   * A lead could be created and deleted but never corrected — no screen in the
   * product called PATCH /leads/:id. A phone typed wrong at first contact was
   * permanent, which is exactly the field the whole record exists to hold.
   */
  const save = useMutation({
    mutationFn: () => api.patch(`/leads/${id}`, {
      firstName: ef.firstName.trim(),
      lastName: ef.lastName.trim() || undefined,
      phone: ef.phone.trim() || undefined,
      email: ef.email.trim() || undefined,
      priority: ef.priority,
      expectedValue: ef.expectedValue === '' ? undefined : Number(ef.expectedValue),
    }),
    onSuccess: () => { toast.success('Lead updated'); setEditing(false); qc.invalidateQueries({ queryKey: ['lead', id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  /** Was a toast about a module that was "coming". It sends, as the tenant. */
  const sendEmail = useMutation({
    mutationFn: () => api.post(`/leads/${id}/email`, { subject: mf.subject, body: mf.body }),
    onSuccess: (r: any) => {
      toast.success(`Sent to ${r.data?.to ?? 'the lead'}`);
      setEmailing(false);
      setMf({ subject: '', body: '' });
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  /** A follow-up is a task with a date on it — the Tasks module already exists. */
  const createFollowUp = useMutation({
    mutationFn: () => api.post('/tasks', {
      title: ff.title.trim(),
      dueDate: ff.dueDate ? new Date(ff.dueDate).toISOString() : undefined,
      relatedType: 'LEAD',
      relatedId: id,
    }),
    onSuccess: () => {
      toast.success('Follow-up scheduled');
      setFollowUp(false);
      setFf({ title: '', dueDate: '' });
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/leads/${id}`),
    onSuccess: () => { toast.success('Lead deleted'); router.push('/leads'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !lead) {
    return <div style={{ color: 'var(--ink-3)' }}>Loading…</div>;
  }

  const canManage = hasPermission('lead.manage');
  const wonStage = stages?.find((s) => s.isWon);
  const lostStage = stages?.find((s) => s.isLost);
  const pendingStage = stages?.find((s) => s.name === 'Admission Pending'); // INSTITUTE stage name — only exists in institute tenants

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <button onClick={() => router.push('/leads')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', marginBottom: 18, padding: 0 }}>
        <ChevronLeft size={16} strokeWidth={2} />Back to Leads
      </button>

      {/* Header card */}
      <div className="card" style={{ borderRadius: 20, padding: '24px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={avatarStyle(lead.id, 60)}>{leadInitials(lead)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, whiteSpace: 'nowrap' }}>{leadName(lead)}</h1>
              <span style={stageBadgeStyle(lead.stage.name, lead.stage.color)}><span style={{ width: 7, height: 7, borderRadius: 99, background: stageMeta(lead.stage.name, lead.stage.color).dot }} />{lead.stage.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 7, fontSize: 13, color: 'var(--ink-2)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={14} strokeWidth={1.9} />{lead.phone ?? '—'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} strokeWidth={1.9} />{lead.email ?? '—'}</span>
              {vocab.interest && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={14} strokeWidth={1.9} />{lead.course?.name ?? '—'}</span>}
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <button
                className="btn-secondary" style={{ height: 40 }}
                onClick={() => {
                  setEditing(true);
                  setEf({
                    firstName: lead.firstName ?? '', lastName: lead.lastName ?? '',
                    phone: lead.phone ?? '', email: lead.email ?? '',
                    priority: lead.priority ?? 'MEDIUM',
                    expectedValue: lead.expectedValue == null ? '' : String(lead.expectedValue),
                  });
                }}
              >
                <Pencil size={15} strokeWidth={1.9} />Edit
              </button>
              <button
                className="btn-secondary" style={{ height: 40 }}
                title={lead.email ? `Email ${lead.email}` : 'This lead has no email address on record'}
                onClick={() => {
                  setEmailing(true);
                  setMf({ subject: '', body: `Hello ${lead.firstName},\n\n` });
                }}
              ><Mail size={15} strokeWidth={1.9} />Email</button>
              <button
                className="btn-secondary" style={{ height: 40 }}
                onClick={() => {
                  const t = new Date(); t.setDate(t.getDate() + 2);
                  setFollowUp(true);
                  setFf({ title: `Follow up with ${lead.firstName} ${lead.lastName ?? ''}`.trim(), dueDate: t.toISOString().slice(0, 10) });
                }}
              ><Calendar size={15} strokeWidth={1.9} />Follow-up</button>
              <button className="btn-secondary" style={{ height: 40, width: 40, padding: 0, color: 'var(--danger)' }} title="Delete lead" onClick={() => confirm('Delete this lead?') && remove.mutate()}><Trash2 size={15} strokeWidth={1.9} /></button>
              {!lead.student && !lead.admission && (
                labelFor(vertical, 'lead.convert') && <button className="btn-primary" style={{ height: 40 }} onClick={() => convert.mutate()} disabled={convert.isPending}><Check size={15} strokeWidth={2.2} />{labelFor(vertical, 'lead.convert')}</button>
              )}
              {lead.admission && !lead.student && (
                <span className="badge" style={{ height: 40, display: 'inline-flex', alignItems: 'center', background: 'var(--success-bg)', color: 'var(--success)', padding: '0 14px', borderRadius: 10, fontWeight: 600 }}><Check size={14} /> Admission {lead.admission.applicationNo} · {lead.admission.stage}</span>
              )}
            </div>
          )}

          {emailing && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Email {lead.firstName}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>
                {lead.email
                  ? <>Goes to <strong>{lead.email}</strong>, sent from your own address.</>
                  : 'This lead has no email address — add one with Edit first.'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><label className="label">Subject</label><input className="input" value={mf.subject} onChange={(e) => setMf({ ...mf, subject: e.target.value })} placeholder="Your motor quote" /></div>
                <div>
                  <label className="label">Message</label>
                  <textarea className="input" rows={7} style={{ resize: 'vertical', lineHeight: 1.6 }}
                            value={mf.body} onChange={(e) => setMf({ ...mf, body: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 14 }}>
                <button className="btn-secondary" onClick={() => setEmailing(false)}>Cancel</button>
                <button className="btn-primary" disabled={!lead.email || !mf.subject.trim() || !mf.body.trim() || sendEmail.isPending}
                        onClick={() => sendEmail.mutate()}>
                  {sendEmail.isPending ? 'Sending…' : 'Send email'}
                </button>
              </div>
            </div>
          )}

          {followUp && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Schedule a follow-up</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                <div><label className="label">What to do</label><input className="input" value={ff.title} onChange={(e) => setFf({ ...ff, title: e.target.value })} /></div>
                <div><label className="label">Due</label><input className="input" type="date" value={ff.dueDate} onChange={(e) => setFf({ ...ff, dueDate: e.target.value })} /></div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8 }}>It lands in Tasks, against this lead.</div>
              <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 14 }}>
                <button className="btn-secondary" onClick={() => setFollowUp(false)}>Cancel</button>
                <button className="btn-primary" disabled={!ff.title.trim() || createFollowUp.isPending} onClick={() => createFollowUp.mutate()}>
                  {createFollowUp.isPending ? 'Scheduling…' : 'Schedule'}
                </button>
              </div>
            </div>
          )}

          {editing && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Edit lead</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                <div><label className="label">First name</label><input className="input" value={ef.firstName} onChange={(e) => setEf({ ...ef, firstName: e.target.value })} /></div>
                <div><label className="label">Last name</label><input className="input" value={ef.lastName} onChange={(e) => setEf({ ...ef, lastName: e.target.value })} /></div>
                <div><label className="label">Phone</label><input className="input" value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></div>
                <div><label className="label">Email</label><input className="input" value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={ef.priority} onChange={(e) => setEf({ ...ef, priority: e.target.value })}>
                    <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                  </select>
                </div>
                <div>
                  <label className="label">Expected value</label>
                  <input className="input" inputMode="numeric" value={ef.expectedValue}
                         onChange={(e) => setEf({ ...ef, expectedValue: e.target.value.replace(/\D/g, '') })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 14 }}>
                <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn-primary" disabled={save.isPending || !ef.firstName.trim()} onClick={() => save.mutate()}>
                  {save.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {user?.organization?.vertical === 'SOLAR' && <SolarLeadPanel leadId={id} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Tabs card */}
        <div className="card" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '6px 24px 0', borderBottom: '1px solid var(--line-soft)', overflowX: 'auto' }}>
            {(['overview', 'timeline', 'notes', 'tasks', 'documents'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', textTransform: 'capitalize',
                  fontWeight: 600, fontSize: 13.5,
                  color: tab === t ? 'var(--navy)' : 'var(--ink-2)',
                  borderBottom: tab === t ? '2px solid var(--navy)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ padding: 24 }}>
            {tab === 'overview' && <OverviewTab lead={lead} />}
            {tab === 'timeline' && <TimelineTab id={id} />}
            {tab === 'notes' && <NotesTab id={id} canManage={canManage} />}
            {tab === 'tasks' && <TasksTab id={id} />}
            {tab === 'documents' && <DocumentsTab />}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ borderRadius: 18, padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Lead Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <Row label="Source" value={SOURCE_LABELS[lead.source] ?? lead.source} />
              <Row label={vocab.owner} value={lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName ?? ''}` : 'Unassigned'} />
              <Row label="Created" value={formatDate(lead.createdAt)} />
              <Row label={vocab.expectedValue} value={formatValue(lead.expectedValue)} />
            </div>
          </div>

          {canManage && (
            <div className="card" style={{ borderRadius: 18, padding: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Change Stage</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vertical === 'INSTITUTE' && pendingStage && <StageBtn dot="#132376" label="Move to Admission Pending" onClick={() => changeStage.mutate(pendingStage.id)} />}
                {/* "Converted" collided with Convert to client, which is a different
                    act entirely — this only moves the lead along the pipeline. */}
                {wonStage && <StageBtn dot="#00A63E" label={`Move to ${wonStage.name}`} onClick={() => changeStage.mutate(wonStage.id)} />}
                {lostStage && <StageBtn dot="#E7000B" danger label={`Move to ${lostStage.name}`} onClick={() => changeStage.mutate(lostStage.id)} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StageBtn({ dot, label, onClick, danger }: { dot: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="stage-btn"
      style={{ width: '100%', textAlign: 'left', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: danger ? 'var(--danger)' : 'var(--ink)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 99, background: dot }} />{label}
      <style>{`.stage-btn:hover{background:var(--surface-2);}`}</style>
    </button>
  );
}

function OverviewTab({ lead }: { lead: any }) {
  const stat = (label: string, value: React.ReactNode) => (
    <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
  const grade = scoreGrade(lead.score);
  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 22 }}>
        {stat('Expected Fee', formatValue(lead.expectedValue))}
        {stat('Lead Score', <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span><span style={{ color: scoreColor(lead.score) }}>{lead.score}</span><span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>/100</span></span><span style={{ ...gradeBadgeStyle(grade), fontSize: 12 }}>{GRADE_META[grade].emoji} {GRADE_META[grade].label}</span></span>)}
        {stat('Last Contact', lead.lastActivityAt ? formatDate(lead.lastActivityAt) : '—')}
      </div>

      <ScoreBreakdownPanel id={lead.id} />

      <div className="eyebrow" style={{ margin: '22px 0 12px' }}>Interest Summary</div>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
        {leadName(lead)} enquired {lead.course ? <>about the <strong style={{ color: 'var(--ink)' }}>{lead.course.name}</strong> </> : ''}
        via {SOURCE_LABELS[lead.source] ?? lead.source}. Recommended next step: schedule a follow-up call and share the batch calendar.
      </p>
    </div>
  );
}

function ScoreBreakdownPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['lead-score', id],
    queryFn: async () => (await api.get<ScoreBreakdown>(`/leads/${id}/score`)).data,
  });
  const rescore = useMutation({
    mutationFn: async () => (await api.post(`/leads/${id}/rescore`)).data as ScoreBreakdown,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-score', id] }); qc.invalidateQueries({ queryKey: ['lead', id] }); toast.success('Score recalculated'); },
  });
  if (!data?.factors?.length) return null;
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="eyebrow">Why this score</div>
        <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={rescore.isPending} onClick={() => rescore.mutate()}>{rescore.isPending ? 'Recalculating…' : 'Recalculate'}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.factors.map((f) => {
          const pct = f.max ? Math.round((f.points / f.max) * 100) : 0;
          const col = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--gold)' : 'var(--ink-3)';
          return (
            <div key={f.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                <span style={{ fontWeight: 600 }}>{f.label} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {f.detail}</span></span>
                <span style={{ fontWeight: 700, color: col }}>{f.points}<span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>/{f.max}</span></span>
              </div>
              <div style={{ height: 6, background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 20 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineTab({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ['lead-timeline', id],
    queryFn: async () => (await api.get(`/leads/${id}/timeline`)).data as any[],
  });
  return (
    <div style={{ animation: 'fadeUp .3s ease', position: 'relative', paddingLeft: 6 }}>
      <div style={{ position: 'absolute', left: 21, top: 6, bottom: 6, width: 2, background: 'var(--line-soft)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {data?.map((e) => (
          <div key={e.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
            <span style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--surface)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 32px', zIndex: 1, boxShadow: '0 0 0 4px var(--surface)', border: '1px solid var(--line)' }}>
              <Clock size={15} strokeWidth={1.9} />
            </span>
            <div style={{ minWidth: 0, background: 'var(--surface-2)', borderRadius: 14, padding: '14px 16px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{prettyAction(e.action)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{formatDate(e.createdAt)}</div>
              </div>
              {e.actor && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 7 }}>— {e.actor.firstName} {e.actor.lastName ?? ''}</div>}
            </div>
          </div>
        ))}
        {data?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No activity yet.</div>}
      </div>
    </div>
  );
}

function NotesTab({ id, canManage }: { id: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const { data } = useQuery({
    queryKey: ['lead-notes', id],
    queryFn: async () => (await api.get(`/leads/${id}/notes`)).data as any[],
  });
  const add = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { body: draft }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-notes', id] }); setDraft(''); toast.success('Note added'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      {canManage && (
        <>
          <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note about this lead…" rows={3} style={{ resize: 'vertical', marginBottom: 10 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
            <button className="btn-primary" style={{ height: 38 }} disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()}>Add Note</button>
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data?.map((n) => (
          <div key={n.id} style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '15px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.author?.firstName} {n.author?.lastName ?? ''}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{formatDate(n.createdAt)}</div>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, marginTop: 6 }}>{n.body}</div>
          </div>
        ))}
        {data?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No notes yet.</div>}
      </div>
    </div>
  );
}

function TasksTab({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ['lead-tasks', id],
    queryFn: async () => (await api.get(`/leads/${id}/tasks`)).data as any[],
  });
  if (!data?.length) return <div style={{ color: 'var(--ink-3)', fontSize: 13, animation: 'fadeUp .3s ease' }}>No tasks linked to this lead yet.</div>;
  return (
    <div style={{ animation: 'fadeUp .3s ease', display: 'flex', flexDirection: 'column', gap: 11 }}>
      {data.map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid var(--line)', flex: '0 0 20px' }} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.title}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.dueDate ? formatDate(t.dueDate) : 'No due date'}</div></div>
        </div>
      ))}
    </div>
  );
}

function DocumentsTab() {
  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ border: '1.5px dashed var(--line)', borderRadius: 14, padding: 26, textAlign: 'center', marginBottom: 16 }}>
        <UploadCloud size={26} strokeWidth={1.6} color="var(--ink-3)" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>Drop files or click to upload</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>PDF, JPG, PNG · up to 10MB — arrives with the Documents module</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', border: '1px solid var(--line-soft)', borderRadius: 13, color: 'var(--ink-3)', fontSize: 13 }}>
        <FileText size={16} />No documents uploaded yet.
      </div>
    </div>
  );
}

function prettyAction(action: string) {
  const map: Record<string, string> = {
    'lead.created': 'Lead created',
    'lead.stage_changed': 'Stage changed',
    'lead.assigned': 'Lead assigned',
    'lead.converted': 'Lead converted',
  };
  return map[action] ?? action.replace(/[._]/g, ' ');
}
