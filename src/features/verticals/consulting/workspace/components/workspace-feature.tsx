'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { card, Empty, Loading, Pill } from './shared';
import { WorkspaceOverview } from './workspace-overview';
import { WorkspaceStrategy } from './workspace-strategy';
import { WorkspaceLoop } from './workspace-loop';
import { WorkspaceMeetings } from './workspace-meetings';
import {
  CsAction, CsCompany, CsDecision, CsIssue, CsMeeting, CsPaged, humanEnum, StrategyDashboard,
} from '../workspace-client';

const TABS = ['Overview', 'Strategy', 'Issues', 'Meetings'] as const;
type Tab = (typeof TABS)[number];

/**
 * One client, one screen.
 *
 * Spec §5: the consultant should be able to understand the whole business from
 * here. The tabs are the loop, not a feature list — what is happening, what we
 * are trying to achieve, what is wrong, and what was decided about it.
 *
 * Everything on every tab is READ from records the consultant already keeps.
 * The queries live here rather than inside each tab so that switching tabs does
 * not refetch, and so the attention strip at the top can count what the tabs
 * are about to show.
 */
export function WorkspaceFeature({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Overview');

  const company = useQuery({
    queryKey: ['cs-company', companyId],
    queryFn: async () => (await api.get<CsCompany & { departments?: unknown[]; contacts?: unknown[] }>(`/consulting/companies/${companyId}`)).data,
  });

  const strategy = useQuery({
    queryKey: ['cs-strategy-dashboard', companyId],
    queryFn: async () => (await api.get<StrategyDashboard>('/consulting/strategy/dashboard', { params: { companyId } })).data,
  });

  const issues = useQuery({
    queryKey: ['cs-issues', companyId],
    queryFn: async () => (await api.get<CsPaged<CsIssue>>('/consulting/issues', { params: { companyId, take: 100 } })).data,
  });

  const meetings = useQuery({
    queryKey: ['cs-meetings', companyId],
    queryFn: async () => (await api.get<CsPaged<CsMeeting>>('/consulting/meetings', { params: { companyId, take: 50 } })).data,
  });

  const actions = useQuery({
    queryKey: ['cs-actions', companyId],
    queryFn: async () => (await api.get<CsPaged<CsAction>>('/consulting/actions', { params: { companyId, take: 100 } })).data,
  });

  const decisions = useQuery({
    queryKey: ['cs-decisions', companyId],
    queryFn: async () => (await api.get<CsPaged<CsDecision>>('/consulting/decisions', { params: { companyId, take: 50 } })).data,
  });

  /**
   * The attention counts (spec §13, §27).
   *
   * Computed from the lists already fetched rather than from a separate
   * endpoint, so the number in the strip and the rows in the tab can never
   * disagree — which is the usual way a "3 critical issues" badge ends up
   * pointing at a tab showing two.
   */
  const attention = useMemo(() => {
    const openIssues = (issues.data?.items ?? []).filter(
      (i) => !['RESOLVED', 'EVALUATED', 'CLOSED'].includes(i.status),
    );
    const now = Date.now();
    return {
      criticalIssues: openIssues.filter((i) => i.priority === 'CRITICAL' || i.priority === 'HIGH').length,
      openIssues: openIssues.length,
      overdueActions: (actions.data?.items ?? []).filter(
        (a) => ['OPEN', 'IN_PROGRESS'].includes(a.status) && a.dueDate && new Date(a.dueDate).getTime() < now,
      ).length,
      pendingDecisions: (decisions.data?.items ?? []).filter((d) => d.status === 'PROPOSED' || d.status === 'DEFERRED').length,
      kpisOffTrack: strategy.data?.kpis.offTrack ?? 0,
      kpisAtRisk: strategy.data?.kpis.atRisk ?? 0,
      nextMeeting: (meetings.data?.items ?? [])
        .filter((m) => m.status === 'SCHEDULED' && new Date(m.scheduledAt).getTime() >= now)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] ?? null,
      objectivesAtRisk: strategy.data?.objectives.atRisk.length ?? 0,
      initiativesDelayed: strategy.data?.initiatives.delayed.length ?? 0,
    };
  }, [issues.data, actions.data, decisions.data, strategy.data, meetings.data]);

  if (company.isLoading) return <Loading label="Opening the workspace" />;
  if (company.isError || !company.data) {
    return (
      <Empty
        title="That company is not here"
        hint="It may have been archived, or it belongs to another workspace."
        action={<button className="btn-ghost" onClick={() => router.push('/companies')}><ArrowLeft size={15} /> Back to companies</button>}
      />
    );
  }

  const c = company.data;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <button className="btn-ghost" style={{ marginBottom: 10 }} onClick={() => router.push('/companies')}>
        <ArrowLeft size={15} /> Companies
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--surface-2,#f1f3f4)', display: 'grid', placeItems: 'center' }}>
            <Building2 size={20} style={{ color: 'var(--ink-2)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{c.name}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {[c.industry, c.city, c.country].filter(Boolean).join(' · ') || 'No industry recorded'}
              </span>
              {(c.relations ?? []).map((r) => <Pill key={r.kind}>{humanEnum(r.kind)}</Pill>)}
            </div>
          </div>
        </div>
      </div>

      <AttentionStrip attention={attention} onJump={(t) => setTab(t)} />

      <div style={{ display: 'flex', gap: 4, margin: '18px 0 14px', borderBottom: '1px solid var(--line-soft)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: tab === t ? 'var(--brand,#132376)' : 'var(--ink-2)',
              borderBottom: `2px solid ${tab === t ? 'var(--brand,#132376)' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <WorkspaceOverview
          companyId={companyId}
          strategy={strategy.data}
          issues={issues.data?.items ?? []}
          actions={actions.data?.items ?? []}
          meetings={meetings.data?.items ?? []}
          loading={strategy.isLoading || issues.isLoading}
        />
      ) : null}
      {tab === 'Strategy' ? <WorkspaceStrategy companyId={companyId} dashboard={strategy.data} loading={strategy.isLoading} /> : null}
      {tab === 'Issues' ? (
        <WorkspaceLoop
          companyId={companyId}
          issues={issues.data?.items ?? []}
          decisions={decisions.data?.items ?? []}
          actions={actions.data?.items ?? []}
          loading={issues.isLoading}
        />
      ) : null}
      {tab === 'Meetings' ? <WorkspaceMeetings companyId={companyId} meetings={meetings.data?.items ?? []} loading={meetings.isLoading} /> : null}
    </div>
  );
}

/**
 * "What needs my attention?" — the one question spec §27 says the top of the
 * screen must answer. A count of zero is shown in grey and not as a green
 * badge: nothing to do is the normal state, not an achievement.
 */
function AttentionStrip({ attention, onJump }: {
  attention: {
    criticalIssues: number; openIssues: number; overdueActions: number; pendingDecisions: number;
    kpisOffTrack: number; kpisAtRisk: number; objectivesAtRisk: number; initiativesDelayed: number;
    nextMeeting: CsMeeting | null;
  };
  onJump: (t: Tab) => void;
}) {
  const items: { label: string; value: number; tab: Tab; danger?: boolean }[] = [
    { label: 'Critical issues', value: attention.criticalIssues, tab: 'Issues', danger: true },
    { label: 'Overdue actions', value: attention.overdueActions, tab: 'Issues', danger: true },
    { label: 'Decisions pending', value: attention.pendingDecisions, tab: 'Issues' },
    { label: 'KPIs off track', value: attention.kpisOffTrack, tab: 'Strategy', danger: true },
    { label: 'Objectives at risk', value: attention.objectivesAtRisk, tab: 'Strategy' },
    { label: 'Initiatives delayed', value: attention.initiativesDelayed, tab: 'Strategy' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
      {items.map((i) => (
        <button
          key={i.label}
          onClick={() => onJump(i.tab)}
          style={{
            ...card, padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
            borderColor: i.value > 0 && i.danger ? 'var(--danger,#d93025)' : 'var(--line-soft)',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: i.value === 0 ? 'var(--ink-3)' : i.danger ? 'var(--danger,#d93025)' : 'var(--ink-1)' }}>
            {i.value}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{i.label}</div>
        </button>
      ))}
      <button
        onClick={() => onJump('Meetings')}
        style={{ ...card, padding: '12px 14px', textAlign: 'left', cursor: 'pointer' }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {attention.nextMeeting
            ? new Date(attention.nextMeeting.scheduledAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
            : '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          {attention.nextMeeting ? attention.nextMeeting.title : 'No meeting scheduled'}
        </div>
      </button>
    </div>
  );
}
