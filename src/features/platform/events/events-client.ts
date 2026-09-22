/**
 * Campus events and fests (BRD §4.15).
 *
 * The API is `/campus-events` — deliberately not `/events`, which in this
 * platform already means something else. Students read the same rows through
 * `/api/v1/events` on the portal, so an unpublished event here is an event
 * they cannot see.
 */

export type EventCategory = 'MANDATORY' | 'ACADEMIC' | 'CAMPUS' | 'PLACEMENT';

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  MANDATORY: 'Mandatory',
  ACADEMIC: 'Academic',
  CAMPUS: 'Campus life',
  PLACEMENT: 'Placement',
};

const NEUTRAL = { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' };
const INFO = { bg: 'var(--info-bg,#e8f0fe)', fg: 'var(--info,#1a56db)' };
const GOLD = { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' };
const GOOD = { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' };
const BAD = { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' };

export const CATEGORY_TONE: Record<EventCategory, { bg: string; fg: string }> = {
  MANDATORY: BAD,
  ACADEMIC: INFO,
  CAMPUS: GOOD,
  PLACEMENT: GOLD,
};

export interface CampusEvent {
  id: string;
  title: string;
  description?: string | null;
  category: EventCategory;
  startsAt: string;
  endsAt?: string | null;
  venue?: string | null;
  /** Null on both means campus-wide. */
  courseId?: string | null;
  batchId?: string | null;
  /** Null = in person. See @/features/meetings. */
  meetingProvider?: 'IN_APP' | 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | 'OTHER' | null;
  meetingUrl?: string | null;
  /** Derived by the server on read — never re-derived from the URL here. */
  join?: { online: boolean; provider: string | null; label: string; url: string | null; external: boolean };
  registrationRequired: boolean;
  registrationClosesAt?: string | null;
  published: boolean;
  course?: { name: string } | null;
  batch?: { name: string } | null;
}

/**
 * What a student would see right now, worked out from the clock rather than
 * stored — the same reason the request desk derives its SLA state. An event
 * that has finished should not still be advertising registration.
 */
export type EventPhase = 'DRAFT' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'UPCOMING' | 'RUNNING' | 'PAST';

export const PHASE_LABEL: Record<EventPhase, string> = {
  DRAFT: 'Unpublished',
  REGISTRATION_OPEN: 'Registration open',
  REGISTRATION_CLOSED: 'Registration closed',
  UPCOMING: 'Upcoming',
  RUNNING: 'Happening now',
  PAST: 'Past',
};

export const PHASE_TONE: Record<EventPhase, { bg: string; fg: string }> = {
  DRAFT: NEUTRAL,
  REGISTRATION_OPEN: GOOD,
  REGISTRATION_CLOSED: GOLD,
  UPCOMING: INFO,
  RUNNING: GOOD,
  PAST: NEUTRAL,
};

export function phaseOf(e: CampusEvent, now = Date.now()): EventPhase {
  // Unpublished beats everything: whatever the dates say, no student can see it.
  if (!e.published) return 'DRAFT';
  const start = new Date(e.startsAt).getTime();
  const end = e.endsAt ? new Date(e.endsAt).getTime() : start;
  if (now > end) return 'PAST';
  if (now >= start) return 'RUNNING';
  if (e.registrationRequired) {
    const closes = e.registrationClosesAt ? new Date(e.registrationClosesAt).getTime() : start;
    return now <= closes ? 'REGISTRATION_OPEN' : 'REGISTRATION_CLOSED';
  }
  return 'UPCOMING';
}

/** Who the event is for. Null course and batch means the whole campus. */
export const audienceOf = (e: CampusEvent) =>
  e.batch?.name ?? e.course?.name ?? 'Whole campus';

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * The server takes ISO strings. A `datetime-local` input gives back a value
 * with no timezone, which `new Date()` reads as LOCAL time — correct here,
 * since an event at 9am means 9am where the campus is.
 */
export const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

/** Reject a window that ends before it starts, before the request is made. */
export const datesInvalid = (startsAt: string, endsAt: string) =>
  !!startsAt && !!endsAt && new Date(endsAt) <= new Date(startsAt);

/** Registration cannot close after the event has already begun. */
export const closesTooLate = (startsAt: string, closesAt: string) =>
  !!startsAt && !!closesAt && new Date(closesAt) > new Date(startsAt);
