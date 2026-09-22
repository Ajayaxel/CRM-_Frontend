'use client';

/**
 * Features & requirements (spec §17).
 *
 * Table by default, pipeline when you want to see where the backlog is stuck —
 * a feature's whole value is its position between "somebody asked" and "it
 * shipped", which a date-sorted list hides.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGrid, Lightbulb, Plus, Rows3 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { useFeatures, useUpdateFeature, useVerticals, type Feature } from '../api';
import { Table, type Column } from '../ui/table';
import {
  FilterBar, ViewTabs, filtersToQuery, personOptions, useSavedViews,
  type ActiveFilter, type FilterDef, type SavedView,
} from '../ui/filters';
import { AvatarStack, Empty, Skeleton, TONE_VAR, fmtAgo, humanize } from '../ui/primitives';
import {
  FEATURE_STATUSES, PRIORITIES, PersonCell, PriorityCell, StatusCell, TextCell,
  featureTone,
} from '../ui/cells';
import { usePeople } from '../records/use-people';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';

const LIFECYCLE = ['IDEA', 'PLANNED', 'APPROVED', 'IN_DEVELOPMENT', 'TESTING', 'READY_FOR_RELEASE', 'RELEASED'] as const;

const BUILT_IN: SavedView[] = [
  { id: 'active', name: 'Active', filters: [{ key: 'status', op: 'is', values: ['APPROVED', 'IN_DEVELOPMENT', 'TESTING', 'READY_FOR_RELEASE'] }] },
  { id: 'intake', name: 'Intake', filters: [{ key: 'status', op: 'is', values: ['IDEA', 'PLANNED'] }] },
  { id: 'released', name: 'Released', filters: [{ key: 'status', op: 'is', values: ['RELEASED'] }] },
  { id: 'all', name: 'All', filters: [] },
];

export function FeaturesScreen({
  verticalId, projectId, embedded,
}: { verticalId?: string; projectId?: string; embedded?: boolean }) {
  const params = useSearchParams();
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const update = useUpdateFeature();
  const people = usePeople(verticalId);
  const { data: verticals = [] } = useVerticals();

  const scope = verticalId ?? projectId ?? 'global';
  const { views, save, remove } = useSavedViews(`features:${scope}`, BUILT_IN);
  const [viewId, setViewId] = useState('active');
  const [filters, setFilters] = useState<ActiveFilter[]>(BUILT_IN[0].filters);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'table' | 'pipeline'>('table');

  useEffect(() => {
    const focus = params.get('focus');
    if (focus) ws.openRecord('FEATURE', focus);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'status', label: 'Status', type: 'enum', options: FEATURE_STATUSES.map((s) => ({ value: s, label: humanize(s), tone: featureTone(s) })) },
    { key: 'priority', label: 'Priority', type: 'enum', options: PRIORITIES.map((p) => ({ value: p, label: humanize(p) })) },
    { key: 'assigneeId', label: 'Developer', type: 'person', options: personOptions(people), toQuery: (f) => ({ assigneeId: f.values[0] }) },
    ...(!verticalId ? [{ key: 'verticalId', label: 'Product line', type: 'enum' as const, options: verticals.map((v: any) => ({ value: v.id, label: v.name })), toQuery: (f: ActiveFilter) => ({ verticalId: f.values[0] }) }] : []),
  ], [people, verticals, verticalId]);

  const { data, isLoading } = useFeatures({
    verticalId, projectId, limit: 200,
    search: search.trim() || undefined,
    ...filtersToQuery(defs, filters),
  });

  const canEdit = hasPermission('pm.feature.create');
  const save1 = (id: string, patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  const columns = useMemo<Column<Feature>[]>(() => [
    {
      key: 'name', header: 'Feature', width: 320, minWidth: 200, locked: true, sortValue: (f) => f.name,
      render: (f) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="cw-mono" style={{ flex: 'none' }}>{f.ref}</span>
          <span className="cw-truncate" style={{ fontWeight: 520 }}>{f.name}</span>
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 158, sortValue: (f) => LIFECYCLE.indexOf(f.status as any),
      render: (f) => <StatusCell kind="feature" value={f.status} options={FEATURE_STATUSES} editable={canEdit} onChange={(v) => save1(f.id, { status: v })} />,
    },
    {
      key: 'owner', header: 'Owner', width: 168, sortValue: (f) => f.owner?.name,
      render: (f) => <PersonCell person={f.owner} people={people} editable={canEdit} onChange={(v) => save1(f.id, { ownerId: v })} />,
    },
    {
      key: 'assignees', header: 'Developers', width: 116, sortable: false,
      render: (f) => <AvatarStack people={f.assignees} max={3} />,
    },
    {
      key: 'priority', header: 'Priority', width: 108, sortValue: (f) => PRIORITIES.indexOf(f.priority),
      render: (f) => <PriorityCell value={f.priority} editable={canEdit} onChange={(v) => save1(f.id, { priority: v })} />,
    },
    {
      key: 'targetRelease', header: 'Release', width: 104, sortValue: (f) => f.targetRelease,
      render: (f) => <TextCell value={f.targetRelease ?? ''} editable={canEdit} placeholder="—" onCommit={(v) => save1(f.id, { targetRelease: v || null })} />,
    },
    ...(!verticalId ? [{
      key: 'vertical', header: 'Product line', width: 148, sortValue: (f: Feature) => f.vertical?.name,
      render: (f: Feature) => (
        <a href={`/consultant/verticals/${f.vertical.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--cw-ink-2)', display: 'block', minWidth: 0 }}>
          <span className="cw-truncate">{f.vertical.icon} {f.vertical.name}</span>
        </a>
      ),
    } as Column<Feature>] : []),
    {
      key: 'requestedBy', header: 'Requested by', width: 150, defaultHidden: true, sortValue: (f) => f.requestedBy?.name,
      render: (f) => <span className="cw-truncate cw-meta">{f.requestedBy?.name ?? '—'}</span>,
    },
    {
      key: 'createdAt', header: 'Created', width: 92, align: 'right', sortValue: (f) => f.createdAt,
      render: (f) => <span className="cw-meta">{fmtAgo(f.createdAt)}</span>,
    },
  ], [canEdit, people, verticalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeView = views.find((v) => v.id === viewId);
  const dirty = JSON.stringify(activeView?.filters ?? []) !== JSON.stringify(filters);
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
          <button type="button" className="cw-icon-btn" onClick={() => setMode('table')} aria-label="Table view"
            style={{ width: 26, height: 24, background: mode === 'table' ? 'var(--cw-bg)' : 'transparent' }}><Rows3 size={13} /></button>
          <button type="button" className="cw-icon-btn" onClick={() => setMode('pipeline')} aria-label="Pipeline view"
            style={{ width: 26, height: 24, background: mode === 'pipeline' ? 'var(--cw-bg)' : 'transparent' }}><LayoutGrid size={13} /></button>
        </div>
      </div>

      <FilterBar
        defs={defs}
        filters={filters}
        onChange={setFilters}
        right={
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input className="cw-input" style={{ width: 200 }} placeholder="Search features…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canEdit && (
              <button className="cw-btn cw-btn-primary" onClick={() => ws.create('FEATURE', { verticalId, projectId })}>
                <Plus size={13} /> New feature
              </button>
            )}
          </span>
        }
      />

      {mode === 'pipeline' ? (
        isLoading ? <Skeleton rows={4} /> : (
          <div className="cw-board" style={{ paddingTop: 10 }}>
            {LIFECYCLE.map((stage) => {
              const items = rows.filter((f) => f.status === stage);
              return (
                <div key={stage} className="cw-col" style={{ flex: '0 0 236px', width: 236 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 4px 9px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE_VAR[featureTone(stage)], flex: 'none' }} />
                    <span style={{ fontSize: 12, fontWeight: 650 }}>{humanize(stage)}</span>
                    <span className="cw-tab-count">{items.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {items.map((f) => (
                      <button key={f.id} type="button" className="cw-card" style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => ws.openRecord('FEATURE', f.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <span className="cw-mono">{f.ref}</span>
                          {f.targetRelease && <span className="cw-meta" style={{ marginLeft: 'auto' }}>{f.targetRelease}</span>}
                        </div>
                        <div style={{ fontWeight: 520, lineHeight: 1.4, marginBottom: 7 }}>{f.name}</div>
                        <AvatarStack people={f.assignees} max={3} size={18} />
                      </button>
                    ))}
                    {items.length === 0 && <div className="cw-meta" style={{ padding: '6px 4px' }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <Table
          id={`features:${scope}`}
          rows={rows}
          columns={columns}
          rowKey={(f) => f.id}
          loading={isLoading}
          activeRowKey={ws.record?.kind === 'FEATURE' ? ws.record.id : null}
          onRowClick={(f) => ws.openRecord('FEATURE', f.id)}
          toolbarSlot={<span className="cw-meta">{data?.meta.total ?? 0} feature{data?.meta.total === 1 ? '' : 's'}</span>}
          empty={<Empty icon={Lightbulb} title="No features" body="Capture enhancements, change requests and client asks here so they stop living in chat." />}
        />
      )}
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Features' }]}
      title="Features & requirements"
      description="From request to release."
    >
      {body}
    </Page>
  );
}
