'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { card, Due, Empty, KpiPill, Loading, Progress, Row, SectionTitle, Stat } from './shared';
import { CsStrategyArea, humanEnum, shortDate, StrategyDashboard } from '../workspace-client';

const AREAS: CsStrategyArea[] = [
  'GROWTH', 'TRANSFORMATION', 'BRANDING', 'FINANCE', 'OPERATIONS', 'MARKET_EXPANSION',
  'ACQUISITION', 'NEW_PRODUCTS', 'INVESTMENT', 'COST_OPTIMIZATION', 'OTHER',
];

/**
 * Strategy: what we are trying to achieve, how, and whether it is working.
 *
 * Objectives carry their derived progress — rolled up from initiatives and the
 * projects underneath them — so the number on this screen is the same number
 * the delivery board would produce, rather than a second opinion somebody has
 * to maintain.
 */
export function WorkspaceStrategy({ companyId, dashboard, loading }: {
  companyId: string;
  dashboard?: StrategyDashboard;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('consulting.strategy.manage');
  const [compose, setCompose] = useState(false);

  const createObjective = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/consulting/objectives', { companyId, ...body }),
    onSuccess: () => {
      toast.success('Objective added');
      setCompose(false);
      qc.invalidateQueries({ queryKey: ['cs-strategy-dashboard', companyId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (loading) return <Loading label="Reading the strategy" />;
  if (!dashboard) return <Empty title="No strategy recorded yet" />;

  const { objectives, initiatives, kpis, upcomingTargets, strategyProjects } = dashboard;
  const all = [...objectives.active, ...objectives.atRisk];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
        <Stat label="Active objectives" value={objectives.active.length} />
        <Stat label="At risk" value={objectives.atRisk.length} accent={objectives.atRisk.length ? 'var(--warning,#E6A23C)' : undefined} />
        <Stat label="Live initiatives" value={initiatives.live.length} />
        <Stat label="Delayed" value={initiatives.delayed.length} accent={initiatives.delayed.length ? 'var(--danger,#d93025)' : undefined} />
        <Stat
          label="KPIs off track"
          value={kpis.offTrack}
          accent={kpis.offTrack ? 'var(--danger,#d93025)' : undefined}
          hint={`${kpis.onTrack} on track · ${kpis.atRisk} at risk`}
        />
      </div>

      <SectionTitle
        right={canManage ? <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={14} /> New objective</button> : undefined}
      >
        Objectives
      </SectionTitle>
      {all.length === 0 ? (
        <Empty
          title="No objectives being pursued"
          hint="An objective is what the engagement is for. Initiatives and projects hang off it."
          action={canManage ? <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={14} /> Add one</button> : undefined}
        />
      ) : (
        <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
          {all.map((o) => (
            <Row key={o.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{o.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {humanEnum(o.area)} · {humanEnum(o.status)}
                  {o.initiativeCount ? ` · ${o.initiativeCount} initiative${o.initiativeCount === 1 ? '' : 's'}` : ' · no initiatives yet'}
                </div>
                {o.targetOutcome ? (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Target: {o.targetOutcome}</div>
                ) : null}
              </div>
              <Progress value={o.progress} />
              <Due date={o.targetDate} />
            </Row>
          ))}
        </div>
      )}

      <SectionTitle>Initiatives</SectionTitle>
      {initiatives.live.length === 0 ? (
        <Empty title="No live initiatives" hint="An initiative is how an objective gets done — and it becomes a project." />
      ) : (
        <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
          {initiatives.live.map((i) => (
            <Row key={i.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{i.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {humanEnum(i.status)}{i.objective ? ` · ${i.objective.title}` : ''}
                </div>
              </div>
              <Progress value={i.progress} />
              <Due date={i.targetDate} />
            </Row>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
        <section>
          <SectionTitle>KPIs</SectionTitle>
          {kpis.items.length === 0 ? (
            <Empty title="Nothing is being measured" />
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {kpis.items.map((k) => (
                <Row key={k.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{k.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                      {k.latest ? `${k.latest.value}${k.unit ? ` ${k.unit}` : ''}` : 'no reading'}
                      {k.target !== null && k.target !== undefined ? ` against ${k.target}` : ''}
                    </div>
                  </div>
                  <KpiPill s={k.status} />
                </Row>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Work strategy is running</SectionTitle>
          {strategyProjects.length === 0 ? (
            <Empty title="No projects yet" hint="Start one from an initiative, and it inherits the client, the engagement and the objective." />
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {strategyProjects.map((p) => (
                <Row key={p.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                      {humanEnum(p.status)}{p.methodology ? ` · ${humanEnum(p.methodology)}` : ''}
                    </div>
                  </div>
                  <Progress value={p.progress} />
                </Row>
              ))}
            </div>
          )}
          {upcomingTargets.length ? (
            <div style={{ ...card, padding: '12px 14px', marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Due in the next month</div>
              {upcomingTargets.slice(0, 5).map((t) => (
                <div key={`${t.kind}-${t.id}`} style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  {shortDate(t.targetDate)} — {t.title}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {compose ? (
        <ComposeObjective
          busy={createObjective.isPending}
          onClose={() => setCompose(false)}
          onSubmit={(body) => createObjective.mutate(body)}
        />
      ) : null}
    </div>
  );
}

function ComposeObjective({ onClose, onSubmit, busy }: {
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<CsStrategyArea>('GROWTH');
  const [targetOutcome, setTargetOutcome] = useState('');
  const [targetDate, setTargetDate] = useState('');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 'min(520px,100%)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>New objective</h2>
          <button className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>What are we trying to achieve?</label>
        <input className="input" style={{ width: '100%', marginBottom: 10 }} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Area</label>
        <select className="input" style={{ width: '100%', marginBottom: 10 }} value={area} onChange={(e) => setArea(e.target.value as CsStrategyArea)}>
          {AREAS.map((a) => <option key={a} value={a}>{humanEnum(a)}</option>)}
        </select>

        {/* Stated before the work, so the evaluation afterwards has something to
            be measured against — see the model comment on targetOutcome. */}
        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>What would success look like?</label>
        <input className="input" style={{ width: '100%', marginBottom: 10 }} value={targetOutcome} onChange={(e) => setTargetOutcome(e.target.value)} placeholder="₹40cr revenue, margin held at 22%" />

        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Target date</label>
        <input type="date" className="input" style={{ width: '100%', marginBottom: 16 }} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!title.trim() || busy}
            onClick={() => onSubmit({
              title: title.trim(),
              area,
              ...(targetOutcome.trim() ? { targetOutcome: targetOutcome.trim() } : {}),
              ...(targetDate ? { targetDate: new Date(targetDate).toISOString() } : {}),
            })}
          >
            {busy ? 'Adding…' : 'Add objective'}
          </button>
        </div>
      </div>
    </div>
  );
}
