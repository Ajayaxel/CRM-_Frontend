'use client';

/**
 * Quick create (spec §28).
 *
 * Short forms. Only the fields you cannot sensibly default are shown up front;
 * everything else sits behind "More fields", because a fourteen-input modal is
 * how a tracker teaches people to avoid creating tickets.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api';
import {
  useCreateDocument, useCreateFeature, useCreateIssue, useCreateMilestone,
  useCreateProject, useCreateTask, useCreateVertical, useMilestones, useOrgUsers,
  useProjects, useVerticals,
} from '../api';
import { Panel, Fields, Field } from '../ui/panel';
import { OptionList, Popover, humanize } from '../ui/primitives';
import {
  DOC_TYPES, ISSUE_TYPES, PRIORITIES, PROJECT_STATUSES, SEVERITIES, TASK_STATUSES,
} from './create-constants';
import { PersonCell, PriorityCell, StatusCell } from '../ui/cells';
import { usePeople } from './use-people';
import type { CreateDefaults, CreateKind } from '../ui/workspace-context';

export function CreatePanels({
  open, onClose, onCreated,
}: {
  open: { kind: CreateKind; defaults?: CreateDefaults } | null;
  onClose: () => void;
  onCreated: (kind: CreateKind, row: any) => void;
}) {
  if (!open) return null;
  const props = { defaults: open.defaults ?? {}, onClose, onCreated };
  switch (open.kind) {
    case 'TASK': return <CreateTask {...props} />;
    case 'ISSUE': return <CreateIssue {...props} />;
    case 'FEATURE': return <CreateFeature {...props} />;
    case 'PROJECT': return <CreateProject {...props} />;
    case 'MILESTONE': return <CreateMilestone {...props} />;
    case 'DOCUMENT': return <CreateDocument {...props} />;
    case 'VERTICAL': return <CreateVertical {...props} />;
    default: return null;
  }
}

interface FormProps {
  defaults: CreateDefaults;
  onClose: () => void;
  onCreated: (kind: CreateKind, row: any) => void;
}

/** Shared chrome: title, body, and a footer that is the only place to submit. */
function CreateShell({
  title, subtitle, onClose, onSubmit, submitting, canSubmit, children, more,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
  children: React.ReactNode;
  more?: React.ReactNode;
}) {
  const [showMore, setShowMore] = useState(false);
  return (
    <Panel open onClose={onClose} title={title} subtitle={subtitle} width={520}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit && !submitting) onSubmit(); }}
        style={{ display: 'grid', gap: 16 }}
      >
        {children}

        {more && (
          <div>
            <button
              type="button"
              className="cw-btn cw-btn-ghost"
              onClick={() => setShowMore((s) => !s)}
              style={{ paddingLeft: 4 }}
            >
              {showMore ? <ChevronDown size={13} /> : <ChevronRight size={13} />} More fields
            </button>
            {showMore && <div style={{ marginTop: 12 }}>{more}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--cw-line)', paddingTop: 14 }}>
          <button type="button" className="cw-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="cw-btn cw-btn-primary" disabled={!canSubmit || submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** Vertical selector reused by every form — it is the one required relation. */
function VerticalField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { data: verticals = [] } = useVerticals();
  const current = verticals.find((v: any) => v.id === value);
  return (
    <Popover
      width={280}
      trigger={({ ref, onClick }) => (
        <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick} style={{ minHeight: 28 }}>
          {current
            ? <span className="cw-truncate">{(current as any).icon} {current.name}</span>
            : <span className="cw-cell-empty">Choose a product line</span>}
        </button>
      )}
    >
      {({ close }) => (
        <OptionList
          searchable
          value={value ?? undefined}
          options={verticals.map((v: any) => ({ value: v.id, label: `${v.icon ?? ''} ${v.name}`.trim(), hint: v.key }))}
          onPick={(v) => { onChange(v); close(); }}
        />
      )}
    </Popover>
  );
}

function ProjectField({ verticalId, value, onChange }: { verticalId: string | null; value: string | null; onChange: (v: string | null) => void }) {
  const { data } = useProjects({ verticalId: verticalId ?? undefined, limit: 100 });
  const options = (data?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const current = options.find((o) => o.value === value);
  return (
    <Popover
      width={264}
      trigger={({ ref, onClick }) => (
        <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick} style={{ minHeight: 28 }}>
          {current ? <span className="cw-truncate">{current.label}</span> : <span className="cw-cell-empty">No project</span>}
        </button>
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
  );
}

// ============================================================ Task

function CreateTask({ defaults, onClose, onCreated }: FormProps) {
  const create = useCreateTask();
  const [verticalId, setVerticalId] = useState<string | null>(defaults.verticalId ?? null);
  const [projectId, setProjectId] = useState<string | null>(defaults.projectId ?? null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(defaults.status ?? 'TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string | null>(defaults.assigneeId ?? null);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [estimate, setEstimate] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState<string | null>(defaults.milestoneId ?? null);

  const people = usePeople(verticalId ?? undefined);
  const { data: milestones } = useMilestones({ verticalId: verticalId ?? undefined });

  const submit = () => create.mutate(
    {
      verticalId, projectId: projectId ?? undefined, parentId: defaults.parentId,
      title: title.trim(), status, priority,
      assigneeId: assigneeId ?? undefined, reviewerId: reviewerId ?? undefined,
      milestoneId: milestoneId ?? undefined,
      dueDate: dueDate || undefined,
      estimateHours: estimate === '' ? undefined : Number(estimate),
      description: description || undefined,
    },
    { onSuccess: (t: any) => { toast.success(`${t.ref} created`); onCreated('TASK', t); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  );

  return (
    <CreateShell
      title="New task"
      subtitle="Assign it now — unassigned work is invisible work"
      onClose={onClose}
      onSubmit={submit}
      submitting={create.isPending}
      canSubmit={Boolean(verticalId && title.trim())}
      more={
        <Fields>
          <Field label="Reviewer"><PersonCell person={people.find((p) => p.id === reviewerId) ?? null} people={people} placeholder="No reviewer" onChange={setReviewerId} /></Field>
          <Field label="Milestone">
            <Popover
              width={264}
              trigger={({ ref, onClick }) => (
                <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick}>
                  {milestones?.find((m) => m.id === milestoneId)?.name ?? <span className="cw-cell-empty">No milestone</span>}
                </button>
              )}
            >
              {({ close }) => (
                <OptionList
                  value={milestoneId ?? undefined}
                  options={(milestones ?? []).map((m) => ({ value: m.id, label: m.name }))}
                  onPick={(v) => { setMilestoneId(v); close(); }}
                />
              )}
            </Popover>
          </Field>
          <Field label="Estimate (h)">
            <input className="cw-input" type="number" min={0} step={0.5} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </Field>
        </Fields>
      }
    >
      <div>
        <label className="cw-label">Title</label>
        <input className="cw-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
      </div>

      <Fields>
        {!defaults.verticalId && <Field label="Product line"><VerticalField value={verticalId} onChange={setVerticalId} /></Field>}
        {!defaults.projectId && <Field label="Project"><ProjectField verticalId={verticalId} value={projectId} onChange={setProjectId} /></Field>}
        <Field label="Status"><StatusCell kind="task" value={status} options={TASK_STATUSES} onChange={setStatus} /></Field>
        <Field label="Priority"><PriorityCell value={priority} onChange={setPriority} /></Field>
        <Field label="Assignee">
          <PersonCell person={people.find((p) => p.id === assigneeId) ?? null} people={people} onChange={setAssigneeId} />
        </Field>
        <Field label="Due date">
          <input className="cw-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </Fields>

      <div>
        <label className="cw-label">Description</label>
        <textarea className="cw-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </CreateShell>
  );
}

// ============================================================ Issue

function CreateIssue({ defaults, onClose, onCreated }: FormProps) {
  const create = useCreateIssue();
  const [verticalId, setVerticalId] = useState<string | null>(defaults.verticalId ?? null);
  const [projectId, setProjectId] = useState<string | null>(defaults.projectId ?? null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('BUG');
  const [severity, setSeverity] = useState('MODERATE');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const people = usePeople(verticalId ?? undefined);

  const submit = () => create.mutate(
    {
      verticalId, projectId: projectId ?? undefined, title: title.trim(), type, severity, priority,
      assigneeId: assigneeId ?? undefined, targetDate: targetDate || undefined, description: description || undefined,
    },
    { onSuccess: (i: any) => { toast.success(`${i.ref} raised`); onCreated('ISSUE', i); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  );

  return (
    <CreateShell
      title="Raise an issue"
      subtitle="Critical issues notify the product line's owner, PM and technical lead immediately"
      onClose={onClose}
      onSubmit={submit}
      submitting={create.isPending}
      canSubmit={Boolean(verticalId && title.trim())}
      more={
        <Fields>
          <Field label="Project"><ProjectField verticalId={verticalId} value={projectId} onChange={setProjectId} /></Field>
          <Field label="Target date">
            <input className="cw-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </Fields>
      }
    >
      <div>
        <label className="cw-label">Title</label>
        <input className="cw-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is broken?" />
      </div>

      <Fields>
        {!defaults.verticalId && <Field label="Product line"><VerticalField value={verticalId} onChange={setVerticalId} /></Field>}
        <Field label="Type"><StatusCell kind="issue" value={type} options={ISSUE_TYPES} onChange={setType} /></Field>
        <Field label="Severity"><StatusCell kind="severity" value={severity} options={SEVERITIES} onChange={setSeverity} /></Field>
        <Field label="Priority"><PriorityCell value={priority} onChange={setPriority} /></Field>
        <Field label="Assignee">
          <PersonCell person={people.find((p) => p.id === assigneeId) ?? null} people={people} onChange={setAssigneeId} />
        </Field>
      </Fields>

      <div>
        <label className="cw-label">What is happening?</label>
        <textarea className="cw-input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Steps, impact, and anything already ruled out." />
      </div>
    </CreateShell>
  );
}

// ============================================================ Feature

function CreateFeature({ defaults, onClose, onCreated }: FormProps) {
  const create = useCreateFeature();
  const [verticalId, setVerticalId] = useState<string | null>(defaults.verticalId ?? null);
  const [projectId, setProjectId] = useState<string | null>(defaults.projectId ?? null);
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [objective, setObjective] = useState('');
  const [description, setDescription] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [targetRelease, setTargetRelease] = useState('');
  const people = usePeople(verticalId ?? undefined);

  const submit = () => create.mutate(
    {
      verticalId, projectId: projectId ?? undefined, name: name.trim(), priority,
      ownerId: ownerId ?? undefined, objective: objective || undefined,
      description: description || undefined, acceptanceCriteria: acceptance || undefined,
      targetRelease: targetRelease || undefined,
    },
    { onSuccess: (f: any) => { toast.success(`${f.ref} created`); onCreated('FEATURE', f); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  );

  return (
    <CreateShell
      title="New feature"
      subtitle="Enhancements, change requests and client asks"
      onClose={onClose}
      onSubmit={submit}
      submitting={create.isPending}
      canSubmit={Boolean(verticalId && name.trim())}
      more={
        <div style={{ display: 'grid', gap: 12 }}>
          <Fields>
            <Field label="Project"><ProjectField verticalId={verticalId} value={projectId} onChange={setProjectId} /></Field>
            <Field label="Target release">
              <input className="cw-input" value={targetRelease} onChange={(e) => setTargetRelease(e.target.value)} placeholder="v2.4" />
            </Field>
          </Fields>
          <div>
            <label className="cw-label">Acceptance criteria</label>
            <textarea className="cw-input" rows={3} value={acceptance} onChange={(e) => setAcceptance(e.target.value)} placeholder="How will we know it is done?" />
          </div>
        </div>
      }
    >
      <div>
        <label className="cw-label">Feature</label>
        <input className="cw-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <Fields>
        {!defaults.verticalId && <Field label="Product line"><VerticalField value={verticalId} onChange={setVerticalId} /></Field>}
        <Field label="Priority"><PriorityCell value={priority} onChange={setPriority} /></Field>
        <Field label="Owner">
          <PersonCell person={people.find((p) => p.id === ownerId) ?? null} people={people} onChange={setOwnerId} />
        </Field>
      </Fields>

      <div>
        <label className="cw-label">Business objective</label>
        <textarea className="cw-input" rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Why is this worth building?" />
      </div>
      <div>
        <label className="cw-label">Description</label>
        <textarea className="cw-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </CreateShell>
  );
}

// ============================================================ Project

function CreateProject({ defaults, onClose, onCreated }: FormProps) {
  const create = useCreateProject();
  const [verticalId, setVerticalId] = useState<string | null>(defaults.verticalId ?? null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('PLANNING');
  const [priority, setPriority] = useState('MEDIUM');
  const [pmId, setPmId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const people = usePeople(verticalId ?? undefined);

  const submit = () => create.mutate(
    {
      verticalId, name: name.trim(), status, priority,
      projectManagerId: pmId ?? undefined, techLeadId: leadId ?? undefined,
      startDate: startDate || undefined, targetDate: targetDate || undefined,
      description: description || undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    },
    { onSuccess: (p: any) => { toast.success('Project created'); onCreated('PROJECT', p); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  );

  return (
    <CreateShell
      title="New project"
      onClose={onClose}
      onSubmit={submit}
      submitting={create.isPending}
      canSubmit={Boolean(verticalId && name.trim())}
      more={
        <div style={{ display: 'grid', gap: 12 }}>
          <Fields>
            <Field label="Start date"><input className="cw-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Tags"><input className="cw-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" /></Field>
          </Fields>
          <div>
            <label className="cw-label">Description</label>
            <textarea className="cw-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      }
    >
      <div>
        <label className="cw-label">Project name</label>
        <input className="cw-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Fields>
        {!defaults.verticalId && <Field label="Product line"><VerticalField value={verticalId} onChange={setVerticalId} /></Field>}
        <Field label="Status"><StatusCell kind="project" value={status} options={PROJECT_STATUSES} onChange={setStatus} /></Field>
        <Field label="Priority"><PriorityCell value={priority} onChange={setPriority} /></Field>
        <Field label="Project manager">
          <PersonCell person={people.find((p) => p.id === pmId) ?? null} people={people} onChange={setPmId} />
        </Field>
        <Field label="Technical lead">
          <PersonCell person={people.find((p) => p.id === leadId) ?? null} people={people} onChange={setLeadId} />
        </Field>
        <Field label="Target date"><input className="cw-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></Field>
      </Fields>
    </CreateShell>
  );
}

// ============================================================ Milestone

function CreateMilestone({ defaults, onClose, onCreated }: FormProps) {
  const create = useCreateMilestone();
  const [verticalId, setVerticalId] = useState<string | null>(defaults.verticalId ?? null);
  const [projectId, setProjectId] = useState<string | null>(defaults.projectId ?? null);
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const people = usePeople(verticalId ?? undefined);

  const submit = () => create.mutate(
    {
      verticalId, projectId: projectId ?? undefined, name: name.trim(),
      ownerId: ownerId ?? undefined, targetDate: targetDate || undefined, description: description || undefined,
    },
    { onSuccess: (m: any) => { toast.success('Milestone created'); onCreated('MILESTONE', m); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  );

  return (
    <CreateShell
      title="New milestone"
      onClose={onClose}
      onSubmit={submit}
      submitting={create.isPending}
      canSubmit={Boolean(verticalId && name.trim())}
    >
      <div>
        <label className="cw-label">Name</label>
        <input className="cw-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MVP release" />
      </div>
      <Fields>
        {!defaults.verticalId && <Field label="Product line"><VerticalField value={verticalId} onChange={setVerticalId} /></Field>}
        <Field label="Project"><ProjectField verticalId={verticalId} value={projectId} onChange={setProjectId} /></Field>
        <Field label="Owner">
          <PersonCell person={people.find((p) => p.id === ownerId) ?? null} people={people} onChange={setOwnerId} />
        </Field>
        <Field label="Target date"><input className="cw-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></Field>
      </Fields>
      <div>
        <label className="cw-label">Description</label>
        <textarea className="cw-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </CreateShell>
  );
}

// ============================================================ Document

function CreateDocument({ defaults, onClose, onCreated }: FormProps) {
  const create = useCreateDocument();
  const [verticalId, setVerticalId] = useState<string | null>(defaults.verticalId ?? null);
  const [projectId, setProjectId] = useState<string | null>(defaults.projectId ?? null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('PROJECT');
  const [summary, setSummary] = useState('');

  const submit = () => create.mutate(
    { verticalId, projectId: projectId ?? undefined, title: title.trim(), type, summary: summary || undefined, body: '' },
    { onSuccess: (d: any) => onCreated('DOCUMENT', d), onError: (e) => toast.error(apiErrorMessage(e)) },
  );

  return (
    <CreateShell
      title="New document"
      onClose={onClose}
      onSubmit={submit}
      submitting={create.isPending}
      canSubmit={Boolean(verticalId && title.trim())}
    >
      <div>
        <label className="cw-label">Title</label>
        <input className="cw-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <Fields>
        {!defaults.verticalId && <Field label="Product line"><VerticalField value={verticalId} onChange={setVerticalId} /></Field>}
        <Field label="Project"><ProjectField verticalId={verticalId} value={projectId} onChange={setProjectId} /></Field>
        <Field label="Type">
          <select className="cw-input" value={type} onChange={(e) => setType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
        </Field>
      </Fields>
      <div>
        <label className="cw-label">Summary</label>
        <textarea className="cw-input" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One line, shown in the library." />
      </div>
    </CreateShell>
  );
}

// ============================================================ Vertical

function CreateVertical({ onClose, onCreated }: FormProps) {
  const create = useCreateVertical();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [accent, setAccent] = useState('#2d7dd2');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [pmId, setPmId] = useState<string | null>(null);
  const people = usePeople();

  const keyValid = /^[A-Z0-9]{1,12}$/.test(key);

  const submit = () => create.mutate(
    {
      key, name: name.trim(), icon, accent,
      description: description || undefined,
      ownerId: ownerId ?? undefined, projectManagerId: pmId ?? undefined,
    },
    { onSuccess: (v: any) => { toast.success(`${v.name} created`); onCreated('VERTICAL', v); }, onError: (e) => toast.error(apiErrorMessage(e)) },
  );

  return (
    <CreateShell
      title="New product line"
      subtitle="A product line groups the projects, work and documentation for one part of the platform"
      onClose={onClose}
      onSubmit={submit}
      submitting={create.isPending}
      canSubmit={keyValid && Boolean(name.trim())}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '58px 96px 1fr', gap: 10 }}>
        <div>
          <label className="cw-label">Icon</label>
          <input className="cw-input" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} style={{ textAlign: 'center', fontSize: 16 }} />
        </div>
        <div>
          <label className="cw-label">Key</label>
          <input
            className="cw-input"
            value={key}
            maxLength={12}
            placeholder="INS"
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
        </div>
        <div>
          <label className="cw-label">Name</label>
          <input className="cw-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="cw-meta" style={{ marginTop: -8 }}>
        The key prefixes every work item here — {key || 'INS'}-1, {key || 'INS'}-I1, {key || 'INS'}-F1. It cannot be changed later.
      </div>

      <Fields>
        <Field label="Owner"><PersonCell person={people.find((p) => p.id === ownerId) ?? null} people={people} onChange={setOwnerId} /></Field>
        <Field label="Project manager"><PersonCell person={people.find((p) => p.id === pmId) ?? null} people={people} onChange={setPmId} /></Field>
        <Field label="Accent">
          <input type="color" className="cw-input" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 60, padding: 2 }} />
        </Field>
      </Fields>

      <div>
        <label className="cw-label">Description</label>
        <textarea className="cw-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </CreateShell>
  );
}
