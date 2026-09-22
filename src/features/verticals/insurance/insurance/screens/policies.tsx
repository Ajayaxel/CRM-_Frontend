'use client';

/**
 * Insurance — the policy book and the renewal pipeline.
 *
 * Two screens, one domain: `InsurancePolicies` is the whole book as a card
 * grid (a broker reads a policy as an object, not a spreadsheet row), and
 * `InsuranceRenewals` is the same data arranged as the work that has to
 * happen before each expiry date.
 *
 * Endpoints and react-query keys are the ones the live console already uses,
 * so both surfaces share a cache and invalidate each other correctly.
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle, Ban, CalendarClock, Download, FileWarning,
  Pencil, Plus, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney, orgLocale } from '@/lib/org-locale';
import { openSchedule } from '../ui/schedule-document';
import {
  Badge, BarList, Card, Drawer, EmptyState, Segmented, Skeleton, Toolbar, TONE,
  claimExample, humanStatus, toneForClaimStatus, toneForPolicyStatus, type Tone,
} from '../ui/kit';

// ============================================================ domain helpers

interface Policy {
  id: string;
  policyNo: string;
  companyName: string;
  productName: string;
  category: string;
  premiumInr: number;
  sumInsuredInr: number;
  startDate: string;
  endDate: string;
  graceDays?: number;
  status: string;
  renewalStage?: string | null;
  executiveName?: string | null;
  refundInr?: number | null;
  client?: { name?: string; phone?: string | null } | null;
  commission?: { netInr?: number; status?: string } | null;
  // External agent commission — the introducer's own cut of the premium. This is
  // NOT `commission` above, which is the insurer's brokerage: different rate,
  // different payee, different accounts. Both can sit on the same policy.
  agentId?: string | null;
  agentCommissionPct?: number | null;
  agentCommissionInr?: number | null;
  agentCommissionStatus?: string | null;
  agentSettlementId?: string | null;
  agent?: { id: string; code: string; name: string; agency?: string | null } | null;
  agentSettlement?: { id: string; reference: string; status: string; paidRef?: string | null } | null;
}

interface Claim {
  id: string;
  claimNo: string;
  policyId: string;
  status: string;
  description?: string | null;
  incidentDate: string;
  settledInr?: number | null;
}

const money = (n?: number | null) => fmtOrgMoney(n);

const DAY = 86_400_000;
/** Whole days from today to expiry; negative once the cover has run out. */
const daysToExpiry = (p: Policy) => Math.ceil((+new Date(p.endDate) - Date.now()) / DAY);

/** The window in which a renewal conversation should already be happening. */
const RENEWAL_WINDOW_DAYS = 45;

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(orgLocale().locale || undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Tone for the time left on a policy — the only colour on a resting card. */
function expiryTone(days: number): Tone {
  if (days < 0) return 'expired';
  if (days <= 15) return 'expired';
  if (days <= RENEWAL_WINDOW_DAYS) return 'renewal';
  return 'neutral';
}

function expiryLabel(days: number) {
  if (days < 0) return `expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'expires today';
  return `expires in ${days} day${days === 1 ? '' : 's'}`;
}

const canRenew = (p: Policy) => p.status === 'ACTIVE' || p.status === 'LAPSED' || p.status === 'EXPIRED';
const canCancel = (p: Policy) => p.status === 'ACTIVE';
const canClaim = (p: Policy) => p.status === 'ACTIVE';

/**
 * Policy schedule as a print-ready document.
 *
 * The document itself lives in ui/schedule-document, which also fetches the
 * product's benefit rows so the coverage table prints. Kept exported from here
 * because three screens already import it from this module.
 */
export async function downloadSchedule(p: Policy, claims: Claim[]) {
  const ok = await openSchedule(
    p as any,
    claims as any,
    { orgName: orgLocale().vertical === 'INSURANCE' ? 'Insurance broking' : undefined },
  );
  if (!ok) toast.error('Allow pop-ups to download the schedule');
}

// ============================================================ shared data hooks

function usePolicies(apiStatus?: string) {
  // "All" deliberately shares the bare ['ins-policies'] key with the rest of
  // the console; filtered views hang off it so prefix invalidation still hits.
  return useQuery({
    queryKey: apiStatus ? ['ins-policies', apiStatus] : ['ins-policies'],
    queryFn: async () => (await api.get<Policy[]>(`/insurance/policies${apiStatus ? `?status=${apiStatus}` : ''}`)).data,
  });
}

function useClaims() {
  return useQuery({
    queryKey: ['ins-claims'],
    queryFn: async () => (await api.get<Claim[]>('/insurance/claims')).data,
  });
}

/** Every mutation the policy book can fire, sharing one invalidation policy. */
function usePolicyActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ins-policies'] });
    qc.invalidateQueries({ queryKey: ['ins-dash'] });
    qc.invalidateQueries({ queryKey: ['ins-analytics'] });
  };

  const renew = useMutation({
    mutationFn: (id: string) => api.post(`/insurance/policies/${id}/renew`, {}),
    onSuccess: (r: any) => { toast.success(`Renewed as ${r.data.policyNo} — commission accrued`); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/insurance/policies/${id}/cancel`, {}),
    onSuccess: (r: any) => { toast.success(`Cancelled — pro-rata refund ${money(r.data.refundInr)}`); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const registerClaim = useMutation({
    mutationFn: (v: { policyId: string; incidentDate: string; description: string }) =>
      api.post(`/insurance/policies/${v.policyId}/claims`, { incidentDate: v.incidentDate, description: v.description }),
    onSuccess: () => {
      toast.success('Claim registered — collect the document checklist');
      qc.invalidateQueries({ queryKey: ['ins-claims'] });
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return { renew, cancel, registerClaim, refresh };
}

// ============================================================ Policy card

function MetaRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span className="ds-list-row-meta" style={{ fontWeight: 560, color: tone ? TONE[tone].fg : 'var(--ink)' }}>
        {value}
      </span>
    </div>
  );
}

function PolicyCard({
  policy, onOpen, onRenew, onDownload, onClaim, busy,
}: {
  policy: Policy;
  onOpen: () => void;
  onRenew: () => void;
  onDownload: () => void;
  onClaim: () => void;
  busy: boolean;
}) {
  const days = daysToExpiry(policy);
  const tone = expiryTone(days);
  const showExpiry = days < 0 || days <= RENEWAL_WINDOW_DAYS;

  return (
    <Card interactive onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-3)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {policy.productName}
          </h3>
          <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
            {policy.companyName} · {humanStatus(policy.category)}
          </div>
        </div>
        <Badge tone={toneForPolicyStatus(policy.status)}>{humanStatus(policy.status)}</Badge>
      </div>

      <div style={{ marginTop: 'var(--s-5)' }}>
        <div className="ds-caption">Sum insured</div>
        <div className="ds-display" style={{ marginTop: 'var(--s-1)' }}>{money(policy.sumInsuredInr)}</div>
      </div>

      <div style={{ marginTop: 'var(--s-4)' }}>
        <MetaRow label="Policy no." value={<span className="ds-num">{policy.policyNo}</span>} />
        <MetaRow label="Client" value={policy.client?.name ?? '—'} />
        <MetaRow label="Premium / yr" value={money(policy.premiumInr)} />
        <MetaRow label="Cover from" value={fmtDate(policy.startDate)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-3)' }}>
        <span className="ds-status" style={{ color: 'var(--ink-2)' }}>
          <CalendarClock size={13} style={{ color: 'var(--ink-3)' }} />
          Expires {fmtDate(policy.endDate)}
        </span>
        {showExpiry && <Badge tone={days < 0 ? 'expired' : 'renewal'}>{expiryLabel(days)}</Badge>}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-5)' }}
      >
        {canRenew(policy) && (
          <button className="btn-secondary btn-sm" disabled={busy} onClick={onRenew}>
            <RefreshCw size={13} /> Renew
          </button>
        )}
        <button className="btn-ghost btn-sm" onClick={onDownload}>
          <Download size={13} /> Download
        </button>
        {canClaim(policy) && (
          <button className="btn-ghost btn-sm" onClick={onClaim}>
            <FileWarning size={13} /> Register claim
          </button>
        )}
      </div>
      {tone === 'expired' && days < 0 && policy.status === 'ACTIVE' && (
        <div className="ds-caption ds-fg-expired" style={{ marginTop: 'var(--s-3)', display: 'flex', alignItems: 'center', gap: 'var(--s-1)' }}>
          <AlertTriangle size={12} /> Past expiry — renew or it will lapse
        </div>
      )}
    </Card>
  );
}

// ============================================================ Policy drawer

function ClaimForm({ policyId, category, onDone }: { policyId: string; category?: string | null; onDone: () => void }) {
  const { registerClaim } = usePolicyActions();
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  return (
    <Card>
      <h3 className="ds-h3">Register a claim</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
        <div>
          <label className="label" htmlFor="ins-claim-date">Incident date</label>
          <input
            id="ins-claim-date" type="date" className="input"
            value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="label" htmlFor="ins-claim-what">What happened</label>
          <input
            id="ins-claim-what" className="input" placeholder={claimExample(category)}
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <button
        className="btn-primary btn-sm"
        style={{ marginTop: 'var(--s-3)' }}
        disabled={!description.trim() || registerClaim.isPending}
        onClick={() => registerClaim.mutate(
          { policyId, incidentDate, description: description.trim() },
          { onSuccess: () => { setDescription(''); onDone(); } },
        )}
      >
        <Plus size={13} /> Register claim
      </button>
    </Card>
  );
}

/**
 * Agent commission on an issued policy — read-only by design.
 *
 * The percentage is a snapshot taken at issue: that is the moment the customer
 * is billed, so it is also the moment the payout figure stops moving. Changing
 * it afterwards is an ADJUSTMENT, not an edit — it needs a reason, and it posts
 * a reversal of the original accrual plus a fresh one, so the ledger shows the
 * correction rather than quietly disagreeing with itself.
 *
 * Deliberately labelled "Agent commission" everywhere, never "commission":
 * the card above it is the insurer's BROKERAGE, which is a different number
 * owed by a different party.
 */
function AgentCommissionCard({ policy }: { policy: Policy }) {
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState(false);
  const [nextPct, setNextPct] = useState('');
  const [reason, setReason] = useState('');

  const adjust = useMutation({
    mutationFn: () =>
      api.post(`/insurance/policies/${policy.id}/agent-commission/adjust`, {
        commissionPct: Number(nextPct),
        reason: reason.trim(),
      }),
    onSuccess: (r: any) => {
      const a = r.data?.adjustment;
      toast.success(`Adjusted ${a?.fromPct}% → ${a?.toPct}% — original accrual reversed and re-posted`);
      setAdjusting(false);
      setReason('');
      qc.invalidateQueries({ queryKey: ['ins-policies'] });
      qc.invalidateQueries({ queryKey: ['ins-agents'] });
      if (policy.agentId) qc.invalidateQueries({ queryKey: ['ins-agent', policy.agentId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!policy.agentId || !policy.agent) {
    return (
      <Card>
        <h3 className="ds-h3">Agent commission</h3>
        <div className="ds-caption" style={{ marginTop: 'var(--s-2)' }}>
          No external agent was recorded on this policy. An agent is chosen on the quote line, before
          the policy is issued.
        </div>
      </Card>
    );
  }

  const status = policy.agentCommissionStatus ?? 'NONE';
  const paidOut = status === 'PAID';
  const onStatement = status === 'STATEMENT';
  const settlementRef = policy.agentSettlement?.reference;
  const previewInr = nextPct.trim() === '' || !Number.isFinite(Number(nextPct))
    ? null
    : Math.round((policy.premiumInr * Number(nextPct)) / 100);
  const pctValid = Number.isFinite(Number(nextPct)) && Number(nextPct) >= 0 && Number(nextPct) <= 100;

  return (
    <Card>
      <div className="ds-row" style={{ alignItems: 'flex-start' }}>
        <h3 className="ds-h3" style={{ flex: 1, minWidth: 0 }}>Agent commission</h3>
        <Badge tone={paidOut ? 'active' : onStatement ? 'renewal' : 'info'}>
          {paidOut ? 'Paid' : onStatement ? 'On statement' : 'Locked at issue'}
        </Badge>
      </div>
      <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
        Paid to the external introducer. Separate from the brokerage above, and never shown to the customer.
      </div>

      <div style={{ marginTop: 'var(--s-3)' }}>
        <MetaRow
          label="Agent"
          value={`${policy.agent.name} (${policy.agent.code})${policy.agent.agency ? ` · ${policy.agent.agency}` : ''}`}
        />
        <MetaRow label="Agent commission %" value={<span className="ds-num">{policy.agentCommissionPct ?? 0}%</span>} />
        <MetaRow label="Agent commission" value={money(policy.agentCommissionInr)} />
        {settlementRef && <MetaRow label="Settlement" value={<span className="ds-num">{settlementRef}</span>} />}
      </div>

      {paidOut ? (
        <div className="ds-caption" style={{ marginTop: 'var(--s-3)' }}>
          Paid out on settlement {settlementRef ?? '—'}
          {policy.agentSettlement?.paidRef ? ` (${policy.agentSettlement.paidRef})` : ''}. Money has moved,
          so any correction belongs in the next settlement, not on this one.
        </div>
      ) : adjusting ? (
        <div style={{ marginTop: 'var(--s-4)' }}>
          <div
            className="ds-inset"
            style={{ padding: 'var(--s-3)', background: 'var(--tone-renewal-bg)', border: '1px solid var(--tone-renewal-line)' }}
          >
            <div className="ds-small" style={{ color: 'var(--ink)' }}>
              This is not an edit. It posts a reversal of the {money(policy.agentCommissionInr)} accrued at
              issue and a new accrual at the percentage you enter, both visible in the ledger. The agent’s
              default percentage is left untouched.
              {onStatement && settlementRef ? ` Statement ${settlementRef} is restated to match.` : ''}
            </div>
          </div>

          <div
            className="ds-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}
          >
            <div>
              <label className="label" htmlFor="ins-agent-pct">New agent commission %</label>
              <input
                id="ins-agent-pct" className="input" inputMode="decimal"
                value={nextPct} onChange={(e) => setNextPct(e.target.value)}
                placeholder={String(policy.agentCommissionPct ?? 0)}
              />
              <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                {previewInr == null ? 'Enter a percentage between 0 and 100.' : `New amount: ${money(previewInr)}`}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label" htmlFor="ins-agent-reason">Reason</label>
              <input
                id="ins-agent-reason" className="input"
                value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Rate agreed with the agent was 12%, keyed as 10%"
              />
            </div>
          </div>

          <div className="ds-row" style={{ marginTop: 'var(--s-3)' }}>
            <button
              className="btn-primary btn-sm"
              disabled={!pctValid || !reason.trim() || adjust.isPending}
              onClick={() => adjust.mutate()}
            >
              {adjust.isPending ? 'Posting…' : 'Post adjustment'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => { setAdjusting(false); setReason(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--s-3)' }}>
          <button
            className="btn-secondary btn-sm"
            onClick={() => { setNextPct(String(policy.agentCommissionPct ?? 0)); setAdjusting(true); }}
          >
            <Pencil size={13} /> Adjust commission
          </button>
          <div className="ds-caption" style={{ marginTop: 'var(--s-2)' }}>
            Locked when the policy was issued. An adjustment needs a reason and posts a reversal.
          </div>
        </div>
      )}
    </Card>
  );
}

function PolicyDrawer({
  policy, tab, onTab, onClose,
}: {
  policy: Policy;
  tab: string;
  onTab: (t: string) => void;
  onClose: () => void;
}) {
  const { renew, cancel } = usePolicyActions();
  const { data: allClaims } = useClaims();
  const claims = useMemo(
    () => (allClaims ?? []).filter((c) => c.policyId === policy.id),
    [allClaims, policy.id],
  );
  const days = daysToExpiry(policy);
  const tabs = ['Schedule', 'Claims'];

  return (
    <Drawer
      open
      onClose={onClose}
      title={policy.productName}
      subtitle={`${policy.companyName} · ${policy.policyNo}`}
      tabs={tabs}
      activeTab={tab}
      onTab={onTab}
      counts={{ Claims: claims.length }}
      actions={
        <Link
          href={`/insurance/policies/${policy.id}`}
          className="btn-secondary btn-sm"
          style={{ textDecoration: 'none', flex: 'none' }}
        >
          Open full record
        </Link>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-5)' }}>
        <Badge tone={toneForPolicyStatus(policy.status)}>{humanStatus(policy.status)}</Badge>
        {(days < 0 || days <= RENEWAL_WINDOW_DAYS) && (
          <Badge tone={days < 0 ? 'expired' : 'renewal'}>{expiryLabel(days)}</Badge>
        )}
        {policy.renewalStage && <Badge tone="info" dot={false}>Renewal: {humanStatus(policy.renewalStage)}</Badge>}
      </div>

      {tab === 'Schedule' ? (
        <div className="ds-stack">
          <Card>
            <div className="ds-caption">Sum insured</div>
            <div className="ds-display" style={{ marginTop: 'var(--s-1)' }}>{money(policy.sumInsuredInr)}</div>
            <div style={{ marginTop: 'var(--s-4)' }}>
              <MetaRow label="Premium / yr" value={money(policy.premiumInr)} />
              <MetaRow label="Cover starts" value={fmtDate(policy.startDate)} />
              <MetaRow
                label="Expires"
                value={fmtDate(policy.endDate)}
                tone={expiryTone(days) === 'neutral' ? undefined : expiryTone(days)}
              />
              <MetaRow label="Grace period" value={`${policy.graceDays ?? 15} days`} />
              <MetaRow label="Category" value={humanStatus(policy.category)} />
              {policy.executiveName && <MetaRow label="Executive" value={policy.executiveName} />}
              {policy.refundInr != null && <MetaRow label="Refund on cancellation" value={money(policy.refundInr)} />}
            </div>
          </Card>

          <Card>
            <h3 className="ds-h3">Client</h3>
            <div style={{ marginTop: 'var(--s-2)' }}>
              <MetaRow label="Name" value={policy.client?.name ?? '—'} />
              <MetaRow label="Phone" value={policy.client?.phone ?? '—'} />
            </div>
          </Card>

          {policy.commission && (
            <Card>
              <h3 className="ds-h3">Brokerage</h3>
              <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                What the insurer pays this brokerage. Not the agent commission below.
              </div>
              <div style={{ marginTop: 'var(--s-3)' }}>
                <MetaRow label="Net brokerage" value={money(policy.commission.netInr)} />
                <MetaRow label="Status" value={humanStatus(policy.commission.status)} />
              </div>
            </Card>
          )}

          <AgentCommissionCard policy={policy} />
        </div>
      ) : (
        <div className="ds-stack">
          {canClaim(policy) && <ClaimForm policyId={policy.id} category={policy.category} onDone={() => onTab('Claims')} />}
          {claims.length === 0 ? (
            <div className="ds-caption">No claims registered on this policy.</div>
          ) : (
            <Card>
              {claims.map((c) => (
                <div key={c.id} className="ds-list-row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ds-num" style={{ fontSize: 'var(--t-small)', fontWeight: 600, color: 'var(--ink)' }}>{c.claimNo}</div>
                    <div className="ds-caption" style={{ marginTop: 2 }}>
                      {fmtDate(c.incidentDate)}{c.description ? ` · ${c.description}` : ''}
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flex: 'none' }}>
                    {c.settledInr != null && <span className="ds-num ds-fg-active" style={{ fontSize: 'var(--t-small)', fontWeight: 650 }}>{money(c.settledInr)}</span>}
                    <Badge tone={toneForClaimStatus(c.status)}>{humanStatus(c.status)}</Badge>
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-6)' }}>
        {canRenew(policy) && (
          <button className="btn-primary btn-sm" disabled={renew.isPending} onClick={() => renew.mutate(policy.id)}>
            <RefreshCw size={13} /> Renew policy
          </button>
        )}
        <button className="btn-secondary btn-sm" onClick={() => downloadSchedule(policy, claims)}>
          <Download size={13} /> Download schedule
        </button>
        {canClaim(policy) && tab !== 'Claims' && (
          <button className="btn-secondary btn-sm" onClick={() => onTab('Claims')}>
            <FileWarning size={13} /> Register claim
          </button>
        )}
        {canCancel(policy) && (
          <button
            className="btn-ghost btn-sm"
            style={{ color: 'var(--tone-expired)' }}
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm(`Cancel ${policy.policyNo}? A pro-rata refund is calculated and the unearned commission is reversed.`)) {
                cancel.mutate(policy.id, { onSuccess: onClose });
              }
            }}
          >
            <Ban size={13} /> Cancel policy
          </button>
        )}
      </div>
    </Drawer>
  );
}

// ============================================================ Screen 1 — the book

const STATUS_FILTERS = ['All', 'Active', 'Renewal due', 'Lapsed', 'Expired'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Which of the filters the API can answer directly; the rest we narrow here. */
const API_STATUS: Record<StatusFilter, string | undefined> = {
  All: undefined,
  Active: 'ACTIVE',
  'Renewal due': 'ACTIVE',
  Lapsed: 'LAPSED',
  Expired: 'EXPIRED',
};

export function InsurancePolicies() {
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<{ id: string; tab: string } | null>(null);

  const { data, isLoading } = usePolicies(API_STATUS[filter]);
  const { data: allClaims } = useClaims();
  const { renew } = usePolicyActions();

  const policies = useMemo(() => {
    let rows = data ?? [];
    if (filter === 'Renewal due') {
      rows = rows.filter((p) => {
        const d = daysToExpiry(p);
        return d <= RENEWAL_WINDOW_DAYS || !!p.renewalStage;
      });
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((p) => [p.policyNo, p.productName, p.companyName, p.category, p.client?.name]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)));
    }
    return rows;
  }, [data, filter, q]);

  const openPolicy = open ? (data ?? []).find((p) => p.id === open.id) : undefined;

  return (
    <div className="ds-stack">
      <Toolbar>
        <Segmented options={[...STATUS_FILTERS]} value={filter} onChange={(v) => setFilter(v as StatusFilter)} />
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 220, flex: '0 1 300px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search policy, client, insurer…"
            aria-label="Search policies"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </Toolbar>

      {isLoading ? (
        <div className="ds-grid ds-grid-cards">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} rows={1} height={250} />)}
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title={q || filter !== 'All' ? 'Nothing matches that view' : 'No policies on the book yet'}
            body={q || filter !== 'All'
              ? 'Clear the search or widen the status filter to see the rest of the book.'
              : 'Policies appear here once a quote is issued. Build a comparison on the Quotes screen and issue the winning line.'}
            actionLabel={q || filter !== 'All' ? 'Show all policies' : undefined}
            onAction={q || filter !== 'All' ? () => { setQ(''); setFilter('All'); } : undefined}
          />
        </Card>
      ) : (
        <div className="ds-grid ds-grid-cards">
          {policies.map((p) => (
            <PolicyCard
              key={p.id}
              policy={p}
              busy={renew.isPending}
              onOpen={() => setOpen({ id: p.id, tab: 'Schedule' })}
              onRenew={() => renew.mutate(p.id)}
              onDownload={() => downloadSchedule(p, (allClaims ?? []).filter((c) => c.policyId === p.id))}
              onClaim={() => setOpen({ id: p.id, tab: 'Claims' })}
            />
          ))}
        </div>
      )}

      {openPolicy && open && (
        <PolicyDrawer
          policy={openPolicy}
          tab={open.tab}
          onTab={(t) => setOpen({ id: open.id, tab: t })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

// ============================================================ Screen 2 — the pipeline

const STAGES = [
  { key: 'DUE', label: 'Due', tone: 'renewal' as Tone },
  { key: 'CONTACTED', label: 'Contacted', tone: 'sales' as Tone },
  { key: 'QUOTED', label: 'Quoted', tone: 'claim' as Tone },
  { key: 'RENEWED', label: 'Renewed', tone: 'active' as Tone },
  { key: 'LAPSED', label: 'Lapsed', tone: 'expired' as Tone },
];

/**
 * A policy belongs on the board when the sweep has staged it, or when expiry
 * is close enough that someone should already be calling the client.
 */
function stageOf(p: Policy): string | null {
  if (p.renewalStage) return STAGES.some((s) => s.key === p.renewalStage) ? p.renewalStage : 'DUE';
  if (p.status === 'LAPSED') return 'LAPSED';
  if (p.status === 'ACTIVE' && daysToExpiry(p) <= RENEWAL_WINDOW_DAYS) return 'DUE';
  return null;
}

/** Keyboard/click path for moving a card — drag alone is not an interface. */
function MoveMenu({ current, onMove, busy }: { current: string; onMove: (stage: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        className="btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Move to
      </button>
      {open && (
        <div
          role="menu"
          className="ds-panel"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, padding: 'var(--s-1)', minWidth: 150 }}
        >
          {STAGES.filter((s) => s.key !== current).map((s) => (
            <button
              key={s.key}
              role="menuitem"
              className="btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { setOpen(false); onMove(s.key); }}
            >
              <span className={`ds-dot ds-fg-${s.tone}`} /> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RenewalCard({
  policy, stage, onMove, busy, dragging, onDragStart, onDragEnd,
}: {
  policy: Policy; stage: string; onMove: (s: string) => void; busy: boolean;
  dragging: boolean; onDragStart: () => void; onDragEnd: () => void;
}) {
  const days = daysToExpiry(policy);
  const tone = expiryTone(days);
  return (
    // Native HTML5 drag needs the props on the element itself, so this card is
    // the ds-card class rather than the kit <Card>.
    <div
      className="ds-card"
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', policy.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      style={{ padding: 'var(--s-3)', cursor: 'grab', opacity: dragging ? 0.45 : 1 }}
    >
      <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {policy.client?.name ?? 'Unnamed client'}
      </div>
      <div className="ds-caption" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {policy.productName} · {policy.companyName}
      </div>
      <div className="ds-caption ds-num" style={{ marginTop: 'var(--s-2)' }}>{policy.policyNo}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
        <span className={`ds-status ds-fg-${tone}`}>
          <span className="ds-dot" />
          <span style={{ color: 'var(--ink-2)' }}>{expiryLabel(days)}</span>
        </span>
        <span style={{ marginLeft: 'auto', flex: 'none' }}>
          <MoveMenu current={stage} onMove={onMove} busy={busy} />
        </span>
      </div>
    </div>
  );
}

function SweepPrompt({ onClose, onRun, busy }: { onClose: () => void; onRun: () => void; busy: boolean }) {
  return (
    <Drawer open onClose={onClose} title="Run renewal sweep" subtitle="Reminders out, overdue cover marked lapsed">
      <div className="ds-stack">
        <p className="ds-body" style={{ margin: 0 }}>
          The sweep walks every active policy, sends the reminder due at 30, 15, 7 and 1 days before
          expiry, stages anything untouched as <b>Due</b>, and marks policies past their grace period
          as <b>Lapsed</b>. It runs nightly on its own — this is the manual pull.
        </p>
        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          <button className="btn-primary btn-sm" disabled={busy} onClick={onRun}>
            <RefreshCw size={13} /> Run sweep now
          </button>
          <button className="btn-ghost btn-sm" onClick={onClose}>Not now</button>
        </div>
      </div>
    </Drawer>
  );
}

function RenewalsBoard() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const { data, isLoading } = usePolicies();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [sweepOpen, setSweepOpen] = useState(false);

  // A quick-create entry point lands here; the only action this board creates
  // is the sweep, so that is what `?new=1` opens.
  useEffect(() => { if (params?.get('new') === '1') setSweepOpen(true); }, [params]);

  const move = useMutation({
    mutationFn: (v: { id: string; stage: string }) =>
      api.patch(`/insurance/policies/${v.id}/renewal-stage`, { stage: v.stage }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['ins-policies'] });
      const prev = qc.getQueryData<Policy[]>(['ins-policies']);
      if (prev) {
        qc.setQueryData<Policy[]>(['ins-policies'], prev.map((p) => (p.id === v.id ? { ...p, renewalStage: v.stage } : p)));
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ins-policies'], ctx.prev);
      toast.error(apiErrorMessage(e));
    },
    onSuccess: (_r, v) => {
      const label = STAGES.find((s) => s.key === v.stage)?.label ?? v.stage;
      toast.success(`Moved to ${label}`);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['ins-policies'] }); },
  });

  const sweep = useMutation({
    mutationFn: () => api.post('/insurance/renewal-sweep', {}),
    onSuccess: (r: any) => {
      toast.success(`Sweep: ${r.data.reminded} reminded · ${r.data.lapsed} lapsed`);
      qc.invalidateQueries({ queryKey: ['ins-policies'] });
      qc.invalidateQueries({ queryKey: ['ins-dash'] });
      setSweepOpen(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns = useMemo(() => {
    const buckets: Record<string, Policy[]> = Object.fromEntries(STAGES.map((s) => [s.key, [] as Policy[]]));
    for (const p of data ?? []) {
      const stage = stageOf(p);
      if (stage) buckets[stage].push(p);
    }
    for (const key of Object.keys(buckets)) {
      buckets[key].sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate));
    }
    return buckets;
  }, [data]);

  const total = STAGES.reduce((n, s) => n + columns[s.key].length, 0);

  const drop = (stage: string, transferred?: string) => {
    setOverStage(null);
    const id = dragId ?? (transferred || null);
    setDragId(null);
    if (!id) return;
    const current = (data ?? []).find((p) => p.id === id);
    if (!current || stageOf(current) === stage) return;
    move.mutate({ id, stage });
  };

  const toolbar = (
    <Toolbar>
      <div style={{ marginRight: 'auto' }}>
        <h2 className="ds-h2">Renewal pipeline</h2>
        <div className="ds-caption" style={{ marginTop: 2 }}>Drag a card, or use “Move to” — both write the stage back.</div>
      </div>
      <button className="btn-secondary btn-sm" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
        <RefreshCw size={13} /> Run renewal sweep
      </button>
    </Toolbar>
  );

  if (isLoading) {
    return (
      <div className="ds-stack">
        {toolbar}
        <Skeleton rows={1} height={120} />
        <Skeleton rows={3} height={140} />
      </div>
    );
  }

  return (
    <div className="ds-stack">
      {toolbar}

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Nothing in the renewal pipeline"
            body="Policies join the board when they come within 45 days of expiry, or as soon as the sweep stages them."
            actionLabel="Run renewal sweep"
            onAction={() => sweep.mutate()}
          />
        </Card>
      ) : (
        <>
          <Card>
            <h3 className="ds-h3" style={{ marginBottom: 'var(--s-4)' }}>Funnel</h3>
            <BarList items={STAGES.map((s) => ({ label: s.label, value: columns[s.key].length, tone: s.tone }))} />
          </Card>

          <div className="ds-scroll-x">
            <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start', minWidth: 'min-content' }}>
              {STAGES.map((s) => {
                const rows = columns[s.key];
                const isOver = overStage === s.key;
                return (
                  <section
                    key={s.key}
                    aria-label={`${s.label} — ${rows.length} policies`}
                    onDragOver={(e) => { e.preventDefault(); setOverStage(s.key); }}
                    onDragLeave={() => setOverStage((v) => (v === s.key ? null : v))}
                    onDrop={(e) => { e.preventDefault(); drop(s.key, e.dataTransfer.getData('text/plain')); }}
                    className="ds-inset"
                    style={{
                      width: 268, flex: 'none', padding: 'var(--s-3)',
                      background: isOver ? 'var(--tone-info-bg)' : 'var(--surface-2)',
                      outline: isOver ? '1px dashed var(--tone-info-line)' : '1px solid transparent',
                      transition: 'background 140ms ease',
                    }}
                  >
                    <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
                      <span className={`ds-dot ds-fg-${s.tone}`} />
                      <span className="ds-h3">{s.label}</span>
                      <span className="ds-count" style={{ marginLeft: 'auto' }}>{rows.length}</span>
                    </header>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                      {rows.length === 0 ? (
                        <div className="ds-caption" style={{ padding: 'var(--s-2) 0' }}>Nothing here.</div>
                      ) : rows.map((p) => (
                        <RenewalCard
                          key={p.id}
                          policy={p}
                          stage={s.key}
                          busy={move.isPending}
                          dragging={dragId === p.id}
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => { setDragId(null); setOverStage(null); }}
                          onMove={(stage) => move.mutate({ id: p.id, stage })}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}

      {sweepOpen && (
        <SweepPrompt onClose={() => setSweepOpen(false)} onRun={() => sweep.mutate()} busy={sweep.isPending} />
      )}
    </div>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary of its own, so the board carries
 * one rather than depending on whatever route mounts it.
 */
export function InsuranceRenewals() {
  return (
    <Suspense fallback={<Skeleton rows={3} height={140} />}>
      <RenewalsBoard />
    </Suspense>
  );
}
