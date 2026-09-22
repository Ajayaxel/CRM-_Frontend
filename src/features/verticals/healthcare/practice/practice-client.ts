export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type AppointmentType = 'CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE' | 'WALK_IN' | 'TELECONSULT';
export type AppointmentStatus = 'BOOKED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID';

export interface Patient {
  id: string; mrn: string; firstName: string; lastName?: string | null;
  dob?: string | null; gender?: Gender | null; phone?: string | null; email?: string | null;
  address?: string | null; bloodGroup?: string | null; allergies: string[]; createdAt?: string;
}
export interface Provider { id: string; displayName: string; specialty?: string | null; regNo?: string | null; roomNo?: string | null; active: boolean }
export interface RxItem { id?: string; drug: string; dose?: string | null; frequency?: string | null; durationDays?: number | null; instructions?: string | null }
export interface Prescription { id: string; notes?: string | null; createdAt?: string; items: RxItem[] }
export interface Encounter {
  id: string; subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null;
  vitals?: Record<string, unknown>; diagnoses: string[]; createdAt?: string;
  provider?: { displayName: string } | null; prescription?: Prescription | null;
}
export interface Invoice { id: string; reference: string; items: { label: string; qty?: number; priceInr: number }[]; totalInr: number; paidInr: number; status: InvoiceStatus; createdAt?: string }
export interface Appointment {
  id: string; startAt: string; endAt?: string | null; type: AppointmentType; status: AppointmentStatus;
  reason?: string | null; room?: string | null;
  patient: { id: string; mrn: string; firstName: string; lastName?: string | null; phone?: string | null };
  provider?: { displayName: string } | null;
}
export interface PatientDetail extends Patient { appointments: Appointment[]; encounters: Encounter[]; prescriptions: Prescription[]; invoices: Invoice[] }
export interface PracticeStats { patients: number; todayAppointments: number; encountersThisMonth: number; revenueThisMonth: number }

export const APPT_TYPES: AppointmentType[] = ['CONSULTATION', 'FOLLOW_UP', 'PROCEDURE', 'WALK_IN', 'TELECONSULT'];
export const APPT_STATUS_META: Record<AppointmentStatus, { label: string; bg: string; fg: string }> = {
  BOOKED: { label: 'Booked', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  ARRIVED: { label: 'Arrived', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  IN_PROGRESS: { label: 'In progress', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  COMPLETED: { label: 'Completed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  NO_SHOW: { label: 'No-show', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const INVOICE_META: Record<InvoiceStatus, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  UNPAID: { label: 'Unpaid', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  PARTIAL: { label: 'Partial', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  PAID: { label: 'Paid', bg: 'var(--success-bg)', fg: 'var(--success)' },
};

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
export function patientName(p: { firstName: string; lastName?: string | null }) {
  return `${p.firstName} ${p.lastName ?? ''}`.trim();
}
export function age(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  const now = new Date(2026, 6, 7);
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return `${a}y`;
}
export function timeOf(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
