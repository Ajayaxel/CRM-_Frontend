'use client';

/**
 * Tasks (spec §11, §12, §23, §24).
 *
 * A saved-view bar, a filter chip row and a dense inline-editable table — the
 * three things that make a work list usable at 400 rows. Every editable cell
 * writes straight through; nothing here opens a form to change a status.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGrid, ListChecks, Plus, Rows3, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import {
  useBulkTasks, useTasks, useUpdateTask, useVerticals, type Task,
} from '../api';
import { Table, type Column } from '../ui/table';
import {
  FilterBar, ViewTabs, filtersToQuery, personOptions, useSavedViews,
  type ActiveFilter, type FilterDef, type SavedView,
} from '../ui/filters';
import { Empty, Person, ProgressBar, Tag, fmtAgo, humanize } from '../ui/primitives';
import {
  DateCell, DueCell, PRIORITIES, PersonCell, PriorityCell, StatusCell, TASK_STATUSES,
  TextCell, taskTone,
} from '../ui/cells';
import { usePeople } from '../records/use-people';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';
import { TaskBoard } from './board';

const BUILT_IN: SavedView[] = [
  { id: 'all', name: 'All', filters: [] },
  { id: 'open', name: 'Open', filters: [{ key: 'status', op: 'is', values: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING'] }] },
  { id: 'overdue', name: 'Overdue', filters: [{ key: 'overdue', op: 'is', values: ['true'] }] },
  { id: 'review', name: 'In review', filters: [{ key: 'status', op: 'is', values: ['IN_REVIEW'] }] },
  { id: 'blocked', name: 'Blocked', filters: [{ key: 'status', op: 'is', values: ['BLOCKED'] }] },
  { id: 'critical', name: 'Critical', filters: [{ key: 'priority', op: 'is', values: ['CRITICAL', 'HIGH'] }] },
];

export function TasksScreen({
  verticalId, projectId, milestoneId, embedded, title = 'Tasks',
}: {
  verticalId?: string;
  projectId?: string;
  milestoneId?: string;
  embedded?: boolean;
  title?: string;
}) {
  const params = useSearchParams();
  const { hasPermission, user } = useAuth();
  const ws = useWorkspace();
  const update = useUpdateTask();
  const bulk = useBulkTasks();

  const scope = verticalId ?? projectId ?? 'global';
  const { views, save, remove } = useSavedViews(`tasks:${scope}`, BUILT_IN);
  const [viewId, setViewId] = useState('all');
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'table' | 'board'>('table');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const people = usePeople(verticalId);
  const { data: verticals = [] } = useVerticals();

  // A notification deep-link lands here with ?focus=<taskId>.
  useEffect(() => {
    const focus = params.get('focus');
    if (focus) ws.openRecord('TASK', focus);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'status', label: 'Status', type: 'enum', options: TASK_STATUSES.map((s) => ({ value: s, label: humanize(s), tone: taskTone(s) })) },
    { key: 'priority', label: 'Priority', type: 'enum', options: PRIORITIES.map((p) => ({ value: p, label: humanize(p) })) },
    { key: 'assigneeId', label: 'Assignee', type: 'person', options: personOptions(people), toQuery: (f) => ({ assigneeId: f.values[0] }) },
    { key: 'dueDate', label: 'Due date', type: 'date' },
    { key: 'overdue', label: 'Overdue', type: 'toggle', toQuery: () => ({ overdue: true }) },
    ...(!verticalId ? [{ key: 'verticalId', label: 'Product line', type: 'enum' as const, options: verticals.map((v: any) => ({ value: v.id, label: v.name })), toQuery: (f: ActiveFilter) => ({ verticalId: f.values[0] }) }] : []),
  ], [people, verticals, verticalId]);

  const query = useMemo(() => ({
    page, limit: 100, verticalId, projectId, milestoneId,
    search: search.trim() || undefined,
    ...filtersToQuery(defs, filters),
  }), [page, verticalId, projectId, milestoneId, search, defs, filters]);

  const { data, isLoading } = useTasks(query);
  useEffect(() => { setPage(1); setSelected([]); }, [filters, search, verticalId, projectId]);

  const canEdit = hasPermission('pm.task.update');
  const canAssign = hasPermission('pm.task.assign');
  const canCreate = hasPermission('pm.task.create');

  const save1 = (id: string, patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  const activeView = views.find((v) => v.id === viewId);
  const dirty = JSON.stringify(activeView?.filters ?? []) !== JSON.stringify(filters);

  const columns = useMemo<Column<Task>[]>(() => [
    {
      key: 'title',
      header: 'Task',
      width: 320,
      minWidth: 200,
      locked: true,
      sortValue: (t) => t.title,
      render: (t) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="cw-mono" style={{ flex: 'none' }}>{t.ref}</span>
          <span className="cw-truncate" style={{ fontWeight: 520 }}>{t.title}</span>
          {(t._count?.subtasks ?? 0) > 0 && <span className="cw-meta" style={{ flex: 'none' }}>{t._count!.subtasks}</span>}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 132, sortValue: (t) => t.status,
      render: (t) => <StatusCell kind="task" value={t.status} options={TASK_STATUSES} editable={canEdit} onChange={(v) => save1(t.id, { status: v })} />,
    },
    {
      key: 'assignee', header: 'Assignee', width: 172, sortValue: (t) => t.assignee?.name,
      render: (t) => <PersonCell person={t.assignee} people={people} editable={canAssign} onChange={(v) => save1(t.id, { assigneeId: v })} />,
    },
    {
      key: 'priority', header: 'Priority', width: 112, sortValue: (t) => PRIORITIES.indexOf(t.priority),
      render: (t) => <PriorityCell value={t.priority} editable={canEdit} onChange={(v) => save1(t.id, { priority: v })} />,
    },
    {
      key: 'dueDate', header: 'Due', width: 108, sortValue: (t) => t.dueDate,
      render: (t) => <DateCell value={t.dueDate} status={t.status} editable={canEdit} onChange={(v) => save1(t.id, { dueDate: v })} />,
    },
    {
      key: 'progress', header: 'Progress', width: 118, align: 'right', sortValue: (t) => t.progress,
      render: (t) => <ProgressBar value={t.progress} tone={taskTone(t.status)} />,
    },
    ...(!verticalId ? [{
      key: 'vertical', header: 'Product line', width: 150, sortValue: (t: Task) => t.vertical?.name,
      render: (t: Task) => (
        <a href={`/consultant/verticals/${t.vertical.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--cw-ink-2)', display: 'block', minWidth: 0 }}>
          <span className="cw-truncate">{t.vertical.icon} {t.vertical.name}</span>
        </a>
      ),
    } as Column<Task>] : []),
    ...(!projectId ? [{
      key: 'project', header: 'Project', width: 160, sortValue: (t: Task) => t.project?.name,
      render: (t: Task) => t.project
        ? <a href={`/consultant/projects/${t.project.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--cw-ink-2)', display: 'block', minWidth: 0 }}><span className="cw-truncate">{t.project.name}</span></a>
        : <span className="cw-cell-empty">—</span>,
    } as Column<Task>] : []),
    {
      key: 'milestone', header: 'Milestone', width: 150, defaultHidden: true, sortValue: (t) => t.milestone?.name,
      render: (t) => t.milestone ? <span className="cw-truncate" style={{ color: 'var(--cw-ink-2)' }}>{t.milestone.name}</span> : <span className="cw-cell-empty">—</span>,
    },
    {
      key: 'estimateHours', header: 'Est.', width: 78, align: 'right', defaultHidden: true, sortValue: (t) => t.estimateHours,
      render: (t) => <TextCell value={t.estimateHours ?? ''} type="number" editable={canEdit} onCommit={(v) => save1(t.id, { estimateHours: v === '' ? null : Number(v) })} />,
    },
    {
      key: 'tags', header: 'Tags', width: 150, defaultHidden: true, sortable: false,
      render: (t) => t.tags.length ? <span style={{ display: 'inline-flex', gap: 4 }}>{t.tags.slice(0, 2).map((x) => <Tag key={x}>{x}</Tag>)}</span> : <span className="cw-cell-empty">—</span>,
    },
    {
      key: 'updatedAt', header: 'Updated', width: 92, align: 'right', sortValue: (t) => t.updatedAt,
      render: (t) => <span className="cw-meta">{fmtAgo(t.updatedAt)}</span>,
    },
  ], [canEdit, canAssign, people, verticalId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.data ?? [];

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--cw-line)' }}>
        <ViewTabs
          views={views}
          activeId={viewId}
          dirty={dirty}
          onSelect={(v) => { setViewId(v.id); setFilters(v.filters); }}
          onSave={(name) => { const v = save(name, filters); setViewId(v.id); }}
          onDelete={(id) => { remove(id); if (viewId === id) { setViewId('all'); setFilters([]); } }}
        />
        <span style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'var(--cw-sunken)', borderRadius: 'var(--cw-r)' }}>
          <button type="button" className="cw-icon-btn" data-on={mode === 'table'} onClick={() => setMode('table')} aria-label="Table view"
            style={{ width: 26, height: 24, background: mode === 'table' ? 'var(--cw-bg)' : 'transparent', boxShadow: mode === 'table' ? 'var(--cw-float)' : undefined }}>
            <Rows3 size={13} />
          </button>
          <button type="button" className="cw-icon-btn" onClick={() => setMode('board')} aria-label="Board view"
            style={{ width: 26, height: 24, background: mode === 'board' ? 'var(--cw-bg)' : 'transparent', boxShadow: mode === 'board' ? 'var(--cw-float)' : undefined }}>
            <LayoutGrid size={13} />
          </button>
        </div>
      </div>

      <FilterBar
        defs={defs}
        filters={filters}
        onChange={setFilters}
        right={
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input className="cw-input" style={{ width: 210 }} placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canCreate && (
              <button className="cw-btn cw-btn-primary" onClick={() => ws.create('TASK', { verticalId, projectId, milestoneId })}>
                <Plus size={13} /> New task
              </button>
            )}
          </span>
        }
      />

      {selected.length > 0 && canEdit && (
        <BulkBar
          count={selected.length}
          people={people}
          canAssign={canAssign}
          onClear={() => setSelected([])}
          onApply={(patch) => bulk.mutate({ taskIds: selected, ...patch }, {
            onSuccess: (r: any) => { toast.success(`${r.updated} task(s) updated`); setSelected([]); },
            onError: (e) => toast.error(apiErrorMessage(e)),
          })}
        />
      )}

      {mode === 'board' ? (
        <div style={{ paddingTop: 12 }}>
          <TaskBoard verticalId={verticalId} projectId={projectId} />
        </div>
      ) : (
        <>
          <Table
            id={`tasks:${scope}`}
            rows={rows}
            columns={columns}
            rowKey={(t) => t.id}
            loading={isLoading}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            activeRowKey={ws.record?.kind === 'TASK' ? ws.record.id : null}
            onRowClick={(t) => ws.openRecord('TASK', t.id)}
            toolbarSlot={<span className="cw-meta">{data?.meta.total ?? 0} task{data?.meta.total === 1 ? '' : 's'}</span>}
            empty={
              <Empty
                icon={ListChecks}
                title="No tasks match"
                body="Adjust the filters, or create the first task for this scope."
                action={canCreate ? <button className="cw-btn cw-btn-primary" onClick={() => ws.create('TASK', { verticalId, projectId })}>New task</button> : undefined}
              />
            }
          />
          {(data?.meta.totalPages ?? 1) > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 0' }}>
              <button className="cw-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="cw-meta">Page {page} of {data!.meta.totalPages}</span>
              <button className="cw-btn" disabled={page >= data!.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </>
  );

  if (embedded) return body;

  return (
    <Page crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Tasks' }]} title={title}>
      {body}
    </Page>
  );
}

function BulkBar({
  count, people, canAssign, onApply, onClear,
}: {
  count: number;
  people: { id: string; name: string }[];
  canAssign: boolean;
  onApply: (patch: Record<string, unknown>) => void;
  onClear: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '8px 10px', marginBottom: 8, borderRadius: 'var(--cw-r)',
      background: 'var(--cw-selected)', border: '1px solid var(--cw-line)',
    }}>
      <span style={{ fontWeight: 620 }}>{count} selected</span>
      <select className="cw-input" style={{ width: 150 }} defaultValue=""
        onChange={(e) => { if (e.target.value) { onApply({ status: e.target.value }); e.target.value = ''; } }}>
        <option value="">Set status…</option>
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
      </select>
      <select className="cw-input" style={{ width: 150 }} defaultValue=""
        onChange={(e) => { if (e.target.value) { onApply({ priority: e.target.value }); e.target.value = ''; } }}>
        <option value="">Set priority…</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
      </select>
      {canAssign && (
        <select className="cw-input" style={{ width: 170 }} defaultValue=""
          onChange={(e) => { if (e.target.value) { onApply({ assigneeId: e.target.value }); e.target.value = ''; } }}>
          <option value="">Assign to…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <button className="cw-btn cw-btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClear}><X size={12} /> Clear</button>
    </div>
  );
}
