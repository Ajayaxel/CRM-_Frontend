'use client';

/**
 * My Work (spec §15).
 *
 * A developer should open this and know what to do next, so it is ordered by
 * urgency — today, overdue, waiting on me — not by entity type.
 */

import React from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/features/foundation/auth';
import { useMyWork, type Task } from '../api';
import { Avatar, Empty, ProgressBar, Skeleton, Stat, fmtAgo } from '../ui/primitives';
import { DueCell, PriorityMark, StatusChip, taskTone } from '../ui/cells';
import { useWorkspace } from '../ui/workspace-context';
import { Page, Section, SectionGrid } from './page';

export function MyWorkScreen() {
  const { user } = useAuth();
  const ws = useWorkspace();
  const { data, isLoading } = useMyWork();

  if (isLoading || !data) {
    return <Page crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'My work' }]} title="My work"><Skeleton rows={6} /></Page>;
  }

  const s = data.summary;
  const nothing = !data.tasks.length && !data.issues.length && !data.awaitingMyReview.length;

  const list = (rows: Task[]) => rows.map((t) => (
    <button key={t.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', t.id)}>
      <PriorityMark value={t.priority} showLabel={false} />
      <span className="cw-mono">{t.ref}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="cw-truncate" style={{ display: 'block', fontWeight: 520 }}>{t.title}</span>
        <span className="cw-meta cw-truncate" style={{ display: 'block' }}>
          {t.vertical?.icon} {t.vertical?.name}{t.project ? ` · ${t.project.name}` : ''}
        </span>
      </span>
      <span style={{ width: 80, flex: 'none' }}><ProgressBar value={t.progress} tone={taskTone(t.status)} /></span>
      <DueCell date={t.dueDate} status={t.status} />
      <StatusChip kind="task" value={t.status} />
    </button>
  ));

  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'My work' }]}
      title={`Hello${user?.firstName ? `, ${user.firstName}` : ''}`}
      description="Everything assigned to you, ordered by what needs you first."
      actions={<Link href="/consultant/reports" className="cw-btn">My report</Link>}
    >
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '12px 0 16px', borderBottom: '1px solid var(--cw-line)' }}>
        <Stat label="Assigned" value={s.assigned} />
        <Stat label="Due today" value={s.dueToday} tone={s.dueToday ? 'amber' : undefined} />
        <Stat label="Overdue" value={s.overdue} tone={s.overdue ? 'red' : undefined} />
        <Stat label="Awaiting my review" value={s.awaitingMyReview} tone={s.awaitingMyReview ? 'violet' : undefined} />
        <Stat label="Blocked" value={s.blocked} tone={s.blocked ? 'red' : undefined} />
        <Stat label="Open issues" value={s.openIssues} />
        <Stat label="Est. hours" value={s.estimatedHours} />
      </div>

      {nothing ? (
        <Empty icon={CheckCircle2} title="Nothing assigned to you" body="When a manager assigns you work it appears here immediately." />
      ) : (
        <SectionGrid>
          {data.dueToday.length > 0 && <Section title="Today" count={data.dueToday.length}>{list(data.dueToday)}</Section>}
          {data.overdue.length > 0 && <Section title="Overdue" count={data.overdue.length}>{list(data.overdue)}</Section>}
          {data.awaitingMyReview.length > 0 && (
            <Section title="Waiting on your review" count={data.awaitingMyReview.length}>
              {data.awaitingMyReview.map((t) => (
                <button key={t.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', t.id)}>
                  <span className="cw-mono">{t.ref}</span>
                  <span className="cw-truncate" style={{ flex: 1 }}>{t.title}</span>
                  <Avatar name={t.assignee?.name} size={19} />
                </button>
              ))}
            </Section>
          )}
          {data.blocked.length > 0 && <Section title="Blocked" count={data.blocked.length}>{list(data.blocked)}</Section>}
          {data.dueThisWeek.length > 0 && <Section title="Upcoming" count={data.dueThisWeek.length}>{list(data.dueThisWeek)}</Section>}

          <Section title="All assigned" count={data.tasks.length}>
            {data.tasks.length === 0 ? <div className="cw-meta">Nothing assigned.</div> : list(data.tasks.slice(0, 25))}
          </Section>

          {data.issues.length > 0 && (
            <Section title="My issues" count={data.issues.length}>
              {data.issues.map((i) => (
                <button key={i.id} type="button" className="cw-row" onClick={() => ws.openRecord('ISSUE', i.id)}>
                  <span className="cw-mono">{i.ref}</span>
                  <span className="cw-truncate" style={{ flex: 1 }}>{i.title}</span>
                  <StatusChip kind="severity" value={i.severity} />
                  <StatusChip kind="issue" value={i.status} />
                </button>
              ))}
            </Section>
          )}

          {data.features.length > 0 && (
            <Section title="My features" count={data.features.length}>
              {data.features.map((f) => (
                <button key={f.id} type="button" className="cw-row" onClick={() => ws.openRecord('FEATURE', f.id)}>
                  <span className="cw-mono">{f.ref}</span>
                  <span className="cw-truncate" style={{ flex: 1 }}>{f.name}</span>
                  <StatusChip kind="feature" value={f.status} />
                </button>
              ))}
            </Section>
          )}

          {data.projects.length > 0 && (
            <Section title="My projects" count={data.projects.length}>
              {data.projects.map((p) => (
                <Link key={p.id} href={`/consultant/projects/${p.id}`} className="cw-row">
                  <span className="cw-truncate" style={{ flex: 1, fontWeight: 520 }}>{p.name}</span>
                  <span className="cw-meta">{p.vertical?.name}</span>
                  <StatusChip kind="project" value={p.status} />
                </Link>
              ))}
            </Section>
          )}

          {data.recentlyCompleted.length > 0 && (
            <Section title="Recently completed" count={data.recentlyCompleted.length}>
              {data.recentlyCompleted.map((t) => (
                <button key={t.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', t.id)}>
                  <CheckCircle2 size={13} style={{ color: 'var(--cw-green)', flex: 'none' }} />
                  <span className="cw-truncate" style={{ flex: 1 }}>{t.title}</span>
                  <span className="cw-meta">{fmtAgo(t.completedAt)}</span>
                </button>
              ))}
            </Section>
          )}
        </SectionGrid>
      )}
    </Page>
  );
}
