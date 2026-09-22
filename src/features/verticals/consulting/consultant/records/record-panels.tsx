'use client';

/**
 * Record peek panels.
 *
 * All six record types render through the same shell: identifier, relationship
 * chips, editable title, a field rail, prose blocks, then tabs that always end
 * Comments → Activity. Learning one record teaches you the rest, which is the
 * whole reason this file is one module instead of six.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, CircleSlash, ExternalLink, GitBranch, Plus, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import {
  useApproveFeature, useCreateDependency, useCreateTask, useDeveloperReport,
  useFeature, useIssue, useMilestones, useOrgUsers, useProject, useProjects,
  useRemoveDependency, useSprints, useTask, useTasks, useUpdateFeature,
  useUpdateIssue, useUpdateMilestone, useUpdateProject, useUpdateTask,
  type DependencyType, type TaskDetail,
} from '../api';
import { Panel } from '../ui/panel';
import {
  Avatar, AvatarStack, Chip, OptionList, Person, Popover, ProgressBar, Stat,
  fmtDate, fmtDateTime, humanize,
} from '../ui/primitives';
import {
  Field, Fields, Prose, RecordBody, RecordContext, RecordFooter, RecordHeader,
  RecordLink, RecordNav,
} from '../ui/record-shell';
import { Empty, ErrorState, Loading } from '../ui/states';
import {
  DateCell, FEATURE_STATUSES, ISSUE_STATUSES, ISSUE_TYPES, MILESTONE_STATUSES,
  PRIORITIES, PROJECT_STATUSES, PersonCell, PriorityCell, SEVERITIES, StatusCell,
  StatusChip, TASK_STATUSES, TextCell, milestoneTone, projectTone, taskTone,
} from '../ui/cells';
import { useShortcuts } from '../ui/keyboard';
import { ActivityRail, Attachments, Comments } from './collab';
import { RelatedDocuments } from './document-links';
import { usePeople } from './use-people';
import { useWorkspace, type RecordKind, type RecordRef } from '../ui/workspace-context';

export function RecordPanels({ record, onClose }: { record: RecordRef | null; onClose: () => void }) {
  if (!record) return null;
  const props = { id: record.id, onClose };
  switch (record.kind) {
    case 'TASK': return <TaskPanel {...props} />;
    case 'ISSUE': return <IssuePanel {...props} />;
    case 'FEATURE': return <FeaturePanel {...props} />;
    case 'MILESTONE': return <MilestonePanel {...props} />;
    case 'PROJECT': return <ProjectPanel {...props} />;
    case 'DEVELOPER': return <DeveloperPanel {...props} />;
    default: return null;
  }
}

interface PanelProps { id: string; onClose: () => void }

/**
 * Shared chrome so every panel has the same header controls, the same loading
 * and error handling, and the same `e`-focuses-description behaviour.
 */
function PanelFrame({
  open, onClose, query, what, openHref, actions, children,
}: {
  open: boolean;
  onClose: () => void;
  query: { isLoading: boolean; isError?: boolean; error?: unknown; refetch?: () => void };
  what: string;
  openHref?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel
      open={open}
      onClose={onClose}
      title={null}
      bare
      openHref={openHref}
      actions={<><RecordNav />{actions}</>}
    >
      {query.isLoading
        ? <Loading kind="panel" rows={7} />
        : query.isError
          ? <ErrorState error={query.error} what={what} onRetry={query.refetch} />
          : children}
    </Panel>
  );
}

/** `e` focuses the description on any record — one habit, six screens. */
function useFocusProse(enabled: boolean) {
  const [key, setKey] = useState(0);
  useShortcuts({ e: () => setKey((k) => k + 1) }, { enabled });
  return key;
}

const VerticalChip = ({ v }: { v?: { id: string; key: string; name: string; icon?: string | null } | null }) =>
  v ? <RecordLink label={`${v.icon ?? ''} ${v.name}`.trim()} href={`/consultant/verticals/${v.id}`} muted /> : null;

// ============================================================ Task

const TASK_TABS = ['Details', 'Subtasks', 'Links', 'Comments', 'Activity'] as const;

function TaskPanel({ id, onClose }: PanelProps) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const query = useTask(id);
  const task = query.data;
  const update = useUpdateTask();
  const [tab, setTab] = useState<string>('Details');
  const proseKey = useFocusProse(tab === 'Details');

  useEffect(() => { setTab('Details'); }, [id]);

  const people = usePeople(task?.vertical.id);
  const { data: projects } = useProjects({ verticalId: task?.vertical.id, limit: 100 });
  const { data: milestones } = useMilestones({ verticalId: task?.vertical.id });
  const { data: sprints } = useSprints(task?.vertical.id);

  const canEdit = hasPermission('pm.task.update');
  const canAssign = hasPermission('pm.task.assign');
  const save = (patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  return (
    <PanelFrame open onClose={onClose} query={query} what="this task">
      {task && (
        <>
          <RecordHeader
            identifier={task.ref}
            title={task.title}
            editable={canEdit}
            onTitleChange={(v) => save({ title: v })}
            context={
              <RecordContext items={[
                <VerticalChip key="v" v={task.vertical} />,
                task.project ? <RecordLink key="p" label={task.project.name} href={`/consultant/projects/${task.project.id}`} muted /> : null,
                task.milestone ? <RecordLink key="m" label={task.milestone.name} kind="MILESTONE" id={task.milestone.id} muted /> : null,
              ]} />
            }
            status={<StatusCell kind="task" value={task.status} options={TASK_STATUSES} editable={canEdit} onChange={(v) => save({ status: v })} />}
          />

          <RecordBody
            tabs={TASK_TABS}
            active={tab}
            onTab={setTab}
            counts={{ Subtasks: task.subtasks?.length, Links: task.dependencies?.length + task.issues.length }}
          >
            {tab === 'Details' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <Fields>
                  <Field label="Assignee">
                    <PersonCell person={task.assignee} people={people} editable={canAssign} onChange={(v) => save({ assigneeId: v })} />
                  </Field>
                  <Field label="Reviewer">
                    <PersonCell person={task.reviewer} people={people} editable={canAssign} placeholder="No reviewer" onChange={(v) => save({ reviewerId: v })} />
                  </Field>
                  <Field label="Priority">
                    <PriorityCell value={task.priority} editable={canEdit} onChange={(v) => save({ priority: v })} />
                  </Field>
                  <Field label="Due date">
                    <DateCell value={task.dueDate} status={task.status} editable={canEdit} onChange={(v) => save({ dueDate: v })} />
                  </Field>
                  <Field label="Start date">
                    <DateCell value={task.startDate} editable={canEdit} onChange={(v) => save({ startDate: v })} />
                  </Field>
                  <Field label="Estimate">
                    <TextCell value={task.estimateHours ?? ''} type="number" editable={canEdit} onCommit={(v) => save({ estimateHours: v === '' ? null : Number(v) })} />
                  </Field>
                  <Field label="Logged">
                    <TextCell value={task.actualHours ?? ''} type="number" editable={canEdit} onCommit={(v) => save({ actualHours: v === '' ? null : Number(v) })} />
                  </Field>
                  <Field label="Project">
                    <RelationField
                      value={task.project?.id ?? null}
                      label={task.project?.name}
                      options={(projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                      editable={canEdit}
                      onChange={(v) => save({ projectId: v })}
                      href={task.project ? `/consultant/projects/${task.project.id}` : undefined}
                    />
                  </Field>
                  <Field label="Milestone">
                    <RelationField
                      value={task.milestone?.id ?? null}
                      label={task.milestone?.name}
                      options={(milestones ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.targetDate ? fmtDate(m.targetDate) : undefined }))}
                      editable={canEdit}
                      onChange={(v) => save({ milestoneId: v })}
                      onOpen={task.milestone ? () => ws.openRecord('MILESTONE', task.milestone!.id) : undefined}
                    />
                  </Field>
                  <Field label="Sprint">
                    <RelationField
                      value={task.sprint?.id ?? null}
                      label={task.sprint?.name}
                      options={(sprints ?? []).map((s) => ({ value: s.id, label: s.name }))}
                      editable={canEdit}
                      onChange={(v) => save({ sprintId: v })}
                    />
                  </Field>
                  <Field label="Progress">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 260 }}>
                      <input
                        type="range" min={0} max={100} step={5} disabled={!canEdit} defaultValue={task.progress}
                        aria-label="Progress"
                        onMouseUp={(e) => save({ progress: Number((e.target as HTMLInputElement).value) })}
                        onTouchEnd={(e) => save({ progress: Number((e.target as HTMLInputElement).value) })}
                        style={{ flex: 1, accentColor: 'var(--cw-accent)' }}
                      />
                      <span className="cw-num cw-meta" style={{ fontWeight: 620 }}>{task.progress}%</span>
                    </div>
                  </Field>
                  <Field label="Reporter"><Person person={task.reporter} /></Field>
                </Fields>

                {task.status === 'BLOCKED' && (
                  <Prose
                    label="Why is this blocked?"
                    value={task.blockedReason}
                    editable={canEdit}
                    rows={2}
                    placeholder="What is it waiting on, and who can unblock it?"
                    onCommit={(v) => save({ blockedReason: v || null })}
                  />
                )}

                <Prose
                  label="Description"
                  value={task.description}
                  editable={canEdit}
                  autoFocusKey={proseKey}
                  placeholder="Add context, acceptance notes, links…"
                  onCommit={(v) => save({ description: v })}
                />

                <RecordFooter items={[
                  { label: 'Created', value: fmtDateTime(task.createdAt) },
                  { label: 'Updated', value: fmtDateTime(task.updatedAt) },
                  { label: 'Completed', value: task.completedAt ? fmtDateTime(task.completedAt) : null },
                ]} />
              </div>
            )}

            {tab === 'Subtasks' && <Subtasks task={task} canEdit={canEdit} />}
            {tab === 'Links' && <TaskLinks task={task} canEdit={canEdit} />}
            {tab === 'Comments' && (
              <div style={{ display: 'grid', gap: 24 }}>
                <Comments entityType="TASK" entityId={task.id} />
                <Attachments entityType="TASK" entityId={task.id} />
              </div>
            )}
            {tab === 'Activity' && <ActivityRail entityType="TASK" entityId={task.id} />}
          </RecordBody>
        </>
      )}
    </PanelFrame>
  );
}

function Subtasks({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const ws = useWorkspace();
  const [title, setTitle] = useState('');

  const done = task.subtasks.filter((s) => s.status === 'DONE').length;

  const add = () => {
    if (!title.trim()) return;
    create.mutate(
      { verticalId: task.vertical.id, projectId: task.project?.id, parentId: task.id, title: title.trim(), status: 'TODO' },
      { onSuccess: () => setTitle(''), onError: (e) => toast.error(apiErrorMessage(e)) },
    );
  };

  return (
    <div>
      {task.subtasks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="cw-meta" style={{ fontWeight: 600 }}>{done} of {task.subtasks.length} done</span>
          <div style={{ flex: 1, maxWidth: 180 }}><ProgressBar value={(done / task.subtasks.length) * 100} tone="green" /></div>
        </div>
      )}

      {task.subtasks.length === 0 ? (
        <Empty compact title="No subtasks" body="Break the work down when more than one person will touch it." />
      ) : (
        <div style={{ marginBottom: 12 }}>
          {task.subtasks.map((s) => (
            <div key={s.id} className="cw-row" style={{ cursor: 'default' }}>
              <input
                type="checkbox"
                checked={s.status === 'DONE'}
                disabled={!canEdit}
                aria-label={`Mark ${s.title} done`}
                onChange={(e) => update.mutate({ id: s.id, status: e.target.checked ? 'DONE' : 'TODO' })}
                style={{ width: 14, height: 14, accentColor: 'var(--cw-green)', flex: 'none' }}
              />
              <button
                type="button"
                onClick={() => ws.openRecord('TASK', s.id)}
                style={{
                  flex: 1, minWidth: 0, border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer',
                  font: 'inherit', color: 'inherit',
                  textDecoration: s.status === 'DONE' ? 'line-through' : 'none',
                  opacity: s.status === 'DONE' ? 0.55 : 1,
                }}
              >
                <span className="cw-truncate">{s.title}</span>
              </button>
              <span className="cw-mono">{s.ref}</span>
              <Avatar name={s.assignee?.name} size={18} />
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            className="cw-input"
            placeholder="Add a subtask…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <button className="cw-btn" onClick={add} disabled={!title.trim() || create.isPending} aria-label="Add subtask"><Plus size={13} /></button>
        </div>
      )}
    </div>
  );
}

const DEP_TYPES: DependencyType[] = ['BLOCKED_BY', 'BLOCKS', 'DEPENDS_ON', 'RELATED_TO'];

function TaskLinks({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const create = useCreateDependency();
  const remove = useRemoveDependency();
  const ws = useWorkspace();
  const [type, setType] = useState<DependencyType>('BLOCKED_BY');
  const [search, setSearch] = useState('');
  const { data: candidates } = useTasks({ verticalId: task.vertical.id, search: search || undefined, limit: 20 });

  const blockers = task.dependencies.filter((d) => d.type === 'BLOCKED_BY' && !d.resolved);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {blockers.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px',
          borderRadius: 'var(--cw-r)', background: 'var(--cw-red-bg)', color: 'var(--cw-red)', fontWeight: 600,
        }}>
          <CircleSlash size={14} style={{ flex: 'none' }} />
          Waiting on {blockers.length} unfinished item{blockers.length === 1 ? '' : 's'}
        </div>
      )}

      <div>
        <div className="cw-h2" style={{ marginBottom: 8 }}>Dependencies</div>
        {task.dependencies.length === 0 ? (
          <Empty compact title="No dependencies" body="Link the work this task waits on, or blocks." />
        ) : task.dependencies.map((d) => (
          <div key={d.id} className="cw-row" style={{ cursor: 'default' }}>
            <GitBranch size={13} style={{ color: 'var(--cw-ink-3)', flex: 'none' }} />
            <Chip tone={d.type === 'BLOCKED_BY' ? 'red' : d.type === 'BLOCKS' ? 'amber' : 'slate'} dot={false}>{humanize(d.type)}</Chip>
            <span style={{ flex: 1, minWidth: 0, textDecoration: d.resolved ? 'line-through' : 'none', opacity: d.resolved ? 0.55 : 1 }}>
              <RecordLink label={d.label} kind={d.entityType === 'TASK' ? 'TASK' : undefined} id={d.entityType === 'TASK' ? d.entityId : undefined} />
            </span>
            {canEdit && (
              <button
                type="button" className="cw-icon-btn" style={{ width: 22, height: 22 }} aria-label="Remove dependency"
                onClick={() => remove.mutate(d.id, { onError: (e) => toast.error(apiErrorMessage(e)) })}
              ><Trash2 size={12} /></button>
            )}
          </div>
        ))}
      </div>

      <RelatedDocuments entityType="TASK" entityId={task.id} />

      {task.issues.length > 0 && (
        <div>
          <div className="cw-h2" style={{ marginBottom: 8 }}>Related issues</div>
          {task.issues.map((i) => (
            <button key={i.id} type="button" className="cw-row" onClick={() => ws.openRecord('ISSUE', i.id)}>
              <span className="cw-mono">{i.ref}</span>
              <span className="cw-truncate" style={{ flex: 1 }}>{i.title}</span>
              <StatusChip kind="severity" value={i.severity} />
              <StatusChip kind="issue" value={i.status} />
            </button>
          ))}
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'grid', gap: 7, borderTop: '1px solid var(--cw-line)', paddingTop: 14 }}>
          <div className="cw-label">Link another task</div>
          <select className="cw-input" value={type} onChange={(e) => setType(e.target.value as DependencyType)} aria-label="Dependency type">
            {DEP_TYPES.map((t) => <option key={t} value={t}>This task is {humanize(t).toLowerCase()}…</option>)}
          </select>
          <input className="cw-input" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--cw-line)', borderRadius: 'var(--cw-r)', padding: 4 }}>
            {(candidates?.data ?? []).filter((t) => t.id !== task.id).length === 0
              ? <div className="cw-meta" style={{ padding: 10 }}>No matching tasks.</div>
              : (candidates?.data ?? []).filter((t) => t.id !== task.id).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="cw-opt"
                  onClick={() => create.mutate(
                    { fromType: 'TASK', fromId: task.id, toType: 'TASK', toId: t.id, type },
                    { onError: (e) => toast.error(apiErrorMessage(e)) },
                  )}
                >
                  <span className="cw-mono">{t.ref}</span>
                  <span className="cw-truncate" style={{ flex: 1 }}>{t.title}</span>
                  <span className="cw-opt-hint">{humanize(t.status)}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Relation field: pick from a list, or jump to what is set. */
function RelationField({
  value, label, options, editable, onChange, href, onOpen, placeholder = 'None',
}: {
  value: string | null;
  label?: string | null;
  options: { value: string; label: string; hint?: string }[];
  editable: boolean;
  onChange: (v: string | null) => void;
  href?: string;
  onOpen?: () => void;
  placeholder?: string;
}) {
  const display = label
    ? <span className="cw-truncate">{label}</span>
    : <span className="cw-cell-empty cw-truncate">{placeholder}</span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {editable ? (
          <Popover
            width={272}
            trigger={({ ref, onClick }) => (
              <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick}>{display}</button>
            )}
          >
            {({ close }) => (
              <OptionList
                searchable={options.length > 8}
                value={value ?? undefined}
                options={options}
                onPick={(v) => { onChange(v); close(); }}
                footer={value ? <button type="button" className="cw-opt" onClick={() => { onChange(null); close(); }}>Clear</button> : undefined}
              />
            )}
          </Popover>
        ) : display}
      </div>
      {label && (href || onOpen) && (
        href
          ? <a href={href} className="cw-icon-btn" style={{ width: 22, height: 22 }} aria-label="Open"><ExternalLink size={11} /></a>
          : <button type="button" className="cw-icon-btn" style={{ width: 22, height: 22 }} aria-label="Open" onClick={onOpen}><ExternalLink size={11} /></button>
      )}
    </div>
  );
}

// ============================================================ Issue

const ISSUE_TABS = ['Details', 'Comments', 'Activity'] as const;

function IssuePanel({ id, onClose }: PanelProps) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const query = useIssue(id);
  const issue = query.data;
  const update = useUpdateIssue();
  const [tab, setTab] = useState<string>('Details');
  const proseKey = useFocusProse(tab === 'Details');
  const people = usePeople(issue?.vertical.id);

  useEffect(() => { setTab('Details'); }, [id]);

  const canEdit = hasPermission('pm.issue.create');
  const canAssign = hasPermission('pm.issue.assign');
  const canResolve = hasPermission('pm.issue.resolve');
  const save = (patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  // The API rejects an illegal transition, so only legal ones are offered.
  const statusOptions = useMemo(
    () => (issue ? [issue.status, ...(issue.allowedTransitions ?? [])] : ISSUE_STATUSES),
    [issue],
  );

  return (
    <PanelFrame open onClose={onClose} query={query} what="this issue">
      {issue && (
        <>
          <RecordHeader
            identifier={issue.ref}
            title={issue.title}
            editable={canEdit}
            onTitleChange={(v) => save({ title: v })}
            context={
              <RecordContext items={[
                <VerticalChip key="v" v={issue.vertical} />,
                issue.project ? <RecordLink key="p" label={issue.project.name} href={`/consultant/projects/${issue.project.id}`} muted /> : null,
                issue.task ? <RecordLink key="t" label={issue.task.ref} kind="TASK" id={issue.task.id} muted /> : null,
              ]} />
            }
            status={
              <span style={{ display: 'inline-flex', gap: 5 }}>
                <StatusCell kind="severity" value={issue.severity} options={SEVERITIES} editable={canEdit} onChange={(v) => save({ severity: v })} />
                <StatusCell kind="issue" value={issue.status} options={statusOptions} editable={canResolve || canEdit} onChange={(v) => save({ status: v })} />
              </span>
            }
          />

          <RecordBody tabs={ISSUE_TABS} active={tab} onTab={setTab}>
            {tab === 'Details' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <Fields>
                  <Field label="Assignee">
                    <PersonCell person={issue.assignee} people={people} editable={canAssign} onChange={(v) => save({ assigneeId: v })} />
                  </Field>
                  <Field label="Reporter"><Person person={issue.reporter} /></Field>
                  <Field label="Type">
                    <StatusCell kind="issue" value={issue.type} options={ISSUE_TYPES} editable={canEdit} onChange={(v) => save({ type: v })} />
                  </Field>
                  <Field label="Priority">
                    <PriorityCell value={issue.priority} editable={canEdit} onChange={(v) => save({ priority: v })} />
                  </Field>
                  <Field label="Target date">
                    <DateCell value={issue.targetDate} status={issue.status} editable={canEdit} onChange={(v) => save({ targetDate: v })} />
                  </Field>
                  {issue.task && (
                    <Field label="Linked task">
                      <RecordLink label={`${issue.task.ref} ${issue.task.title}`} kind="TASK" id={issue.task.id} />
                    </Field>
                  )}
                </Fields>

                <Prose
                  label="What is happening?"
                  value={issue.description}
                  editable={canEdit}
                  autoFocusKey={proseKey}
                  onCommit={(v) => save({ description: v })}
                />

                <Prose
                  label="Resolution"
                  value={issue.resolution}
                  editable={canResolve}
                  rows={3}
                  placeholder="What was actually wrong, and what fixed it?"
                  hint="Required before an issue can be marked resolved."
                  onCommit={(v) => save({ resolution: v })}
                />

                <RelatedDocuments entityType="ISSUE" entityId={issue.id} />

                <RecordFooter items={[
                  { label: 'Raised', value: fmtDateTime(issue.createdAt) },
                  { label: 'Resolved', value: issue.resolvedAt ? fmtDateTime(issue.resolvedAt) : null },
                ]} />
              </div>
            )}
            {tab === 'Comments' && (
              <div style={{ display: 'grid', gap: 24 }}>
                <Comments entityType="ISSUE" entityId={issue.id} />
                <Attachments entityType="ISSUE" entityId={issue.id} />
              </div>
            )}
            {tab === 'Activity' && <ActivityRail entityType="ISSUE" entityId={issue.id} />}
          </RecordBody>
        </>
      )}
    </PanelFrame>
  );
}

// ============================================================ Feature

const FEATURE_TABS = ['Details', 'Comments', 'Activity'] as const;

function FeaturePanel({ id, onClose }: PanelProps) {
  const { hasPermission } = useAuth();
  const query = useFeature(id);
  const f = query.data;
  const update = useUpdateFeature();
  const approve = useApproveFeature();
  const [tab, setTab] = useState<string>('Details');
  const proseKey = useFocusProse(tab === 'Details');
  const people = usePeople(f?.vertical.id);
  const { data: users = [] } = useOrgUsers();

  useEffect(() => { setTab('Details'); }, [id]);

  const canEdit = hasPermission('pm.feature.create');
  const canApprove = hasPermission('pm.feature.approve');
  const save = (patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  return (
    <PanelFrame
      open
      onClose={onClose}
      query={query}
      what="this feature"
      actions={f && canApprove && ['IDEA', 'PLANNED'].includes(f.status) ? (
        <button
          className="cw-btn cw-btn-primary"
          disabled={approve.isPending}
          onClick={() => approve.mutate(f.id, { onSuccess: () => toast.success('Feature approved'), onError: (e) => toast.error(apiErrorMessage(e)) })}
        ><CheckCircle2 size={13} /> Approve</button>
      ) : undefined}
    >
      {f && (
        <>
          <RecordHeader
            identifier={f.ref}
            title={f.name}
            editable={canEdit}
            onTitleChange={(v) => save({ name: v })}
            context={
              <RecordContext items={[
                <VerticalChip key="v" v={f.vertical} />,
                f.project ? <RecordLink key="p" label={f.project.name} href={`/consultant/projects/${f.project.id}`} muted /> : null,
                f.milestone ? <RecordLink key="m" label={f.milestone.name} kind="MILESTONE" id={f.milestone.id} muted /> : null,
              ]} />
            }
            status={<StatusCell kind="feature" value={f.status} options={FEATURE_STATUSES} editable={canEdit} onChange={(v) => save({ status: v })} />}
          />

          <RecordBody tabs={FEATURE_TABS} active={tab} onTab={setTab}>
            {tab === 'Details' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <Fields>
                  <Field label="Owner">
                    <PersonCell person={f.owner} people={people} editable={canEdit} onChange={(v) => save({ ownerId: v })} />
                  </Field>
                  <Field label="Developers">
                    <AssigneeMulti
                      values={f.assignees.map((a) => a.id)}
                      people={users}
                      editable={canEdit}
                      onChange={(ids) => save({ assigneeIds: ids })}
                    />
                  </Field>
                  <Field label="Requested by"><Person person={f.requestedBy} /></Field>
                  <Field label="Priority">
                    <PriorityCell value={f.priority} editable={canEdit} onChange={(v) => save({ priority: v })} />
                  </Field>
                  <Field label="Estimate">
                    <TextCell value={f.estimateHours ?? ''} type="number" editable={canEdit} onCommit={(v) => save({ estimateHours: v === '' ? null : Number(v) })} />
                  </Field>
                  <Field label="Target release">
                    <TextCell value={f.targetRelease ?? ''} editable={canEdit} placeholder="e.g. v2.4" onCommit={(v) => save({ targetRelease: v || null })} />
                  </Field>
                  {f.approvedBy && <Field label="Approved by"><Person person={f.approvedBy} /></Field>}
                </Fields>

                <Prose label="Business objective" value={f.objective} editable={canEdit} rows={2} placeholder="Why is this worth building?" onCommit={(v) => save({ objective: v })} />
                <Prose label="Description" value={f.description} editable={canEdit} autoFocusKey={proseKey} onCommit={(v) => save({ description: v })} />
                <Prose label="Acceptance criteria" value={f.acceptanceCriteria} editable={canEdit} rows={4} placeholder="How will we know it is done?" onCommit={(v) => save({ acceptanceCriteria: v })} />

                <RelatedDocuments entityType="FEATURE" entityId={f.id} />

                <RecordFooter items={[
                  { label: 'Created', value: fmtDateTime(f.createdAt) },
                  { label: 'Approved', value: f.approvedAt ? fmtDateTime(f.approvedAt) : null },
                  { label: 'Released', value: f.releasedAt ? fmtDateTime(f.releasedAt) : null },
                ]} />
              </div>
            )}
            {tab === 'Comments' && (
              <div style={{ display: 'grid', gap: 24 }}>
                <Comments entityType="FEATURE" entityId={f.id} />
                <Attachments entityType="FEATURE" entityId={f.id} />
              </div>
            )}
            {tab === 'Activity' && <ActivityRail entityType="FEATURE" entityId={f.id} />}
          </RecordBody>
        </>
      )}
    </PanelFrame>
  );
}

function AssigneeMulti({
  values, people, editable, onChange,
}: { values: string[]; people: { id: string; name: string }[]; editable: boolean; onChange: (ids: string[]) => void }) {
  const selected = people.filter((p) => values.includes(p.id));
  const display = selected.length
    ? <AvatarStack people={selected} max={4} />
    : <span className="cw-cell-empty">Nobody assigned</span>;
  if (!editable) return display;
  return (
    <Popover
      width={272}
      trigger={({ ref, onClick }) => (
        <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick}>{display}</button>
      )}
    >
      <OptionList
        searchable
        values={values}
        options={people.map((p) => ({ value: p.id, label: p.name, icon: <Avatar name={p.name} size={19} /> }))}
        onPick={(v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])}
      />
    </Popover>
  );
}

// ============================================================ Milestone

const MILESTONE_TABS = ['Details', 'Work', 'Comments', 'Activity'] as const;

function MilestonePanel({ id, onClose }: PanelProps) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const query = useMilestones({});
  const milestone = query.data?.find((m) => m.id === id) ?? null;
  const update = useUpdateMilestone();
  const tasks = useTasks({ milestoneId: id, limit: 100 });
  const people = usePeople(milestone?.vertical.id);
  const [tab, setTab] = useState<string>('Details');
  const proseKey = useFocusProse(tab === 'Details');

  useEffect(() => { setTab('Details'); }, [id]);

  const canManage = hasPermission('pm.milestone.manage');
  const save = (patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  return (
    <PanelFrame open onClose={onClose} query={query} what="this milestone">
      {!milestone ? (
        <Empty title="Milestone not found" body="It may have been deleted since this screen was opened." />
      ) : (
        <>
          <RecordHeader
            title={milestone.name}
            editable={canManage}
            onTitleChange={(v) => save({ name: v })}
            context={
              <RecordContext items={[
                <VerticalChip key="v" v={milestone.vertical} />,
                milestone.project ? <RecordLink key="p" label={milestone.project.name} href={`/consultant/projects/${milestone.project.id}`} muted /> : null,
              ]} />
            }
            status={<StatusCell kind="milestone" value={milestone.status} options={MILESTONE_STATUSES} editable={canManage} onChange={(v) => save({ status: v })} />}
          />

          <RecordBody tabs={MILESTONE_TABS} active={tab} onTab={setTab} counts={{ Work: tasks.data?.meta.total }}>
            {tab === 'Details' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
                  <Stat label="Progress" value={`${milestone.progress}%`} />
                  <Stat label="Done" value={milestone.tasksDone} tone="green" />
                  <Stat label="Remaining" value={milestone.tasksRemaining} tone={milestone.tasksRemaining ? 'amber' : undefined} />
                  <div style={{ minWidth: 160, alignSelf: 'flex-end', paddingBottom: 5 }}>
                    <ProgressBar value={milestone.progress} tone={milestoneTone(milestone.status)} />
                  </div>
                </div>

                <Fields>
                  <Field label="Owner">
                    <PersonCell person={milestone.owner} people={people} editable={canManage} onChange={(v) => save({ ownerId: v })} />
                  </Field>
                  <Field label="Target date">
                    <DateCell value={milestone.targetDate} status={milestone.status} editable={canManage} onChange={(v) => save({ targetDate: v })} />
                  </Field>
                  <Field label="Start date">
                    <DateCell value={milestone.startDate} editable={canManage} onChange={(v) => save({ startDate: v })} />
                  </Field>
                </Fields>

                <Prose label="Description" value={milestone.description} editable={canManage} autoFocusKey={proseKey} rows={4} onCommit={(v) => save({ description: v })} />

                <RelatedDocuments entityType="MILESTONE" entityId={id} />
              </div>
            )}

            {tab === 'Work' && (
              tasks.isLoading ? <Loading kind="list" rows={5} />
                : !tasks.data?.data.length ? <Empty title="No tasks on this milestone" body="Attach tasks from the task table or a task's Details tab." />
                  : tasks.data.data.map((t) => (
                    <button key={t.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', t.id)}>
                      <span className="cw-mono">{t.ref}</span>
                      <span className="cw-truncate" style={{ flex: 1 }}>{t.title}</span>
                      <StatusChip kind="task" value={t.status} />
                      <Avatar name={t.assignee?.name} size={18} />
                    </button>
                  ))
            )}
            {tab === 'Comments' && <Comments entityType="MILESTONE" entityId={id} />}
            {tab === 'Activity' && <ActivityRail entityType="MILESTONE" entityId={id} />}
          </RecordBody>
        </>
      )}
    </PanelFrame>
  );
}

// ============================================================ Project (peek)

const PROJECT_TABS = ['Details', 'Comments', 'Activity'] as const;

function ProjectPanel({ id, onClose }: PanelProps) {
  const { hasPermission } = useAuth();
  const query = useProject(id);
  const p = query.data;
  const update = useUpdateProject();
  const people = usePeople(p?.vertical.id);
  const [tab, setTab] = useState<string>('Details');
  const proseKey = useFocusProse(tab === 'Details');

  useEffect(() => { setTab('Details'); }, [id]);

  const canEdit = hasPermission('pm.project.update');
  const save = (patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  const counts = (p as any)?.counts ?? {};

  return (
    <PanelFrame open onClose={onClose} query={query} what="this project" openHref={`/consultant/projects/${id}`}>
      {p && (
        <>
          <RecordHeader
            title={p.name}
            editable={canEdit}
            onTitleChange={(v) => save({ name: v })}
            context={<RecordContext items={[<VerticalChip key="v" v={p.vertical} />]} />}
            status={<StatusCell kind="project" value={p.status} options={PROJECT_STATUSES} editable={canEdit} onChange={(v) => save({ status: v })} />}
          />

          <RecordBody tabs={PROJECT_TABS} active={tab} onTab={setTab}>
            {tab === 'Details' && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
                  <Stat label="Progress" value={`${p.progress}%`} />
                  <Stat label="Tasks" value={`${counts.tasksDone ?? 0}/${counts.tasks ?? 0}`} tone="green" />
                  <Stat label="Overdue" value={counts.overdueTasks ?? 0} tone={counts.overdueTasks ? 'red' : undefined} />
                  <Stat label="Open issues" value={counts.openIssues ?? 0} tone={counts.openIssues ? 'amber' : undefined} />
                  <div style={{ minWidth: 150, alignSelf: 'flex-end', paddingBottom: 5 }}>
                    <ProgressBar value={p.progress} tone={projectTone(p.status)} />
                  </div>
                </div>

                <Fields>
                  <Field label="Project manager">
                    <PersonCell person={p.projectManager} people={people} editable={canEdit} onChange={(v) => save({ projectManagerId: v })} />
                  </Field>
                  <Field label="Technical lead">
                    <PersonCell person={p.techLead} people={people} editable={canEdit} onChange={(v) => save({ techLeadId: v })} />
                  </Field>
                  <Field label="Owner">
                    <PersonCell person={p.owner} people={people} editable={canEdit} onChange={(v) => save({ ownerId: v })} />
                  </Field>
                  <Field label="Priority">
                    <PriorityCell value={p.priority} editable={canEdit} onChange={(v) => save({ priority: v })} />
                  </Field>
                  <Field label="Start date">
                    <DateCell value={p.startDate} editable={canEdit} onChange={(v) => save({ startDate: v })} />
                  </Field>
                  <Field label="Target date">
                    <DateCell value={p.targetDate} status={p.status} editable={canEdit} onChange={(v) => save({ targetDate: v })} />
                  </Field>
                </Fields>

                <Prose label="Description" value={p.description} editable={canEdit} autoFocusKey={proseKey} onCommit={(v) => save({ description: v })} />

                <RelatedDocuments entityType="PROJECT" entityId={id} />
              </div>
            )}
            {tab === 'Comments' && <Comments entityType="PROJECT" entityId={id} />}
            {tab === 'Activity' && <ActivityRail verticalId={p.vertical.id} limit={40} />}
          </RecordBody>
        </>
      )}
    </PanelFrame>
  );
}

// ============================================================ Developer

const DEV_TABS = ['Work', 'Activity'] as const;

function DeveloperPanel({ id, onClose }: PanelProps) {
  const ws = useWorkspace();
  const query = useDeveloperReport(id);
  const report = query.data;
  const { data: users = [] } = useOrgUsers();
  const tasks = useTasks({ assigneeId: id, limit: 60 });
  const user = users.find((u) => u.id === id);
  const [tab, setTab] = useState<string>('Work');

  useEffect(() => { setTab('Work'); }, [id]);

  const t = report?.totals ?? {};
  const open = (tasks.data?.data ?? []).filter((x) => x.status !== 'DONE' && x.status !== 'CANCELLED');

  return (
    <PanelFrame open onClose={onClose} query={query} what="this developer">
      <RecordHeader
        title={user?.name ?? 'Developer'}
        context={<RecordContext items={[<span key="r" className="cw-meta">{user?.role ?? user?.email}</span>]} />}
        status={<Avatar name={user?.name} size={26} />}
      />

      <RecordBody tabs={DEV_TABS} active={tab} onTab={setTab} counts={{ Work: open.length }}>
        {tab === 'Work' && (
          <div style={{ display: 'grid', gap: 22 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Stat label="Active" value={t.active ?? 0} />
              <Stat label="Completed" value={t.completed ?? 0} tone="green" />
              <Stat label="Overdue" value={t.overdue ?? 0} tone={t.overdue ? 'red' : undefined} />
              <Stat label="Blocked" value={t.blocked ?? 0} tone={t.blocked ? 'amber' : undefined} />
              <Stat label="In review" value={t.inReview ?? 0} />
              <Stat label="Completion" value={`${t.completionRate ?? 0}%`} />
            </div>

            <div>
              <div className="cw-h2" style={{ marginBottom: 8 }}>Current work</div>
              {tasks.isLoading ? <Loading kind="list" rows={4} />
                : !open.length ? <Empty compact title="Nothing assigned" body="This person has no open work right now." />
                  : open.map((x) => (
                    <button key={x.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', x.id)}>
                      <span className="cw-mono">{x.ref}</span>
                      <span className="cw-truncate" style={{ flex: 1 }}>{x.title}</span>
                      <StatusChip kind="task" value={x.status} />
                    </button>
                  ))}
            </div>

            {report?.byVertical?.length > 0 && (
              <div>
                <div className="cw-h2" style={{ marginBottom: 8 }}>Across product lines</div>
                {report.byVertical.map((b: any, i: number) => (
                  <div key={i} className="cw-row" style={{ cursor: 'default' }}>
                    <span className="cw-truncate" style={{ flex: 1 }}>{b.vertical?.icon} {b.vertical?.name ?? 'Unknown'}</span>
                    <span className="cw-num cw-meta">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'Activity' && <ActivityRail limit={40} />}
      </RecordBody>
    </PanelFrame>
  );
}
