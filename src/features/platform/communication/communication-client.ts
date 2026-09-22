export type Audience = 'ALL' | 'STUDENTS' | 'PARENTS' | 'LECTURERS';
export type PtmStatus = 'OPEN' | 'BOOKED' | 'CANCELLED' | 'DONE';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  batchId?: string | null;
  pinned: boolean;
  publishedAt: string;
}

export interface PtmSlot {
  id: string;
  startsAt: string;
  durationMin: number;
  mode: 'LIVE' | 'RECORDED' | 'OFFLINE';
  location?: string | null;
  status: PtmStatus;
  faculty?: { name: string; department?: string | null };
  student?: { firstName: string; lastName?: string | null; admissionNo: string } | null;
  guardian?: { name: string; phone?: string | null } | null;
  note?: string | null;
}

export interface FacultyLite { id: string; name: string; department?: string | null; designation?: string | null }

export const AUDIENCE_META: Record<Audience, { label: string; bg: string; fg: string }> = {
  ALL: { label: 'Everyone', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  STUDENTS: { label: 'Students', bg: 'color-mix(in srgb, var(--brand,#132376) 12%, var(--surface))', fg: 'var(--brand,#132376)' },
  PARENTS: { label: 'Parents', bg: 'color-mix(in srgb, #0891b2 14%, var(--surface))', fg: '#0891b2' },
  LECTURERS: { label: 'Lecturers', bg: 'color-mix(in srgb, #7c3aed 14%, var(--surface))', fg: '#7c3aed' },
};

export const PTM_META: Record<PtmStatus, { label: string; bg: string; fg: string }> = {
  OPEN: { label: 'Open', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  BOOKED: { label: 'Booked', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  DONE: { label: 'Completed', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export const fmtWhen = (s: string) => new Date(s).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
