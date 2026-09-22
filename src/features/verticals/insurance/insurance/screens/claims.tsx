'use client';

/**
 * Claims & Commission — the two money-and-paperwork screens of the insurance
 * console, rebuilt on the shared kit.
 *
 * Claims are a card grid: a claim is a story about one incident, and a table
 * row cannot carry a checklist. Commission stays a table, because reconciling
 * a book of numbers against an insurer's statement is genuinely tabular — the
 * work was making that table calm rather than replacing it.
 *
 * Endpoints and react-query keys are unchanged from the previous console.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  BarChart3, Building2, Check, CircleCheck, FileText, Percent,
  Plus, Send, ShieldCheck, Wallet,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import {
  BarList, Badge, Card, Drawer, EmptyState, Field, FormSection, Segmented,
  Skeleton, StatCard, Stepper, Toolbar, humanStatus, toneForClaimStatus,
  type Tone,
} from '../ui/kit';
import { InsuranceClaimsBoard } from './claims-board';

const money = (n?: number | null) => fmtOrgMoney(n);

const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** Fill the remaining width of a Toolbar so trailing actions sit right. */
const spacer = <span style={{ flex: 1 }} />;

// ============================================================ Claims

const CLAIM_STEPS = ['Registered', 'Documents', 'Submitted', 'Under review', 'Approved', 'Settled'];

/** Where a claim sits on the lifecycle rail. */
function stepFor(status?: string) {
  switch ((status ?? '').toUpperCase()) {
    case 'DOCS_PENDING': return 1;
    case 'REGISTERED': return 2;
    case 'SUBMITTED': return 2;
    case 'UNDER_REVIEW': return 3;
    case 'REJECTED': return 3;
    case 'APPROVED': return 4;
    case 'SETTLED': return 5;
    default: return 0;
  }
}

const CLAIM_FILTERS: { label: string; statuses: string[] }[] = [
  { label: 'All', statuses: [] },
  { label: 'Documents', statuses: ['DOCS_PENDING'] },
  { label: 'In progress', statuses: ['REGISTERED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
  { label: 'Settled', statuses: ['SETTLED'] },
  { label: 'Rejected', statuses: ['REJECTED'] },
];

/** Docs are only collectable before the file goes to the insurer. */
const docsEditable = (status?: string) => ['DOCS_PENDING', 'REGISTERED'].includes((status ?? '').toUpperCase());

/**
 * The server resolves each slot against real Document rows: `satisfied` is the
 * truth (file, referenced document, or manual tick), `received` is only the
 * manual flag — and the display fallback when an older API answers.
 */
type Doc = { key: string; label: string; received?: boolean; satisfied?: boolean; source?: string | null };
const slotIn = (d: Doc) => d.satisfied ?? !!d.received;
const docsOf = (claim: any): Doc[] => (Array.isArray(claim?.docs) ? (claim.docs as Doc[]) : []);
const allDocsIn = (claim: any) => { const d = docsOf(claim); return d.length > 0 && d.every(slotIn); };

/** A tickable document — a chip, not a checkbox in a list. */
function DocChip({
  doc, disabled, onToggle,
}: { doc: Doc; disabled?: boolean; onToggle: (received: boolean) => void }) {
  const done = slotIn(doc);
  // A slot answered by an actual file cannot be unticked from a chip — the
  // file is the evidence, and removing it is the claim page's job.
  const fileBacked = !!doc.satisfied && doc.source !== 'manual';
  return (
    <button
      type="button"
      disabled={disabled || fileBacked}
      aria-pressed={done}
      title={fileBacked ? 'Satisfied by a document — manage it on the claim page' : undefined}
      onClick={(e) => { e.stopPropagation(); onToggle(!doc.received); }}
      className={`ds-badge ${done ? 'ds-tone-active' : 'ds-tone-neutral'}`}
      style={{
        fontFamily: 'inherit',
        padding: '6px var(--s-3)',
        cursor: disabled || fileBacked ? 'default' : 'pointer',
        opacity: disabled && !done ? 0.6 : 1,
        transition: 'background 130ms ease, color 130ms ease, border-color 130ms ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 13, height: 13, borderRadius: 4, flex: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${done ? 'currentColor' : 'var(--hairline-strong)'}`,
          background: done ? 'currentColor' : 'transparent',
          color: done ? 'var(--surface)' : 'inherit',
        }}
      >
        {done && <Check size={9} strokeWidth={3.5} />}
      </span>
      {doc.label}
    </button>
  );
}

function DocChecklist({
  claim, onTick, busy,
}: { claim: any; onTick: (key: string, received: boolean) => void; busy?: boolean }) {
  const docs = docsOf(claim);
  if (!docs.length) return null;
  const done = docs.filter(slotIn).length;
  const locked = !docsEditable(claim.status) || !!busy;
  return (
    <div>
      <div className="ds-caption" style={{ marginBottom: 'var(--s-2)' }}>
        Documents {done}/{docs.length}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
        {docs.map((d) => (
          <DocChip key={d.key} doc={d} disabled={locked} onToggle={(r) => onTick(d.key, r)} />
        ))}
      </div>
    </div>
  );
}

function ClaimCard({
  claim, onOpen, onTick, onSubmit, busy,
}: {
  claim: any; onOpen: () => void; onTick: (key: string, received: boolean) => void;
  onSubmit: () => void; busy?: boolean;
}) {
  const ready = allDocsIn(claim) && docsEditable(claim.status);
  return (
    <Card interactive onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-3)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h3">{claim.claimNo}</div>
          <div className="ds-caption" style={{ marginTop: 3 }}>
            {claim.policy?.client?.name ?? 'Client'} · {claim.policy?.policyNo ?? ''}
          </div>
        </div>
        <Badge tone={toneForClaimStatus(claim.status)}>{humanStatus(claim.status)}</Badge>
      </div>

      {claim.description && (
        <p
          className="ds-small"
          style={{
            margin: 'var(--s-3) 0 0', color: 'var(--ink-2)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >{claim.description}</p>
      )}

      <div className="ds-caption" style={{ marginTop: 'var(--s-3)' }}>
        Incident {fmtDate(claim.incidentDate)}
      </div>

      {claim.settledInr != null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)', marginTop: 'var(--s-2)' }}>
          <span className="ds-caption">Settled</span>
          <span className="ds-h3 ds-num" style={{ color: 'var(--tone-active)' }}>{money(claim.settledInr)}</span>
        </div>
      )}

      <hr className="ds-divider" style={{ margin: 'var(--s-4) 0' }} />

      <div onClick={(e) => e.stopPropagation()}>
        <DocChecklist claim={claim} onTick={onTick} busy={busy} />
        {ready && (
          <button
            className="btn-primary btn-sm"
            style={{ marginTop: 'var(--s-4)', width: '100%' }}
            disabled={busy}
            onClick={onSubmit}
          ><Send size={13} /> Submit to insurer</button>
        )}
      </div>
    </Card>
  );
}

export function InsuranceClaims() {
  const qc = useQueryClient();
  const params = useSearchParams();

  const { data: claims, isLoading } = useQuery({
    queryKey: ['ins-claims'],
    queryFn: async () => (await api.get<any[]>('/insurance/claims')).data,
  });
  const { data: policies } = useQuery({
    queryKey: ['ins-policies'],
    queryFn: async () => (await api.get<any[]>('/insurance/policies')).data,
  });

  // Board is the working view — the stage machine with its SLA clocks; List is
  // the same book as cards, for reading rather than moving.
  const [view, setView] = useState('Board');
  const [filter, setFilter] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({ policyId: '', description: '', incidentDate: new Date().toISOString().slice(0, 10) });
  const [settleAmt, setSettleAmt] = useState('');

  // Deep link: /…/claims?new=1 opens the register drawer straight away.
  useEffect(() => { if (params?.get('new') === '1') setRegisterOpen(true); }, [params]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ins-claims'] });
    // The board reads the same book through the stage endpoint.
    qc.invalidateQueries({ queryKey: ['ins-claims-board'] });
  };

  const register = useMutation({
    mutationFn: () => api.post(`/insurance/policies/${form.policyId}/claims`, {
      incidentDate: form.incidentDate, description: form.description,
    }),
    onSuccess: () => {
      toast.success('Claim registered — collect the document checklist');
      setForm({ policyId: '', description: '', incidentDate: new Date().toISOString().slice(0, 10) });
      setRegisterOpen(false);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const tick = useMutation({
    mutationFn: ({ id, key, received }: { id: string; key: string; received: boolean }) =>
      api.patch(`/insurance/claims/${id}/docs`, { key, received }),
    onSuccess: refresh,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const submit = useMutation({
    mutationFn: (id: string) => api.post(`/insurance/claims/${id}/submit`, {}),
    onSuccess: () => { toast.success('Submitted to the insurer'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status, settledInr }: { id: string; status: string; settledInr?: number }) =>
      api.patch(`/insurance/claims/${id}/status`, { status, ...(settledInr != null ? { settledInr } : {}) }),
    onSuccess: (_r, v) => {
      toast.success(v.status === 'SETTLED' ? 'Settlement recorded' : `Marked ${humanStatus(v.status).toLowerCase()}`);
      setSettleAmt('');
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rows = claims ?? [];
  const shown = useMemo(() => {
    const f = CLAIM_FILTERS.find((x) => x.label === filter);
    if (!f || f.statuses.length === 0) return rows;
    return rows.filter((c) => f.statuses.includes(String(c.status).toUpperCase()));
  }, [rows, filter]);

  const selected = openId ? rows.find((c) => c.id === openId) : undefined;
  const busy = tick.isPending || submit.isPending || setStatus.isPending;
  const activePolicies = (policies ?? []).filter((p) => p.status === 'ACTIVE');
  const closeRegister = () => setRegisterOpen(false);

  const statusButtons = (claim: any) => {
    const s = String(claim.status).toUpperCase();
    const canReview = s === 'SUBMITTED';
    const canApprove = s === 'SUBMITTED' || s === 'UNDER_REVIEW';
    const canSettle = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(s);
    if (!canReview && !canApprove && !canSettle) {
      return (
        <div className="ds-caption">
          {s === 'SETTLED' ? 'Settled and closed — nothing further to do.'
            : s === 'REJECTED' ? 'The insurer rejected this claim.'
              : 'Collect the documents, then submit the file to the insurer.'}
        </div>
      );
    }
    return (
      <div className="ds-stack">
        <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          {canReview && (
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => setStatus.mutate({ id: claim.id, status: 'UNDER_REVIEW' })}>Mark under review</button>
          )}
          {canApprove && (
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => setStatus.mutate({ id: claim.id, status: 'APPROVED' })}>Approve</button>
          )}
          {canSettle && (
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => setStatus.mutate({ id: claim.id, status: 'REJECTED' })}>Reject</button>
          )}
        </div>
        {canSettle && (
          <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Field label="Settlement amount" hint="What the insurer actually paid out.">
                <input
                  className="input" inputMode="numeric" placeholder="0"
                  value={settleAmt}
                  onChange={(e) => setSettleAmt(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </Field>
            </div>
            <button
              className="btn-primary"
              disabled={busy || !Number(settleAmt)}
              onClick={() => setStatus.mutate({ id: claim.id, status: 'SETTLED', settledInr: Number(settleAmt) })}
            >Record settlement</button>
          </div>
        )}
      </div>
    );
  };

  const listView = (
    <div className="ds-stack">
      <Toolbar>
        <Segmented options={CLAIM_FILTERS.map((f) => f.label)} value={filter} onChange={setFilter} />
        {spacer}
        <button className="btn-primary" onClick={() => setRegisterOpen(true)}>
          <Plus size={15} /> Register claim
        </button>
      </Toolbar>

      {isLoading ? (
        <Skeleton rows={4} height={186} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No claims — and long may that continue."
            body="When a client does need to claim, register it here and the document checklist builds itself."
            actionLabel="Register claim"
            onAction={() => setRegisterOpen(true)}
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState compact icon={FileText} title="Nothing at this stage" body="Every claim is somewhere else in the lifecycle right now." />
        </Card>
      ) : (
        <div className="ds-grid ds-grid-cards">
          {shown.map((c) => (
            <ClaimCard
              key={c.id}
              claim={c}
              busy={busy}
              onOpen={() => setOpenId(c.id)}
              onTick={(key, received) => tick.mutate({ id: c.id, key, received })}
              onSubmit={() => submit.mutate(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="ds-stack">
      <Toolbar>
        <Segmented options={['Board', 'List']} value={view} onChange={setView} />
        {/* The list view carries its own Register button; the board would otherwise
            leave no way to open a claim from this screen. */}
        {view === 'Board' && (
          <>
            {spacer}
            <button className="btn-primary" onClick={() => setRegisterOpen(true)}>
              <Plus size={15} /> Register claim
            </button>
          </>
        )}
      </Toolbar>

      {view === 'Board' ? <InsuranceClaimsBoard /> : listView}

      {/* ---------------------------------------------------------- claim detail */}
      <Drawer
        open={!!selected}
        onClose={() => { setOpenId(null); setSettleAmt(''); }}
        width={620}
        title={selected?.claimNo ?? 'Claim'}
        subtitle={selected ? `${selected.policy?.client?.name ?? 'Client'} · ${selected.policy?.policyNo ?? ''}` : undefined}
        actions={selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flex: 'none' }}>
            <Badge tone={toneForClaimStatus(selected.status)}>{humanStatus(selected.status)}</Badge>
            <Link className="btn-secondary btn-sm" href={`/insurance/claims/${selected.id}`}>Open full claim</Link>
          </div>
        ) : undefined}
      >
        {selected && (
          <div className="ds-stack" style={{ gap: 'var(--s-6)' }}>
            <Card>
              <Stepper steps={CLAIM_STEPS} current={stepFor(selected.status)} />
            </Card>

            <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              {[
                { label: 'Incident date', value: fmtDate(selected.incidentDate) },
                { label: 'Insurer', value: selected.policy?.companyName ?? '—' },
                { label: 'Insurer reference', value: selected.insurerRef ?? '—' },
                {
                  label: 'Settled',
                  value: selected.settledInr != null ? money(selected.settledInr) : '—',
                  tone: selected.settledInr != null ? 'active' as Tone : undefined,
                },
              ].map((f) => (
                <div key={f.label}>
                  <div className="ds-caption">{f.label}</div>
                  <div className="ds-h3 ds-num" style={{ marginTop: 3, color: f.tone ? `var(--tone-${f.tone})` : undefined }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            {selected.description && (
              <div>
                <div className="ds-caption" style={{ marginBottom: 'var(--s-2)' }}>What happened</div>
                <p className="ds-body" style={{ margin: 0 }}>{selected.description}</p>
              </div>
            )}

            <div>
              <DocChecklist
                claim={selected}
                busy={busy}
                onTick={(key, received) => tick.mutate({ id: selected.id, key, received })}
              />
              {allDocsIn(selected) && docsEditable(selected.status) && (
                <button
                  className="btn-primary"
                  style={{ marginTop: 'var(--s-4)' }}
                  disabled={busy}
                  onClick={() => submit.mutate(selected.id)}
                ><Send size={14} /> Submit to insurer</button>
              )}
            </div>

            <div>
              <div className="ds-caption" style={{ marginBottom: 'var(--s-3)' }}>Move this claim on</div>
              {statusButtons(selected)}
            </div>
          </div>
        )}
      </Drawer>

      {/* ---------------------------------------------------------- register */}
      <Drawer
        open={registerOpen}
        onClose={closeRegister}
        title="Register a claim"
        subtitle="One incident, one file — the checklist is built from the product."
      >
        <FormSection title="The incident" description="Pick the policy the incident falls under.">
          <Field label="Policy" required span={2}>
            <select className="input" value={form.policyId} onChange={(e) => setForm({ ...form, policyId: e.target.value })}>
              <option value="">Select a policy…</option>
              {activePolicies.map((p) => (
                <option key={p.id} value={p.id}>{p.policyNo} — {p.client?.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Incident date" required>
            <input type="date" className="input" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} />
          </Field>
        </FormSection>

        <FormSection title="The account" description="What the client told you, in their words where you can.">
          <Field label="What happened" required span={2} hint="The insurer reads this first — keep it factual and specific.">
            <textarea
              className="input" rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Rear-ended at a signal on the Sheikh Zayed Road; no injuries, bumper and boot damaged."
            />
          </Field>
        </FormSection>

        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          <button
            className="btn-primary"
            disabled={!form.policyId || !form.description.trim() || register.isPending}
            onClick={() => register.mutate()}
          >Register claim</button>
          <button className="btn-secondary" onClick={closeRegister}>Cancel</button>
        </div>
      </Drawer>
    </div>
  );
}

// ============================================================ Commission

const COMM_FILTERS: { label: string; status: string | null }[] = [
  { label: 'All', status: null },
  { label: 'Accrued', status: 'ACCRUED' },
  { label: 'Receivable', status: 'RECEIVABLE' },
  { label: 'Paid', status: 'PAID' },
  { label: 'Short', status: 'SHORT' },
];

function toneForCommissionStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'PAID': return 'active';
    case 'SHORT': return 'expired';
    case 'RECEIVABLE': return 'renewal';
    case 'ACCRUED': return 'info';
    default: return 'neutral';
  }
}

export function InsuranceCommission() {
  const qc = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ['ins-comm'],
    queryFn: async () => (await api.get<any[]>('/insurance/commissions')).data,
  });
  const { data: report } = useQuery({
    queryKey: ['ins-comm-report'],
    queryFn: async () => (await api.get<any>('/insurance/commissions/report')).data,
  });

  const [filter, setFilter] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [rec, setRec] = useState({ receivedInr: '', statementRef: '' });

  const reconcile = useMutation({
    mutationFn: ({ id, receivedInr, statementRef }: { id: string; receivedInr: number; statementRef: string }) =>
      api.post(`/insurance/commissions/${id}/reconcile`, { receivedInr, statementRef }),
    onSuccess: () => {
      toast.success('Reconciled — banked, TDS parked, receivable cleared');
      setOpenId(null);
      setRec({ receivedInr: '', statementRef: '' });
      qc.invalidateQueries({ queryKey: ['ins-comm'] });
      qc.invalidateQueries({ queryKey: ['ins-comm-report'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const all = rows ?? [];
  const totals = useMemo(() => all.reduce(
    (a, r) => ({
      gross: a.gross + (r.grossInr ?? 0),
      tds: a.tds + (r.tdsInr ?? 0),
      receivable: a.receivable + (['ACCRUED', 'RECEIVABLE', 'SHORT'].includes(String(r.status).toUpperCase())
        ? Math.max((r.netInr ?? 0) - (r.receivedInr ?? 0), 0) : 0),
      received: a.received + (r.receivedInr ?? 0),
      openCount: a.openCount + (['ACCRUED', 'RECEIVABLE'].includes(String(r.status).toUpperCase()) ? 1 : 0),
      paidCount: a.paidCount + (String(r.status).toUpperCase() === 'PAID' ? 1 : 0),
    }),
    { gross: 0, tds: 0, receivable: 0, received: 0, openCount: 0, paidCount: 0 },
  ), [all]);

  const shown = useMemo(() => {
    const f = COMM_FILTERS.find((x) => x.label === filter);
    if (!f?.status) return all;
    return all.filter((r) => String(r.status).toUpperCase() === f.status);
  }, [all, filter]);

  const selected = openId ? all.find((r) => r.id === openId) : undefined;

  const openRow = (row: any) => {
    setOpenId(row.id);
    setRec({
      receivedInr: String(Math.max((row.netInr ?? 0) - (row.receivedInr ?? 0), 0) || row.netInr || ''),
      statementRef: row.statementRef ?? '',
    });
  };

  return (
    <div className="ds-stack">
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Gross accrued" value={money(totals.gross)} icon={Wallet} tone="info"
          deltaLabel={`${all.length} policies`} />
        <StatCard label="TDS withheld" value={money(totals.tds)} icon={Percent} tone="neutral"
          deltaLabel="parked against the return" />
        <StatCard label="Net receivable" value={money(totals.receivable)} icon={FileText} tone="renewal"
          deltaLabel={`${totals.openCount} awaiting payout`} />
        <StatCard label="Received" value={money(totals.received)} icon={CircleCheck} tone="active"
          deltaLabel={`${totals.paidCount} reconciled`} />
      </div>

      <Toolbar>
        <Segmented options={COMM_FILTERS.map((f) => f.label)} value={filter} onChange={setFilter} />
        {spacer}
        <button className="btn-secondary" onClick={() => setReportOpen(true)}>
          <BarChart3 size={15} /> Commission report
        </button>
      </Toolbar>

      {isLoading ? (
        <Skeleton rows={5} height={46} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={all.length === 0 ? 'No commission accrued yet' : 'Nothing with this status'}
            body={all.length === 0
              ? 'Issue or renew a policy and the brokerage lands here, ready to reconcile against the insurer statement.'
              : 'Try another status — the rest of the book is elsewhere.'}
            compact={all.length > 0}
          />
        </Card>
      ) : (
        <Card flush>
          <div className="ds-scroll-x" style={{ padding: 'var(--s-4) var(--s-2) var(--s-1)' }}>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Client</th>
                  <th>Insurer</th>
                  <th>Status</th>
                  <th className="ds-col-num">Gross</th>
                  <th className="ds-col-num">Executive</th>
                  <th className="ds-col-num">TDS</th>
                  <th className="ds-col-num">Net</th>
                  <th className="ds-col-num">Received</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openRow(c)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') openRow(c); }}
                  >
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.policy?.policyNo ?? '—'}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{c.policy?.client?.name ?? '—'}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{c.policy?.companyName ?? '—'}</td>
                    <td><Badge tone={toneForCommissionStatus(c.status)}>{humanStatus(c.status)}</Badge></td>
                    <td className="ds-col-num">{money(c.grossInr)}</td>
                    <td className="ds-col-num" style={{ color: 'var(--ink-3)' }}>{money(c.execInr)}</td>
                    <td className="ds-col-num" style={{ color: 'var(--ink-3)' }}>{money(c.tdsInr)}</td>
                    <td className="ds-col-num" style={{ fontWeight: 650 }}>{money(c.netInr)}</td>
                    <td className="ds-col-num" style={{ color: c.receivedInr ? 'var(--tone-active)' : 'var(--ink-3)' }}>
                      {c.receivedInr != null ? money(c.receivedInr) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------------- reconcile */}
      <Drawer
        open={!!selected}
        onClose={() => setOpenId(null)}
        title={selected?.policy?.policyNo ?? 'Commission'}
        subtitle={selected ? `${selected.policy?.client?.name ?? ''} · ${selected.policy?.companyName ?? ''}` : undefined}
        actions={selected ? <Badge tone={toneForCommissionStatus(selected.status)}>{humanStatus(selected.status)}</Badge> : undefined}
      >
        {selected && (
          <div className="ds-stack" style={{ gap: 'var(--s-6)' }}>
            <Card>
              {[
                ['Gross brokerage', money(selected.grossInr)],
                ['Executive share', money(selected.execInr)],
                ['TDS withheld', money(selected.tdsInr)],
                ['Net receivable', money(selected.netInr)],
                ['Received', selected.receivedInr != null ? money(selected.receivedInr) : '—'],
                ['Statement reference', selected.statementRef ?? '—'],
                ['Paid on', selected.paidAt ? fmtDate(selected.paidAt) : '—'],
              ].map(([label, value]) => (
                <div className="ds-list-row" key={label}>
                  <span className="ds-small">{label}</span>
                  <span className="ds-list-row-meta">{value}</span>
                </div>
              ))}
            </Card>

            {String(selected.status).toUpperCase() === 'PAID' ? (
              <div className="ds-caption">
                Reconciled against {selected.statementRef ?? 'the insurer statement'} — this line is closed.
              </div>
            ) : (
              <div>
                <FormSection
                  title="Reconcile against the statement"
                  description="Enter what actually landed. Anything short of the net stays open and flags SHORT."
                >
                  <Field label="Amount received" required>
                    <input
                      className="input" inputMode="numeric" placeholder="0"
                      value={rec.receivedInr}
                      onChange={(e) => setRec({ ...rec, receivedInr: e.target.value.replace(/[^\d.]/g, '') })}
                    />
                  </Field>
                  <Field label="Statement reference" required hint="The insurer's payout statement, e.g. STMT-2026-07.">
                    <input
                      className="input" placeholder="STMT-2026-07"
                      value={rec.statementRef}
                      onChange={(e) => setRec({ ...rec, statementRef: e.target.value })}
                    />
                  </Field>
                </FormSection>
                <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
                  <button
                    className="btn-primary"
                    disabled={reconcile.isPending || !Number(rec.receivedInr) || !rec.statementRef.trim()}
                    onClick={() => reconcile.mutate({
                      id: selected.id,
                      receivedInr: Number(rec.receivedInr),
                      statementRef: rec.statementRef.trim(),
                    })}
                  >Reconcile</button>
                  <button className="btn-secondary" onClick={() => setOpenId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ---------------------------------------------------------- report */}
      <Drawer
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Commission report"
        subtitle="Pending, banked and short — then the same book split by insurer and by executive."
        width={600}
      >
        {!report ? (
          <Skeleton rows={3} height={92} />
        ) : (
          <div className="ds-stack" style={{ gap: 'var(--s-6)' }}>
            <div className="ds-grid ds-grid-kpi">
              <StatCard label="Pending" value={money(report.pending?.netInr)} tone="renewal"
                deltaLabel={`${report.pending?.count ?? 0} policies`} />
              <StatCard label="Paid" value={money(report.paid?.netInr)} tone="active"
                deltaLabel={`${report.paid?.count ?? 0} policies`} />
              <StatCard label="Short" value={money(report.short?.netInr)} tone="expired"
                deltaLabel={`${report.short?.count ?? 0} flagged`} />
            </div>

            {report.byCompany?.length > 0 && (
              <div>
                <div className="ds-caption" style={{ marginBottom: 'var(--s-3)' }}>
                  <Building2 size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
                  Gross brokerage by insurer
                </div>
                <BarList
                  format={money}
                  items={report.byCompany.map((c: any) => ({
                    label: c.name, value: c.grossInr, tone: 'info' as Tone, meta: `${c.count} policies`,
                  }))}
                />
              </div>
            )}

            {report.byExecutive?.length > 0 && (
              <div>
                <div className="ds-caption" style={{ marginBottom: 'var(--s-3)' }}>Executive share earned</div>
                <BarList
                  format={money}
                  items={report.byExecutive.map((e: any) => ({
                    label: e.name, value: e.execInr, tone: 'sales' as Tone, meta: `${e.count} policies`,
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
