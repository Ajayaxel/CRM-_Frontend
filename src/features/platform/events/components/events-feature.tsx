'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Eye, EyeOff, MapPin, Plus, Trash2, Users, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { JoinButton, MeetingDraft, MeetingFields, MeetingJoin, emptyMeeting, meetingError, meetingPayload } from '@/features/capabilities/meetings';
import {
  CATEGORY_LABEL, CATEGORY_TONE, CampusEvent, EventCategory, PHASE_LABEL, PHASE_TONE,
  audienceOf, closesTooLate, datesInvalid, fmtDateTime, phaseOf, toIso,
} from '../events-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function EventsFeature() {
  const qc = useQueryClient();
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [adding, setAdding] = useState(false);

  /**
   * These five routes carried NO permission decorator until this feature was
   * built — a Viewer could create, edit and delete a campus event. They are
   * guarded now; hiding the buttons is courtesy, the guard is the control.
   */
  const { hasPermission } = useAuth();
  const canManage = hasPermission('event.manage');

  const { data: events, isLoading } = useQuery({
    queryKey: ['campus-events', upcomingOnly],
    queryFn: async () => (await api.get<CampusEvent[]>('/campus-events', {
      params: upcomingOnly ? { upcoming: '1' } : {},
    })).data,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['campus-events'] });

  const now = Date.now();
  const published = (events ?? []).filter((e) => e.published).length;
  const openForRegistration = (events ?? []).filter((e) => phaseOf(e, now) === 'REGISTRATION_OPEN').length;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Events &amp; fests</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          The campus calendar students see in their portal. An unpublished event is one they cannot.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label={upcomingOnly ? 'Upcoming' : 'All events'} value={events?.length ?? 0} />
        <Stat label="Published" value={published} accent="var(--success,#1e874b)" />
        <Stat label="Registration open" value={openForRegistration} accent="var(--brand,#132376)" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn-secondary"
          style={{
            height: 34, fontSize: 12.5,
            borderColor: upcomingOnly ? 'var(--brand,#132376)' : undefined,
            color: upcomingOnly ? 'var(--brand,#132376)' : undefined,
          }}
          onClick={() => setUpcomingOnly(!upcomingOnly)}
        >
          <CalendarDays size={13} /> {upcomingOnly ? 'Upcoming only' : 'Including past'}
        </button>
        <div style={{ flex: 1 }} />
        {canManage && !adding && (
          <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} onClick={() => setAdding(true)}>
            <Plus size={14} /> New event
          </button>
        )}
      </div>

      {adding && canManage && <EventForm onDone={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}

      {isLoading ? <Empty text="Loading the calendar…" />
        : !events?.length ? (
          <Empty text={upcomingOnly
            ? 'Nothing coming up. Switch to "Including past" to see what has already run.'
            : 'No events yet.'} />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {events.map((e) => <EventRow key={e.id} event={e} canManage={canManage} onChanged={refresh} />)}
          </div>
        )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
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

function EventRow({ event, canManage, onChanged }: { event: CampusEvent; canManage: boolean; onChanged: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const phase = phaseOf(event);

  const publish = useMutation({
    mutationFn: async () => (await api.patch(`/campus-events/${event.id}`, { published: !event.published })).data,
    onSuccess: () => { toast.success(event.published ? 'Unpublished — students can no longer see it' : 'Published to the student portal'); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => (await api.delete(`/campus-events/${event.id}`)).data,
    onSuccess: () => { toast.success('Event deleted'); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ ...card, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: phase === 'PAST' ? 0.7 : 1 }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{event.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
          {fmtDateTime(event.startsAt)}
          {event.endsAt ? ` → ${fmtDateTime(event.endsAt)}` : ''}
          {event.venue ? <> · <MapPin size={11} style={{ verticalAlign: -1 }} /> {event.venue}</> : null}
          {' · '}<Users size={11} style={{ verticalAlign: -1 }} /> {audienceOf(event)}
          {event.registrationRequired ? ' · registration required' : ''}
        </div>
        {event.description && (
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>{event.description}</div>
        )}
      </div>
      <JoinButton join={(event as CampusEvent & { join?: MeetingJoin }).join} size="sm" />
      <Pill text={CATEGORY_LABEL[event.category]} tone={CATEGORY_TONE[event.category]} />
      {/* Phase is worked out from the clock, so a finished event stops advertising registration. */}
      <Pill text={PHASE_LABEL[phase]} tone={PHASE_TONE[phase]} />
      {canManage && (
        <>
          <button
            className="btn-secondary" style={{ height: 30, fontSize: 11.5 }}
            disabled={publish.isPending} onClick={() => publish.mutate()}
            title={event.published ? 'Hide from the student portal' : 'Show in the student portal'}
          >
            {event.published ? <><EyeOff size={13} /> Unpublish</> : <><Eye size={13} /> Publish</>}
          </button>
          {confirmDelete ? (
            <>
              <button className="btn-secondary" style={{ height: 30, fontSize: 11.5, color: 'var(--danger,#c0392b)' }} disabled={remove.isPending} onClick={() => remove.mutate()}>
                Delete for good
              </button>
              <button className="btn-secondary" style={{ height: 30, fontSize: 11.5 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            // Deleting is not undoable and there is no archive, so it asks first.
            <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => setConfirmDelete(true)} title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function EventForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('CAMPUS');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  // Venue is now part of the meeting control: an event is in person, in the
  // app, or on somebody else's platform, and the venue only applies to the first.
  const [meeting, setMeeting] = useState<MeetingDraft>(emptyMeeting());
  const [registrationRequired, setRegistrationRequired] = useState(false);
  const [registrationClosesAt, setRegistrationClosesAt] = useState('');
  const [published, setPublished] = useState(true);

  const badWindow = datesInvalid(startsAt, endsAt);
  const badClose = registrationRequired && closesTooLate(startsAt, registrationClosesAt);

  const create = useMutation({
    mutationFn: async () => (await api.post('/campus-events', {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      startsAt: toIso(startsAt),
      endsAt: toIso(endsAt),
      venue: meeting.format === 'IN_PERSON' ? (meeting.place.trim() || undefined) : undefined,
      ...meetingPayload(meeting),
      registrationRequired,
      registrationClosesAt: registrationRequired ? toIso(registrationClosesAt) : undefined,
      published,
    })).data,
    onSuccess: () => { toast.success('Event created'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ ...card, padding: 14, marginBottom: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" style={{ height: 34, width: 260 }} placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <select className="input" style={{ height: 34, width: 150 }} value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
          {(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>

      </div>
      <input className="input" style={{ height: 34 }} placeholder="What it is (shown to students)" value={description} onChange={(e) => setDescription(e.target.value)} />
      {/* In person, in the app, or on somebody else's platform — one control,
          shared with mock interviews and PTM slots so the wording never drifts. */}
      <MeetingFields value={meeting} onChange={setMeeting} placeLabel="Venue" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          Starts
          <input className="input" style={{ height: 34, width: 205, marginLeft: 6 }} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          Ends
          <input
            className="input"
            style={{ height: 34, width: 205, marginLeft: 6, borderColor: badWindow ? 'var(--danger,#c0392b)' : undefined }}
            type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
        <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={registrationRequired} onChange={(e) => setRegistrationRequired(e.target.checked)} />
          Registration required
        </label>
        {registrationRequired && (
          <label style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            Closes
            <input
              className="input"
              style={{ height: 34, width: 205, marginLeft: 6, borderColor: badClose ? 'var(--danger,#c0392b)' : undefined }}
              type="datetime-local" value={registrationClosesAt} onChange={(e) => setRegistrationClosesAt(e.target.value)}
            />
          </label>
        )}
        <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Visible to students
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn-primary" style={{ height: 34, fontSize: 12.5 }}
          disabled={!title.trim() || !startsAt || badWindow || badClose || !!meetingError(meeting) || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Creating…' : 'Create event'}
        </button>
        <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={onCancel}><X size={14} /></button>
        {badWindow && <span style={{ fontSize: 11.5, color: 'var(--danger,#c0392b)' }}>An event cannot end before it starts</span>}
        {badClose && <span style={{ fontSize: 11.5, color: 'var(--danger,#c0392b)' }}>Registration cannot close after the event has begun</span>}
      </div>
    </div>
  );
}
