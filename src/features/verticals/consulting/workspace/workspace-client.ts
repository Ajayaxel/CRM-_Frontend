/**
 * Types and helpers for the consulting workspace.
 *
 * The unions below are the Prisma Cs* enums, spelled exactly. They are
 * hand-written — the same arrangement the engagement client uses, and the same
 * hazard: a typecheck cannot tell you they drifted, because the compiler agrees
 * with whatever these say. scripts/consulting-enum-offline.ts holds the older
 * ones against schema.prisma in the CI gate; these are covered by the same
 * mechanism once they are added to it.
 *
 * ONE SHAPE NOTE, because it has already caused a bug in this repo's history:
 * the Cs endpoints page as `{ items, total, take, skip }`. The older consulting
 * endpoints (engagements, proposals, milestones, timesheets) page as
 * `{ data, ... }`. Both conventions exist in this API; nothing here should
 * assume the other one.
 */

export type CsRelationKind = 'CLIENT' | 'PROSPECT' | 'PARTNER' | 'VENDOR' | 'INVESTOR' | 'INFLUENCER' | 'CONSULTANT';
export type CsCompanyStatus = 'PROSPECT' | 'ACTIVE' | 'DORMANT' | 'ARCHIVED';
export type CsPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CsIssueStatus =
  | 'IDENTIFIED' | 'STUDYING' | 'ANALYSIS' | 'DECISION_REQUIRED' | 'ACTION_PLANNED'
  | 'IN_PROGRESS' | 'RESOLVED' | 'EVALUATED' | 'CLOSED';
export type CsIssueCategory =
  | 'STRATEGY' | 'FINANCE' | 'OPERATIONS' | 'PEOPLE' | 'SALES' | 'MARKETING'
  | 'TECHNOLOGY' | 'COMPLIANCE' | 'SUPPLY_CHAIN' | 'CUSTOMER' | 'GOVERNANCE' | 'OTHER';
export type CsIssueSource =
  | 'CHAIRMAN_MEETING' | 'BOARD_MEETING' | 'CEO_MEETING' | 'WEEKLY_REVIEW' | 'DEPARTMENT_REVIEW'
  | 'PROJECT_REVIEW' | 'ANALYTICS' | 'FINANCIAL_REVIEW' | 'OPERATIONAL_REVIEW'
  | 'CUSTOMER_FEEDBACK' | 'VENDOR_REVIEW' | 'CONSULTANT_OBSERVATION' | 'OTHER';
export type CsDecisionStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'IMPLEMENTED' | 'REVIEWED';
export type CsMeetingType = 'CHAIRMAN' | 'BOARD' | 'CEO' | 'WEEKLY_REVIEW' | 'DEPARTMENT' | 'VENDOR' | 'PROJECT' | 'STRATEGY' | 'OTHER';
export type CsMeetingStatus = 'SCHEDULED' | 'HELD' | 'CANCELLED';
export type CsActionStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type CsObjectiveStatus =
  | 'DRAFT' | 'ACTIVE' | 'AT_RISK' | 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'MISSED' | 'EVALUATED' | 'CLOSED' | 'CANCELLED';
export type CsInitiativeStatus = 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type CsStrategyArea =
  | 'GROWTH' | 'TRANSFORMATION' | 'BRANDING' | 'FINANCE' | 'OPERATIONS' | 'MARKET_EXPANSION'
  | 'ACQUISITION' | 'NEW_PRODUCTS' | 'INVESTMENT' | 'COST_OPTIMIZATION' | 'OTHER';
export type KpiStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NO_TARGET' | 'NO_DATA';
export type KpiMovement = 'BETTER' | 'WORSE' | 'FLAT' | 'NO_DATA';

/** Every Cs list endpoint answers in this shape. */
export interface CsPaged<T> { items: T[]; total: number; take: number; skip: number }

export interface CsCompany {
  id: string; name: string; legalName?: string | null; industry?: string | null;
  city?: string | null; country?: string | null; status: CsCompanyStatus;
  ownerId?: string | null; archivedAt?: string | null;
  relations?: { kind: CsRelationKind; since?: string | null }[];
  _count?: { engagements: number; issues: number; meetings: number; projects: number; objectives?: number; kpis?: number; sops?: number };
}

export interface CsDepartment { id: string; name: string; code?: string | null; isActive: boolean }

export interface CsIssue {
  id: string; ref: string; title: string; status: CsIssueStatus; priority: CsPriority;
  category: CsIssueCategory; source: CsIssueSource; dueDate?: string | null; ownerId?: string | null;
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  _count?: { decisions: number; actions: number };
}

export interface CsDecision {
  id: string; title: string; decision: string; status: CsDecisionStatus;
  dueDate?: string | null; createdAt?: string;
  issue?: { id: string; ref: string; title: string } | null;
  meeting?: { id: string; ref: string; title: string } | null;
}

export interface CsMeeting {
  id: string; ref: string; title: string; type: CsMeetingType; status: CsMeetingStatus;
  scheduledAt: string; summary?: string | null;
  _count?: { agenda: number; attendees: number; actions: number; issues: number; decisions: number };
}

export interface CsAction {
  id: string; title: string; status: CsActionStatus; priority: CsPriority;
  dueDate?: string | null; ownerId?: string | null; taskId?: string | null;
  issue?: { id: string; ref: string; title: string } | null;
  meeting?: { id: string; ref: string; title: string } | null;
  task?: { id: string; ref: string; status: string } | null;
}

export interface CsObjective {
  id: string; title: string; area: CsStrategyArea; status: CsObjectiveStatus; priority: CsPriority;
  targetDate?: string | null; targetOutcome?: string | null; outcome?: string | null;
  progress: number | null; initiativeCount?: number; liveInitiatives?: number;
}

export interface CsInitiative {
  id: string; title: string; status: CsInitiativeStatus; priority: CsPriority;
  targetDate?: string | null; progress: number | null;
  objective?: { id: string; title: string } | null;
  projects?: { id: string; name: string; status: string; progress: number | null; methodology?: string }[];
}

export interface CsKpi {
  id: string; name: string; unit?: string | null; target?: string | number | null;
  status: KpiStatus; movement: KpiMovement;
  latest?: { value: string | number; periodStart: string; periodEnd: string } | null;
  prior?: { value: string | number; periodStart: string; periodEnd: string } | null;
  variance?: { amount: number | null; ratio: number | null };
  objective?: { id: string; title: string } | null;
  initiative?: { id: string; title: string } | null;
}

/** What the strategy dashboard returns. */
export interface StrategyDashboard {
  objectives: { active: CsObjective[]; atRisk: CsObjective[]; draft: number; closedOut: number; averageProgress: number | null };
  initiatives: {
    live: CsInitiative[];
    delayed: { id: string; title: string; targetDate: string; daysLate: number; objective?: { id: string; title: string } | null }[];
    completed: number;
  };
  kpis: { items: CsKpi[]; onTrack: number; atRisk: number; offTrack: number; unmeasured: number };
  majorIssues: CsIssue[];
  upcomingTargets: { kind: 'OBJECTIVE' | 'INITIATIVE'; id: string; title: string; targetDate: string }[];
  strategyProjects: { id: string; name: string; status: string; progress: number | null; methodology?: string; targetDate?: string | null }[];
}

/** What the weekly-review preparation returns. */
export interface MeetingPrep {
  meeting: { id: string; ref: string; title: string; scheduledAt: string; type: CsMeetingType };
  carriedActions: CsAction[];
  undiscussedAgenda: { id: string; title: string }[];
  openActions: CsAction[];
  criticalIssues: CsIssue[];
  pendingDecisions: CsDecision[];
  overdueTasks: { id: string; ref: string; title: string; dueDate: string; status: string }[];
  upcomingMilestones: { id: string; name: string; targetDate: string; status: string }[];
  kpiMovement: { id: string; name: string; unit?: string | null; movement: string; delta: number | null; latest: { value: string } | null }[];
}

// ---------------------------------------------------------------- presentation

export const ISSUE_FLOW: CsIssueStatus[] = [
  'IDENTIFIED', 'STUDYING', 'ANALYSIS', 'DECISION_REQUIRED', 'ACTION_PLANNED', 'IN_PROGRESS', 'RESOLVED', 'EVALUATED', 'CLOSED',
];

export const PRIORITY_COLOR: Record<CsPriority, string> = {
  CRITICAL: 'var(--danger,#d93025)',
  HIGH: 'var(--warning,#E6A23C)',
  MEDIUM: 'var(--ink-2,#5f6368)',
  LOW: 'var(--ink-3,#80868b)',
};

/**
 * KPI colours. OFF_TRACK is the only red on the screen by design: a dashboard
 * where everything is coloured tells the reader nothing about where to look.
 */
export const KPI_COLOR: Record<KpiStatus, string> = {
  ON_TRACK: 'var(--success,#1e8e3e)',
  AT_RISK: 'var(--warning,#E6A23C)',
  OFF_TRACK: 'var(--danger,#d93025)',
  NO_TARGET: 'var(--ink-3,#80868b)',
  NO_DATA: 'var(--ink-3,#80868b)',
};

export const humanEnum = (v?: string | null) =>
  !v ? '' : v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export const shortDate = (d?: string | null) =>
  !d ? '—' : new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });

export const dayMonth = (d?: string | null) =>
  !d ? '—' : new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

/** Days until (positive) or since (negative) a date. Null when there is none. */
export function daysUntil(d?: string | null): number | null {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

export const isOverdue = (d?: string | null) => {
  const n = daysUntil(d);
  return n !== null && n < 0;
};

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
