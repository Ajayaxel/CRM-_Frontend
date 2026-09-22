'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Badge, Card, DataTable, DataTableColumn, EmptyState, Segmented, SectionTitle, Skeleton,
  StatCard, humanStatus,
} from '../ui/kit';
import { Detail, DetailGrid, PERIODS, PageHead, StatusSelect, fmtDate, fmtDateTime, money, toDateInput } from '../ui/common';
import { BATCH_STATUSES, toneForBatchStatus, toneForStallDayStatus } from '../ui/tone';

const VIEWS = ['Daily', 'Monthly', 'Profitability', 'Performance', 'Reconciliation'];

export function PoultryReports() {
  const [view, setView] = useState('Daily');
  return (
    <div className="ds-page">
      <PageHead title="Reports" subtitle="The evening report, the month in one sheet, and batch-by-batch profitability" />
      <div style={{ marginBottom: 16 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>
      {view === 'Daily' && <DailyView />}
      {view === 'Monthly' && <MonthlyView />}
      {view === 'Profitability' && <ProfitabilityView />}
      {view === 'Performance' && <PerformanceView />}
      {view === 'Reconciliation' && <ReconciliationView />}
    </div>
  );
}

// ============================================================ Daily

interface DailyPayload {
  date: string;
  integration: {
    chicksPurchased: number; chickPurchaseInr: number; chicksPlaced: number;
    activeBatches: number; activeBirds: number;
    feedBags: number; feedInr: number;
    feedLoads: { ref: string; farm: string; batch: string; stage: string; bags: number; amountInr: number; supplier: string }[];
    medicineIssues: { item: string; qty: number; unit: string; amountInr: number }[];
    medicineInr: number; expensesInr: number;
    pickups: { ref: string; farm: string; batch: string; birds: number; weightKg: number; netInr: number }[];
    outputInr: number;
  };
  supply: {
    sales: { ref: string; party: string; weightKg: number; amountInr: number }[];
    salesInr: number;
    receipts: { ref: string; party: string; amountInr: number; mode: string }[];
    receiptsInr: number;
  };
  stall: {
    stall: string; status: string; openingStockKg: number; closingStockKg: number;
    salesInr: number; cashInr: number; bankInr: number; expensesInr: number;
    inwardKg: number; saleKg: number; wastageKg: number;
  }[];
  finance: {
    supplierPaymentsInr: number;
    supplierPayments: { ref: string; supplier: string; amountInr: number; mode: string }[];
    newLiabilitiesInr: number;
    cashBank: { name: string; code: string; balanceInr: number }[];
    totalCashBankInr: number;
  };
  management: {
    criticalAlerts: { type: string; title: string }[];
    warnings: number;
    pendingApprovals: number;
    unclosedStalls: number;
  };
}

interface DailyReport { id: string; date: string; generatedAt: string; payload: DailyPayload }

function DailyView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [date, setDate] = useState(toDateInput());

  const { data: report, isLoading } = useQuery({
    queryKey: ['py-report-daily', date],
    queryFn: async () => {
      try {
        return (await api.get<DailyReport>('/poultry/reports/daily', { params: { date } })).data;
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
        throw e;
      }
    },
  });

  const generate = useMutation({
    mutationFn: () => api.post(`/poultry/reports/daily/generate?date=${date}`),
    onSuccess: () => {
      toast.success('Report generated');
      qc.invalidateQueries({ queryKey: ['py-report-daily'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const p = report?.payload;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 170 }} type="date" value={date} aria-label="Report date" onChange={(e) => setDate(e.target.value)} />
        {report && <span className="ds-caption">Generated {fmtDateTime(report.generatedAt)}</span>}
        {report && canManage && (
          <button className="btn-secondary btn-sm" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? 'Generating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {isLoading && <Skeleton rows={3} height={92} />}

      {!isLoading && !report && (
        <Card>
          <EmptyState
            title="No report generated for that day"
            body="The evening report is a stored snapshot — generate it to freeze the day's figures."
            actionLabel={canManage ? (generate.isPending ? 'Generating…' : 'Generate now') : undefined}
            onAction={canManage ? () => generate.mutate() : undefined}
          />
        </Card>
      )}

      {p && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card>
            <SectionTitle sub="Chicks in, feed out, birds picked">Integration</SectionTitle>
            <DetailGrid>
              <Detail label="Chicks purchased" value={`${p.integration.chicksPurchased.toLocaleString('en-IN')} · ${money(p.integration.chickPurchaseInr)}`} />
              <Detail label="Chicks placed" value={p.integration.chicksPlaced.toLocaleString('en-IN')} />
              <Detail label="Active batches" value={`${p.integration.activeBatches} · ${p.integration.activeBirds.toLocaleString('en-IN')} birds`} />
              <Detail label="Feed" value={`${p.integration.feedBags} bags · ${money(p.integration.feedInr)}`} />
              <Detail label="Medicine issued" value={money(p.integration.medicineInr)} />
              <Detail label="Farm expenses" value={money(p.integration.expensesInr)} />
              <Detail label="Output" value={<strong>{money(p.integration.outputInr)}</strong>} />
            </DetailGrid>
            {p.integration.feedLoads.length > 0 && (
              <>
                <SectionTitle sub="Loads dispatched today">Feed loads</SectionTitle>
                <Card flush>
                  <DataTable
                    rows={p.integration.feedLoads}
                    columns={[
                      { key: 'ref', header: 'Ref', width: 90, render: (r) => <span style={{ fontWeight: 600 }}>{r.ref}</span> },
                      { key: 'farm', header: 'Farm', render: (r) => `${r.farm} · ${r.batch}` },
                      { key: 'stage', header: 'Stage', width: 110, render: (r) => humanStatus(r.stage) },
                      { key: 'bags', header: 'Bags', align: 'right', width: 70 },
                      { key: 'amountInr', header: 'Amount', align: 'right', width: 100, render: (r) => money(r.amountInr) },
                      { key: 'supplier', header: 'Supplier', render: (r) => r.supplier },
                    ] as DataTableColumn<DailyPayload['integration']['feedLoads'][number]>[]}
                    rowKey={(r) => r.ref}
                    dense
                  />
                </Card>
              </>
            )}
            {p.integration.pickups.length > 0 && (
              <>
                <SectionTitle sub="Birds out of the sheds today">Pickups</SectionTitle>
                <Card flush>
                  <DataTable
                    rows={p.integration.pickups}
                    columns={[
                      { key: 'ref', header: 'Ref', width: 90, render: (r) => <span style={{ fontWeight: 600 }}>{r.ref}</span> },
                      { key: 'farm', header: 'Farm', render: (r) => `${r.farm} · ${r.batch}` },
                      { key: 'birds', header: 'Birds', align: 'right', width: 80, render: (r) => r.birds.toLocaleString('en-IN') },
                      { key: 'weightKg', header: 'Kg', align: 'right', width: 80, render: (r) => r.weightKg.toLocaleString('en-IN') },
                      { key: 'netInr', header: 'Net', align: 'right', width: 100, render: (r) => money(r.netInr) },
                    ] as DataTableColumn<DailyPayload['integration']['pickups'][number]>[]}
                    rowKey={(r) => r.ref}
                    dense
                  />
                </Card>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle sub={`Billed ${money(p.supply.salesInr)} · received ${money(p.supply.receiptsInr)}`}>Supply</SectionTitle>
            {p.supply.sales.length > 0 && (
              <Card flush>
                <DataTable
                  rows={p.supply.sales}
                  columns={[
                    { key: 'ref', header: 'Ref', width: 90, render: (r) => <span style={{ fontWeight: 600 }}>{r.ref}</span> },
                    { key: 'party', header: 'Party', render: (r) => r.party },
                    { key: 'weightKg', header: 'Kg', align: 'right', width: 80, render: (r) => r.weightKg.toLocaleString('en-IN') },
                    { key: 'amountInr', header: 'Amount', align: 'right', width: 100, render: (r) => money(r.amountInr) },
                  ] as DataTableColumn<DailyPayload['supply']['sales'][number]>[]}
                  rowKey={(r) => r.ref}
                  dense
                />
              </Card>
            )}
            {p.supply.receipts.length > 0 && (
              <Card flush>
                <DataTable
                  rows={p.supply.receipts}
                  columns={[
                    { key: 'ref', header: 'Ref', width: 90, render: (r) => <span style={{ fontWeight: 600 }}>{r.ref}</span> },
                    { key: 'party', header: 'Party', render: (r) => r.party },
                    { key: 'mode', header: 'Mode', width: 90, render: (r) => humanStatus(r.mode) },
                    { key: 'amountInr', header: 'Amount', align: 'right', width: 100, render: (r) => money(r.amountInr) },
                  ] as DataTableColumn<DailyPayload['supply']['receipts'][number]>[]}
                  rowKey={(r) => r.ref}
                  dense
                />
              </Card>
            )}
            {p.supply.sales.length === 0 && p.supply.receipts.length === 0 && (
              <div className="ds-caption">No party movement today.</div>
            )}
          </Card>

          <Card>
            <SectionTitle sub="Each stall's day at a glance">Stall</SectionTitle>
            {p.stall.length === 0 ? (
              <div className="ds-caption">No stall days for this date.</div>
            ) : (
              <Card flush>
                <DataTable
                  rows={p.stall}
                  columns={[
                    { key: 'stall', header: 'Stall', render: (r) => <span style={{ fontWeight: 600 }}>{r.stall}</span> },
                    { key: 'status', header: 'Status', width: 110, render: (r) => <Badge tone={toneForStallDayStatus(r.status)}>{humanStatus(r.status)}</Badge> },
                    { key: 'openingStockKg', header: 'Opening kg', align: 'right', width: 95 },
                    { key: 'saleKg', header: 'Sold kg', align: 'right', width: 85 },
                    { key: 'wastageKg', header: 'Wastage kg', align: 'right', width: 95 },
                    { key: 'closingStockKg', header: 'Closing kg', align: 'right', width: 95 },
                    { key: 'salesInr', header: 'Sales', align: 'right', width: 100, render: (r) => money(r.salesInr) },
                    { key: 'expensesInr', header: 'Expenses', align: 'right', width: 100, render: (r) => money(r.expensesInr) },
                  ] as DataTableColumn<DailyPayload['stall'][number]>[]}
                  rowKey={(r) => r.stall}
                  dense
                />
              </Card>
            )}
          </Card>

          <Card>
            <SectionTitle sub="Money moved and where it stands">Finance</SectionTitle>
            <DetailGrid>
              <Detail label="Supplier payments" value={money(p.finance.supplierPaymentsInr)} />
              <Detail label="New liabilities" value={money(p.finance.newLiabilitiesInr)} />
              <Detail label="Cash & bank" value={<strong>{money(p.finance.totalCashBankInr)}</strong>} />
              {p.finance.cashBank.map((a) => (
                <Detail key={a.code} label={`${a.name} (${a.code})`} value={money(a.balanceInr)} />
              ))}
            </DetailGrid>
            {p.finance.supplierPayments.length > 0 && (
              <Card flush>
                <DataTable
                  rows={p.finance.supplierPayments}
                  columns={[
                    { key: 'ref', header: 'Ref', width: 90, render: (r) => <span style={{ fontWeight: 600 }}>{r.ref}</span> },
                    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier },
                    { key: 'mode', header: 'Mode', width: 90, render: (r) => humanStatus(r.mode) },
                    { key: 'amountInr', header: 'Amount', align: 'right', width: 100, render: (r) => money(r.amountInr) },
                  ] as DataTableColumn<DailyPayload['finance']['supplierPayments'][number]>[]}
                  rowKey={(r) => r.ref}
                  dense
                />
              </Card>
            )}
          </Card>

          <Card>
            <SectionTitle sub="What needs the owner's attention">Management</SectionTitle>
            <DetailGrid>
              <Detail label="Warnings" value={p.management.warnings} />
              <Detail label="Pending approvals" value={p.management.pendingApprovals} />
              <Detail label="Unclosed stalls" value={p.management.unclosedStalls} />
            </DetailGrid>
            {p.management.criticalAlerts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {p.management.criticalAlerts.map((a, i) => (
                  <div key={`${a.type}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Badge tone="expired" dot>CRITICAL</Badge>
                    <span style={{ fontSize: 13 }}>{a.title}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================ Monthly

interface MonthlyData {
  window: { from: string; to: string; label: string };
  integration: {
    chickPurchases: number; chickPurchaseInr: number; placements: number;
    feedBags: number; feedPurchaseInr: number;
    medicinePurchaseInr: number; medicineConsumedInr: number;
    farmExpensesInr: number; birdsPicked: number; weightPickedKg: number;
    outputInr: number; grossMarginInr: number;
  };
  supply: { salesInr: number; suppliedKg: number; receiptsInr: number };
  stall: { salesInr: number; soldKg: number; expensesInr: number };
  finance: {
    expensesByScope: Record<string, number>;
    supplierPaymentsInr: number;
    supplierOutstandingInr: number;
    cashBankInr: number;
  };
}

function MonthlyView() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(thisMonth);
  const [period, setPeriod] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['py-report-monthly', month, period],
    queryFn: async () => (await api.get<MonthlyData>('/poultry/reports/monthly', {
      params: period ? { period } : { month },
    })).data,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input
          className="input" style={{ maxWidth: 180 }} type="month" value={month} aria-label="Month"
          onChange={(e) => { setMonth(e.target.value); setPeriod(''); }}
        />
        <select
          className="input" style={{ maxWidth: 170 }} value={period} aria-label="Period"
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="">By month</option>
          {PERIODS.filter((p) => p.key !== 'custom').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {data && <span className="ds-caption">{data.window.label} · {fmtDate(data.window.from)} – {fmtDate(data.window.to)}</span>}
      </div>

      {isLoading && <Skeleton rows={3} height={92} />}

      {data && (
        <div>
          <SectionTitle sub="Chicks placed, feed burnt, birds sold">Integration</SectionTitle>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Chick purchases" value={data.integration.chickPurchases.toLocaleString('en-IN')} hint={money(data.integration.chickPurchaseInr)} />
            <StatCard label="Placements" value={data.integration.placements.toLocaleString('en-IN')} />
            <StatCard label="Feed" value={`${data.integration.feedBags.toLocaleString('en-IN')} bags`} hint={money(data.integration.feedPurchaseInr)} />
            <StatCard label="Medicine consumed" value={money(data.integration.medicineConsumedInr)} hint={`purchased ${money(data.integration.medicinePurchaseInr)}`} />
            <StatCard label="Farm expenses" value={money(data.integration.farmExpensesInr)} />
            <StatCard label="Birds picked" value={data.integration.birdsPicked.toLocaleString('en-IN')} hint={`${Math.round(data.integration.weightPickedKg).toLocaleString('en-IN')} kg`} />
            <StatCard label="Output" value={money(data.integration.outputInr)} tone="active" />
            <StatCard label="Gross margin" value={money(data.integration.grossMarginInr)} tone={data.integration.grossMarginInr >= 0 ? 'active' : 'expired'} />
          </div>

          <SectionTitle sub="The party channel">Supply</SectionTitle>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Supply sales" value={money(data.supply.salesInr)} hint={`${data.supply.suppliedKg.toLocaleString('en-IN')} kg`} />
            <StatCard label="Receipts" value={money(data.supply.receiptsInr)} tone="active" />
          </div>

          <SectionTitle sub="The retail channel">Stall</SectionTitle>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Stall sales" value={money(data.stall.salesInr)} hint={`${data.stall.soldKg.toLocaleString('en-IN')} kg sold`} />
            <StatCard label="Stall expenses" value={money(data.stall.expensesInr)} />
          </div>

          <SectionTitle sub="Spend by scope, dues and the drawer">Finance</SectionTitle>
          <div className="ds-grid ds-grid-kpi">
            {Object.entries(data.finance.expensesByScope).map(([scope, amount]) => (
              <StatCard key={scope} label={`${humanStatus(scope)} expenses`} value={money(amount)} />
            ))}
            <StatCard label="Supplier payments" value={money(data.finance.supplierPaymentsInr)} />
            <StatCard label="Supplier outstanding" value={money(data.finance.supplierOutstandingInr)} tone="claim" />
            <StatCard label="Cash & bank" value={money(data.finance.cashBankInr)} tone="active" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ Profitability

interface ProfitRow {
  batchId: string; code: string; farm: string; status: string; placementDate: string; birds: number;
  chickCostInr: number; feedCostInr: number; feedBags: number; medicineCostInr: number;
  directExpenseInr: number; allocatedExpenseInr: number; supervisionInr: number; totalCostInr: number;
  grossOutputInr: number; deductionsInr: number; outputInr: number; profitInr: number;
  birdsPicked: number; weightPickedKg: number; costPerBirdInr: number;
}

function ProfitabilityView() {
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['py-report-profitability', status],
    queryFn: async () => (await api.get<ProfitRow[]>('/poultry/reports/profitability', {
      params: status ? { status } : {},
    })).data,
  });

  const columns: DataTableColumn<ProfitRow>[] = [
    { key: 'code', header: 'Batch', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.code}</span> },
    { key: 'farm', header: 'Farm', width: 150, render: (r) => r.farm },
    { key: 'status', header: 'Status', width: 120, render: (r) => <Badge tone={toneForBatchStatus(r.status)}>{humanStatus(r.status)}</Badge> },
    { key: 'placementDate', header: 'Placed', width: 110, render: (r) => fmtDate(r.placementDate) },
    { key: 'birds', header: 'Birds', align: 'right', width: 90, render: (r) => r.birds.toLocaleString('en-IN') },
    { key: 'chickCostInr', header: 'Chicks', align: 'right', width: 100, render: (r) => money(r.chickCostInr) },
    { key: 'feedCostInr', header: 'Feed', align: 'right', width: 100, render: (r) => money(r.feedCostInr) },
    { key: 'medicineCostInr', header: 'Medicine', align: 'right', width: 100, render: (r) => money(r.medicineCostInr) },
    { key: 'directExpenseInr', header: 'Direct', align: 'right', width: 100, render: (r) => money(r.directExpenseInr) },
    { key: 'allocatedExpenseInr', header: 'Allocated', align: 'right', width: 100, render: (r) => money(r.allocatedExpenseInr) },
    { key: 'supervisionInr', header: 'Supervision', align: 'right', width: 100, render: (r) => money(r.supervisionInr) },
    { key: 'totalCostInr', header: 'Total cost', align: 'right', width: 110, render: (r) => <strong>{money(r.totalCostInr)}</strong> },
    { key: 'outputInr', header: 'Output', align: 'right', width: 110, render: (r) => money(r.outputInr) },
    { key: 'profitInr', header: 'Profit', align: 'right', width: 110, render: (r) => (
      <strong style={{ color: r.profitInr >= 0 ? 'var(--tone-active)' : 'var(--tone-expired)' }}>{money(r.profitInr)}</strong>
    ) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <StatusSelect value={status} onChange={setStatus} options={BATCH_STATUSES as unknown as string[]} />
        <a className="btn-secondary" style={{ marginLeft: 'auto' }} href="/api/poultry/reports/profitability.csv">Export CSV</a>
      </div>
      <Card flush>
        <DataTable
          rows={data ?? []}
          columns={columns}
          rowKey={(r) => r.batchId}
          loading={isLoading}
          dense
          empty={<EmptyState title="No batches" body="Batch profitability appears once batches are placed." compact />}
        />
      </Card>
    </div>
  );
}

// ============================================================ Performance

interface PerformanceGroup {
  group: string; batches: number; chicks: number; mortality: number; mortalityPct: number;
  feedBags: number; fcr: number | null; weightKg: number;
  revenueInr: number; costInr: number; profitInr: number;
}

interface PerformanceData {
  window: { from: string; to: string; label: string };
  groupBy: string;
  groups: PerformanceGroup[];
  batches: unknown[];
}

const PERFORMANCE_KINDS = ['farm', 'region', 'batch'] as const;

function PerformanceView() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(thisMonth);
  const [kind, setKind] = useState<string>('farm');

  const { data, isLoading } = useQuery({
    queryKey: ['py-report-performance', month, kind],
    queryFn: async () => (await api.get<PerformanceData>('/poultry/reports/performance', {
      params: { ...(month ? { month } : {}), kind },
    })).data,
  });

  const columns: DataTableColumn<PerformanceGroup>[] = [
    { key: 'group', header: 'Group', render: (r) => <span style={{ fontWeight: 600 }}>{r.group}</span> },
    { key: 'batches', header: 'Batches', align: 'right', width: 80 },
    { key: 'chicks', header: 'Chicks', align: 'right', width: 90, render: (r) => r.chicks.toLocaleString('en-IN') },
    { key: 'mortality', header: 'Mortality', align: 'right', width: 110, render: (r) => `${r.mortality.toLocaleString('en-IN')} (${r.mortalityPct}%)` },
    { key: 'feedBags', header: 'Feed bags', align: 'right', width: 90, render: (r) => r.feedBags.toLocaleString('en-IN') },
    { key: 'fcr', header: 'FCR', align: 'right', width: 70, render: (r) => (r.fcr != null ? r.fcr : '—') },
    { key: 'weightKg', header: 'Kg', align: 'right', width: 90, render: (r) => r.weightKg.toLocaleString('en-IN') },
    { key: 'revenueInr', header: 'Revenue', align: 'right', width: 110, render: (r) => money(r.revenueInr) },
    { key: 'costInr', header: 'Cost', align: 'right', width: 110, render: (r) => money(r.costInr) },
    { key: 'profitInr', header: 'Profit', align: 'right', width: 110, render: (r) => (
      <strong style={{ color: r.profitInr >= 0 ? 'var(--tone-active)' : 'var(--tone-expired)' }}>{money(r.profitInr)}</strong>
    ) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input
          className="input" style={{ maxWidth: 180 }} type="month" value={month} aria-label="Month"
          onChange={(e) => setMonth(e.target.value)}
        />
        <select
          className="input" style={{ maxWidth: 150 }} value={kind} aria-label="Group by"
          onChange={(e) => setKind(e.target.value)}
        >
          {PERFORMANCE_KINDS.map((k) => <option key={k} value={k}>By {k}</option>)}
        </select>
        {data && <span className="ds-caption">{data.window.label} · {fmtDate(data.window.from)} – {fmtDate(data.window.to)}</span>}
      </div>
      <Card flush>
        <DataTable
          rows={data?.groups ?? []}
          columns={columns}
          rowKey={(r) => r.group}
          loading={isLoading}
          dense
          empty={<EmptyState title="No activity in the window" body="Performance appears once batches run in the chosen month." compact />}
        />
      </Card>
    </div>
  );
}

// ============================================================ Reconciliation

interface ReconBirdRow {
  batch: string; farm: string; status: string; placed: number; mortality: number;
  adjustments: number; picked: number; balance: number; consistent: boolean;
}

interface ReconException { area: string; entity: string; detail: string }

interface ReconciliationData {
  birds: ReconBirdRow[];
  suppliers: unknown;
  parties: unknown;
  cashBank: unknown;
  exceptions: ReconException[];
  clean: boolean;
}

function ReconciliationView() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['py-report-reconciliation'],
    queryFn: async () => (await api.get<ReconciliationData>('/poultry/reports/reconciliation')).data,
  });

  const columns: DataTableColumn<ReconBirdRow>[] = [
    { key: 'batch', header: 'Batch', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.batch}</span> },
    { key: 'farm', header: 'Farm', render: (r) => r.farm },
    { key: 'status', header: 'Status', width: 120, render: (r) => <Badge tone={toneForBatchStatus(r.status)}>{humanStatus(r.status)}</Badge> },
    { key: 'placed', header: 'Placed', align: 'right', width: 90, render: (r) => r.placed.toLocaleString('en-IN') },
    { key: 'mortality', header: 'Mortality', align: 'right', width: 90, render: (r) => r.mortality.toLocaleString('en-IN') },
    { key: 'adjustments', header: 'Adjustments', align: 'right', width: 100, render: (r) => r.adjustments.toLocaleString('en-IN') },
    { key: 'picked', header: 'Picked', align: 'right', width: 90, render: (r) => r.picked.toLocaleString('en-IN') },
    { key: 'balance', header: 'Balance', align: 'right', width: 90, render: (r) => r.balance.toLocaleString('en-IN') },
    { key: 'consistent', header: 'Check', width: 110, render: (r) => (
      <Badge tone={r.consistent ? 'active' : 'expired'}>{r.consistent ? 'OK' : 'MISMATCH'}</Badge>
    ) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button className="btn-secondary btn-sm" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? 'Checking…' : 'Re-run checks'}
        </button>
      </div>

      {isLoading && <Skeleton rows={3} height={92} />}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.clean ? (
            <Card>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Badge tone="active" dot>CLEAN</Badge>
                <span style={{ fontSize: 13 }}>Every register reconciles to its sources.</span>
              </div>
            </Card>
          ) : (
            data.exceptions.map((x, i) => (
              <Card key={`${x.area}-${x.entity}-${i}`}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge tone="expired" dot>{humanStatus(x.area)}</Badge>
                  <span style={{ fontWeight: 650 }}>{x.entity}</span>
                  <span style={{ fontSize: 13 }}>{x.detail}</span>
                </div>
              </Card>
            ))
          )}

          <div>
            <SectionTitle sub="Placed − mortality ± adjustments − picked, per batch">Bird register</SectionTitle>
            <Card flush>
              <DataTable
                rows={data.birds}
                columns={columns}
                rowKey={(r) => r.batch}
                dense
                empty={<EmptyState title="No batches" body="The bird register fills as batches are placed." compact />}
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
