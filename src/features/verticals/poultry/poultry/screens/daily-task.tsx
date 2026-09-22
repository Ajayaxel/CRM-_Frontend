'use client';

/**
 * The daily operating cockpit.
 *
 * Built around EXCEPTIONS rather than totals: a manager with forty farms does
 * not need forty rows, they need the three that are wrong. Everything on this
 * page is a read over documents other screens own — it records nothing, so it
 * can never drift from the ledger it reports.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, CircleAlert, Sunrise, Sunset, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, DataTable, EmptyState, SectionTitle, Skeleton, StatCard, type DataTableColumn } from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';

interface Exception {
  severity: 'RED' | 'AMBER';
  kind: string; title: string; detail: string;
  href?: string; entityId?: string; valueInr?: number;
}

interface Cash {
  openingInr: number; cashInInr: number; cashOutInr: number;
  expectedInr: number; countedInr: number | null; varianceInr: number | null; short: boolean;
}

interface DailyTask {
  date: string;
  morning: {
    readyForPickup: { batchId: string; code: string; farm: { id: string; code: string; name: string }; expectedPickupDate: string; overdueDays: number }[];
    farmsToInspect: number;
    outletsToOpen: number;
    requestsWaiting: number;
    approvedToIssue: { id: string; reference: string; kind: string; batch: string; farm: string; lines: number }[];
    openingBirds: number;
    openingFlocks: { batchId: string; code: string; farm: string; shed: string | null; liveBirds: number; ageDays: number; feedStage: string | null; feedBagsToday: number }[];
    feedBagsToday: number;
    vaccinesDue: { title: string; detail: string; href: string | null; severity: 'RED' | 'AMBER' }[];
    stockShortages: { itemsShort: number; rows: { description: string; uom: string; requiredQty: number; shortfallQty: number }[] };
    supervisors: { staffId: string | null; name: string; sheds: number; inspected: number; outstanding: string[] }[];
    outletsNotOpened: { id: string; name: string }[];
    cashOpeningInr: number;
  };
  inFlight: {
    inspectionsDone: number;
    inspectionsOutstanding: number;
    pickups: { id: string; reference: string; batch: string; farm: string; birds: number; weightKg: number; netInr: number; weighingGroups: number; weighed: boolean }[];
    feedIssues: number; feedReturns: number;
    labourToVerify: { id: string; reference: string; work: string; quantity: number; uom: string; amountInr: number }[];
    mortalityToday: number;
    weightsRecorded: number;
    outletReceiving: { receipts: number; kg: number };
    outletSales: { sales: number; kg: number; amountInr: number };
  };
  endOfDay: {
    outlets: { id: string; stall: { id: string; name: string }; status: string; openingStockKg: number; cash: Cash }[];
    unweighedPickups: number;
    pendingLabour: number;
    mortalityReconciliation: { birdMismatches: number; deathsToday: number; shedsWithoutEntry: number };
    feedReconciliation: { issues: number; returns: number };
    stockReconciliation: { variances: number; itemsShort: number };
    outletStock: { id: string; stall: { id: string; name: string }; status: string; openingKg: number; closingKg: number | null; countedKg: number | null; varianceKg: number | null }[];
    pendingReceivables: Record<string, number> | null;
    uninvoicedLoads: number;
    receivingMismatches: number;
    stockVariances: number;
    unresolvedApprovals: { approvals: number; expenses: number; requests: number; settlements: number; labour: number; total: number };
  };
  exceptions: Exception[];
  counts: Record<string, number>;
}

const PHASES = ['Exceptions', 'Morning', 'During the day', 'End of day'];

export function DailyTaskScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState(PHASES[0]);
  const [date] = useState(new Date().toISOString().slice(0, 10));

  const task = useQuery({
    queryKey: ['py', 'daily-task', date],
    queryFn: async () => (await api.get<DailyTask>('/poultry/daily-task', { params: { date } })).data,
    refetchInterval: 120_000,
  });

  if (task.isLoading || !task.data) {
    return <div className="ds-page"><PageHead title="Daily task" /><Skeleton rows={4} height={92} /></div>;
  }
  const d = task.data;
  const red = d.counts.RED ?? 0;
  const amber = d.counts.AMBER ?? 0;

  return (
    <div className="ds-page">
      <PageHead
        title="Daily task"
        subtitle={`${fmtDate(d.date)} — the day's operating board. Everything here is read from the documents that already exist; nothing is recorded on this page.`}
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Needs attention now" value={String(red)} hint="money or birds at risk today" tone={red > 0 ? 'expired' : 'active'} />
        <StatCard label="Watch" value={String(amber)} hint="red tomorrow if nobody moves" tone={amber > 0 ? 'renewal' : 'neutral'} />
        <StatCard label="Sheds not inspected" value={String(d.inFlight.inspectionsOutstanding)} hint={`${d.inFlight.inspectionsDone} done today`} />
        <StatCard label="Ready for pickup" value={String(d.morning.readyForPickup.length)} hint="loads to allocate" />
      </div>

      <div style={{ margin: '18px 0 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PHASES.map((p) => (
          <button
            key={p}
            className={p === phase ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setPhase(p)}
          >
            {p === 'Morning' && <Sunrise size={14} />}
            {p === 'During the day' && <Truck size={14} />}
            {p === 'End of day' && <Sunset size={14} />}
            {p === 'Exceptions' && <CircleAlert size={14} />}
            {p}
          </button>
        ))}
      </div>

      {phase === 'Exceptions' && (
        d.exceptions.length === 0 ? (
          <Card>
            <EmptyState icon={AlertTriangle} title="Nothing needs attention" body="Every shed is inspected, every load is weighed, every till reconciles and nothing is expiring." />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.exceptions.map((e, i) => (
              <Card key={`${e.kind}-${i}`} tone={e.severity === 'RED' ? 'expired' : 'renewal'} interactive={!!e.href} onClick={e.href ? () => router.push(e.href!) : undefined}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flex: 'none' }}>{e.severity === 'RED' ? '🔴' : '🟠'}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div className="ds-caption" style={{ marginTop: 2 }}>{e.detail}</div>
                  </div>
                  {e.href && <ArrowRight size={16} style={{ color: 'var(--ink-3)', flex: 'none', marginTop: 2 }} />}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {phase === 'Morning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Opening birds" value={d.morning.openingBirds.toLocaleString('en-IN')} hint={`${d.morning.openingFlocks.length} growing flock(s)`} />
            <StatCard label="Feed due today" value={`${d.morning.feedBagsToday} bags`} hint="from each flock's snapshotted programme" onClick={() => router.push('/poultry/feed')} />
            <StatCard label="Vaccines due" value={String(d.morning.vaccinesDue.length)} hint="derived from the schedule and the flock's age" tone={d.morning.vaccinesDue.some((v) => v.severity === 'RED') ? 'expired' : 'neutral'} />
            <StatCard label="Items short" value={String(d.morning.stockShortages.itemsShort)} hint="approved requests the store cannot cover" tone={d.morning.stockShortages.itemsShort > 0 ? 'expired' : 'active'} onClick={() => router.push('/poultry/field-ops')} />
            <StatCard label="Cash opening" value={money(d.morning.cashOpeningInr)} hint={`${d.morning.outletsNotOpened.length} outlet(s) not opened`} />
          </div>

          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="Birds in every shed at the start of the day, and the feed each flock needs today.">Opening flocks</SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'code', header: 'Batch', render: (r: any) => <span style={{ fontWeight: 600 }}>{r.code}</span> },
                { key: 'farm', header: 'Farm · shed', render: (r: any) => `${r.farm}${r.shed ? ` · ${r.shed}` : ''}` },
                { key: 'liveBirds', header: 'Live birds', align: 'right', render: (r: any) => r.liveBirds.toLocaleString('en-IN') },
                { key: 'ageDays', header: 'Day', align: 'right', render: (r: any) => String(r.ageDays) },
                { key: 'feedStage', header: 'Stage', render: (r: any) => r.feedStage ?? <span className="ds-caption">no programme</span> },
                { key: 'feedBagsToday', header: 'Bags today', align: 'right', render: (r: any) => String(r.feedBagsToday) },
              ] as DataTableColumn<any>[]}
              rows={d.morning.openingFlocks}
              rowKey={(r) => r.batchId}
              onRowClick={(r) => router.push(`/poultry/batches/${r.batchId}`)}
              empty="No flock is growing."
            />
          </Card>

          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="Who walks which shed today, and which sheds still have no entry.">Supervisor assignments</SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Supervisor', render: (r: any) => r.staffId ? <strong>{r.name}</strong> : <Badge tone="expired">{r.name}</Badge> },
                { key: 'sheds', header: 'Flocks', align: 'right', render: (r: any) => String(r.sheds) },
                { key: 'inspected', header: 'Inspected', align: 'right', render: (r: any) => `${r.inspected} / ${r.sheds}` },
                { key: 'outstanding', header: 'Still to inspect', render: (r: any) => r.outstanding.length ? r.outstanding.join(', ') : <span className="ds-caption">all done</span> },
              ] as DataTableColumn<any>[]}
              rows={d.morning.supervisors}
              rowKey={(r) => r.staffId ?? 'unassigned'}
              empty="No flock needs a supervisor today."
            />
          </Card>

          {(d.morning.vaccinesDue.length > 0 || d.morning.stockShortages.rows.length > 0 || d.morning.outletsNotOpened.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {d.morning.vaccinesDue.length > 0 && (
                <Card>
                  <SectionTitle sub="Due or overdue on today's age.">Vaccines</SectionTitle>
                  {d.morning.vaccinesDue.map((v, i) => (
                    <div key={i} style={{ padding: '6px 0', cursor: v.href ? 'pointer' : undefined }} onClick={v.href ? () => router.push(v.href!) : undefined}>
                      <Badge tone={v.severity === 'RED' ? 'expired' : 'renewal'}>{v.severity === 'RED' ? 'late' : 'due'}</Badge> <strong>{v.title}</strong>
                      <div className="ds-caption">{v.detail}</div>
                    </div>
                  ))}
                </Card>
              )}
              {d.morning.stockShortages.rows.length > 0 && (
                <Card>
                  <SectionTitle sub="Approved to issue, not in the store.">Shortages</SectionTitle>
                  {d.morning.stockShortages.rows.map((r, i) => (
                    <div key={i} className="ds-caption" style={{ padding: '4px 0' }}>
                      <strong>{r.description}</strong> — short {r.shortfallQty} {r.uom} of {r.requiredQty}
                    </div>
                  ))}
                </Card>
              )}
              {d.morning.outletsNotOpened.length > 0 && (
                <Card>
                  <SectionTitle sub="Active outlets with no day started.">Not opened</SectionTitle>
                  {d.morning.outletsNotOpened.map((o) => <div key={o.id} style={{ padding: '4px 0' }}>{o.name}</div>)}
                </Card>
              )}
            </div>
          )}
          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="Sheds at or past their pickup date — the loads to allocate before the lorries move.">
                Ready for pickup
              </SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'code', header: 'Batch', render: (r: any) => <span style={{ fontWeight: 600 }}>{r.code}</span> },
                { key: 'farm', header: 'Farm', render: (r: any) => r.farm.name },
                { key: 'expectedPickupDate', header: 'Due', sortable: true, render: (r: any) => fmtDate(r.expectedPickupDate) },
                { key: 'overdueDays', header: '', render: (r: any) => (r.overdueDays > 0 ? <Badge tone="expired">{r.overdueDays} days late</Badge> : <Badge tone="active">on time</Badge>) },
              ] as DataTableColumn<any>[]}
              rows={d.morning.readyForPickup}
              rowKey={(r) => r.batchId}
              onRowClick={(r) => router.push(`/poultry/batches/${r.batchId}`)}
              empty="No batch is ready today."
            />
          </Card>

          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Farms to inspect" value={String(d.morning.farmsToInspect)} hint="active batches with no entry today" onClick={() => router.push('/poultry/daily')} />
            <StatCard label="Outlets open" value={String(d.morning.outletsToOpen)} hint="days started" onClick={() => router.push('/poultry/stalls')} />
            <StatCard label="Requests waiting" value={String(d.morning.requestsWaiting)} hint="feed, medicine, vaccine" onClick={() => router.push('/poultry/field-ops')} />
          </div>

          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="Approved and not yet sent to the shed.">To issue</SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'reference', header: 'Request', render: (r: any) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
                { key: 'kind', header: 'For', render: (r: any) => r.kind },
                { key: 'batch', header: 'Batch', render: (r: any) => `${r.batch} · ${r.farm}` },
                { key: 'lines', header: 'Lines', align: 'right', render: (r: any) => String(r.lines) },
              ] as DataTableColumn<any>[]}
              rows={d.morning.approvedToIssue}
              rowKey={(r) => r.id}
              empty="Nothing approved and waiting."
            />
          </Card>
        </div>
      )}

      {phase === 'During the day' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Inspections" value={`${d.inFlight.inspectionsDone} done`} hint={`${d.inFlight.inspectionsOutstanding} outstanding`} />
            <StatCard label="Feed issued" value={String(d.inFlight.feedIssues)} hint={`${d.inFlight.feedReturns} returns`} />
            <StatCard label="Labour to verify" value={String(d.inFlight.labourToVerify.length)} hint="unverified work is unposted" />
          </div>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Mortality today" value={d.inFlight.mortalityToday.toLocaleString('en-IN')} hint="deaths and culls recorded" onClick={() => router.push('/poultry/daily')} />
            <StatCard label="Weights recorded" value={String(d.inFlight.weightsRecorded)} hint={`of ${d.inFlight.inspectionsDone} inspections`} />
            <StatCard label="Outlet receiving" value={`${d.inFlight.outletReceiving.kg} kg`} hint={`${d.inFlight.outletReceiving.receipts} receipt(s)`} onClick={() => router.push('/poultry/outlet-day')} />
            <StatCard label="Outlet sales" value={money(d.inFlight.outletSales.amountInr)} hint={`${d.inFlight.outletSales.kg} kg · ${d.inFlight.outletSales.sales} sale(s)`} />
            <StatCard
              label="Till cash movement"
              value={money(d.endOfDay.outlets.reduce((sum, o) => sum + o.cash.cashInInr - o.cash.cashOutInr, 0))}
              hint={`in ${money(d.endOfDay.outlets.reduce((sum, o) => sum + o.cash.cashInInr, 0))} · out ${money(d.endOfDay.outlets.reduce((sum, o) => sum + o.cash.cashOutInr, 0))}`}
            />
          </div>

          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="A load with no weighing groups has a net weight nobody can defend.">Loads today</SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'reference', header: 'Pickup', render: (r: any) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
                { key: 'batch', header: 'From', render: (r: any) => `${r.batch} · ${r.farm}` },
                { key: 'birds', header: 'Birds', align: 'right', render: (r: any) => r.birds.toLocaleString('en-IN') },
                { key: 'weightKg', header: 'Net', align: 'right', render: (r: any) => `${r.weightKg} kg` },
                { key: 'netInr', header: 'Value', align: 'right', render: (r: any) => money(r.netInr) },
                { key: 'weighed', header: '', render: (r: any) => (r.weighed ? <Badge tone="active">{r.weighingGroups} groups</Badge> : <Badge tone="expired">not weighed</Badge>) },
              ] as DataTableColumn<any>[]}
              rows={d.inFlight.pickups}
              rowKey={(r) => r.id}
              empty="No loads out today."
            />
          </Card>

          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="Nobody pays for work nobody confirmed — verification is what posts it.">Labour</SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'reference', header: 'Entry', render: (r: any) => r.reference },
                { key: 'work', header: 'Work', render: (r: any) => r.work },
                { key: 'quantity', header: 'Handled', align: 'right', render: (r: any) => `${r.quantity} ${r.uom}` },
                { key: 'amountInr', header: 'Amount', align: 'right', render: (r: any) => money(r.amountInr) },
              ] as DataTableColumn<any>[]}
              rows={d.inFlight.labourToVerify}
              rowKey={(r) => r.id}
              onRowClick={() => router.push('/poultry/field-ops')}
              empty="Nothing waiting to be verified."
            />
          </Card>
        </div>
      )}

      {phase === 'End of day' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="Expected cash is derived from the day's own transactions. Only the counted figure is entered, so a variance cannot be edited away.">
                Outlet tills
              </SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'stall', header: 'Outlet', render: (r: any) => <span style={{ fontWeight: 600 }}>{r.stall.name}</span> },
                { key: 'opening', header: 'Opening', align: 'right', render: (r: any) => money(r.cash.openingInr) },
                { key: 'in', header: 'Cash in', align: 'right', render: (r: any) => money(r.cash.cashInInr) },
                { key: 'out', header: 'Cash out', align: 'right', render: (r: any) => money(r.cash.cashOutInr) },
                { key: 'expected', header: 'Expected', align: 'right', render: (r: any) => <strong>{money(r.cash.expectedInr)}</strong> },
                { key: 'counted', header: 'Counted', align: 'right', render: (r: any) => (r.cash.countedInr === null ? <span className="ds-caption">not counted</span> : money(r.cash.countedInr)) },
                { key: 'variance', header: '', render: (r: any) => (
                  r.cash.varianceInr === null ? null
                    : r.cash.varianceInr === 0
                      ? <Badge tone="active">reconciles</Badge>
                      : <Badge tone="expired">{r.cash.short ? 'short' : 'over'} {money(Math.abs(r.cash.varianceInr))}</Badge>
                ) },
              ] as DataTableColumn<any>[]}
              rows={d.endOfDay.outlets}
              rowKey={(r) => r.id}
              onRowClick={() => router.push('/poultry/stalls')}
              empty="No outlet opened today."
            />
          </Card>

          <div className="ds-grid ds-grid-kpi">
            <StatCard
              label="Loads not weighed"
              value={String(d.endOfDay.unweighedPickups)}
              hint="the net weight has no evidence behind it"
              tone={d.endOfDay.unweighedPickups > 0 ? 'expired' : 'active'}
            />
            <StatCard label="Labour unverified" value={String(d.endOfDay.pendingLabour)} hint="unposted until somebody confirms it" />
          </div>

          <SectionTitle sub="Each figure is a reconciliation the day has to close against. Anything not zero is an open question, not a rounding.">Reconciliations</SectionTitle>
          <div className="ds-grid ds-grid-kpi">
            <StatCard
              label="Bird register"
              value={String(d.endOfDay.mortalityReconciliation.birdMismatches)}
              hint={`mismatches · ${d.endOfDay.mortalityReconciliation.deathsToday} deaths today · ${d.endOfDay.mortalityReconciliation.shedsWithoutEntry} shed(s) without an entry`}
              tone={d.endOfDay.mortalityReconciliation.birdMismatches > 0 ? 'expired' : 'active'}
            />
            <StatCard label="Feed movements" value={String(d.endOfDay.feedReconciliation.issues)} hint={`issues · ${d.endOfDay.feedReconciliation.returns} return(s)`} onClick={() => router.push('/poultry/field-ops')} />
            <StatCard
              label="Stock variances"
              value={String(d.endOfDay.stockVariances)}
              hint={`${d.endOfDay.stockReconciliation.itemsShort} item(s) short`}
              tone={d.endOfDay.stockVariances > 0 ? 'expired' : 'active'}
            />
            <StatCard
              label="Uninvoiced loads"
              value={String(d.endOfDay.uninvoicedLoads)}
              hint="left for a customer, not yet billed"
              tone={d.endOfDay.uninvoicedLoads > 0 ? 'expired' : 'active'}
              onClick={() => router.push('/poultry/dispatch-trail')}
            />
            <StatCard
              label="Receiving mismatches"
              value={String(d.endOfDay.receivingMismatches)}
              hint="dispatched and received disagree"
              tone={d.endOfDay.receivingMismatches > 0 ? 'expired' : 'active'}
              onClick={() => router.push('/poultry/dispatch-trail')}
            />
            <StatCard
              label="Unresolved approvals"
              value={String(d.endOfDay.unresolvedApprovals.total)}
              hint={`${d.endOfDay.unresolvedApprovals.expenses} expense · ${d.endOfDay.unresolvedApprovals.requests} request · ${d.endOfDay.unresolvedApprovals.settlements} settlement · ${d.endOfDay.unresolvedApprovals.labour} labour · ${d.endOfDay.unresolvedApprovals.approvals} other`}
              tone={d.endOfDay.unresolvedApprovals.total > 0 ? 'renewal' : 'active'}
            />
            {d.endOfDay.pendingReceivables && (
              <StatCard
                label="Receivables outstanding"
                value={money(Object.entries(d.endOfDay.pendingReceivables).filter(([k]) => /total|outstanding/i.test(k)).map(([, v]) => v)[0] ?? 0)}
                hint="from invoice-level ageing"
                onClick={() => router.push('/poultry/receivables')}
              />
            )}
          </div>

          <Card flush>
            <div style={{ padding: '14px 16px 0' }}>
              <SectionTitle sub="Counted closing stock against the closing stock the day's movements derive. An open day has not been counted yet.">Outlet stock</SectionTitle>
            </div>
            <DataTable
              columns={[
                { key: 'stall', header: 'Outlet', render: (r: any) => <span style={{ fontWeight: 600 }}>{r.stall.name}</span> },
                { key: 'openingKg', header: 'Opening', align: 'right', render: (r: any) => `${r.openingKg} kg` },
                { key: 'closingKg', header: 'Derived closing', align: 'right', render: (r: any) => r.closingKg === null ? <span className="ds-caption">day open</span> : `${r.closingKg} kg` },
                { key: 'countedKg', header: 'Counted', align: 'right', render: (r: any) => r.countedKg === null ? <span className="ds-caption">not counted</span> : `${r.countedKg} kg` },
                { key: 'varianceKg', header: '', render: (r: any) => r.varianceKg === null ? null : r.varianceKg === 0 ? <Badge tone="active">reconciles</Badge> : <Badge tone="expired">{r.varianceKg > 0 ? '+' : ''}{r.varianceKg} kg</Badge> },
              ] as DataTableColumn<any>[]}
              rows={d.endOfDay.outletStock}
              rowKey={(r) => r.id}
              onRowClick={() => router.push('/poultry/outlet-day')}
              empty="No outlet opened today."
            />
          </Card>
        </div>
      )}
    </div>
  );
}
