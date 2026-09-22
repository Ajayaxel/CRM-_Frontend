/**
 * Online meetings, on the organiser's side and the participant's.
 *
 * A meeting is one of three things and the difference is what the person
 * attending has to DO about it:
 *
 *   in person   walk to a room — `venue` / `location` says which
 *   in the app  press Join and stay inside BMN Connect
 *   external    press Join and be handed to Zoom / Meet / Teams
 *
 * The server decides which of those a record is and hands back a `join` object
 * saying so; this file never re-derives it from the URL. A client that guesses
 * "it has a link, so it must be external" gets the in-app case wrong the first
 * time an internal path appears.
 */

export type MeetingProvider = 'IN_APP' | 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | 'OTHER';

export const PROVIDER_LABEL: Record<MeetingProvider, string> = {
  IN_APP: 'BMN in-app meeting',
  ZOOM: 'Zoom',
  GOOGLE_MEET: 'Google Meet',
  MS_TEAMS: 'Microsoft Teams',
  OTHER: 'Other provider',
};

/** The providers whose link the organiser has to paste. */
export const EXTERNAL_PROVIDERS: MeetingProvider[] = ['ZOOM', 'GOOGLE_MEET', 'MS_TEAMS', 'OTHER'];

/** What each provider's link should look like, shown as placeholder text. */
export const PROVIDER_HINT: Partial<Record<MeetingProvider, string>> = {
  ZOOM: 'https://yourcompany.zoom.us/j/…',
  GOOGLE_MEET: 'https://meet.google.com/abc-defg-hij',
  MS_TEAMS: 'https://teams.microsoft.com/l/meetup-join/…',
  OTHER: 'https://…',
};

/** The server's answer to "what should this button say and do". */
export interface MeetingJoin {
  online: boolean;
  provider: MeetingProvider | null;
  label: string;
  /** An in-app path, or an external URL. Null when the meeting is in person. */
  url: string | null;
  /** True when following it leaves the product — the UI must say so. */
  external: boolean;
}

/**
 * The organiser's three-way choice, as one value.
 *
 * `format` is separate from `provider` because "is this online at all" is the
 * first question a form should ask, and collapsing it into a nullable provider
 * makes the radio group unrepresentable.
 */
export type MeetingFormat = 'IN_PERSON' | 'ONLINE';

export interface MeetingDraft {
  format: MeetingFormat;
  provider: MeetingProvider;
  url: string;
  place: string;
}

export const emptyMeeting = (): MeetingDraft => ({
  format: 'IN_PERSON',
  provider: 'IN_APP',
  url: '',
  place: '',
});

/** Rebuild the organiser's draft from a saved record. */
export function meetingFromRecord(r: {
  meetingProvider?: MeetingProvider | null;
  meetingUrl?: string | null;
  venue?: string | null;
  location?: string | null;
}): MeetingDraft {
  return {
    format: r.meetingProvider ? 'ONLINE' : 'IN_PERSON',
    provider: r.meetingProvider ?? 'IN_APP',
    url: r.meetingUrl ?? '',
    place: r.venue ?? r.location ?? '',
  };
}

/**
 * The reason the organiser cannot save yet, or null.
 *
 * Deliberately mirrors what the API refuses rather than adding rules of its
 * own — the server is the authority, and a form that blocks something the API
 * would accept is just as wrong as one that permits something it rejects.
 */
export function meetingError(m: MeetingDraft): string | null {
  if (m.format === 'IN_PERSON') return null;
  if (m.provider === 'IN_APP') return null;
  const raw = m.url.trim();
  if (!raw) return `A ${PROVIDER_LABEL[m.provider]} meeting needs its join link`;
  let u: URL;
  try { u = new URL(raw); } catch { return 'That does not look like a link'; }
  if (u.protocol !== 'https:') return 'A meeting link must start with https';
  // Same host rule as the server. Checked here only so the organiser is told
  // before they press Save, never instead of the server checking.
  const hosts: Partial<Record<MeetingProvider, string[]>> = {
    ZOOM: ['zoom.us'],
    GOOGLE_MEET: ['meet.google.com'],
    MS_TEAMS: ['teams.microsoft.com', 'teams.live.com'],
  };
  const allowed = hosts[m.provider];
  if (allowed && !allowed.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
    return `That link goes to ${u.hostname}, which is not ${PROVIDER_LABEL[m.provider]}`;
  }
  return null;
}

/** The fields to send. IN_APP and in-person both send no URL, on purpose. */
export function meetingPayload(m: MeetingDraft): {
  meetingProvider?: MeetingProvider;
  meetingUrl?: string;
} {
  if (m.format === 'IN_PERSON') return {};
  if (m.provider === 'IN_APP') return { meetingProvider: 'IN_APP' };
  return { meetingProvider: m.provider, meetingUrl: m.url.trim() };
}
