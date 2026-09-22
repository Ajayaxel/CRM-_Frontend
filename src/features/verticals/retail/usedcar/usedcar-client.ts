export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC' | 'HYBRID';
export type Transmission = 'MANUAL' | 'AUTOMATIC';
export type VehicleCondition = 'EXCELLENT' | 'GOOD' | 'FAIR';
export type VehicleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
export type TestDriveStatus = 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW';
export type TradeInStatus = 'EVALUATING' | 'OFFERED' | 'ACCEPTED' | 'REJECTED';
export type FinanceStatus = 'SUBMITTED' | 'APPROVED' | 'DISBURSED' | 'REJECTED';

export interface Vehicle {
  id: string; reference: string; vin?: string | null; make: string; model: string; variant?: string | null;
  year: number; mileageKm?: number | null; fuel: FuelType; transmission: Transmission; condition: VehicleCondition;
  status: VehicleStatus; costInr?: number | null; askingInr: number; sellInr?: number | null; soldTo?: string | null;
  images: string[]; _count?: { testDrives: number }; marginInr?: number | null; testDrives?: TestDrive[];
}
export interface TestDrive { id: string; customerName: string; customerPhone?: string | null; at: string; status: TestDriveStatus; vehicle?: { reference: string; make: string; model: string; year: number } | null }
export interface TradeIn { id: string; customerName: string; customerPhone?: string | null; vehicleDesc: string; offerInr: number; status: TradeInStatus }
export interface FinanceLead { id: string; customerName: string; customerPhone?: string | null; vehicleLabel?: string | null; amountInr: number; tenureMonths: number; status: FinanceStatus }
export interface CarStats { available: number; reserved: number; soldThisMonth: number; salesThisMonth: number; marginThisMonth: number; testDrivesScheduled: number; financePending: number }

export const FUELS: FuelType[] = ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID'];
export const CONDITIONS: VehicleCondition[] = ['EXCELLENT', 'GOOD', 'FAIR'];
export const VEHICLE_META: Record<VehicleStatus, { label: string; bg: string; fg: string }> = {
  AVAILABLE: { label: 'Available', bg: 'var(--success-bg)', fg: 'var(--success)' },
  RESERVED: { label: 'Reserved', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  SOLD: { label: 'Sold', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};
export const COND_META: Record<VehicleCondition, { label: string; color: string }> = {
  EXCELLENT: { label: 'Excellent', color: 'var(--success)' },
  GOOD: { label: 'Good', color: 'var(--brand,#132376)' },
  FAIR: { label: 'Fair', color: 'var(--gold,#c67c1e)' },
};
export const TD_META: Record<TestDriveStatus, { label: string; bg: string; fg: string }> = {
  SCHEDULED: { label: 'Scheduled', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  COMPLETED: { label: 'Completed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  NO_SHOW: { label: 'No-show', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const TRADEIN_META: Record<TradeInStatus, { label: string; bg: string; fg: string }> = {
  EVALUATING: { label: 'Evaluating', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  OFFERED: { label: 'Offered', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  ACCEPTED: { label: 'Accepted', bg: 'var(--success-bg)', fg: 'var(--success)' },
  REJECTED: { label: 'Rejected', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const FIN_META: Record<FinanceStatus, { label: string; bg: string; fg: string }> = {
  SUBMITTED: { label: 'Submitted', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  APPROVED: { label: 'Approved', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  DISBURSED: { label: 'Disbursed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  REJECTED: { label: 'Rejected', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
export function vehName(v: { year: number; make: string; model: string; variant?: string | null }) {
  return `${v.year} ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''}`;
}
export function dtFmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}
