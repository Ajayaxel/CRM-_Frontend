'use client';

import { card, Due, Empty, KpiPill, Loading, PriorityPill, Progress, Row, SectionTitle } from './shared';
import {
  CsAction, CsIssue, CsMeeting, humanEnum, shortDate, StrategyDashboard,
} from '../workspace-client';

/**
 * The Overview tab answers the five questions of spec §32, in order:
 * what is happening, what is wrong, what needs attention, what decision is
 * required, what happens next.
 *
 * It renders nothing it had to ask for separately — every list here is a slice
 * of what the workspace already loaded.
 */
export function WorkspaceOverview({ strategy, issues, actions, meetings, loading }: {
  companyId: string;
  strategy?: StrategyDashboard;
  issues: CsIssue[];
  actions: CsAction[];
  meetings: CsMeeting[];
  loading: boolean;
}) {
  if (loading) return <Loading label="Reading the business" />;

  const openIssues = issues.filter((i) => !['RESOLVED', 'EVALUATED', 'CLOSED'].includes(i.status));
  const attentionIssues = openIssues
    .filter((i) => i.priority === 'CRITICAL' || i.priority === 'HIGH')
    .slice(0, 6);
  const liveActions = actions
    .filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
    .slice(0, 6);
  const upcoming = meetings
    .filter((m) => m.status === 'SCHEDULED')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 4);
  const kpis = (strategy?.kpis.items ?? []).slice(0, 6);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
      <section>
        <SectionTitle>What is wrong</SectionTitle>
        {attentionIssues.length === 0 ? (
          <Empty title="Nothing critical open" hint="High and critical issues would appear here." />
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {attentionIssues.map((i) => (
              <Row key={i.id}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', width: 62 }}>{i.ref}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{i.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                    {humanEnum(i.status)} · {humanEnum(i.category)}
                  </div>
                </div>
                <PriorityPill p={i.priority} />
                <Due date={i.dueDate} />
              </Row>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Who owes what</SectionTitle>
        {liveActions.length === 0 ? (
          <Empty title="No open action items" hint="Actions agreed in a meeting land here with an owner and a date." />
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {liveActions.map((a) => (
              <Row key={a.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                    {a.issue ? `${a.issue.ref} · ` : ''}{humanEnum(a.status)}
                    {a.task ? ` · tracked as ${a.task.ref}` : ''}
                  </div>
                </div>
                <Due date={a.dueDate} />
              </Row>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Are we on track</SectionTitle>
        <div style={{ ...card, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6 }}>
            Strategic progress across {strategy?.objectives.active.length ?? 0} active objective(s)
          </div>
          <Progress value={strategy?.objectives.averageProgress ?? null} />
        </div>
        {kpis.length === 0 ? (
          <Empty title="No KPIs yet" hint="A KPI is what turns an opinion about the business into a number." />
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {kpis.map((k) => (
              <Row key={k.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{k.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                    {k.latest ? `${k.latest.value}${k.unit ? ` ${k.unit}` : ''}` : 'no reading'}
                    {k.target !== null && k.target !== undefined ? ` · target ${k.target}` : ''}
                  </div>
                </div>
                <KpiPill s={k.status} />
              </Row>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>What happens next</SectionTitle>
        {upcoming.length === 0 ? (
          <Empty title="Nothing scheduled" hint="Schedule the next review from the Meetings tab." />
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {upcoming.map((m) => (
              <Row key={m.id}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', width: 62 }}>{m.ref}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{humanEnum(m.type)}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{shortDate(m.scheduledAt)}</span>
              </Row>
            ))}
          </div>
        )}
        {(strategy?.initiatives.delayed.length ?? 0) > 0 ? (
          <div style={{ ...card, padding: '12px 14px', marginTop: 10, borderColor: 'var(--warning,#E6A23C)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Running late</div>
            {strategy!.initiatives.delayed.slice(0, 4).map((d) => (
              <div key={d.id} style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {d.title} — {d.daysLate} day{d.daysLate === 1 ? '' : 's'} past target
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
