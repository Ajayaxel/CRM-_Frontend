/**
 * Examination — the staff surface for BRD §4.9.
 *
 * The backend for this shipped with eleven routes, real data and NO way in: no
 * page, no navigation entry, and until the RBAC fix, no permission either. AIMER
 * staff could not schedule a paper, seat a cohort or issue a hall ticket except
 * by calling the API directly.
 */

export type ExamKind = 'INTERNAL' | 'FINAL' | 'SUPPLEMENTARY' | 'RE_EXAM';
export type ExamStatus =
  | 'SETUP' | 'SCHEDULED' | 'IN_PROGRESS' | 'RESULTS_ENTERED' | 'RESULTS_APPROVED' | 'PUBLISHED';

/**
 * The lifecycle the BRD describes, in order. Rendered as a stepper so a
 * registrar can see where a paper stands without reading a status enum.
 */
export const EXAM_FLOW: ExamStatus[] = [
  'SETUP', 'SCHEDULED', 'IN_PROGRESS', 'RESULTS_ENTERED', 'RESULTS_APPROVED', 'PUBLISHED',
];

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  SETUP: 'Setup',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  RESULTS_ENTERED: 'Marks entered',
  RESULTS_APPROVED: 'Results approved',
  PUBLISHED: 'Published',
};

export const EXAM_STATUS_TONE: Record<ExamStatus, { bg: string; fg: string }> = {
  SETUP:            { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' },
  SCHEDULED:        { bg: 'var(--info-bg,#e8f0fe)',   fg: 'var(--info,#1a56db)' },
  IN_PROGRESS:      { bg: 'var(--gold-bg,#fdf2e2)',   fg: 'var(--gold,#c67c1e)' },
  RESULTS_ENTERED:  { bg: 'var(--gold-bg,#fdf2e2)',   fg: 'var(--gold,#c67c1e)' },
  RESULTS_APPROVED: { bg: 'var(--info-bg,#e8f0fe)',   fg: 'var(--info,#1a56db)' },
  PUBLISHED:        { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
};

export const EXAM_KIND_LABEL: Record<ExamKind, string> = {
  INTERNAL: 'Internal', FINAL: 'End-semester', SUPPLEMENTARY: 'Supplementary', RE_EXAM: 'Re-exam',
};

export interface ExamRow {
  id: string;
  name: string;
  kind: ExamKind;
  status: ExamStatus;
  publishedAt?: string | null;
  courseId?: string | null;
  termId?: string | null;
  term?: { name: string } | null;
  course?: { name: string } | null;
  _count?: { schedules: number; results: number };
}

export interface ExamSchedule {
  id: string;
  startsAt: string;
  durationMin: number;
  maxMarks: number;
  passMarks: number;
  subject?: { code: string; name: string } | null;
  section?: { name: string } | null;
  room?: { name: string } | null;
  _count?: { seats: number; results: number };
}

export interface ExamDetail extends ExamRow {
  schedules: ExamSchedule[];
}

/**
 * What seat allocation answers.
 *
 * `refusals` is the half that matters: the access gate refuses a student whose
 * fees or NOC block the exam, and each refusal carries its reasons. A UI that
 * showed only the seated count would hide exactly the students a registrar
 * needs to chase.
 */
export interface AllocationResult {
  seated: number;
  refused: number;
  seats: { studentId: string; admissionNo: string; name: string; seatNo: string }[];
  refusals: { studentId: string; admissionNo: string; name: string; reasons: string[] }[];
  overCapacity: string | null;
}

export interface Backlog {
  resultId: string;
  studentId: string;
  admissionNo: string;
  name: string;
  subject: string;
  exam: string;
  /** null when the student was absent */
  marks: number | null;
  passMarks: number;
  absent: boolean;
}

/** Why this row is a backlog, in the words the office uses. */
export const backlogReason = (b: Backlog) =>
  b.absent ? 'Absent' : `${b.marks} / ${b.passMarks} needed`;

/** One paper's seated cohort, with whatever marks have been recorded. */
export interface PaperSeats {
  scheduleId: string;
  examId: string;
  examStatus: ExamStatus;
  subject: string;
  maxMarks: number;
  passMarks: number;
  seats: SeatRow[];
}

export interface SeatRow {
  seatId: string;
  studentId: string;
  admissionNo: string;
  name: string;
  seatNo: string;
  hallTicketSerial: string | null;
  marksObtained: number | null;
  absent: boolean;
}

/**
 * What the marks sheet will send. `absent` and a mark are mutually exclusive —
 * the API rejects a row that is neither, and stores null marks for an absentee.
 */
export interface MarkEntry {
  studentId: string;
  marksObtained?: number;
  absent?: boolean;
}

/**
 * Validate one typed mark against the paper, using the same bounds the API
 * enforces. Returns an error string, or null when the row is acceptable.
 *
 * Client-side because a hall of 60 students should not need 60 round trips to
 * discover a typo; the API still checks, and it remains the authority.
 */
export function markError(raw: string, absent: boolean, maxMarks: number): string | null {
  if (absent) return null;
  if (raw.trim() === '') return null; // not yet entered — simply not submitted
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Not a number';
  if (n < 0) return 'Below zero';
  if (n > maxMarks) return `Above ${maxMarks}`;
  return null;
}

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Which actions the lifecycle allows from a given status. */
export const canSchedule = (s: ExamStatus) => s === 'SETUP' || s === 'SCHEDULED';
export const canEnterMarks = (s: ExamStatus) => s === 'SCHEDULED' || s === 'IN_PROGRESS' || s === 'RESULTS_ENTERED';
export const canApprove = (s: ExamStatus) => s === 'RESULTS_ENTERED';
export const canPublish = (s: ExamStatus) => s === 'RESULTS_APPROVED';

/** Hall tickets are issued against a seat, so seating has to have happened. */
export const canIssueHallTickets = (s: ExamStatus) => s !== 'SETUP';
