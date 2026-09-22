'use client';

/** Milestones (spec §18) — a dated table, opening into the milestone record. */

import React, { useMemo, useState } from 'react';
import { Flag, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { useMilestones, useUpdateMilestone, useVerticals, type Milestone } from '../api';
import { Table, type Column } from '../ui/table';
import { Empty, ProgressBar, humanize } from '../ui/primitives';
import { DateCell, MILESTONE_STATUSES, PersonCell, StatusCell, milestoneTone } from '../ui/cells';
import { FilterBar, type ActiveFilter, type FilterDef } from '../ui/filters';
import { usePeople } from '../records/use-people';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';

export function MilestonesScreen({
  verticalId, projectId, embedded,
}: { verticalId?: string; projectId?: string; embedded?: boolean }) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const update = useUpdateMilestone();
  const people = usePeople(verticalId);
  const { data: verticals = [] } = useVerticals();
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  const { data, isLoading } = useMilestones({ verticalId, projectId });
  const canManage = hasPermission('pm.milestone.manage');

  const save1 = (id: string, patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'status', label: 'Status', type: 'enum', options: MILESTONE_STATUSES.map((s) => ({ value: s, label: humanize(s), tone: milestoneTone(s) })) },
    { key: 'targetDate', label: 'Target date', type: 'date' },
  ], []);

  const rows = useMemo(() => {
    let list = data ?? [];
    for (const f of filters) {
      if (!f.values.length) continue;
      if (f.key === 'status') {
        list = list.filter((m) => (f.op === 'is_not' ? !f.values.includes(m.status) : f.values.includes(m.status)));
      }
      if (f.key === 'targetDate') {
        const target = new Date(f.values[0]).setHours(0, 0, 0, 0);
        list = list.filter((m) => {
          if (!m.targetDate) return false;
          const d = new Date(m.targetDate).setHours(0, 0, 0, 0);
          return f.op === 'before' ? d < target : f.op === 'after' ? d > target : d === target;
        });
      }
    }
    return list;
  }, [data, filters]);

  const columns = useMemo<Column<Milestone>[]>(() => [
    {
      key: 'name', header: 'Milestone', width: 280, minWidth: 180, locked: true, sortValue: (m) => m.name,
      render: (m) => (
        <span style={{ minWidth: 0, display: 'block' }}>
          <span className="cw-truncate" style={{ fontWeight: 560 }}>{m.name}</span>
          {m.description && <span className="cw-truncate cw-meta" style={{ display: 'block' }}>{m.description}</span>}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 130, sortValue: (m) => m.status,
      render: (m) => <StatusCell kind="milestone" value={m.status} options={MILESTONE_STATUSES} editable={canManage} onChange={(v) => save1(m.id, { status: v })} />,
    },
    {
      key: 'progress', header: 'Progress', width: 140, align: 'right', sortValue: (m) => m.progress,
      render: (m) => <ProgressBar value={m.progress} tone={milestoneTone(m.status)} />,
    },
    {
      key: 'tasks', header: 'Tasks', width: 106, align: 'right', sortValue: (m) => m.tasksTotal,
      render: (m) => <span className="cw-num cw-meta">{m.tasksDone}/{m.tasksTotal}</span>,
    },
    {
      key: 'targetDate', header: 'Target', width: 110, sortValue: (m) => m.targetDate,
      render: (m) => <DateCell value={m.targetDate} status={m.status} editable={canManage} onChange={(v) => save1(m.id, { targetDate: v })} />,
    },
    {
      key: 'owner', header: 'Owner', width: 168, sortValue: (m) => m.owner?.name,
      render: (m) => <PersonCell person={m.owner} people={people} editable={canManage} onChange={(v) => save1(m.id, { ownerId: v })} />,
    },
    ...(!projectId ? [{
      key: 'project', header: 'Project', width: 160, sortValue: (m: Milestone) => m.project?.name,
      render: (m: Milestone) => m.project
        ? <a href={`/consultant/projects/${m.project.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--cw-ink-2)', display: 'block', minWidth: 0 }}><span className="cw-truncate">{m.project.name}</span></a>
        : <span className="cw-cell-empty">Product-line-wide</span>,
    } as Column<Milestone>] : []),
    ...(!verticalId ? [{
      key: 'vertical', header: 'Product line', width: 150, sortValue: (m: Milestone) => m.vertical?.name,
      render: (m: Milestone) => (
        <a href={`/consultant/verticals/${m.vertical.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--cw-ink-2)', display: 'block', minWidth: 0 }}>
          <span className="cw-truncate">{m.vertical.icon} {m.vertical.name}</span>
        </a>
      ),
    } as Column<Milestone>] : []),
  ], [canManage, people, projectId, verticalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = (
    <>
      <FilterBar
        defs={defs}
        filters={filters}
        onChange={setFilters}
        right={canManage ? (
          <button className="cw-btn cw-btn-primary" onClick={() => ws.create('MILESTONE', { verticalId, projectId })}>
            <Plus size={13} /> New milestone
          </button>
        ) : undefined}
      />
      <Table
        id={`milestones:${verticalId ?? projectId ?? 'global'}`}
        rows={rows}
        columns={columns}
        rowKey={(m) => m.id}
        loading={isLoading}
        activeRowKey={ws.record?.kind === 'MILESTONE' ? ws.record.id : null}
        onRowClick={(m) => ws.openRecord('MILESTONE', m.id)}
        toolbarSlot={<span className="cw-meta">{rows.length} milestone{rows.length === 1 ? '' : 's'}</span>}
        empty={<Empty icon={Flag} title="No milestones" body="A milestone is the date a group of tasks has to be finished by. Without one, a project has no shape." />}
      />
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Milestones' }]}
      title="Milestones"
      description="What has to be finished, and by when."
    >
      {body}
    </Page>
  );
}
