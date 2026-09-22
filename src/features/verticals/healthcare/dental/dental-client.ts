export type PlanStatus = 'PROPOSED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED';
export type ItemStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';

export interface TreatmentItem { id: string; tooth?: string | null; procedure: string; status: ItemStatus; priceInr: number }
export interface TreatmentPlan {
  id: string; title: string; status: PlanStatus; totalInr: number; createdAt?: string;
  items: TreatmentItem[]; patient?: { mrn: string; firstName: string; lastName?: string | null } | null;
}
export interface DentalStats { proposedPlans: number; activePlans: number; completedPlans: number; acceptedValue: number }
export interface ToothChart { patientId: string; teeth: Record<string, string> }

// FDI notation — adult dentition, laid out as a dentist sees it (patient facing).
export const UPPER_ROW = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
export const LOWER_ROW = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

export type ToothCondition = 'HEALTHY' | 'CARIES' | 'FILLED' | 'CROWN' | 'ROOT_CANAL' | 'IMPLANT' | 'MISSING';
export const CONDITIONS: { key: ToothCondition; label: string; color: string; abbr: string }[] = [
  { key: 'HEALTHY', label: 'Healthy', color: 'var(--surface-2)', abbr: '' },
  { key: 'CARIES', label: 'Caries', color: 'var(--danger,#c0392b)', abbr: 'C' },
  { key: 'FILLED', label: 'Filled', color: 'var(--brand,#132376)', abbr: 'F' },
  { key: 'CROWN', label: 'Crown', color: 'var(--gold,#E6A23C)', abbr: 'Cr' },
  { key: 'ROOT_CANAL', label: 'Root canal', color: '#8E7CC3', abbr: 'RC' },
  { key: 'IMPLANT', label: 'Implant', color: '#4F8A6B', abbr: 'Im' },
  { key: 'MISSING', label: 'Missing', color: 'var(--ink-3)', abbr: '✕' },
];
export const CONDITION_MAP: Record<string, { label: string; color: string; abbr: string }> =
  Object.fromEntries(CONDITIONS.map((c) => [c.key, { label: c.label, color: c.color, abbr: c.abbr }]));

export const PLAN_META: Record<PlanStatus, { label: string; bg: string; fg: string }> = {
  PROPOSED: { label: 'Proposed', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  ACCEPTED: { label: 'Accepted', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  IN_PROGRESS: { label: 'In progress', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  COMPLETED: { label: 'Completed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  DECLINED: { label: 'Declined', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const ITEM_META: Record<ItemStatus, { label: string; color: string }> = {
  PLANNED: { label: 'Planned', color: 'var(--ink-3)' },
  IN_PROGRESS: { label: 'In progress', color: 'var(--gold,#E6A23C)' },
  DONE: { label: 'Done', color: 'var(--success)' },
};
export const NEXT_ITEM: Partial<Record<ItemStatus, ItemStatus>> = { PLANNED: 'IN_PROGRESS', IN_PROGRESS: 'DONE' };

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
