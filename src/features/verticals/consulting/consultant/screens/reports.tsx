'use client';

/**
 * Reports (spec §26 workload, plus vertical and project health).
 *
 * Three reports sharing one shape — totals, a distribution, throughput over
 * time — so the second one reads without re-learning the layout. Charts are
 * plain bars: this is a management read-out, not an analytics product.
 */

import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  useDeveloperReport, useProjectReport, useProjects, useTeam, useVerticalReport, useVerticals,
} from '../api';
import { Avatar, Empty, OptionList, Popover, ProgressBar, Skeleton, Stat, TONE_VAR, Tabs, humanize } from '../ui/primitives';
import { useWorkspace } from '../ui/workspace-context';
import { Page, Section, SectionGrid } from './page';

const MODES = ['Vertical', 'Developer', 'Project'] as const;

export function ReportsScreen({ verticalId: fixed, embedded }: { verticalId?: string; embedded?: boolean }) {
  const [mode, setMode] = useState<string>('Vertical');
  const { data: verticals = [] } = useVerticals();
  const { data: team = [] } = useTeam(fixed);
  const { data: projects } = useProjects({ verticalId: fixed, limit: 200 });

  const [verticalId, setVerticalId] = useState<string | null>(fixed ?? null);
  const [userId, setUserId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const picker = (
    mode === 'Vertical' && !fixed ? (
      <Choose
        label={verticals.find((v: any) => v.id === verticalId)?.name ?? 'Choose a product line'}
        options={verticals.map((v: any) => ({ value: v.id, label: `${v.icon ?? ''} ${v.name}`.trim() }))}
        value={verticalId}
        onChange={setVerticalId}
      />
    ) : mode === 'Developer' ? (
      <Choose
        label={team.find((t) => t.user.id === userId)?.user.name ?? 'Me'}
        options={team.map((t) => ({ value: t.user.id, label: t.user.name, icon: <Avatar name={t.user.name} size={18} /> }))}
        value={userId}
        onChange={setUserId}
      />
    ) : mode === 'Project' ? (
      <Choose
        label={projects?.data.find((p) => p.id === projectId)?.name ?? 'Choose a project'}
        options={(projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
        value={projectId}
        onChange={setProjectId}
      />
    ) : null
  );

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--cw-line)' }}>
        <Tabs tabs={MODES} active={mode} onChange={setMode} />
        <span style={{ flex: 1 }} />
        <span style={{ paddingBottom: 4 }}>{picker}</span>
      </div>

      <div style={{ paddingTop: 4 }}>
        {mode === 'Vertical' && <VerticalReport verticalId={verticalId ?? fixed ?? null} />}
        {mode === 'Developer' && <DeveloperReport userId={userId ?? undefined} />}
        {mode === 'Project' && <ProjectReport projectId={projectId} />}
      </div>
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Reports' }]}
      title="Reports"
      description="Delivery health by product line, developer and project."
    >
      {body}
    </Page>
  );
}

function Choose({
  label, options, value, onChange,
}: { label: string; options: { value: string; label: string; icon?: React.ReactNode }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Popover
      align="end"
      width={264}
      trigger={({ ref, onClick }) => (
        <button type="button" ref={ref as any} className="cw-btn" onClick={onClick}>{label}</button>
      )}
    >
      {({ close }) => (
        <OptionList
          searchable={options.length > 8}
          value={value ?? undefined}
          options={options}
          onPick={(v) => { onChange(v); close(); }}
        />
      )}
    </Popover>
  );
}

/** Horizontal distribution bars — proportional, labelled, no axis furniture. */
function Distribution({ data, tone = 'blue' }: { data: Record<string, number>; tone?: keyof typeof TONE_VAR }) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return <div className="cw-meta">Nothing recorded.</div>;
  const max = Math.max(...entries.map(([, v]) => Number(v)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="cw-meta cw-truncate" style={{ width: 128, flex: 'none' }}>{humanize(k)}</span>
          <span className="cw-bar" style={{ flex: 1, height: 6 }}>
            <span style={{ width: `${(Number(v) / max) * 100}%`, background: TONE_VAR[tone] }} />
          </span>
          <span className="cw-num" style={{ width: 30, textAlign: 'right', fontWeight: 620 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/** Weekly throughput as a sparkline-height column strip. */
function Throughput({ data }: { data: { week: string; count: number }[] }) {
  if (!data?.length) return <div className="cw-meta">No completions recorded.</div>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 84 }}>
        {data.map((d) => (
          <div key={d.week} title={`${d.week}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{
              height: `${Math.max(d.count ? 6 : 2, (d.count / max) * 100)}%`,
              background: d.count ? TONE_VAR.green : 'var(--cw-line)',
              borderRadius: '3px 3px 1px 1px',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
        {data.map((d, i) => (
          <span key={d.week} className="cw-meta" style={{ flex: 1, textAlign: 'center', fontSize: 9.5 }}>
            {i % 2 === 0 ? d.week.slice(-3) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function VerticalReport({ verticalId }: { verticalId: string | null }) {
  const { data, isLoading } = useVerticalReport(verticalId ?? undefined);
  const ws = useWorkspace();
  if (!verticalId) return <Empty icon={BarChart3} title="Pick a product line" body="Choose one above to see its delivery report." />;
  if (isLoading || !data) return <Skeleton rows={4} />;

  const tasks = data.tasks ?? {};
  const total = sum(tasks);
  const done = Number(tasks.DONE ?? 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '14px 0 16px', borderBottom: '1px solid var(--cw-line)' }}>
        <Stat label="Projects" value={sum(data.projects)} />
        <Stat label="Tasks" value={total} />
        <Stat label="Completion" value={`${total ? Math.round((done / total) * 100) : 0}%`} tone="green" />
        <Stat label="Open issues" value={sum(data.issues, ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING'])} tone="red" />
        <Stat label="Features" value={sum(data.features)} />
      </div>

      <SectionGrid>
        <Section title="Tasks by status"><Distribution data={tasks} /></Section>
        <Section title="Issues by status"><Distribution data={data.issues} tone="red" /></Section>
        <Section title="Features by stage"><Distribution data={data.features} tone="violet" /></Section>
        <Section title="Completed per week"><Throughput data={data.throughput ?? []} /></Section>
      </SectionGrid>

      <Section title="Developer workload" count={data.workload?.length}>
        {!data.workload?.length ? <div className="cw-meta">Nobody on this team yet.</div> : data.workload.map((w: any) => (
          <button key={w.user.id} type="button" className="cw-row" onClick={() => ws.openRecord('DEVELOPER', w.user.id)}>
            <Avatar name={w.user.name} size={20} />
            <span className="cw-truncate" style={{ flex: 1 }}>{w.user.name}</span>
            <span className="cw-meta" style={{ width: 130 }}>{w.role ? humanize(w.role) : '—'}</span>
            <span style={{ width: 110 }}><ProgressBar value={Math.min(100, w.activeTasks * 10)} tone={w.overdueTasks ? 'red' : 'blue'} /></span>
            <span className="cw-num" style={{ width: 26, textAlign: 'right', fontWeight: 620 }}>{w.activeTasks}</span>
            <span className="cw-meta" style={{ width: 62, textAlign: 'right' }}>{w.overdueTasks} late</span>
          </button>
        ))}
      </Section>
    </>
  );
}

function DeveloperReport({ userId }: { userId?: string }) {
  const { data, isLoading } = useDeveloperReport(userId);
  if (isLoading || !data) return <Skeleton rows={4} />;
  const t = data.totals ?? {};
  return (
    <>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '14px 0 16px', borderBottom: '1px solid var(--cw-line)' }}>
        <Stat label="Assigned" value={t.assigned ?? 0} />
        <Stat label="Completed" value={t.completed ?? 0} tone="green" />
        <Stat label="Completion rate" value={`${t.completionRate ?? 0}%`} />
        <Stat label="Active" value={t.active ?? 0} />
        <Stat label="Overdue" value={t.overdue ?? 0} tone={t.overdue ? 'red' : undefined} />
        <Stat label="Blocked" value={t.blocked ?? 0} tone={t.blocked ? 'amber' : undefined} />
        <Stat label="In review" value={t.inReview ?? 0} />
        <Stat label="Open issues" value={t.openIssues ?? 0} />
      </div>
      <SectionGrid>
        <Section title="Completed per week"><Throughput data={data.throughput ?? []} /></Section>
        <Section title="Work by product line">
          {!data.byVertical?.length ? <div className="cw-meta">No work assigned.</div> : (
            <Distribution data={Object.fromEntries(data.byVertical.map((b: any) => [b.vertical?.name ?? 'Unknown', b.count]))} />
          )}
        </Section>
      </SectionGrid>
    </>
  );
}

function ProjectReport({ projectId }: { projectId: string | null }) {
  const { data, isLoading } = useProjectReport(projectId ?? undefined);
  const ws = useWorkspace();
  if (!projectId) return <Empty icon={BarChart3} title="Pick a project" body="Choose one above to see its report." />;
  if (isLoading || !data) return <Skeleton rows={4} />;
  const tt = data.taskTotals ?? {};

  return (
    <>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '14px 0 16px', borderBottom: '1px solid var(--cw-line)' }}>
        <Stat label="Progress" value={`${data.progress ?? 0}%`} />
        <Stat label="Tasks done" value={`${tt.done ?? 0}/${tt.total ?? 0}`} tone="green" />
        <Stat label="Overdue" value={tt.overdue ?? 0} tone={tt.overdue ? 'red' : undefined} />
        <Stat label="Late milestones" value={data.lateMilestones ?? 0} tone={data.lateMilestones ? 'amber' : 'green'} />
        <Stat label="Timeline" value={humanize(data.timelineHealth)} tone={data.timelineHealth === 'ON_SCHEDULE' ? 'green' : 'amber'} />
      </div>

      <SectionGrid>
        <Section title="Tasks by status"><Distribution data={data.tasks} /></Section>
        <Section title="Open issues by severity"><Distribution data={data.openIssuesBySeverity} tone="red" /></Section>
        <Section title="Milestones" count={data.milestones?.length}>
          {!data.milestones?.length ? <div className="cw-meta">No milestones.</div> : data.milestones.map((m: any) => (
            <button key={m.id} type="button" className="cw-row" onClick={() => ws.openRecord('MILESTONE', m.id)}>
              <span className="cw-truncate" style={{ flex: 1 }}>{m.name}</span>
              <span style={{ width: 96 }}><ProgressBar value={m.progress ?? 0} /></span>
            </button>
          ))}
        </Section>
        <Section title="Active work per person">
          {!data.workload?.length ? <div className="cw-meta">Nothing active.</div> : (
            <Distribution data={Object.fromEntries(data.workload.map((w: any) => [w.user?.name ?? 'Unassigned', w.activeTasks]))} />
          )}
        </Section>
      </SectionGrid>
    </>
  );
}

function sum(map?: Record<string, number>, keys?: string[]) {
  if (!map) return 0;
  return Object.entries(map).filter(([k]) => !keys || keys.includes(k)).reduce((a, [, v]) => a + Number(v), 0);
}
