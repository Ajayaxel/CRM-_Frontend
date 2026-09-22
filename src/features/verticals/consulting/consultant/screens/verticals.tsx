'use client';

/**
 * Verticals (spec §6, §7).
 *
 * The portfolio is a list, not a wall of cards: nineteen rows with status,
 * health, counts and progress is scannable in one pass, and every column is
 * editable in place for the people who own them.
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { usePortfolio, useUpdateVertical, type PortfolioCard } from '../api';
import { Table, type Column } from '../ui/table';
import {
  FilterBar, ViewTabs, personOptions, useSavedViews, type ActiveFilter, type FilterDef, type SavedView,
} from '../ui/filters';
import { Chip, Empty, ProgressBar, Skeleton, fmtAgo, humanize } from '../ui/primitives';
import {
  DateCell, HEALTHS, PersonCell, StatusCell, VERTICAL_STATUSES, healthTone, verticalTone,
} from '../ui/cells';
import { usePeople } from '../records/use-people';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';

const BUILT_IN: SavedView[] = [
  { id: 'all', name: 'All', filters: [] },
  { id: 'active', name: 'Active', filters: [{ key: 'status', op: 'is', values: ['ACTIVE', 'DEVELOPMENT', 'TESTING', 'UAT', 'PRODUCTION'] }] },
  { id: 'risk', name: 'At risk', filters: [{ key: 'health', op: 'is', values: ['AT_RISK', 'CRITICAL'] }] },
  { id: 'blocked', name: 'Blocked', filters: [{ key: 'status', op: 'is', values: ['BLOCKED', 'ON_HOLD'] }] },
  { id: 'production', name: 'Production', filters: [{ key: 'status', op: 'is', values: ['PRODUCTION', 'MAINTENANCE'] }] },
  { id: 'notstarted', name: 'Not started', filters: [{ key: 'status', op: 'is', values: ['NOT_STARTED', 'PLANNING'] }] },
];

export function VerticalsTable({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { data, isLoading } = usePortfolio();
  const update = useUpdateVertical();
  const people = usePeople();
  const ws = useWorkspace();

  const { views, save, remove } = useSavedViews('verticals', BUILT_IN);
  const [viewId, setViewId] = useState('all');
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [search, setSearch] = useState('');

  const canManage = hasPermission('pm.vertical.manage');
  const save1 = (id: string, patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'status', label: 'Status', type: 'enum', options: VERTICAL_STATUSES.map((s) => ({ value: s, label: humanize(s), tone: verticalTone(s) })) },
    { key: 'health', label: 'Health', type: 'enum', options: HEALTHS.map((h) => ({ value: h, label: humanize(h), tone: healthTone(h) })) },
    { key: 'ownerId', label: 'Owner', type: 'person', options: personOptions(people) },
  ], [people]);

  // The portfolio endpoint returns all 19 in one payload, so filtering is local.
  const rows = useMemo(() => {
    let list = data?.verticals ?? [];
    const term = search.trim().toLowerCase();
    if (term) list = list.filter((v) => v.name.toLowerCase().includes(term) || v.key.toLowerCase().includes(term) || (v.description ?? '').toLowerCase().includes(term));
    for (const f of filters) {
      if (!f.values.length) continue;
      const read = (v: PortfolioCard) => (f.key === 'ownerId' ? v.owner?.id : (v as any)[f.key]);
      list = list.filter((v) => (f.op === 'is_not' ? !f.values.includes(String(read(v))) : f.values.includes(String(read(v)))));
    }
    return list;
  }, [data?.verticals, filters, search]);

  const columns = useMemo<Column<PortfolioCard>[]>(() => [
    {
      key: 'name', header: 'Product line', width: 250, minWidth: 180, locked: true, sortValue: (v) => v.name,
      render: (v) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ fontSize: 14, flex: 'none', width: 16, textAlign: 'center' }}>{v.icon ?? '▪'}</span>
          <span style={{ minWidth: 0 }}>
            <span className="cw-truncate" style={{ fontWeight: 560 }}>{v.name}</span>
            {!compact && v.description && <span className="cw-truncate cw-meta" style={{ display: 'block' }}>{v.description}</span>}
          </span>
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 138, sortValue: (v) => v.status,
      render: (v) => <StatusCell kind="vertical" value={v.status} options={VERTICAL_STATUSES} editable={canManage} onChange={(x) => save1(v.id, { status: x })} />,
    },
    {
      key: 'health', header: 'Health', width: 118, sortValue: (v) => v.health,
      render: (v) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <StatusCell kind="health" value={v.health} options={HEALTHS} editable={canManage} onChange={(x) => save1(v.id, { health: x })} />
        </span>
      ),
    },
    {
      key: 'activeProjects', header: 'Projects', width: 84, align: 'right', sortValue: (v) => v.activeProjects,
      render: (v) => <span className="cw-num">{v.activeProjects}</span>,
    },
    {
      key: 'openTasks', header: 'Tasks', width: 78, align: 'right', sortValue: (v) => v.openTasks,
      render: (v) => <span className="cw-num">{v.openTasks}</span>,
    },
    {
      key: 'openIssues', header: 'Issues', width: 78, align: 'right', sortValue: (v) => v.openIssues,
      render: (v) => (
        <span className="cw-num" style={{ color: v.criticalIssues ? 'var(--cw-red)' : undefined, fontWeight: v.criticalIssues ? 650 : undefined }}>
          {v.openIssues}
        </span>
      ),
    },
    {
      key: 'overdueTasks', header: 'Overdue', width: 88, align: 'right', defaultHidden: true, sortValue: (v) => v.overdueTasks,
      render: (v) => <span className="cw-num" style={{ color: v.overdueTasks ? 'var(--cw-red)' : undefined }}>{v.overdueTasks || '—'}</span>,
    },
    {
      key: 'featuresInDev', header: 'Features', width: 88, align: 'right', defaultHidden: true, sortValue: (v) => v.featuresInDev,
      render: (v) => <span className="cw-num">{v.featuresInDev}</span>,
    },
    {
      key: 'progress', header: 'Progress', width: 132, align: 'right', sortValue: (v) => v.progress,
      render: (v) => <ProgressBar value={v.progress} tone={healthTone(v.health)} />,
    },
    {
      key: 'owner', header: 'Owner', width: 158, sortValue: (v) => v.owner?.name,
      render: (v) => <PersonCell person={v.owner} people={people} editable={canManage} onChange={(x) => save1(v.id, { ownerId: x })} />,
    },
    {
      key: 'projectManager', header: 'PM', width: 158, defaultHidden: true, sortValue: (v) => v.projectManager?.name,
      render: (v) => <PersonCell person={v.projectManager} people={people} editable={canManage} onChange={(x) => save1(v.id, { projectManagerId: x })} />,
    },
    {
      key: 'techLead', header: 'Tech lead', width: 158, defaultHidden: true, sortValue: (v) => v.techLead?.name,
      render: (v) => <PersonCell person={v.techLead} people={people} editable={canManage} onChange={(x) => save1(v.id, { techLeadId: x })} />,
    },
    {
      key: 'targetDate', header: 'Target', width: 104, defaultHidden: true, sortValue: (v) => v.targetDate,
      render: (v) => <DateCell value={v.targetDate} status={v.status} editable={canManage} onChange={(x) => save1(v.id, { targetDate: x })} />,
    },
    {
      key: 'risk', header: 'Signals', width: 190, sortable: false,
      render: (v) => v.riskSignals.length
        ? <span style={{ display: 'inline-flex', gap: 4, minWidth: 0 }}>{v.riskSignals.slice(0, 2).map((r) => <Chip key={r} tone="red" dot={false}>{r}</Chip>)}</span>
        : <span className="cw-cell-empty">—</span>,
    },
    {
      key: 'updatedAt', header: 'Updated', width: 92, align: 'right', sortValue: (v) => v.updatedAt,
      render: (v) => <span className="cw-meta">{fmtAgo(v.updatedAt)}</span>,
    },
  ], [canManage, people, compact]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeView = views.find((v) => v.id === viewId);
  const dirty = JSON.stringify(activeView?.filters ?? []) !== JSON.stringify(filters);

  if (isLoading) return <Skeleton rows={8} height={34} />;

  return (
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
      </div>

      <FilterBar
        defs={defs}
        filters={filters}
        onChange={setFilters}
        right={
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input className="cw-input" style={{ width: 200 }} placeholder="Search product lines…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canManage && <button className="cw-btn cw-btn-primary" onClick={() => ws.create('VERTICAL')}>New product line</button>}
          </span>
        }
      />

      <Table
        id="verticals"
        rows={rows}
        columns={columns}
        rowKey={(v) => v.id}
        onRowClick={(v) => router.push(`/consultant/verticals/${v.id}`)}
        toolbarSlot={<span className="cw-meta">{rows.length} of {data?.verticals.length ?? 0} product lines</span>}
        empty={<Empty icon={LayoutGrid} title="Nothing in this view" body="Switch the view or clear the filters to see the rest of the portfolio." />}
      />
    </>
  );
}

export function VerticalsScreen() {
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Product Lines' }]}
      title="Product Lines"
      description="Every product line the consultant team builds — this is the delivery roadmap, not tenant data."
    >
      <VerticalsTable />
    </Page>
  );
}
