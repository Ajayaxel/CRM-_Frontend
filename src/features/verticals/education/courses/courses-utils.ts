export type DurationUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type CourseStatus = 'ACTIVE' | 'INACTIVE';
export type BatchStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface CourseRow {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  durationValue: number;
  durationUnit: DurationUnit;
  fee: number;
  seats: number;
  status: CourseStatus;
  createdAt: string;
  category?: { id: string; name: string } | null;
  _count: {
    enrollments: number;
    batches: number;
  };
}

export interface BatchRow {
  id: string;
  name: string;
  code: string;
  startDate?: string | null;
  endDate?: string | null;
  capacity: number;
  status: BatchStatus;
  course: { id: string; name: string; code: string };
  branch?: { id: string; name: string } | null;
  _count: {
    enrollments: number;
  };
}

export interface CategoryRow {
  id: string;
  name: string;
  description?: string | null;
  _count: {
    courses: number;
  };
}

export const DURATION_LABELS: Record<DurationUnit, string> = {
  DAY: 'Days',
  WEEK: 'Weeks',
  MONTH: 'Months',
  YEAR: 'Years',
};

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  UPCOMING: 'Upcoming',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const BATCH_STATUS_META: Record<BatchStatus, { bg: string; fg: string }> = {
  UPCOMING: { bg: 'var(--gold-bg)', fg: 'var(--gold-ink)' },
  ONGOING: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  COMPLETED: { bg: 'rgba(19,35,118,.10)', fg: 'var(--navy)' },
  CANCELLED: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

export function batchStatusBadgeStyle(status: BatchStatus): React.CSSProperties {
  const m = BATCH_STATUS_META[status] ?? { bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    background: m.bg,
    color: m.fg,
    padding: '3px 9px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

export function courseStatusBadgeStyle(status: CourseStatus): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    background: status === 'ACTIVE' ? 'var(--success-bg)' : 'var(--surface-2)',
    color: status === 'ACTIVE' ? 'var(--success)' : 'var(--ink-2)',
    padding: '3px 9px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}
