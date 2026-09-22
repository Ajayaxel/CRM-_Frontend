/**
 * Student development (§4.6), industry programmes (§4.7) and placement
 * readiness (§4.10) — the API serves all three from one controller because
 * they are one pipeline, and this mirrors that rather than splitting them
 * into three screens that would each show a third of a student.
 *
 * Every type here is the shape the API actually returns. Where the server
 * decides something — which status transitions are legal, what a score is
 * made of — this file reproduces the rule so the UI can offer only what will
 * be accepted, and never invents a second opinion.
 */

export type DevKind = 'SRC' | 'MC' | 'SDP';
export type ParticipationStatus = 'REGISTERED' | 'ATTENDED' | 'COMPLETED' | 'WITHDRAWN' | 'NO_SHOW';
export type InternshipStatus =
  | 'ELIGIBLE' | 'ALLOCATED' | 'IN_PROGRESS' | 'EVALUATED' | 'COMPLETED' | 'WITHDRAWN' | 'FAILED';
export type VisitStatus = 'PLANNED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type MockStatus = 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

export const DEV_KIND_LABEL: Record<DevKind, string> = {
  SRC: 'Recreation club',
  MC: 'Management challenge',
  SDP: 'Development programme',
};

export const INTERNSHIP_STATUS_LABEL: Record<InternshipStatus, string> = {
  ELIGIBLE: 'Eligible',
  ALLOCATED: 'Allocated',
  IN_PROGRESS: 'In progress',
  EVALUATED: 'Evaluated',
  COMPLETED: 'Completed',
  WITHDRAWN: 'Withdrawn',
  FAILED: 'Failed',
};

/**
 * The server's status machine, copied exactly from
 * `student-success.controller.ts`. The UI offers only these, so a registrar
 * never picks a transition that comes back 400 — but the API still refuses
 * anything else, and it remains the authority.
 */
export const INTERNSHIP_NEXT: Record<InternshipStatus, InternshipStatus[]> = {
  ELIGIBLE: ['ALLOCATED', 'WITHDRAWN'],
  ALLOCATED: ['IN_PROGRESS', 'WITHDRAWN', 'FAILED'],
  IN_PROGRESS: ['EVALUATED', 'WITHDRAWN', 'FAILED'],
  EVALUATED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  WITHDRAWN: [],
  FAILED: [],
};

/** EVALUATED is the one transition that will not be accepted without a score. */
export const requiresScore = (to: InternshipStatus) => to === 'EVALUATED';

const NEUTRAL = { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' };
const INFO = { bg: 'var(--info-bg,#e8f0fe)', fg: 'var(--info,#1a56db)' };
const GOLD = { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' };
const GOOD = { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' };
const BAD = { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' };

export const INTERNSHIP_TONE: Record<InternshipStatus, { bg: string; fg: string }> = {
  ELIGIBLE: NEUTRAL, ALLOCATED: INFO, IN_PROGRESS: GOLD,
  EVALUATED: INFO, COMPLETED: GOOD, WITHDRAWN: NEUTRAL, FAILED: BAD,
};

export const PARTICIPATION_TONE: Record<ParticipationStatus, { bg: string; fg: string }> = {
  REGISTERED: NEUTRAL, ATTENDED: INFO, COMPLETED: GOOD, WITHDRAWN: NEUTRAL, NO_SHOW: BAD,
};

/** Bands as the scoring service defines them, highest first. */
export const BAND_TONE: Record<string, { bg: string; fg: string }> = {
  Exceptional: GOOD,
  'Highly Ready': GOOD,
  Ready: INFO,
  Developing: GOLD,
  'Needs Improvement': BAD,
};

// ---------------------------------------------------------------- entities

export interface DevProgram {
  id: string;
  kind: DevKind;
  name: string;
  description?: string | null;
  active: boolean;
  _count?: { activities: number; members: number };
}

export interface DevActivity {
  id: string;
  programId: string;
  title: string;
  description?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
  maxPoints: number;
  program?: { name: string; kind: DevKind };
  _count?: { participations: number };
}

export interface DevParticipation {
  id: string;
  studentId: string;
  status: ParticipationStatus;
  /** Null until evaluated. An unevaluated participation is NOT a zero. */
  points: number | null;
  rank: number | null;
  feedback: string | null;
  evaluatedAt: string | null;
  student: { admissionNo: string; firstName: string; lastName?: string | null };
}

export interface Internship {
  id: string;
  studentId: string;
  role?: string | null;
  industryMentor?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  stipendInr?: number | null;
  status: InternshipStatus;
  finalScore?: number | null;
  evaluationNote?: string | null;
  withdrawnReason?: string | null;
  student: { admissionNo: string; firstName: string; lastName?: string | null };
  company?: { name: string } | null;
  _count?: { reports: number };
}

export interface InternshipReport {
  id: string;
  month: string;
  summary: string;
  hours?: number | null;
  mentorRating?: number | null;
  mentorNote?: string | null;
}

export interface IndustrialVisit {
  id: string;
  title: string;
  location?: string | null;
  visitDate?: string | null;
  status: VisitStatus;
  objectives?: string | null;
  company?: { name: string } | null;
  _count?: { participants: number };
}

export interface MockInterview {
  /** Null = in person. See @/features/meetings. */
  meetingProvider?: 'IN_APP' | 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | 'OTHER' | null;
  meetingUrl?: string | null;
  venue?: string | null;
  /** Derived by the server on read. */
  join?: { online: boolean; provider: string | null; label: string; url: string | null; external: boolean };
  id: string;
  studentId: string;
  interviewerName?: string | null;
  scheduledAt?: string | null;
  status: MockStatus;
  score?: number | null;
  communication?: number | null;
  domainKnowledge?: number | null;
  confidence?: number | null;
  feedback?: string | null;
  student: { admissionNo: string; firstName: string; lastName?: string | null };
}

// ---------------------------------------------------------------- scoring

export interface ReadinessWeights {
  academics: number; attendance: number; development: number;
  internship: number; mockInterview: number;
}

export const WEIGHT_LABEL: Record<keyof ReadinessWeights, string> = {
  academics: 'Academics',
  attendance: 'Attendance',
  development: 'Student development',
  internship: 'Internship',
  mockInterview: 'Mock interviews',
};

export interface ReadinessComponent {
  key: keyof ReadinessWeights;
  label: string;
  weight: number;
  value: number | null;
  note: string;
  counted: boolean;
}

export interface Readiness {
  studentId: string;
  /** Null when nothing at all has been recorded — not zero. */
  score: number | null;
  band: string | null;
  weights: ReadinessWeights;
  components: ReadinessComponent[];
  /** Human sentences for the components that did not count, and why. */
  excluded: string[];
}

export interface BoardRow {
  studentId: string;
  admissionNo: string;
  name: string;
  score: number | null;
  band: string | null;
  excludedCount: number;
}

export const fullName = (s: { firstName: string; lastName?: string | null }) =>
  `${s.firstName} ${s.lastName ?? ''}`.trim();

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtMonth = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—';

export const fmtInr = (n?: number | null) =>
  n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN')}`;

/**
 * A readiness score with no components counted is null, and null is NOT zero.
 * Rendering it as 0 would tell a first-year they are unready when the truth is
 * that nothing has been measured yet.
 */
export const scoreText = (score: number | null) => (score === null ? 'Not scored' : `${score}`);
