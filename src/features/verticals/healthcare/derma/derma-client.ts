export type PackageStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PhotoPhase = 'BEFORE' | 'DURING' | 'AFTER';

export interface Procedure { id: string; name: string; category?: string | null; sessionsDefault: number; priceInr: number; active: boolean }
export interface Package {
  id: string; patientId: string; name: string; totalSessions: number; usedSessions: number; priceInr: number; status: PackageStatus;
  patient?: { mrn: string; firstName: string; lastName?: string | null } | null; _count?: { photos: number };
}
export interface ClinicalPhoto { id: string; url: string; phase: PhotoPhase; consent: boolean; caption?: string | null; createdAt?: string }
export interface DermaStats { procedures: number; activePackages: number; completedPackages: number; packageRevenue: number; photos: number }

export const PACKAGE_META: Record<PackageStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'Active', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  COMPLETED: { label: 'Completed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};
export const PHASE_META: Record<PhotoPhase, { label: string; color: string }> = {
  BEFORE: { label: 'Before', color: 'var(--ink-3)' },
  DURING: { label: 'During', color: 'var(--gold,#E6A23C)' },
  AFTER: { label: 'After', color: 'var(--success)' },
};
export const PHASES: PhotoPhase[] = ['BEFORE', 'DURING', 'AFTER'];

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
