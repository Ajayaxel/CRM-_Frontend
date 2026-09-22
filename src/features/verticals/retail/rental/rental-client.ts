export type FleetCategory = 'HATCHBACK' | 'ECONOMY' | 'SEDAN' | 'SUV' | 'LUXURY' | 'VAN';
export type FleetStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
export type RentalStatus = 'RESERVED' | 'CHECKED_OUT' | 'RETURNED' | 'CANCELLED';

export interface FleetVehicle { id: string; reference: string; make: string; model: string; year: number; plateNo: string; category: FleetCategory; dailyRateInr: number; status: FleetStatus; odometerKm: number; _count?: { bookings: number } }
export interface Agreement { id: string; signedAt: string; odoOut?: number | null; odoIn?: number | null; fuelOut?: string | null; fuelIn?: string | null }
export interface Damage { id: string; description: string; chargeInr: number; photos: string[] }
export interface Booking {
  id: string; reference: string; customerName: string; customerPhone?: string | null;
  pickupAt: string; returnAt: string; days: number; dailyRateInr: number; depositInr: number; totalInr: number; paidInr: number; status: RentalStatus;
  fleetVehicle?: { reference: string; make: string; model: string; plateNo: string } | null;
  agreement?: Agreement | null; damages?: Damage[]; damageTotal?: number; dueInr?: number; depositRefund?: number;
}
export interface RentalStats { available: number; rented: number; activeBookings: number; completedThisMonth: number; revenueThisMonth: number; utilisationPct: number }

export const CATEGORIES: FleetCategory[] = ['HATCHBACK', 'ECONOMY', 'SEDAN', 'SUV', 'LUXURY', 'VAN'];
export const CAT_LABEL: Record<FleetCategory, string> = { HATCHBACK: 'Hatchback', ECONOMY: 'Economy', SEDAN: 'Sedan', SUV: 'SUV', LUXURY: 'Luxury', VAN: 'Van' };
export const FLEET_META: Record<FleetStatus, { label: string; bg: string; fg: string }> = {
  AVAILABLE: { label: 'Available', bg: 'var(--success-bg)', fg: 'var(--success)' },
  RENTED: { label: 'Rented', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  MAINTENANCE: { label: 'Maintenance', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
};
export const RENTAL_COLS: RentalStatus[] = ['RESERVED', 'CHECKED_OUT', 'RETURNED'];
export const RENTAL_META: Record<RentalStatus, { label: string; color: string }> = {
  RESERVED: { label: 'Reserved', color: 'var(--ink-3)' },
  CHECKED_OUT: { label: 'Checked out', color: 'var(--brand,#132376)' },
  RETURNED: { label: 'Returned', color: 'var(--success)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--danger,#c0392b)' },
};

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
export function dFmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
