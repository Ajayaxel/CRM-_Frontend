'use client';

/**
 * Insurance — Quotes & comparison.
 *
 * Insurance is a comparison product, so this screen is built around choosing,
 * not reading. The landing state is a grid of quote cards; opening one swaps the
 * page for a side-by-side of insurer options where the premium is the hero and
 * the broker can issue the winner in one click.
 *
 * Everything on a comparison card is derived from data the API actually holds.
 * The recommended flag comes from the server (`recommended`, computed as the
 * lowest premium per unit of cover); the star rating is our own honest restatement
 * of cover-per-premium and says so. We do not invent claim-settlement ratios.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileText, Plus, ShieldCheck, Star } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { NewQuoteWizard } from '../ui/new-quote-wizard';
import { QuoteDeclarationPanel } from '../ui/quote-declaration';
import { openQuote } from '../ui/quote-document';
import { cur, fmtOrgMoney } from '@/lib/org-locale';
import {
  Badge,
  Card,
  Drawer,
  EmptyState,
  Field,
  FormSection,
  SectionTitle,
  Skeleton,
  Toolbar,
  humanStatus,
} from '../ui/kit';
import type { Tone } from '../ui/kit';

// ---------------------------------------------------------------- types

interface QuoteLine {
  id: string;
  companyName: string;
  productName: string;
  premiumInr: number;
  sumInsuredInr: number;
  coverage?: string | null;
  addOns?: string | null;
  exclusions?: string | null;
  recommended?: boolean;
}

interface Quote {
  id: string;
  reference: string;
  category: string;
  status: string;
  createdAt: string;
  client?: { name?: string | null } | null;
  lines?: QuoteLine[];
  /** What the client asked to be covered for, captured when the quote is opened. */
  requirement?: { sumInsuredInr?: number | null } | null;
}

// The category picker moved to ../ui/new-quote-wizard.tsx, which holds the one
// list this screen offers. A second copy here would be a second thing to keep
// in step with WRITABLE_CATEGORIES, and the one that drifted would be whichever
// nobody was looking at. scripts/motor-category-offline.ts guards the list where
// it now lives.

function toneForQuoteStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'CONVERTED': return 'active';
    case 'APPROVED': return 'sales';
    case 'PRESENTED': return 'info';
    case 'LOST': return 'expired';
    default: return 'neutral';
  }
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const digits = (v: string) => v.replace(/\D/g, '');

/** Free-text summary fields are comma/semicolon separated in practice. */
function chipsFrom(value?: string | null): string[] {
  if (!value) return [];
  return value.split(/[,;·]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
}

// ---------------------------------------------------------------- rating

/**
 * Stars are a restatement of cover per premium — nothing else. The best ratio in
 * the comparison earns 5, the rest scale down proportionally and never drop
 * below 2, because a quote a broker put on the table is not a one-star product.
 */
function starsFor(line: QuoteLine, bestRatio: number): number {
  const ratio = line.sumInsuredInr / Math.max(1, line.premiumInr);
  if (!Number.isFinite(ratio) || bestRatio <= 0) return 5;
  return Math.min(5, Math.max(2, Math.round((ratio / bestRatio) * 5)));
}

function StarRating({ value }: { value: number }) {
  return (
    <span
      style={{ display: 'inline-flex', gap: 3, color: 'var(--tone-renewal)' }}
      role="img"
      aria-label={`${value} out of 5 on cover per premium`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          fill={i <= value ? 'currentColor' : 'none'}
          style={{ opacity: i <= value ? 1 : 0.32 }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- chips

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`ds-badge ds-tone-${tone}`}>{children}</span>;
}

function ChipRow({ label, values, tone }: { label: string; values: string[]; tone: Tone }) {
  if (!values.length) return null;
  return (
    <div>
      <div className="ds-caption-upper" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {values.map((v) => <Chip key={v} tone={tone}>{v}</Chip>)}
      </div>
    </div>
  );
}

// ================================================================ screen

export function InsuranceQuotes() {
  const qc = useQueryClient();
  const params = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);

  // Deep link: /insurance?new=1 lands the user straight in the new-quote drawer.
  useEffect(() => {
    if (params?.get('new') === '1') setNewOpen(true);
  }, [params]);

  // Deep link from the Renewal Centre: ?renewalOf=<policyId> opens the wizard
  // pre-filled from that policy — the server re-verifies everything, so the
  // param is a convenience, never an authority.
  const renewalOfId = params?.get('renewalOf') || null;
  const renewalPolicyQ = useQuery({
    queryKey: ['ins-policies'],
    queryFn: async () => (await api.get<any[]>('/insurance/policies')).data,
    enabled: !!renewalOfId,
  });
  const renewalOf = useMemo(() => {
    if (!renewalOfId) return null;
    const p = (renewalPolicyQ.data ?? []).find((x) => x.id === renewalOfId);
    if (!p) return null;
    return {
      policyId: p.id, policyNo: p.policyNo, clientId: p.clientId,
      category: p.category, productId: p.productId,
      premiumInr: p.premiumInr, sumInsuredInr: p.sumInsuredInr,
      agentId: p.agentId ?? null,
    };
  }, [renewalOfId, renewalPolicyQ.data]);
  useEffect(() => {
    if (renewalOf) setNewOpen(true);
  }, [renewalOf]);

  const quotesQ = useQuery({
    queryKey: ['ins-quotes'],
    queryFn: async () => (await api.get<Quote[]>('/insurance/quotes')).data,
  });
  const clientsQ = useQuery({
    queryKey: ['ins-clients'],
    queryFn: async () => (await api.get<any[]>('/insurance/clients')).data,
  });
  const companiesQ = useQuery({
    queryKey: ['ins-companies'],
    queryFn: async () => (await api.get<any[]>('/insurance/companies')).data,
  });
  // The introducers a quote can be attributed to. The wizard filters to ACTIVE
  // itself, because the API refuses the rest and a dropdown that fails on submit
  // is worse than a shorter dropdown.
  const agentsQ = useQuery({
    queryKey: ['ins-agents'],
    queryFn: async () => (await api.get<any[]>('/insurance/agents')).data,
  });
  const detailQ = useQuery({
    queryKey: ['ins-quote', selectedId],
    queryFn: async () => (await api.get<Quote>(`/insurance/quotes/${selectedId}`)).data,
    enabled: !!selectedId,
  });

  const refreshAll = (id?: string | null) => {
    qc.invalidateQueries({ queryKey: ['ins-quotes'] });
    if (id) qc.invalidateQueries({ queryKey: ['ins-quote', id] });
  };

  // ---- new quote: the four-step wizard.
  // It reads `companiesQ` above — the same insurer/product list the add-line
  // picker uses, so the plans a broker compares are the plans the master holds.

  /**
   * One quote, then one line per chosen plan.
   *
   * The lines go up SEQUENTIALLY and the quote id is captured first, so a
   * failure part-way leaves a real quote with the lines that did land — which
   * the broker can see and finish by hand. Firing them in parallel and failing
   * one would leave the same partial state with no way to tell which.
   */
  const createQuote = useMutation({
    mutationFn: async (input: {
      clientId: string; category: string;
      type?: 'RENEWAL'; sourcePolicyId?: string;
      lines: {
        productId: string; premiumInr: number; sumInsuredInr: number;
        agentId: string | null;
        agentCommissionInr: number;
        execCommissionInr: number;
        brokerageRatePct: number | null;
      }[];
    }) => {
      const quote = (await api.post<Quote>('/insurance/quotes', {
        clientId: input.clientId,
        category: input.category,
        // What makes it a renewal path — the server links, guards and stages.
        ...(input.type === 'RENEWAL' && input.sourcePolicyId
          ? { type: input.type, sourcePolicyId: input.sourcePolicyId }
          : {}),
      })).data;
      const failed: string[] = [];
      for (const l of input.lines) {
        try {
          await api.post(`/insurance/quotes/${quote.id}/lines`, l);
        } catch (e) {
          failed.push(apiErrorMessage(e));
        }
      }
      return { quote, failed };
    },
    onSuccess: ({ quote, failed }) => {
      if (failed.length) {
        toast.error(`Quote opened, but ${failed.length} plan${failed.length === 1 ? '' : 's'} could not be added — ${failed[0]}`);
      } else {
        toast.success('Quote created with the plans to compare');
      }
      setNewOpen(false);
      qc.invalidateQueries({ queryKey: ['ins-quotes'] });
      // A renewal quote stages its source policy QUOTED — the policy book and
      // the Renewal Centre read that, so their caches refresh too.
      qc.invalidateQueries({ queryKey: ['ins-policies'] });
      if (quote?.id) setSelectedId(quote.id);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // ---- add option (quote line)
  const emptyLine = { productId: '', premiumInr: '', sumInsuredInr: '', coverage: '', addOns: '', exclusions: '', brokerageRatePct: '' };
  const [lf, setLf] = useState(emptyLine);
  const addLine = useMutation({
    mutationFn: () =>
      api.post(`/insurance/quotes/${selectedId}/lines`, {
        productId: lf.productId,
        premiumInr: Number(lf.premiumInr),
        sumInsuredInr: Number(lf.sumInsuredInr),
        coverage: lf.coverage || undefined,
        addOns: lf.addOns || undefined,
        exclusions: lf.exclusions || undefined,
        // Blank means "use the product's rate" — deliberately not 0, which is a
        // real rate a broker might genuinely write (a no-commission placement).
        brokerageRatePct: lf.brokerageRatePct === '' ? undefined : Number(lf.brokerageRatePct),
      }),
    onSuccess: () => {
      toast.success('Insurer added to the comparison');
      setLf(emptyLine);
      setLineOpen(false);
      refreshAll(selectedId);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // ---- who gets the credit. The screen used to post a hardcoded 'Desk', so
  // every policy issued in-app was attributed to a person who does not exist
  // and the leaderboard reported on it. Now it is chosen, and required.
  const executivesQ = useQuery<any[]>({
    queryKey: ['ins-executives'],
    queryFn: async () => (await api.get('/insurance/executives')).data,
  });
  const [issuingLine, setIssuingLine] = useState<string | null>(null);
  const [execId, setExecId] = useState('');
  // The insurer's OWN policy number and the date cover actually starts. Without
  // these the book numbers every policy itself, and nothing a broker holds can
  // be matched to the insurer's records — which is the first thing asked for in
  // a claim or a reconciliation.
  const [issuePolicyNo, setIssuePolicyNo] = useState('');
  const [issueStart, setIssueStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [issueTerm, setIssueTerm] = useState('12');
  // Editing an option that was keyed wrong, before it goes to the client.
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [ef, setEf] = useState({ premiumInr: '', sumInsuredInr: '', coverage: '', addOns: '', exclusions: '' });

  // ---- issue policy (the money action)
  const issue = useMutation({
    mutationFn: (lineId: string) => api.post(`/insurance/quote-lines/${lineId}/issue`, {
      executiveId: execId,
      policyNo: issuePolicyNo.trim() || undefined,
      startDate: issueStart || undefined,
      termMonths: Number(issueTerm) || 12,
    }),
    onSuccess: (r: any) => {
      toast.success(
        `Policy ${r.data.policy.policyNo} issued — commission ${fmtOrgMoney(r.data.commission.grossInr)} accrued`,
      );
      setIssuingLine(null);
      setExecId('');
      setIssuePolicyNo('');
      refreshAll(selectedId);
      qc.invalidateQueries({ queryKey: ['ins-policies'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  /** A quote on the desk is a working document until it converts. */
  const editLine = useMutation({
    mutationFn: (lineId: string) => api.patch(`/insurance/quote-lines/${lineId}`, {
      premiumInr: Number(ef.premiumInr),
      sumInsuredInr: Number(ef.sumInsuredInr),
      // The chips are what the client actually reads on the comparison, so they
      // have to be correctable too.
      coverage: ef.coverage,
      addOns: ef.addOns,
      exclusions: ef.exclusions,
    }),
    onSuccess: () => { toast.success('Option updated'); setEditingLine(null); refreshAll(selectedId); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const dropLine = useMutation({
    mutationFn: (lineId: string) => api.delete(`/insurance/quote-lines/${lineId}`),
    onSuccess: () => { toast.success('Option removed from the comparison'); refreshAll(selectedId); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const quotes = quotesQ.data ?? [];
  const selected = selectedId ? detailQ.data ?? quotes.find((q) => q.id === selectedId) ?? null : null;

  const allProducts = useMemo(
    () => (companiesQ.data ?? []).flatMap((c: any) => (c.products ?? []).map((p: any) => ({ ...p, companyName: c.name }))),
    [companiesQ.data],
  );

  const newQuoteDrawer = (
    <NewQuoteWizard
      open={newOpen}
      onClose={() => setNewOpen(false)}
      clients={(clientsQ.data ?? []) as any[]}
      companies={(companiesQ.data ?? []) as any[]}
      agents={(agentsQ.data ?? []) as any[]}
      creating={createQuote.isPending}
      onCreate={(input) => createQuote.mutate(input)}
      renewalOf={renewalOf}
    />
  );

  // ---------------------------------------------------------- landing state

  if (!selected) {
    return (
      <div className="ds-stack">
        <Toolbar>
          <SectionTitle sub={`${quotes.length} comparison${quotes.length === 1 ? '' : 's'}`}>Quotes</SectionTitle>
          <span style={{ flex: 1 }} />
          <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> New quote</button>
        </Toolbar>

        {quotesQ.isLoading ? (
          <Skeleton rows={3} height={120} />
        ) : quotes.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title="No quotes yet"
              body="Build a comparison for a client and issue the winner in one click."
              actionLabel="New quote"
              onAction={() => setNewOpen(true)}
            />
          </Card>
        ) : (
          <div className="ds-grid ds-grid-cards">
            {quotes.map((q) => {
              const count = q.lines?.length ?? 0;
              return (
                <Card key={q.id} onClick={() => setSelectedId(q.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span className="ds-caption" style={{ fontFamily: 'var(--mono)' }}>{q.reference}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <Badge tone={toneForQuoteStatus(q.status)}>{humanStatus(q.status)}</Badge>
                    </span>
                  </div>
                  <div className="ds-h2" style={{ marginBottom: 8 }}>{q.client?.name ?? 'Unassigned client'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge tone="info" dot={false}>{humanStatus(q.category)}</Badge>
                    <span className="ds-caption">
                      {count === 0 ? 'No options yet' : `${count} option${count === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <div className="ds-caption" style={{ marginTop: 14 }}>Opened {fmtDate(q.createdAt)}</div>
                </Card>
              );
            })}
          </div>
        )}

        {newQuoteDrawer}
      </div>
    );
  }

  // ------------------------------------------------------- comparison state

  const lines = selected.lines ?? [];
  const converted = selected.status === 'CONVERTED';

  const bestRatio = lines.reduce((m, l) => Math.max(m, l.sumInsuredInr / Math.max(1, l.premiumInr)), 0);
  const minPremium = lines.length ? Math.min(...lines.map((l) => l.premiumInr)) : 0;
  const maxCover = lines.length ? Math.max(...lines.map((l) => l.sumInsuredInr)) : 0;
  const uniqueLowestPremium = lines.filter((l) => l.premiumInr === minPremium).length === 1;
  const uniqueHighestCover = lines.filter((l) => l.sumInsuredInr === maxCover).length === 1;

  /** At most one, and only when the data actually supports it. */
  const secondaryBadge = (l: QuoteLine): string | null => {
    if (lines.length < 2) return null;
    if (uniqueLowestPremium && l.premiumInr === minPremium) return 'Lowest premium';
    if (uniqueHighestCover && l.sumInsuredInr === maxCover) return 'Highest cover';
    return null;
  };

  // The recommended line leads the grid; the rest keep the API's premium order.
  const ordered = [...lines].sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended));

  const categoryProducts = allProducts.filter((p: any) => p.category === selected.category);

  /**
   * The cover the client asked for was recorded on the quote, so asking again
   * on every option is a question the screen can answer itself. It stays
   * editable: an insurer often comes back with a different sum insured than the
   * one requested, and that difference is the point of the comparison.
   */
  const openLine = () => {
    const requested = selected.requirement?.sumInsuredInr;
    setLf({ ...emptyLine, sumInsuredInr: requested ? String(requested) : '' });
    setLineOpen(true);
  };
  // The product being quoted, so the brokerage field can show what it is
  // overriding rather than asking the broker to remember the master rate.
  const lineProduct = categoryProducts.find((p: any) => p.id === lf.productId);

  return (
    <div className="ds-stack">
      <Toolbar>
        <button className="btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={14} /> All quotes
        </button>
      </Toolbar>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="ds-h1">{selected.client?.name ?? 'Unassigned client'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span className="ds-caption" style={{ fontFamily: 'var(--mono)' }}>{selected.reference}</span>
            <Badge tone="info" dot={false}>{humanStatus(selected.category)}</Badge>
            <Badge tone={toneForQuoteStatus(selected.status)}>{humanStatus(selected.status)}</Badge>
            <span className="ds-caption">Opened {fmtDate(selected.createdAt)}</span>
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {/* Sendable even after conversion: the customer often asks for the
            comparison again once the policy is placed, and the document says
            plainly that it is a quotation, not cover. */}
        <button
          className="btn-secondary"
          onClick={async () => {
            const ok = await openQuote(selected as any, { orgName: 'Insurance broking' });
            if (!ok) toast.error('Allow pop-ups to open the quotation');
          }}
        >
          <Download size={14} /> Download quotation
        </button>
        {!converted && (
          <button className="btn-primary" onClick={openLine}><Plus size={14} /> Add option</button>
        )}
      </div>

      {/* Health cover needs the customer's own account of their health BEFORE
          it is placed, so the declaration is raised here, on the quote — not
          after issue, when it would describe cover already written. */}
      <QuoteDeclarationPanel
        quoteId={selected.id}
        clientId={(selected as any).clientId ?? (selected.client as any)?.id}
        category={selected.category}
        converted={converted}
      />

      {detailQ.isLoading && !lines.length ? (
        <Skeleton rows={2} height={220} />
      ) : lines.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No options to compare yet"
            body="Add the insurer quotes you have collected and this becomes a side-by-side the client can choose from."
            actionLabel={converted ? undefined : 'Add option'}
            onAction={converted ? undefined : openLine}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
          {ordered.map((l) => {
            const stars = starsFor(l, bestRatio);
            const second = secondaryBadge(l);
            return (
              <Card
                key={l.id}
                tone={l.recommended ? 'active' : undefined}
                style={{ position: 'relative', paddingTop: l.recommended ? 30 : undefined }}
              >
                {l.recommended && (
                  <span
                    className="ds-badge ds-tone-active"
                    style={{
                      position: 'absolute',
                      top: -11,
                      left: 'var(--pad-card)',
                      background: 'var(--tone-active)',
                      color: '#fff',
                      borderColor: 'transparent',
                      boxShadow: 'var(--e-hover)',
                    }}
                  >
                    Recommended
                  </span>
                )}

                <div style={{ marginBottom: 14 }}>
                  <div className="ds-h2">{l.companyName}</div>
                  <div className="ds-caption" style={{ marginTop: 3 }}>{l.productName}</div>
                </div>

                <div className="ds-display">{fmtOrgMoney(l.premiumInr)}</div>
                <div className="ds-caption" style={{ marginTop: 4 }}>Annual premium</div>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline-soft)' }}>
                  <div className="ds-caption-upper" style={{ marginBottom: 4 }}>Sum insured</div>
                  <div className="ds-h2 ds-num">{fmtOrgMoney(l.sumInsuredInr)}</div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <StarRating value={stars} />
                  <div className="ds-caption" style={{ marginTop: 5 }}>rated on cover per premium</div>
                </div>

                {second && (
                  <div style={{ marginTop: 14 }}>
                    <Badge tone="sales" dot={false}>{second}</Badge>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
                  <ChipRow label="Coverage" values={chipsFrom(l.coverage)} tone="info" />
                  <ChipRow label="Add-ons" values={chipsFrom(l.addOns)} tone="sales" />
                  <ChipRow label="Exclusions" values={chipsFrom(l.exclusions)} tone="expired" />
                </div>

                {!converted && issuingLine !== l.id && editingLine !== l.id && (
                  <>
                    <button
                      className="btn-primary"
                      style={{ width: '100%', marginTop: 20 }}
                      onClick={() => { setIssuingLine(l.id); setExecId(''); }}
                    >
                      Issue policy
                    </button>
                    {/* A premium keyed wrong used to mean abandoning the quote. */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className="btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setEditingLine(l.id);
                          setEf({
                            premiumInr: String(l.premiumInr), sumInsuredInr: String(l.sumInsuredInr),
                            coverage: l.coverage ?? '', addOns: l.addOns ?? '', exclusions: l.exclusions ?? '',
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        style={{ flex: 1, color: 'var(--tone-expired)' }}
                        disabled={dropLine.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ${l.companyName} from this comparison?`)) dropLine.mutate(l.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
                {!converted && editingLine === l.id && (
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label className="label" style={{ margin: 0 }}>Premium</label>
                      <input className="input" inputMode="numeric" value={ef.premiumInr}
                             onChange={(e) => setEf({ ...ef, premiumInr: e.target.value.replace(/\D/g, '') })} autoFocus />
                    </div>
                    <div>
                      <label className="label" style={{ margin: 0 }}>Sum insured</label>
                      <input className="input" inputMode="numeric" value={ef.sumInsuredInr}
                             onChange={(e) => setEf({ ...ef, sumInsuredInr: e.target.value.replace(/\D/g, '') })} />
                    </div>
                    <div>
                      <label className="label" style={{ margin: 0 }}>Coverage</label>
                      <input className="input" value={ef.coverage} onChange={(e) => setEf({ ...ef, coverage: e.target.value })} placeholder="Comma-separated" />
                    </div>
                    <div>
                      <label className="label" style={{ margin: 0 }}>Add-ons</label>
                      <input className="input" value={ef.addOns} onChange={(e) => setEf({ ...ef, addOns: e.target.value })} placeholder="Comma-separated" />
                    </div>
                    <div>
                      <label className="label" style={{ margin: 0 }}>Exclusions</label>
                      <input className="input" value={ef.exclusions} onChange={(e) => setEf({ ...ef, exclusions: e.target.value })} placeholder="Comma-separated" />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-primary" style={{ flex: 1 }} disabled={editLine.isPending}
                              onClick={() => editLine.mutate(l.id)}>
                        {editLine.isPending ? 'Saving…' : 'Save option'}
                      </button>
                      <button className="btn-secondary" onClick={() => setEditingLine(null)}>Cancel</button>
                    </div>
                  </div>
                )}
                {!converted && issuingLine === l.id && (
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label className="label" style={{ margin: 0 }}>Insurer&rsquo;s policy number</label>
                    <input
                      className="input" value={issuePolicyNo} autoFocus
                      onChange={(e) => setIssuePolicyNo(e.target.value)}
                      placeholder="As printed on the insurer's schedule"
                    />
                    <div className="ds-caption" style={{ marginTop: -4 }}>
                      Leave blank and we number it ourselves — but then nothing here matches the insurer&rsquo;s records.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label className="label" style={{ margin: 0 }}>Cover starts</label>
                        <input className="input" type="date" value={issueStart} onChange={(e) => setIssueStart(e.target.value)} />
                      </div>
                      <div style={{ width: 110 }}>
                        <label className="label" style={{ margin: 0 }}>Months</label>
                        <input className="input" inputMode="numeric" value={issueTerm} onChange={(e) => setIssueTerm(e.target.value.replace(/\D/g, ''))} />
                      </div>
                    </div>
                    <label className="label" style={{ margin: 0 }}>Executive who sourced this</label>
                    <select className="input" value={execId} onChange={(e) => setExecId(e.target.value)}>
                      <option value="">Select an executive…</option>
                      {(executivesQ.data ?? [])
                        .filter((x: any) => x.status === 'ACTIVE')
                        .map((x: any) => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                    </select>
                    {!(executivesQ.data ?? []).length && (
                      <div className="ds-caption">
                        No executives yet — add them under Settings → Executives.
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        disabled={!execId || issue.isPending}
                        onClick={() => issue.mutate(l.id)}
                      >
                        {issue.isPending ? 'Issuing…' : 'Confirm & issue'}
                      </button>
                      <button className="btn-secondary" onClick={() => setIssuingLine(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={lineOpen}
        onClose={() => setLineOpen(false)}
        title="Add option"
        subtitle={`Another insurer's quote for ${selected.reference}`}
      >
        <FormSection title="Insurer quote" description="Enter the premium the insurer actually quoted.">
          <Field label="Product" required span={2}>
            <select className="input" value={lf.productId} onChange={(e) => setLf({ ...lf, productId: e.target.value })}>
              <option value="">Select an insurer product…</option>
              {categoryProducts.map((p: any) => (
                <option key={p.id} value={p.id}>{p.companyName} — {p.name}</option>
              ))}
            </select>
          </Field>
          <Field label={`Premium (${cur()})`} required>
            <input
              className="input"
              inputMode="numeric"
              value={lf.premiumInr}
              onChange={(e) => setLf({ ...lf, premiumInr: digits(e.target.value) })}
              placeholder="12000"
            />
          </Field>
          <Field label={`Sum insured (${cur()})`} required>
            <input
              className="input"
              inputMode="numeric"
              value={lf.sumInsuredInr}
              onChange={(e) => setLf({ ...lf, sumInsuredInr: digits(e.target.value) })}
              placeholder="500000"
            />
          </Field>
          {/* The override exists so that honouring a negotiated rate never means
              editing the product master — which would re-price every other
              policy written against it. Blank keeps this line on the master. */}
          <Field
            label="Brokerage rate (%)"
            hint={
              lineProduct
                ? `Leave blank to use ${lineProduct.name}'s ${lineProduct.commissionRatePct}%. A value here applies to this policy only.`
                : 'Leave blank to use the product’s own rate.'
            }
            span={2}
          >
            <input
              className="input"
              inputMode="decimal"
              value={lf.brokerageRatePct}
              onChange={(e) => setLf({ ...lf, brokerageRatePct: e.target.value.replace(/[^\d.]/g, '') })}
              placeholder={lineProduct ? String(lineProduct.commissionRatePct) : '15'}
            />
          </Field>
        </FormSection>

        <FormSection title="What it covers" description="Comma-separated — each item becomes a chip on the comparison card.">
          <Field label="Coverage" span={2}>
            <input
              className="input"
              value={lf.coverage}
              onChange={(e) => setLf({ ...lf, coverage: e.target.value })}
              placeholder="Own damage, Third party, Personal accident"
            />
          </Field>
          <Field label="Add-ons" span={2}>
            <input
              className="input"
              value={lf.addOns}
              onChange={(e) => setLf({ ...lf, addOns: e.target.value })}
              placeholder="Zero depreciation, Roadside assistance"
            />
          </Field>
          <Field label="Exclusions" span={2}>
            <input
              className="input"
              value={lf.exclusions}
              onChange={(e) => setLf({ ...lf, exclusions: e.target.value })}
              placeholder="Wear and tear, Consequential damage"
            />
          </Field>
        </FormSection>

        {/* A dead button that will not say why is the same defect as a refusal
            that will not explain itself — name the field that is missing. */}
        {(() => {
          const missing = [
            !lf.productId && 'an insurer product',
            !lf.premiumInr && 'the premium',
            !lf.sumInsuredInr && 'the sum insured',
          ].filter(Boolean) as string[];
          return (
            <>
              {missing.length > 0 && (
                <p className="ds-caption" style={{ marginBottom: 8 }}>
                  Still needs {missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`}.
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-primary"
                  disabled={missing.length > 0 || addLine.isPending}
                  onClick={() => addLine.mutate()}
                >
                  {addLine.isPending ? 'Adding…' : 'Add to comparison'}
                </button>
                <button className="btn-secondary" onClick={() => setLineOpen(false)}>Cancel</button>
              </div>
            </>
          );
        })()}
      </Drawer>

      {newQuoteDrawer}
    </div>
  );
}
