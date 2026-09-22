export type AccountStatus = 'LEAD' | 'ACTIVE' | 'PAUSED' | 'CHURNED';
export type ProjectType = 'SEO' | 'SEM' | 'SOCIAL' | 'CONTENT' | 'WEB' | 'BRANDING' | 'PERFORMANCE';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'REVIEW' | 'DELIVERED';
export type DeliverableStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'PUBLISHED';

export interface Account { id: string; name: string; industry?: string | null; primaryContact?: string | null; status: AccountStatus; healthScore: number; retainers?: { monthlyFeeInr: number }[]; _count?: { projects: number; retainers: number } }
export interface Project { id: string; name: string; type: ProjectType; budgetInr?: number | null; status: ProjectStatus; dueAt?: string | null; account?: { name: string } | null; _count?: { deliverables: number } }
export interface Deliverable { id: string; title: string; channel?: string | null; assignee?: string | null; status: DeliverableStatus; dueAt?: string | null }
export interface AgencyStats { accounts: number; activeAccounts: number; projects: number; liveProjects: number; mrr: number }

export const PROJECT_TYPES: ProjectType[] = ['SEO', 'SEM', 'SOCIAL', 'CONTENT', 'WEB', 'BRANDING', 'PERFORMANCE'];
export const PROJECT_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'REVIEW', 'DELIVERED'];
export const DELIV_COLS: DeliverableStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'PUBLISHED'];
export const DELIV_META: Record<DeliverableStatus, { label: string; color: string }> = {
  TODO: { label: 'To do', color: 'var(--ink-3)' },
  IN_PROGRESS: { label: 'In progress', color: 'var(--brand,#132376)' },
  REVIEW: { label: 'Review', color: 'var(--gold,#E6A23C)' },
  PUBLISHED: { label: 'Published', color: 'var(--success)' },
};
export const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; bg: string; fg: string }> = {
  LEAD: { label: 'Lead', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  ACTIVE: { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success)' },
  PAUSED: { label: 'Paused', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  CHURNED: { label: 'Churned', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
