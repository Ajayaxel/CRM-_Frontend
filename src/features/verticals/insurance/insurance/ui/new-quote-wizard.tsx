'use client';

/**
 * Opening a quote, as the four decisions it actually is.
 *
 * The old form was a drawer with three fields: a client dropdown, a category
 * dropdown, and a sum-insured box. It asked for a premium nowhere, so the
 * broker opened an empty quote and then typed a premium per insurer from
 * memory, one drawer at a time. Two things were wrong with that. A premium
 * typed from memory is a premium that can be wrong, and a comparison built one
 * row at a time is not a comparison — you cannot see the plans beside each
 * other until after you have committed to all of them.
 *
 * So: pick the client, pick the category, pick the PLANS, then look at them
 * side by side and adjust before anything is written. The premium arrives with
 * the plan.
 *
 * Centred rather than a drawer because step 4 is a table. Three plans across a
 * 560px drawer stack into a column where nothing lines up with anything, which
 * is the one thing a comparison must not do.
 *
 * NOTHING IS WRITTEN UNTIL THE LAST STEP. Steps 1–3 are selection held in
 * local state; "Create quote" is what posts the quote and its lines. Backing
 * out of step 3 leaves no half-built quote behind — which the old flow could
 * not say, because it opened the quote first and added lines afterwards.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Bike, Briefcase, Car, Check, Flame, HeartPulse, Home, Landmark, Plane,
  Search, Ship, ShieldCheck, Truck, User2,
} from 'lucide-react';
import { fmtOrgMoney } from '@/lib/org-locale';
import { Card, EmptyState, Modal, Stepper, humanStatus } from './kit';
import { computeSplit } from './commission-split';

const money = (n?: number | null) => fmtOrgMoney(n ?? 0);
const digits = (s: string) => s.replace(/[^\d]/g, '');

export interface WizardClient { id: string; name: string; phone?: string | null; email?: string | null }
export interface WizardProduct {
  id: string;
  name: string;
  category: string;
  commissionRatePct: number;
  execRatePct: number;
  indicativePremiumInr?: number | null;
  indicativeSumInsuredInr?: number | null;
}
export interface WizardCompany { id: string; name: string; products: WizardProduct[] }
export interface WizardAgent {
  id: string;
  code: string;
  name: string;
  agency?: string | null;
  phone?: string | null;
  status: string;
  /** Share of the BROKERAGE, the basis this screen works in. */
  defaultSharePctOfBrokerage?: number | null;
  /** The legacy share of the PREMIUM, still what most agents carry. */
  defaultCommissionPct?: number | null;
}

/** A product with its insurer's name attached, which is what the broker reads. */
interface Plan extends WizardProduct { companyId: string; companyName: string }

/**
 * The four lines of business a broker actually thinks in, and the categories
 * each one is written as.
 *
 * MOTOR IS A GROUP, NOT A CATEGORY. The generic MOTOR bucket was retired for
 * new business precisely because a policy written as "motor" says nothing about
 * the vehicle — 20 policies on the live book sit in "Motor — unclassified"
 * because it used to be selectable. So Motor is a card that opens the three
 * real classes, and what gets STORED is always one of those. The picker is
 * simple; the record is specific.
 *
 * Health and Travel are single categories, so their card goes straight through
 * to the plans — a sub-step offering one choice is a click that asks nothing.
 *
 * Every writable category must appear in exactly one group. A category missing
 * here is a product nobody can quote, which is not hypothetical: four products
 * were unreachable for exactly this reason until their categories were fixed.
 * scripts/motor-category-offline.ts holds the two lists together.
 */
const GROUPS = [
  {
    key: 'MOTOR', label: 'Motor', blurb: 'Car, bike and commercial vehicle', icon: Car,
    categories: ['PRIVATE_CAR', 'TWO_WHEELER', 'COMMERCIAL_VEHICLE'],
  },
  { key: 'HEALTH', label: 'Health', blurb: 'Health cover', icon: HeartPulse, categories: ['HEALTH'] },
  { key: 'TRAVEL', label: 'Travel', blurb: 'Trip and overseas cover', icon: Plane, categories: ['TRAVEL'] },
  {
    key: 'NON_MOTOR', label: 'Non-motor', blurb: 'Life, property, fire, marine, accident, business',
    icon: ShieldCheck,
    categories: ['LIFE', 'PROPERTY', 'FIRE', 'MARINE', 'ACCIDENT', 'BUSINESS', 'CUSTOM'],
  },
] as const;

/** Flattened, and the single source the API's writable list is checked against. */
const CATEGORIES = GROUPS.flatMap((g) => g.categories) as readonly string[];

const ICONS: Record<string, any> = {
  PRIVATE_CAR: Car, TWO_WHEELER: Bike, COMMERCIAL_VEHICLE: Truck, HEALTH: HeartPulse,
  TRAVEL: Plane, FIRE: Flame, MARINE: Ship, PROPERTY: Home, LIFE: ShieldCheck,
  ACCIDENT: ShieldCheck, BUSINESS: Briefcase, CUSTOM: Landmark,
};

const BLURB: Record<string, string> = {
  PRIVATE_CAR: 'Private car', TWO_WHEELER: 'Bike and scooter',
  COMMERCIAL_VEHICLE: 'Goods and passenger vehicles', HEALTH: 'Health cover',
  TRAVEL: 'Trip and overseas cover', FIRE: 'Fire and allied perils',
  MARINE: 'Cargo and transit', PROPERTY: 'Property and home',
  LIFE: 'Life cover', ACCIDENT: 'Personal accident', BUSINESS: 'Commercial lines',
  CUSTOM: 'Anything that fits no standard line',
};

/** What the broker is building, before any of it is written. */
/**
 * What the broker is building, before any of it is written.
 *
 * The two commission slices are held as AMOUNTS, not percentages, because that
 * is how they are actually agreed — "give him five hundred on this one", not
 * "give him 21.65%". The percentages on screen are derived from the amounts, so
 * the rounding can only ever go one way and the rupees are what gets stored.
 *
 * Company profit is NOT here. It is gross minus the two, so holding it would be
 * a third copy of a number the other two already determine.
 */
interface Draft {
  premiumInr: string;
  sumInsuredInr: string;
  brokerageRatePct: string;
  agentInr: string;
  execInr: string;
  /**
   * Whatever was last typed into a PERCENTAGE box, verbatim.
   *
   * The amount stays the source of truth — it is what gets stored — but a
   * percentage box whose value is re-derived on every keystroke fights the
   * person typing it: enter "2" of an intended "21.6" and the field snaps to
   * whatever 2% rounds back to. So the raw text is held while they type and the
   * amount is recomputed from it; the box falls back to the derived figure the
   * moment they touch the rupees instead, and both are cleared when the premium
   * or the rate moves, because a percentage of a different gross is a different
   * number.
   */
  agentPctText: string;
  execPctText: string;
  companyPctText: string;
}

/** The policy a renewal quote starts from — enough to pre-fill every step. */
export interface WizardRenewalOf {
  policyId: string;
  policyNo: string;
  clientId: string;
  category: string;
  productId: string;
  premiumInr: number;
  sumInsuredInr: number;
  agentId?: string | null;
}

export function NewQuoteWizard({
  open, onClose, clients, companies, agents, onCreate, creating, renewalOf,
}: {
  open: boolean;
  onClose: () => void;
  clients: WizardClient[];
  companies: WizardCompany[];
  agents: WizardAgent[];
  /** Posts the quote and its lines. The wizard never calls the API itself. */
  onCreate: (input: {
    clientId: string;
    category: string;
    type?: 'RENEWAL';
    sourcePolicyId?: string;
    lines: {
      productId: string; premiumInr: number; sumInsuredInr: number;
      agentId: string | null;
      agentCommissionInr: number;
      execCommissionInr: number;
      brokerageRatePct: number | null;
    }[];
  }) => void;
  creating?: boolean;
  /**
   * Renewal mode: client, category and last year's plan arrive pre-filled and
   * the wizard opens on the Plans step, so the broker starts from "same again"
   * and edits from there — different insurer, premium, agent, all fair game.
   * The MONEY seeds from the CURRENT masters, not last year's snapshot; only
   * premium and cover carry, because they are what the customer had.
   */
  renewalOf?: WizardRenewalOf | null;
}) {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState('');
  const [group, setGroup] = useState('');
  const [agentId, setAgentId] = useState('');
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState('');

  const reset = () => {
    setStep(0); setClientId(''); setGroup(''); setCategory(''); setAgentId(''); setPicked([]); setDrafts({}); setSearch('');
  };
  const close = () => { reset(); onClose(); };

  const plans: Plan[] = useMemo(
    () => companies.flatMap((c) => (c.products ?? []).map((p) => ({ ...p, companyId: c.id, companyName: c.name }))),
    [companies],
  );
  const byCategory = useMemo(() => {
    const m = new Map<string, Plan[]>();
    for (const p of plans) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return m;
  }, [plans]);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const inCategory = byCategory.get(category) ?? [];
  const chosen = inCategory.filter((p) => picked.includes(p.id));

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q));
  }, [clients, search]);

  /** Selecting a plan seeds its draft from the product's indicative figures. */
  const toggle = (p: Plan) => {
    setPicked((cur) => cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]);
    setDrafts((cur) => cur[p.id] ? cur : {
      ...cur,
      [p.id]: {
        premiumInr: p.indicativePremiumInr ? String(p.indicativePremiumInr) : '',
        sumInsuredInr: p.indicativeSumInsuredInr ? String(p.indicativeSumInsuredInr) : '',
        // The plan's own rate, editable here because a negotiated rate on one
        // placement should not mean re-rating the product for everybody else.
        brokerageRatePct: String(p.commissionRatePct),
        // Seeded from the standing arrangements so the common case needs no
        // typing: the introducer's share of brokerage, and the executive's rate
        // from the product master.
        agentInr: String(agentDefaultInr(agent, p, p.indicativePremiumInr ?? 0)),
        execInr: String(Math.round((grossOf(p, p.indicativePremiumInr ?? 0) * p.execRatePct) / 100)),
        agentPctText: '', execPctText: '', companyPctText: '',
      },
    });
  };

  const draftOf = (id: string): Draft =>
    drafts[id] ?? {
      premiumInr: '', sumInsuredInr: '', brokerageRatePct: '', agentInr: '', execInr: '',
      agentPctText: '', execPctText: '', companyPctText: '',
    };
  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((cur) => ({ ...cur, [id]: { ...draftOf(id), ...patch } }));

  /** Moving the premium or the rate changes the gross, so every percentage
   *  being shown is now a percentage of something else. */
  const setBase = (id: string, patch: Partial<Draft>) =>
    setDraft(id, { ...patch, agentPctText: '', execPctText: '', companyPctText: '' });

  /** A percentage typed against the CURRENT gross, turned into rupees. */
  const pctToInr = (gross: number, raw: string) => Math.round((gross * (Number(raw) || 0)) / 100);

  /** Only ACTIVE agents. The API refuses the rest, so offering them would be a
   *  dropdown that fails on submit. */
  const sellableAgents = useMemo(() => agents.filter((a) => a.status === 'ACTIVE'), [agents]);
  const agent = sellableAgents.find((a) => a.id === agentId) ?? null;

  /**
   * What this introducer would earn on a plan, in rupees.
   *
   * Agents carry their standing deal on one of two bases, and this screen deals
   * in rupees, so either one resolves to a figure: a share of the brokerage
   * where they have one, otherwise the legacy share of the premium. A
   * premium-based share CAN come out larger than the whole brokerage — that is
   * the mismatch that had issue refusing policies — and it is left visible
   * rather than clamped, because the allocation row then says so plainly.
   */
  const agentDefaultInr = (a: WizardAgent | null, p: Plan, premium: number) => {
    if (!a) return 0;
    if (a.defaultSharePctOfBrokerage != null) {
      return Math.round((grossOf(p, premium) * a.defaultSharePctOfBrokerage) / 100);
    }
    return Math.round((premium * (a.defaultCommissionPct ?? 0)) / 100);
  };

  /** Premium x the rate on screen. The one figure nobody types directly. */
  const grossOf = (p: Plan, premium: number) =>
    Math.round((premium * (draftOf(p.id).brokerageRatePct === ''
      ? p.commissionRatePct
      : Number(draftOf(p.id).brokerageRatePct))) / 100);

  /**
   * The allocation, derived DOWNWARDS from the amounts on screen.
   *
   *   gross = agent + executive + company profit
   *
   * Company profit is the remainder, so it is never an input in the data even
   * though the broker can type into it — typing there moves the AGENT's figure,
   * because the executive's cut is a staffing rate and the introducer's is the
   * negotiated one. That keeps the identity true at every keystroke.
   */
  const splitOf = (p: Plan) => {
    const d = draftOf(p.id);
    const sp = computeSplit({
      premiumInr: Number(d.premiumInr) || 0,
      brokerageRatePct: d.brokerageRatePct === '' ? p.commissionRatePct : Number(d.brokerageRatePct),
      agentInr: Math.round(Number(d.agentInr) || 0),
      execInr: Math.round(Number(d.execInr) || 0),
    });
    return { ...sp, negative: sp.agentInr < 0 || sp.execInr < 0 };
  };

  // The API refuses a premium above the sum insured and a sum insured under
  // 1,000, so the same rules are enforced here — a broker should learn a figure
  // is wrong while looking at it, not from a toast after pressing Create.

  const lineIssue = (p: Plan): string | null => {
    const d = draftOf(p.id);
    const premium = Number(d.premiumInr);
    const sum = Number(d.sumInsuredInr);
    if (!premium) return 'Premium required';
    if (!sum) return 'Cover required';
    if (sum < 1000) return 'Cover too small to be real';
    if (premium > sum) return 'Premium exceeds the cover';
    // The agent and the executive come out of the same brokerage, so the guard
    // is on the pair — issue refuses this too, and it is far cheaper to learn
    // it while looking at the figures than from a toast afterwards.
    const sp = splitOf(p);
    if (sp.negative) return 'A commission cannot be negative';
    if (sp.overAllocated) return 'Allocation exceeds the gross brokerage';
    return null;
  };
  const blocking = chosen.map((p) => [p, lineIssue(p)] as const).filter(([, i]) => i);

  const canContinue = [!!clientId, !!category, chosen.length > 0, blocking.length === 0][step];

  const submit = () => {
    if (blocking.length) return;
    onCreate({
      clientId,
      category,
      // What makes this quote a renewal path: the server links it to the old
      // policy, guards the one-path rule, and stages the Renewal Centre.
      ...(renewalOf ? { type: 'RENEWAL' as const, sourcePolicyId: renewalOf.policyId } : {}),
      lines: chosen.map((p) => ({
        productId: p.id,
        premiumInr: Number(draftOf(p.id).premiumInr),
        sumInsuredInr: Number(draftOf(p.id).sumInsuredInr),
        // One introducer for the whole quote — a client is brought in by a
        // person, not by a plan — so every line carries the same agent.
        agentId: agentId || null,
        // The rupees the broker actually agreed, which is what gets written.
        agentCommissionInr: splitOf(p).agentInr,
        execCommissionInr: splitOf(p).execInr,
        // Only sent when it actually differs — an override equal to the
        // product's rate is not an override, and storing one would pin this
        // line against a later revision of the master.
        brokerageRatePct: draftOf(p.id).brokerageRatePct === ''
          || Number(draftOf(p.id).brokerageRatePct) === p.commissionRatePct
          ? null
          : Number(draftOf(p.id).brokerageRatePct),
      })),
    });
  };

  // ---- Renewal mode: pre-fill once per opening. Client and category are the
  // old policy's; last year's plan is pre-picked with last year's premium and
  // cover; every rate seeds from the CURRENT masters exactly as a hand-picked
  // plan would. The broker lands on Plans, free to add competitors or move on.
  useEffect(() => {
    if (!open || !renewalOf) return;
    setClientId(renewalOf.clientId);
    const g = GROUPS.find((x) => (x.categories as readonly string[]).includes(renewalOf.category));
    // A category the wizard cannot write — the retired MOTOR bucket — is not
    // pre-set: the broker lands on Category and reclassifies the vehicle into
    // the specific class the book now writes, which the server accepts as the
    // same renewal.
    if (!g) { setStep(1); return; }
    setCategory(renewalOf.category);
    setGroup(g.key);
    const oldAgent = renewalOf.agentId
      ? agents.find((a) => a.id === renewalOf.agentId && a.status === 'ACTIVE')
      : null;
    if (oldAgent) setAgentId(oldAgent.id);
    const plan = plans.find((p) => p.id === renewalOf.productId && p.category === renewalOf.category);
    if (plan) {
      setPicked([plan.id]);
      setDrafts({
        [plan.id]: {
          premiumInr: String(renewalOf.premiumInr),
          sumInsuredInr: String(renewalOf.sumInsuredInr),
          brokerageRatePct: String(plan.commissionRatePct),
          agentInr: String(oldAgent ? agentDefaultInr(oldAgent, plan, renewalOf.premiumInr) : 0),
          execInr: String(Math.round(((renewalOf.premiumInr * plan.commissionRatePct) / 100) * (plan.execRatePct / 100))),
          agentPctText: '', execPctText: '', companyPctText: '',
        },
      });
    }
    setStep(2);
    // Re-runs only when the wizard opens for a (different) renewal — plans and
    // agents arriving later must not wipe what the broker has since edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renewalOf?.policyId]);

  const STEPS = ['Client', 'Category', 'Plans', 'Compare'];

  // Naming the group as well as the class, but only where the group actually
  // asked a question — "Health · Health" reads like a stutter.
  const groupOf = (c: string) => GROUPS.find((g) => (g.categories as readonly string[]).includes(c));
  const subtitle = [
    client?.name,
    category
      ? (groupOf(category)?.categories.length === 1
          ? humanStatus(category)
          : `${groupOf(category)?.label} \u00b7 ${humanStatus(category)}`)
      : null,
    chosen.length ? `${chosen.length} plan${chosen.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ') || 'Pick a client, a category, then the plans to compare.';

  return (
    <Modal
      open={open}
      onClose={close}
      title={renewalOf ? `Renewal quote — ${renewalOf.policyNo}` : 'New quote'}
      subtitle={renewalOf ? `Renewing ${renewalOf.policyNo} · ${subtitle}` : subtitle}
      width={1040}
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={
              step === 0 ? close
                : step === 1 && group ? () => { setGroup(''); setCategory(''); }
                : () => setStep(step - 1)
            }
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <span style={{ flex: 1 }} />
          {blocking.length > 0 && step === 3 && (
            <span className="ds-caption" style={{ color: 'var(--tone-expired)' }}>
              {blocking.length} plan{blocking.length === 1 ? '' : 's'} need a figure
            </span>
          )}
          {step < 3 ? (
            <button className="btn-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>
              {step === 2 ? 'Continue to compare' : 'Continue'}
            </button>
          ) : (
            <button className="btn-primary" disabled={!canContinue || creating} onClick={submit}>
              {creating ? 'Creating…' : `Create quote${chosen.length ? ` · ${chosen.length}` : ''}`}
            </button>
          )}
        </>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <Stepper steps={STEPS} current={step} />
      </div>

      {/* ---------------------------------------------------- 1. client */}
      {step === 0 && (
        <>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 32 }}
              placeholder="Search clients by name, phone or email…"
              aria-label="Search clients"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filteredClients.length === 0 ? (
            <Card><EmptyState compact icon={User2} title="No client matches that"
              body="Clear the search, or add the client first from the Clients screen." /></Card>
          ) : (
            <div className="ds-grid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setClientId(c.id); setStep(1); }}
                  aria-pressed={clientId === c.id}
                  style={{
                    textAlign: 'left', padding: '12px 14px', cursor: 'pointer',
                    border: `1px solid ${clientId === c.id ? 'var(--accent)' : 'var(--hairline)'}`,
                    borderRadius: 10, background: clientId === c.id ? 'var(--surface-2)' : 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <User2 size={15} aria-hidden="true" style={{ color: 'var(--ink-3)', flex: 'none' }} />
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    {clientId === c.id && <Check size={14} aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                  </div>
                  <div className="ds-caption" style={{ marginTop: 4 }}>{c.phone || c.email || 'No contact on file'}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* -------------------------------------------------- 2. category */}
      {/* Hiding the empty lines means an empty MASTER shows nothing at all,
          which reads as a broken screen rather than as work to do. */}
      {step === 1 && !group && plans.length === 0 && (
        <Card>
          <EmptyState compact icon={ShieldCheck} title="No plans on the master yet"
            body="Add an insurer and at least one product under Products, and the lines of business will appear here." />
        </Card>
      )}
      {step === 1 && !group && plans.length > 0 && (
        <div className="ds-grid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {GROUPS.map((g) => ({ g, count: g.categories.reduce((n, c) => n + (byCategory.get(c)?.length ?? 0), 0) }))
            // A line of business with nothing behind it is not a choice. Greying
            // it out still made the broker read eight dead cards to find four
            // live ones; the master is where a line gets added, not here.
            .filter(({ count }) => count > 0)
            .map(({ g, count }) => {
            const Icon = g.icon;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => {
                  // A group with one category asks nothing, so it goes straight
                  // to the plans rather than showing a list of one.
                  if (g.categories.length === 1) { setCategory(g.categories[0]); setPicked([]); setStep(2); }
                  else setGroup(g.key);
                }}
                style={{
                  textAlign: 'left', padding: 14, cursor: 'pointer',
                  border: '1px solid var(--hairline)', borderRadius: 10, background: 'var(--surface)',
                }}
              >
                <Icon size={19} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                <div style={{ fontWeight: 600, marginTop: 8 }}>{g.label}</div>
                <div className="ds-caption" style={{ marginTop: 2 }}>{g.blurb}</div>
                <div className="ds-caption ds-num" style={{ marginTop: 6 }}>
                  {count} plan{count === 1 ? '' : 's'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* The specific class WITHIN a group. What gets stored is always one of
          these — never the group — so no policy is written as "motor". */}
      {step === 1 && group && (
        <>
          <p className="ds-caption" style={{ marginBottom: 12 }}>
            {GROUPS.find((g) => g.key === group)?.label} — choose the class this is written as.
          </p>
          <div className="ds-grid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {(GROUPS.find((g) => g.key === group)?.categories ?? [])
              .map((c) => ({ c, count: byCategory.get(c)?.length ?? 0 }))
              .filter(({ count }) => count > 0)
              .map(({ c, count }) => {
              const Icon = ICONS[c] ?? ShieldCheck;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategory(c); setPicked([]); setStep(2); }}
                  aria-pressed={category === c}
                  style={{
                    textAlign: 'left', padding: 14, cursor: 'pointer',
                    border: `1px solid ${category === c ? 'var(--accent)' : 'var(--hairline)'}`,
                    borderRadius: 10, background: category === c ? 'var(--surface-2)' : 'var(--surface)',
                  }}
                >
                  <Icon size={18} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                  <div style={{ fontWeight: 600, marginTop: 8 }}>{humanStatus(c)}</div>
                  <div className="ds-caption" style={{ marginTop: 2 }}>{BLURB[c] ?? 'Insurance'}</div>
                  <div className="ds-caption ds-num" style={{ marginTop: 6 }}>
                    {count} plan{count === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ----------------------------------------------------- 3. plans */}
      {step === 2 && (
        <>
          <p className="ds-caption" style={{ marginBottom: 12 }}>
            Select the plans to compare. Premium and cover come from the product master and stay editable on the next step.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {inCategory.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  style={{
                    textAlign: 'left', padding: '12px 14px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 14, flexWrap: 'wrap',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                    borderRadius: 10, background: on ? 'var(--surface-2)' : 'var(--surface)',
                  }}
                >
                  <span style={{
                    flex: 'none', width: 18, height: 18, borderRadius: 4, display: 'grid', placeItems: 'center',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--line-soft)'}`,
                    background: on ? 'var(--accent)' : 'transparent',
                  }}>
                    {on && <Check size={12} aria-hidden="true" style={{ color: 'var(--on-accent, #fff)' }} />}
                  </span>
                  <span style={{ minWidth: 200, flex: 1 }}>
                    <span style={{ fontWeight: 600, display: 'block' }}>{p.name}</span>
                    <span className="ds-caption">{p.companyName}</span>
                  </span>
                  <span style={{ minWidth: 110 }}>
                    <span className="ds-caption" style={{ display: 'block' }}>Premium</span>
                    <span className="ds-num">{p.indicativePremiumInr ? money(p.indicativePremiumInr) : '—'}</span>
                  </span>
                  <span style={{ minWidth: 110 }}>
                    <span className="ds-caption" style={{ display: 'block' }}>Cover</span>
                    <span className="ds-num">{p.indicativeSumInsuredInr ? money(p.indicativeSumInsuredInr) : '—'}</span>
                  </span>
                  <span style={{ minWidth: 90 }}>
                    <span className="ds-caption" style={{ display: 'block' }}>Brokerage</span>
                    <span className="ds-num">{p.commissionRatePct}%</span>
                  </span>
                </button>
              );
            })}
          </div>
          {inCategory.some((p) => !p.indicativePremiumInr) && (
            <p className="ds-caption" style={{ marginTop: 12 }}>
              A plan showing “—” has no indicative figure on the product master yet. It can still be compared — enter the
              premium on the next step, or set a default under Products.
            </p>
          )}
        </>
      )}

      {/* --------------------------------------------------- 4. compare */}
      {step === 3 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '12px 14px', marginBottom: 14,
            border: '1px solid var(--hairline)', borderRadius: 10, background: 'var(--surface-2)',
          }}>
            <label className="label" htmlFor="quote-agent" style={{ margin: 0 }}>Agent / introducer</label>
            <select
              id="quote-agent"
              className="input"
              style={{ width: 'auto', minWidth: 240 }}
              value={agentId}
              onChange={(e) => {
                const next = e.target.value;
                setAgentId(next);
                // A figure agreed for one introducer is not a figure agreed for
                // another, so changing the agent RE-SEEDS every plan from the
                // new one's standing deal rather than leaving the old amount
                // attached to a different person. Issue drops it for the same
                // reason, so the screen and the book agree.
                const a = sellableAgents.find((x) => x.id === next) ?? null;
                setDrafts((cur) => {
                  const out = { ...cur };
                  for (const p of chosen) {
                    const d = out[p.id];
                    if (!d) continue;
                    out[p.id] = {
                      ...d,
                      agentInr: String(agentDefaultInr(a, p, Number(d.premiumInr) || 0)),
                      agentPctText: '', companyPctText: '',
                    };
                  }
                  return out;
                });
              }}
            >
              <option value="">No agent — direct business</option>
              {sellableAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}{a.agency ? ` (${a.agency})` : ''}
                </option>
              ))}
            </select>
            {agent && (
              <span className="ds-caption">
                {agent.defaultSharePctOfBrokerage != null
                  ? `Standing share ${agent.defaultSharePctOfBrokerage}% of brokerage`
                  : agent.defaultCommissionPct != null
                    ? `Standing rate ${agent.defaultCommissionPct}% of premium`
                    : 'No standing rate on file'}
                {agent.phone ? ` · ${agent.phone}` : ''}
              </span>
            )}
            {!agentId && (
              <span className="ds-caption">Leave as direct business and the agent commission stays at nil.</span>
            )}
          </div>
          <p className="ds-caption" style={{ marginBottom: 12 }}>
            These are the figures the quote will be written at. Adjust them for this client — the product defaults are
            only a starting point, and brokerage follows the premium.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="ds-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 110 }} />
                  {chosen.map((p) => (
                    <th key={p.id} style={{ minWidth: 170 }}>
                      <div style={{ fontWeight: 650 }}>{p.name}</div>
                      <div className="ds-caption">{p.companyName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="ds-caption">Premium</td>
                  {chosen.map((p) => (
                    <td key={p.id}>
                      <input
                        className="input"
                        inputMode="numeric"
                        aria-label={`Premium for ${p.name}`}
                        value={draftOf(p.id).premiumInr}
                        onChange={(e) => setBase(p.id, { premiumInr: digits(e.target.value) })}
                        placeholder="0"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="ds-caption">Cover</td>
                  {chosen.map((p) => (
                    <td key={p.id}>
                      <input
                        className="input"
                        inputMode="numeric"
                        aria-label={`Sum insured for ${p.name}`}
                        value={draftOf(p.id).sumInsuredInr}
                        onChange={(e) => setBase(p.id, { sumInsuredInr: digits(e.target.value) })}
                        placeholder="0"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="ds-caption">Brokerage rate</td>
                  {chosen.map((p) => (
                    <td key={p.id}>
                      <input
                        className="input"
                        inputMode="decimal"
                        aria-label={`Brokerage rate for ${p.name}`}
                        style={{ width: 78, display: 'inline-block', marginRight: 8 }}
                        value={draftOf(p.id).brokerageRatePct}
                        onChange={(e) => setBase(p.id, { brokerageRatePct: e.target.value.replace(/[^\d.]/g, '') })}
                      />
                      <span className="ds-caption">%</span>
                      {Number(draftOf(p.id).brokerageRatePct) !== p.commissionRatePct && (
                        <div className="ds-caption" style={{ marginTop: 3 }}>plan rate {p.commissionRatePct}%</div>
                      )}
                    </td>
                  ))}
                </tr>
                {/* ---- Everything below descends from GROSS BROKERAGE.
                    The premium is the insurer's money passing through — it is a
                    measure of volume, not income — so the rows are laid out as
                    the money actually flows:

                      premium x rate = gross brokerage
                        - agent commission
                        - executive commission
                        = company profit

                    Company profit is the REMAINDER and is labelled as such. An
                    earlier draft said "Agency keeps 75%", which read as though
                    the office takes a 75% cut off the top rather than whatever
                    is left after two people are paid.

                    Internal only. The client-facing comparison shows none of
                    it, and the customer portal cannot return it at all. */}
                <tr>
                  <td className="ds-caption" style={{ paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
                    Gross brokerage
                  </td>
                  {chosen.map((p) => (
                    <td key={p.id} className="ds-num" style={{ paddingTop: 16, borderTop: '1px solid var(--hairline)', fontWeight: 650 }}>
                      {money(splitOf(p).grossInr)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="ds-caption">Agent commission</td>
                  {chosen.map((p) => {
                    const sp = splitOf(p);
                    const d = draftOf(p.id);
                    return (
                      <td key={p.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <input
                            className="input"
                            inputMode="numeric"
                            aria-label={`Agent commission for ${p.name}`}
                            style={{ width: 104 }}
                            value={d.agentInr}
                            onChange={(e) => setDraft(p.id, { agentInr: digits(e.target.value), agentPctText: '' })}
                            placeholder="0"
                          />
                          <span className="ds-caption">or</span>
                          <input
                            className="input"
                            inputMode="decimal"
                            aria-label={`Agent commission percent for ${p.name}`}
                            style={{ width: 72 }}
                            value={d.agentPctText !== '' ? d.agentPctText : String(sp.agentPct)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d.]/g, '');
                              setDraft(p.id, { agentPctText: raw, agentInr: String(pctToInr(sp.grossInr, raw)) });
                            }}
                          />
                          <span className="ds-caption">%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="ds-caption">Executive commission</td>
                  {chosen.map((p) => {
                    const sp = splitOf(p);
                    const d = draftOf(p.id);
                    return (
                      <td key={p.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <input
                            className="input"
                            inputMode="numeric"
                            aria-label={`Executive commission for ${p.name}`}
                            style={{ width: 104 }}
                            value={d.execInr}
                            onChange={(e) => setDraft(p.id, { execInr: digits(e.target.value), execPctText: '' })}
                            placeholder="0"
                          />
                          <span className="ds-caption">or</span>
                          <input
                            className="input"
                            inputMode="decimal"
                            aria-label={`Executive commission percent for ${p.name}`}
                            style={{ width: 72 }}
                            value={d.execPctText !== '' ? d.execPctText : String(sp.execPct)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d.]/g, '');
                              setDraft(p.id, { execPctText: raw, execInr: String(pctToInr(sp.grossInr, raw)) });
                            }}
                          />
                          <span className="ds-caption">%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  {/* Editable, but still the REMAINDER: typing here moves the
                      agent's figure, because the executive's cut is a staffing
                      rate and the introducer's is what gets negotiated. The
                      identity holds at every keystroke rather than after. */}
                  <td className="ds-caption" style={{ paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                    Company profit
                  </td>
                  {chosen.map((p) => {
                    const sp = splitOf(p);
                    const d = draftOf(p.id);
                    const absorb = (wanted: number, extra: Partial<Draft>) => {
                      const rest = sp.grossInr - (Number(d.execInr) || 0) - wanted;
                      setDraft(p.id, { ...extra, agentInr: String(Math.max(0, rest)) });
                    };
                    return (
                      <td key={p.id} style={{ paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <input
                            className="input"
                            inputMode="numeric"
                            aria-label={`Company profit for ${p.name}`}
                            style={{
                              width: 104, fontWeight: 650,
                              color: sp.overAllocated ? 'var(--tone-expired)' : undefined,
                            }}
                            value={String(sp.companyProfitInr)}
                            onChange={(e) => absorb(Number(digits(e.target.value)) || 0, { companyPctText: '' })}
                          />
                          <span className="ds-caption">or</span>
                          <input
                            className="input"
                            inputMode="decimal"
                            aria-label={`Company profit percent for ${p.name}`}
                            style={{ width: 72 }}
                            value={d.companyPctText !== '' ? d.companyPctText : String(sp.companyProfitPct)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d.]/g, '');
                              absorb(pctToInr(sp.grossInr, raw), { companyPctText: raw });
                            }}
                          />
                          <span className="ds-caption">%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="ds-caption">Allocation</td>
                  {chosen.map((p) => {
                    const sp = splitOf(p);
                    const total = Math.round((sp.agentPct + sp.execPct + sp.companyProfitPct) * 10) / 10;
                    const bad = sp.overAllocated || sp.negative;
                    return (
                      <td key={p.id} className="ds-caption" style={{ color: bad ? 'var(--tone-expired)' : undefined }}>
                        {sp.overAllocated
                          ? `over-allocated by ${money(-sp.companyProfitInr)}`
                          : sp.negative ? 'a commission cannot be negative'
                          : `\u2713 ${total}% of ${money(sp.grossInr)}`}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="ds-caption">Cover per unit of premium</td>
                  {chosen.map((p) => {
                    const d = draftOf(p.id);
                    const premium = Number(d.premiumInr) || 0;
                    const sum = Number(d.sumInsuredInr) || 0;
                    return (
                      <td key={p.id} className="ds-num">
                        {premium > 0 ? `${(sum / premium).toFixed(1)}x` : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td />
                  {chosen.map((p) => {
                    const issue = lineIssue(p);
                    return (
                      <td key={p.id}>
                        {issue
                          ? <span className="ds-caption" style={{ color: 'var(--tone-expired)' }}>{issue}</span>
                          : <span className="ds-caption">Ready</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
