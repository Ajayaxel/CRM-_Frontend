'use client';

/**
 * Vertical record page (spec §8, §9).
 *
 * Header states who owns it and where it is; the Overview answers "what is
 * happening right now" in compact rows; every other tab is the same module
 * scoped to this vertical — which is what stops the portfolio view and the
 * vertical view drifting apart.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { useUpdateVertical, useVertical, useVerticalOverview } from '../api';
import {
  Avatar, Empty, ProgressBar, Skeleton, Stat, Tabs, fmtAgo, fmtDate, humanize,
} from '../ui/primitives';
import {
  DateCell, HEALTHS, PersonCell, StatusCell, StatusChip, VERTICAL_STATUSES, healthTone,
} from '../ui/cells';
import { ActivityRail, AuditTable } from '../records/collab';
import { usePeople } from '../records/use-people';
import { useWorkspace } from '../ui/workspace-context';
import { Page, Section, SectionGrid } from './page';
import { ProjectsScreen } from './projects';
import { TasksScreen } from './tasks';
import { TaskBoard } from './board';
import { IssuesScreen } from './issues';
import { FeaturesScreen } from './features';
import { MilestonesScreen } from './milestones';
import { TimelineScreen } from './timeline';
import { TeamScreen } from './team';
import { DocumentsScreen } from './documents';
import { DeploymentsScreen } from './deployments';
import { ReportsScreen } from './reports';

const TABS = [
  'Overview', 'Projects', 'Tasks', 'Board', 'Issues', 'Features', 'Milestones',
  'Timeline', 'Team', 'Documents', 'Deployments', 'Activity', 'Reports',
] as const;

export function VerticalRecord({ verticalId }: { verticalId: string }) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const { data: v, isLoading } = useVertical(verticalId);
  const update = useUpdateVertical();
  const people = usePeople(verticalId);
  const [tab, setTab] = useState<string>('Overview');

  const canManage = hasPermission('pm.vertical.manage');
  const save = (patch: Record<string, unknown>) =>
    update.mutate({ id: verticalId, ...patch }, { onError: (e) => toast.error(apiErrorMessage(e)) });

  if (isLoading || !v) return <div className="cw-body"><Skeleton rows={6} /></div>;

  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Product Lines', href: '/consultant/verticals' }, { label: v.name }]}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span>{v.icon}</span>{v.name}</span>}
      description={v.description}
      actions={
        <>
          <StatusCell kind="vertical" value={v.status} options={VERTICAL_STATUSES} editable={canManage} onChange={(x) => save({ status: x })} />
          <StatusCell kind="health" value={v.health} options={HEALTHS} editable={canManage} onChange={(x) => save({ health: x })} />
          <button className="cw-btn" onClick={() => ws.create('PROJECT', { verticalId })}><Plus size={13} /> Project</button>
        </>
      }
    >
      {/* Ownership + progress strip — text, not tiles */}
      <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'flex-start', padding: '12px 0 14px', borderBottom: '1px solid var(--cw-line)' }}>
        <div style={{ minWidth: 190 }}>
          <div className="cw-meta" style={{ marginBottom: 5 }}>
            Progress · {v.progressIsDerived ? `${v.counts.tasksDone} of ${v.counts.tasks} tasks` : 'set manually'}
          </div>
          <ProgressBar value={v.progress} tone={healthTone(v.health)} />
        </div>
        <Owner label="Owner" person={v.owner} people={people} editable={canManage} onChange={(x) => save({ ownerId: x })} />
        <Owner label="Project manager" person={v.projectManager} people={people} editable={canManage} onChange={(x) => save({ projectManagerId: x })} />
        <Owner label="Technical lead" person={v.techLead} people={people} editable={canManage} onChange={(x) => save({ techLeadId: x })} />
        <div style={{ minWidth: 130 }}>
          <div className="cw-meta" style={{ marginBottom: 3 }}>Target date</div>
          <DateCell value={v.targetDate} status={v.status} editable={canManage} onChange={(x) => save({ targetDate: x })} />
        </div>
        <div style={{ minWidth: 150 }}>
          <div className="cw-meta" style={{ marginBottom: 3 }}>Current milestone</div>
          {v.currentMilestone ? (
            <button type="button" className="cw-cell-edit" onClick={() => ws.openRecord('MILESTONE', v.currentMilestone!.id)}>
              <span className="cw-truncate">{v.currentMilestone.name}</span>
              <span className="cw-meta">{fmtDate(v.currentMilestone.targetDate)}</span>
            </button>
          ) : <span className="cw-cell-empty">None set</span>}
        </div>
        <div style={{ minWidth: 110 }}>
          <div className="cw-meta" style={{ marginBottom: 3 }}>Team</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {v.members.slice(0, 4).map((m, i) => (
              <span key={m.id} style={{ marginLeft: i ? -7 : 0 }}><Avatar name={m.user?.name} size={20} /></span>
            ))}
            <span className="cw-meta">{v.members.length}</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '12px 0 14px' }}>
        <Stat label="Projects" value={v.counts.projects} />
        <Stat label="Open tasks" value={v.counts.tasks - v.counts.tasksDone} />
        <Stat label="Overdue" value={v.counts.overdueTasks} tone={v.counts.overdueTasks ? 'red' : undefined} />
        <Stat label="Blocked" value={v.counts.blockedTasks} tone={v.counts.blockedTasks ? 'amber' : undefined} />
        <Stat label="Open issues" value={v.counts.openIssues} tone={v.counts.openIssues ? 'red' : 'green'} />
        <Stat label="Features in dev" value={v.counts.featuresInDev} />
        <Stat label="Completed" value={v.counts.tasksDone} tone="green" />
        <Stat label="Last activity" value={v.lastActivityAt ? fmtAgo(v.lastActivityAt) : '—'} />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} counts={{ Projects: v.counts.projects, Issues: v.counts.openIssues }} />

      <div style={{ paddingTop: 14 }}>
        {tab === 'Overview' && <Overview verticalId={verticalId} />}
        {tab === 'Projects' && <ProjectsScreen verticalId={verticalId} embedded />}
        {tab === 'Tasks' && <TasksScreen verticalId={verticalId} embedded />}
        {tab === 'Board' && <TaskBoard verticalId={verticalId} />}
        {tab === 'Issues' && <IssuesScreen verticalId={verticalId} embedded />}
        {tab === 'Features' && <FeaturesScreen verticalId={verticalId} embedded />}
        {tab === 'Milestones' && <MilestonesScreen verticalId={verticalId} embedded />}
        {tab === 'Timeline' && <TimelineScreen verticalId={verticalId} embedded />}
        {tab === 'Team' && <TeamScreen verticalId={verticalId} embedded />}
        {tab === 'Documents' && <DocumentsScreen verticalId={verticalId} embedded />}
        {tab === 'Deployments' && <DeploymentsScreen verticalId={verticalId} embedded />}
        {tab === 'Reports' && <ReportsScreen verticalId={verticalId} embedded />}
        {tab === 'Activity' && (
          <div style={{ display: 'grid', gap: 26 }}>
            <div style={{ maxWidth: 740 }}><ActivityRail verticalId={verticalId} limit={60} /></div>
            <div>
              <h3 className="cw-h2" style={{ marginBottom: 10 }}>Audit trail</h3>
              <AuditTable verticalId={verticalId} />
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

function Owner({
  label, person, people, editable, onChange,
}: { label: string; person: any; people: any[]; editable: boolean; onChange: (v: string | null) => void }) {
  return (
    <div style={{ minWidth: 156 }}>
      <div className="cw-meta" style={{ marginBottom: 3 }}>{label}</div>
      <PersonCell person={person} people={people} editable={editable} onChange={onChange} />
    </div>
  );
}

function Overview({ verticalId }: { verticalId: string }) {
  const ws = useWorkspace();
  const { data, isLoading } = useVerticalOverview(verticalId);

  if (isLoading || !data) return <Skeleton rows={5} />;

  const nothing =
    !data.activeProjects.length && !data.priorityTasks.length && !data.criticalIssues.length &&
    !data.featuresInDev.length && !data.upcomingMilestones.length;

  if (nothing) {
    return (
      <Empty
        title="This product line has no work yet"
        body="Create a project, then break it into tasks and assign them. Issues, features and milestones hang off the same product line."
        action={<button className="cw-btn cw-btn-primary" onClick={() => ws.create('PROJECT', { verticalId })}>New project</button>}
      />
    );
  }

  return (
    <>
      {(data.overdueTasks.length > 0 || data.criticalIssues.length > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', marginBottom: 4,
          borderRadius: 'var(--cw-r)', background: 'var(--cw-red-bg)', color: 'var(--cw-red)', fontWeight: 600,
        }}>
          <AlertTriangle size={14} style={{ flex: 'none' }} />
          {[
            data.criticalIssues.length ? `${data.criticalIssues.length} critical or major issue${data.criticalIssues.length === 1 ? '' : 's'}` : null,
            data.overdueTasks.length ? `${data.overdueTasks.length} overdue task${data.overdueTasks.length === 1 ? '' : 's'}` : null,
          ].filter(Boolean).join(' · ')}
        </div>
      )}

      <SectionGrid>
        <Section title="Current work" count={data.activeProjects.length}>
          {!data.activeProjects.length ? <div className="cw-meta">No active projects.</div> : data.activeProjects.map((p) => (
            <Link key={p.id} href={`/consultant/projects/${p.id}`} className="cw-row">
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="cw-truncate" style={{ display: 'block', fontWeight: 540 }}>{p.name}</span>
                <span className="cw-meta">{p._count?.tasks ?? 0} task(s) · {p.projectManager?.name ?? 'No PM'}</span>
              </span>
              <span style={{ width: 84, flex: 'none' }}><ProgressBar value={p.progress ?? 0} /></span>
              <StatusChip kind="project" value={p.status} />
            </Link>
          ))}
        </Section>

        <Section title="High-priority tasks" count={data.priorityTasks.length}>
          {!data.priorityTasks.length ? <div className="cw-meta">Nothing marked critical or high.</div> : data.priorityTasks.map((t) => (
            <button key={t.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', t.id)}>
              <span className="cw-mono">{t.ref}</span>
              <span className="cw-truncate" style={{ flex: 1 }}>{t.title}</span>
              <StatusChip kind="task" value={t.status} />
              <Avatar name={t.assignee?.name} size={19} />
            </button>
          ))}
        </Section>

        <Section title="Issues" count={data.criticalIssues.length}>
          {!data.criticalIssues.length ? <div className="cw-meta">No critical or major issues open.</div> : data.criticalIssues.map((i) => (
            <button key={i.id} type="button" className="cw-row" onClick={() => ws.openRecord('ISSUE', i.id)}>
              <StatusChip kind="severity" value={i.severity} />
              <span className="cw-truncate" style={{ flex: 1 }}>{i.title}</span>
              <StatusChip kind="issue" value={i.status} />
              <Avatar name={i.assignee?.name} size={19} />
            </button>
          ))}
        </Section>

        <Section title="Upcoming" count={data.upcomingMilestones.length}>
          {!data.upcomingMilestones.length ? <div className="cw-meta">Nothing due in the next two weeks.</div> : data.upcomingMilestones.map((m) => (
            <button key={m.id} type="button" className="cw-row" onClick={() => ws.openRecord('MILESTONE', m.id)}>
              <span className="cw-truncate" style={{ flex: 1, fontWeight: 520 }}>{m.name}</span>
              <span className="cw-meta cw-num">{fmtDate(m.targetDate)}</span>
              <StatusChip kind="milestone" value={m.status} />
            </button>
          ))}
        </Section>

        <Section title="Features in development" count={data.featuresInDev.length}>
          {!data.featuresInDev.length ? <div className="cw-meta">Nothing in development.</div> : data.featuresInDev.map((f) => (
            <button key={f.id} type="button" className="cw-row" onClick={() => ws.openRecord('FEATURE', f.id)}>
              <span className="cw-mono">{f.ref}</span>
              <span className="cw-truncate" style={{ flex: 1 }}>{f.name}</span>
              <StatusChip kind="feature" value={f.status} />
            </button>
          ))}
        </Section>

        <Section title="Team workload" count={data.workload.length}>
          {!data.workload.length ? <div className="cw-meta">Nobody assigned to this product line yet.</div> : data.workload.slice(0, 8).map((w) => (
            <button key={w.user.id} type="button" className="cw-row" onClick={() => ws.openRecord('DEVELOPER', w.user.id)}>
              <Avatar name={w.user.name} size={20} />
              <span className="cw-truncate" style={{ flex: 1 }}>{w.user.name}</span>
              <span className="cw-meta">{w.activeTasks} active</span>
              {w.overdueTasks > 0 && <span style={{ color: 'var(--cw-red)', fontWeight: 620, fontSize: 11.5 }}>{w.overdueTasks} late</span>}
            </button>
          ))}
        </Section>

        <Section title="Deployments">
          {!data.lastDeployment ? <div className="cw-meta">Nothing deployed yet.</div> : (
            <Link href="/consultant/deployments" className="cw-row">
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="cw-truncate" style={{ display: 'block', fontWeight: 540 }}>{data.lastDeployment.version ?? 'Deployment'}</span>
                <span className="cw-meta">
                  {humanize(data.lastDeployment.environment)} · {data.lastDeployment.source} · {fmtAgo(data.lastDeployment.startedAt)}
                </span>
              </span>
              <StatusChip kind="deployment" value={data.lastDeployment.status} />
            </Link>
          )}
        </Section>

        <Section title="Recent activity">
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <ActivityRail verticalId={verticalId} limit={12} />
          </div>
        </Section>
      </SectionGrid>
    </>
  );
}
