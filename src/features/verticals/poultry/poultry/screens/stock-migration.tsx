'use client';

/**
 * The inventory migration console.
 *
 * Moving stock authority is the one operation in this vertical that changes
 * where truth lives, so the screen is built to make that visible rather than
 * easy: it shows what exists, what will move, what is ambiguous, why it is
 * blocked, what reconciled, which authority is live, and whether rollback is
 * still possible.
 *
 * The server is the only gate. Nothing here computes readiness for itself —
 * a front end that decided "ready" would eventually disagree with the API that
 * actually refuses, and the operator would trust the wrong one.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Database, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge, Card, DataTable, EmptyState, Field, FormSection, Modal, SectionTitle, Segmented,
  Skeleton, StatCard, type DataTableColumn, type Tone,
} from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';
import {
  AcknowledgementsPanel, DataAuditPanel, EvidencePanel, ExecutionBanner, PostMigrationChecksPanel, RunbookPanel,
} from './stock-migration-panels';

interface Preflight {
  authority: string;
  legacy: { items: number; transactions: number };
  locations: number;
  openRuns: { id: string; reference: string; status: string }[];
  run: Report | null;
  blockers: { kind: string; detail: string }[];
  warnings: { kind: string; detail: string }[];
  status: 'READY' | 'BLOCKED';
}

interface Row {
  id: string;
  item: { legacyCode: string; legacyName: string; category: string; unit: string };
  mappedTo: { id: string; code: string; name: string; uom: string } | null;
  location: { id: string; code: string; name: string } | null;
  batchNo: string | null; expiryDate: string | null;
  legacyQty: number; migratedQty: number; qtyVariance: number;
  legacyValueInr: number; migratedValueInr: number; valueVarianceInr: number;
  legacyUnitCostPaise: number;
  mappingStatus: string; reconciliationStatus: string;
  note: string | null;
  evidence: { legacyTxnIds?: string[]; purchases?: number; issues?: number; adjustments?: number; derivedFrom?: string };
  stockMoveId: string | null;
}

interface Report {
  migration: {
    id: string; reference: string; status: string; asOf: string;
    targetLocation: { id: string; code: string; name: string } | null;
    postedAt: string | null; reconciledAt: string | null; cutOverAt: string | null; rolledBackAt: string | null;
    notes: string | null;
  };
  authority: string;
  rows: Row[];
  totals: {
    units: number; skipped: number; reconciled: number; blocked: number;
    legacyQty: number; migratedQty: number; legacyValueInr: number; migratedValueInr: number;
  };
  blockers: { id: string; item: string; status: string; detail: string }[];
  readyForCutover: boolean;
  verdict: string;
}

const AUTHORITY_TONE: Record<string, Tone> = {
  LEGACY_AUTHORITATIVE: 'info',
  MIGRATION_PENDING: 'renewal',
  SHARED_AUTHORITATIVE: 'active',
};
const AUTHORITY_LABEL: Record<string, string> = {
  LEGACY_AUTHORITATIVE: 'Legacy register',
  MIGRATION_PENDING: 'Frozen — migrating',
  SHARED_AUTHORITATIVE: 'Shared inventory',
};
const MAPPING_TONE: Record<string, Tone> = {
  MAPPED_EXISTING: 'active', MAPPED_NEW: 'info',
  AMBIGUOUS: 'expired', UNMAPPED: 'expired', SKIPPED: 'neutral',
};
const RECON_TONE: Record<string, Tone> = {
  RECONCILED: 'active', PENDING: 'info',
  QTY_VARIANCE: 'expired', VALUE_VARIANCE: 'expired', EXPIRY_VARIANCE: 'expired', BLOCKED: 'expired',
};
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();
const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

type Review = {
  legacy: { code: string; name: string; normalizedName: string; unit: string; category: string | null };
  candidates: {
    itemId: string; code: string; name: string; unit: string; normalizedName: string;
    match: { codeExact: boolean; nameExact: boolean; normalizedMatch: boolean; normalizedContains: boolean; compactMatch: boolean; unitCompatible: boolean };
    autoMappable: boolean; caution: string | null;
  }[];
  verdict: string; guidance: string; note: string;
};

/** Three states, not two: yes, no, and "nothing to compare yet". */
function yesNoYet(v: unknown) {
  return v === null || v === undefined ? 'not yet' : v ? 'yes' : 'no';
}

type DryRun = {
  mode: 'DRY_RUN';
  mutating: false;
  environment: string;
  authority: string;
  reference: string | null;
  asOf: string;
  location: { id: string; code: string; name: string };
  legacy: { items: number; transactions: number };
  mapping: { exact: number; createdNew: number; ambiguous: number; unmapped: number; unitMismatches: number; batchIdentityMissing: number };
  totals: {
    units: number; legacyQty: number; openingQty: number;
    legacyValueInr: number; openingValueInr: number;
    batches: number; withExpiry: number; alreadyExpired: number;
  };
  blockers: { area: string; kind: string; detail: string }[];
  advisories: { area: string; kind: string; detail: string }[];
  verdict: 'WOULD_SUCCEED' | 'BLOCKED';
  ranAt: string;
  lines: {
    legacyCode: string; legacyName: string; unit: string; qty: number; valueInr: number;
    batchNo: string | null; expiryDate: string | null; mappingStatus: string; note: string | null;
    feasibility: { ok: boolean; kind: string; detail: string }[];
    wouldOpenQty: number; wouldOpenValueInr: number; qtyVariance: number; valueVarianceInr: number;
  }[];
  note: string;
};

type Readiness = Record<string, any> & {
  authority: string;
  blockers: { area: string; kind: string; detail: string }[];
  status: string;
  note?: string;
};

export function StockMigrationScreen() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [mapping, setMapping] = useState<Row | null>(null);
  const [cutOverOpen, setCutOverOpen] = useState(false);
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const preflight = useQuery({
    queryKey: ['py', 'migration-preflight', openId],
    queryFn: async () => (await api.get<Preflight>('/poultry/stock-migration/preflight', { params: openId ? { migrationId: openId } : {} })).data,
  });
  const runs = useQuery({
    queryKey: ['py', 'migrations'],
    queryFn: async () => (await api.get<any[]>('/poultry/stock-migration')).data,
  });
  const report = useQuery({
    queryKey: ['py', 'migration', openId],
    queryFn: async () => (await api.get<Report>(`/poultry/stock-migration/${openId}`)).data,
    enabled: !!openId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['py'] });
  const act = (path: string, ok: string) => useMutationFor(path, ok, invalidate);

  const post = useMutation({
    mutationFn: async () => (await api.post(`/poultry/stock-migration/${openId}/post`, {
      expectedAuthority: preflight.data?.authority,
    })).data,
    onSuccess: () => { toast.success('Opening stock written — reconciling'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Refused'),
  });
  const reconcile = act(`/poultry/stock-migration/${openId}/reconcile`, 'Reconciled');
  const rollback = act(`/poultry/stock-migration/${openId}/rollback`, 'Rolled back');

  // The authority THIS BROWSER was shown, sent back with the request. If it no
  // longer matches, another operator moved it while this screen sat open and
  // the server refuses rather than acting on a stale picture.
  const cutOver = useMutation({
    mutationFn: async () => (await api.post(`/poultry/stock-migration/${openId}/cutover`, {
      expectedAuthority: preflight.data?.authority,
    })).data,
    onSuccess: () => { toast.success('Authority moved to the shared inventory'); setCutOverOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cutover refused'),
  });

  // The readiness report is READ-ONLY and deliberately has no action on it.
  // It answers "is this company safe to migrate", which is a different question
  // from "what is this run doing" — and mixing the two is how a report becomes
  // a button somebody clicks.
  const readiness = useQuery({
    queryKey: ['py', 'migration', 'readiness', openId],
    queryFn: async () => (await api.get<Readiness>('/poultry/stock-migration/readiness', {
      params: openId ? { migrationId: openId } : {},
    })).data,
  });

  // A DRY RUN and a MIGRATION are different acts, so they are different
  // controls with different words and different colour. The one thing a
  // console like this must never do is let somebody reach for the safe button
  // and get the irreversible one.
  const runDryRun = useMutation({
    mutationFn: async () => (await api.post<DryRun>('/poultry/stock-migration/dry-run', {
      ...(openId ? { migrationId: openId, stamp: true } : {}),
    })).data,
    onSuccess: (d) => {
      setDryRun(d);
      toast.success(d.verdict === 'WOULD_SUCCEED'
        ? 'Dry run complete — nothing was written'
        : `Dry run complete — ${d.blockers.length} blocker(s). Nothing was written.`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Dry run refused'),
  });

  const r = report.data;
  const pf = preflight.data;
  const rd = readiness.data;

  return (
    <div className="ds-page">
      <PageHead
        title="Inventory migration"
        subtitle="Moving where poultry stock is true. Every gate on this screen is the server's — nothing here decides readiness for itself."
        actions={<button className="btn-primary" disabled={pf?.authority === 'SHARED_AUTHORITATIVE'} onClick={() => setPlanOpen(true)}>Plan a migration</button>}
      />

      {/* Whether a migration has HAPPENED, stated before anything else on the page. */}
      <ExecutionBanner readiness={rd} />

      {preflight.isLoading || !pf ? <Skeleton rows={3} height={92} /> : (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard
              label="Stock authority"
              value={AUTHORITY_LABEL[pf.authority] ?? pf.authority}
              hint="exactly one system is true at a time"
              tone={AUTHORITY_TONE[pf.authority] ?? 'neutral'}
            />
            <StatCard label="Legacy items" value={String(pf.legacy.items)} hint={`${pf.legacy.transactions} transactions`} />
            <StatCard label="Shared locations" value={String(pf.locations)} hint="somewhere to migrate into" tone={pf.locations ? 'neutral' : 'expired'} />
            <StatCard
              label="Pre-flight"
              value={pf.status}
              hint={pf.status === 'READY' ? 'the server would accept a migration' : `${pf.blockers.length} blocker(s)`}
              tone={pf.status === 'READY' ? 'active' : 'expired'}
            />
          </div>

          {pf.authority === 'MIGRATION_PENDING' && (
            <div style={{ marginTop: 16 }}>
              <Card tone="renewal">
                <SectionTitle sub="Stock writes are refused on both sides while the two systems are being compared. Finish the reconciliation or roll the run back.">
                  <Lock size={15} style={{ verticalAlign: -2 }} /> Stock is frozen
                </SectionTitle>
              </Card>
            </div>
          )}

          {(pf.blockers.length > 0 || pf.warnings.length > 0) && (
            <div style={{ marginTop: 16 }}>
      <DataAuditPanel migrationId={openId} />

              <Card tone={pf.blockers.length ? 'expired' : 'renewal'}>
                <SectionTitle sub="Every one of them, not just the first — somebody has to fix them all.">
                  {pf.blockers.length ? `${pf.blockers.length} blocker(s)` : `${pf.warnings.length} thing(s) worth knowing`}
                </SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pf.blockers.map((b, i) => (
                    <div key={`b${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--tone-expired)', flex: 'none', marginTop: 3 }} />
                      <div><div>{b.detail}</div><div className="ds-caption">{label(b.kind)}</div></div>
                    </div>
                  ))}
                  {pf.warnings.map((w, i) => <div key={`w${i}`} className="ds-caption">{w.detail}</div>)}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <SectionTitle sub="A run is a proposal until it is posted, and posted until it reconciles.">Migration runs</SectionTitle>
        {runs.isLoading ? <Skeleton rows={2} /> : (runs.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={Database}
              title="No migration has been planned"
              body="Planning derives what the legacy register actually holds and proposes a mapping. It writes no stock."
              actionLabel="Plan a migration"
              onAction={() => setPlanOpen(true)}
            />
          </Card>
        ) : (
          <Card flush>
            <DataTable
              columns={[
                { key: 'reference', header: 'Run', render: (x: any) => <span style={{ fontWeight: 600 }}>{x.reference}</span> },
                { key: 'asOf', header: 'As at', render: (x: any) => fmtDate(x.asOf) },
                { key: 'lines', header: 'Units', align: 'right', render: (x: any) => String(x._count?.lines ?? 0) },
                { key: 'status', header: '', render: (x: any) => <Badge tone={x.status === 'CUT_OVER' ? 'active' : x.status === 'BLOCKED' ? 'expired' : 'info'}>{label(x.status)}</Badge> },
              ] as DataTableColumn<any>[]}
              rows={runs.data ?? []}
              rowKey={(x) => x.id}
              onRowClick={(x) => setOpenId(x.id)}
            />
          </Card>
        )}
      </div>

      {openId && (report.isLoading || !r ? <div style={{ marginTop: 16 }}><Skeleton rows={3} /></div> : (
        <div style={{ marginTop: 20 }}>
          <Card>
            <SectionTitle
              sub={`As at ${fmtDate(r.migration.asOf)} · into ${r.migration.targetLocation?.name ?? '—'} · ${r.migration.status.toLowerCase()}`}
              action={(
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(r.migration.status === 'DRAFT' || r.migration.status === 'BLOCKED') && (
                    <>
                      <button className="btn-secondary" onClick={() => setSnapshotOpen(true)}>
                        {rd?.safety.snapshotReference ? 'Change snapshot reference' : 'Record snapshot reference'}
                      </button>
                      {/* The first control that writes stock. Deliberately the
                          only primary button in this row, and the server
                          refuses it without a snapshot and a clean dry run —
                          so the label promises nothing the API will not honour. */}
                      <button className="btn-primary" disabled={post.isPending} onClick={() => post.mutate()}>
                        {post.isPending ? 'Posting…' : 'Post opening stock (writes)'}
                      </button>
                    </>
                  )}
                  {(r.migration.status === 'POSTED' || r.migration.status === 'BLOCKED' || r.migration.status === 'RECONCILED') && (
                    <button className="btn-secondary" disabled={reconcile.isPending} onClick={() => reconcile.mutate()}>
                      {reconcile.isPending ? 'Reconciling…' : 'Re-reconcile'}
                    </button>
                  )}
                  {r.readyForCutover && (
                    <button className="btn-primary" onClick={() => setCutOverOpen(true)}>
                      <ShieldCheck size={14} /> Cut over
                    </button>
                  )}
                  {r.migration.status !== 'ROLLED_BACK' && r.migration.status !== 'DRAFT' && (
                    <button className="btn-secondary" disabled={rollback.isPending} onClick={() => rollback.mutate()}>
                      <RotateCcw size={14} /> {rollback.isPending ? 'Rolling back…' : 'Roll back'}
                    </button>
                  )}
                </div>
              )}
            >
              {r.migration.reference}
            </SectionTitle>

            <div className="ds-grid ds-grid-kpi">
              <StatCard label="Units" value={String(r.totals.units)} hint={r.totals.skipped ? `${r.totals.skipped} deliberately excluded` : 'positions to move'} />
              <StatCard
                label="Reconciled"
                value={`${r.totals.reconciled} / ${r.totals.units}`}
                tone={r.totals.blocked ? 'expired' : r.totals.reconciled ? 'active' : 'neutral'}
                hint={r.totals.blocked ? `${r.totals.blocked} do not agree` : 'quantity, value and expiry'}
              />
              <StatCard
                label="Quantity"
                value={`${r.totals.migratedQty} / ${r.totals.legacyQty}`}
                hint="migrated against legacy"
                tone={r.totals.migratedQty === r.totals.legacyQty ? 'active' : 'expired'}
              />
              <StatCard
                label="Value"
                value={money(r.totals.migratedValueInr)}
                hint={`legacy ${money(r.totals.legacyValueInr)}`}
                tone={r.totals.migratedValueInr === r.totals.legacyValueInr ? 'active' : 'expired'}
              />
            </div>

            {r.blockers.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <Card tone="expired">
                  <SectionTitle sub="A run is not ready because a transaction succeeded. It is ready when the opening position reconciles.">
                    {r.blockers.length} unit(s) do not reconcile
                  </SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {r.blockers.map((b) => (
                      <div key={b.id} className="ds-caption"><strong>{b.item}</strong> — {b.detail}</div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </Card>

          <div style={{ marginTop: 16 }}>
            <Card flush>
              <DataTable
                columns={[
                  { key: 'item', header: 'Legacy item', render: (x: Row) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{x.item.legacyCode} · {x.item.legacyName}</div>
                      <div className="ds-caption">
                        {x.item.category.toLowerCase()} · {x.item.unit}
                        {x.batchNo ? ` · ${x.batchNo}` : ''}
                        {x.expiryDate ? ` · expires ${fmtDate(x.expiryDate)}` : ''}
                      </div>
                    </div>
                  ) },
                  { key: 'mappedTo', header: 'Maps to', render: (x: Row) => (
                    x.mappedTo
                      ? <div><div>{x.mappedTo.name}</div><div className="ds-caption">{x.mappedTo.code} · {x.mappedTo.uom}</div></div>
                      : <Badge tone={MAPPING_TONE[x.mappingStatus] ?? 'neutral'}>{label(x.mappingStatus)}</Badge>
                  ) },
                  { key: 'legacyQty', header: 'Legacy', align: 'right', render: (x: Row) => (
                    <div>
                      <div style={{ fontVariantNumeric: 'tabular-nums' }}>{x.legacyQty} {x.item.unit}</div>
                      <div className="ds-caption">{rupees(x.legacyUnitCostPaise)}/{x.item.unit} · {money(x.legacyValueInr)}</div>
                    </div>
                  ) },
                  { key: 'migratedQty', header: 'Migrated', align: 'right', render: (x: Row) => (
                    <div>
                      <div style={{ fontVariantNumeric: 'tabular-nums' }}>{x.migratedQty} {x.item.unit}</div>
                      <div className="ds-caption">{money(x.migratedValueInr)}</div>
                    </div>
                  ) },
                  { key: 'qtyVariance', header: 'Variance', align: 'right', render: (x: Row) => (
                    x.qtyVariance === 0 && x.valueVarianceInr === 0
                      ? <span className="ds-caption">—</span>
                      : (
                        <div style={{ color: 'var(--tone-expired)' }}>
                          <div>{x.qtyVariance !== 0 ? `${x.qtyVariance > 0 ? '+' : ''}${x.qtyVariance}` : ''}</div>
                          <div className="ds-caption">{x.valueVarianceInr !== 0 ? money(x.valueVarianceInr) : ''}</div>
                        </div>
                      )
                  ) },
                  { key: 'reconciliationStatus', header: '', render: (x: Row) => (
                    <Badge tone={RECON_TONE[x.reconciliationStatus] ?? 'neutral'}>{label(x.reconciliationStatus)}</Badge>
                  ) },
                ] as DataTableColumn<Row>[]}
                rows={r.rows}
                rowKey={(x) => x.id}
                onRowClick={(x) => setMapping(x)}
              />
              <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
                Legacy quantities are derived from the transaction history — the legacy register stores no balance
                column — and valued on its own moving average, not today&apos;s price.
              </p>
            </Card>
          </div>
        </div>
      ))}

      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} onPlanned={(id) => { setOpenId(id); invalidate(); }} />
      <Card>
        <SectionTitle
          sub="Runs the real derivation and mapping against this company's real data and writes nothing. Safe to run at any time, on any company, as often as you like."
          action={(
            <button className="btn-secondary" disabled={runDryRun.isPending} onClick={() => runDryRun.mutate()}>
              {runDryRun.isPending ? 'Deriving…' : 'Run dry run (writes nothing)'}
            </button>
          )}
        >
          Dry run
        </SectionTitle>
        {!dryRun ? (
          <p className="ds-caption">
            No dry run in this session. A dry run answers &ldquo;could this company migrate, and if not why not&rdquo;
            without touching a single operational record — it is the evidence a real migration is required to have.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <Badge tone={dryRun.verdict === 'WOULD_SUCCEED' ? 'active' : 'expired'}>
                {dryRun.verdict === 'WOULD_SUCCEED' ? 'WOULD SUCCEED' : 'BLOCKED'}
              </Badge>
              <Badge>{dryRun.environment}</Badge>
              <span className="ds-caption">nothing was written · {fmtDate(dryRun.ranAt)}</span>
            </div>
            <div className="ds-grid ds-grid-kpi">
              <StatCard label="Positions" value={String(dryRun.totals.units)} hint={`${dryRun.legacy.items} legacy items · ${dryRun.legacy.transactions} transactions`} />
              <StatCard label="Would open" value={`${dryRun.totals.openingQty} / ${dryRun.totals.legacyQty}`} hint="quantity that would move" tone={dryRun.totals.openingQty === dryRun.totals.legacyQty ? 'neutral' : 'expired'} />
              <StatCard label="Valuation" value={money(dryRun.totals.openingValueInr)} hint={`legacy ${money(dryRun.totals.legacyValueInr)}`} />
              <StatCard label="Batches" value={String(dryRun.totals.batches)} hint={`${dryRun.totals.withExpiry} with expiry · ${dryRun.totals.alreadyExpired} already expired`} />
            </div>
            <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 14 }}>
              <div>
                <SectionTitle>Mapping</SectionTitle>
                <Line label="Exact" value={String(dryRun.mapping.exact)} />
                <Line label="Would be created new" value={String(dryRun.mapping.createdNew)} />
                <Line label="Ambiguous" value={String(dryRun.mapping.ambiguous)} />
                <Line label="Unmapped" value={String(dryRun.mapping.unmapped)} />
                <Line label="Unit mismatches" value={String(dryRun.mapping.unitMismatches)} />
                <Line label="Missing batch identity" value={String(dryRun.mapping.batchIdentityMissing)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <SectionTitle>Every blocker, not the first one</SectionTitle>
                {dryRun.blockers.length === 0 ? (
                  <p className="ds-caption">None. This company would migrate cleanly.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {dryRun.blockers.map((b, i) => (
                      <li key={i} className="ds-caption"><strong>{b.area}</strong> · {b.kind} — {b.detail}</li>
                    ))}
                  </ul>
                )}
                {dryRun.advisories.length > 0 && (
                  <>
                    <SectionTitle sub="Not blocking — worth reading before you commit.">Advisories</SectionTitle>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {dryRun.advisories.map((b, i) => (
                        <li key={i} className="ds-caption">{b.kind} — {b.detail}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
            <p className="ds-caption" style={{ marginTop: 10 }}>{dryRun.note}</p>
          </>
        )}
      </Card>

      {rd && (
        <Card>
          <SectionTitle sub="Read-only. Nothing on this panel can start a migration — running one is a separate, deliberate action above.">
            Real-migration readiness
          </SectionTitle>
          <div style={{ marginBottom: 12 }}>
            <Badge tone={rd.status === 'BLOCKED' ? 'expired' : 'active'}>
              {rd.status === 'READY_FOR_OPERATIONAL_MIGRATION'
                ? 'READY FOR OPERATIONAL MIGRATION'
                : rd.status === 'ALREADY_MIGRATED'
                  ? 'ALREADY MIGRATED'
                  : 'BLOCKED'}
            </Badge>
            {rd.note && <p className="ds-caption" style={{ marginTop: 6 }}>{rd.note}</p>}
            <p className="ds-caption" style={{ marginTop: 6 }}>
              <strong>{rd.blockers.length} blocker(s)</strong> — each one stops the migration, and all of them are listed below.{' '}
              <strong>{rd.warnings?.length ?? 0} warning(s)</strong> — read them; they do not stop it.{' '}
              {rd.informational?.length ?? 0} informational note(s) describe what the migration deliberately leaves alone.
              The evidence for each is in the data audit.
            </p>
            {(rd.warnings?.length ?? 0) > 0 && (
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {rd.warnings.map((w: { kind: string; subject: string | null; detail: string }, i: number) => (
                  <li key={i} className="ds-caption">WARNING · {w.kind}{w.subject ? ` · ${w.subject}` : ''} — {w.detail}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div>
              <SectionTitle>Data</SectionTitle>
              <Line label="Items mapped" value={String(rd.data.itemsMapped ?? 0)} />
              <Line label="Unresolved" value={String(rd.data.itemsUnresolved ?? 0)} />
              <Line label="Location mapped" value={rd.data.locationMapped ? 'yes' : 'no'} />
              {/* `not yet` is not `no`. Before a run is posted there is nothing
                  to reconcile against, and showing "no" would read as a fault. */}
              <Line label="Quantity reconciles" value={yesNoYet(rd.data.quantityReconciled)} />
              <Line label="Valuation reconciles" value={yesNoYet(rd.data.valuationReconciled)} />
              <Line label="Expiry preserved" value={yesNoYet(rd.data.expiryReconciled)} />
            </div>
            <div>
              <SectionTitle>Application</SectionTitle>
              {/* What is enforced when the code is built is said to be exactly
                  that — this server cannot read its own source. The one thing it
                  checks live is whether legacy writes are refused right now. */}
              <Line label="Live-read audit" value={String(rd.liveReadAudit?.status ?? '—').replace(/_/g, ' ').toLowerCase()} />
              <Line label="Live-write audit" value={String(rd.liveWriteAudit?.status ?? '—').replace(/_/g, ' ').toLowerCase()} />
              <Line label="Legacy writes refused now" value={rd.liveWriteAudit?.legacyWritesRefusedNow ? 'yes' : 'no'} />
              <Line label="Consistent with authority" value={rd.liveWriteAudit?.consistentWithAuthority ? 'yes' : 'NO'} strong={!rd.liveWriteAudit?.consistentWithAuthority} />
              <p className="ds-caption" style={{ marginTop: 6 }}>{rd.liveWriteAudit?.detail} Gate: {rd.liveReadAudit?.gate}</p>
            </div>
            <div>
              <SectionTitle>Safety</SectionTitle>
              <Line label="Environment" value={String(rd.safety.environment ?? '—')} strong />
              <Line label="Execution permitted here" value={rd.safety.environmentPermitsExecution ? 'yes' : 'no'} />
              {rd.safety.environmentReason && <p className="ds-caption">{rd.safety.environmentReason}</p>}
              <Line label="Snapshot reference" value={String(rd.safety.snapshotReference ?? 'not recorded')} />
              <Line label="Dry run" value={rd.safety.dryRunVerdict ? `${rd.safety.dryRunVerdict}${rd.safety.dryRunStale ? ' (stale)' : ''}` : 'not run'} />
              <Line label="Rollback available" value={rd.safety.rollbackAvailable ? 'yes' : 'no'} />
              {rd.safety.rollbackReason && <p className="ds-caption">{rd.safety.rollbackReason}</p>}
              <Line label="No concurrent run" value={rd.safety.noConcurrentMigration ? 'yes' : 'no'} />
              <Line label="Audit evidence present" value={rd.safety.auditEvidencePresent ? 'yes' : 'no'} />
            </div>
          </div>
          {rd.blockers.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Every blocker, not the first one</SectionTitle>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {rd.blockers.map((b, i) => (
                  <li key={i} className="ds-caption"><strong>{b.area}</strong> · {b.kind} — {b.detail}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <AcknowledgementsPanel
        migrationId={openId}
        readiness={rd}
        editable={r?.migration.status === 'DRAFT' || r?.migration.status === 'BLOCKED'}
      />
      <EvidencePanel migrationId={openId} />
      <PostMigrationChecksPanel migrationId={openId} />
      <RunbookPanel migrationId={openId} />

      <SnapshotModal
        open={snapshotOpen}
        reference={r?.migration.reference}
        onClose={() => setSnapshotOpen(false)}
        onSaved={() => { setSnapshotOpen(false); invalidate(); }}
        migrationId={openId}
      />
      <MappingModal row={mapping} onClose={() => setMapping(null)} onSaved={invalidate} editable={r?.migration.status === 'DRAFT' || r?.migration.status === 'BLOCKED'} />
      <CutOverModal
        open={cutOverOpen}
        report={r}
        busy={cutOver.isPending}
        onClose={() => setCutOverOpen(false)}
        onConfirm={() => cutOver.mutate()}
      />
    </div>
  );
}

function useMutationFor(path: string, ok: string, onDone: () => void) {
  return useMutation({
    mutationFn: async () => (await api.post(path, {})).data,
    onSuccess: () => { toast.success(ok); onDone(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Refused'),
  });
}

function PlanModal({ open, onClose, onPlanned }: { open: boolean; onClose: () => void; onPlanned: (id: string) => void }) {
  const [targetLocationId, setLocation] = useState('');
  const [asOf, setAsOf] = useState('');
  const [notes, setNotes] = useState('');

  const locations = useQuery({
    queryKey: ['core', 'locations'],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string; kind: string }[]>('/core/locations', { params: { status: 'active' } })).data,
    enabled: open,
  });

  const plan = useMutation({
    mutationFn: async () => (await api.post<Report>('/poultry/stock-migration/plan', {
      targetLocationId, asOf: asOf || undefined, notes: notes || undefined,
    })).data,
    onSuccess: (d) => { toast.success('Planned — nothing was written to stock'); onPlanned(d.migration.id); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not plan'),
  });

  return (
    <Modal
      open={open} onClose={onClose} title="Plan a migration" width={680}
      subtitle="Derives what the legacy register holds and proposes a mapping. Writes no stock — a plan can be read, argued with and thrown away."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={plan.isPending || !targetLocationId} onClick={() => plan.mutate()}>
            {plan.isPending ? 'Planning…' : 'Plan'}
          </button>
        </>
      )}
    >
      <FormSection title="Target">
        <Field label="Migrate into" required hint="The legacy register has no locations — everything lands in one store.">
          <select className="input" value={targetLocationId} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Choose a location…</option>
            {(locations.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </Field>
        <Field label="Position as at" hint="Defaults to now. Legacy transactions after this instant are not in the opening.">
          <input className="input" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
        <Field label="Note" span={2}>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this run is being made" />
        </Field>
      </FormSection>
    </Modal>
  );
}

function MappingModal({ row, onClose, onSaved, editable }: {
  row: Row | null; onClose: () => void; onSaved: () => void; editable?: boolean;
}) {
  const [itemId, setItemId] = useState('');
  const [note, setNote] = useState('');

  const items = useQuery({
    queryKey: ['core', 'items'],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string; uom: string; category: string | null }[]>('/core/items')).data,
    enabled: !!row,
  });
  // The comparison is the SERVER's. The console does not decide what looks
  // like a duplicate — it shows what the server found and how it matched.
  const review = useQuery({
    queryKey: ['py', 'migration', 'review', row?.id],
    queryFn: async () => (await api.get<Review>(`/poultry/stock-migration/lines/${row!.id}/review`)).data,
    enabled: !!row,
  });
  React.useEffect(() => { setItemId(row?.mappedTo?.id ?? ''); setNote(''); }, [row?.id]);

  // Three decisions, sent as exactly one. The server records who made it and
  // why, and refuses a unit mismatch however the request is phrased.
  const save = useMutation({
    mutationFn: async (mode: 'map' | 'skip' | 'block') => (await api.post(`/poultry/stock-migration/lines/${row!.id}/map`,
      mode === 'map' ? { itemId, note: note || undefined }
        : mode === 'skip' ? { skip: true, reason: note || undefined }
          : { block: true, reason: note },
    )).data,
    onSuccess: () => { toast.success('Mapping recorded'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Refused'),
  });

  if (!row) return null;
  // Candidates whose unit matches. A unit mismatch is not offered at all,
  // because the server refuses it and offering it would only teach the
  // operator to click something that fails.
  const compatible = (items.data ?? []).filter((i) => i.uom.toLowerCase() === row.item.unit.toLowerCase());
  const incompatible = (items.data ?? []).filter((i) => i.uom.toLowerCase() !== row.item.unit.toLowerCase());

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={`${row.item.legacyCode} · ${row.item.legacyName}`}
      subtitle={`${row.legacyQty} ${row.item.unit} at ${rupees(row.legacyUnitCostPaise)} · ${label(row.mappingStatus)}`}
      width={820}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {editable && (
            <>
              <button className="btn-secondary" disabled={save.isPending} onClick={() => save.mutate('skip')}>Exclude this line</button>
              <button
                className="btn-secondary"
                disabled={save.isPending || note.trim().length < 10}
                title={note.trim().length < 10 ? 'Blocking needs a reason: what you examined and why it cannot migrate' : undefined}
                onClick={() => save.mutate('block')}
              >
                Block — not migratable
              </button>
              <button className="btn-primary" disabled={save.isPending || !itemId} onClick={() => save.mutate('map')}>
                {save.isPending ? 'Saving…' : 'Map'}
              </button>
            </>
          )}
        </>
      )}
    >
      {row.note && (
        <Card tone={row.mappingStatus === 'AMBIGUOUS' ? 'expired' : undefined}>
          <SectionTitle>Why this needs a decision</SectionTitle>
          <p>{row.note}</p>
        </Card>
      )}

      {review.data && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle sub={review.data.note}>Candidates</SectionTitle>
          <p className="ds-caption" style={{ marginBottom: 8 }}>{review.data.guidance}</p>
          <Line label="Legacy name" value={review.data.legacy.name} strong />
          <Line label="Normalized" value={review.data.legacy.normalizedName || '—'} />
          <Line label="Legacy code" value={review.data.legacy.code} />
          <Line label="Legacy unit" value={review.data.legacy.unit || '—'} />
          {review.data.candidates.length === 0 ? (
            <p className="ds-caption" style={{ marginTop: 8 }}>
              No candidate found. This item will be created new in shared inventory.
            </p>
          ) : (
            <div style={{ marginTop: 10 }}>
              <DataTable
                rows={review.data.candidates}
                rowKey={(c) => c.itemId}
                dense
                columns={[
                  { key: 'item', header: 'Shared item', render: (c) => (
                    <div>
                      <strong>{c.code}</strong> · {c.name}
                      {c.caution && <div className="ds-caption">{c.caution}</div>}
                    </div>
                  ) },
                  { key: 'unit', header: 'Unit', width: 80, render: (c) => c.unit },
                  { key: 'code', header: 'Code', width: 90, render: (c) => c.match.codeExact ? <Badge tone="active">exact</Badge> : <span className="ds-caption">—</span> },
                  { key: 'name', header: 'Name', width: 90, render: (c) => c.match.nameExact ? <Badge tone="active">exact</Badge> : <span className="ds-caption">—</span> },
                  { key: 'norm', header: 'Normalized', width: 110, render: (c) => c.match.normalizedMatch ? <Badge>same</Badge> : c.match.compactMatch ? <Badge>spacing only</Badge> : c.match.normalizedContains ? <Badge>contains</Badge> : <span className="ds-caption">—</span> },
                  { key: 'unitok', header: 'Unit ok', width: 90, render: (c) => c.match.unitCompatible ? 'yes' : <Badge tone="expired">no</Badge> },
                  { key: 'safe', header: 'Safe to map', width: 120, render: (c) => c.autoMappable ? 'yes' : <span className="ds-caption">decide by hand</span> },
                ] as DataTableColumn<Review['candidates'][number]>[]}
              />
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <SectionTitle sub="Derived from the legacy transactions, not copied from a balance column.">Evidence</SectionTitle>
        <Line label="Derived from" value={`${row.evidence.legacyTxnIds?.length ?? 0} legacy transactions`} />
        <Line label="Purchases" value={String(row.evidence.purchases ?? 0)} />
        <Line label="Issues" value={String(row.evidence.issues ?? 0)} />
        <Line label="Adjustments" value={String(row.evidence.adjustments ?? 0)} />
        <Line label="Opening quantity" value={`${row.legacyQty} ${row.item.unit}`} strong />
        <Line label="Opening unit cost" value={`${rupees(row.legacyUnitCostPaise)} / ${row.item.unit}`} />
        <Line label="Opening value" value={money(row.legacyValueInr)} strong />
        {row.expiryDate && <Line label="Expiry" value={fmtDate(row.expiryDate)} />}
      </div>

      {editable && (
        <div style={{ marginTop: 20 }}>
          <FormSection title="Map to a shared item">
            <Field
              label="Shared item"
              span={2}
              hint={`Only items measured in ${row.item.unit} are offered — a unit mismatch would change what the quantity means, and the server refuses it.`}
            >
              <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">Choose…</option>
                {compatible.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name} ({i.uom})</option>)}
              </select>
            </Field>
            <Field label="Reason / note" span={2} hint="Required to block a position: what you examined, and why it cannot migrate as it stands.">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this mapping" />
            </Field>
          </FormSection>
          {incompatible.length > 0 && (
            <p className="ds-caption">
              {incompatible.length} other item(s) exist in different units and are deliberately not offered.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * The snapshot reference.
 *
 * The system cannot take a backup and does not claim to. What it does is
 * refuse to write anything until a person has named the thing they would
 * restore from — and keep that name where an auditor will find it.
 */
function SnapshotModal({ open, reference, migrationId, onClose, onSaved }: {
  open: boolean; reference?: string; migrationId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const [value, setValue] = useState('');
  React.useEffect(() => { if (open) setValue(''); }, [open]);
  const save = useMutation({
    mutationFn: async () => (await api.post(`/poultry/stock-migration/${migrationId}/snapshot`, { reference: value })).data,
    onSuccess: () => { toast.success('Snapshot reference recorded'); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Refused'),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record the snapshot reference"
      subtitle={reference ? `Before ${reference} writes anything` : undefined}
      width={560}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || value.trim().length < 4} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Record'}
          </button>
        </>
      )}
    >
      <p className="ds-caption" style={{ marginBottom: 12 }}>
        This system does not take the snapshot — it has no backup infrastructure and will not pretend otherwise.
        Take one yourself, then record the name somebody else could find it by. Migration is refused while this is empty,
        because a migration with no way back is not a migration.
      </p>
      <FormSection title="Reference">
        <Field label="Snapshot reference" span={2} hint="e.g. the backup id, filename, or ticket the snapshot is attached to">
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="bmn-prod-2026-09-11-pre-migration" />
        </Field>
      </FormSection>
    </Modal>
  );
}

function CutOverModal({ open, report, busy, onClose, onConfirm }: {
  open: boolean; report?: Report; busy: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  React.useEffect(() => { setTyped(''); }, [open]);
  if (!report) return null;
  const phrase = report.migration.reference;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move the stock authority"
      subtitle="After this, the legacy register stops accepting stock writes and becomes history. The API is the final gate — this dialog only makes sure the move is deliberate."
      width={720}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || typed.trim() !== phrase} onClick={onConfirm}>
            {busy ? 'Cutting over…' : 'Cut over'}
          </button>
        </>
      )}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge tone="info">{AUTHORITY_LABEL[report.authority] ?? report.authority}</Badge>
        <ArrowRight size={16} style={{ color: 'var(--ink-3)' }} />
        <Badge tone="active">Shared inventory</Badge>
      </div>

      <Line label="Run" value={report.migration.reference} strong />
      <Line label="Into" value={report.migration.targetLocation?.name ?? '—'} />
      <Line label="Units" value={`${report.totals.units} (${report.totals.skipped} excluded)`} />
      <Line label="Quantity" value={`${report.totals.migratedQty} migrated of ${report.totals.legacyQty} legacy`} />
      <Line label="Value" value={`${money(report.totals.migratedValueInr)} of ${money(report.totals.legacyValueInr)}`} />
      <Line label="Unreconciled" value={String(report.totals.blocked)} strong />

      <p className="ds-caption" style={{ marginTop: 14 }}>
        Legacy transactions are preserved as evidence — nothing is deleted, and historical consumption stays
        counted so an in-flight cycle&apos;s FCR does not move. Rollback stops being available once the shared
        inventory has been built on.
      </p>

      <div style={{ marginTop: 16 }}>
        <Field label={`Type ${phrase} to confirm`} required>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={phrase} />
        </Field>
      </div>
    </Modal>
  );
}

function Line({ label: l, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontWeight: strong ? 600 : 400 }}>
      <span className="ds-caption">{l}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
