export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'DROPPED_OUT' | 'SUSPENDED';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface StudentRow {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status: StudentStatus;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  enrollments: {
    id: string;
    course: { id: string; name: string; code: string };
    batch?: { id: string; name: string } | null;
    status: string;
    feeAmount: number;
    feePaid: number;
  }[];
  tags?: { tag: { id: string; name: string; color: string } }[];
}

export const STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  GRADUATED: 'Graduated',
  DROPPED_OUT: 'Dropped Out',
  SUSPENDED: 'Suspended',
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

const STATUS_META: Record<StudentStatus, { dot: string; bg: string; fg: string }> = {
  ACTIVE: { dot: '#00A63E', bg: 'var(--success-bg)', fg: 'var(--success)' },
  INACTIVE: { dot: '#9A8F88', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  GRADUATED: { dot: '#132376', bg: 'rgba(19,35,118,.10)', fg: 'var(--navy)' },
  DROPPED_OUT: { dot: '#E7000B', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  SUSPENDED: { dot: '#E7000B', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

export function studentStatusMeta(status: StudentStatus) {
  return STATUS_META[status] ?? { dot: '#9A8F88', bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
}

export function studentStatusBadgeStyle(status: StudentStatus): React.CSSProperties {
  const m = studentStatusMeta(status);
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: m.bg,
    color: m.fg,
    padding: '4px 10px',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

export const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

const AVATAR_COLORS = ['#7C8CE0', '#E6A23C', '#4F8A6B', '#C86B7A', '#5B8CA6', '#B08968', '#8E7CC3', '#D08770'];

export function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function studentName(s: { firstName: string; lastName?: string | null }) {
  return `${s.firstName} ${s.lastName ?? ''}`.trim();
}

export function studentInitials(s: { firstName: string; lastName?: string | null }) {
  return `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function formatCurrency(v?: number | null) {
  if (v === undefined || v === null) return '₹0';
  return `₹${v.toLocaleString('en-IN')}`;
}

export function avatarStyle(seed: string, size = 38): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: 99,
    background: avatarColor(seed),
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size <= 36 ? 12 : 15,
    fontWeight: 700,
    flex: `0 0 ${size}px`,
  };
}
