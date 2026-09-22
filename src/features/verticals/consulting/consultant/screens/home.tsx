'use client';

/**
 * Consultant home (spec §5, §6).
 *
 * Header, one line of numbers, then the portfolio list. Deliberately not a
 * dashboard: the numbers are type, not tiles, and the thing that fills the
 * screen is the work itself.
 */

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { useBootstrapWorkspace, usePmStatus, usePortfolio } from '../api';
import { Empty, Skeleton, Stat, fmtAgo } from '../ui/primitives';
import { StatusChip } from '../ui/cells';
import { useWorkspace } from '../ui/workspace-context';
import { VerticalsTable } from './verticals';
import { Page, Section, SectionGrid } from './page';

export function HomeScreen() {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const status = usePmStatus();
  const { data, isLoading } = usePortfolio();
  const bootstrap = useBootstrapWorkspace();

  const canManage = hasPermission('pm.vertical.manage');

  if (status.data && !status.data.ready) {
    return (
      <Page title="Consultant" description="Manage projects, work, issues and technical operations across every product line.">
        <div style={{ borderTop: '1px solid var(--cw-line)' }}>
          <Empty
            icon={Sparkles}
            title="Set up the consultant workspace"
            body="This creates the 19 product lines from the BMN Connect catalogue and the delivery roles — Consultant Admin, Project Manager, Technical Lead, Developer and QA. You can rename, archive or add product lines afterwards."
            action={canManage ? (
              <button
                className="cw-btn cw-btn-primary"
                disabled={bootstrap.isPending}
                onClick={() => bootstrap.mutate(undefined, {
                  onSuccess: (r: any) => toast.success(`${r.verticalsCreated} vertical(s) and ${r.rolesCreated?.length ?? 0} role(s) created`),
                  onError: (e) => toast.error(apiErrorMessage(e)),
                })}
              >{bootstrap.isPending ? 'Setting up…' : 'Set up workspace'}</button>
            ) : (
              <span className="cw-meta">Ask an administrator — this needs the “Manage product lines” permission.</span>
            )}
          />
        </div>
      </Page>
    );
  }

  const s = data?.summary;
  const attention = (s?.criticalIssues ?? 0) + (s?.overdueTasks ?? 0) + (s?.blockedTasks ?? 0);

  return (
    <Page
      crumbs={[{ label: 'Consultant' }]}
      title="Consultant"
      description="Manage projects, work, issues and technical operations across every product line."
      actions={
        <>
          <Link href="/consultant/my-work" className="cw-btn">My work</Link>
          <button className="cw-btn" onClick={() => ws.setCommandOpen(true)}>Search</button>
        </>
      }
    >
      {isLoading || !s ? <Skeleton rows={6} /> : (
        <>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '14px 0 16px', borderBottom: '1px solid var(--cw-line)' }}>
            <Stat label="Product lines" value={s.verticals} />
            <Stat label="Active projects" value={s.activeProjects} />
            <Stat label="Open tasks" value={s.openTasks} />
            <Stat label="Open issues" value={s.openIssues} tone={s.criticalIssues ? 'red' : undefined} />
            <Stat label="Overdue" value={s.overdueTasks} tone={s.overdueTasks ? 'red' : undefined} />
            <Stat label="Blocked" value={s.blockedTasks} tone={s.blockedTasks ? 'amber' : undefined} />
            <Stat label="Features in dev" value={s.featuresInDev} />
            <Stat label="Milestones due" value={s.upcomingMilestones} />
          </div>

          {attention > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', marginTop: 14,
              borderRadius: 'var(--cw-r)', background: 'var(--cw-red-bg)', color: 'var(--cw-red)',
            }}>
              <AlertTriangle size={14} style={{ flex: 'none' }} />
              <span style={{ fontWeight: 600 }}>
                {[
                  s.criticalIssues ? `${s.criticalIssues} critical issue${s.criticalIssues === 1 ? '' : 's'}` : null,
                  s.overdueTasks ? `${s.overdueTasks} overdue task${s.overdueTasks === 1 ? '' : 's'}` : null,
                  s.blockedTasks ? `${s.blockedTasks} blocked` : null,
                ].filter(Boolean).join(' · ')}
              </span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                {s.criticalIssues > 0 && <Link href="/consultant/issues" className="cw-btn" style={{ height: 24 }}>Issues</Link>}
                {s.overdueTasks > 0 && <Link href="/consultant/tasks" className="cw-btn" style={{ height: 24 }}>Overdue</Link>}
              </span>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <VerticalsTable compact />
          </div>

          <SectionGrid>
            <Section title="Upcoming milestones" count={data?.upcomingMilestones.length}>
              {!data?.upcomingMilestones.length ? <div className="cw-meta">Nothing scheduled.</div> : data.upcomingMilestones.map((m) => (
                <button key={m.id} type="button" className="cw-row" onClick={() => ws.openRecord('MILESTONE', m.id)}>
                  <span className="cw-truncate" style={{ flex: 1, fontWeight: 520 }}>{m.name}</span>
                  <span className="cw-meta cw-truncate" style={{ maxWidth: 120 }}>{m.vertical?.name}</span>
                  <span className="cw-meta cw-num">{m.targetDate ? new Date(m.targetDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}</span>
                </button>
              ))}
            </Section>

            <Section title="Recent deployments" count={data?.recentDeployments.length}>
              {!data?.recentDeployments.length ? (
                <div className="cw-meta">No deployments recorded. Connect CI/CD from Deployments → Ingest tokens.</div>
              ) : data.recentDeployments.map((d) => (
                <Link key={d.id} href="/consultant/deployments" className="cw-row">
                  <span style={{ width: 16, textAlign: 'center', flex: 'none' }}>{d.vertical?.icon ?? '▪'}</span>
                  <span className="cw-truncate" style={{ flex: 1 }}>{d.version ?? 'Deployment'}</span>
                  <span className="cw-meta cw-truncate" style={{ maxWidth: 110 }}>{d.vertical?.name}</span>
                  <StatusChip kind="deployment" value={d.status} />
                </Link>
              ))}
            </Section>

            <Section title="Recently completed" count={data?.recentlyCompleted.length}>
              {!data?.recentlyCompleted.length ? <div className="cw-meta">Nothing completed yet.</div> : data.recentlyCompleted.map((t) => (
                <button key={t.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', t.id)}>
                  <span className="cw-mono">{t.ref}</span>
                  <span className="cw-truncate" style={{ flex: 1 }}>{t.title}</span>
                  <span className="cw-meta">{fmtAgo(t.completedAt)}</span>
                </button>
              ))}
            </Section>

            <Section
              title="Activity"
              action={<Link href="/consultant/activity" className="cw-meta" style={{ textDecoration: 'none' }}>View all</Link>}
            >
              {!data?.recentActivity.length ? <div className="cw-meta">Nothing has happened yet.</div> : data.recentActivity.slice(0, 8).map((a) => (
                <div key={a.id} className="cw-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', marginTop: 9, flex: 'none',
                    background: a.source === 'AUTOMATED' ? 'var(--cw-blue)' : 'var(--cw-ink-4)',
                  }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="cw-truncate" style={{ display: 'block' }}>{a.summary}</span>
                    <span className="cw-meta">{a.actor?.name ?? (a.source === 'AUTOMATED' ? 'Automated' : 'System')} · {fmtAgo(a.createdAt)}</span>
                  </span>
                </div>
              ))}
            </Section>
          </SectionGrid>
        </>
      )}
    </Page>
  );
}
