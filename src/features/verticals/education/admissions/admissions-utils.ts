export type AdmissionStage = 'APPLICATION' | 'DOCUMENTS' | 'VERIFICATION' | 'COUNSELLING' | 'APPROVED' | 'ENROLLED' | 'REJECTED';

export interface AdmissionRow {
  id: string;
  applicationNo: string;
  stage: AdmissionStage;
  documentsVerified: boolean;
  rejectionReason?: string | null;
  appliedAt: string;
  decidedAt?: string | null;
  enrolledAt?: string | null;
  createdAt: string;
  course: { id: string; name: string; code: string; fee: number };
  branch?: { id: string; name: string } | null;
  lead?: { id: string; firstName: string; lastName?: string | null; email?: string | null; phone?: string | null } | null;
  student?: { id: string; firstName: string; lastName?: string | null; admissionNo: string } | null;
  assignedTo?: { id: string; firstName: string; lastName?: string | null } | null;
}

export const ADMISSION_STAGES: AdmissionStage[] = [
  'APPLICATION',
  'DOCUMENTS',
  'VERIFICATION',
  'COUNSELLING',
  'APPROVED',
  'ENROLLED',
  'REJECTED',
];

export const STAGE_LABELS: Record<AdmissionStage, string> = {
  APPLICATION: 'Application Submitted',
  DOCUMENTS: 'Documents Pending',
  VERIFICATION: 'Verification Ongoing',
  COUNSELLING: 'Counselling Phase',
  APPROVED: 'Approved (Pending Conversion)',
  ENROLLED: 'Converted / Enrolled',
  REJECTED: 'Application Rejected',
};

export const STAGE_META: Record<AdmissionStage, { bg: string; fg: string }> = {
  APPLICATION: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  DOCUMENTS: { bg: 'var(--gold-bg)', fg: 'var(--gold-ink)' },
  VERIFICATION: { bg: 'var(--warning-bg) || #FFF7E6', fg: 'var(--warning) || #D46B08' }, // Wait, warning is gold/orange
  COUNSELLING: { bg: 'rgba(91,140,166,.1)', fg: 'var(--teal) || #5B8CA6' },
  APPROVED: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  ENROLLED: { bg: 'rgba(19,35,118,.10)', fg: 'var(--navy)' },
  REJECTED: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

export function admissionStageBadgeStyle(stage: AdmissionStage): React.CSSProperties {
  const m = STAGE_META[stage] ?? { bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
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

export function applicantName(a: AdmissionRow) {
  if (a.lead) {
    return `${a.lead.firstName} ${a.lead.lastName ?? ''}`.trim();
  }
  if (a.student) {
    return `${a.student.firstName} ${a.student.lastName ?? ''}`.trim();
  }
  return 'Unknown Applicant';
}

export function applicantInitials(a: AdmissionRow) {
  if (a.lead) {
    return `${a.lead.firstName?.[0] ?? ''}${a.lead.lastName?.[0] ?? ''}`.toUpperCase();
  }
  if (a.student) {
    return `${a.student.firstName?.[0] ?? ''}${a.student.lastName?.[0] ?? ''}`.toUpperCase();
  }
  return '?';
}
