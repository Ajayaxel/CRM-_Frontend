'use client';

/**
 * Farm cycle closing — the financial climax of a cycle.
 *
 * Closing is where a cycle stops being correctable, so the screen leads with
 * what is WRONG rather than with the profit figure. Every number shown is the
 * one the server will freeze, computed from the same consumption module that
 * feeds FCR, the cost sheet and the grower's settlement.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Badge, Card, Field, SectionTitle, Skeleton, StatCard } from '../ui/kit';
import { PageHead, money } from '../ui/common';

interface Readiness {
  batch: { id: string; code: string; status: string; farm: { id: string; name: string } };
  canClose: boolean;
  blockers: { kind: string; detail: string }[];
  warnings: { kind: string; detail: string }[];
  production: {
    initialBirds: number; mortalityBirds: number; mortalityPct: number;
    birdsSold: number; saleWeightKg: number; avgSaleWeightKg: number;
  };
  consumption: {
    feedBagsIssued: number; feedBagsReturned: number; feedBagsConsumed: number;
    feedConsumedKg: number; kgPerBag: number;
    medicineIssuedInr: number; medicineReturnedInr: number; medicineConsumedInr: number;
  };
  performance: { fcr: number | null; plannedFcr: number; fcrVariance: number | null; mortalityPct: number; avgWeightKg: number };
  settlement: { id: string; reference: string; status: string; fcr: number | null; netInr: number; feedBagsConsumed: number } | null;
  financial: {
    revenueInr: number; chickCostInr: number; feedCostInr: number; medicineCostInr: number;
    directExpenseInr: number; allocatedExpenseInr: number; supervisionInr: number;
    totalCostInr: number; profitInr: number;
  };
}

interface BatchOption { id: string; code: string; status: string; farm?: { name: string } | null }

export function CycleClosingScreen({ initialBatchId }: { initialBatchId?: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [batchId, setBatchId] = useState(initialBatchId ?? '');
  const [reason, setReason] = useState('');

  const batches = useQuery({
    queryKey: ['py', 'batches', 'closable'],
    queryFn: async () => {
      const r = await api.get<any>('/poultry/batches', { params: { limit: 200 } });
      const rows: BatchOption[] = r.data?.data ?? r.data ?? [];
      return rows.filter((b) => b.status === 'COMPLETED' || b.status === 'ACTIVE');
    },
  });

  const readiness = useQuery({
    queryKey: ['py', 'closing', batchId],
    queryFn: async () => (await api.get<Readiness>(`/poultry/batches/${batchId}/closing`)).data,
    enabled: !!batchId,
  });

  const close = useMutation({
    mutationFn: async () => (await api.post(`/poultry/batches/${batchId}/close`, { reason: reason || undefined })).data,
    onSuccess: () => { toast.success('Cycle closed — the figures are frozen'); qc.invalidateQueries({ queryKey: ['py'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not close the cycle'),
  });

  const r = readiness.data;

  return (
    <div className="ds-page">
      <PageHead
        title="Cycle closing"
        subtitle="What the cycle produced, ate, achieved and earned — computed from the same consumption the grower's FCR is paid on."
      />

      <Card>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Batch" required>
            <select className="input" style={{ minWidth: 280 }} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Choose a batch…</option>
              {(batches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.code}{b.farm ? ` · ${b.farm.name}` : ''} — {b.status.toLowerCase()}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {!batchId ? null : readiness.isLoading || !r ? (
        <div style={{ marginTop: 16 }}><Skeleton rows={4} height={92} /></div>
      ) : (
        <>
          {r.blockers.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Card tone="expired">
                <SectionTitle sub="Closing is where a cycle stops being correctable. These are refused now rather than discovered in a settlement dispute months later.">
                  {r.blockers.length} thing{r.blockers.length === 1 ? '' : 's'} must be fixed before this cycle can close
                </SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Rendered straight from closingReadiness. The screen keeps no
                      list of its own: a UI that curates which blockers to show
                      will eventually show a cycle as ready that the server
                      refuses to close. */}
                  {r.blockers.map((b, i) => (
                    <div key={`${b.kind}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertTriangle size={15} style={{ color: 'var(--tone-expired)', flex: 'none', marginTop: 2 }} />
                      <div>
                        <div>{b.detail}</div>
                        <div className="ds-caption">{b.kind.replace(/_/g, ' ').toLowerCase()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {r.settlement && (
            <div style={{ marginTop: 16 }}>
              <Card>
                <SectionTitle sub="The grower's settlement for this cycle. A draft computed on figures the cycle has since moved past appears in the blocker list above, not only here.">
                  Settlement {r.settlement.reference}
                </SectionTitle>
                <Line label="Status" value={r.settlement.status.toLowerCase()} />
                <Line label="FCR it was computed on" value={r.settlement.fcr === null ? '—' : String(r.settlement.fcr)} />
                <Line label="Cycle FCR now" value={r.performance.fcr === null ? '—' : String(r.performance.fcr)} strong />
                <Line label="Feed basis" value={`${r.settlement.feedBagsConsumed} bags vs ${r.consumption.feedBagsConsumed} now`} />
                <Line label="Net payable" value={money(r.settlement.netInr)} strong />
              </Card>
            </div>
          )}

          {r.warnings.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Card tone="renewal">
                <SectionTitle sub="Not a bar to closing, but worth knowing before you do.">Worth checking</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.warnings.map((w) => <div key={w.kind} className="ds-caption">{w.detail}</div>)}
                </div>
              </Card>
            </div>
          )}

          <div className="ds-grid ds-grid-kpi" style={{ marginTop: 16 }}>
            <StatCard label="Revenue" value={money(r.financial.revenueInr)} hint={`${r.production.saleWeightKg.toLocaleString('en-IN')} kg sold`} />
            <StatCard label="Total cost" value={money(r.financial.totalCostInr)} hint="chicks, feed, medicine, labour, overheads" />
            <StatCard
              label="Cycle profit"
              value={money(r.financial.profitInr)}
              tone={r.financial.profitInr >= 0 ? 'active' : 'expired'}
            />
            <StatCard
              label="FCR"
              value={r.performance.fcr === null ? '—' : String(r.performance.fcr)}
              hint={`against a plan of ${r.performance.plannedFcr}`}
              tone={r.performance.fcr === null ? 'neutral' : r.performance.fcr <= r.performance.plannedFcr ? 'active' : 'renewal'}
            />
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 16 }}>
            <Card>
              <SectionTitle sub="Birds only ever leave through a pickup or the loss register.">Production</SectionTitle>
              <Line label="Placed" value={r.production.initialBirds.toLocaleString('en-IN')} />
              <Line label="Mortality" value={`${r.production.mortalityBirds.toLocaleString('en-IN')} (${r.production.mortalityPct}%)`} />
              <Line label="Birds sold" value={r.production.birdsSold.toLocaleString('en-IN')} />
              <Line label="Sale weight" value={`${r.production.saleWeightKg.toLocaleString('en-IN')} kg`} />
              <Line label="Average weight" value={`${r.production.avgSaleWeightKg} kg`} strong />
            </Card>

            <Card>
              <SectionTitle sub="Consumption is issued minus returned. Bags that came back were never eaten, and costing them would inflate FCR against the grower.">
                Consumption
              </SectionTitle>
              <Line label="Feed issued" value={`${r.consumption.feedBagsIssued} bags`} />
              <Line label="Less returned" value={`− ${r.consumption.feedBagsReturned} bags`} muted />
              <Line label="Actually consumed" value={`${r.consumption.feedBagsConsumed} bags`} strong />
              <Line label={`At ${r.consumption.kgPerBag} kg a bag`} value={`${r.consumption.feedConsumedKg.toLocaleString('en-IN')} kg`} />
              <Rule />
              <Line label="Medicine issued" value={money(r.consumption.medicineIssuedInr)} />
              <Line label="Less returned" value={`− ${money(r.consumption.medicineReturnedInr)}`} muted />
              <Line label="Actually consumed" value={money(r.consumption.medicineConsumedInr)} strong />
              <Rule />
              <Line
                label="FCR"
                value={r.performance.fcr === null
                  ? 'not computable'
                  : `${r.consumption.feedConsumedKg.toLocaleString('en-IN')} ÷ ${r.production.saleWeightKg.toLocaleString('en-IN')} = ${r.performance.fcr}`}
                strong
              />
            </Card>

            <Card>
              <SectionTitle sub="The cost sheet the farm's P&L and the grower's recovery both read.">Cost</SectionTitle>
              <Line label="Chicks" value={money(r.financial.chickCostInr)} />
              <Line label="Feed" value={money(r.financial.feedCostInr)} />
              <Line label="Medicine" value={money(r.financial.medicineCostInr)} />
              <Line label="Direct expenses" value={money(r.financial.directExpenseInr)} />
              <Line label="Allocated overheads" value={money(r.financial.allocatedExpenseInr)} />
              <Line label="Supervision" value={money(r.financial.supervisionInr)} />
              <Rule />
              <Line label="Total" value={money(r.financial.totalCostInr)} strong />
              <Line label="Revenue" value={money(r.financial.revenueInr)} />
              <Line label="Profit" value={money(r.financial.profitInr)} strong />
            </Card>
          </div>

          <div style={{ marginTop: 16 }}>
            <Card tone={r.canClose ? 'active' : 'neutral'}>
              <SectionTitle sub="Closing freezes these figures into the audit trail. A later edit to a rate master will not restate them.">
                {r.canClose ? 'Ready to close' : r.batch.status !== 'COMPLETED' ? `This batch is ${r.batch.status.toLowerCase()} — record the final pickup first` : 'Not ready'}
              </SectionTitle>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="Note" hint="Why it is being closed now — kept on the audit row.">
                  <input className="input" style={{ minWidth: 280 }} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <button
                  className="btn-primary"
                  disabled={!r.canClose || close.isPending}
                  onClick={() => close.mutate()}
                >
                  <Lock size={14} /> {close.isPending ? 'Closing…' : 'Close the cycle'}
                </button>
                <button className="btn-secondary" onClick={() => router.push('/poultry/settlements')}>
                  <CheckCircle2 size={14} /> Farmer settlement
                </button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Rule() {
  return <div style={{ height: 1, background: 'var(--hairline-soft)', margin: '6px 0' }} />;
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0',
      fontWeight: strong ? 600 : 400,
      color: muted ? 'var(--ink-3)' : 'var(--ink-1)',
    }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
