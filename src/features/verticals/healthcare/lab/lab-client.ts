export type CollectionType = 'WALK_IN' | 'HOME_COLLECTION' | 'REFERRED';
export type LabOrderStatus = 'ORDERED' | 'COLLECTED' | 'PROCESSING' | 'RESULTED' | 'VERIFIED' | 'DELIVERED';
export type SpecimenStatus = 'PENDING' | 'COLLECTED' | 'RECEIVED' | 'REJECTED';
export type ResultFlag = 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';

export interface LabTest { id: string; code: string; name: string; category?: string | null; sampleType: string; priceInr: number; tatHours?: number | null; refRange?: string | null }
export interface OrderItem { testId?: string; code: string; name: string; priceInr: number; sampleType?: string }
export interface Specimen { id: string; barcode: string; sampleType: string; status: SpecimenStatus; collectedAt?: string | null }
export interface LabResult { id: string; testCode?: string | null; testName: string; value: string; unit?: string | null; refRange?: string | null; flag: ResultFlag }
export interface LabOrder {
  id: string; reference: string; referredBy?: string | null; collectionType: CollectionType; status: LabOrderStatus;
  items: OrderItem[]; totalInr: number; reportUrl?: string | null; createdAt?: string;
  patient?: { mrn: string; firstName: string; lastName?: string | null } | null;
  specimens?: Specimen[]; results?: LabResult[]; _count?: { results: number; specimens: number };
}
export interface LabStats { tests: number; pendingOrders: number; reportsDelivered: number; revenueThisMonth: number }

export const LAB_COLS: LabOrderStatus[] = ['ORDERED', 'COLLECTED', 'PROCESSING', 'RESULTED', 'VERIFIED', 'DELIVERED'];
export const STATUS_META: Record<LabOrderStatus, { label: string; color: string }> = {
  ORDERED: { label: 'Ordered', color: 'var(--ink-3)' },
  COLLECTED: { label: 'Collected', color: 'var(--brand,#132376)' },
  PROCESSING: { label: 'Processing', color: 'var(--gold,#E6A23C)' },
  RESULTED: { label: 'Resulted', color: '#8E7CC3' },
  VERIFIED: { label: 'Verified', color: '#4F8A6B' },
  DELIVERED: { label: 'Delivered', color: 'var(--success)' },
};
export const COLLECTION_LABEL: Record<CollectionType, string> = { WALK_IN: 'Walk-in', HOME_COLLECTION: 'Home collection', REFERRED: 'Referred' };
export const FLAG_META: Record<ResultFlag, { label: string; bg: string; fg: string }> = {
  NORMAL: { label: 'Normal', bg: 'var(--success-bg)', fg: 'var(--success)' },
  HIGH: { label: 'High', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  LOW: { label: 'Low', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  CRITICAL: { label: 'Critical', bg: 'var(--danger,#c0392b)', fg: '#fff' },
};

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
