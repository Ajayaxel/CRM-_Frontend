'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowUpCircle, ChevronRight, LifeBuoy, MessageSquare, Plus, Star, X,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  CATEGORY_LABEL, NEEDS_ASSIGNEE, NEEDS_NOTE, OFFERS_FEEDBACK, PRIORITY_LABEL,
  PRIORITY_TONE, RmsBoard, RmsCategory, RmsPolicy, RmsPriority, RmsStatus,
  RmsTicket, RmsTicketDetail, SLA_LABEL, SLA_TONE, STATUS_LABEL, STATUS_TONE,
  SlaState, fmtDateTime, raiserLabel, slaText,
} from '../rms-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function RmsFeature() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [breachedOnly, setBreachedOnly] = useState(false);

  /**
   * Raising is rms.view — reporting a problem is not an administrative act.
   * Everything that moves a ticket is rms.manage. Both are enforced again by
   * @RequirePermissions; hiding a control is courtesy, the guard is the control.
   */
  const { hasPermission } = useAuth();
  const canManage = hasPermission('rms.manage');

  const { data: board } = useQuery({
    queryKey: ['rms-board'],
    queryFn: async () => (await api.get<RmsBoard>('/rms/board')).data,
  });
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['rms', status, category, breachedOnly],
    queryFn: async () => (await api.get<RmsTicket[]>('/rms', {
      params: {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(breachedOnly ? { breached: 'true' } : {}),
      },
    })).data,
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Request desk</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          Student and staff requests across academic, IT, hostel, transport, finance and
          administration — with the SLA clock running on every one of them.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Open" value={board?.open ?? 0} />
        {/* Breach is derived from the clock on every read, never a stored flag. */}
        <Stat label="SLA breached" value={board?.breached ?? 0} accent="var(--danger,#c0392b)" />
        <Stat label="Escalated" value={board?.escalated ?? 0} accent="var(--gold,#c67c1e)" />
        <Stat label="Closed" value={board?.closed ?? 0} accent="var(--success,#1e874b)" />
        <Stat
          label="Mean rating"
          value={board?.meanRating === null || board?.meanRating === undefined ? '—' : board.meanRating}
          accent="var(--brand,#132376)"
        />
      </div>

      {board && board.total > 0 && (
        <div style={{ ...card, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
          {Object.entries(board.byCategory).map(([c, v]) => (
            <span key={c} style={{ color: v.open ? undefined : 'var(--ink-4,#9aa1ab)' }}>
              <strong>{CATEGORY_LABEL[c as RmsCategory] ?? c}</strong>{' '}
              {v.open} open{v.breached > 0 && <span style={{ color: 'var(--danger,#c0392b)' }}> · {v.breached} breached</span>}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" style={{ height: 34, width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {(Object.keys(STATUS_LABEL) as RmsStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="input" style={{ height: 34, width: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Any category</option>
          {(Object.keys(CATEGORY_LABEL) as RmsCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <button
          className="btn-secondary"
          style={{
            height: 34, fontSize: 12.5,
            borderColor: breachedOnly ? 'var(--danger,#c0392b)' : undefined,
            color: breachedOnly ? 'var(--danger,#c0392b)' : undefined,
          }}
          onClick={() => setBreachedOnly(!breachedOnly)}
        >
          <AlertTriangle size={13} /> Breached only
        </button>
        <div style={{ flex: 1 }} />
        <RaiseTicket />
      </div>

      {isLoading ? <Empty text="Loading requests…" />
        : !tickets?.length ? (
          <Empty text={
            breachedOnly ? 'Nothing has breached its SLA. That is the good outcome.'
            : status || category ? 'No requests match that filter.'
            : 'No requests yet. Anyone who can see this desk can raise one.'
          } />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {tickets.map((t) => (
              <div key={t.id} style={card}>
                <button
                  onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', width: 130 }}>{t.ticketNo}</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.subject}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {CATEGORY_LABEL[t.category]} · {raiserLabel(t)}
                      {t.assigneeName ? ` · ${t.assigneeName}` : ' · unassigned'}
                    </div>
                  </div>
                  {t.escalatedAt && <Pill text="escalated" tone={{ bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' }} />}
                  <Pill text={PRIORITY_LABEL[t.priority]} tone={PRIORITY_TONE[t.priority]} />
                  <Pill text={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
                  {/* The SLA badge carries the words, not just a colour. */}
                  <span style={{ width: 96, textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: SLA_TONE[t.sla.state as SlaState].fg }}>
                    {slaText(t.sla, t.status)}
                  </span>
                  <ChevronRight size={15} style={{ color: 'var(--ink-4,#9aa1ab)', transform: openId === t.id ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                </button>
                {openId === t.id && <TicketPanel ticketId={t.id} canManage={canManage} />}
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

function Empty({ text }: { text: string }) {
  return <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>;
}

function Pill({ text, tone }: { text: string; tone: { bg: string; fg: string } }) {
  return (
    <span style={{ background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function RaiseTicket() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RmsCategory>('ACADEMIC');
  const [priority, setPriority] = useState<RmsPriority>('MEDIUM');

  const { data: policy } = useQuery({
    queryKey: ['rms-policy'],
    queryFn: async () => (await api.get<RmsPolicy>('/rms/policy')).data,
  });

  const raise = useMutation({
    mutationFn: async () => (await api.post('/rms', { subject: subject.trim(), description: description.trim(), category, priority })).data,
    onSuccess: (t: any) => {
      toast.success(`Raised ${t?.ticketNo ?? 'request'}`);
      setSubject(''); setDescription(''); setOpen(false);
      qc.invalidateQueries({ queryKey: ['rms'] });
      qc.invalidateQueries({ queryKey: ['rms-board'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!open) {
    return <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} onClick={() => setOpen(true)}><Plus size={14} /> Raise a request</button>;
  }
  return (
    <div style={{ ...card, padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
      <input className="input" style={{ height: 34, width: 240 }} placeholder="What is wrong" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
      <input className="input" style={{ height: 34, flex: 1, minWidth: 220 }} placeholder="Detail — what happened, and when" value={description} onChange={(e) => setDescription(e.target.value)} />
      <select className="input" style={{ height: 34, width: 150 }} value={category} onChange={(e) => setCategory(e.target.value as RmsCategory)}>
        {(Object.keys(CATEGORY_LABEL) as RmsCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </select>
      <select className="input" style={{ height: 34, width: 130 }} value={priority} onChange={(e) => setPriority(e.target.value as RmsPriority)}>
        {(Object.keys(PRIORITY_LABEL) as RmsPriority[]).map((p) => (
          // The SLA the choice commits to, shown at the moment of choosing.
          <option key={p} value={p}>{PRIORITY_LABEL[p]}{policy ? ` · ${policy.slaHours[p]}h` : ''}</option>
        ))}
      </select>
      <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={!subject.trim() || !description.trim() || raise.isPending} onClick={() => raise.mutate()}>
        {raise.isPending ? 'Raising…' : 'Raise'}
      </button>
      <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => setOpen(false)}><X size={14} /></button>
    </div>
  );
}

function TicketPanel({ ticketId, canManage }: { ticketId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [escalating, setEscalating] = useState(false);

  const { data: t } = useQuery({
    queryKey: ['rms-ticket', ticketId],
    queryFn: async () => (await api.get<RmsTicketDetail>(`/rms/${ticketId}`)).data,
  });
  const { data: policy } = useQuery({
    queryKey: ['rms-policy'],
    queryFn: async () => (await api.get<RmsPolicy>('/rms/policy')).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['rms-ticket', ticketId] });
    qc.invalidateQueries({ queryKey: ['rms'] });
    qc.invalidateQueries({ queryKey: ['rms-board'] });
  };

  const move = useMutation({
    mutationFn: async (to: RmsStatus) => (await api.patch(`/rms/${ticketId}/status`, {
      status: to,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(NEEDS_ASSIGNEE.includes(to) && assigneeName.trim() ? { assigneeId: assigneeName.trim(), assigneeName: assigneeName.trim() } : {}),
      ...(OFFERS_FEEDBACK.includes(to) && rating !== null ? { feedbackRating: rating } : {}),
    })).data,
    onSuccess: () => { toast.success('Request updated'); setNote(''); setAssigneeName(''); setRating(null); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addComment = useMutation({
    mutationFn: async () => (await api.post(`/rms/${ticketId}/comments`, { message: comment.trim() })).data,
    onSuccess: () => { toast.success('Comment added'); setComment(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const escalate = useMutation({
    mutationFn: async () => (await api.post(`/rms/${ticketId}/escalate`, { note: note.trim() })).data,
    onSuccess: () => { toast.success('Escalated'); setNote(''); setEscalating(false); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!t) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>Loading…</div>;

  // The server's own list of legal next states — not a copy kept in the UI.
  const next = policy?.transitions[t.status] ?? [];

  return (
    <div style={{ borderTop: '1px solid var(--line-soft)', padding: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>{t.description}</div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 12 }}>
        <span>Raised {fmtDateTime(t.createdAt)}</span>
        <span>SLA {t.slaHours}h · due {fmtDateTime(t.dueAt)}</span>
        <span style={{ color: SLA_TONE[t.sla.state as SlaState].fg, fontWeight: 600 }}>
          {SLA_LABEL[t.sla.state as SlaState]} · {slaText(t.sla, t.status)}
        </span>
        <span>First response {t.firstResponseAt ? fmtDateTime(t.firstResponseAt) : 'not yet'}</span>
      </div>

      {t.escalationNote && (
        <div style={{ fontSize: 12, background: 'var(--gold-bg,#fdf2e2)', color: 'var(--ink-2)', borderRadius: 8, padding: '7px 10px', marginBottom: 10 }}>
          <ArrowUpCircle size={12} style={{ verticalAlign: -2 }} /> Escalated: {t.escalationNote}
        </div>
      )}
      {t.resolutionNote && (
        <div style={{ fontSize: 12, background: 'var(--success-bg,#e6f4ea)', color: 'var(--ink-2)', borderRadius: 8, padding: '7px 10px', marginBottom: 10 }}>
          Resolution: {t.resolutionNote}
        </div>
      )}
      {t.feedbackRating !== null && (
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <Star size={12} style={{ verticalAlign: -2, color: 'var(--gold,#c67c1e)' }} /> Rated {t.feedbackRating}/5
          {t.feedbackNote ? ` — ${t.feedbackNote}` : ''}
        </div>
      )}

      {canManage && next.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {/*
            Only what the server accepts from here, and the fields a particular
            arrival requires appear WITH it — a resolution needs a note and the
            request is refused without one, which is better learned before the
            click than from its rejection.
          */}
          {next.some((s) => NEEDS_ASSIGNEE.includes(s)) && (
            <input className="input" style={{ height: 32, width: 170 }} placeholder="Assign to" value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} />
          )}
          <input className="input" style={{ height: 32, width: 230 }} placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          {next.some((s) => OFFERS_FEEDBACK.includes(s)) && (
            <select className="input" style={{ height: 32, width: 130 }} value={rating ?? ''} onChange={(e) => setRating(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
            </select>
          )}
          {next.map((to) => {
            const needsNote = NEEDS_NOTE.includes(to) && !note.trim();
            const needsWho = NEEDS_ASSIGNEE.includes(to) && !assigneeName.trim() && !t.assigneeName;
            const blocked = needsNote || needsWho;
            return (
              <button
                key={to} className="btn-secondary" style={{ height: 32, fontSize: 12 }}
                disabled={blocked || move.isPending}
                title={needsNote ? 'This needs a note saying what was done' : needsWho ? 'This needs somebody to assign it to' : undefined}
                onClick={() => move.mutate(to)}
              >
                {STATUS_LABEL[to]}
              </button>
            );
          })}
          {!t.escalatedAt && ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status) && (
            escalating ? (
              <button className="btn-secondary" style={{ height: 32, fontSize: 12, color: 'var(--gold,#c67c1e)' }} disabled={!note.trim() || escalate.isPending} onClick={() => escalate.mutate()}>
                Confirm escalation
              </button>
            ) : (
              <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setEscalating(true)}>
                <ArrowUpCircle size={13} /> Escalate
              </button>
            )
          )}
        </div>
      )}
      {canManage && next.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
          {STATUS_LABEL[t.status]} is final — this request cannot be moved again.
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--ink-2)' }}>History</div>
      <div style={{ display: 'grid', gap: 5 }}>
        {/* Append-only: a correction is another row, never an edit. */}
        {t.events.map((ev) => (
          <div key={ev.id} style={{ display: 'flex', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--ink-3)', width: 150 }}>{fmtDateTime(ev.createdAt)}</span>
            <span style={{ width: 88, fontWeight: 600, color: 'var(--ink-2)' }}>{ev.type.toLowerCase().replace('_', ' ')}</span>
            <span style={{ flex: 1, minWidth: 160 }}>{ev.message}</span>
            <span style={{ color: 'var(--ink-3)' }}>{ev.author}</span>
          </div>
        ))}
      </div>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ height: 32, flex: 1, minWidth: 220 }} placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
            <MessageSquare size={13} /> Comment
          </button>
        </div>
      )}
    </div>
  );
}
