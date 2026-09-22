'use client';

/** Problems & issues (spec §16) — same table model, severity-first ordering. */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bug, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { useIssueStats, useIssues, useUpdateIssue, useVerticals, type Issue } from '../api';
import { Table, type Column } from '../ui/table';
import {
  FilterBar, ViewTabs, filtersToQuery, personOptions, useSavedViews,
  type ActiveFilter, type FilterDef, type SavedView,
} from '../ui/filters';
import { Empty, Stat, fmtAgo, humanize } from '../ui/primitives';
import {
  DateCell, ISSUE_STATUSES, ISSUE_TYPES, PRIORITIES, PersonCell, PriorityCell,
  SEVERITIES, StatusCell, issueTone, severityTone,
} from '../ui/cells';
import { usePeople } from '../records/use-people';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';

const BUILT_IN: SavedView[] = [
  { id: 'open', name: 'Open', filters: [{ key: 'status', op: 'is', values: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING'] }] },
  { id: 'critical', name: 'Critical', filters: [{ key: 'severity', op: 'is', values: ['CRITICAL'] }] },
  { id: 'unassigned', name: 'Unassigned', filters: [{ key: 'status', op: 'is', values: ['OPEN'] }] },
  { id: 'resolved', name: 'Resolved', filters: [{ key: 'status', op: 'is', values: ['RESOLVED', 'VERIFIED'] }] },
  { id: 'all', name: 'All', filters: [] },
];

export function IssuesScreen({
  verticalId, projectId, embedded,
}: { verticalId?: string; projectId?: string; embedded?: boolean }) {
  const params = useSearchParams();
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const update = useUpdateIssue();
  const people = usePeople(verticalId);
  const { data: verticals = [] } = useVerticals();
  const { data: stats } = useIssueStats(verticalId);

  const scope = verticalId ?? projectId ?? 'global';
  const { views, save, remove } = useSavedViews(`issues:${scope}`, BUILT_IN);
  const [viewId, setViewId] = useState('open');
  const [filters, setFilters] = useState<ActiveFilter[]>(BUILT_IN[0].filters);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const focus = params.get('focus');
    if (focus) ws.openRecord('ISSUE', focus);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'severity', label: 'Severity', type: 'enum', options: SEVERITIES.map((s) => ({ value: s, label: humanize(s), tone: severityTone(s) })) },
    { key: 'status', label: 'Status', type: 'enum', options: ISSUE_STATUSES.map((s) => ({ value: s, label: humanize(s), tone: issueTone(s) })) },
    { key: 'type', label: 'Type', type: 'enum', options: ISSUE_TYPES.map((t) => ({ value: t, label: humanize(t) })) },
    { key: 'priority', label: 'Priority', type: 'enum', options: PRIORITIES.map((p) => ({ value: p, label: humanize(p) })) },
    { key: 'assigneeId', label: 'Assignee', type: 'person', options: personOptions(people), toQuery: (f) => ({ assigneeId: f.values[0] }) },
    ...(!verticalId ? [{ key: 'verticalId', label: 'Product line', type: 'enum' as const, options: verticals.map((v: any) => ({ value: v.id, label: v.name })), toQuery: (f: ActiveFilter) => ({ verticalId: f.values[0] }) }] : []),
  ], [people, verticals, verticalId]);

  const { data, isLoading } = useIssues({
    verticalId, projectId, limit: 200,
    search: search.trim() || undefined,
    ...filtersToQuery(defs, filters),
  });

  const canEdit = hasPermission('pm.issue.create');
  const canAssign = hasPermission('pm.issue.assign');
  const canResolve = hasPermission('pm.issue.resolve');

  const save1 = (id: string, patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  const columns = useMemo<Column<Issue>[]>(() => [
    {
      key: 'title', header: 'Issue', width: 320, minWidth: 200, locked: true, sortValue: (i) => i.title,
      render: (i) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="cw-mono" style={{ flex: 'none' }}>{i.ref}</span>
          <span className="cw-truncate" style={{ fontWeight: 520 }}>{i.title}</span>
        </span>
      ),
    },
    {
      key: 'severity', header: 'Severity', width: 122, sortValue: (i) => SEVERITIES.indexOf(i.severity),
      render: (i) => <StatusCell kind="severity" value={i.severity} options={SEVERITIES} editable={canEdit} onChange={(v) => save1(i.id, { severity: v })} />,
    },
    {
      key: 'status', header: 'Status', width: 130, sortValue: (i) => i.status,
      render: (i) => <StatusCell kind="issue" value={i.status} options={ISSUE_STATUSES} editable={canResolve || canEdit} onChange={(v) => save1(i.id, { status: v })} />,
    },
    {
      key: 'assignee', header: 'Assignee', width: 170, sortValue: (i) => i.assignee?.name,
      render: (i) => <PersonCell person={i.assignee} people={people} editable={canAssign} onChange={(v) => save1(i.id, { assigneeId: v })} />,
    },
    {
      key: 'type', header: 'Type', width: 132, sortValue: (i) => i.type,
      render: (i) => <StatusCell kind="issue" value={i.type} options={ISSUE_TYPES} editable={canEdit} onChange={(v) => save1(i.id, { type: v })} />,
    },
    {
      key: 'priority', header: 'Priority', width: 108, defaultHidden: true, sortValue: (i) => PRIORITIES.indexOf(i.priority),
      render: (i) => <PriorityCell value={i.priority} editable={canEdit} onChange={(v) => save1(i.id, { priority: v })} />,
    },
    ...(!verticalId ? [{
      key: 'vertical', header: 'Product line', width: 148, sortValue: (i: Issue) => i.vertical?.name,
      render: (i: Issue) => (
        <a href={`/consultant/verticals/${i.vertical.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--cw-ink-2)', display: 'block', minWidth: 0 }}>
          <span className="cw-truncate">{i.vertical.icon} {i.vertical.name}</span>
        </a>
      ),
    } as Column<Issue>] : []),
    {
      key: 'targetDate', header: 'Target', width: 104, sortValue: (i) => i.targetDate,
      render: (i) => <DateCell value={i.targetDate} status={i.status} editable={canEdit} onChange={(v) => save1(i.id, { targetDate: v })} />,
    },
    {
      key: 'reporter', header: 'Reporter', width: 150, defaultHidden: true, sortValue: (i) => i.reporter?.name,
      render: (i) => <span className="cw-truncate cw-meta">{i.reporter?.name ?? '—'}</span>,
    },
    {
      key: 'createdAt', header: 'Raised', width: 92, align: 'right', sortValue: (i) => i.createdAt,
      render: (i) => <span className="cw-meta">{fmtAgo(i.createdAt)}</span>,
    },
  ], [canEdit, canAssign, canResolve, people, verticalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeView = views.find((v) => v.id === viewId);
  const dirty = JSON.stringify(activeView?.filters ?? []) !== JSON.stringify(filters);

  const body = (
    <>
      {!embedded && stats && (
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '4px 0 16px' }}>
          <Stat label="Critical open" value={stats.bySeverity.CRITICAL ?? 0} tone={stats.bySeverity.CRITICAL ? 'red' : undefined} />
          <Stat label="Major open" value={stats.bySeverity.MAJOR ?? 0} tone="amber" />
          <Stat label="In progress" value={stats.byStatus.IN_PROGRESS ?? 0} />
          <Stat label="Resolved" value={(stats.byStatus.RESOLVED ?? 0) + (stats.byStatus.VERIFIED ?? 0)} tone="green" />
        </div>
      )}

      <div style={{ borderBottom: '1px solid var(--cw-line)' }}>
        <ViewTabs
          views={views}
          activeId={viewId}
          dirty={dirty}
          onSelect={(v) => { setViewId(v.id); setFilters(v.filters); }}
          onSave={(name) => { const v = save(name, filters); setViewId(v.id); }}
          onDelete={(id) => { remove(id); if (viewId === id) { setViewId('all'); setFilters([]); } }}
        />
      </div>

      <FilterBar
        defs={defs}
        filters={filters}
        onChange={setFilters}
        right={
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input className="cw-input" style={{ width: 200 }} placeholder="Search issues…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canEdit && (
              <button className="cw-btn cw-btn-primary" onClick={() => ws.create('ISSUE', { verticalId, projectId })}>
                <Plus size={13} /> Raise issue
              </button>
            )}
          </span>
        }
      />

      <Table
        id={`issues:${scope}`}
        rows={data?.data ?? []}
        columns={columns}
        rowKey={(i) => i.id}
        loading={isLoading}
        activeRowKey={ws.record?.kind === 'ISSUE' ? ws.record.id : null}
        onRowClick={(i) => ws.openRecord('ISSUE', i.id)}
        toolbarSlot={<span className="cw-meta">{data?.meta.total ?? 0} issue{data?.meta.total === 1 ? '' : 's'}</span>}
        empty={<Empty icon={Bug} title="No issues" body="Nothing is broken in this view — or nothing has been reported yet." />}
      />
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Issues' }]}
      title="Problems & issues"
      description="Everything that is wrong, and who owns fixing it."
    >
      {body}
    </Page>
  );
}
