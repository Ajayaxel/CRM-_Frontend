'use client';

/**
 * Migration console panels: data audit, acknowledgements, runbook, audit
 * evidence and post-migration checks.
 *
 * Every panel renders what the server returned and nothing it inferred. The
 * severities, the decisions, the runbook statuses and the check results are
 * all computed by the API; a console that decided any of them for itself
 * would eventually disagree with the API that actually refuses.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Badge, Card, DataTable, Field, FormSection, Modal, SectionTitle, Skeleton, type DataTableColumn } from '../ui/kit';
import { fmtDate, money } from '../ui/common';

// ------------------------------------------------------------------ shared bits

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: '1px solid var(--ds-border, rgba(0,0,0,.06))' }}>
      <span className="ds-caption">{label}</span>
      <span style={{ fontWeight: strong ? 600 : 400, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const SEVERITY_TONE: Record<string, 'expired' | 'active' | undefined> = { BLOCKER: 'expired', WARNING: undefined, INFORMATIONAL: 'active' };
const DECISION_TONE: Record<string, 'expired' | 'active' | undefined> = {
  EXACT: 'active', EXPLICIT: 'active', NEW: undefined, EXCLUDED: undefined, AMBIGUOUS: 'expired', BLOCKED: 'expired',
};

const errorOf = (e: any) => e?.response?.data?.message ?? 'Refused';

// ------------------------------------------------------------------ execution banner

/**
 * The one thing the page must never let anybody misread: whether a migration
 * has actually happened. READY is a statement about what WOULD be accepted.
 */
export function ExecutionBanner({ readiness }: { readiness?: Record<string, any> }) {
  if (!readiness) return null;
  const status = readiness.companyStatus as string | undefined;
  const cutOver = !!readiness.cutOver;
  const posted = !!readiness.migrationExecuted && !cutOver;
  const tone = status === 'READY_FOR_MIGRATION' || status === 'MIGRATED' ? 'active' : status === 'BLOCKED' || posted ? 'expired' : undefined;
  const label = status === 'READY_FOR_MIGRATION' ? 'READY FOR MIGRATION'
    : status === 'NOT_ASSESSED' ? 'NOT ASSESSED'
      : status === 'MIGRATION_IN_PROGRESS' ? 'MIGRATION IN PROGRESS'
        : status === 'MIGRATED' ? 'MIGRATED' : 'BLOCKED';
  // Three distinct facts, never blurred: nothing written, opening written but
  // authority not moved, authority moved.
  const execution = cutOver ? 'MIGRATION EXECUTED' : posted ? 'OPENING POSTED · NOT CUT OVER' : 'MIGRATION NOT EXECUTED';
  return (
    <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Badge tone={tone}>{label}</Badge>
        <Badge tone={cutOver ? 'active' : posted ? 'expired' : undefined}>{execution}</Badge>
        <Badge>{readiness.environment}</Badge>
        <span className="ds-caption">
          {readiness.organization?.name} · assessment {readiness.assessmentReference}
        </span>
      </div>
      <p className="ds-caption" style={{ marginTop: 8, marginBottom: 0 }}>{readiness.note}</p>
    </Card>
  );
}

// ------------------------------------------------------------------ data audit

interface Finding { severity: string; kind: string; subject: string | null; detail: string; evidence: Record<string, unknown> }
interface Mapping {
  legacy: { itemId: string; code: string; name: string; unit: string; category: string; qty: number; valueInr: number; unitCostPaise: number; batchNo: string | null; expiryDate: string | null };
  shared: { code: string; name: string; uom: string; category: string | null } | null;
  decision: string; status: string; reason: string | null; note: string | null; conversion: null;
}
interface DataAudit {
  verdict: string; environment: string; authority: string; asOf: string; run: string | null;
  location: { code: string; name: string } | null;
  counts: { blockers: number; warnings: number; informational: number };
  positions: number; findings: Finding[]; mappings: Mapping[]; severityRule: string; note: string;
}

export function DataAuditPanel({ migrationId }: { migrationId: string | null }) {
  const [severity, setSeverity] = useState<'ALL' | 'BLOCKER' | 'WARNING' | 'INFORMATIONAL'>('ALL');
  const [evidence, setEvidence] = useState<Finding | null>(null);
  const audit = useQuery({
    queryKey: ['py', 'migration', 'data-audit', migrationId],
    queryFn: async () => (await api.get<DataAudit>('/poultry/stock-migration/data-audit', { params: migrationId ? { migrationId } : {} })).data,
  });
  const a = audit.data;
  const shown = (a?.findings ?? []).filter((f) => severity === 'ALL' || f.severity === severity);

  const mappingColumns: DataTableColumn<Mapping>[] = [
    { key: 'legacy', header: 'Legacy item', render: (m) => (
      <div>
        <strong>{m.legacy.code}</strong> · {m.legacy.name}
        <div className="ds-caption">{m.legacy.category.toLowerCase()} · {m.legacy.unit}{m.legacy.batchNo ? ` · ${m.legacy.batchNo}` : ''}</div>
      </div>
    ) },
    { key: 'derived', header: 'Derived', align: 'right', width: 150, render: (m) => (
      <div>{m.legacy.qty} {m.legacy.unit}<div className="ds-caption">{money(m.legacy.valueInr)}</div></div>
    ) },
    { key: 'shared', header: 'Shared item', render: (m) => m.shared ? (
      <div>
        <strong>{m.shared.code}</strong> · {m.shared.name}
        <div className="ds-caption">{m.shared.category ?? 'no category'} · {m.shared.uom}</div>
      </div>
    ) : <span className="ds-caption">— none —</span> },
    { key: 'calc', header: 'Quantity carried', width: 190, render: (m) => (
      // The calculation is shown even when it is trivial, so a conversion —
      // which this system does not perform — could never hide in it.
      <span className="ds-caption">
        {m.legacy.qty} {m.legacy.unit} → ×1 → {m.decision === 'BLOCKED' || m.decision === 'AMBIGUOUS' || m.decision === 'EXCLUDED' ? 'not carried' : `${m.legacy.qty} ${m.shared?.uom ?? m.legacy.unit}`}
      </span>
    ) },
    { key: 'decision', header: 'Decision', width: 120, render: (m) => <Badge tone={DECISION_TONE[m.decision]}>{m.decision}</Badge> },
  ];

  return (
    <Card>
      <SectionTitle sub="Every data-quality problem between this company and a trustworthy opening balance, with the rows it is about. Read-only — nothing is fixed automatically.">
        Data audit
      </SectionTitle>
      {audit.isLoading || !a ? <Skeleton rows={3} height={40} /> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <Badge tone={a.verdict === 'DATA_READY' ? 'active' : a.verdict === 'DATA_BLOCKED' ? 'expired' : undefined}>{a.verdict.replace(/_/g, ' ')}</Badge>
            {(['ALL', 'BLOCKER', 'WARNING', 'INFORMATIONAL'] as const).map((s) => (
              <button key={s} className={severity === s ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setSeverity(s)}>
                {s === 'ALL' ? `All (${a.findings.length})` : `${s.toLowerCase()} (${s === 'BLOCKER' ? a.counts.blockers : s === 'WARNING' ? a.counts.warnings : a.counts.informational})`}
              </button>
            ))}
          </div>
          <p className="ds-caption" style={{ marginBottom: 10 }}>
            <strong>How to read this.</strong> {a.severityRule} A warning never stops a migration and a blocker always does —
            if something here looks like the wrong severity, that is a question for a person, not something to click past.
          </p>
          {shown.length === 0 ? <p className="ds-caption">No findings at this severity.</p> : (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {shown.map((f, i) => (
                <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--ds-border, rgba(0,0,0,.06))' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge>
                    <strong>{f.kind}</strong>
                    {f.subject && <span className="ds-caption">{f.subject}</span>}
                    <button className="btn-ghost btn-sm" onClick={() => setEvidence(f)}>Evidence</button>
                  </div>
                  <div className="ds-caption" style={{ marginTop: 4 }}>{f.detail}</div>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 16 }}>
            <SectionTitle sub="Both sides of every mapping, the decision the server reached, and the quantity carried. Unit conversion is not performed: a unit that disagrees is BLOCKED.">
              Mapping evidence
            </SectionTitle>
            <DataTable rows={a.mappings} rowKey={(m) => `${m.legacy.itemId}-${m.legacy.batchNo ?? ''}`} dense columns={mappingColumns} />
          </div>
          <p className="ds-caption" style={{ marginTop: 8 }}>{a.note}</p>
        </>
      )}
      <Modal open={!!evidence} onClose={() => setEvidence(null)} title={evidence ? `${evidence.kind}${evidence.subject ? ` · ${evidence.subject}` : ''}` : ''} width={720}
        footer={<button className="btn-secondary" onClick={() => setEvidence(null)}>Close</button>}>
        {evidence && (
          <>
            <p>{evidence.detail}</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, overflowX: 'auto', background: 'var(--ds-surface-2, rgba(0,0,0,.03))', padding: 12, borderRadius: 8 }}>
              {JSON.stringify(evidence.evidence, null, 2)}
            </pre>
          </>
        )}
      </Modal>
    </Card>
  );
}

// ------------------------------------------------------------------ acknowledgements

interface Ack {
  kind: 'ENVIRONMENT' | 'OPERATOR' | 'MAINTENANCE_WINDOW'; missing: boolean; by: string | null; at: string | null;
  assessmentReference: string | null; environment: string | null; windowStart: string | null; windowEnd: string | null; stale: boolean;
}

const ACK_LABEL: Record<Ack['kind'], string> = {
  ENVIRONMENT: 'Environment confirmed',
  OPERATOR: 'Authorised operator confirmed',
  MAINTENANCE_WINDOW: 'Maintenance window acknowledged',
};

export function AcknowledgementsPanel({ migrationId, readiness, editable }: { migrationId: string | null; readiness?: Record<string, any>; editable: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Ack['kind'] | null>(null);
  const [environment, setEnvironment] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const acks = (readiness?.acknowledgements ?? []) as Ack[];

  const save = useMutation({
    mutationFn: async () => (await api.post(`/poultry/stock-migration/${migrationId}/acknowledge`, {
      kind: open,
      ...(open === 'ENVIRONMENT' ? { environment } : {}),
      ...(open === 'MAINTENANCE_WINDOW' ? { windowStart: start ? new Date(start).toISOString() : undefined, windowEnd: end ? new Date(end).toISOString() : undefined } : {}),
    })).data,
    onSuccess: () => { toast.success('Acknowledgement recorded against the current assessment'); setOpen(null); qc.invalidateQueries({ queryKey: ['py'] }); },
    onError: (e: any) => toast.error(errorOf(e)),
  });

  if (!migrationId) return null;
  return (
    <Card>
      <SectionTitle sub="What only a person can confirm. Each is recorded against the assessment as it stands, and goes stale the moment the run changes — a confirmation of a different migration is not a confirmation of this one.">
        Safety acknowledgements
      </SectionTitle>
      {acks.length === 0 ? <p className="ds-caption">No run selected.</p> : acks.map((a) => (
        <div key={a.kind} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--ds-border, rgba(0,0,0,.06))' }}>
          <div>
            <strong>{ACK_LABEL[a.kind]}</strong>
            <div className="ds-caption">
              {a.missing ? 'not acknowledged'
                : `${a.kind === 'ENVIRONMENT' ? `${a.environment} · ` : ''}${a.kind === 'MAINTENANCE_WINDOW' ? `${a.windowStart} → ${a.windowEnd} · ` : ''}by ${a.by} · ${a.at ? fmtDate(a.at) : ''} · against ${a.assessmentReference}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone={a.missing ? undefined : a.stale ? 'expired' : 'active'}>{a.missing ? (editable ? 'PENDING' : 'NOT RECORDED') : a.stale ? 'STALE' : 'CONFIRMED'}</Badge>
            {editable && <button className="btn-secondary btn-sm" onClick={() => { setOpen(a.kind); setEnvironment(''); setStart(''); setEnd(''); }}>{a.missing ? 'Confirm' : 'Confirm again'}</button>}
          </div>
        </div>
      ))}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? ACK_LABEL[open] : ''} width={520}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setOpen(null)}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Recording…' : 'Record'}</button>
          </>
        )}>
        {open === 'ENVIRONMENT' && (
          <FormSection title="Type the environment">
            <Field label="Environment" span={2} hint={`This server reports ${readiness?.environment}. Type it — the server refuses any other name.`}>
              <input className="input" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="LOCAL, STAGING or PRODUCTION" />
            </Field>
          </FormSection>
        )}
        {open === 'OPERATOR' && (
          <p>You are confirming that you are the authorised operator executing this migration. It is recorded against your login and the current assessment.</p>
        )}
        {open === 'MAINTENANCE_WINDOW' && (
          <FormSection title="Window">
            <Field label="Starts"><input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Ends"><input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </FormSection>
        )}
      </Modal>
    </Card>
  );
}

// ------------------------------------------------------------------ runbook

interface RunbookStep { n: number; step: string; status: string; evidence: string }
interface Runbook { steps: RunbookStep[]; nextStep: RunbookStep | null; companyStatus: string; migrationExecuted: boolean; note: string; run: { reference: string } | null }

const STEP_TONE: Record<string, 'active' | 'expired' | undefined> = {
  DONE: 'active', DONE_BY_DRY_RUN: 'active', BLOCKED: 'expired', STALE: 'expired', FAILED: 'expired',
};

export function RunbookPanel({ migrationId }: { migrationId: string | null }) {
  const runbook = useQuery({
    queryKey: ['py', 'migration', 'runbook', migrationId],
    queryFn: async () => (await api.get<Runbook>('/poultry/stock-migration/runbook', { params: migrationId ? { migrationId } : {} })).data,
  });
  const r = runbook.data;
  return (
    <Card>
      <SectionTitle sub="The first-company migration, as nineteen checks derived from the server's own state. Nothing here executes; it tells you where you are.">
        Runbook
      </SectionTitle>
      {runbook.isLoading || !r ? <Skeleton rows={4} height={28} /> : (
        <>
          {r.nextStep && (
            <p style={{ marginTop: 0 }}>
              <strong>Next:</strong> step {r.nextStep.n} — {r.nextStep.step} <span className="ds-caption">({r.nextStep.status.replace(/_/g, ' ').toLowerCase()})</span>
            </p>
          )}
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {r.steps.map((s) => (
              <li key={s.n} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--ds-border, rgba(0,0,0,.06))' }}>
                <span className="ds-caption">{s.n}</span>
                <div>{s.step}<div className="ds-caption">{s.evidence}</div></div>
                <Badge tone={STEP_TONE[s.status]}>{s.status.replace(/_/g, ' ')}</Badge>
              </li>
            ))}
          </ol>
          <p className="ds-caption" style={{ marginTop: 8 }}>{r.note}</p>
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ evidence

export function EvidencePanel({ migrationId }: { migrationId: string | null }) {
  const evidence = useQuery({
    queryKey: ['py', 'migration', 'evidence', migrationId],
    queryFn: async () => (await api.get<Record<string, any>>(`/poultry/stock-migration/${migrationId}/evidence`)).data,
    enabled: !!migrationId,
  });
  if (!migrationId) return null;
  const e = evidence.data;
  return (
    <Card>
      <SectionTitle sub="What happened, who did it, when, and why the system accepted it — re-derived from the rows and the audit log, never read off a success flag.">
        Audit evidence
      </SectionTitle>
      {evidence.isLoading || !e ? <Skeleton rows={3} height={28} /> : (
        <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <Row label="Run" value={e.run?.reference} strong />
            <Row label="Status" value={e.run?.status} />
            <Row label="Planned in" value={e.execution?.environment ?? '—'} />
            <Row label="Server now" value={e.execution?.environmentNow} />
            <Row label="Snapshot" value={e.execution?.snapshotReference ?? 'not recorded'} />
            <Row label="Planned by" value={e.execution?.plannedBy ?? '—'} />
            <Row label="Dry run" value={e.execution?.dryRunAt ? `${fmtDate(e.execution.dryRunAt)} · ${e.execution?.dryRun?.verdict}` : 'none'} />
          </div>
          <div>
            <Row label="Authority now" value={e.authority?.current} strong />
            <Row label="Transitions" value={String(e.authority?.transitions?.length ?? 0)} />
            <Row label="Mapping decisions" value={String(e.mappingDecisions?.length ?? 0)} />
            <Row label="Opening movements" value={String(e.generatedMovements?.length ?? 0)} />
            <Row label="Reconciliation" value={e.reconciliation?.verdict} />
            <Row label="Rollback" value={e.rollback?.available ? 'available' : `unavailable${e.rollback?.reason ? ` — ${e.rollback.reason}` : ''}`} />
            <Row label="Audit rows" value={String(e.auditTrail?.length ?? 0)} />
          </div>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ post-migration checks

interface PostCheck { check: string; result: string; detail: string; evidence: Record<string, unknown> }

export function PostMigrationChecksPanel({ migrationId }: { migrationId: string | null }) {
  const checks = useQuery({
    queryKey: ['py', 'migration', 'post-checks', migrationId],
    queryFn: async () => (await api.get<{ verdict: string; executed: boolean; checks: PostCheck[]; note: string }>(`/poultry/stock-migration/${migrationId}/post-migration-checks`)).data,
    enabled: !!migrationId,
  });
  if (!migrationId) return null;
  const c = checks.data;
  return (
    <Card>
      <SectionTitle sub="After cutover: did the migration do what it said, and only that? Read-only. A failure is reported with its evidence; nothing is repaired.">
        Post-migration checks
      </SectionTitle>
      {checks.isLoading || !c ? <Skeleton rows={3} height={28} /> : !c.executed ? (
        <>
          <Badge>NOT APPLICABLE — NOT CUT OVER</Badge>
          <p className="ds-caption" style={{ marginTop: 8 }}>{c.note}</p>
        </>
      ) : (
        <>
          <Badge tone={c.verdict === 'PASS' ? 'active' : 'expired'}>{c.verdict}</Badge>
          <ul style={{ margin: '10px 0 0', paddingLeft: 0, listStyle: 'none' }}>
            {c.checks.map((x) => (
              <li key={x.check} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--ds-border, rgba(0,0,0,.06))' }}>
                <div><strong>{x.check}</strong><div className="ds-caption">{x.detail}</div></div>
                <Badge tone={x.result === 'PASS' ? 'active' : x.result === 'FAIL' ? 'expired' : undefined}>{x.result}</Badge>
              </li>
            ))}
          </ul>
          <p className="ds-caption" style={{ marginTop: 8 }}>{c.note}</p>
        </>
      )}
    </Card>
  );
}
