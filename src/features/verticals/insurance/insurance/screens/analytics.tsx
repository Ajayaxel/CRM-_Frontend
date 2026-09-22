'use client';

/**
 * Insurance — Reports and Administration.
 *
 * Reports is no longer one long scroll. It is six sub-dashboards behind a tab
 * rail driven by `?view=`, so "the claims picture" is a link you can send
 * someone rather than a place you tell them to scroll to:
 *
 *   Revenue · Premium · Claims · Renewals · Team · Companies
 *
 * The rule every one of them follows: where a screen breaks a total down, it
 * says what the parts add up to. `TieBack` prints "Σ = GWP ₹4.94L" when the
 * split reconciles and turns red the moment it does not — so a broken
 * breakdown is visible to the person reading the number, not only to the
 * invariants script (scripts/insurance-analytics-invariants.py).
 *
 * The behavioural contract:
 *   GET  /insurance/analytics                            (query key ins-analytics)
 *   GET  /insurance/analytics/company-performance        (query key ins-company-performance)
 *   GET  /insurance/companies                            (query key ins-companies)
 *   POST /insurance/companies                            { name, contactName, phone }
 *   POST /insurance/companies/:id/products               { name, category, commissionRatePct, execRatePct }
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  Coins,
  FileText,
  Package,
  Percent,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users2,
  Wallet,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import {
  Avatar,
  Badge,
  BarChart,
  BarList,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  EntityIcon,
  Field,
  FormSection,
  SectionTitle,
  Skeleton,
  StatCard,
  Toolbar,
  humanStatus,
  toneForClaimStatus,
} from '../ui/kit';
import type { DataTableColumn, Tone } from '../ui/kit';

const money = (n?: number | null) => fmtOrgMoney(n);
const pct = (n?: number | null) => (n === null || n === undefined ? '—' : `${n}%`);
const count = (n: number) => n.toLocaleString();

/** A share, or null when there is nothing to take a share of — the API's rule, applied client-side too. */
const sharePct = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100));

/* ============================================================ payloads */

interface AnalyticsPayload {
  kpis: {
    gwpInr: number;
    brokerageEarnedInr: number;
    commissionReceivedInr: number;
    commissionPendingInr: number;
    totalPolicies: number;
    activePolicies: number;
    renewalSuccessPct: number | null;
    claimsRatioPct: number | null;
    totalClaims: number;
    claimsSettledInr: number;
    avgPolicyValueInr: number;
    quoteConversionPct: number | null;
  };
  leaderboard: { name: string; policies: number; premiumInr: number; commissionInr: number }[];
  widgets: {
    monthlyPremium: { month: string; premiumInr: number }[];
    byCategory: { category: string; premiumInr: number }[];
    renewalFunnel: { due: number; contacted: number; quoted: number; renewed: number; lapsed: number };
    claimsByStatus: { status: string; count: number }[];
  };
  insights: string[];
}

export interface CompanyPerformanceRow {
  companyId: string;
  name: string;
  policies: number;
  premiumInr: number;
  brokerageInr: number;
  commissionReceivedInr: number;
  commissionPendingInr: number;
  claims: number;
  claimsSettledInr: number;
  claimsRatioPct: number | null;
  realisationPct: number | null;
}

/* ============================================================ shared pieces */

/**
 * The caption that keeps a breakdown honest.
 *
 * A split whose parts no longer add up to its headline is the single failure
 * mode these dashboards have, and it is invisible by nature — every individual
 * number still looks plausible. So the sum is printed next to the chart, and it
 * goes red and says so when it stops matching.
 */
function TieBack({
  parts, total, headline, format = money, note,
}: { parts: number[]; total: number; headline: string; format?: (n: number) => string; note?: string }) {
  const sum = parts.reduce((n, v) => n + v, 0);
  const ties = sum === total;
  return (
    <div
      className="ds-caption"
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap',
        marginTop: 'var(--s-4)', color: ties ? undefined : 'var(--tone-expired)',
      }}
    >
      {ties ? <Check size={12} style={{ flex: 'none' }} /> : <AlertTriangle size={12} style={{ flex: 'none' }} />}
      <span className="ds-num">
        {ties
          ? `Σ = ${headline} ${format(total)}`
          : `Σ ${format(sum)} ≠ ${headline} ${format(total)} — this breakdown no longer ties back`}
      </span>
      {ties && note && <span>· {note}</span>}
    </div>
  );
}

/** A plain statement of scope, for a widget that legitimately does not sum to a headline. */
function ScopeNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-caption" style={{ marginTop: 'var(--s-4)' }}>{children}</div>
  );
}

/** "2026-08" → "Aug". The API returns calendar keys; users read months. */
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

/** The insights are deterministic sentences from the API — read the intent out
 *  of the sentence so each one gets an icon and a tone rather than a bullet. */
function insightVisual(text: string): { icon: any; tone: Tone } {
  const s = text.toLowerCase();
  if (/below|exceeds|chase|review pricing|floor/.test(s)) return { icon: AlertTriangle, tone: 'expired' };
  if (/expire|due|sweep|renewal/.test(s)) return { icon: AlertTriangle, tone: 'renewal' };
  if (/largest|highest|top|book at|growth|up /.test(s)) return { icon: TrendingUp, tone: 'active' };
  return { icon: Sparkles, tone: 'info' };
}

function MonthlyPremium({ a }: { a: AnalyticsPayload }) {
  const months = a.widgets.monthlyPremium ?? [];
  const inWindow = months.reduce((n, m) => n + m.premiumInr, 0);
  const gwp = a.kpis.gwpInr;
  if (!months.some((m) => m.premiumInr > 0)) {
    return <EmptyState compact icon={BarChart3} title="No premium booked yet" body="Issue a policy to start the trend." />;
  }
  return (
    <>
      <BarChart
        tone="info"
        format={money}
        data={months.map((m) => ({ label: monthLabel(m.month), value: m.premiumInr }))}
      />
      {inWindow === gwp ? (
        <TieBack parts={months.map((m) => m.premiumInr)} total={gwp} headline="GWP" />
      ) : (
        <ScopeNote>
          <span className="ds-num">Σ {money(inWindow)}</span> of <span className="ds-num">GWP {money(gwp)}</span> — the
          balance was written before this six-month window, so the chart is a window, not a breakdown.
        </ScopeNote>
      )}
    </>
  );
}

/* ============================================================ Reports shell */

const VIEWS = ['Revenue', 'Premium', 'Claims', 'Renewals', 'Team', 'Companies'] as const;
type View = (typeof VIEWS)[number];

const FUNNEL_STAGES: { key: keyof AnalyticsPayload['widgets']['renewalFunnel']; label: string; tone: Tone }[] = [
  { key: 'due', label: 'Due', tone: 'renewal' },
  { key: 'contacted', label: 'Contacted', tone: 'sales' },
  { key: 'quoted', label: 'Quoted', tone: 'info' },
  { key: 'renewed', label: 'Renewed', tone: 'active' },
  { key: 'lapsed', label: 'Lapsed', tone: 'expired' },
];

export function InsuranceAnalytics() {
  const params = useSearchParams();
  const raw = params?.get('view') ?? '';
  const view: View = VIEWS.find((v) => v.toLowerCase() === raw.toLowerCase()) ?? 'Revenue';

  const { data: a, isLoading } = useQuery({
    queryKey: ['ins-analytics'],
    queryFn: async () => (await api.get<AnalyticsPayload>('/insurance/analytics')).data,
  });

  // Only the Companies board needs the per-insurer pull, so it is fetched on demand.
  const companies = useQuery({
    queryKey: ['ins-company-performance'],
    enabled: view === 'Companies',
    retry: false,
    queryFn: async () => (await api.get<CompanyPerformanceRow[]>('/insurance/analytics/company-performance')).data,
  });

  if (isLoading) {
    return (
      <div className="ds-stack">
        <div className="ds-grid ds-grid-kpi">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} rows={1} height={112} />
          ))}
        </div>
        <Skeleton rows={2} height={230} />
      </div>
    );
  }

  if (!a) {
    return (
      <Card>
        <EmptyState
          icon={BarChart3}
          title="No reporting yet"
          body="Issue a policy or accrue a commission and the numbers start here."
        />
      </Card>
    );
  }

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <nav className="ds-subnav" aria-label="Report sections">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={`/insurance/reports?view=${v.toLowerCase()}`}
            className="ds-subnav-item"
            data-active={view === v}
            aria-current={view === v ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
            scroll={false}
          >
            {v}
          </Link>
        ))}
      </nav>

      {view === 'Revenue' && <RevenueView a={a} />}
      {view === 'Premium' && <PremiumView a={a} />}
      {view === 'Claims' && <ClaimsView a={a} />}
      {view === 'Renewals' && <RenewalsView a={a} />}
      {view === 'Team' && <TeamView a={a} />}
      {view === 'Companies' && <CompaniesView a={a} query={companies} />}
    </div>
  );
}

/* ------------------------------------------------------------ Revenue */

function RevenueView({ a }: { a: AnalyticsPayload }) {
  const k = a.kpis;
  const collected = k.commissionReceivedInr + k.commissionPendingInr;
  const realisation = sharePct(k.commissionReceivedInr, collected);

  return (
    <>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Gross written premium" value={money(k.gwpInr)} tone="info" icon={ShieldCheck}
          deltaLabel={`${k.totalPolicies} policies · ${k.activePolicies} active`} />
        <StatCard label="Brokerage earned" value={money(k.brokerageEarnedInr)} tone="sales" icon={Wallet} />
        <StatCard label="Commission received" value={money(k.commissionReceivedInr)} tone="active" icon={Coins} />
        <StatCard label="Commission pending" value={money(k.commissionPendingInr)} tone="renewal" icon={Coins} />
        <StatCard label="Realisation" value={pct(realisation)} tone="active" icon={Percent} />
      </div>

      <Card>
        <SectionTitle sub="What has been collected against what is still owed on insurer statements.">
          Commission realisation
        </SectionTitle>
        <BarList
          format={money}
          items={[
            { label: 'Received', value: k.commissionReceivedInr, tone: 'active' },
            { label: 'Pending', value: k.commissionPendingInr, tone: 'renewal' },
          ]}
        />
        <ScopeNote>
          <span className="ds-num">Σ {money(collected)}</span> booked against{' '}
          <span className="ds-num">brokerage earned {money(k.brokerageEarnedInr)}</span> — the gap is brokerage accrued
          on policies whose commission row has not been raised yet, and it can never be negative.
        </ScopeNote>
      </Card>

      <Card>
        <SectionTitle sub="Premium written per calendar month, last six months.">Monthly trend</SectionTitle>
        <MonthlyPremium a={a} />
      </Card>

      {a.insights?.length > 0 && (
        <Card>
          <SectionTitle sub="Deterministic reads on this book — no guesses.">What the numbers say</SectionTitle>
          <div className="ds-stack" style={{ gap: 0 }}>
            {a.insights.map((text, i) => {
              const v = insightVisual(text);
              return (
                <div key={i} className="ds-list-row" style={{ alignItems: 'flex-start' }}>
                  <EntityIcon icon={v.icon} tone={v.tone} />
                  <span className="ds-body" style={{ color: 'var(--ink)', minWidth: 0 }}>{text}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------ Premium */

function PremiumView({ a }: { a: AnalyticsPayload }) {
  const k = a.kpis;
  const cats = a.widgets.byCategory ?? [];

  return (
    <>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Gross written premium" value={money(k.gwpInr)} tone="info" icon={ShieldCheck} />
        <StatCard label="Average policy value" value={money(k.avgPolicyValueInr)} tone="sales" icon={Percent}
          deltaLabel={`across ${k.totalPolicies} policies`} />
        <StatCard label="Policies on the book" value={count(k.totalPolicies)} tone="neutral" icon={FileText}
          deltaLabel={`${k.activePolicies} active`} />
        <StatCard label="Quote conversion" value={pct(k.quoteConversionPct)} tone="sales" icon={FileText} />
      </div>

      <Card>
        <SectionTitle sub="Where the premium sits by class of business.">Premium by category</SectionTitle>
        {cats.length === 0 ? (
          <EmptyState compact icon={BarChart3} title="No premium booked yet" />
        ) : (
          <>
            <BarList
              format={money}
              items={cats
                .slice()
                .sort((x, y) => y.premiumInr - x.premiumInr)
                .map((c) => ({
                  label: humanStatus(c.category),
                  value: c.premiumInr,
                  tone: 'info' as Tone,
                  meta: pct(sharePct(c.premiumInr, k.gwpInr)),
                }))}
            />
            <TieBack parts={cats.map((c) => c.premiumInr)} total={k.gwpInr} headline="GWP"
              note="every written policy is in exactly one category" />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle sub="Premium written per calendar month, last six months.">Premium by month</SectionTitle>
        <MonthlyPremium a={a} />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ Claims */

const CLOSED_CLAIM_STATUSES = ['SETTLED', 'REJECTED'];

function ClaimsView({ a }: { a: AnalyticsPayload }) {
  const k = a.kpis;
  const rows = a.widgets.claimsByStatus ?? [];
  const open = rows.filter((r) => !CLOSED_CLAIM_STATUSES.includes(r.status.toUpperCase())).reduce((n, r) => n + r.count, 0);

  return (
    <>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Claims registered" value={count(k.totalClaims)} tone="claim" icon={AlertTriangle}
          deltaLabel={`${open} still open`} />
        <StatCard label="Settled value" value={money(k.claimsSettledInr)} tone="active" icon={Coins} />
        <StatCard label="Claims ratio" value={pct(k.claimsRatioPct)} tone="claim" icon={Percent}
          deltaLabel="settled value ÷ GWP" />
        <StatCard label="Gross written premium" value={money(k.gwpInr)} tone="info" icon={ShieldCheck} />
      </div>

      <Card>
        <SectionTitle sub="Open and closed claims by stage.">Claims by status</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState compact icon={ShieldCheck} title="No claims registered" />
        ) : (
          <>
            <BarList
              items={rows.map((c) => ({
                label: humanStatus(c.status),
                value: c.count,
                tone: toneForClaimStatus(c.status),
                meta: pct(sharePct(c.count, k.totalClaims)),
              }))}
            />
            <TieBack parts={rows.map((c) => c.count)} total={k.totalClaims} headline="claims registered"
              format={count} note="a claim sits in exactly one status" />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle sub="What the book has paid out against what it has written.">Claims ratio</SectionTitle>
        <BarList
          format={money}
          items={[
            { label: 'Settled to customers', value: k.claimsSettledInr, tone: 'claim' },
            { label: 'Gross written premium', value: k.gwpInr, tone: 'info' },
          ]}
        />
        <ScopeNote>
          {k.claimsRatioPct === null
            ? 'No premium has been written yet, so there is no ratio to state — this reads “—”, never 0%.'
            : `${pct(k.claimsRatioPct)} of written premium has been settled as claims. Only claims marked SETTLED carry a settled value; open files are counted above but valued at nothing until they close.`}
        </ScopeNote>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ Renewals */

function RenewalsView({ a }: { a: AnalyticsPayload }) {
  const k = a.kpis;
  const f = a.widgets.renewalFunnel;
  const inFunnel = FUNNEL_STAGES.reduce((n, s) => n + (f?.[s.key] ?? 0), 0);
  const decided = (f?.renewed ?? 0) + (f?.lapsed ?? 0);

  const items = FUNNEL_STAGES.map((s) => ({
    label: s.label,
    value: f?.[s.key] ?? 0,
    tone: s.tone,
    meta: pct(sharePct(f?.[s.key] ?? 0, inFunnel)),
  }));

  return (
    <>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Renewal success" value={pct(k.renewalSuccessPct)} tone="active" icon={RefreshCw}
          deltaLabel={decided ? `${f.renewed} renewed of ${decided} decided` : 'nothing decided yet'} />
        <StatCard label="In the pipeline" value={count((f?.due ?? 0) + (f?.contacted ?? 0) + (f?.quoted ?? 0))}
          tone="renewal" icon={RefreshCw} deltaLabel="active policies with a stage set" />
        <StatCard label="Lapsed" value={count(f?.lapsed ?? 0)} tone="expired" icon={AlertTriangle} />
        <StatCard label="Active policies" value={count(k.activePolicies)} tone="info" icon={ShieldCheck}
          deltaLabel={`of ${k.totalPolicies} on the book`} />
      </div>

      <Card>
        <SectionTitle sub="Where the book sits on its way to renewal.">Renewal funnel</SectionTitle>
        {inFunnel === 0 ? (
          <EmptyState compact icon={RefreshCw} title="Nothing in the renewal pipeline" />
        ) : (
          <>
            <BarList items={items} />
            <ScopeNote>
              <span className="ds-num">Σ {count(inFunnel)}</span> — this is a pipeline, not a breakdown of the book: it
              counts active policies that have a renewal stage set, plus every policy already renewed or lapsed. Active
              policies not yet worked have no stage and are deliberately absent, so it does not sum to the{' '}
              <span className="ds-num">{count(k.totalPolicies)}</span> policies on the book.
            </ScopeNote>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle sub="Of the policies that reached a decision.">Renewal success</SectionTitle>
        {decided === 0 ? (
          <EmptyState compact icon={RefreshCw} title="Nothing has been decided yet"
            body="Success is renewed ÷ (renewed + lapsed). With no decided policies the rate is unknown, so it reads “—” rather than 0%." />
        ) : (
          <>
            <BarList
              items={[
                { label: 'Renewed', value: f.renewed, tone: 'active', meta: pct(sharePct(f.renewed, decided)) },
                { label: 'Lapsed', value: f.lapsed, tone: 'expired', meta: pct(sharePct(f.lapsed, decided)) },
              ]}
            />
            <TieBack parts={[f.renewed, f.lapsed]} total={decided} headline="decided policies" format={count}
              note="the denominator behind the success rate" />
          </>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ Team */

/**
 * `executiveName` is free text on InsPolicy, so one human can hold two rows
 * ("Meera Joshi" and "Meera J" are both in the live data). Merging them would be
 * a guess — they might be two people — so the rows stand as typed and the screen
 * says plainly what it is looking at.
 */
function nearDuplicateNames(names: string[]): string[][] {
  const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const out: string[][] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = norm(names[i]);
      const b = norm(names[j]);
      if (!a || !b) continue;
      // One spelling being a prefix of the other is the shape abbreviation takes.
      if (a === b || a.startsWith(b) || b.startsWith(a)) out.push([names[i], names[j]]);
    }
  }
  return out;
}

function TeamView({ a }: { a: AnalyticsPayload }) {
  const k = a.kpis;
  const board = a.leaderboard ?? [];
  const suspects = useMemo(() => nearDuplicateNames(board.map((e) => e.name)), [board]);

  return (
    <>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Executives on the book" value={count(board.length)} tone="sales" icon={Users2} />
        <StatCard label="Gross written premium" value={money(k.gwpInr)} tone="info" icon={ShieldCheck} />
        <StatCard label="Policies written" value={count(k.totalPolicies)} tone="neutral" icon={FileText} />
        <StatCard label="Average policy value" value={money(k.avgPolicyValueInr)} tone="sales" icon={Percent} />
      </div>

      <Card>
        <SectionTitle sub="Ranked by premium written, with share of the book.">Executive leaderboard</SectionTitle>
        {board.length === 0 ? (
          <EmptyState compact icon={TrendingUp} title="No executive activity yet" />
        ) : (
          <>
            <div className="ds-stack" style={{ gap: 0 }}>
              {board.map((e, i) => {
                const share = sharePct(e.premiumInr, k.gwpInr) ?? 0;
                return (
                  <div key={e.name} className="ds-list-row">
                    <span className="ds-caption ds-num" style={{ width: 'var(--s-5)', textAlign: 'right', flex: 'none' }}>
                      {i + 1}
                    </span>
                    <Avatar name={e.name} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.name}
                      </div>
                      <div className="ds-caption">
                        {e.policies} {e.policies === 1 ? 'policy' : 'policies'} · {money(e.commissionInr)} commission
                      </div>
                      <div
                        className="ds-inset"
                        style={{ height: 'var(--s-1)', marginTop: 'var(--s-2)', overflow: 'hidden', borderRadius: 'var(--r-pill)' }}
                      >
                        <div
                          style={{
                            width: `${Math.max(share, e.premiumInr > 0 ? 2 : 0)}%`,
                            height: '100%',
                            background: 'var(--tone-sales)',
                            opacity: 0.85,
                            borderRadius: 'var(--r-pill)',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div className="ds-h3 ds-num">{money(e.premiumInr)}</div>
                      <div className="ds-caption ds-num">{share}% of book</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <TieBack parts={board.map((e) => e.premiumInr)} total={k.gwpInr} headline="GWP" />
            <TieBack parts={board.map((e) => e.policies)} total={k.totalPolicies} headline="policies on the book"
              format={count} />

            {suspects.length > 0 && (
              <div className="ds-caption" style={{ marginTop: 'var(--s-3)', display: 'flex', gap: 'var(--s-2)' }}>
                <AlertTriangle size={12} style={{ flex: 'none', marginTop: 2, color: 'var(--tone-renewal)' }} />
                <span>
                  {suspects.length === 1 ? 'Two entries look' : `${suspects.length} pairs of entries look`} like the same
                  person ({suspects.map((p) => p.join(' / ')).join('; ')}) — executive names are typed free-hand, so the
                  rows are shown exactly as they were entered rather than merged on a guess.
                </span>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ Companies */

function CompaniesView({
  a, query,
}: { a: AnalyticsPayload; query: { data?: CompanyPerformanceRow[]; isLoading: boolean; isError: boolean; error?: unknown } }) {
  const k = a.kpis;
  const rows = query.data ?? [];

  const columns: DataTableColumn<CompanyPerformanceRow>[] = [
    {
      key: 'name', header: 'Insurer', sortable: true,
      render: (r) => (
        <Link href={`/insurance/insurers/${r.companyId}`} className="ds-viewall" style={{ textDecoration: 'none', fontWeight: 620, color: 'var(--ink)' }}>
          {r.name}
        </Link>
      ),
    },
    { key: 'policies', header: 'Policies', align: 'right', sortable: true, render: (r) => <span className="ds-num">{count(r.policies)}</span> },
    { key: 'premiumInr', header: 'Premium', align: 'right', sortable: true, render: (r) => <span className="ds-num">{money(r.premiumInr)}</span> },
    { key: 'brokerageInr', header: 'Brokerage', align: 'right', sortable: true, render: (r) => <span className="ds-num">{money(r.brokerageInr)}</span> },
    { key: 'commissionReceivedInr', header: 'Received', align: 'right', sortable: true, render: (r) => <span className="ds-num">{money(r.commissionReceivedInr)}</span> },
    { key: 'commissionPendingInr', header: 'Pending', align: 'right', sortable: true, render: (r) => <span className="ds-num">{money(r.commissionPendingInr)}</span> },
    { key: 'realisationPct', header: 'Realisation', align: 'right', sortable: true, render: (r) => <span className="ds-num">{pct(r.realisationPct)}</span> },
    { key: 'claims', header: 'Claims', align: 'right', sortable: true, render: (r) => <span className="ds-num">{count(r.claims)}</span> },
    { key: 'claimsSettledInr', header: 'Settled', align: 'right', sortable: true, render: (r) => <span className="ds-num">{money(r.claimsSettledInr)}</span> },
    { key: 'claimsRatioPct', header: 'Claims ratio', align: 'right', sortable: true, render: (r) => <span className="ds-num">{pct(r.claimsRatioPct)}</span> },
  ];

  if (query.isError) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="Insurer performance is not available"
          body={apiErrorMessage(query.error) || 'The company-performance endpoint did not answer.'}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Insurers on the panel" value={query.isLoading ? '—' : count(rows.length)} tone="info" icon={Building2}
          deltaLabel={query.isLoading ? undefined : `${rows.filter((r) => r.policies > 0).length} with business placed`} />
        <StatCard label="Gross written premium" value={money(k.gwpInr)} tone="info" icon={ShieldCheck} />
        <StatCard label="Brokerage earned" value={money(k.brokerageEarnedInr)} tone="sales" icon={Wallet} />
        <StatCard label="Policies on the book" value={count(k.totalPolicies)} tone="neutral" icon={FileText} />
      </div>

      <Card>
        <SectionTitle sub="Every insurer on the panel, and what each one is actually worth.">
          Company performance
        </SectionTitle>
        <DataTable
          rows={rows}
          columns={columns}
          loading={query.isLoading}
          rowKey={(r) => r.companyId}
          empty="No insurers on the panel yet."
        />
        {!query.isLoading && rows.length > 0 && (
          <>
            <TieBack parts={rows.map((r) => r.premiumInr)} total={k.gwpInr} headline="GWP" />
            <TieBack parts={rows.map((r) => r.policies)} total={k.totalPolicies} headline="policies on the book"
              format={count} />
            <ScopeNote>
              Realisation is received ÷ (received + pending) and the claims ratio is settled ÷ premium. Both read “—”
              rather than 0% where there is nothing in the denominator.
            </ScopeNote>
          </>
        )}
      </Card>
    </>
  );
}

/* ============================================================ Administration */

const PRODUCT_CATEGORIES = [
  'HEALTH', 'MOTOR', 'BIKE', 'COMMERCIAL_VEHICLE', 'TRAVEL', 'FIRE',
  'MARINE', 'PROPERTY', 'LIFE', 'ACCIDENT', 'BUSINESS', 'CUSTOM',
];

interface InsurerProduct {
  id: string;
  name: string;
  category: string;
  commissionRatePct: number;
  execRatePct: number;
}

interface Insurer {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  products?: InsurerProduct[];
}

export function InsuranceInsurers() {
  const qc = useQueryClient();
  const { data: companies, isLoading } = useQuery({
    queryKey: ['ins-companies'],
    queryFn: async () => (await api.get<Insurer[]>('/insurance/companies')).data,
  });

  const [insurerOpen, setInsurerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [f, setF] = useState({ name: '', contactName: '', phone: '' });
  const [pf, setPf] = useState({ companyId: '', name: '', category: 'MOTOR', commissionRatePct: '15', execRatePct: '30' });

  const refresh = () => qc.invalidateQueries({ queryKey: ['ins-companies'] });

  const create = useMutation({
    mutationFn: () => api.post('/insurance/companies', f),
    onSuccess: () => {
      toast.success('Insurer added');
      setF({ name: '', contactName: '', phone: '' });
      setInsurerOpen(false);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addProduct = useMutation({
    mutationFn: () =>
      api.post(`/insurance/companies/${pf.companyId}/products`, {
        name: pf.name,
        category: pf.category,
        commissionRatePct: Number(pf.commissionRatePct),
        execRatePct: Number(pf.execRatePct),
      }),
    onSuccess: () => {
      toast.success('Product added with commission config');
      setPf({ ...pf, name: '' });
      setProductOpen(false);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const list = companies ?? [];

  const openProduct = (companyId?: string) => {
    setPf((p) => ({ ...p, companyId: companyId ?? p.companyId ?? '' }));
    setProductOpen(true);
  };

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <Toolbar>
        <button className="btn-primary" onClick={() => setInsurerOpen(true)}>
          <Building2 size={14} /> Add insurer
        </button>
        <button className="btn-secondary" disabled={list.length === 0} onClick={() => openProduct()}>
          <Package size={14} /> Add product
        </button>
        <Link href="/insurance/reports?view=companies" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
          <BarChart3 size={13} /> Company performance
        </Link>
        <span className="ds-caption" style={{ marginLeft: 'auto' }}>
          {list.length} {list.length === 1 ? 'insurer' : 'insurers'} ·{' '}
          {list.reduce((n, c) => n + (c.products?.length ?? 0), 0)} products
        </span>
      </Toolbar>

      {isLoading ? (
        <div className="ds-grid ds-grid-cards">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} rows={1} height={170} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No insurers yet"
            body="Add the companies you place business with — their products carry the commission and executive-share rates the console pays out on."
            actionLabel="Add insurer"
            onAction={() => setInsurerOpen(true)}
          />
        </Card>
      ) : (
        <div className="ds-grid ds-grid-cards">
          {list.map((c) => {
            const products = c.products ?? [];
            const avgCommission = products.length
              ? Math.round((products.reduce((n, p) => n + (p.commissionRatePct ?? 0), 0) / products.length) * 10) / 10
              : null;
            const href = `/insurance/insurers/${c.id}`;
            return (
              <Card key={c.id}>
                <div className="ds-row" style={{ alignItems: 'flex-start', marginBottom: 'var(--s-4)' }}>
                  <EntityIcon icon={Building2} tone="info" size="lg" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* The name is the link rather than the whole card: the empty
                        state below carries a button, and a button inside a link
                        is a broken control. */}
                    <Link
                      href={href}
                      className="ds-h3"
                      style={{ textDecoration: 'none', color: 'var(--ink)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {c.name}
                    </Link>
                    <div className="ds-caption">
                      {[c.contactName, c.phone].filter(Boolean).join(' · ') || 'No contact on file'}
                    </div>
                  </div>
                </div>

                {products.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Package}
                    title="No products"
                    body="Add one to set its commission and executive share."
                    actionLabel="Add product"
                    onAction={() => openProduct(c.id)}
                  />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
                    {products.map((p) => (
                      <Badge key={p.id} tone="neutral" dot={false}>
                        <span style={{ fontWeight: 650, color: 'var(--ink)' }}>{p.name}</span>
                        <span className="ds-muted">{humanStatus(p.category)}</span>
                        <span>{p.commissionRatePct}% · exec {p.execRatePct}%</span>
                      </Badge>
                    ))}
                  </div>
                )}

                <hr className="ds-divider" style={{ margin: 'var(--s-4) 0 var(--s-3)' }} />
                <div className="ds-row">
                  <span className="ds-caption">
                    {products.length === 0
                      ? 'No products'
                      : `${products.length} ${products.length === 1 ? 'product' : 'products'}${avgCommission != null ? ` · avg commission ${avgCommission}%` : ''}`}
                  </span>
                  <Link href={href} className="ds-viewall" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
                    Open insurer <ChevronRight size={13} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------ add insurer drawer */}
      <Drawer
        open={insurerOpen}
        onClose={() => setInsurerOpen(false)}
        title="Add insurer"
        subtitle="A company you place business with."
      >
        <FormSection title="Company" description="The name your team recognises on a policy schedule.">
          <Field label="Insurer name" required span={2}>
            <input
              className="input"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Star Health"
            />
          </Field>
          <Field label="Contact name" hint="Your relationship manager at the insurer.">
            <input className="input" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
        </FormSection>
        <div className="ds-row">
          <button className="btn-primary" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Adding…' : 'Add insurer'}
          </button>
          <button className="btn-secondary" onClick={() => setInsurerOpen(false)}>Cancel</button>
        </div>
      </Drawer>

      {/* ------------------------------------------------ add product drawer */}
      <Drawer
        open={productOpen}
        onClose={() => setProductOpen(false)}
        title="Add product"
        subtitle="Products carry the commission the console accrues on."
      >
        <FormSection title="Product" description="Which insurer sells it, and what it is called.">
          <Field label="Insurer" required>
            <select className="input" value={pf.companyId} onChange={(e) => setPf({ ...pf, companyId: e.target.value })}>
              <option value="">Select…</option>
              {list.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Category" required>
            <select className="input" value={pf.category} onChange={(e) => setPf({ ...pf, category: e.target.value })}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{humanStatus(c)}</option>
              ))}
            </select>
          </Field>
          <Field label="Product name" required span={2}>
            <input
              className="input"
              value={pf.name}
              onChange={(e) => setPf({ ...pf, name: e.target.value })}
              placeholder="Comprehensive Motor"
            />
          </Field>
        </FormSection>

        <FormSection title="Commission" description="What the insurer pays, and the executive's cut of it.">
          <Field label="Commission %" hint="Brokerage on the premium.">
            <input
              className="input"
              inputMode="decimal"
              value={pf.commissionRatePct}
              onChange={(e) => setPf({ ...pf, commissionRatePct: e.target.value })}
            />
          </Field>
          <Field label="Executive share %" hint="Share of the brokerage, not of the premium.">
            <input
              className="input"
              inputMode="decimal"
              value={pf.execRatePct}
              onChange={(e) => setPf({ ...pf, execRatePct: e.target.value })}
            />
          </Field>
        </FormSection>

        <div className="ds-row">
          <button
            className="btn-primary"
            disabled={!pf.companyId || !pf.name || addProduct.isPending}
            onClick={() => addProduct.mutate()}
          >
            {addProduct.isPending ? 'Adding…' : 'Add product'}
          </button>
          <button className="btn-secondary" onClick={() => setProductOpen(false)}>Cancel</button>
        </div>
      </Drawer>
    </div>
  );
}
