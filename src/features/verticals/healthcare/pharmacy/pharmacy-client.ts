export type DrugSchedule = 'OTC' | 'H' | 'H1' | 'X';
export type DrugForm = 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'CREAM' | 'DROPS' | 'OTHER';
export type RxStatus = 'RECEIVED' | 'VERIFIED' | 'DISPENSED' | 'REJECTED';

export interface Drug { id: string; code: string; genericName: string; brand?: string | null; form: DrugForm; strength?: string | null; schedule: DrugSchedule; rxRequired: boolean; hsnCode?: string | null; priceInr: number; stock: number }
export interface DrugBatch { id: string; batchNo: string; expiryDate: string; quantity: number; mrpInr?: number | null; expired: boolean; drug?: { code: string; genericName: string; brand?: string | null } | null }
export interface RxIntake { id: string; patientName: string; patientPhone?: string | null; doctorName?: string | null; imageUrl?: string | null; status: RxStatus; createdAt?: string }
export interface Dispense { id: string; reference: string; customerName?: string | null; items: { drugId: string; name: string; batchNo?: string; qty: number; priceInr: number }[]; totalInr: number; createdAt?: string }
export interface PharmacyStats { drugs: number; rxPending: number; expiringBatches: number; salesThisMonth: number }

export const SCHEDULES: DrugSchedule[] = ['OTC', 'H', 'H1', 'X'];
export const SCHEDULE_META: Record<DrugSchedule, { label: string; bg: string; fg: string }> = {
  OTC: { label: 'OTC', bg: 'var(--success-bg)', fg: 'var(--success)' },
  H: { label: 'Schedule H', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  H1: { label: 'Schedule H1', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  X: { label: 'Schedule X', bg: 'var(--danger,#c0392b)', fg: '#fff' },
};
export const FORMS: DrugForm[] = ['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'CREAM', 'DROPS', 'OTHER'];
export const FORM_LABEL: Record<DrugForm, string> = { TABLET: 'Tablet', CAPSULE: 'Capsule', SYRUP: 'Syrup', INJECTION: 'Injection', CREAM: 'Cream', DROPS: 'Drops', OTHER: 'Other' };
export const RX_META: Record<RxStatus, { label: string; bg: string; fg: string }> = {
  RECEIVED: { label: 'Received', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  VERIFIED: { label: 'Verified', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  DISPENSED: { label: 'Dispensed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  REJECTED: { label: 'Rejected', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
export function expFmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
