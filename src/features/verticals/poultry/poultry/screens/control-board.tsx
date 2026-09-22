'use client';

/**
 * The management control board.
 *
 * The exception board answers "what is wrong". This answers "what is the
 * state" — every active shed in one row, plus the money the operation is owed
 * and the honest coverage of the profitability figures.
 *
 * Every number here is derived from the same registers the exceptions read, so
 * the two views can never disagree. Nothing on this screen is stored to make
 * it faster.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bird, Landmark, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, DataTable, SectionTitle, Segmented, Skeleton, StatCard, type DataTableColumn, type Tone } from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';

interface ControlRow {
  batchId: string; code: string; breed: string | null; phase: string; ageDays: number;
  farm: { id: string; code: string; name: string };
  expectedPickupDate: string;
  birds: { placed: number; died: number; picked: number; live: number; mortalityPct: number; impossible: boolean };
  weight: {
    lastWeighedOn: string | null; avgWeightGrams: number | null;
    targetWeightGrams: number | null; variancePct: number | null; daysSinceWeighed: number | null;
  };
  feed: { bagsIssued: number; bagsReturned: number; bagsConsumed: number; consumedKg: number; expectedBags: number; varianceBags: number };
  fcr: number | null; fcrBasis: string | null;
  output: { soldKg: number; revenueInr: number };
}

interface Board {
  date: string;
  rows: ControlRow[];
  totals: {
    activeBatches: number; liveBirds: number; placedBirds: number; deadBirds: number;
    mortalityPct: number; bagsConsumed: number; notWeighedToday: number; readyForSale: number;
  };
}

interface Receivable {
  partyId: string; code: string; name: string; paymentTermsDays: number; interCompany: boolean;
  salesInr: number; receiptsInr: number; outstandingInr: number; invoices: number;
  lastReceiptOn: string | null; oldestDays: number; overdue: boolean; daysPastTerms: number;
}

interface Receivables {
  rows: Receivable[];
  totals: { outstandingInr: number; overdueInr: number; interCompanyInr: number; partiesOverdue: number };
  note: string;
}

interface Coverage {
  rows: { farmId: string; code: string; name: string; tagged: boolean; revenueInr: number; expenseInr: number; profitInr: number }[];
  totals: { revenueInr: number; expenseInr: number; profitInr: number };
  coverage: { farmsWithoutCentre: number; untaggedExpenseInr: number; taggedSharePct: number };
  source: string;
}

const VIEWS = ['Sheds', 'Receivables', 'Farm P&L'];

const phaseTone = (p: string): Tone =>
  p === 'READY_FOR_SALE' ? 'renewal' : p === 'CLOSING' ? 'info' : p === 'CLOSED' ? 'neutral' : 'active';

export function ControlBoardScreen() {
  const router = useRouter();
  const [view, setView] = useState(VIEWS[0]);

  const board = useQuery({
    queryKey: ['py', 'control-board'],
    queryFn: async () => (await api.get<Board>('/poultry/control-board')).data,
    refetchInterval: 180_000,
  });
  const receivables = useQuery({
    queryKey: ['py', 'receivables'],
    queryFn: async () => (await api.get<Receivables>('/poultry/receivables')).data,
    enabled: view === 'Receivables',
  });
  const coverage = useQuery({
    queryKey: ['py', 'profit-coverage'],
    queryFn: async () => (await api.get<Coverage>('/poultry/farm-profitability/coverage')).data,
    enabled: view === 'Farm P&L',
  });

  const t = board.data?.totals;

  const columns: DataTableColumn<ControlRow>[] = [
    {
      key: 'farm', header: 'Shed', sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.farm.name}</div>
          <div className="ds-caption">{r.code}{r.breed ? ` · ${r.breed}` : ''}</div>
        </div>
      ),
    },
    { key: 'ageDays', header: 'Day', align: 'right', sortable: true, render: (r) => String(r.ageDays) },
    {
      key: 'live', header: 'Live birds', align: 'right', sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontVariantNumeric: 'tabular-nums', color: r.birds.impossible ? 'var(--tone-expired)' : undefined }}>
            {r.birds.live.toLocaleString('en-IN')}
          </div>
          <div className="ds-caption">of {r.birds.placed.toLocaleString('en-IN')} placed</div>
        </div>
      ),
    },
    {
      key: 'mortalityPct', header: 'Mortality', align: 'right', sortable: true,
      render: (r) => (
        <span style={{ color: r.birds.mortalityPct >= 5 ? 'var(--tone-expired)' : r.birds.mortalityPct >= 3 ? 'var(--tone-renewal)' : undefined }}>
          {r.birds.mortalityPct}%
        </span>
      ),
    },
    {
      key: 'weight', header: 'Weight vs target', align: 'right', sortable: true,
      render: (r) => {
        if (r.weight.avgWeightGrams === null) return <span className="ds-caption">never weighed</span>;
        return (
          <div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>{r.weight.avgWeightGrams} g</div>
            <div
              className="ds-caption"
              style={{ color: (r.weight.variancePct ?? 0) <= -7 ? 'var(--tone-expired)' : undefined }}
            >
              {r.weight.targetWeightGrams === null
                ? 'no standard'
                : `${(r.weight.variancePct ?? 0) > 0 ? '+' : ''}${r.weight.variancePct}% vs ${r.weight.targetWeightGrams} g`}
            </div>
          </div>
        );
      },
    },
    {
      key: 'feed', header: 'Feed vs plan', align: 'right', sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{r.feed.bagsConsumed} bags</div>
          <div className="ds-caption">
            {r.feed.expectedBags > 0
              ? `${r.feed.varianceBags > 0 ? '+' : ''}${r.feed.varianceBags} vs ${r.feed.expectedBags} planned`
              : 'no plan'}
            {r.feed.bagsReturned > 0 ? ` · ${r.feed.bagsReturned} returned` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'fcr', header: 'FCR', align: 'right', sortable: true,
      render: (r) => (
        r.fcr === null ? <span className="ds-caption">—</span> : (
          <div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>{r.fcr}</div>
            <div className="ds-caption">{r.fcrBasis === 'SALE_WEIGHT' ? 'on sale weight' : 'live weight'}</div>
          </div>
        )
      ),
    },
    {
      key: 'phase', header: '', render: (r) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {r.birds.impossible && <Badge tone="expired">register</Badge>}
          {(r.weight.daysSinceWeighed ?? 99) >= 2 && <Badge tone="renewal">{r.weight.daysSinceWeighed}d unweighed</Badge>}
          <Badge tone={phaseTone(r.phase)}>{r.phase.replace(/_/g, ' ').toLowerCase()}</Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Control board"
        subtitle="The operating state of every shed, and the money behind it. Read from the same registers the exception board uses — nothing here is stored to make it faster."
        actions={<button className="btn-secondary" onClick={() => router.push('/poultry/daily-task')}>Exceptions</button>}
      />

      {board.isLoading || !t ? <Skeleton rows={3} height={92} /> : (
        <div className="ds-grid ds-grid-kpi">
          <StatCard label="Live birds" value={t.liveBirds.toLocaleString('en-IN')} hint={`${t.activeBatches} cycles running`} />
          <StatCard
            label="Mortality"
            value={`${t.mortalityPct}%`}
            hint={`${t.deadBirds.toLocaleString('en-IN')} of ${t.placedBirds.toLocaleString('en-IN')} placed`}
            tone={t.mortalityPct >= 5 ? 'expired' : t.mortalityPct >= 3 ? 'renewal' : 'active'}
          />
          <StatCard label="Ready for sale" value={String(t.readyForSale)} hint="loads to allocate" />
          <StatCard
            label="Not weighed today"
            value={String(t.notWeighedToday)}
            hint="sheds with no weight recorded"
            tone={t.notWeighedToday > 0 ? 'renewal' : 'active'}
          />
        </div>
      )}

      <div style={{ margin: '18px 0 14px' }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>

      {view === 'Sheds' && (board.isLoading ? <Skeleton rows={4} /> : (
        <Card flush>
          <DataTable
            columns={columns}
            rows={board.data?.rows ?? []}
            rowKey={(r) => r.batchId}
            onRowClick={(r) => router.push(`/poultry/daily?batch=${r.batchId}`)}
            empty="No cycle is running."
          />
          <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
            Live birds are placed − dead − picked, feed is issued − returned, and the target comes from the
            performance standard for that bird. FCR is on sale weight once there is sale weight, and on live
            weight before that — the basis is stated because the two are not the same number.
          </p>
        </Card>
      ))}

      {view === 'Receivables' && (receivables.isLoading ? <Skeleton rows={4} /> : (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Outstanding" value={money(receivables.data?.totals.outstandingInr ?? 0)} hint="invoiced and not collected" />
            <StatCard
              label="Past terms"
              value={money(receivables.data?.totals.overdueInr ?? 0)}
              hint={`${receivables.data?.totals.partiesOverdue ?? 0} parties`}
              tone={(receivables.data?.totals.overdueInr ?? 0) > 0 ? 'expired' : 'active'}
            />
            <StatCard
              label="Owed by group companies"
              value={money(receivables.data?.totals.interCompanyInr ?? 0)}
              hint="real here; eliminated only at group level"
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Card flush>
              <DataTable
                columns={[
                  { key: 'name', header: 'Party', sortable: true, render: (r: Receivable) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div className="ds-caption">
                        {r.code} · {r.paymentTermsDays > 0 ? `${r.paymentTermsDays}-day terms` : 'no agreed terms'}
                        {r.interCompany ? ' · group company' : ''}
                      </div>
                    </div>
                  ) },
                  { key: 'salesInr', header: 'Invoiced', align: 'right', sortable: true, render: (r: Receivable) => money(r.salesInr) },
                  { key: 'receiptsInr', header: 'Collected', align: 'right', sortable: true, render: (r: Receivable) => money(r.receiptsInr) },
                  { key: 'outstandingInr', header: 'Outstanding', align: 'right', sortable: true, render: (r: Receivable) => <strong>{money(r.outstandingInr)}</strong> },
                  { key: 'lastReceiptOn', header: 'Last paid', sortable: true, render: (r: Receivable) => fmtDate(r.lastReceiptOn) },
                  { key: 'overdue', header: '', render: (r: Receivable) => (
                    r.overdue
                      ? <Badge tone="expired">{r.daysPastTerms}d past terms</Badge>
                      : r.outstandingInr > 0
                        ? <Badge tone="info">within terms</Badge>
                        : <Badge tone="active">clear</Badge>
                  ) },
                ] as DataTableColumn<Receivable>[]}
                rows={receivables.data?.rows ?? []}
                rowKey={(r) => r.partyId}
                onRowClick={() => router.push('/poultry/parties')}
                empty="Nobody owes anything."
              />
              <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
                {receivables.data?.note}
              </p>
            </Card>
          </div>
        </>
      ))}

      {view === 'Farm P&L' && (coverage.isLoading ? <Skeleton rows={4} /> : (
        <>
          {(coverage.data?.coverage.untaggedExpenseInr ?? 0) > 0 && (
            <Card tone="renewal">
              <SectionTitle sub="Cost that reached the ledger without a cost centre is not in any row below. Spreading it silently would make every farm look worse by an amount nobody chose.">
                <AlertTriangle size={15} style={{ verticalAlign: -2 }} />{' '}
                These rows explain {coverage.data!.coverage.taggedSharePct}% of company cost
              </SectionTitle>
              <p className="ds-caption">
                {money(coverage.data!.coverage.untaggedExpenseInr)} untagged
                {coverage.data!.coverage.farmsWithoutCentre > 0
                  ? ` · ${coverage.data!.coverage.farmsWithoutCentre} farm(s) carry no cost centre at all`
                  : ''}
              </p>
            </Card>
          )}
          <div style={{ marginTop: 16 }}>
            <Card flush>
              <DataTable
                columns={[
                  { key: 'name', header: 'Farm', sortable: true, render: (r: any) => (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Landmark size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div className="ds-caption">{r.code}</div>
                      </div>
                    </div>
                  ) },
                  { key: 'revenueInr', header: 'Revenue', align: 'right', sortable: true, render: (r: any) => money(r.revenueInr) },
                  { key: 'expenseInr', header: 'Cost', align: 'right', sortable: true, render: (r: any) => money(r.expenseInr) },
                  { key: 'profitInr', header: 'Profit', align: 'right', sortable: true, render: (r: any) => (
                    <span style={{ fontWeight: 600, color: r.profitInr < 0 ? 'var(--tone-expired)' : undefined }}>{money(r.profitInr)}</span>
                  ) },
                  { key: 'tagged', header: '', render: (r: any) => (r.tagged ? null : <Badge tone="renewal">no cost centre</Badge>) },
                ] as DataTableColumn<any>[]}
                rows={coverage.data?.rows ?? []}
                rowKey={(r) => r.farmId}
                empty="No farm carries a cost centre yet."
              />
              <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
                {coverage.data?.source} Open a cycle to see its cost sheet reconciled against these ledger figures
                component by component.
              </p>
            </Card>
          </div>
        </>
      ))}
    </div>
  );
}

export const ControlBoardIcon = Bird;
export const ReceivablesIcon = Wallet;
