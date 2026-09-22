export interface EmailTemplate {
  id: string;
  key: string;
  subject: string;
  bodyHtml: string;
  enabled: boolean;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  createdAt: string;
  createdBy?: { firstName: string; lastName?: string | null } | null;
}

export interface AuditRow {
  id: string;
  action: string;
  relatedType: string;
  createdAt: string;
  actor?: { firstName: string; lastName?: string | null } | null;
}

export const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  lead_assigned: 'Lead Assigned',
  follow_up_reminder: 'Follow-up Reminder',
  admission_approved: 'Admission Approved',
  task_reminder: 'Task Reminder',
};

export function prettyAction(action: string): string {
  return action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type SettingsSection =
  | 'general'
  | 'email'
  | 'customfields'
  | 'workflows'
  | 'subscription'
  | 'apikeys'
  | 'audit';
