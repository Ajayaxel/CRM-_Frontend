/**
 * Request Management (BRD §4.12).
 *
 * The state machine and the SLA table are NOT duplicated here — they are
 * fetched from `/rms/policy`, so the buttons the UI offers are exactly the
 * transitions the server will accept. A copied table drifts the first time
 * somebody edits one of them.
 */

export type RmsCategory = 'ACADEMIC' | 'IT' | 'HOSTEL' | 'TRANSPORT' | 'FINANCE' | 'ADMIN';
export type RmsPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RmsStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REJECTED';
export type RmsEventType =
  | 'RAISED' | 'ASSIGNED' | 'PROGRESS' | 'ESCALATED' | 'RESOLVED'
  | 'REOPENED' | 'CLOSED' | 'REJECTED' | 'COMMENT';

export const CATEGORY_LABEL: Record<RmsCategory, string> = {
  ACADEMIC: 'Academic',
  IT: 'IT',
  HOSTEL: 'Hostel',
  TRANSPORT: 'Transport',
  FINANCE: 'Finance',
  ADMIN: 'Administration',
};

export const STATUS_LABEL: Record<RmsStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
};

export const PRIORITY_LABEL: Record<RmsPriority, string> = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent',
};

const NEUTRAL = { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' };
const INFO = { bg: 'var(--info-bg,#e8f0fe)', fg: 'var(--info,#1a56db)' };
const GOLD = { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' };
const GOOD = { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' };
const BAD = { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' };

export const STATUS_TONE: Record<RmsStatus, { bg: string; fg: string }> = {
  OPEN: GOLD, ASSIGNED: INFO, IN_PROGRESS: INFO,
  RESOLVED: GOOD, CLOSED: NEUTRAL, REJECTED: NEUTRAL,
};

export const PRIORITY_TONE: Record<RmsPriority, { bg: string; fg: string }> = {
  LOW: NEUTRAL, MEDIUM: NEUTRAL, HIGH: GOLD, URGENT: BAD,
};

/** ON_TRACK / AT_RISK / BREACHED, computed by the server on every read. */
export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'NONE';

export const SLA_TONE: Record<SlaState, { bg: string; fg: string }> = {
  ON_TRACK: GOOD, AT_RISK: GOLD, BREACHED: BAD, NONE: NEUTRAL,
};

export const SLA_LABEL: Record<SlaState, string> = {
  ON_TRACK: 'On track', AT_RISK: 'At risk', BREACHED: 'Breached', NONE: 'No SLA',
};

export interface RmsSla {
  state: SlaState;
  /** Negative once the due date has passed. Null when there is no due date. */
  hoursLeft: number | null;
  breached: boolean;
  escalated?: boolean;
}

export interface RmsTicket {
  id: string;
  ticketNo: string;
  raiserKind: 'STUDENT' | 'STAFF';
  raiserName: string;
  studentId: string | null;
  subject: string;
  description: string;
  category: RmsCategory;
  priority: RmsPriority;
  status: RmsStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  slaHours: number;
  dueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNote: string | null;
  escalatedAt: string | null;
  escalationNote: string | null;
  feedbackRating: number | null;
  feedbackNote: string | null;
  createdAt: string;
  sla: RmsSla;
  student?: { admissionNo: string; firstName: string; lastName?: string | null } | null;
  _count?: { events: number };
}

export interface RmsEvent {
  id: string;
  type: RmsEventType;
  message: string;
  author: string;
  createdAt: string;
}

export interface RmsTicketDetail extends RmsTicket {
  events: RmsEvent[];
}

export interface RmsBoard {
  total: number;
  open: number;
  breached: number;
  escalated: number;
  resolved: number;
  closed: number;
  /** Null when nothing has been closed — not zero. */
  meanCloseHours: number | null;
  /** Null when nobody has rated anything — not zero. */
  meanRating: number | null;
  byCategory: Record<string, { total: number; open: number; breached: number }>;
}

/** What `/rms/policy` returns: the server's own rules, not a copy of them. */
export interface RmsPolicy {
  transitions: Record<RmsStatus, RmsStatus[]>;
  slaHours: Record<RmsPriority, number>;
}

/**
 * The transitions that need something typed before the server will accept
 * them. Mirrored so the form can ask first rather than let the request be
 * rejected and make the user read why.
 */
export const NEEDS_NOTE: RmsStatus[] = ['RESOLVED', 'REJECTED'];
export const NEEDS_ASSIGNEE: RmsStatus[] = ['ASSIGNED'];
export const OFFERS_FEEDBACK: RmsStatus[] = ['CLOSED'];

/** A ticket that is finished has no clock left to run. */
const TERMINAL: RmsStatus[] = ['RESOLVED', 'CLOSED', 'REJECTED'];

/**
 * "6h left" / "4h overdue" while the clock runs; "met" or "missed" once it has
 * stopped.
 *
 * The distinction matters: the server measures a resolved ticket against when
 * it was resolved, so its `hoursLeft` is the margin it finished with — not
 * time still available. Rendering that as "24h left" on a closed ticket reads
 * as an SLA still ticking on work that is done.
 */
export function slaText(sla: RmsSla, status?: RmsStatus): string {
  if (sla.hoursLeft === null) return 'No SLA';
  const h = sla.hoursLeft;
  const span = (n: number) => (n >= 48 ? `${Math.round(n / 24)}d` : `${Math.round(n)}h`);
  if (status && TERMINAL.includes(status)) {
    return h < 0 ? `missed by ${span(Math.abs(h))}` : `met, ${span(h)} spare`;
  }
  return h < 0 ? `${span(Math.abs(h))} overdue` : `${span(h)} left`;
}

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

export const raiserLabel = (t: RmsTicket) =>
  t.student ? `${t.student.admissionNo} · ${t.raiserName}` : t.raiserName;
