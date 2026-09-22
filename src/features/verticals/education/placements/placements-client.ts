export type JobType = 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP' | 'APPRENTICESHIP';
export type JobStatus = 'OPEN' | 'CLOSED';
export type AppStatus = 'APPLIED' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFERED' | 'PLACED' | 'REJECTED';

export interface Company { id: string; name: string; industry?: string | null; website?: string | null; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null; _count?: { jobs: number } }
export interface Job {
  id: string; companyId?: string | null; companyName: string; title: string; description?: string | null;
  location?: string | null; type: JobType; ctcInr?: number | null; eligibility?: string | null; skills?: string[] | null;
  seats: number; deadline?: string | null; status: JobStatus; postedAt: string; _count?: { applications: number };
}
export interface Applicant {
  id: string; status: AppStatus; note?: string | null; appliedAt: string;
  student: { firstName: string; lastName?: string | null; admissionNo: string; email?: string | null; phone?: string | null };
}
export interface PlacementOverview { companies: number; openJobs: number; applications: number; offers: number; placed: number }

export type DriveStatus = 'SCHEDULED' | 'CONFIRMED' | 'AWAITING_MOU' | 'COMPLETED' | 'CANCELLED';
export interface Drive {
  id: string; lane: string; title?: string | null; owner?: string | null; status: DriveStatus;
  scheduledAt: string; notes?: string | null; companyId?: string | null; company?: string | null;
}
export const DRIVE_STATUS_LABEL: Record<DriveStatus, string> = {
  SCHEDULED: 'Scheduled', CONFIRMED: 'Confirmed', AWAITING_MOU: 'Awaiting MoU', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

export const JOB_TYPE_LABEL: Record<JobType, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', INTERNSHIP: 'Internship', APPRENTICESHIP: 'Apprenticeship' };
export const APP_STAGES: AppStatus[] = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'PLACED', 'REJECTED'];
export const APP_META: Record<AppStatus, { label: string; bg: string; fg: string }> = {
  APPLIED: { label: 'Applied', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  SHORTLISTED: { label: 'Shortlisted', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  INTERVIEW: { label: 'Interview', bg: 'color-mix(in srgb,#0891b2 14%, var(--surface))', fg: '#0891b2' },
  OFFERED: { label: 'Offered', bg: 'color-mix(in srgb,#7c3aed 14%, var(--surface))', fg: '#7c3aed' },
  PLACED: { label: 'Placed', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  REJECTED: { label: 'Rejected', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const ctcLabel = (n?: number | null) => (n ? '₹' + (n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' LPA' : '—');

// -------------------------------------------------- Corporate relations §4.11

/**
 * MoU status is DERIVED on every read from the dates — nothing stores
 * "active". That is deliberate on the server, and it is why this list has no
 * setter: a lapsed MoU cannot keep calling itself current.
 */
export type MouStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'SUPERSEDED';

export const MOU_STATUS_LABEL: Record<MouStatus, string> = {
  ACTIVE: 'Active',
  EXPIRING: 'Expiring',
  EXPIRED: 'Expired',
  TERMINATED: 'Terminated',
  SUPERSEDED: 'Renewed',
};

export const MOU_TONE: Record<MouStatus, { bg: string; fg: string }> = {
  ACTIVE: { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  EXPIRING: { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  EXPIRED: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  TERMINATED: { bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' },
  SUPERSEDED: { bg: 'var(--info-bg,#e8f0fe)', fg: 'var(--info,#1a56db)' },
};

/** The window the server treats as "expiring". Mirrored for the copy only. */
export const MOU_EXPIRY_WINDOW_DAYS = 60;

export interface CorporateBoardRow {
  id: string;
  name: string;
  contacts: number;
  interactions: number;
  jobs: number;
  internships: number;
  lastInteractionAt: string | null;
  lastInteraction: string | null;
  mouActive: number;
  mouExpiring: number;
  mouExpired: number;
}

export interface ExpiringMou {
  id: string;
  company: string;
  title: string;
  endDate: string;
  daysLeft: number;
}

export interface CompanyContact {
  id: string;
  name: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
}

export interface CompanyInteraction {
  id: string;
  kind: string;
  subject: string;
  notes?: string | null;
  occurredAt: string;
  followUpAt?: string | null;
  contact?: { name: string } | null;
}

export interface CompanyMou {
  id: string;
  title: string;
  reference?: string | null;
  scope?: string | null;
  startDate: string;
  endDate: string;
  terminatedAt?: string | null;
  terminationReason?: string | null;
  renewedFromId?: string | null;
  status: MouStatus;
}

export interface CorporateProfile {
  id: string;
  name: string;
  industry?: string | null;
  contacts: CompanyContact[];
  interactions: CompanyInteraction[];
  mous: CompanyMou[];
  jobs: { id: string; title: string; status: string }[];
  internships: { id: string; status: string; student: { admissionNo: string } }[];
}

export const INTERACTION_KINDS = ['MEETING', 'CALL', 'EMAIL', 'VISIT', 'EVENT'] as const;

export const fmtDay = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** "in 12 days" / "today" / "3 days ago" — daysLeft comes from the server. */
export const daysLeftText = (d: number) =>
  d < 0 ? `${Math.abs(d)} days ago` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
