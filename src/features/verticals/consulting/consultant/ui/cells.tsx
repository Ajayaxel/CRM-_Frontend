'use client';

/**
 * Inline-editable cells and the domain's status vocabulary.
 *
 * The rule for every cell here: reading costs nothing, editing costs one click.
 * A cell renders as plain text until hovered, then reveals a hit target; picking
 * a value fires the mutation immediately. There is no per-row save button and no
 * modal for changing a status — that is the whole reason the table is the
 * primary interface rather than a list of links to edit forms.
 */

import React, { useState } from 'react';
import { AlertTriangle, CalendarDays, Circle, X } from 'lucide-react';
import { Avatar, Chip, OptionList, Person, Popover, TONE_VAR, type Opt, type Tone, fmtDate, humanize, isOverdue } from './primitives';
import type {
  DeploymentStatus, FeatureStatus, Health, IssueStatus, IssueType, MilestoneStatus,
  Priority, ProjectStatus, Severity, TaskStatus, TeamRole, VerticalStatus,
} from '../api';

// ============================================================ Vocabulary

export const TASK_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'BLOCKED', 'DONE', 'CANCELLED'];
export const PRIORITIES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const PROJECT_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'BLOCKED', 'TESTING', 'UAT', 'PRODUCTION', 'COMPLETED', 'CANCELLED'];
export const VERTICAL_STATUSES: VerticalStatus[] = ['NOT_STARTED', 'PLANNING', 'ACTIVE', 'DEVELOPMENT', 'TESTING', 'UAT', 'PRODUCTION', 'MAINTENANCE', 'ON_HOLD', 'BLOCKED', 'COMPLETED'];
export const HEALTHS: Health[] = ['HEALTHY', 'AT_RISK', 'CRITICAL'];
export const ISSUE_STATUSES: IssueStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'VERIFIED', 'CLOSED'];
export const SEVERITIES: Severity[] = ['CRITICAL', 'MAJOR', 'MODERATE', 'MINOR'];
export const ISSUE_TYPES: IssueType[] = ['BUG', 'TECHNICAL', 'BUSINESS', 'CLIENT', 'INTEGRATION', 'INFRASTRUCTURE', 'SECURITY', 'PERFORMANCE', 'OPERATIONAL'];
export const FEATURE_STATUSES: FeatureStatus[] = ['IDEA', 'PLANNED', 'APPROVED', 'IN_DEVELOPMENT', 'TESTING', 'READY_FOR_RELEASE', 'RELEASED', 'CANCELLED'];
export const MILESTONE_STATUSES: MilestoneStatus[] = ['PLANNED', 'ACTIVE', 'AT_RISK', 'COMPLETED', 'MISSED', 'CANCELLED'];
export const TEAM_ROLES: TeamRole[] = ['PROJECT_MANAGER', 'TECH_LEAD', 'DEVELOPER', 'DESIGNER', 'QA', 'ANALYST', 'CONTRIBUTOR'];

export function taskTone(s?: string | null): Tone {
  switch (s) {
    case 'DONE': return 'green';
    case 'IN_PROGRESS': return 'blue';
    case 'IN_REVIEW': return 'violet';
    case 'TESTING': return 'amber';
    case 'BLOCKED': return 'red';
    default: return 'slate';
  }
}

export function projectTone(s?: string | null): Tone {
  switch (s) {
    case 'PRODUCTION': case 'COMPLETED': return 'green';
    case 'ACTIVE': return 'blue';
    case 'TESTING': case 'UAT': return 'amber';
    case 'BLOCKED': return 'red';
    case 'PLANNING': return 'violet';
    default: return 'slate';
  }
}

export function verticalTone(s?: string | null): Tone {
  switch (s) {
    case 'PRODUCTION': case 'COMPLETED': return 'green';
    case 'ACTIVE': case 'DEVELOPMENT': return 'blue';
    case 'TESTING': case 'UAT': return 'amber';
    case 'BLOCKED': return 'red';
    case 'MAINTENANCE': return 'violet';
    default: return 'slate';
  }
}

export function healthTone(h?: string | null): Tone {
  return h === 'CRITICAL' ? 'red' : h === 'AT_RISK' ? 'amber' : 'green';
}

export function priorityTone(p?: string | null): Tone {
  return p === 'CRITICAL' ? 'red' : p === 'HIGH' ? 'amber' : p === 'MEDIUM' ? 'blue' : 'slate';
}

export function severityTone(s?: string | null): Tone {
  return s === 'CRITICAL' ? 'red' : s === 'MAJOR' ? 'amber' : s === 'MODERATE' ? 'violet' : 'slate';
}

export function issueTone(s?: string | null): Tone {
  switch (s) {
    case 'RESOLVED': case 'VERIFIED': case 'CLOSED': return 'green';
    case 'IN_PROGRESS': return 'blue';
    case 'PENDING': return 'amber';
    case 'OPEN': return 'red';
    default: return 'violet';
  }
}

export function featureTone(s?: string | null): Tone {
  switch (s) {
    case 'RELEASED': return 'green';
    case 'IN_DEVELOPMENT': return 'blue';
    case 'TESTING': case 'READY_FOR_RELEASE': return 'amber';
    case 'APPROVED': return 'violet';
    default: return 'slate';
  }
}

export function milestoneTone(s?: string | null): Tone {
  switch (s) {
    case 'COMPLETED': return 'green';
    case 'ACTIVE': return 'blue';
    case 'AT_RISK': return 'amber';
    case 'MISSED': return 'red';
    default: return 'slate';
  }
}

export function deploymentTone(s?: string | null): Tone {
  switch (s) {
    case 'SUCCESS': return 'green';
    case 'RUNNING': case 'QUEUED': return 'blue';
    case 'FAILED': return 'red';
    case 'ROLLED_BACK': return 'amber';
    default: return 'slate';
  }
}

export type Kind = 'task' | 'project' | 'vertical' | 'issue' | 'feature' | 'milestone' | 'deployment' | 'health' | 'severity' | 'priority';

export function toneFor(kind: Kind, value?: string | null): Tone {
  switch (kind) {
    case 'task': return taskTone(value);
    case 'project': return projectTone(value);
    case 'vertical': return verticalTone(value);
    case 'issue': return issueTone(value);
    case 'feature': return featureTone(value);
    case 'milestone': return milestoneTone(value);
    case 'deployment': return deploymentTone(value);
    case 'health': return healthTone(value);
    case 'severity': return severityTone(value);
    case 'priority': return priorityTone(value);
  }
}

export function optionsFor(kind: Kind, list: readonly string[]): Opt[] {
  return list.map((v) => ({ value: v, label: humanize(v), tone: toneFor(kind, v) }));
}

// ============================================================ Read-only marks

export function StatusChip({ kind, value }: { kind: Kind; value?: string | null }) {
  if (!value) return <span className="cw-cell-empty">—</span>;
  return <Chip tone={toneFor(kind, value)}>{humanize(value)}</Chip>;
}

/**
 * Priority as a bar glyph rather than another coloured pill: a row already
 * carries a status chip, and two pills side by side flatten the hierarchy.
 */
export function PriorityMark({ value, showLabel = true }: { value?: string | null; showLabel?: boolean }) {
  if (!value) return <span className="cw-cell-empty">—</span>;
  const tone = priorityTone(value);
  const bars = value === 'CRITICAL' ? 3 : value === 'HIGH' ? 3 : value === 'MEDIUM' ? 2 : 1;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={`${humanize(value)} priority`}>
      <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1.5, height: 10, flex: 'none' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 3, height: 4 + i * 3, borderRadius: 1,
              background: i < bars ? TONE_VAR[tone] : 'var(--cw-line)',
            }}
          />
        ))}
      </span>
      {showLabel && <span className="cw-truncate" style={{ color: 'var(--cw-ink-2)' }}>{humanize(value)}</span>}
    </span>
  );
}

export function DueCell({ date, status }: { date?: string | null; status?: string }) {
  if (!date) return <span className="cw-cell-empty">—</span>;
  const late = isOverdue(date, status);
  return (
    <span
      title={new Date(date).toLocaleDateString()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: late ? 'var(--cw-red)' : 'var(--cw-ink-2)', fontWeight: late ? 600 : 500 }}
    >
      {late && <AlertTriangle size={11} style={{ flex: 'none' }} />}
      {fmtDate(date)}
    </span>
  );
}

// ============================================================ Editable cells

/** Shared shell: renders `display`, opens `pop` on click when editable. */
function EditableCell({
  editable, display, children, width,
}: {
  editable: boolean;
  display: React.ReactNode;
  children: (ctx: { close: () => void }) => React.ReactNode;
  width?: number;
}) {
  if (!editable) return <>{display}</>;
  return (
    <Popover
      width={width}
      trigger={({ ref, onClick }) => (
        <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick}>
          {display}
        </button>
      )}
    >
      {children}
    </Popover>
  );
}

export function StatusCell({
  kind, value, options, onChange, editable = true,
}: {
  kind: Kind;
  value?: string | null;
  options: readonly string[];
  onChange: (v: string) => void;
  editable?: boolean;
}) {
  return (
    <EditableCell editable={editable} display={<StatusChip kind={kind} value={value} />}>
      {({ close }) => (
        <OptionList
          options={optionsFor(kind, options)}
          value={value ?? undefined}
          onPick={(v) => { onChange(v); close(); }}
        />
      )}
    </EditableCell>
  );
}

export function PriorityCell({
  value, onChange, editable = true, showLabel = true,
}: { value?: string | null; onChange: (v: string) => void; editable?: boolean; showLabel?: boolean }) {
  return (
    <EditableCell editable={editable} display={<PriorityMark value={value} showLabel={showLabel} />} width={180}>
      {({ close }) => (
        <OptionList
          options={PRIORITIES.map((p) => ({ value: p, label: humanize(p), icon: <PriorityMark value={p} showLabel={false} /> }))}
          value={value ?? undefined}
          onPick={(v) => { onChange(v); close(); }}
        />
      )}
    </EditableCell>
  );
}

export interface PersonOption {
  id: string;
  name: string;
  role?: string | null;
  activeTasks?: number;
}

/**
 * People selector (spec §14).
 *
 * Shows each developer's current load next to their name, because the decision
 * "who should take this?" is not answerable from a list of names alone.
 */
export function PersonCell({
  person, people, onChange, editable = true, allowClear = true, placeholder = 'Unassigned',
}: {
  person?: { id: string; name: string } | null;
  people: PersonOption[];
  onChange: (id: string | null) => void;
  editable?: boolean;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const display = person
    ? <Person person={person} />
    : <span className="cw-cell-empty cw-truncate">{placeholder}</span>;

  return (
    <EditableCell editable={editable} display={display} width={272}>
      {({ close }) => (
        <OptionList
          searchable
          placeholder="Search people…"
          value={person?.id}
          options={people.map((p) => ({
            value: p.id,
            label: p.name,
            hint: p.activeTasks != null ? `${p.activeTasks} active` : (p.role ?? undefined),
            icon: <Avatar name={p.name} size={20} />,
          }))}
          onPick={(v) => { onChange(v); close(); }}
          footer={allowClear && person ? (
            <button type="button" className="cw-opt" onClick={() => { onChange(null); close(); }}>
              <X size={13} style={{ color: 'var(--cw-ink-3)' }} />
              <span>Clear assignee</span>
            </button>
          ) : undefined}
        />
      )}
    </EditableCell>
  );
}

export function DateCell({
  value, status, onChange, editable = true, placeholder = '—',
}: {
  value?: string | null;
  status?: string;
  onChange: (v: string | null) => void;
  editable?: boolean;
  placeholder?: string;
}) {
  const display = value
    ? <DueCell date={value} status={status} />
    : <span className="cw-cell-empty cw-truncate">{placeholder}</span>;

  return (
    <EditableCell editable={editable} display={display} width={228}>
      {({ close }) => (
        <div style={{ padding: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={13} style={{ color: 'var(--cw-ink-3)' }} />
            <input
              type="date"
              autoFocus
              className="cw-input"
              defaultValue={value ? value.slice(0, 10) : ''}
              onChange={(e) => { onChange(e.target.value || null); close(); }}
            />
          </div>
          {value && (
            <button type="button" className="cw-opt" onClick={() => { onChange(null); close(); }}>
              <X size={13} style={{ color: 'var(--cw-ink-3)' }} />
              <span>Clear date</span>
            </button>
          )}
        </div>
      )}
    </EditableCell>
  );
}

/** Free-text cell that becomes an input in place. */
export function TextCell({
  value, onCommit, editable = true, placeholder = '—', mono, type = 'text',
}: {
  value?: string | number | null;
  onCommit: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  mono?: boolean;
  type?: 'text' | 'number';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));

  if (!editable) {
    return value == null || value === '' ? <span className="cw-cell-empty">{placeholder}</span> : <span className={`cw-truncate ${mono ? 'cw-mono' : ''}`}>{value}</span>;
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        className="cw-input"
        style={{ height: 24, fontSize: 13 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== String(value ?? '')) onCommit(draft); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      type="button"
      className="cw-cell-edit"
      onClick={(e) => { e.stopPropagation(); setDraft(String(value ?? '')); setEditing(true); }}
    >
      {value == null || value === ''
        ? <span className="cw-cell-empty">{placeholder}</span>
        : <span className={`cw-truncate ${mono ? 'cw-mono' : ''}`}>{value}</span>}
    </button>
  );
}

/** Reference chip that navigates rather than edits — vertical, project, milestone. */
export function LinkCell({ label, href, icon }: { label?: string | null; href?: string; icon?: React.ReactNode }) {
  if (!label) return <span className="cw-cell-empty">—</span>;
  const inner = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {icon}
      <span className="cw-truncate" style={{ color: 'var(--cw-ink-2)' }}>{label}</span>
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', minWidth: 0, display: 'block' }}>
      {inner}
    </a>
  );
}

export function RefMark({ children }: { children: React.ReactNode }) {
  return <span className="cw-mono" style={{ flex: 'none' }}>{children}</span>;
}

export function DotMark({ tone }: { tone: Tone }) {
  return <Circle size={7} fill={TONE_VAR[tone]} strokeWidth={0} style={{ flex: 'none' }} />;
}
