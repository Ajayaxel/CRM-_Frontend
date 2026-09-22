'use client';

/**
 * Insurance → Policy record page.
 *
 * The book screen's drawer answers "what is this policy?"; this page is the
 * record you work from — schedule, claims, the renewal conversation and the
 * history, laid out master-detail with a right rail that keeps the insured and
 * the brokerage on screen.
 *
 * There is no `GET /insurance/policies/:id`, so the record is read out of the
 * same `['ins-policies']` collection the book uses: one cache, one invalidation
 * policy, and every action here refreshes the list behind it. The Timeline tab
 * is derived locally from the timestamps the record itself carries — the
 * per-client feed endpoint has no per-policy equivalent.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Ban, BellRing, CalendarClock, ChevronRight, Coins, Download,
  FileWarning, Mail, Pencil, Plus, RefreshCw, ShieldCheck, Sparkles, Wallet,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney, orgLocale } from '@/lib/org-locale';
import {
  Badge, Card, EmptyState, EntityIcon, Skeleton, StatCard, Stepper, Timeline,
  claimExample, humanStatus, toneForClaimStatus, toneForPolicyStatus, useIsNarrow, type Tone,
} from '../ui/kit';
import { DocumentsPanel } from '../ui/documents-panel';
import { PolicyDeclarations } from '../ui/policy-declarations';
import { PremiumPanel } from '../ui/premium-panel';
import { downloadSchedule } from './policies';

// ============================================================ domain

/** Mirrors the shape `GET /insurance/policies` returns for one row. */
interface Policy {
  id: string;
  policyNo: string;
  clientId?: string;
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
  remindersSent?: number[] | null;
  renewedFromId?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  client?: { name?: string; phone?: string | null; email?: string | null } | null;
  commission?: { netInr?: number; grossInr?: number; status?: string; createdAt?: string } | null;
}

interface Claim {
  id: string;
  claimNo: string;
  policyId: string;
  status: string;
  description?: string | null;
  incidentDate: string;
  settledInr?: number | null;
  settledAt?: string | null;
  createdAt?: string;
}

const TABS = ['Overview', 'Coverage', 'Premium', 'Documents', 'Claims', 'Renewal', 'Timeline'] as const;
type Tab = (typeof TABS)[number];

const money = (n?: number | null) => fmtOrgMoney(n);

const DAY = 86_400_000;
const daysToExpiry = (p: Policy) => Math.ceil((+new Date(p.endDate) - Date.now()) / DAY);

/** The window in which a renewal conversation should already be happening. */
const RENEWAL_WINDOW_DAYS = 45;
/** The reminder ladder the nightly sweep walks. */
const REMINDER_LADDER = [30, 15, 7, 1];

const RENEWAL_STAGES = ['DUE', 'CONTACTED', 'QUOTED', 'RENEWED'];

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(orgLocale().locale || undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function expiryTone(days: number): Tone {
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

// ============================================================ data

function usePolicyRecord(id: string) {
  const q = useQuery({
    queryKey: ['ins-policies'],
    queryFn: async () => (await api.get<Policy[]>('/insurance/policies')).data,
  });
  const policy = useMemo(() => (q.data ?? []).find((p) => p.id === id), [q.data, id]);
  return { ...q, policy };
}

function usePolicyClaims(id: string) {
  const q = useQuery({
    queryKey: ['ins-claims'],
    queryFn: async () => (await api.get<Claim[]>('/insurance/claims')).data,
  });
  const claims = useMemo(() => (q.data ?? []).filter((c) => c.policyId === id), [q.data, id]);
  return { ...q, claims };
}

/** The same mutations and invalidation policy the book screen uses. */
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

  const stage = useMutation({
    mutationFn: (v: { id: string; stage: string }) =>
      api.patch(`/insurance/policies/${v.id}/renewal-stage`, { stage: v.stage }),
    onSuccess: (_r, v) => { toast.success(`Moved to ${humanStatus(v.stage)}`); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  /**
   * Emailing the customer is a deliberate press, not something issuance does
   * behind the broker's back — the insurer sends its own schedule, and a
   * customer told twice about one policy assumes something went wrong.
   */
  const emailCustomer = useMutation({
    mutationFn: (id: string) => api.post(`/insurance/policies/${id}/email`, {}),
    onSuccess: (r: any) => {
      // The API reports rather than throwing, so a refusal arrives as a 200
      // carrying sent:false. Showing "sent" here would be a lie the broker
      // only discovers from the customer.
      if (r.data?.sent) toast.success(`Policy emailed to ${r.data.to}`);
      else toast.error(r.data?.error ?? 'The message was not sent.');
      refresh();
    },
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

  /**
   * Clerical corrections only. Premium and sum insured are refused by the API
   * because the brokerage was accrued from them — but a policy number typed
   * wrong otherwise needs a cancel-and-reissue, which is absurd for a typo.
   */
  const correct = useMutation({
    mutationFn: (v: { id: string; policyNo: string; startDate: string; endDate: string }) =>
      api.patch(`/insurance/policies/${v.id}`, { policyNo: v.policyNo, startDate: v.startDate, endDate: v.endDate }),
    onSuccess: () => { toast.success('Policy corrected'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return { renew, cancel, stage, registerClaim, emailCustomer, correct };
}

// ============================================================ building blocks

function InfoRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span
        className="ds-list-row-meta"
        style={{ fontWeight: 560, color: tone ? `var(--tone-${tone})` : 'var(--ink)' }}
      >{value ?? '—'}</span>
    </div>
  );
}

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="ds-row" style={{ marginBottom: 'var(--s-3)' }}>
      <h2 className="ds-h2">{children}</h2>
      {action && <span style={{ marginLeft: 'auto', flex: 'none' }}>{action}</span>}
    </div>
  );
}

// ============================================================ Screen

export function InsurancePolicyDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const narrow = useIsNarrow(900);
  const { policy, isLoading, isError, error } = usePolicyRecord(id);
  const { claims } = usePolicyClaims(id);
  const { renew, cancel, emailCustomer, correct } = usePolicyActions();

  const [correcting, setCorrecting] = useState(false);
  const [cf, setCf] = useState({ policyNo: '', startDate: '', endDate: '' });

  const raw = params?.get('tab') ?? '';
  const tab: Tab = TABS.find((t) => t.toLowerCase() === raw.toLowerCase()) ?? 'Overview';

  if (isLoading) {
    return (
      <div className="ds-stack" style={{ gap: 'var(--s-5)' }}>
        <Skeleton rows={1} height={72} />
        <Skeleton rows={1} height={104} />
        <Skeleton rows={3} height={92} />
      </div>
    );
  }

  if (isError || !policy) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="We couldn't open this policy"
          body={isError
            ? apiErrorMessage(error)
            : 'This policy is not on the book — it may have been replaced by a renewal, or it belongs to another organisation.'}
        />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link href="/insurance/policies" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Back to the policy book
          </Link>
        </div>
      </Card>
    );
  }

  const days = daysToExpiry(policy);
  const openClaims = claims.filter((c) => !['SETTLED', 'REJECTED'].includes(String(c.status).toUpperCase()));
  const counts: Partial<Record<Tab, number>> = { Claims: claims.length || undefined };

  return (
    <div className="ds-stack" style={{ gap: 'var(--s-5)' }}>
      {/* ---------------------------------------------------- record header */}
      <div className="ds-stack" style={{ gap: 'var(--s-3)' }}>
        <div>
          <Link href="/insurance/policies" className="ds-viewall" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Policy book
          </Link>
        </div>

        <div className="ds-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <EntityIcon icon={ShieldCheck} tone={toneForPolicyStatus(policy.status)} size="lg" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ds-row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
              <h1 className="ds-h1">{policy.productName}</h1>
              <Badge tone={toneForPolicyStatus(policy.status)}>{humanStatus(policy.status)}</Badge>
              {(days < 0 || days <= RENEWAL_WINDOW_DAYS) && policy.status === 'ACTIVE' && (
                <Badge tone={days < 0 ? 'expired' : 'renewal'}>{expiryLabel(days)}</Badge>
              )}
            </div>
            <div className="ds-caption ds-num" style={{ marginTop: 'var(--s-1)' }}>
              {[policy.companyName, policy.policyNo, humanStatus(policy.category)].filter(Boolean).join(' · ')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {canRenew(policy) && (
              <button className="btn-primary btn-sm" disabled={renew.isPending} onClick={() => renew.mutate(policy.id)}>
                <RefreshCw size={13} /> Renew
              </button>
            )}
            <button className="btn-secondary btn-sm" onClick={() => downloadSchedule(policy, claims)}>
              <Download size={13} /> Download
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => {
                setCorrecting(true);
                setCf({
                  policyNo: policy.policyNo,
                  startDate: String(policy.startDate).slice(0, 10),
                  endDate: String(policy.endDate).slice(0, 10),
                });
              }}
            >
              <Pencil size={13} /> Correct
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={emailCustomer.isPending}
              title={policy.client?.email ? `Send to ${policy.client.email}` : 'This client has no email address on record'}
              onClick={() => emailCustomer.mutate(policy.id)}
            >
              <Mail size={13} /> {emailCustomer.isPending ? 'Sending…' : 'Email customer'}
            </button>
            {canCancel(policy) && (
              <button
                className="btn-ghost btn-sm"
                style={{ color: 'var(--tone-expired)' }}
                disabled={cancel.isPending}
                onClick={() => {
                  if (window.confirm(`Cancel ${policy.policyNo}? A pro-rata refund is calculated and the unearned commission is reversed.`)) {
                    cancel.mutate(policy.id);
                  }
                }}
              >
                <Ban size={13} /> Cancel
              </button>
            )}
          </div>
        </div>

        {days < 0 && policy.status === 'ACTIVE' && (
          <Card tone="expired">
            <div className="ds-row">
              <AlertTriangle size={16} className="ds-fg-expired" style={{ flex: 'none' }} />
              <div style={{ minWidth: 0 }}>
                <div className="ds-h3">Past expiry — renew or this cover will lapse</div>
                <div className="ds-caption" style={{ marginTop: 2 }}>
                  Cover ran out {fmtDate(policy.endDate)}. The grace period is {policy.graceDays ?? 15} days.
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ---------------------------------------------------- summary strip */}
      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        <StatCard label="Sum insured" value={money(policy.sumInsuredInr)} icon={Wallet} tone="info" />
        <StatCard label="Premium / yr" value={money(policy.premiumInr)} icon={Coins} tone="sales" />
        <StatCard
          label={days < 0 ? 'Expired' : 'Days to expiry'}
          value={days < 0 ? `${Math.abs(days)}d ago` : days}
          icon={CalendarClock}
          tone={expiryTone(days)}
        />
        <StatCard
          label="Claims"
          value={claims.length}
          icon={FileWarning}
          tone={openClaims.length ? 'claim' : 'neutral'}
          deltaLabel={openClaims.length ? `${openClaims.length} open` : undefined}
        />
      </div>

      {/* ---------------------------------------------------- tab rail */}
      {correcting && (
        <Card>
          <div className="ds-h3" style={{ marginBottom: 'var(--s-3)' }}>Correct this policy</div>
          <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--s-3)' }}>
            <div><label className="label">Insurer&rsquo;s policy number</label><input className="input" value={cf.policyNo} onChange={(e) => setCf({ ...cf, policyNo: e.target.value })} /></div>
            <div><label className="label">Cover starts</label><input className="input" type="date" value={cf.startDate} onChange={(e) => setCf({ ...cf, startDate: e.target.value })} /></div>
            <div><label className="label">Cover ends</label><input className="input" type="date" value={cf.endDate} onChange={(e) => setCf({ ...cf, endDate: e.target.value })} /></div>
          </div>
          <div className="ds-caption" style={{ marginTop: 'var(--s-2)' }}>
            The premium and sum insured cannot be changed here — the brokerage was accrued from them and the customer was billed on them.
            Cancel and re-issue if the cover itself was wrong.
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)', justifyContent: 'flex-end', marginTop: 'var(--s-3)' }}>
            <button className="btn-ghost btn-sm" onClick={() => setCorrecting(false)}>Cancel</button>
            <button
              className="btn-primary btn-sm"
              disabled={correct.isPending || !cf.policyNo.trim()}
              onClick={() => correct.mutate({ id: policy.id, ...cf }, { onSuccess: () => setCorrecting(false) })}
            >
              {correct.isPending ? 'Saving…' : 'Save correction'}
            </button>
          </div>
        </Card>
      )}

      <nav className="ds-subnav" aria-label="Policy record sections">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/insurance/policies/${id}?tab=${t.toLowerCase()}`}
            className="ds-subnav-item"
            data-active={tab === t}
            aria-current={tab === t ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
            scroll={false}
          >
            {t}
            {counts[t] != null && <span className="ds-count">{counts[t]}</span>}
          </Link>
        ))}
      </nav>

      {/* ---------------------------------------------------- body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) 300px',
          gap: 'var(--s-5)',
          alignItems: 'start',
        }}
      >
        <div className="ds-stack" style={{ minWidth: 0 }}>
          {tab === 'Overview' && <OverviewTab policy={policy} />}
          {tab === 'Coverage' && <CoverageTab policy={policy} />}
          {tab === 'Premium' && <PremiumPanel policyId={policy.id} policyStatus={policy.status} />}
          {tab === 'Documents' && (
            <>
              <DocumentsPanel relatedType="INS_POLICY" relatedId={policy.id} title="Policy documents" />
              {/* Rendered from the signed record, never uploaded — so it is
                  listed apart from the files rather than among them. */}
              <PolicyDeclarations clientId={policy.clientId} policyId={policy.id} category={policy.category} />
            </>
          )}
          {tab === 'Claims' && <ClaimsTab policy={policy} claims={claims} />}
          {tab === 'Renewal' && <RenewalTab policy={policy} />}
          {tab === 'Timeline' && <TimelineTab policy={policy} claims={claims} />}
        </div>

        <aside className="ds-stack" style={{ minWidth: 0 }}>
          <Card>
            <SectionHeading
              action={policy.clientId ? (
                <Link href={`/insurance/clients/${policy.clientId}`} className="ds-viewall" style={{ textDecoration: 'none' }}>
                  Open <ChevronRight size={13} />
                </Link>
              ) : undefined}
            >Insured</SectionHeading>
            <InfoRow label="Name" value={policy.client?.name} />
            <InfoRow label="Phone" value={policy.client?.phone} />
            {policy.executiveName && <InfoRow label="Executive" value={policy.executiveName} />}
          </Card>

          <Card>
            <SectionHeading>Key dates</SectionHeading>
            <InfoRow label="Cover starts" value={fmtDate(policy.startDate)} />
            <InfoRow
              label="Cover ends"
              value={fmtDate(policy.endDate)}
              tone={expiryTone(days) === 'neutral' ? undefined : expiryTone(days)}
            />
            <InfoRow label="Grace period" value={`${policy.graceDays ?? 15} days`} />
            {policy.cancelledAt && <InfoRow label="Cancelled" value={fmtDate(policy.cancelledAt)} />}
          </Card>

          {policy.commission && (
            <Card>
              <SectionHeading>Brokerage</SectionHeading>
              <InfoRow label="Net commission" value={money(policy.commission.netInr)} />
              {policy.commission.grossInr != null && <InfoRow label="Gross" value={money(policy.commission.grossInr)} />}
              <InfoRow label="Status" value={humanStatus(policy.commission.status)} />
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

// ============================================================ Tabs

function OverviewTab({ policy }: { policy: Policy }) {
  return (
    <Card>
      <SectionHeading>Policy</SectionHeading>
      <InfoRow label="Insurer" value={policy.companyName} />
      <InfoRow label="Product" value={policy.productName} />
      <InfoRow label="Policy number" value={<span className="ds-num">{policy.policyNo}</span>} />
      <InfoRow label="Category" value={humanStatus(policy.category)} />
      <InfoRow label="Status" value={humanStatus(policy.status)} tone={toneForPolicyStatus(policy.status)} />
      <InfoRow label="Period" value={`${fmtDate(policy.startDate)} → ${fmtDate(policy.endDate)}`} />
      <InfoRow
        label="Client"
        value={policy.clientId
          ? (
            <Link href={`/insurance/clients/${policy.clientId}`} style={{ color: 'var(--navy)', textDecoration: 'none', fontWeight: 600 }}>
              {policy.client?.name ?? 'Open client'}
            </Link>
          )
          : (policy.client?.name ?? '—')}
      />
    </Card>
  );
}

function CoverageTab({ policy }: { policy: Policy }) {
  return (
    <>
      <Card>
        <div className="ds-caption">Sum insured</div>
        <div className="ds-display" style={{ marginTop: 'var(--s-1)' }}>{money(policy.sumInsuredInr)}</div>
        <div style={{ marginTop: 'var(--s-4)' }}>
          <InfoRow label="Annual premium" value={money(policy.premiumInr)} />
          <InfoRow label="Category" value={humanStatus(policy.category)} />
          <InfoRow label="Grace period" value={`${policy.graceDays ?? 15} days`} />
          {policy.refundInr != null && <InfoRow label="Refund on cancellation" value={money(policy.refundInr)} />}
        </div>
      </Card>

      <Card>
        <SectionHeading>Wording and inclusions</SectionHeading>
        <EmptyState
          icon={Sparkles}
          title="Clause-level cover isn't stored yet"
          body="The schedule facts above are everything the policy record holds — inclusions, add-ons and exclusions live on the quote line that produced it."
          compact
        />
      </Card>
    </>
  );
}

function ClaimForm({ policyId, category }: { policyId: string; category?: string | null }) {
  const { registerClaim } = usePolicyActions();
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  return (
    <Card>
      <SectionHeading>Register a claim</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 'var(--s-3)' }}>
        <div>
          <label className="label" htmlFor="ins-pd-claim-date">Incident date</label>
          <input
            id="ins-pd-claim-date" type="date" className="input"
            value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="label" htmlFor="ins-pd-claim-what">What happened</label>
          <input
            id="ins-pd-claim-what" className="input" placeholder={claimExample(category)}
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <button
        className="btn-primary btn-sm"
        style={{ marginTop: 'var(--s-4)' }}
        disabled={!description.trim() || registerClaim.isPending}
        onClick={() => registerClaim.mutate(
          { policyId, incidentDate, description: description.trim() },
          { onSuccess: () => setDescription('') },
        )}
      >
        <Plus size={13} /> Register claim
      </button>
    </Card>
  );
}

function ClaimsTab({ policy, claims }: { policy: Policy; claims: Claim[] }) {
  return (
    <>
      {canClaim(policy) && <ClaimForm policyId={policy.id} category={policy.category} />}

      {claims.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileWarning}
            title="No claims on this policy"
            body="Register one above and the document checklist comes with it."
            compact
          />
        </Card>
      ) : claims.map((c) => (
        <Card key={c.id}>
          <div className="ds-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ds-h3 ds-num">{c.claimNo}</div>
              <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>Incident {fmtDate(c.incidentDate)}</div>
            </div>
            <Badge tone={toneForClaimStatus(c.status)}>{humanStatus(c.status)}</Badge>
          </div>
          {c.description && <div className="ds-body" style={{ marginTop: 'var(--s-3)' }}>{c.description}</div>}
          {c.settledInr != null && (
            <>
              <hr className="ds-divider" style={{ margin: 'var(--s-3) 0' }} />
              <div className="ds-row">
                <span className="ds-caption">Settled {fmtDate(c.settledAt)}</span>
                <span className="ds-small ds-num ds-fg-active" style={{ marginLeft: 'auto', fontWeight: 650 }}>
                  {money(c.settledInr)}
                </span>
              </div>
            </>
          )}
        </Card>
      ))}
    </>
  );
}

function RenewalTab({ policy }: { policy: Policy }) {
  const { renew, stage } = usePolicyActions();
  const days = daysToExpiry(policy);
  const reminders: number[] = Array.isArray(policy.remindersSent) ? policy.remindersSent : [];
  const currentStage = policy.renewalStage && RENEWAL_STAGES.includes(policy.renewalStage)
    ? RENEWAL_STAGES.indexOf(policy.renewalStage)
    : policy.status === 'RENEWED' ? RENEWAL_STAGES.length - 1 : 0;

  return (
    <>
      <Card>
        <SectionHeading>Renewal stage</SectionHeading>
        {policy.renewalStage === 'LAPSED' ? (
          <Badge tone="expired">Lapsed</Badge>
        ) : (
          <Stepper steps={RENEWAL_STAGES.map((s) => humanStatus(s))} current={currentStage} />
        )}
        <hr className="ds-divider" style={{ margin: 'var(--s-5) 0 var(--s-3)' }} />
        <InfoRow label="Stage on record" value={policy.renewalStage ? humanStatus(policy.renewalStage) : 'Not staged yet'} />
        <InfoRow label="Cover ends" value={fmtDate(policy.endDate)} />
        <InfoRow
          label="Time left"
          value={expiryLabel(days)}
          tone={expiryTone(days) === 'neutral' ? undefined : expiryTone(days)}
        />
        <InfoRow label="Grace period" value={`${policy.graceDays ?? 15} days`} />

        <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-4)' }}>
          {canRenew(policy) && (
            <button className="btn-primary btn-sm" disabled={renew.isPending} onClick={() => renew.mutate(policy.id)}>
              <RefreshCw size={13} /> Renew policy
            </button>
          )}
          {RENEWAL_STAGES.filter((s) => s !== policy.renewalStage && s !== 'RENEWED').map((s) => (
            <button
              key={s}
              className="btn-secondary btn-sm"
              disabled={stage.isPending}
              onClick={() => stage.mutate({ id: policy.id, stage: s })}
            >
              Mark {humanStatus(s).toLowerCase()}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading>Reminders sent</SectionHeading>
        {reminders.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No reminders sent yet"
            body="The nightly sweep sends one at 30, 15, 7 and 1 days before expiry."
            compact
          />
        ) : (
          <div>
            {REMINDER_LADDER.map((d) => (
              <InfoRow
                key={d}
                label={`${d} days before expiry`}
                value={reminders.includes(d) ? 'Sent' : 'Not sent'}
                tone={reminders.includes(d) ? 'active' : undefined}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * No per-policy feed endpoint exists, so the history is derived from the
 * timestamps the record and its claims genuinely carry. Nothing here is
 * inferred beyond what is stored.
 */
function TimelineTab({ policy, claims }: { policy: Policy; claims: Claim[] }) {
  const items = useMemo(() => {
    const rows: { at: string; title: string; detail?: string; tone?: Tone; icon?: any; dateOnly?: boolean }[] = [];

    if (policy.createdAt) {
      rows.push({
        at: policy.createdAt,
        title: policy.renewedFromId ? 'Issued as a renewal' : 'Policy issued',
        detail: `${policy.policyNo} · ${policy.companyName}`,
        tone: policy.renewedFromId ? 'info' : 'active',
        icon: ShieldCheck,
      });
    }
    rows.push({
      at: policy.startDate,
      title: 'Cover started',
      detail: `Sum insured ${money(policy.sumInsuredInr)}`,
      tone: 'active',
      icon: CalendarClock,
      // A policy period is a calendar date, not an instant.
      dateOnly: true,
    });
    if (policy.commission?.createdAt) {
      rows.push({
        at: policy.commission.createdAt,
        title: 'Brokerage accrued',
        detail: `Net ${money(policy.commission.netInr)} · ${humanStatus(policy.commission.status)}`,
        tone: 'sales',
        icon: Coins,
      });
    }
    for (const c of claims) {
      if (c.createdAt) {
        rows.push({
          at: c.createdAt,
          title: `Claim ${c.claimNo} registered`,
          detail: c.description ?? undefined,
          tone: 'claim',
          icon: FileWarning,
        });
      }
      if (c.settledAt) {
        rows.push({
          at: c.settledAt,
          title: `Claim ${c.claimNo} settled`,
          detail: c.settledInr != null ? money(c.settledInr) : undefined,
          tone: 'active',
          icon: Coins,
        });
      }
    }
    if (policy.cancelledAt) {
      rows.push({
        at: policy.cancelledAt,
        title: 'Policy cancelled',
        detail: policy.refundInr != null ? `Pro-rata refund ${money(policy.refundInr)}` : undefined,
        tone: 'expired',
        icon: Ban,
      });
    }
    if (+new Date(policy.endDate) <= Date.now()) {
      rows.push({
        at: policy.endDate,
        title: policy.status === 'LAPSED' ? 'Cover lapsed' : 'Cover ended',
        tone: 'expired',
        icon: AlertTriangle,
      });
    }

    return rows
      .filter((r) => r.at && !Number.isNaN(+new Date(r.at)))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [policy, claims]);

  if (!items.length) {
    return (
      <Card>
        <EmptyState icon={CalendarClock} title="Nothing to show yet" body="This policy carries no dated events." compact />
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeading>History</SectionHeading>
      <Timeline items={items} />
      <hr className="ds-divider" style={{ margin: 'var(--s-4) 0 var(--s-3)' }} />
      <div className="ds-caption">
        Derived from this policy record and its claims — there is no per-policy activity feed on the API.
        The full book feed lives on the client record.
      </div>
    </Card>
  );
}
