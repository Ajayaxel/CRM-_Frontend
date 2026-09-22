export type PracticeArea = 'CORPORATE' | 'LITIGATION' | 'FAMILY' | 'PROPERTY' | 'CRIMINAL' | 'IP' | 'TAX' | 'OTHER';
export type MatterStatus = 'OPEN' | 'ON_HOLD' | 'CLOSED';
export type TrustEntryType = 'DEPOSIT' | 'WITHDRAWAL' | 'FEE';

export interface Matter {
  id: string; reference: string; clientName: string; clientPhone?: string | null; title: string;
  practiceArea: PracticeArea; court?: string | null; caseNumber?: string | null; responsibleName?: string | null;
  status: MatterStatus; openedAt?: string; _count?: { hearings: number; timeEntries: number };
}
export interface Hearing { id: string; at: string; court?: string | null; purpose?: string | null; outcome?: string | null; nextAt?: string | null; matter?: { reference: string; title: string; clientName: string } | null }
export interface TimeEntry { id: string; userName: string; date?: string; hours: number; billable: boolean; rateInr: number; narrative?: string | null }
export interface TrustEntry { id: string; type: TrustEntryType; amountInr: number; balanceInr: number; note?: string | null; createdAt?: string }
export interface MatterDetail extends Matter { hearings: Hearing[]; timeEntries: TimeEntry[]; trustEntries: TrustEntry[]; loggedHours: number; billableValue: number; trustBalance: number }
export interface LegalStats { openMatters: number; upcomingHearings: number; hoursThisMonth: number; billableValue: number; trustBalance: number }

export const PRACTICE_AREAS: PracticeArea[] = ['CORPORATE', 'LITIGATION', 'FAMILY', 'PROPERTY', 'CRIMINAL', 'IP', 'TAX', 'OTHER'];
export const AREA_LABEL: Record<PracticeArea, string> = { CORPORATE: 'Corporate', LITIGATION: 'Litigation', FAMILY: 'Family', PROPERTY: 'Property', CRIMINAL: 'Criminal', IP: 'IP', TAX: 'Tax', OTHER: 'Other' };
export const MATTER_COLS: MatterStatus[] = ['OPEN', 'ON_HOLD', 'CLOSED'];
export const MATTER_META: Record<MatterStatus, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'var(--brand,#132376)' },
  ON_HOLD: { label: 'On hold', color: 'var(--gold,#E6A23C)' },
  CLOSED: { label: 'Closed', color: 'var(--success)' },
};
export const TRUST_META: Record<TrustEntryType, { label: string; sign: string; color: string }> = {
  DEPOSIT: { label: 'Deposit', sign: '+', color: 'var(--success)' },
  WITHDRAWAL: { label: 'Withdrawal', sign: '−', color: 'var(--danger,#c0392b)' },
  FEE: { label: 'Fee', sign: '−', color: 'var(--gold,#c67c1e)' },
};

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
export function dateFmt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
