export type PortalType = 'STUDENT' | 'PARENT' | 'LECTURER';
export type PortalStatus = 'INVITED' | 'ACTIVE' | 'DISABLED';

export interface PortalAccount {
  id: string;
  type: PortalType;
  name: string;
  email: string;
  status: PortalStatus;
  studentId?: string | null;
  guardianId?: string | null;
  facultyId?: string | null;
  invitedAt?: string | null;
  activatedAt?: string | null;
  lastLoginAt?: string | null;
}

export interface AdminStudent {
  id: string;
  firstName: string;
  lastName?: string | null;
  admissionNo: string;
  email?: string | null;
}

export interface AdminGuardian {
  id: string;
  name: string;
  email?: string | null;
  relation?: string | null;
  isPrimary?: boolean;
}

export interface AdminFaculty {
  id: string;
  name: string;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  active: boolean;
  portalUser?: { id: string; status: PortalStatus; lastLoginAt?: string | null } | null;
}

export interface InviteResult { id?: string; email?: string; name?: string; link: string }

export const STATUS_META: Record<PortalStatus, { bg: string; fg: string; label: string }> = {
  ACTIVE: { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)', label: 'Active' },
  INVITED: { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)', label: 'Invited' },
  DISABLED: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)', label: 'Disabled' },
};

export const TYPE_META: Record<PortalType, { bg: string; fg: string; label: string }> = {
  STUDENT: { bg: 'color-mix(in srgb, var(--brand,#132376) 12%, var(--surface))', fg: 'var(--brand,#132376)', label: 'Student' },
  PARENT: { bg: 'color-mix(in srgb, #0891b2 14%, var(--surface))', fg: '#0891b2', label: 'Parent' },
  LECTURER: { bg: 'color-mix(in srgb, #7c3aed 14%, var(--surface))', fg: '#7c3aed', label: 'Lecturer' },
};

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
