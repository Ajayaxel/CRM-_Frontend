/**
 * Alumni (BRD §4.15).
 *
 * Consent is a stored fact with a date, not an assumption. An institute that
 * cannot say WHEN somebody agreed to be contacted cannot honestly say they
 * did — so the register shows the date, and the API refuses to record contact
 * against someone who has opted out.
 */

export type AlumniStatus = 'ACTIVE' | 'UNREACHABLE' | 'DECEASED' | 'OPTED_OUT';

export const STATUS_LABEL: Record<AlumniStatus, string> = {
  ACTIVE: 'Active',
  UNREACHABLE: 'Unreachable',
  DECEASED: 'Deceased',
  OPTED_OUT: 'Opted out',
};

const NEUTRAL = { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' };
const GOOD = { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' };
const GOLD = { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' };

export const STATUS_TONE: Record<AlumniStatus, { bg: string; fg: string }> = {
  ACTIVE: GOOD, UNREACHABLE: GOLD, DECEASED: NEUTRAL, OPTED_OUT: NEUTRAL,
};

/** Contact is refused by the API for these — the UI must not offer it. */
export const UNCONTACTABLE: AlumniStatus[] = ['OPTED_OUT', 'DECEASED'];

export interface Alumnus {
  id: string;
  studentId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  programme?: string | null;
  graduationYear?: number | null;
  admissionNo?: string | null;
  currentEmployer?: string | null;
  designation?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  status: AlumniStatus;
  contactConsent: boolean;
  /** Null whenever consent is false — a date left behind reads as permission. */
  contactConsentAt?: string | null;
  notes?: string | null;
  _count?: { interactions: number };
}

export interface AlumniInteraction {
  id: string;
  kind: string;
  subject: string;
  notes?: string | null;
  occurredAt: string;
}

export interface AlumnusDetail extends Alumnus {
  interactions: AlumniInteraction[];
}

export interface AlumniOverview {
  total: number;
  active: number;
  /** Consented AND active — the number a campaign may actually mail. */
  contactable: number;
  employed: number;
  byYear: Record<string, number>;
}

export const INTERACTION_KINDS = ['EMAIL', 'CALL', 'MEETING', 'EVENT', 'DONATION'] as const;

export const fullName = (a: { firstName: string; lastName?: string | null }) =>
  `${a.firstName} ${a.lastName ?? ''}`.trim();

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** "Consultant at Deloitte" / "Deloitte" / "Employer not recorded". */
export function roleText(a: Alumnus): string {
  if (a.designation && a.currentEmployer) return `${a.designation} at ${a.currentEmployer}`;
  return a.currentEmployer || a.designation || 'Employer not recorded';
}
