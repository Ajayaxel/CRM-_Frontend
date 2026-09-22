'use client';

/**
 * Data layer for the Consultant workspace.
 *
 * One file holds the types, the query keys and the hooks so a screen never has
 * to guess which key to invalidate after a write — the mutations here do it.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================ Types

export type VerticalStatus =
  | 'NOT_STARTED' | 'PLANNING' | 'ACTIVE' | 'DEVELOPMENT' | 'TESTING' | 'UAT'
  | 'PRODUCTION' | 'MAINTENANCE' | 'ON_HOLD' | 'BLOCKED' | 'COMPLETED';
export type Health = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
export type ProjectStatus =
  | 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'BLOCKED' | 'TESTING' | 'UAT' | 'PRODUCTION' | 'COMPLETED' | 'CANCELLED';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus =
  | 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type IssueStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'VERIFIED' | 'CLOSED';
export type Severity = 'CRITICAL' | 'MAJOR' | 'MODERATE' | 'MINOR';
export type IssueType =
  | 'BUG' | 'TECHNICAL' | 'BUSINESS' | 'CLIENT' | 'INTEGRATION' | 'INFRASTRUCTURE'
  | 'SECURITY' | 'PERFORMANCE' | 'OPERATIONAL';
export type FeatureStatus =
  | 'IDEA' | 'PLANNED' | 'APPROVED' | 'IN_DEVELOPMENT' | 'TESTING' | 'READY_FOR_RELEASE' | 'RELEASED' | 'CANCELLED';
export type MilestoneStatus = 'PLANNED' | 'ACTIVE' | 'AT_RISK' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
export type TeamRole = 'PROJECT_MANAGER' | 'TECH_LEAD' | 'DEVELOPER' | 'DESIGNER' | 'QA' | 'ANALYST' | 'CONTRIBUTOR';
export type DocType =
  | 'PROJECT' | 'TECHNICAL' | 'REQUIREMENTS' | 'MEETING_NOTES' | 'SOP' | 'API'
  | 'ARCHITECTURE' | 'DEPLOYMENT' | 'CLIENT_REQUIREMENTS' | 'DECISION_RECORD' | 'TROUBLESHOOTING';
export type Environment = 'DEV' | 'STAGING' | 'UAT' | 'PRODUCTION';
export type DeploymentStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
export type PmEntityType =
  | 'VERTICAL' | 'PROJECT' | 'TASK' | 'ISSUE' | 'FEATURE' | 'MILESTONE' | 'DOCUMENT' | 'DEPLOYMENT' | 'SPRINT';
export type DependencyType = 'BLOCKS' | 'BLOCKED_BY' | 'DEPENDS_ON' | 'RELATED_TO';

export interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface VerticalRef {
  id: string;
  key: string;
  name: string;
  icon?: string | null;
  accent?: string | null;
}

export interface PortfolioCard extends VerticalRef {
  description?: string | null;
  status: VerticalStatus;
  health: Health;
  progress: number;
  progressIsDerived: boolean;
  targetDate?: string | null;
  owner: Person | null;
  projectManager: Person | null;
  techLead: Person | null;
  teamSize: number;
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  openIssues: number;
  criticalIssues: number;
  featuresInDev: number;
  nextMilestone: { id: string; name: string; targetDate?: string | null; progress?: number | null } | null;
  updatedAt: string;
  riskSignals: string[];
}

export interface Portfolio {
  summary: {
    verticals: number;
    activeVerticals: number;
    activeProjects: number;
    openTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    openIssues: number;
    criticalIssues: number;
    featuresInDev: number;
    upcomingMilestones: number;
    atRisk: number;
    critical: number;
  };
  verticals: PortfolioCard[];
  upcomingMilestones: { id: string; name: string; targetDate?: string | null; progress?: number | null; vertical: VerticalRef | null }[];
  recentDeployments: Deployment[];
  recentlyCompleted: { id: string; ref: string; title: string; completedAt: string; vertical: VerticalRef; assignee: Person | null }[];
  recentActivity: Activity[];
}

export interface Task {
  id: string;
  ref: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  progress: number;
  tags: string[];
  blockedReason?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateHours?: number | null;
  actualHours?: number | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: Person | null;
  reporter: Person | null;
  reviewer: Person | null;
  vertical: VerticalRef;
  project?: { id: string; name: string } | null;
  milestone?: { id: string; name: string; targetDate?: string | null } | null;
  sprint?: { id: string; name: string } | null;
  parentId?: string | null;
  _count?: { subtasks: number; issues: number };
}

export interface TaskDetail extends Task {
  parent?: { id: string; ref: string; title: string; status: TaskStatus } | null;
  subtasks: (Task & { assignee: Person | null })[];
  issues: { id: string; ref: string; title: string; severity: Severity; status: IssueStatus }[];
  dependencies: DependencyLink[];
}

export interface DependencyLink {
  id: string;
  type: DependencyType;
  entityType: PmEntityType;
  entityId: string;
  label: string;
  resolved: boolean;
}

export interface Project {
  id: string;
  name: string;
  key?: string | null;
  description?: string | null;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  progressIsDerived?: boolean;
  tags: string[];
  startDate?: string | null;
  targetDate?: string | null;
  vertical: VerticalRef;
  owner: Person | null;
  projectManager: Person | null;
  techLead: Person | null;
  tasksDone?: number;
  _count?: { tasks: number; issues: number; features: number; milestones: number; members: number };
}

export interface Issue {
  id: string;
  ref: string;
  title: string;
  description?: string | null;
  type: IssueType;
  severity: Severity;
  priority: Priority;
  status: IssueStatus;
  targetDate?: string | null;
  resolvedAt?: string | null;
  resolution?: string | null;
  createdAt: string;
  assignee: Person | null;
  reporter: Person | null;
  vertical: VerticalRef;
  project?: { id: string; name: string } | null;
  task?: { id: string; ref: string; title: string } | null;
  allowedTransitions?: IssueStatus[];
}

export interface Feature {
  id: string;
  ref: string;
  name: string;
  description?: string | null;
  objective?: string | null;
  acceptanceCriteria?: string | null;
  status: FeatureStatus;
  priority: Priority;
  estimateHours?: number | null;
  targetRelease?: string | null;
  approvedAt?: string | null;
  releasedAt?: string | null;
  createdAt: string;
  owner: Person | null;
  requestedBy: Person | null;
  approvedBy?: Person | null;
  assignees: Person[];
  vertical: VerticalRef;
  project?: { id: string; name: string } | null;
  milestone?: { id: string; name: string; targetDate?: string | null } | null;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string | null;
  status: MilestoneStatus;
  startDate?: string | null;
  targetDate?: string | null;
  completedAt?: string | null;
  progress: number;
  progressIsDerived?: boolean;
  tasksTotal: number;
  tasksDone: number;
  tasksRemaining: number;
  owner: Person | null;
  vertical: VerticalRef;
  project?: { id: string; name: string } | null;
}

export interface Deployment {
  id: string;
  environment: Environment;
  status: DeploymentStatus;
  version?: string | null;
  commitSha?: string | null;
  commitMsg?: string | null;
  url?: string | null;
  logUrl?: string | null;
  source: string;
  triggeredBy?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  vertical: VerticalRef;
  project?: { id: string; name: string } | null;
}

export interface Activity {
  id: string;
  entityType: PmEntityType;
  entityId: string;
  entityRef?: string | null;
  action: string;
  summary: string;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  source: 'MANUAL' | 'AUTOMATED' | 'SYSTEM';
  createdAt: string;
  actor: Person | null;
  vertical?: VerticalRef | null;
  meta?: Record<string, unknown> | null;
}

export interface Comment {
  id: string;
  body: string;
  mentions: string[];
  createdAt: string;
  editedAt?: string | null;
  author: Person | null;
  replies?: Comment[];
}

export interface DocumentSummary {
  id: string;
  title: string;
  type: DocType;
  summary?: string | null;
  version: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: Person | null;
  updatedBy: Person | null;
  vertical: VerticalRef;
  project?: { id: string; name: string } | null;
  _count?: { links: number; versions: number };
}

export interface DocumentDetail extends DocumentSummary {
  body: string;
  links: { id: string; entityType: PmEntityType; entityId: string; label: string; ref?: string | null; status?: string | null }[];
  versions: { id: string; version: number; title: string; note?: string | null; createdAt: string }[];
}

export interface WorkloadRow {
  user: Person;
  role: TeamRole | null;
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  inReview: number;
  openIssues: number;
  estimatedHours: number;
}

export interface VerticalDetail extends PortfolioCard {
  members: { id: string; role: TeamRole; user: Person }[];
  counts: {
    projects: number;
    tasks: number;
    tasksDone: number;
    overdueTasks: number;
    blockedTasks: number;
    openIssues: number;
    features: number;
    featuresInDev: number;
  };
  tasksByStatus: Record<string, number>;
  issuesByStatus: Record<string, number>;
  featuresByStatus: Record<string, number>;
  currentMilestone: Milestone | null;
  lastActivityAt: string | null;
  lastDeployment: Deployment | null;
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type WorkQuery = {
  page?: number;
  limit?: number;
  search?: string;
  verticalId?: string;
  projectId?: string;
  milestoneId?: string;
  sprintId?: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  severity?: string;
  type?: string;
  tag?: string;
  overdue?: boolean;
  sort?: string;
};

// ============================================================ Keys

export const pmKeys = {
  all: ['pm'] as const,
  status: () => ['pm', 'status'] as const,
  portfolio: () => ['pm', 'portfolio'] as const,
  verticals: () => ['pm', 'verticals'] as const,
  vertical: (id: string) => ['pm', 'vertical', id] as const,
  verticalOverview: (id: string) => ['pm', 'vertical', id, 'overview'] as const,
  team: (id?: string) => ['pm', 'team', id ?? 'all'] as const,
  projects: (q: WorkQuery) => ['pm', 'projects', q] as const,
  project: (id: string) => ['pm', 'project', id] as const,
  tasks: (q: WorkQuery) => ['pm', 'tasks', q] as const,
  board: (q: WorkQuery) => ['pm', 'board', q] as const,
  task: (id: string) => ['pm', 'task', id] as const,
  issues: (q: WorkQuery) => ['pm', 'issues', q] as const,
  issue: (id: string) => ['pm', 'issue', id] as const,
  issueStats: (v?: string) => ['pm', 'issue-stats', v ?? 'all'] as const,
  features: (q: WorkQuery) => ['pm', 'features', q] as const,
  feature: (id: string) => ['pm', 'feature', id] as const,
  milestones: (q: WorkQuery) => ['pm', 'milestones', q] as const,
  sprints: (v?: string, p?: string) => ['pm', 'sprints', v ?? '', p ?? ''] as const,
  documents: (q: Record<string, unknown>) => ['pm', 'documents', q] as const,
  document: (id: string) => ['pm', 'document', id] as const,
  deployments: (q: WorkQuery) => ['pm', 'deployments', q] as const,
  activity: (q: Record<string, unknown>) => ['pm', 'activity', q] as const,
  comments: (t: string, id: string) => ['pm', 'comments', t, id] as const,
  attachments: (t: string, id: string) => ['pm', 'attachments', t, id] as const,
  dependencies: (t: string, id: string) => ['pm', 'dependencies', t, id] as const,
  myWork: () => ['pm', 'my-work'] as const,
  search: (q: string, v?: string) => ['pm', 'search', q, v ?? ''] as const,
  timeline: (v?: string) => ['pm', 'timeline', v ?? 'all'] as const,
  calendar: (from: string, to: string, v?: string) => ['pm', 'calendar', from, to, v ?? ''] as const,
  reports: {
    vertical: (id: string) => ['pm', 'report', 'vertical', id] as const,
    project: (id: string) => ['pm', 'report', 'project', id] as const,
    developer: (id: string) => ['pm', 'report', 'developer', id] as const,
    me: () => ['pm', 'report', 'me'] as const,
  },
  notifications: (unread: boolean) => ['pm', 'notifications', unread] as const,
  webhookTokens: () => ['pm', 'webhook-tokens'] as const,
};

const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> =>
  (await api.get(url, { params: clean(params) })).data;

/** Drop empty params so the query key and the request URL stay stable. */
function clean(params?: Record<string, unknown>) {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  return out;
}

// ============================================================ Reads

export function usePmStatus() {
  return useQuery({ queryKey: pmKeys.status(), queryFn: () => get<{ ready: boolean; verticals: number; projects: number; tasks: number }>('/pm/status') });
}

export function usePortfolio() {
  return useQuery({ queryKey: pmKeys.portfolio(), queryFn: () => get<Portfolio>('/pm/portfolio') });
}

export function useVerticals() {
  return useQuery({ queryKey: pmKeys.verticals(), queryFn: () => get<(VerticalRef & { name: string; status: VerticalStatus; health: Health })[]>('/pm/verticals') });
}

export function useVertical(id: string, enabled = true) {
  return useQuery({ queryKey: pmKeys.vertical(id), queryFn: () => get<VerticalDetail>(`/pm/verticals/${id}`), enabled: enabled && !!id });
}

export function useVerticalOverview(id: string, enabled = true) {
  return useQuery({
    queryKey: pmKeys.verticalOverview(id),
    queryFn: () => get<{
      activeProjects: Project[];
      priorityTasks: Task[];
      criticalIssues: Issue[];
      featuresInDev: Feature[];
      upcomingMilestones: Milestone[];
      overdueTasks: Task[];
      recentActivity: Activity[];
      lastDeployment: Deployment | null;
      workload: WorkloadRow[];
    }>(`/pm/verticals/${id}/overview`),
    enabled: enabled && !!id,
  });
}

export function useTeam(verticalId?: string) {
  return useQuery({
    queryKey: pmKeys.team(verticalId),
    queryFn: () => (verticalId ? get<WorkloadRow[]>(`/pm/verticals/${verticalId}/team`) : get<WorkloadRow[]>('/pm/workload')),
  });
}

export function useProjects(q: WorkQuery = {}) {
  return useQuery({ queryKey: pmKeys.projects(q), queryFn: () => get<Paged<Project>>('/pm/projects', q) });
}

export function useProject(id: string) {
  return useQuery({ queryKey: pmKeys.project(id), queryFn: () => get<Project & { counts: Record<string, number>; tasksByStatus: Record<string, number>; members: { id: string; role: TeamRole; user: Person }[]; milestones: Milestone[]; sprints: { id: string; name: string }[] }>(`/pm/projects/${id}`), enabled: !!id });
}

export function useTasks(q: WorkQuery = {}, options?: Partial<UseQueryOptions<Paged<Task>>>) {
  return useQuery({ queryKey: pmKeys.tasks(q), queryFn: () => get<Paged<Task>>('/pm/tasks', q), ...options });
}

export function useBoard(q: WorkQuery) {
  return useQuery({
    queryKey: pmKeys.board(q),
    queryFn: () => get<{ status: TaskStatus; count: number; tasks: Task[] }[]>('/pm/tasks/board', q),
    enabled: Boolean(q.projectId || q.verticalId),
  });
}

export function useTask(id?: string) {
  return useQuery({ queryKey: pmKeys.task(id ?? ''), queryFn: () => get<TaskDetail>(`/pm/tasks/${id}`), enabled: !!id });
}

export function useIssues(q: WorkQuery = {}) {
  return useQuery({ queryKey: pmKeys.issues(q), queryFn: () => get<Paged<Issue>>('/pm/issues', q) });
}

export function useIssue(id?: string) {
  return useQuery({ queryKey: pmKeys.issue(id ?? ''), queryFn: () => get<Issue>(`/pm/issues/${id}`), enabled: !!id });
}

export function useIssueStats(verticalId?: string) {
  return useQuery({
    queryKey: pmKeys.issueStats(verticalId),
    queryFn: () => get<{ byStatus: Record<string, number>; bySeverity: Record<string, number>; byType: Record<string, number> }>('/pm/issues/stats', { verticalId }),
  });
}

export function useFeatures(q: WorkQuery = {}) {
  return useQuery({ queryKey: pmKeys.features(q), queryFn: () => get<Paged<Feature>>('/pm/features', q) });
}

export function useFeature(id?: string) {
  return useQuery({ queryKey: pmKeys.feature(id ?? ''), queryFn: () => get<Feature>(`/pm/features/${id}`), enabled: !!id });
}

export function useMilestones(q: WorkQuery = {}) {
  return useQuery({ queryKey: pmKeys.milestones(q), queryFn: () => get<Milestone[]>('/pm/milestones', q) });
}

export function useSprints(verticalId?: string, projectId?: string) {
  return useQuery({
    queryKey: pmKeys.sprints(verticalId, projectId),
    queryFn: () => get<{ id: string; name: string; active: boolean; startDate?: string | null; endDate?: string | null; _count: { tasks: number } }[]>('/pm/sprints', { verticalId, projectId }),
  });
}

export function useDocuments(q: Record<string, unknown> = {}) {
  return useQuery({ queryKey: pmKeys.documents(q), queryFn: () => get<Paged<DocumentSummary>>('/pm/documents', q) });
}

export function useDocument(id?: string) {
  return useQuery({ queryKey: pmKeys.document(id ?? ''), queryFn: () => get<DocumentDetail>(`/pm/documents/${id}`), enabled: !!id });
}

/** Documents linked to one record — the reverse of the document's own link list. */
export function useDocumentsFor(entityType: PmEntityType, entityId?: string) {
  return useQuery({
    queryKey: ['pm', 'documents-for', entityType, entityId ?? ''],
    queryFn: () => get<{ linkId: string; id: string; title: string; type: DocType; summary?: string | null; updatedAt: string }[]>(
      '/pm/documents/for', { entityType, entityId },
    ),
    enabled: !!entityId,
  });
}

export function useDeployments(q: WorkQuery = {}) {
  return useQuery({ queryKey: pmKeys.deployments(q), queryFn: () => get<Paged<Deployment>>('/pm/deployments', q) });
}

export function useActivity(q: Record<string, unknown> = {}) {
  return useQuery({ queryKey: pmKeys.activity(q), queryFn: () => get<Paged<Activity>>('/pm/activity', q) });
}

export function useComments(entityType: PmEntityType, entityId?: string) {
  return useQuery({
    queryKey: pmKeys.comments(entityType, entityId ?? ''),
    queryFn: () => get<Comment[]>('/pm/comments', { entityType, entityId }),
    enabled: !!entityId,
  });
}

export function useAttachments(entityType: PmEntityType, entityId?: string) {
  return useQuery({
    queryKey: pmKeys.attachments(entityType, entityId ?? ''),
    queryFn: () => get<{ id: string; name: string; url: string; mimeType?: string | null; sizeBytes?: number | null; createdAt: string; uploadedBy: Person | null }[]>('/pm/attachments', { entityType, entityId }),
    enabled: !!entityId,
  });
}

export function useMyWork() {
  return useQuery({
    queryKey: pmKeys.myWork(),
    queryFn: () => get<{
      summary: Record<string, number>;
      tasks: Task[]; overdue: Task[]; dueToday: Task[]; dueThisWeek: Task[];
      inReview: Task[]; blocked: Task[]; awaitingMyReview: Task[]; recentlyCompleted: Task[];
      issues: Issue[]; features: Feature[]; projects: Project[];
    }>('/pm/my-work'),
  });
}

export function usePmSearch(q: string, verticalId?: string) {
  return useQuery({
    queryKey: pmKeys.search(q, verticalId),
    queryFn: () => get<Record<string, any>>('/pm/search', { q, verticalId }),
    enabled: q.trim().length > 1,
  });
}

export function useTimeline(verticalId?: string) {
  return useQuery({
    queryKey: pmKeys.timeline(verticalId),
    queryFn: () => get<{ projects: (Project & { milestones: Milestone[]; tasks: Task[] })[]; dependencies: { fromId: string; toId: string }[] }>('/pm/timeline', { verticalId }),
  });
}

export function useCalendar(from: string, to: string, verticalId?: string) {
  return useQuery({
    queryKey: pmKeys.calendar(from, to, verticalId),
    queryFn: () => get<{
      tasks: Task[];
      milestones: Milestone[];
      deployments: Deployment[];
      sprints: { id: string; name: string; startDate?: string | null; endDate?: string | null; active: boolean }[];
    }>('/pm/calendar', { from, to, verticalId }),
  });
}

export function useVerticalReport(id?: string) {
  return useQuery({ queryKey: pmKeys.reports.vertical(id ?? ''), queryFn: () => get<any>(`/pm/verticals/${id}/report`), enabled: !!id });
}

export function useProjectReport(id?: string) {
  return useQuery({ queryKey: pmKeys.reports.project(id ?? ''), queryFn: () => get<any>(`/pm/projects/${id}/report`), enabled: !!id });
}

export function useDeveloperReport(userId?: string) {
  return useQuery({
    queryKey: userId ? pmKeys.reports.developer(userId) : pmKeys.reports.me(),
    queryFn: () => get<any>(userId ? `/pm/reports/developer/${userId}` : '/pm/reports/me'),
  });
}

export function usePmNotifications(unread = false) {
  return useQuery({
    queryKey: pmKeys.notifications(unread),
    queryFn: () => get<{ data: { id: string; type: string; title: string; body?: string | null; relatedType: string; relatedId?: string | null; readAt?: string | null; createdAt: string }[]; unread: number }>('/pm/notifications', { unread }),
    refetchInterval: 60_000,
  });
}

export function useWebhookTokens() {
  return useQuery({
    queryKey: pmKeys.webhookTokens(),
    queryFn: () => get<{ id: string; name: string; prefix: string; lastUsedAt?: string | null; revokedAt?: string | null; createdAt: string }[]>('/pm/webhook-tokens'),
  });
}

// ============================================================ Writes

/**
 * Invalidate everything a write could plausibly have changed.
 *
 * A task move changes the board, the vertical card, the portfolio totals, the
 * milestone bar and the activity feed, so the sweep is deliberately broad —
 * enumerating those by hand is how stale numbers creep in.
 *
 * Three families are excluded because nothing a mutation does can change them
 * and they were the single biggest source of redundant traffic: `notifications`
 * polls on its own timer, `status` only changes at bootstrap, and `org-users`
 * is a directory that a work edit cannot touch. Before this exclusion a single
 * inline status change fired roughly a dozen requests, most of them the
 * notification poll.
 */
const NEVER_INVALIDATED = new Set(['notifications', 'status', 'org-users']);

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey as unknown[];
      return key[0] === 'pm' && !NEVER_INVALIDATED.has(String(key[1]));
    },
  });
}

export function useBootstrapWorkspace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.post('/pm/bootstrap').then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useCreateVertical() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/verticals', body).then((r) => r.data), onSuccess: invalidate });
}

export function useUpdateVertical() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/pm/verticals/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useSetMember() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ verticalId, userId, role }: { verticalId: string; userId: string; role: TeamRole }) =>
      api.post(`/pm/verticals/${verticalId}/team`, { userId, role }).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useRemoveMember() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ verticalId, userId }: { verticalId: string; userId: string }) =>
      api.delete(`/pm/verticals/${verticalId}/team/${userId}`).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useCreateProject() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/projects', body).then((r) => r.data), onSuccess: invalidate });
}

export function useUpdateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/pm/projects/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useCreateTask() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/tasks', body).then((r) => r.data), onSuccess: invalidate });
}

export function useUpdateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/pm/tasks/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useMoveTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: TaskStatus; beforeTaskId?: string; afterTaskId?: string }) =>
      api.patch(`/pm/tasks/${id}/move`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useAssignTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; assigneeId?: string | null; reviewerId?: string | null; note?: string }) =>
      api.patch(`/pm/tasks/${id}/assign`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useBulkTasks() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/tasks/bulk', body).then((r) => r.data), onSuccess: invalidate });
}

export function useCreateIssue() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/issues', body).then((r) => r.data), onSuccess: invalidate });
}

export function useUpdateIssue() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/pm/issues/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useCreateFeature() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/features', body).then((r) => r.data), onSuccess: invalidate });
}

export function useUpdateFeature() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/pm/features/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useApproveFeature() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.patch(`/pm/features/${id}/approve`).then((r) => r.data), onSuccess: invalidate });
}

export function useCreateMilestone() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/milestones', body).then((r) => r.data), onSuccess: invalidate });
}

export function useUpdateMilestone() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/pm/milestones/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useCreateSprint() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/sprints', body).then((r) => r.data), onSuccess: invalidate });
}

export function useCreateDependency() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/dependencies', body).then((r) => r.data), onSuccess: invalidate });
}

export function useRemoveDependency() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete(`/pm/dependencies/${id}`).then((r) => r.data), onSuccess: invalidate });
}

export function useCreateDocument() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/documents', body).then((r) => r.data), onSuccess: invalidate });
}

export function useUpdateDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/pm/documents/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useLinkDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; entityType: PmEntityType; entityId: string }) =>
      api.post(`/pm/documents/${id}/links`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useUnlinkDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, linkId }: { id: string; linkId: string }) =>
      api.delete(`/pm/documents/${id}/links/${linkId}`).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useCreateComment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/comments', body).then((r) => r.data), onSuccess: invalidate });
}

export function useDeleteComment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete(`/pm/comments/${id}`).then((r) => r.data), onSuccess: invalidate });
}

export function useCreateAttachment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/attachments', body).then((r) => r.data), onSuccess: invalidate });
}

export function useCreateDeployment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/pm/deployments', body).then((r) => r.data), onSuccess: invalidate });
}

export function useCreateWebhookToken() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (body: { name: string }) => api.post('/pm/webhook-tokens', body).then((r) => r.data as { id: string; token: string; prefix: string; name: string }), onSuccess: invalidate });
}

export function useRevokeWebhookToken() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete(`/pm/webhook-tokens/${id}`).then((r) => r.data), onSuccess: invalidate });
}

export function useMarkNotificationsRead() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (ids?: string[]) => api.patch('/pm/notifications/read', { ids }).then((r) => r.data), onSuccess: invalidate });
}

/** Org users, for assignee pickers. */
export function useOrgUsers() {
  return useQuery({
    queryKey: ['pm', 'org-users'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { limit: 100 } });
      const rows = (res.data?.data ?? res.data ?? []) as any[];
      return rows.map((u) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        email: u.email,
        avatarUrl: u.avatarUrl ?? null,
        role: u.role?.name ?? null,
      }));
    },
    staleTime: 5 * 60_000,
  });
}
