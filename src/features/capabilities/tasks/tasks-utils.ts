export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RelatedEntity = 'NONE' | 'LEAD' | 'STUDENT';

export interface TaskRow {
  id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  reminderAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  assignedTo?: { id: string; firstName: string; lastName?: string | null } | null;
  assignedToId?: string | null;
  createdBy?: { id: string; firstName: string; lastName?: string | null } | null;
  relatedType: RelatedEntity;
  relatedId?: string | null;
  comments?: TaskCommentRow[];
  _count: {
    comments: number;
  };
}

export interface TaskCommentRow {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName?: string | null;
  };
}

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Completed',
  CANCELLED: 'Cancelled',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const PRIORITY_COLORS: Record<TaskPriority, { bg: string; fg: string }> = {
  LOW: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  MEDIUM: { bg: 'rgba(91,140,166,.1)', fg: 'var(--teal)' },
  HIGH: { bg: 'var(--gold-bg)', fg: 'var(--gold-ink)' },
  URGENT: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

export function priorityBadgeStyle(p: TaskPriority): React.CSSProperties {
  const m = PRIORITY_COLORS[p] ?? { bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    background: m.bg,
    color: m.fg,
    padding: '3px 8px',
    borderRadius: 8,
    fontSize: 11.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
}

export const STATUS_COLORS: Record<TaskStatus, { bg: string; fg: string }> = {
  TODO: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  IN_PROGRESS: { bg: 'var(--gold-bg)', fg: 'var(--gold-ink)' },
  DONE: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  CANCELLED: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

export function statusBadgeStyle(s: TaskStatus): React.CSSProperties {
  const m = STATUS_COLORS[s] ?? { bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    background: m.bg,
    color: m.fg,
    padding: '3px 8px',
    borderRadius: 8,
    fontSize: 11.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
}
