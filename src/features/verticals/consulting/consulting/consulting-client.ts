// The unions below are the Prisma enums, spelled exactly.
//
// They were not, and four of the five disagreed. The UI offered engagement
// types TECH and LEGAL (schema: IT and OTHER), a fee model SUCCESS (schema:
// MILESTONE), and a proposal decision DECLINED (schema: REJECTED) — so every
// one of those choices was a 400 from class-validator, and the Decline button
// had never worked once. In the other direction the UI had never heard of the
// milestone state INVOICED, and MILESTONE_META[status].color on a row carrying
// it throws before the panel can render.
//
// None of that is visible to a typecheck: these are hand-written string unions,
// not generated from @prisma/client, so the compiler agrees with whatever they
// say. scripts/consulting-enum-offline.ts holds them against schema.prisma in
// the CI gate instead.
export type EngagementType = 'STRATEGY' | 'OPERATIONS' | 'FINANCE' | 'HR' | 'IT' | 'MARKETING' | 'OTHER';
export type EngagementStatus = 'PROPOSED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'LOST';
export type FeeModel = 'FIXED' | 'HOURLY' | 'RETAINER' | 'MILESTONE';
export type ProposalStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'INVOICED';

/** The slice of a user the consulting screens show beside a record. */
export interface ConsultingUser { id: string; firstName: string; lastName?: string | null; email: string }

export function userLabel(u?: ConsultingUser | null) {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;
}

export interface EngagementRow extends Engagement {
  archivedAt?: string | null;
  _count?: { milestones: number; timesheets: number };
}

export interface Engagement {
  id: string; clientName: string; clientPhone?: string | null; title: string;
  type: EngagementType; feeModel: FeeModel; status: EngagementStatus; valueInr: number;
  assignedToId?: string | null; assignedTo?: ConsultingUser | null;
  updatedAt?: string; _count?: { milestones: number };
}
export interface Milestone { id: string; title: string; status: MilestoneStatus; amountInr: number; dueAt?: string | null }
// userId/user are the real attribution. userName is the name captured when the
// hours were logged — it is what a row falls back to when the user was deleted
// (userId goes null) and what every row logged before this relation existed has.
export interface Timesheet { id: string; userId?: string | null; user?: ConsultingUser | null; userName: string; hours: number; billable: boolean; rateInr: number; note?: string | null; date?: string }

/** Who a timesheet row belongs to, however it was recorded. */
export function timesheetWho(t: Timesheet) { return userLabel(t.user) ?? t.userName; }
export interface EngagementDetail extends Engagement { milestones: Milestone[]; timesheets: Timesheet[]; loggedHours: number; billableValue: number }
export interface Proposal { id: string; clientName: string; title: string; scope?: string | null; amountInr: number; status: ProposalStatus; engagementId?: string | null; createdAt?: string }
/** Every consulting list endpoint answers in this shape. */
export interface Paged<T> { data: T[]; total: number; take: number; skip: number }

/** A milestone as the cross-engagement delivery list returns it. */
export interface MilestoneRow extends Milestone {
  engagementId: string;
  engagement?: { id: string; title: string; clientName: string; assignedTo?: ConsultingUser | null } | null;
}

/** A timesheet as the cross-engagement time list returns it. */
export interface TimesheetRow extends Timesheet {
  engagementId: string;
  engagement?: { id: string; title: string; clientName: string } | null;
}

/** The time list adds totals, computed over the whole filter and not the page. */
export interface TimesheetPage extends Paged<TimesheetRow> {
  totalHours: number; billableHours: number; billableValue: number;
}

export interface ConsultingStats { activeEngagements: number; pipelineValue: number; proposalsOut: number; hoursThisMonth: number; utilisationPct: number; billableValue: number }

export const ENGAGEMENT_TYPES: EngagementType[] = ['STRATEGY', 'OPERATIONS', 'FINANCE', 'HR', 'IT', 'MARKETING', 'OTHER'];
export const FEE_MODELS: FeeModel[] = ['FIXED', 'HOURLY', 'RETAINER', 'MILESTONE'];
export const ENG_COLS: EngagementStatus[] = ['PROPOSED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'LOST'];
export const ENG_META: Record<EngagementStatus, { label: string; color: string }> = {
  PROPOSED: { label: 'Proposed', color: 'var(--ink-3)' },
  ACTIVE: { label: 'Active', color: 'var(--brand,#132376)' },
  ON_HOLD: { label: 'On hold', color: 'var(--gold,#E6A23C)' },
  COMPLETED: { label: 'Completed', color: 'var(--success)' },
  LOST: { label: 'Lost', color: 'var(--danger,#c0392b)' },
};
export const PROPOSAL_META: Record<ProposalStatus, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  SENT: { label: 'Sent', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  ACCEPTED: { label: 'Accepted', bg: 'var(--success-bg)', fg: 'var(--success)' },
  REJECTED: { label: 'Rejected', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const MILESTONE_META: Record<MilestoneStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'var(--ink-3)' },
  IN_PROGRESS: { label: 'In progress', color: 'var(--gold,#E6A23C)' },
  DONE: { label: 'Done', color: 'var(--success)' },
  INVOICED: { label: 'Invoiced', color: 'var(--brand,#132376)' },
};

// DONE is where the buttons stop. INVOICED is a billing outcome, not a thing a
// delivery lead clicks — nothing mints an invoice from a milestone yet, so a
// button that set it would be recording money that was never billed. The state
// still renders (above), because rows can carry it from the API.
export const NEXT_MILESTONE: Partial<Record<MilestoneStatus, MilestoneStatus>> = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'DONE' };

/** Overdue is a delivery fact, so the API decides it; this only formats it. */
export function dueLabel(dueAt?: string | null): { text: string; overdue: boolean } {
  if (!dueAt) return { text: 'No date', overdue: false };
  const d = new Date(dueAt);
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: false };
  return { text: `in ${days}d`, overdue: false };
}

export function hours(n?: number | null) {
  if (n == null) return '—';
  return `${Math.round(n * 100) / 100}h`;
}

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/** A quotation or invoice raised against an engagement. */
export interface EngagementDocument {
  id: string;
  number: string;
  kind: 'QUOTATION' | 'INVOICE' | 'CREDIT_NOTE' | 'FOLIO' | 'VENDOR_BILL';
  status: string;
  issueDate?: string;
  dueDate?: string | null;
  subtotalInr: number;
  vatInr: number;
  totalInr: number;
  milestone?: { id: string; title: string } | null;
  items?: { id: string; description: string; quantity: number; unitPriceInr: number; amountInr: number }[];
}

/** The documents an engagement can be the subject of, beyond its own invoices. */
export const ENGAGEMENT_DOC_KINDS = [
  { key: 'PROPOSAL', label: 'Proposal' },
  { key: 'SCOPE_OF_WORK', label: 'Scope of work' },
  { key: 'TECHNICAL_SPEC', label: 'Technical spec' },
  { key: 'CONTRACT', label: 'Contract' },
  { key: 'PARTNERSHIP_LETTER', label: 'Partnership letter' },
  { key: 'ACTION_PLAN', label: 'Action plan' },
] as const;
