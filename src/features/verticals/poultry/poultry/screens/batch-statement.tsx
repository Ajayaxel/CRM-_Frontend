'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Card, Skeleton, humanStatus } from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';
import { paiseRate, toneForBatchStatus } from '../ui/tone';

interface Statement {
  header: {
    batch: string; farm: string; region: string; supervisor: string | null;
    placementDate: string; expectedPickupDate: string; ageDays: number; status: string;
    rules: { productionDays: number; restDays: number; supervisionPaisePerBird: number; kgPerBag: number; plannedFcr: number };
  };
  birds: { placed: number; mortality: number; adjustments: number; picked: number; balance: number; mortalityPct: number; consistent: boolean };
  weight: { totalKg: number; avgKg: number };
  feed: {
    stages: { stage: string; plannedBags: number; actualBags: number; varianceBags: number; costInr: number }[];
    totalBags: number; totalCostInr: number; fcr: number | null; plannedFcr: number; fcrVariance: number | null;
    loads: { date: string; reference: string; stage: string; bags: number; ratePaisePerBag: number; amountInr: number; supplier: string }[];
  };
  medicine: { totalInr: number; issues: { date: string; item: string; qty: number; unit: string; amountInr: number }[] };
  mortality: { date: string; birds: number; kind: string; reason?: string | null }[];
  pickups: { date: string; reference: string; party: string; birds: number; weightKg: number; avgWeightKg: number; ratePaisePerKg: number; grossInr: number; deductionInr: number; netInr: number; runningTotalInr: number }[];
  costs: { chickInr: number; feedInr: number; medicineInr: number; supervisionInr: number; directInr: number; allocatedInr: number; totalInr: number };
  settlement: {
    birdsSold: number; totalWeightKg: number; avgWeightKg: number; grossInr: number; deductionsInr: number;
    revenueInr: number; totalCostInr: number; profitInr: number; profitPerBirdInr: number; profitPerKgInr: number; costPerKgInr: number;
  };
}

const th: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--line, #ccc)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '4px 8px', borderBottom: '1px solid var(--line, #eee)', fontSize: 12.5 };
const tdr: React.CSSProperties = { ...td, textAlign: 'right' };

/**
 * The printable digital register — the density of the handwritten production
 * sheet, derived entirely from source documents. Print via the browser; the
 * layout is plain tables so it survives paper.
 */
export function PoultryBatchStatement({ id }: { id: string }) {
  const { data: s, isLoading } = useQuery({
    queryKey: ['py-batch-statement', id],
    queryFn: async () => (await api.get<Statement>(`/poultry/batches/${id}/statement`)).data,
  });

  if (isLoading || !s) {
    return <div className="ds-page"><PageHead title="Batch register" /><Skeleton rows={5} height={80} /></div>;
  }
  const h = s.header;
  const st = s.settlement;

  return (
    <div className="ds-page" style={{ maxWidth: 900 }}>
      <style>{`@media print { .no-print { display: none !important; } .ds-page { padding: 0 !important; } }`}</style>
      <div className="no-print">
        <PageHead
          title={`Register — ${h.batch}`}
          subtitle="The complete production sheet, derived from source records. Compare it line-by-line with the physical register."
          actions={(
            <>
              <Badge tone={toneForBatchStatus(h.status)}>{humanStatus(h.status)}</Badge>
              <button className="btn-primary" onClick={() => window.print()}>Print</button>
            </>
          )}
        />
      </div>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={td}><strong>{h.batch}</strong> · {h.farm} ({h.region})</td>
              <td style={td}>Supervisor: {h.supervisor ?? '—'}</td>
              <td style={td}>Placed {fmtDate(h.placementDate)} · day {h.ageDays}</td>
              <td style={td}>Pickup due {fmtDate(h.expectedPickupDate)}</td>
            </tr>
            <tr>
              <td style={td} colSpan={4}>
                <span className="ds-caption">
                  Rules snapshot: {h.rules.productionDays}d production · {h.rules.restDays}d rest ·
                  supervision {paiseRate(h.rules.supervisionPaisePerBird)}/bird · bag {h.rules.kgPerBag}kg · planned FCR {h.rules.plannedFcr.toFixed(2)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card>
        <strong style={{ fontSize: 13 }}>Birds</strong>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
          <thead><tr>
            <th style={th}>Placed</th><th style={th}>Mortality</th><th style={th}>Mortality %</th>
            <th style={th}>Adjustments</th><th style={th}>Picked / sold</th><th style={th}>Balance</th><th style={th}>Register</th>
          </tr></thead>
          <tbody><tr>
            <td style={td}>{s.birds.placed.toLocaleString('en-IN')}</td>
            <td style={td}>{s.birds.mortality.toLocaleString('en-IN')}</td>
            <td style={td}>{s.birds.mortalityPct}%</td>
            <td style={td}>{s.birds.adjustments === 0 ? '—' : `${s.birds.adjustments > 0 ? '+' : ''}${s.birds.adjustments}`}</td>
            <td style={td}>{s.birds.picked.toLocaleString('en-IN')}</td>
            <td style={td}><strong>{s.birds.balance.toLocaleString('en-IN')}</strong></td>
            <td style={td}>{s.birds.consistent ? 'reconciles' : 'MISMATCH'}</td>
          </tr></tbody>
        </table>
        {s.mortality.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Kind</th><th style={{ ...th, textAlign: 'right' }}>Birds</th><th style={th}>Reason</th></tr></thead>
            <tbody>
              {s.mortality.map((m, i) => (
                <tr key={i}>
                  <td style={td}>{fmtDate(m.date)}</td>
                  <td style={td}>{humanStatus(m.kind)}</td>
                  <td style={tdr}>{m.kind === 'ADJUSTMENT' && m.birds > 0 ? `+${m.birds}` : m.birds}</td>
                  <td style={td}>{m.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <strong style={{ fontSize: 13 }}>Feed — {s.feed.totalBags} bags · {money(s.feed.totalCostInr)} · FCR {s.feed.fcr != null ? s.feed.fcr.toFixed(2) : '—'} (planned {s.feed.plannedFcr.toFixed(2)})</strong>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
          <thead><tr>
            <th style={th}>Stage</th><th style={{ ...th, textAlign: 'right' }}>Planned</th>
            <th style={{ ...th, textAlign: 'right' }}>Actual</th><th style={{ ...th, textAlign: 'right' }}>Variance</th>
            <th style={{ ...th, textAlign: 'right' }}>Cost</th>
          </tr></thead>
          <tbody>
            {s.feed.stages.map((r) => (
              <tr key={r.stage}>
                <td style={td}>{humanStatus(r.stage)}</td>
                <td style={tdr}>{r.plannedBags}</td>
                <td style={tdr}>{r.actualBags}</td>
                <td style={tdr}>{r.varianceBags > 0 ? '+' : ''}{r.varianceBags}</td>
                <td style={tdr}>{money(r.costInr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead><tr>
            <th style={th}>Date</th><th style={th}>Load</th><th style={th}>Stage</th>
            <th style={{ ...th, textAlign: 'right' }}>Bags</th><th style={{ ...th, textAlign: 'right' }}>Rate</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Supplier</th>
          </tr></thead>
          <tbody>
            {s.feed.loads.map((l) => (
              <tr key={l.reference}>
                <td style={td}>{fmtDate(l.date)}</td>
                <td style={td}>{l.reference}</td>
                <td style={td}>{humanStatus(l.stage)}</td>
                <td style={tdr}>{l.bags}</td>
                <td style={tdr}>{paiseRate(l.ratePaisePerBag)}</td>
                <td style={tdr}>{money(l.amountInr)}</td>
                <td style={td}>{l.supplier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {s.medicine.issues.length > 0 && (
        <Card>
          <strong style={{ fontSize: 13 }}>Medicine & materials — {money(s.medicine.totalInr)}</strong>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Item</th><th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {s.medicine.issues.map((m, i) => (
                <tr key={i}>
                  <td style={td}>{fmtDate(m.date)}</td>
                  <td style={td}>{m.item}</td>
                  <td style={tdr}>{m.qty} {m.unit}</td>
                  <td style={tdr}>{money(m.amountInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <strong style={{ fontSize: 13 }}>Party-wise pickup — running total</strong>
        <div className="ds-scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <thead><tr>
              <th style={th}>Date</th><th style={th}>Ref</th><th style={th}>Party</th>
              <th style={{ ...th, textAlign: 'right' }}>Birds</th><th style={{ ...th, textAlign: 'right' }}>Weight kg</th>
              <th style={{ ...th, textAlign: 'right' }}>Avg</th><th style={{ ...th, textAlign: 'right' }}>Rate/kg</th>
              <th style={{ ...th, textAlign: 'right' }}>Net</th><th style={{ ...th, textAlign: 'right' }}>Running</th>
            </tr></thead>
            <tbody>
              {s.pickups.map((p) => (
                <tr key={p.reference}>
                  <td style={td}>{fmtDate(p.date)}</td>
                  <td style={td}>{p.reference}</td>
                  <td style={td}>{p.party}</td>
                  <td style={tdr}>{p.birds.toLocaleString('en-IN')}</td>
                  <td style={tdr}>{p.weightKg.toLocaleString('en-IN')}</td>
                  <td style={tdr}>{p.avgWeightKg}</td>
                  <td style={tdr}>{paiseRate(p.ratePaisePerKg)}</td>
                  <td style={tdr}>{money(p.netInr)}</td>
                  <td style={tdr}><strong>{money(p.runningTotalInr)}</strong></td>
                </tr>
              ))}
              <tr>
                <td style={td} colSpan={3}><strong>Total</strong></td>
                <td style={tdr}><strong>{st.birdsSold.toLocaleString('en-IN')}</strong></td>
                <td style={tdr}><strong>{st.totalWeightKg.toLocaleString('en-IN')}</strong></td>
                <td style={tdr}><strong>{st.avgWeightKg}</strong></td>
                <td style={td} />
                <td style={tdr}><strong>{money(st.revenueInr)}</strong></td>
                <td style={td} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <strong style={{ fontSize: 13 }}>Settlement</strong>
        <div className="ds-scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <tbody>
              <tr>
                <td style={td}>Chicks {money(s.costs.chickInr)}</td>
                <td style={td}>Feed {money(s.costs.feedInr)}</td>
                <td style={td}>Medicine {money(s.costs.medicineInr)}</td>
                <td style={td}>Supervision {money(s.costs.supervisionInr)}</td>
                <td style={td}>Direct {money(s.costs.directInr)}</td>
                <td style={td}>Allocated {money(s.costs.allocatedInr)}</td>
                <td style={td}><strong>Total cost {money(s.costs.totalInr)}</strong></td>
              </tr>
              <tr>
                <td style={td} colSpan={3}>Revenue <strong>{money(st.revenueInr)}</strong> (gross {money(st.grossInr)} − deductions {money(st.deductionsInr)})</td>
                <td style={td} colSpan={2}>Cost/kg ₹{st.costPerKgInr.toLocaleString('en-IN')}</td>
                <td style={td} colSpan={2}>
                  <strong style={{ color: st.profitInr >= 0 ? 'var(--tone-active)' : 'var(--tone-expired)' }}>
                    {st.profitInr >= 0 ? 'Profit' : 'Loss'} {money(Math.abs(st.profitInr))}
                  </strong>
                  <span className="ds-caption"> · ₹{st.profitPerBirdInr}/bird · ₹{st.profitPerKgInr}/kg</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
