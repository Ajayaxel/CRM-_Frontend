/**
 * Library (BRD §4.15).
 *
 * A TITLE and a COPY are different things throughout — "do we have Kotler?"
 * and "who has accession ACC-00412?" are different questions, and the API
 * keeps them apart. Availability is COUNTED from copies on every read, never
 * held as a number on the title.
 */

export type CopyStatus = 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'LOST' | 'DAMAGED' | 'WITHDRAWN';
export type LoanStatus = 'ISSUED' | 'RETURNED' | 'LOST';

export const COPY_STATUS_LABEL: Record<CopyStatus, string> = {
  AVAILABLE: 'On shelf',
  ISSUED: 'On loan',
  RESERVED: 'Reserved',
  LOST: 'Lost',
  DAMAGED: 'Damaged',
  WITHDRAWN: 'Withdrawn',
};

const NEUTRAL = { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' };
const INFO = { bg: 'var(--info-bg,#e8f0fe)', fg: 'var(--info,#1a56db)' };
const GOLD = { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' };
const GOOD = { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' };
const BAD = { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' };

export const COPY_TONE: Record<CopyStatus, { bg: string; fg: string }> = {
  AVAILABLE: GOOD, ISSUED: INFO, RESERVED: GOLD,
  LOST: BAD, DAMAGED: BAD, WITHDRAWN: NEUTRAL,
};

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  year?: number | null;
  category?: string | null;
  shelf?: string | null;
  totalCopies: number;
  /** Counted from copies. WITHDRAWN and LOST are rows but not shelf stock. */
  availableCopies: number;
  issuedCopies: number;
}

export interface CopyLoan {
  id: string;
  borrowerName: string;
  admissionNo: string | null;
  dueAt: string;
  overdueDays: number;
}

export interface LibraryCopy {
  id: string;
  accessionNo: string;
  status: CopyStatus;
  priceInr?: number | null;
  /** The open loan, when there is one — "issued" alone is not actionable. */
  loan: CopyLoan | null;
}

export interface BookDetail extends Omit<LibraryBook, 'totalCopies' | 'availableCopies' | 'issuedCopies'> {
  copies: LibraryCopy[];
}

export interface Loan {
  id: string;
  borrowerName: string;
  status: LoanStatus;
  issuedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  fineInr: number;
  fineWaived: boolean;
  overdueDays: number;
  /** What it WOULD cost if returned now. Advisory — the charge is set at return. */
  accruedFineInr: number;
  copy: { accessionNo: string; book: { title: string; author: string } };
  student?: { admissionNo: string } | null;
}

export interface LibraryOverview {
  titles: number;
  copies: number;
  issued: number;
  overdue: number;
  available: number;
  finesCollectedInr: number;
}

/** The server's loan policy, fetched rather than duplicated here. */
export interface LibraryPolicy {
  loanDays: number;
  finePerDayInr: number;
}

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtInr = (n?: number | null) =>
  n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN')}`;

/** "3 days overdue" / "due in 5 days" / "due today". */
export function dueText(dueAt: string, overdueDays: number): string {
  if (overdueDays > 0) return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
  const days = Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000);
  return days <= 0 ? 'due today' : `due in ${days} day${days === 1 ? '' : 's'}`;
}
