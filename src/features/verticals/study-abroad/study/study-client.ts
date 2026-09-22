export type ProgramLevel = 'FOUNDATION' | 'DIPLOMA' | 'BACHELORS' | 'MASTERS' | 'PHD' | 'CERTIFICATE';
export type ApplicationStage = 'SHORTLISTED' | 'APPLIED' | 'OFFER' | 'ACCEPTED' | 'VISA' | 'ENROLLED' | 'REJECTED';
export type VisaStatus = 'PREP' | 'SUBMITTED' | 'BIOMETRICS' | 'APPROVED' | 'REJECTED';

export interface University { id: string; name: string; country: string; city?: string | null; ranking?: number | null; commissionPct: number; active: boolean; _count?: { programs: number; applications: number } }
export interface Program { id: string; name: string; level: ProgramLevel; discipline?: string | null; tuitionInr?: number | null; intakeMonths: string[]; ieltsMin?: number | null; university?: { name: string; country: string } | null }
export interface Application {
  id: string; studentName: string; studentPhone?: string | null; intake?: string | null;
  stage: ApplicationStage; visaStatus?: VisaStatus | null; visaCountry?: string | null;
  program?: { name: string; level?: ProgramLevel } | null; university?: { name: string; country: string } | null;
}
export interface StudyStats { universities: number; programs: number; applications: number; offers: number; enrolled: number; inVisa: number }
export interface ProgramMatch { program: Program & { university: { name: string; country: string; ranking?: number | null } }; score: number; matchPct: number; reasons: string[] }

export const STAGES: ApplicationStage[] = ['SHORTLISTED', 'APPLIED', 'OFFER', 'ACCEPTED', 'VISA', 'ENROLLED', 'REJECTED'];
export const STAGE_META: Record<ApplicationStage, { label: string; color: string }> = {
  SHORTLISTED: { label: 'Shortlisted', color: 'var(--ink-3)' },
  APPLIED: { label: 'Applied', color: 'var(--brand,#132376)' },
  OFFER: { label: 'Offer', color: 'var(--gold,#E6A23C)' },
  ACCEPTED: { label: 'Accepted', color: 'var(--gold,#E6A23C)' },
  VISA: { label: 'Visa', color: 'var(--brand,#132376)' },
  ENROLLED: { label: 'Enrolled', color: 'var(--success)' },
  REJECTED: { label: 'Rejected', color: 'var(--danger,#c0392b)' },
};
export const LEVELS: ProgramLevel[] = ['FOUNDATION', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'PHD', 'CERTIFICATE'];
export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
