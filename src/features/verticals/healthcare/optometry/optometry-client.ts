export type RxKind = 'GLASSES' | 'CONTACTS';
export type ProductType = 'FRAME' | 'LENS' | 'CONTACT_LENS' | 'SOLUTION' | 'ACCESSORY';
export type DispenseStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface EyeExam {
  id: string; patientId: string; createdAt?: string;
  odSphere?: number | null; odCyl?: number | null; odAxis?: number | null; odAdd?: number | null;
  osSphere?: number | null; osCyl?: number | null; osAxis?: number | null; osAdd?: number | null;
  ipd?: number | null; notes?: string | null;
  patient?: { mrn: string; firstName: string; lastName?: string | null } | null;
  prescriptions?: { id: string; kind: RxKind }[];
}
export interface OpticalProduct { id: string; name: string; type: ProductType; brand?: string | null; sku?: string | null; priceInr: number; stock: number; active: boolean }
export interface Dispense {
  id: string; reference: string; items: { productId?: string; label: string; qty?: number; priceInr: number }[];
  totalInr: number; paidInr: number; status: DispenseStatus; createdAt?: string;
  patient?: { mrn: string; firstName: string; lastName?: string | null } | null;
}
export interface OptoStats { exams: number; catalogueItems: number; dispenses: number; opticalSalesThisMonth: number }

export const PRODUCT_TYPES: ProductType[] = ['FRAME', 'LENS', 'CONTACT_LENS', 'SOLUTION', 'ACCESSORY'];
export const PRODUCT_LABEL: Record<ProductType, string> = { FRAME: 'Frame', LENS: 'Lens', CONTACT_LENS: 'Contact lens', SOLUTION: 'Solution', ACCESSORY: 'Accessory' };
export const DISPENSE_META: Record<DispenseStatus, { label: string; bg: string; fg: string }> = {
  UNPAID: { label: 'Unpaid', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  PARTIAL: { label: 'Partial', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  PAID: { label: 'Paid', bg: 'var(--success-bg)', fg: 'var(--success)' },
};

/** Format a signed dioptre value, e.g. -2.25, +1.00. */
export function dpt(v?: number | null): string {
  if (v == null) return '—';
  const s = v > 0 ? '+' : '';
  return `${s}${v.toFixed(2)}`;
}
export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
