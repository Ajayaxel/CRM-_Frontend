'use client';

/** Projects (spec §10, §11) — the table, and the project record page. */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import {
  useProject, useProjectReport, useProjects, useUpdateProject, useVerticals, type Project,
} from '../api';
import { Table, type Column } from '../ui/table';
import {
  FilterBar, ViewTabs, filtersToQuery, personOptions, useSavedViews,
  type ActiveFilter, type FilterDef, type SavedView,
} from '../ui/filters';
import {
  Avatar, Empty, Loading, Person, ProgressBar, Skeleton, Stat, Tabs, Tag, fmtAgo, fmtDate, humanize,
} from '../ui/primitives';
import {
  DateCell, PRIORITIES, PROJECT_STATUSES, PersonCell, PriorityCell, StatusCell,
  StatusChip, TextCell, projectTone,
} from '../ui/cells';
import { usePeople } from '../records/use-people';
import { ActivityRail, Comments } from '../records/collab';
import { useWorkspace } from '../ui/workspace-context';
import { Page, Section, SectionGrid } from './page';
import { TasksScreen } from './tasks';
import { TaskBoard } from './board';
import { IssuesScreen } from './issues';
import { FeaturesScreen } from './features';
import { MilestonesScreen } from './milestones';
import { DocumentsScreen } from './documents';
import { DeploymentsScreen } from './deployments';
import { useDeployments } from '../api';

const BUILT_IN: SavedView[] = [
  { id: 'active', name: 'Active', filters: [{ key: 'status', op: 'is', values: ['PLANNING', 'ACTIVE', 'TESTING', 'UAT'] }] },
  { id: 'blocked', name: 'Blocked', filters: [{ key: 'status', op: 'is', values: ['BLOCKED', 'ON_HOLD'] }] },
  { id: 'production', name: 'Production', filters: [{ key: 'status', op: 'is', values: ['PRODUCTION', 'COMPLETED'] }] },
  { id: 'all', name: 'All', filters: [] },
];

export function ProjectsScreen({ verticalId, embedded }: { verticalId?: string; embedded?: boolean }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const update = useUpdateProject();
  const people = usePeople(verticalId);
  const { data: verticals = [] } = useVerticals();

  const scope = verticalId ?? 'global';
  const { views, save, remove } = useSavedViews(`projects:${scope}`, BUILT_IN);
  const [viewId, setViewId] = useState('active');
  const [filters, setFilters] = useState<ActiveFilter[]>(BUILT_IN[0].filters);
  const [search, setSearch] = useState('');

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'status', label: 'Status', type: 'enum', options: PROJECT_STATUSES.map((s) => ({ value: s, label: humanize(s), tone: projectTone(s) })) },
    { key: 'priority', label: 'Priority', type: 'enum', options: PRIORITIES.map((p) => ({ value: p, label: humanize(p) })) },
    ...(!verticalId ? [{ key: 'verticalId', label: 'Product line', type: 'enum' as const, options: verticals.map((v: any) => ({ value: v.id, label: v.name })), toQuery: (f: ActiveFilter) => ({ verticalId: f.values[0] }) }] : []),
  ], [verticals, verticalId]);

  const { data, isLoading } = useProjects({
    verticalId, limit: 200,
    search: search.trim() || undefined,
    ...filtersToQuery(defs, filters),
  });

  const canCreate = hasPermission('pm.project.create');
  const canEdit = hasPermission('pm.project.update');
  const save1 = (id: string, patch: Record<string, unknown>) =>
    update.mutate({ id, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  const columns = useMemo<Column<Project>[]>(() => [
    {
      key: 'name', header: 'Project', width: 280, minWidth: 180, locked: true, sortValue: (p) => p.name,
      render: (p) => (
        <span style={{ minWidth: 0, display: 'block' }}>
          <span className="cw-truncate" style={{ fontWeight: 560 }}>{p.name}</span>
          {p.description && <span className="cw-truncate cw-meta" style={{ display: 'block' }}>{p.description}</span>}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 132, sortValue: (p) => p.status,
      render: (p) => <StatusCell kind="project" value={p.status} options={PROJECT_STATUSES} editable={canEdit} onChange={(v) => save1(p.id, { status: v })} />,
    },
    {
      key: 'projectManager', header: 'PM', width: 168, sortValue: (p) => p.projectManager?.name,
      render: (p) => <PersonCell person={p.projectManager} people={people} editable={canEdit} onChange={(v) => save1(p.id, { projectManagerId: v })} />,
    },
    {
      key: 'techLead', header: 'Tech lead', width: 168, sortValue: (p) => p.techLead?.name,
      render: (p) => <PersonCell person={p.techLead} people={people} editable={canEdit} onChange={(v) => save1(p.id, { techLeadId: v })} />,
    },
    {
      key: 'progress', header: 'Progress', width: 134, align: 'right', sortValue: (p) => p.progress,
      render: (p) => <ProgressBar value={p.progress} tone={projectTone(p.status)} />,
    },
    {
      key: 'tasks', header: 'Tasks', width: 92, align: 'right', sortValue: (p) => p._count?.tasks ?? 0,
      render: (p) => <span className="cw-num cw-meta">{p.tasksDone ?? 0}/{p._count?.tasks ?? 0}</span>,
    },
    {
      key: 'targetDate', header: 'Due', width: 106, sortValue: (p) => p.targetDate,
      render: (p) => <DateCell value={p.targetDate} status={p.status} editable={canEdit} onChange={(v) => save1(p.id, { targetDate: v })} />,
    },
    {
      key: 'priority', header: 'Priority', width: 106, defaultHidden: true, sortValue: (p) => PRIORITIES.indexOf(p.priority),
      render: (p) => <PriorityCell value={p.priority} editable={canEdit} onChange={(v) => save1(p.id, { priority: v })} />,
    },
    ...(!verticalId ? [{
      key: 'vertical', header: 'Product line', width: 150, sortValue: (p: Project) => p.vertical?.name,
      render: (p: Project) => (
        <a href={`/consultant/verticals/${p.vertical.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'var(--cw-ink-2)', display: 'block', minWidth: 0 }}>
          <span className="cw-truncate">{p.vertical.icon} {p.vertical.name}</span>
        </a>
      ),
    } as Column<Project>] : []),
    {
      key: 'tags', header: 'Tags', width: 150, defaultHidden: true, sortable: false,
      render: (p) => p.tags.length ? <span style={{ display: 'inline-flex', gap: 4 }}>{p.tags.slice(0, 2).map((t) => <Tag key={t}>{t}</Tag>)}</span> : <span className="cw-cell-empty">—</span>,
    },
  ], [canEdit, people, verticalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeView = views.find((v) => v.id === viewId);
  const dirty = JSON.stringify(activeView?.filters ?? []) !== JSON.stringify(filters);

  const body = (
    <>
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
            <input className="cw-input" style={{ width: 200 }} placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canCreate && (
              <button className="cw-btn cw-btn-primary" onClick={() => ws.create('PROJECT', { verticalId })}>
                <Plus size={13} /> New project
              </button>
            )}
          </span>
        }
      />

      <Table
        id={`projects:${scope}`}
        rows={data?.data ?? []}
        columns={columns}
        rowKey={(p) => p.id}
        loading={isLoading}
        onRowClick={(p) => router.push(`/consultant/projects/${p.id}`)}
        toolbarSlot={<span className="cw-meta">{data?.meta.total ?? 0} project{data?.meta.total === 1 ? '' : 's'}</span>}
        empty={
          <Empty
            icon={FolderKanban}
            title="No projects"
            body="A project groups the tasks, issues and milestones that ship together."
            action={canCreate ? <button className="cw-btn cw-btn-primary" onClick={() => ws.create('PROJECT', { verticalId })}>New project</button> : undefined}
          />
        }
      />
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Projects' }]}
      title="Projects"
      description="Every project across the portfolio."
    >
      {body}
    </Page>
  );
}

// ============================================================ Project record

const TABS = ['Overview', 'Tasks', 'Board', 'Issues', 'Features', 'Milestones', 'Documents', 'Deployments', 'Activity'] as const;

export function ProjectRecord({ projectId }: { projectId: string }) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const { data: project, isLoading } = useProject(projectId);
  const { data: report } = useProjectReport(projectId);
  const update = useUpdateProject();
  const people = usePeople(project?.vertical.id);
  const [tab, setTab] = useState<string>('Overview');

  const canEdit = hasPermission('pm.project.update');
  const save = (patch: Record<string, unknown>) =>
    update.mutate({ id: projectId, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  if (isLoading || !project) return <div className="cw-body"><Skeleton rows={6} /></div>;

  const counts = (project as any).counts ?? {};

  return (
    <Page
      crumbs={[
        { label: 'Consultant', href: '/consultant' },
        { label: project.vertical.name, href: `/consultant/verticals/${project.vertical.id}` },
        { label: project.name },
      ]}
      title={project.name}
      description={project.description}
      actions={
        <>
          <StatusCell kind="project" value={project.status} options={PROJECT_STATUSES} editable={canEdit} onChange={(v) => save({ status: v })} />
          <button className="cw-btn" onClick={() => ws.create('TASK', { verticalId: project.vertical.id, projectId })}>
            <Plus size={13} /> Task
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', padding: '12px 0 14px', borderBottom: '1px solid var(--cw-line)' }}>
        <Stat label="Progress" value={`${project.progress}%`} />
        <Stat label="Tasks done" value={`${counts.tasksDone ?? 0}/${counts.tasks ?? 0}`} tone="green" />
        <Stat label="Overdue" value={counts.overdueTasks ?? 0} tone={counts.overdueTasks ? 'red' : undefined} />
        <Stat label="Open issues" value={counts.openIssues ?? 0} tone={counts.openIssues ? 'amber' : undefined} />
        <Stat label="Milestones" value={project.milestones?.length ?? 0} />
        <div style={{ minWidth: 180, alignSelf: 'flex-end', paddingBottom: 4 }}>
          <ProgressBar value={project.progress} tone={projectTone(project.status)} />
        </div>
      </div>

      <div style={{ margin: '14px 0 0' }}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} counts={{ Tasks: counts.tasks, Milestones: project.milestones?.length }} />
      </div>

      <div style={{ paddingTop: 14 }}>
        {tab === 'Overview' && (
          <SectionGrid>
            <Section title="Accountability">
              <Row label="Owner"><PersonCell person={project.owner} people={people} editable={canEdit} onChange={(v) => save({ ownerId: v })} /></Row>
              <Row label="Project manager"><PersonCell person={project.projectManager} people={people} editable={canEdit} onChange={(v) => save({ projectManagerId: v })} /></Row>
              <Row label="Technical lead"><PersonCell person={project.techLead} people={people} editable={canEdit} onChange={(v) => save({ techLeadId: v })} /></Row>
              <Row label="Priority"><PriorityCell value={project.priority} editable={canEdit} onChange={(v) => save({ priority: v })} /></Row>
              <Row label="Start"><DateCell value={project.startDate} editable={canEdit} onChange={(v) => save({ startDate: v })} /></Row>
              <Row label="Target"><DateCell value={project.targetDate} status={project.status} editable={canEdit} onChange={(v) => save({ targetDate: v })} /></Row>
              {report && <Row label="Timeline"><StatusChip kind="milestone" value={report.timelineHealth} /></Row>}
            </Section>

            <Section title="Milestones" count={project.milestones?.length}>
              {!project.milestones?.length ? <div className="cw-meta">No milestones on this project.</div> : project.milestones.map((m: any) => (
                <button key={m.id} type="button" className="cw-row" onClick={() => ws.openRecord('MILESTONE', m.id)}>
                  <span className="cw-truncate" style={{ flex: 1, fontWeight: 520 }}>{m.name}</span>
                  <span style={{ width: 78 }}><ProgressBar value={m.progress ?? 0} /></span>
                  <span className="cw-meta cw-num">{fmtDate(m.targetDate)}</span>
                </button>
              ))}
            </Section>

            <Section title="Team" count={project.members?.length}>
              {!project.members?.length ? <div className="cw-meta">No members yet.</div> : project.members.map((m: any) => (
                <button key={m.id} type="button" className="cw-row" onClick={() => ws.openRecord('DEVELOPER', m.user.id)}>
                  <Person person={m.user} size={20} />
                  <span className="cw-meta" style={{ marginLeft: 'auto' }}>{humanize(m.role)}</span>
                </button>
              ))}
            </Section>

            <Section title="Workload">
              {!report?.workload?.length ? <div className="cw-meta">Nothing active.</div> : report.workload.map((w: any, i: number) => (
                <div key={w.user?.id ?? i} className="cw-row" style={{ cursor: 'default' }}>
                  <Avatar name={w.user?.name} size={19} />
                  <span className="cw-truncate" style={{ flex: 1 }}>{w.user?.name ?? 'Unassigned'}</span>
                  <span className="cw-num" style={{ fontWeight: 620 }}>{w.activeTasks}</span>
                </div>
              ))}
            </Section>

            <ProjectDeploymentSection projectId={projectId} onOpen={() => setTab('Deployments')} />

            <Section title="Discussion">
              <Comments entityType="PROJECT" entityId={projectId} />
            </Section>
          </SectionGrid>
        )}

        {tab === 'Tasks' && <TasksScreen projectId={projectId} verticalId={project.vertical.id} embedded />}
        {tab === 'Board' && <TaskBoard projectId={projectId} verticalId={project.vertical.id} />}
        {tab === 'Issues' && <IssuesScreen projectId={projectId} verticalId={project.vertical.id} embedded />}
        {tab === 'Features' && <FeaturesScreen projectId={projectId} verticalId={project.vertical.id} embedded />}
        {tab === 'Milestones' && <MilestonesScreen projectId={projectId} verticalId={project.vertical.id} embedded />}
        {tab === 'Documents' && <DocumentsScreen projectId={projectId} verticalId={project.vertical.id} embedded />}
        {tab === 'Deployments' && <DeploymentsScreen projectId={projectId} verticalId={project.vertical.id} embedded />}
        {tab === 'Activity' && <ActivityRail verticalId={project.vertical.id} limit={60} />}
      </div>
    </Page>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30 }}>
      <span className="cw-meta" style={{ width: 128, flex: 'none' }}>{label}</span>
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
    </div>
  );
}

/**
 * Latest releases for this project.
 *
 * CI/CD posts events against a vertical (and a project when the pipeline names
 * one), so a release has to be visible at the level the work lives at — not
 * only on the global Deployments screen.
 */
function ProjectDeploymentSection({ projectId, onOpen }: { projectId: string; onOpen: () => void }) {
  const { data, isLoading } = useDeployments({ projectId, limit: 5 });
  const rows = data?.data ?? [];

  return (
    <Section
      title="Deployments"
      count={data?.meta.total}
      action={rows.length > 0 ? <button type="button" className="cw-btn cw-btn-ghost" onClick={onOpen}>View all</button> : undefined}
    >
      {isLoading ? <Loading kind="list" rows={2} />
        : !rows.length ? <div className="cw-meta">No releases recorded for this project yet.</div>
          : rows.map((d) => (
            <div key={d.id} className="cw-row" style={{ cursor: 'default' }}>
              <Rocket size={13} style={{ color: 'var(--cw-ink-3)', flex: 'none' }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="cw-truncate" style={{ display: 'block', fontWeight: 520 }}>{d.version ?? 'Deployment'}</span>
                <span className="cw-meta">{humanize(d.environment)} · {d.source} · {fmtAgo(d.startedAt)}</span>
              </span>
              <StatusChip kind="deployment" value={d.status} />
            </div>
          ))}
    </Section>
  );
}
