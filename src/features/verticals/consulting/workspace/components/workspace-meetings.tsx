'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarPlus, ChevronLeft, Plus, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { card, Due, Empty, Loading, Pill, Row, SectionTitle } from './shared';
import { CsMeeting, CsMeetingType, humanEnum, MeetingPrep, shortDate } from '../workspace-client';

const TYPES: CsMeetingType[] = ['CHAIRMAN', 'BOARD', 'CEO', 'WEEKLY_REVIEW', 'DEPARTMENT', 'VENDOR', 'PROJECT', 'STRATEGY', 'OTHER'];

export function WorkspaceMeetings({ companyId, meetings, loading }: {
  companyId: string;
  meetings: CsMeeting[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('consulting.meeting.manage');
  const [compose, setCompose] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/consulting/meetings', { companyId, ...body }),
    onSuccess: () => {
      toast.success('Meeting scheduled');
      setCompose(false);
      qc.invalidateQueries({ queryKey: ['cs-meetings', companyId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (loading) return <Loading label="Reading the meetings" />;
  if (reviewing) return <WeeklyReview meetingId={reviewing} onBack={() => setReviewing(null)} />;

  const scheduled = meetings.filter((m) => m.status === 'SCHEDULED').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const held = meetings.filter((m) => m.status === 'HELD').sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  return (
    <div>
      <SectionTitle
        right={canManage ? <button className="btn-primary" onClick={() => setCompose(true)}><CalendarPlus size={14} /> Schedule</button> : undefined}
      >
        Coming up
      </SectionTitle>
      {scheduled.length === 0 ? (
        <Empty
          title="Nothing scheduled"
          hint="A meeting here is an operational object: it raises issues, records decisions and leaves owned actions behind."
          action={canManage ? <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={14} /> Schedule one</button> : undefined}
        />
      ) : (
        <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
          {scheduled.map((m) => (
            <Row key={m.id}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', width: 62 }}>{m.ref}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {humanEnum(m.type)}{m._count ? ` · ${m._count.agenda} agenda item(s)` : ''}
                </div>
              </div>
              <Due date={m.scheduledAt} />
              {/* The screen that makes a weekly review possible without anyone
                  preparing it by hand (spec §15). */}
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setReviewing(m.id)}>Prepare</button>
            </Row>
          ))}
        </div>
      )}

      <SectionTitle>Held</SectionTitle>
      {held.length === 0 ? (
        <Empty title="No minutes yet" />
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {held.map((m) => (
            <Row key={m.id}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', width: 62 }}>{m.ref}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {m._count ? `${m._count.issues} issue(s) · ${m._count.decisions} decision(s) · ${m._count.actions} action(s)` : humanEnum(m.type)}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{shortDate(m.scheduledAt)}</span>
              <Pill>Held</Pill>
            </Row>
          ))}
        </div>
      )}

      {compose ? (
        <ComposeMeeting
          busy={create.isPending}
          previous={held[0]?.id}
          onClose={() => setCompose(false)}
          onSubmit={(body) => create.mutate(body)}
        />
      ) : null}
    </div>
  );
}

/**
 * The weekly review, assembled rather than written.
 *
 * Every list on this screen comes from GET /consulting/meetings/:id/prepare,
 * which is a pure read over records the consultant already keeps: last
 * meeting's unfinished actions, the company's critical issues, decisions still
 * waiting, overdue tasks, KPI movement. Spec §15's "before the meeting" is
 * therefore not a document somebody produces — it is a query.
 */
function WeeklyReview({ meetingId, onBack }: { meetingId: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cs-meeting-prep', meetingId],
    queryFn: async () => (await api.get<MeetingPrep>(`/consulting/meetings/${meetingId}/prepare`)).data,
  });

  if (isLoading) return <Loading label="Preparing the review" />;
  if (!data) return <Empty title="Could not prepare this meeting" />;

  const blocks: { title: string; rows: { key: string; primary: string; secondary?: string; trailing?: string }[] }[] = [
    {
      title: 'Carried over from last time',
      rows: data.carriedActions.map((a) => ({ key: a.id, primary: a.title, secondary: humanEnum(a.status), trailing: shortDate(a.dueDate) })),
    },
    {
      title: 'Open action items',
      rows: data.openActions.map((a) => ({ key: a.id, primary: a.title, secondary: a.issue ? a.issue.ref : humanEnum(a.status), trailing: shortDate(a.dueDate) })),
    },
    {
      title: 'Critical issues',
      rows: data.criticalIssues.map((i) => ({ key: i.id, primary: i.title, secondary: `${i.ref} · ${humanEnum(i.status)}`, trailing: shortDate(i.dueDate) })),
    },
    {
      title: 'Decisions waiting',
      rows: data.pendingDecisions.map((d) => ({ key: d.id, primary: d.title, secondary: humanEnum(d.status), trailing: shortDate(d.dueDate) })),
    },
    {
      title: 'Overdue tasks',
      rows: data.overdueTasks.map((t) => ({ key: t.id, primary: t.title, secondary: t.ref, trailing: shortDate(t.dueDate) })),
    },
    {
      title: 'KPI movement',
      rows: data.kpiMovement.map((k) => ({
        key: k.id,
        primary: k.name,
        secondary: k.latest ? `${k.latest.value}${k.unit ? ` ${k.unit}` : ''}` : 'no reading',
        trailing: humanEnum(k.movement),
      })),
    },
    {
      title: 'Upcoming milestones',
      rows: data.upcomingMilestones.map((m) => ({ key: m.id, primary: m.name, secondary: humanEnum(m.status), trailing: shortDate(m.targetDate) })),
    },
  ];

  return (
    <div>
      <button className="btn-ghost" style={{ marginBottom: 10 }} onClick={onBack}><ChevronLeft size={15} /> Meetings</button>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{data.meeting.title}</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 18px' }}>
        {humanEnum(data.meeting.type)} · {shortDate(data.meeting.scheduledAt)} · nothing on this page was typed up for it
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
        {blocks.map((b) => (
          <section key={b.title}>
            <SectionTitle>{b.title}</SectionTitle>
            {b.rows.length === 0 ? (
              <div style={{ ...card, padding: '14px 16px', fontSize: 13, color: 'var(--ink-3)' }}>Nothing</div>
            ) : (
              <div style={{ ...card, overflow: 'hidden' }}>
                {b.rows.map((r) => (
                  <Row key={r.key}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.primary}</div>
                      {r.secondary ? <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{r.secondary}</div> : null}
                    </div>
                    {r.trailing ? <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.trailing}</span> : null}
                  </Row>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function ComposeMeeting({ onClose, onSubmit, busy, previous }: {
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  busy: boolean;
  previous?: string;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CsMeetingType>('WEEKLY_REVIEW');
  const [scheduledAt, setScheduledAt] = useState('');
  const [agenda, setAgenda] = useState('');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 'min(520px,100%)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Schedule a meeting</h2>
          <button className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Title</label>
        <input className="input" style={{ width: '100%', marginBottom: 10 }} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Type</label>
            <select className="input" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value as CsMeetingType)}>
              {TYPES.map((t) => <option key={t} value={t}>{humanEnum(t)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>When</label>
            <input type="datetime-local" className="input" style={{ width: '100%' }} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
        </div>

        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Agenda — one line each</label>
        <textarea className="input" style={{ width: '100%', marginBottom: 16, minHeight: 80 }} value={agenda} onChange={(e) => setAgenda(e.target.value)} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!title.trim() || !scheduledAt || busy}
            onClick={() => onSubmit({
              title: title.trim(),
              type,
              scheduledAt: new Date(scheduledAt).toISOString(),
              // Linking to the last meeting held is what makes the review a
              // series — `prepare` reads it for unfinished actions.
              ...(previous ? { previousMeetingId: previous } : {}),
              ...(agenda.trim()
                ? { agenda: agenda.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ title: l })) }
                : {}),
            })}
          >
            {busy ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
