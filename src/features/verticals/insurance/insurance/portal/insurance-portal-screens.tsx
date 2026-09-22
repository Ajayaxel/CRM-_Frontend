'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, FileText, Download, RefreshCw, AlertTriangle, LifeBuoy, UserRound,
  Plus, Check, Loader2, Phone, HeartPulse, Car, Bike, Truck, Plane, Flame, Ship,
  Building2, HandCoins, Briefcase, Wallet, House, Users, KeyRound, MessageSquare,
  CalendarClock, X, ChevronRight, ChevronLeft, Sparkles, FolderOpen, Receipt,
  Send, CircleCheck, Clock3,
} from 'lucide-react';
import { toast } from 'sonner';
import { portalApi } from '@/features/experiences/portal/portal-client';
import { DeclarationsPanel, DeclarationActionCard } from './health-declaration';
import {
  Card, Badge, EmptyState, Stepper, Timeline, Drawer, Skeleton, Segmented, FormSection, Field,
  EntityIcon, SectionTitle, useIsNarrow, TONE, toneForPolicyStatus, toneForClaimStatus,
  humanStatus, type Tone,
} from '@/features/verticals/insurance/insurance/ui/kit';

/**
 * Insurance Phase 6 — the policyholder's self-service screens.
 *
 * This is a customer surface, so it is built like a banking app rather than a
 * console: policies are wallet cards, actions are thumb-sized, and the phone
 * layout gets a real bottom navigation bar. Every endpoint derives its subject
 * from the session — where a policy or claim id appears in a call, the API
 * resolves it inside the caller's own book, so a foreign id simply 404s.
 */

type Tab = 'Home' | 'Policies' | 'Documents' | 'Claims' | 'Support' | 'Profile';
const TABS: Tab[] = ['Home', 'Policies', 'Documents', 'Claims', 'Support', 'Profile'];
const TAB_ICON: Record<Tab, any> = {
  Home: House, Policies: Wallet, Documents: FolderOpen, Claims: AlertTriangle,
  Support: LifeBuoy, Profile: UserRound,
};
/** The bottom bar has six slots on a 375px phone, so its labels are the short ones. */
const NAV_LABEL: Record<Tab, string> = {
  Home: 'Home', Policies: 'Cards', Documents: 'Docs', Claims: 'Claims',
  Support: 'Help', Profile: 'You',
};

const day = (d?: string | null) =>
  (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** "12 December" — the way a person says a renewal date out loud. */
const dayMonth = (d?: string | null) =>
  (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : '—');

/** A card's colour comes from what it covers — health reads warm-green, motor blue, life violet. */
function categoryTone(category?: string): Tone {
  switch ((category ?? '').toUpperCase()) {
    case 'HEALTH': return 'active';
    case 'MOTOR':
    case 'BIKE':
    case 'COMMERCIAL_VEHICLE': return 'sales';
    case 'LIFE':
    case 'ACCIDENT': return 'claim';
    case 'TRAVEL': return 'info';
    case 'FIRE':
    case 'MARINE':
    case 'PROPERTY':
    case 'BUSINESS': return 'renewal';
    default: return 'neutral';
  }
}

function categoryIcon(category?: string) {
  switch ((category ?? '').toUpperCase()) {
    case 'HEALTH': return HeartPulse;
    case 'MOTOR': return Car;
    case 'BIKE': return Bike;
    case 'COMMERCIAL_VEHICLE': return Truck;
    case 'TRAVEL': return Plane;
    case 'FIRE': return Flame;
    case 'MARINE': return Ship;
    case 'PROPERTY': return Building2;
    case 'LIFE': return HandCoins;
    case 'ACCIDENT': return ShieldCheck;
    case 'BUSINESS': return Briefcase;
    default: return ShieldCheck;
  }
}

/** How much of the term is still to run, 0–1. */
function termLeft(p: any) {
  const start = new Date(p.startDate).getTime();
  const end = new Date(p.endDate).getTime();
  const span = Math.max(end - start, 1);
  return Math.min(Math.max((end - Date.now()) / span, 0), 1);
}

function renewalCopy(p: any) {
  const d = p.daysLeft as number;
  if (p.status === 'RENEWED') return { text: `Renewed — cover continued from ${day(p.endDate)}`, tone: 'info' as Tone };
  if (p.status === 'PROPOSAL') return { text: 'Proposal — not yet on risk', tone: 'renewal' as Tone };
  if (['EXPIRED', 'CANCELLED'].includes(p.status)) return { text: `Cover ended ${day(p.endDate)}`, tone: 'neutral' as Tone };
  if (d < 0) return { text: `Overdue by ${-d} day${d === -1 ? '' : 's'}`, tone: 'expired' as Tone };
  if (d === 0) return { text: 'Renews today', tone: 'expired' as Tone };
  if (d <= 45) return { text: `Renews in ${d} day${d === 1 ? '' : 's'}`, tone: 'renewal' as Tone };
  return { text: `Renews in ${d} days · ${day(p.endDate)}`, tone: 'neutral' as Tone };
}

const canRenew = (p: any) =>
  ['ACTIVE', 'LAPSED'].includes(p.status) && (p.daysLeft <= 45 || p.status === 'LAPSED');

/**
 * What the insurer usually asks for, by cover — mirrors the API's default claim
 * checklist so the wizard can ask "have you got these?" before the claim exists.
 * The claim's OWN checklist (which a broker may have tailored on the product) is
 * what gets ticked after registration, so this list is only ever a preview.
 */
const LIKELY_DOCS: Record<string, { key: string; label: string }[]> = {
  MOTOR: [
    { key: 'rc', label: 'Registration certificate (RC)' },
    { key: 'dl', label: "Driver's licence" },
    { key: 'fir', label: 'FIR / police intimation (if applicable)' },
    { key: 'photos', label: 'Damage photographs' },
    { key: 'estimate', label: 'Garage repair estimate' },
  ],
  HEALTH: [
    { key: 'discharge', label: 'Discharge summary' },
    { key: 'bills', label: 'Hospital bills & receipts' },
    { key: 'reports', label: 'Investigation reports' },
    { key: 'id', label: 'Insured ID & policy copy' },
  ],
  DEFAULT: [
    { key: 'form', label: 'Claim form (signed)' },
    { key: 'proof', label: 'Proof of loss / incident' },
    { key: 'id', label: 'Insured ID & policy copy' },
  ],
};
const likelyDocs = (category?: string) =>
  LIKELY_DOCS[(category ?? '').toUpperCase()] ?? LIKELY_DOCS.DEFAULT;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function useFetch<T>(path: string, dep = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    portalApi<T>(path)
      .then((d) => live && setData(d))
      .catch((e: any) => live && setError(e?.message ?? 'Could not load'));
    return () => { live = false; };
  }, [path, dep]);
  return { data, error };
}

/** Open a print-ready document in a new tab; the browser's print dialog is the PDF path. */
function printDocument(title: string, bodyHtml: string) {
  const w = window.open('', '_blank');
  if (!w) { toast.error('Allow pop-ups to download documents'); return; }
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a2033;margin:34px;font-size:13px}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #d9dde7;padding-bottom:5px}
  table{width:100%;border-collapse:collapse;margin-top:6px} th,td{padding:7px 9px;border:1px solid #d9dde7;text-align:left;font-size:12.5px}
  th{background:#f4f6fa;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .muted{color:#69708a;font-size:11.5px} .tot{font-weight:700}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a2033;padding-bottom:12px;margin-bottom:16px}
  .right{text-align:right} @media print { .noprint{display:none} }
</style></head><body>${bodyHtml}
<div class="noprint" style="margin-top:26px"><button onclick="window.print()" style="padding:9px 18px;font-size:13px;cursor:pointer">Print / Save as PDF</button></div>
</body></html>`);
  w.document.close();
}

// ===================== Shared chrome =====================

/** One place for the portal's own primitives, so nothing is styled by hand at the call site. */
function PortalStyles() {
  return (
    <style jsx global>{`
      .ip-root { display: flex; flex-direction: column; gap: var(--gap-section); }
      .ip-stack { display: flex; flex-direction: column; gap: var(--s-4); }

      .ip-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        min-height: 44px; padding: 0 18px; border-radius: var(--r-control);
        font-size: var(--t-body); font-weight: 620; letter-spacing: -0.005em;
        border: 1px solid transparent; cursor: pointer; white-space: nowrap;
        transition: background 140ms ease, border-color 140ms ease, transform 120ms ease;
      }
      .ip-btn:active:not(:disabled) { transform: scale(0.985); }
      .ip-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .ip-btn:focus-visible { outline: 2px solid var(--ip-accent); outline-offset: 2px; }
      .ip-btn-primary { background: var(--ip-accent); color: #fff; }
      .ip-btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
      .ip-btn-quiet { background: var(--surface); color: var(--ink); border-color: var(--hairline-strong); }
      .ip-btn-quiet:hover:not(:disabled) { background: var(--surface-2); }

      .ip-iconbtn {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 44px; min-height: 44px; border-radius: var(--r-control);
        border: 1px solid var(--hairline-strong); background: var(--surface);
        color: var(--tone-expired); cursor: pointer;
      }
      .ip-iconbtn:hover { background: var(--tone-expired-bg); }

      .ip-actions { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-top: var(--s-4); }
      .ip-actions > .ip-btn { flex: 1 1 150px; }

      .ip-wallets { display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); }
      @media (max-width: 720px) { .ip-wallets { grid-template-columns: 1fr; } }

      .ip-wallet {
        position: relative; overflow: hidden;
        border: 1px solid var(--hairline); border-radius: var(--r-panel);
        padding: var(--pad-card); display: flex; flex-direction: column; gap: var(--s-3);
      }

      .ip-cardno {
        font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
        font-size: var(--t-small); font-weight: 560; letter-spacing: 0.17em;
        color: var(--ink-2); text-transform: uppercase;
      }

      .ip-meter { height: 6px; border-radius: var(--r-pill); background: var(--surface-2); overflow: hidden; }
      .ip-meter > span { display: block; height: 100%; border-radius: var(--r-pill); transition: width 380ms cubic-bezier(.4, 0, .2, 1); }

      .ip-chip {
        display: inline-flex; align-items: center; gap: 8px;
        min-height: 44px; padding: 0 16px; border-radius: var(--r-pill);
        font-size: var(--t-small); font-weight: 580; cursor: pointer;
        border: 1px solid var(--hairline-strong); background: var(--surface); color: var(--ink-2);
        transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
      }
      .ip-chip:hover:not(:disabled) { background: var(--surface-2); }
      .ip-chip[data-on='true'] { border-color: var(--tone-active-line); background: var(--tone-active-bg); color: var(--tone-active); }
      .ip-chip:disabled { cursor: default; opacity: 0.7; }

      .ip-toggle {
        display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 16px;
        border-radius: var(--r-control); border: 1px solid var(--hairline-strong);
        background: var(--surface); color: var(--ink-2); cursor: pointer;
        font-size: var(--t-body); font-weight: 560;
      }
      .ip-toggle[data-on='true'] {
        border-color: var(--ip-accent); color: var(--ink);
        background: color-mix(in srgb, var(--ip-accent) 9%, var(--surface));
      }

      /* ---- Wallet hero ---- */
      .ip-hero {
        border: 1px solid var(--hairline);
        border-radius: var(--r-panel);
        padding: var(--pad-card);
        background:
          linear-gradient(150deg,
            color-mix(in srgb, var(--ip-accent) 13%, var(--surface)) 0%,
            color-mix(in srgb, var(--ip-accent) 5%, var(--surface)) 52%,
            var(--surface) 100%);
      }
      .ip-hero-chips { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-top: var(--s-4); }
      .ip-hchip {
        display: inline-flex; align-items: center; gap: 7px;
        min-height: 34px; padding: 0 12px; border-radius: var(--r-pill);
        border: 1px solid var(--hairline-strong); background: var(--surface);
        font-size: var(--t-small); font-weight: 560; color: var(--ink-2);
      }
      button.ip-hchip { min-height: 44px; cursor: pointer; }
      button.ip-hchip:hover { background: var(--surface-2); }

      /* ---- Quick actions ---- */
      .ip-qa { display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); }
      @media (max-width: 560px) { .ip-qa { grid-template-columns: repeat(3, 1fr); } }
      .ip-qa-item {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
        min-height: 92px; padding: 12px 8px; border-radius: var(--r-card);
        border: 1px solid var(--hairline); background: var(--surface); cursor: pointer;
        color: var(--ink); font-size: var(--t-caption); font-weight: 600; line-height: 1.25;
        text-align: center; transition: background 140ms ease, border-color 140ms ease, transform 120ms ease;
      }
      .ip-qa-item:hover { background: var(--surface-2); border-color: var(--hairline-strong); }
      .ip-qa-item:active { transform: scale(0.98); }
      .ip-qa-item:focus-visible { outline: 2px solid var(--ip-accent); outline-offset: 2px; }

      /* ---- Card-style single choice (wizard step 1) ---- */
      .ip-choice {
        display: flex; align-items: center; gap: var(--s-3); width: 100%; text-align: left;
        min-height: 68px; padding: 14px; border-radius: var(--r-card);
        border: 1px solid var(--hairline); background: var(--surface); cursor: pointer;
        transition: background 140ms ease, border-color 140ms ease;
      }
      .ip-choice:hover { background: var(--surface-2); }
      .ip-choice[data-on='true'] {
        border-color: var(--ip-accent);
        background: color-mix(in srgb, var(--ip-accent) 8%, var(--surface));
      }
      .ip-choice:focus-visible { outline: 2px solid var(--ip-accent); outline-offset: 2px; }

      /* ---- Tickable "I have this" row (wizard step 3) ---- */
      .ip-check {
        display: flex; align-items: center; gap: var(--s-3); width: 100%; text-align: left;
        min-height: 56px; padding: 10px 14px; border-radius: var(--r-card);
        border: 1px solid var(--hairline); background: var(--surface); cursor: pointer;
        font-size: var(--t-body); font-weight: 540; color: var(--ink);
        transition: background 140ms ease, border-color 140ms ease;
      }
      .ip-check:hover:not(:disabled) { background: var(--surface-2); }
      .ip-check[data-on='true'] { border-color: var(--tone-active-line); background: var(--tone-active-bg); }
      .ip-check:disabled { cursor: default; opacity: 0.75; }
      .ip-check-box {
        width: 24px; height: 24px; border-radius: 8px; flex: none;
        display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid var(--hairline-strong); background: var(--surface); color: transparent;
      }
      .ip-check[data-on='true'] .ip-check-box {
        background: var(--tone-active); border-color: var(--tone-active); color: #fff;
      }

      .ip-wizard-nav {
        display: flex; gap: var(--s-2); flex-wrap: wrap;
        margin-top: var(--s-5); padding-top: var(--s-4); border-top: 1px solid var(--hairline);
      }

      /* ---- Support conversation ---- */
      .ip-thread { display: flex; flex-direction: column; gap: var(--s-3); margin-top: var(--s-4); }
      .ip-bubble {
        max-width: 84%; padding: 12px 14px; border-radius: var(--r-panel);
        font-size: var(--t-body); line-height: var(--lh-body); color: var(--ink);
      }
      .ip-bubble-me {
        align-self: flex-end; border-bottom-right-radius: var(--r-sm);
        background: color-mix(in srgb, var(--ip-accent) 11%, var(--surface));
        border: 1px solid color-mix(in srgb, var(--ip-accent) 22%, transparent);
      }
      .ip-bubble-them {
        align-self: flex-start; border-bottom-left-radius: var(--r-sm);
        background: var(--surface-2); border: 1px solid var(--hairline);
      }
      .ip-bubble-who {
        font-size: var(--t-caption); font-weight: 620; letter-spacing: var(--tr-caption);
        text-transform: uppercase; color: var(--ink-3); margin-bottom: 5px;
      }
      .ip-minichip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 3px 9px; border-radius: var(--r-pill);
        border: 1px solid var(--hairline-strong); background: var(--surface);
        font-size: var(--t-caption); font-weight: 580; color: var(--ink-3);
      }

      .ip-editor-row {
        display: grid; gap: var(--s-2); align-items: end;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) 44px;
      }
      @media (max-width: 720px) { .ip-editor-row { grid-template-columns: 1fr 1fr 44px; } }

      .ip-bottomnav {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: flex;
        background: var(--surface); border-top: 1px solid var(--hairline);
        box-shadow: 0 -6px 22px -14px rgba(0, 0, 0, 0.45);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .ip-navitem {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 4px; min-height: 56px; padding: 8px 2px; border: 0; background: none; cursor: pointer;
        color: var(--ink-3); font-size: 11px; font-weight: 620;
        transition: color 140ms ease;
      }
      .ip-navitem[data-active='true'] { color: var(--ip-accent); }
      .ip-navitem:focus-visible { outline: 2px solid var(--ip-accent); outline-offset: -3px; }

      .ip-spin { animation: ipSpin 900ms linear infinite; }
      @keyframes ipSpin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .ip-spin { animation: none; }
        .ip-btn:active:not(:disabled) { transform: none; }
      }
    `}</style>
  );
}

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="ip-bottomnav" aria-label="Portal sections">
      {TABS.map((t) => {
        const Icon = TAB_ICON[t];
        return (
          <button
            key={t}
            className="ip-navitem"
            data-active={tab === t}
            aria-current={tab === t ? 'page' : undefined}
            onClick={() => onTab(t)}
            aria-label={t}
          >
            <Icon size={20} strokeWidth={tab === t ? 2.3 : 1.8} />
            {NAV_LABEL[t]}
          </button>
        );
      })}
    </nav>
  );
}

/** A friendly completion ring — "how far along am I", not a progress table. */
function Ring({ pct, tone, size = 54 }: { pct: number; tone: Tone; size?: number }) {
  const t = TONE[tone];
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.fg} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(Math.max(pct, 0), 1))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 420ms cubic-bezier(.4,0,.2,1)' }}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.26} fontWeight={700} fill="var(--ink)"
      >{Math.round(pct * 100)}%</text>
    </svg>
  );
}

// ===================== Root =====================
export function InsuranceCustomerPortal({ accent = '#155e75' }: { accent?: string }) {
  const [tab, setTab] = useState<Tab>('Home');
  const [bump, setBump] = useState(0);
  const [claimDrawer, setClaimDrawer] = useState<{ open: boolean; policy: any | null }>({ open: false, policy: null });
  const refresh = useCallback(() => setBump((b) => b + 1), []);
  const narrow = useIsNarrow();
  const { data: ov, error } = useFetch<any>('/portal/me/insurance/overview', bump);

  const rootStyle = { ['--ip-accent' as any]: accent, paddingBottom: narrow ? 92 : 0 } as React.CSSProperties;

  if (error) {
    return (
      <div className="ip-root" style={rootStyle}>
        <PortalStyles />
        <Card>
          <EmptyState
            icon={KeyRound}
            title="We could not open your account"
            body="Your session may have ended. Sign in again and everything will be right where you left it."
          />
        </Card>
      </div>
    );
  }

  if (!ov) {
    return (
      <div className="ip-root" style={rootStyle}>
        <PortalStyles />
        <Skeleton rows={1} height={68} />
        <Skeleton rows={2} height={186} />
        <Skeleton rows={2} height={72} />
      </div>
    );
  }

  const cur = ov.currency ?? 'INR';
  const money = (n: number) =>
    `${cur === 'INR' ? '₹' : cur + ' '}${Math.round(n ?? 0).toLocaleString(cur === 'INR' ? 'en-IN' : 'en-AE')}`;

  const activePolicies = (ov.policies as any[]).filter((p) => p.status === 'ACTIVE');

  // ---- Documents (print → PDF). Hoisted so Home and Policies share one implementation.
  const downloadPolicy = async (p: any) => {
    try {
      const d = await portalApi<any>(`/portal/me/insurance/policies/${p.id}/document`);
      const pol = d.policy;
      printDocument(`Policy ${pol.policyNo}`, `
        <div class="head">
          <div><h1>${d.broker?.name ?? 'Your broker'}</h1><div class="muted">Policy schedule (broker copy)</div></div>
          <div class="right"><div style="font-weight:700">${pol.policyNo}</div><div class="muted">Generated ${new Date(d.generatedAt).toLocaleDateString('en-IN')}</div></div>
        </div>
        <h2>Insured</h2>
        <table><tr><th>Name</th><td>${d.insured.name ?? ''}</td><th>Contact</th><td>${d.insured.email ?? ''} ${d.insured.phone ?? ''}</td></tr></table>
        <h2>Policy details</h2>
        <table>
          <tr><th>Insurer</th><td>${pol.companyName}</td><th>Product</th><td>${pol.productName} (${pol.category})</td></tr>
          <tr><th>Policy number</th><td>${pol.policyNo}</td><th>Status</th><td>${pol.status}</td></tr>
          <tr><th>Period</th><td>${new Date(pol.startDate).toLocaleDateString('en-IN')} → ${new Date(pol.endDate).toLocaleDateString('en-IN')}</td><th>Sum insured</th><td class="tot">${money(pol.sumInsuredInr)}</td></tr>
          <tr><th>Annual premium</th><td class="tot">${money(pol.premiumInr)}</td><th>Grace period</th><td>15 days</td></tr>
        </table>
        ${d.claims.length ? `<h2>Claims on this policy</h2><table><tr><th>Claim</th><th>Incident</th><th>Status</th><th>Settled</th></tr>${d.claims.map((c: any) => `<tr><td>${c.claimNo}</td><td>${new Date(c.incidentDate).toLocaleDateString('en-IN')}</td><td>${c.status}</td><td>${c.settledInr != null ? money(c.settledInr) : '—'}</td></tr>`).join('')}</table>` : ''}
        <p class="muted" style="margin-top:18px">This schedule summarises the cover placed through your broker. The insurer's policy wording governs the contract of insurance.</p>
      `);
    } catch { toast.error('Could not prepare the document'); }
  };

  const downloadTaxCert = async () => {
    try {
      const d = await portalApi<any>('/portal/me/insurance/tax-certificate');
      printDocument(`Premium certificate FY ${d.financialYear}`, `
        <div class="head">
          <div><h1>${d.broker?.name ?? 'Your broker'}</h1><div class="muted">Premium payment certificate — FY ${d.financialYear}</div></div>
          <div class="right"><div class="muted">Generated ${new Date(d.generatedAt).toLocaleDateString('en-IN')}</div></div>
        </div>
        <p>This is to certify that <b>${d.insured.name}</b> has paid the following insurance premiums during the financial year <b>${d.financialYear}</b> (${new Date(d.period.from).toLocaleDateString('en-IN')} to ${new Date(d.period.to).toLocaleDateString('en-IN')}):</p>
        <table>
          <tr><th>Policy</th><th>Insurer</th><th>Product</th><th>Category</th><th>Start</th><th>Premium</th><th>Tax section</th></tr>
          ${d.lines.map((l: any) => `<tr><td>${l.policyNo}</td><td>${l.companyName}</td><td>${l.productName}</td><td>${l.category}</td><td>${new Date(l.startDate).toLocaleDateString('en-IN')}</td><td>${money(l.premiumInr)}</td><td>${l.section ?? '—'}</td></tr>`).join('')}
          <tr><td colspan="5" class="tot">Total premium paid</td><td class="tot">${money(d.totals.premiumInr)}</td><td></td></tr>
          ${d.totals.healthPremiumInr ? `<tr><td colspan="5">of which health (eligible u/s 80D)</td><td>${money(d.totals.healthPremiumInr)}</td><td>80D</td></tr>` : ''}
          ${d.totals.lifePremiumInr ? `<tr><td colspan="5">of which life (eligible u/s 80C)</td><td>${money(d.totals.lifePremiumInr)}</td><td>80C</td></tr>` : ''}
        </table>
        <p class="muted" style="margin-top:18px">Issued for income-tax purposes on the policyholder's request. Please consult your tax advisor on the deduction actually available to you.</p>
      `);
    } catch { toast.error('Could not prepare the certificate'); }
  };

  const openClaim = (policy: any | null) => {
    if (activePolicies.length === 0) { toast.error('You need an active policy before you can file a claim'); return; }
    setClaimDrawer({ open: true, policy: policy ?? (activePolicies.length === 1 ? activePolicies[0] : null) });
  };

  const contact = ov.client.email ?? ov.client.phone ?? '';
  const firstName = String(ov.client.name ?? '').split(/\s+/)[0] || 'there';

  return (
    <div className="ip-root" style={rootStyle}>
      <PortalStyles />

      {/* On Home the wallet hero carries the greeting, so the page header stands down. */}
      {tab !== 'Home' && (
        <header>
          <h1 className="ds-h1">{tab}</h1>
          {contact && <div className="ds-caption" style={{ marginTop: 6 }}>{ov.client.name} · {contact}</div>}
        </header>
      )}

      {!narrow && (
        <div>
          <Segmented options={TABS as unknown as string[]} value={tab} onChange={(v) => setTab(v as Tab)} />
        </div>
      )}

      {tab === 'Home' && (
        <HomeTab
          ov={ov} money={money} firstName={firstName} onChanged={refresh}
          onDownloadPolicy={downloadPolicy} onClaim={openClaim} onTab={setTab}
        />
      )}
      {tab === 'Policies' && (
        <PoliciesTab
          ov={ov} money={money} cur={cur} onChanged={refresh}
          onDownloadPolicy={downloadPolicy} onTaxCert={downloadTaxCert} onClaim={openClaim}
        />
      )}
      {tab === 'Documents' && (
        <>
          {/* Declarations sit with the documents because that is what they are:
              paperwork the customer signs and may need to read back. The nudge
              on Home sends them here rather than opening a seventh nav slot on
              a bar that already has six on a 375px phone. */}
          <DeclarationsPanel bump={bump} onChanged={refresh} />
          <DocumentsTab ov={ov} cur={cur} onDownloadPolicy={downloadPolicy} onTaxCert={downloadTaxCert} />
        </>
      )}
      {tab === 'Claims' && <ClaimsTab money={money} bump={bump} onChanged={refresh} onClaim={() => openClaim(null)} />}
      {tab === 'Support' && <SupportTab bump={bump} onChanged={refresh} />}
      {tab === 'Profile' && <ProfileTab bump={bump} />}

      {narrow && <BottomNav tab={tab} onTab={setTab} />}

      <ClaimDrawer
        open={claimDrawer.open}
        policy={claimDrawer.policy}
        policies={activePolicies}
        money={money}
        onClose={() => setClaimDrawer({ open: false, policy: null })}
        onDone={() => { setClaimDrawer({ open: false, policy: null }); refresh(); setTab('Claims'); }}
      />
    </div>
  );
}

// ===================== Wallet card =====================

function PolicyWallet({
  p, money, onDownload, onClaim, onChanged, compact,
}: {
  p: any; money: (n: number) => string; onDownload: (p: any) => void;
  onClaim: (p: any) => void; onChanged: () => void; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const cTone = categoryTone(p.category);
  const t = TONE[cTone];
  const Icon = categoryIcon(p.category);
  const renewal = renewalCopy(p);
  const rt = TONE[renewal.tone];
  const left = termLeft(p);

  const renew = async () => {
    setBusy(true);
    try {
      const r = await portalApi<any>(`/portal/me/insurance/policies/${p.id}/renew`, { method: 'POST' });
      toast.success(`Renewed — your new policy is ${r.policyNo}`);
      onChanged();
    } catch { toast.error('Could not renew this policy — please contact your broker'); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="ip-wallet"
      style={{
        background: `linear-gradient(140deg, ${t.bg} 0%, color-mix(in srgb, ${t.bg} 45%, var(--surface)) 46%, var(--surface) 100%)`,
        borderColor: t.line,
      }}
    >
      {/* Issuer — the top line of a card is always who stands behind it */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <EntityIcon icon={Icon} tone={cTone} size="lg" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-caption-upper" style={{ color: t.fg }}>{p.companyName}</div>
          <div className="ds-h3" style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.productName}
          </div>
        </div>
        <Badge tone={toneForPolicyStatus(p.status)}>{humanStatus(p.status)}</Badge>
      </div>

      <div className="ip-cardno">{p.policyNo}</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="ds-caption">Sum insured</div>
          <div className="ds-display" style={{ marginTop: 2 }}>{money(p.sumInsuredInr)}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="ds-caption">Premium</div>
          <div className="ds-h2 ds-num" style={{ marginTop: 4 }}>
            {money(p.premiumInr)}<span className="ds-caption"> / year</span>
          </div>
        </div>
      </div>

      {/* Renewal countdown — the one number a policyholder actually watches */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <CalendarClock size={14} style={{ color: rt.fg, flex: 'none' }} />
          <span className="ds-small" style={{ color: rt.fg, fontWeight: 620 }}>{renewal.text}</span>
          <span className="ds-caption" style={{ marginLeft: 'auto', flex: 'none' }}>
            {day(p.startDate)} → {day(p.endDate)}
          </span>
        </div>
        <div className="ip-meter">
          <span style={{ width: `${Math.round(left * 100)}%`, background: rt.fg, opacity: 0.9 }} />
        </div>
      </div>

      {!compact && (
        <div className="ip-actions">
          {canRenew(p) && (
            <button className="ip-btn ip-btn-primary" onClick={renew} disabled={busy}>
              {busy ? <Loader2 size={16} className="ip-spin" /> : <RefreshCw size={16} />} Renew now
            </button>
          )}
          <button className="ip-btn ip-btn-quiet" onClick={() => onDownload(p)}>
            <Download size={16} /> Download
          </button>
          {p.status === 'ACTIVE' && (
            <button className="ip-btn ip-btn-quiet" onClick={() => onClaim(p)}>
              <AlertTriangle size={16} /> File a claim
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== Home =====================

function HomeTab({
  ov, money, firstName, onChanged, onDownloadPolicy, onClaim, onTab,
}: {
  ov: any; money: (n: number) => string; firstName: string; onChanged: () => void;
  onDownloadPolicy: (p: any) => void; onClaim: (p: any | null) => void; onTab: (t: Tab) => void;
}) {
  const policies = ov.policies as any[];
  const active = policies.filter((p) => p.status === 'ACTIVE');
  const shown = (active.length ? active : policies).slice(0, 3);
  const alerts = ov.renewalAlerts as any[];
  const openClaims = ov.kpis.openClaims as number;

  // The next date the customer has to do something about — the wallet's one deadline.
  const nextRenewal = active
    .slice()
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0];

  /** One tap must never fire a renewal by surprise — it takes you to the card that renews. */
  const goRenew = () => onTab('Policies');
  const downloadFirst = () => {
    if (active.length === 1) onDownloadPolicy(active[0]);
    else onTab('Documents');
  };

  const QUICK: { icon: any; label: string; tone: Tone; onClick: () => void }[] = [
    { icon: Wallet, label: 'View policies', tone: 'info', onClick: () => onTab('Policies') },
    { icon: Download, label: 'Download policy', tone: 'sales', onClick: downloadFirst },
    { icon: AlertTriangle, label: 'File a claim', tone: 'claim', onClick: () => onClaim(null) },
    { icon: RefreshCw, label: 'Renew', tone: 'renewal', onClick: goRenew },
    { icon: LifeBuoy, label: 'Contact advisor', tone: 'active', onClick: () => onTab('Support') },
  ];

  return (
    <div className="ip-stack">
      {/* Anything actually being ASKED of the customer goes above the wallet.
          A declaration holds up a policy, so it outranks the balance. Renders
          nothing at all when there is nothing outstanding. */}
      <DeclarationActionCard onOpen={() => onTab('Documents')} />

      {/* The wallet itself: who you are, what you are covered for, what is next. */}
      <section className="ip-hero" aria-label="Your insurance wallet">
        <div className="ds-body" style={{ color: 'var(--ink-2)' }}>{greeting()}, {firstName} 👋</div>
        <div className="ds-caption-upper" style={{ marginTop: 12 }}>Your Insurance Wallet</div>
        <div className="ds-greeting" style={{ marginTop: 4 }}>{money(ov.kpis.totalSumInsuredInr)}</div>
        <div className="ds-body" style={{ marginTop: 6 }}>
          {ov.kpis.activePolicies} active {ov.kpis.activePolicies === 1 ? 'policy' : 'policies'} covered
          {ov.kpis.annualPremiumInr > 0 ? ` · ${money(ov.kpis.annualPremiumInr)} a year` : ''}
        </div>

        <div className="ip-hero-chips">
          <span className="ip-hchip">
            <CalendarClock size={14} style={{ color: 'var(--tone-renewal)', flex: 'none' }} />
            {nextRenewal ? `Next renewal ${dayMonth(nextRenewal.endDate)}` : 'No renewal due'}
          </span>
          {openClaims > 0 ? (
            <button type="button" className="ip-hchip" onClick={() => onTab('Claims')}>
              <AlertTriangle size={14} style={{ color: 'var(--tone-claim)', flex: 'none' }} />
              {openClaims} open {openClaims === 1 ? 'claim' : 'claims'}
              <ChevronRight size={13} />
            </button>
          ) : (
            <span className="ip-hchip">
              <CircleCheck size={14} style={{ color: 'var(--tone-active)', flex: 'none' }} />
              No active claims
            </span>
          )}
        </div>
      </section>

      {/* Quick actions — thumb-sized, always in the same order. */}
      <div className="ip-qa">
        {QUICK.map((a) => (
          <button key={a.label} type="button" className="ip-qa-item" onClick={a.onClick}>
            <EntityIcon icon={a.icon} tone={a.tone} size="lg" />
            {a.label}
          </button>
        ))}
      </div>

      {/* Renewals */}
      {alerts.length > 0 && (
        <Card tone="renewal" style={{ background: 'var(--tone-renewal-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <RefreshCw size={16} style={{ color: 'var(--tone-renewal)', flex: 'none' }} />
            <div className="ds-h2">{alerts.length === 1 ? 'A renewal is coming up' : 'Renewals coming up'}</div>
          </div>
          <div className="ds-body" style={{ marginBottom: 14 }}>
            Renew online in a tap and your cover carries on without a gap.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alerts.map((p) => <RenewRow key={p.id} p={p} money={money} onChanged={onChanged} />)}
          </div>
        </Card>
      )}

      {/* Wallet */}
      <div>
        <SectionTitle
          sub={policies.length > shown.length ? `Showing ${shown.length} of ${policies.length}` : undefined}
          action={policies.length > shown.length
            ? <button className="ds-viewall" onClick={() => onTab('Policies')}>See all <ChevronRight size={13} /></button>
            : undefined}
        >
          Your cards
        </SectionTitle>
        {policies.length === 0 ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title="Your wallet is empty for now"
              body="As soon as your broker places cover for you, the policy appears here — with its documents, renewal date and claim history."
            />
          </Card>
        ) : (
          <div className="ip-wallets">
            {shown.map((p) => (
              <PolicyWallet key={p.id} p={p} money={money} onDownload={onDownloadPolicy} onClaim={onClaim} onChanged={onChanged} />
            ))}
          </div>
        )}
      </div>

      {/* Recent claims */}
      {ov.claims.length > 0 && (
        <Card>
          <SectionTitle action={<button className="ds-viewall" onClick={() => onTab('Claims')}>All claims <ChevronRight size={13} /></button>}>
            Recent claims
          </SectionTitle>
          <div>
            {ov.claims.slice(0, 4).map((c: any) => (
              <div key={c.id} className="ds-list-row">
                <EntityIcon icon={FileText} tone={toneForClaimStatus(c.status)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ds-h3">{c.claimNo}</div>
                  <div className="ds-caption" style={{ marginTop: 2 }}>Incident {day(c.incidentDate)}</div>
                </div>
                {c.settledInr != null && <span className="ds-small ds-num" style={{ fontWeight: 650 }}>{money(c.settledInr)}</span>}
                <Badge tone={toneForClaimStatus(c.status)}>{humanStatus(c.status)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RenewRow({ p, money, onChanged }: { p: any; money: (n: number) => string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const renew = async () => {
    setBusy(true);
    try {
      const r = await portalApi<any>(`/portal/me/insurance/policies/${p.id}/renew`, { method: 'POST' });
      toast.success(`Renewed — your new policy is ${r.policyNo}`);
      onChanged();
    } catch { toast.error('Could not renew this policy — please contact your broker'); }
    finally { setBusy(false); }
  };
  const renewal = renewalCopy(p);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 190 }}>
        <div className="ds-h3">{p.productName}</div>
        <div className="ip-cardno" style={{ marginTop: 4 }}>{p.policyNo}</div>
        <div className="ds-small" style={{ color: TONE[renewal.tone].fg, fontWeight: 620, marginTop: 5 }}>
          {renewal.text} · {money(p.premiumInr)}
        </div>
      </div>
      <button className="ip-btn ip-btn-primary" onClick={renew} disabled={busy} style={{ flex: '0 1 160px' }}>
        {busy ? <Loader2 size={16} className="ip-spin" /> : <RefreshCw size={16} />} Renew now
      </button>
    </div>
  );
}

// ===================== Policies =====================

function PoliciesTab({
  ov, money, cur, onChanged, onDownloadPolicy, onTaxCert, onClaim,
}: {
  ov: any; money: (n: number) => string; cur: string; onChanged: () => void;
  onDownloadPolicy: (p: any) => void; onTaxCert: () => void; onClaim: (p: any | null) => void;
}) {
  const [filter, setFilter] = useState('In force');
  const policies = ov.policies as any[];
  const inForce = policies.filter((p) => ['ACTIVE', 'PROPOSAL', 'LAPSED'].includes(p.status));
  const shown = filter === 'In force' ? inForce : policies;

  return (
    <div className="ip-stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Segmented options={['In force', 'Everything']} value={filter} onChange={setFilter} />
        <button className="ip-btn ip-btn-quiet" style={{ marginLeft: 'auto' }} onClick={onTaxCert}>
          <FileText size={16} /> Tax certificate {cur === 'INR' ? '(80C / 80D)' : ''}
        </button>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={filter === 'In force' ? 'Nothing in force right now' : 'No policies yet'}
            body={filter === 'In force'
              ? 'Switch to Everything to see cover that has expired or been renewed.'
              : 'Once your broker places cover for you it will show up here, ready to download.'}
          />
        </Card>
      ) : (
        <div className="ip-wallets">
          {shown.map((p) => (
            <PolicyWallet key={p.id} p={p} money={money} onDownload={onDownloadPolicy} onClaim={onClaim} onChanged={onChanged} />
          ))}
        </div>
      )}

      <div className="ds-caption" style={{ textAlign: 'center' }}>
        Documents open in a new tab — use your browser's print dialog to save a PDF.
      </div>
    </div>
  );
}

// ===================== Documents =====================

/** One downloadable thing: an icon, what it is, what it covers, and a Download. */
function DocCard({
  icon, tone, title, subtitle, onDownload,
}: { icon: any; tone: Tone; title: string; subtitle: string; onDownload: () => void }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <EntityIcon icon={icon} tone={tone} size="lg" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h3">{title}</div>
          <div className="ds-caption" style={{ marginTop: 3 }}>{subtitle}</div>
        </div>
        <button className="ip-btn ip-btn-quiet" onClick={onDownload} style={{ flex: '0 1 auto' }}>
          <Download size={16} /> Download
        </button>
      </div>
    </Card>
  );
}

function DocumentsTab({
  ov, cur, onDownloadPolicy, onTaxCert,
}: { ov: any; cur: string; onDownloadPolicy: (p: any) => void; onTaxCert: () => void }) {
  const policies = ov.policies as any[];
  // A schedule is worth downloading for anything still on risk, not only ACTIVE —
  // a lapsed policy's schedule is exactly what a customer digs out.
  const schedules = policies.filter((p) => ['ACTIVE', 'LAPSED', 'PROPOSAL'].includes(p.status));

  return (
    <div className="ip-stack">
      <div>
        <SectionTitle sub={schedules.length ? `${schedules.length} available` : undefined}>
          Policy schedules
        </SectionTitle>
        {schedules.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title="No schedules yet"
              body="Once cover is placed for you, its schedule is downloadable here."
              compact
            />
          </Card>
        ) : (
          <div className="ip-stack">
            {schedules.map((p) => (
              <DocCard
                key={p.id}
                icon={categoryIcon(p.category)}
                tone={categoryTone(p.category)}
                title={`Policy schedule — ${p.productName}`}
                subtitle={`${p.companyName} · ${p.policyNo} · ${day(p.startDate)} → ${day(p.endDate)}`}
                onDownload={() => onDownloadPolicy(p)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Certificates</SectionTitle>
        <DocCard
          icon={Receipt}
          tone="info"
          title="Premium payment certificate"
          subtitle={cur === 'INR'
            ? 'Every premium you paid this financial year, with the 80C / 80D split'
            : 'Every premium you paid this financial year'}
          onDownload={onTaxCert}
        />
      </div>

      <Card>
        <EmptyState
          icon={FolderOpen}
          title="Your own documents are not stored yet"
          body="Papers you send us — RC copies, ID cards, hospital bills — stay with your advisor for now. When document storage is switched on, they will appear here alongside these downloads."
          compact
        />
      </Card>

      <div className="ds-caption" style={{ textAlign: 'center' }}>
        Documents open in a new tab — use your browser's print dialog to save a PDF.
      </div>
    </div>
  );
}

// ===================== Claim wizard (drawer) =====================

const WIZARD_STEPS = ['Which policy', 'What happened', 'Documents', 'Review'];
const STEP_TITLE = [
  'Which policy is this about?',
  'What happened?',
  'What have you got ready?',
  'Does this look right?',
];
const STEP_SUB = [
  'Pick the cover you want to claim on.',
  'The date and a short description are all we need to start.',
  'Tick what you already have. Nothing is uploaded here.',
  'Check it over, then send it to your broker.',
];

/** A short summary of a policy, used on the choice cards and the review step. */
function PolicyLine({ p, money }: { p: any; money: (n: number) => string }) {
  return (
    <>
      <EntityIcon icon={categoryIcon(p.category)} tone={categoryTone(p.category)} size="lg" />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="ds-h3" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.productName}
        </span>
        <span className="ip-cardno" style={{ display: 'block', marginTop: 3 }}>{p.policyNo}</span>
        <span className="ds-caption" style={{ display: 'block', marginTop: 3 }}>
          {p.companyName} · cover {money(p.sumInsuredInr)}
        </span>
      </span>
    </>
  );
}

/** A tick row — "I have this", never an uploader. */
function CheckRow({
  label, on, onToggle, disabled,
}: { label: string; on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="ip-check"
      data-on={on}
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="ip-check-box"><Check size={15} /></span>
      <span style={{ minWidth: 0 }}>{label}</span>
    </button>
  );
}

function ClaimDrawer({
  open, policy, policies, money, onClose, onDone,
}: {
  open: boolean; policy: any | null; policies: any[]; money: (n: number) => string;
  onClose: () => void; onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [policyId, setPolicyId] = useState<string>('');
  const [f, setF] = useState({ incidentDate: '', description: '' });
  const [have, setHave] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  // Once registered, the drawer stops being a form and becomes the claim's own story.
  const [filed, setFiled] = useState<any | null>(null);

  // Deliberately keyed on primitives: the parent rebuilds its `policies` array on
  // every refresh, and depending on that array would reset the wizard mid-flow.
  const preselect = policy?.id ?? (policies.length === 1 ? policies[0].id : '');
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPolicyId(preselect);
    setF({ incidentDate: '', description: '' });
    setHave({});
    setFiled(null);
  }, [open, preselect]);

  const chosen = policies.find((p) => p.id === policyId) ?? policy ?? null;
  const checklist = likelyDocs(chosen?.category);
  const readyCount = checklist.filter((d) => have[d.key]).length;

  const stepValid = [
    !!policyId,
    !!f.incidentDate && !!f.description.trim(),
    true,
    true,
  ][step];

  const submit = async () => {
    if (!policyId) return;
    setBusy(true);
    try {
      const c = await portalApi<any>(`/portal/me/insurance/policies/${policyId}/claims`, {
        method: 'POST',
        body: JSON.stringify({ incidentDate: f.incidentDate, description: f.description }),
      });
      // The claim comes back with the checklist the broker actually uses. Tick the
      // ones the customer confirmed — one at a time, because each PATCH rewrites the
      // whole checklist and parallel calls would lose each other's ticks.
      let claim = c;
      for (const d of ((c.docs as any[]) ?? [])) {
        if (!have[d.key]) continue;
        try {
          claim = await portalApi<any>(`/portal/me/insurance/claims/${c.id}/docs`, {
            method: 'PATCH', body: JSON.stringify({ key: d.key, received: true }),
          });
        } catch { /* the claim is safely registered; this tick can be redone below */ }
      }
      setFiled(claim);
      toast.success(`Claim ${c.claimNo} registered — we have listed the documents we need`);
    } catch { toast.error('Could not register the claim'); }
    finally { setBusy(false); }
  };

  /** Ticking on the confirmation screen goes straight to the live claim. */
  const tickFiled = async (key: string, received: boolean) => {
    if (!filed) return;
    try {
      const updated = await portalApi<any>(`/portal/me/insurance/claims/${filed.id}/docs`, {
        method: 'PATCH', body: JSON.stringify({ key, received }),
      });
      setFiled(updated);
    } catch { toast.error('Could not update the document'); }
  };

  if (!open) return null;

  // Leaving after a claim is filed still has to refresh the list behind the drawer.
  const dismiss = () => (filed ? onDone() : onClose());

  if (filed) {
    const docs = (filed.docs as any[]) ?? [];
    const done = docs.filter((d) => d.received).length;
    // Only real timestamps go on the rail — the incident is a date, so it rides
    // along as detail rather than pretending to have happened at midnight.
    const events: { at: string | Date; title: string; detail?: string; tone?: Tone; icon?: any }[] = [
      {
        at: filed.createdAt, title: `Claim ${filed.claimNo} registered`,
        detail: `Incident ${day(filed.incidentDate)}${chosen ? ` · policy ${chosen.policyNo}` : ''}`,
        tone: 'claim', icon: FileText,
      },
      ...(done > 0
        ? [{
            at: filed.updatedAt ?? filed.createdAt,
            title: `${done} of ${docs.length} documents confirmed`,
            detail: 'Your advisor will collect the files from you.',
            tone: 'active' as Tone, icon: Check,
          }]
        : []),
      ...(filed.settledAt
        ? [{ at: filed.settledAt, title: 'Settled', tone: 'active' as Tone, icon: CircleCheck }]
        : []),
    ];

    return (
      <Drawer
        open={open}
        onClose={dismiss}
        title={`Claim ${filed.claimNo} is with us`}
        subtitle="Here is where it stands and what happens next."
      >
        <Card tone="active" style={{ background: 'var(--tone-active-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <EntityIcon icon={CircleCheck} tone="active" size="lg" />
            <div style={{ minWidth: 0 }}>
              <div className="ds-h3">Registered</div>
              <div className="ds-caption" style={{ marginTop: 3 }}>
                A person picks this up — no need to call and chase it.
              </div>
            </div>
          </div>
        </Card>

        <div className="ds-scroll-x" style={{ marginTop: 20, paddingBottom: 4 }}>
          <div style={{ minWidth: 420 }}>
            <Stepper steps={CLAIM_STEPS} current={claimStep(filed.status)} />
          </div>
        </div>

        {docs.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionTitle sub={`${done} of ${docs.length} confirmed`}>Your documents</SectionTitle>
            <div className="ds-body" style={{ marginBottom: 12 }}>
              These are the documents your insurer asks for. Tick anything else you have to hand —
              your advisor will collect the actual files from you.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map((d) => (
                <CheckRow key={d.key} label={d.label} on={!!d.received} onToggle={() => tickFiled(d.key, !d.received)} />
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 26 }}>
          <SectionTitle>What has happened so far</SectionTitle>
          <Timeline items={events} dense />
        </div>

        <div className="ip-wizard-nav">
          <button className="ip-btn ip-btn-primary" style={{ flex: '1 1 180px' }} onClick={onDone}>
            <Check size={16} /> Done
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={dismiss}
      title={STEP_TITLE[step]}
      subtitle={STEP_SUB[step]}
    >
      <div className="ds-scroll-x" style={{ marginBottom: 24, paddingBottom: 4 }}>
        <div style={{ minWidth: 340 }}>
          <Stepper steps={WIZARD_STEPS} current={step} />
        </div>
      </div>

      {/* ---- Step 1: which policy ---- */}
      {step === 0 && (
        policies.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No active cover to claim on"
            body="A claim can only be raised on a policy that is in force. Your advisor can help if you think this is wrong."
            compact
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {policies.map((p) => (
              <button
                key={p.id}
                type="button"
                className="ip-choice"
                data-on={p.id === policyId}
                aria-pressed={p.id === policyId}
                onClick={() => setPolicyId(p.id)}
              >
                <PolicyLine p={p} money={money} />
                {p.id === policyId && <Check size={18} style={{ color: 'var(--ip-accent)', flex: 'none' }} />}
              </button>
            ))}
          </div>
        )
      )}

      {/* ---- Step 2: what happened ---- */}
      {step === 1 && (
        <FormSection title="The incident" description="Two details are enough to get things moving.">
          <Field label="When did it happen" span={2} required>
            <input
              type="date"
              className="input input-lg"
              value={f.incidentDate}
              onChange={(e) => setF({ ...f, incidentDate: e.target.value })}
            />
          </Field>
          <Field label="What happened" span={2} required hint="A sentence or two is plenty — your broker will follow up.">
            <textarea
              className="input"
              style={{ minHeight: 120, resize: 'vertical' }}
              placeholder="e.g. Hospitalised for two nights after a fall at home"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </Field>
        </FormSection>
      )}

      {/* ---- Step 3: documents (a confirmation, never an upload) ---- */}
      {step === 2 && (
        <div>
          <Card style={{ marginBottom: 16, background: 'var(--tone-info-bg)', borderColor: 'var(--tone-info-line)' }}>
            <div style={{ display: 'flex', gap: 11 }}>
              <EntityIcon icon={FolderOpen} tone="info" size="lg" />
              <div style={{ minWidth: 0 }}>
                <div className="ds-h3">Nothing is uploaded here</div>
                <div className="ds-small" style={{ marginTop: 4 }}>
                  The portal cannot take files yet. Tick what you already have and your advisor will
                  contact you to collect the originals or copies.
                </div>
              </div>
            </div>
          </Card>

          <div className="ds-body" style={{ marginBottom: 12 }}>
            For {chosen ? chosen.productName : 'this cover'}, an insurer usually asks for:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checklist.map((d) => (
              <CheckRow
                key={d.key}
                label={d.label}
                on={!!have[d.key]}
                onToggle={() => setHave((h) => ({ ...h, [d.key]: !h[d.key] }))}
              />
            ))}
          </div>
          <div className="ds-caption" style={{ marginTop: 12 }}>
            Not having something yet is fine — you can tick it off later from the Claims tab.
          </div>
        </div>
      )}

      {/* ---- Step 4: review ---- */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {chosen && (
            <Card>
              <div className="ds-caption" style={{ marginBottom: 10 }}>Claiming on</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PolicyLine p={chosen} money={money} />
              </div>
            </Card>
          )}

          <Card>
            <div className="ds-caption">When it happened</div>
            <div className="ds-h3" style={{ marginTop: 4 }}>{day(f.incidentDate)}</div>
            <div className="ds-caption" style={{ marginTop: 14 }}>What happened</div>
            <div className="ds-body" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{f.description}</div>
          </Card>

          <Card>
            <div className="ds-caption">Documents you have ready</div>
            <div className="ds-h3" style={{ marginTop: 4 }}>
              {readyCount} of {checklist.length}
            </div>
            {readyCount > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {checklist.filter((d) => have[d.key]).map((d) => (
                  <span key={d.key} className="ip-minichip">
                    <Check size={13} style={{ color: 'var(--tone-active)' }} /> {d.label}
                  </span>
                ))}
              </div>
            )}
            <div className="ds-caption" style={{ marginTop: 12 }}>
              Your advisor will collect the files themselves — nothing is attached to this claim yet.
            </div>
          </Card>
        </div>
      )}

      <div className="ip-wizard-nav">
        {step > 0 ? (
          <button className="ip-btn ip-btn-quiet" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <button className="ip-btn ip-btn-quiet" onClick={onClose} disabled={busy}>
            <X size={16} /> Not now
          </button>
        )}
        {step < 3 ? (
          <button
            className="ip-btn ip-btn-primary"
            style={{ flex: '1 1 160px' }}
            onClick={() => setStep((s) => s + 1)}
            disabled={!stepValid}
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            className="ip-btn ip-btn-primary"
            style={{ flex: '1 1 160px' }}
            onClick={submit}
            disabled={busy || !policyId || !f.incidentDate || !f.description.trim()}
          >
            {busy ? <Loader2 size={16} className="ip-spin" /> : <Check size={16} />} Submit claim
          </button>
        )}
      </div>
    </Drawer>
  );
}

// ===================== Claims =====================

const CLAIM_STEPS = ['Registered', 'Documents in', 'With insurer', 'Approved', 'Settled'];
function claimStep(status: string) {
  switch ((status ?? '').toUpperCase()) {
    case 'DOCS_PENDING': return 1;
    case 'REGISTERED':
    case 'SUBMITTED':
    case 'UNDER_REVIEW': return 2;
    case 'APPROVED': return 3;
    case 'SETTLED': return 4;
    default: return 0;
  }
}

function ClaimsTab({
  money, bump, onChanged, onClaim,
}: { money: (n: number) => string; bump: number; onChanged: () => void; onClaim: () => void }) {
  const { data: claims, error } = useFetch<any[]>('/portal/me/insurance/claims', bump);

  if (error) {
    return (
      <Card>
        <EmptyState icon={AlertTriangle} title="We could not load your claims" body="Give it a moment and try again — nothing has been lost." />
      </Card>
    );
  }
  if (!claims) return <Skeleton rows={3} height={168} />;
  if (claims.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Sparkles}
          title="No claims — and long may that continue."
          body="If something does go wrong, start here. We will register it and tell you exactly what to send."
          actionLabel="File a claim"
          onAction={onClaim}
        />
      </Card>
    );
  }

  const tickDoc = async (claim: any, key: string, received: boolean) => {
    try {
      await portalApi(`/portal/me/insurance/claims/${claim.id}/docs`, { method: 'PATCH', body: JSON.stringify({ key, received }) });
      onChanged();
    } catch { toast.error('Could not update the document'); }
  };

  return (
    <div className="ip-stack">
      {claims.map((c) => {
        const docs = (c.docs as any[]) ?? [];
        const done = docs.filter((d) => d.received).length;
        const pct = docs.length ? done / docs.length : 1;
        const locked = ['SETTLED', 'REJECTED'].includes(c.status);
        const rejected = c.status === 'REJECTED';
        const tone = toneForClaimStatus(c.status);

        return (
          <Card key={c.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <EntityIcon icon={FileText} tone={tone} size="lg" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ds-h2">{c.claimNo}</div>
                <div className="ds-caption" style={{ marginTop: 3 }}>
                  {c.policy?.productName} · {c.policy?.policyNo} · incident {day(c.incidentDate)}
                </div>
              </div>
              {c.settledInr != null && (
                <div style={{ textAlign: 'right' }}>
                  <div className="ds-caption">Settled</div>
                  <div className="ds-h2 ds-num" style={{ marginTop: 3 }}>{money(c.settledInr)}</div>
                </div>
              )}
              <Badge tone={tone}>{humanStatus(c.status)}</Badge>
            </div>

            {c.description && <div className="ds-body" style={{ marginTop: 12 }}>{c.description}</div>}

            {rejected ? (
              <div
                className="ds-inset"
                style={{ marginTop: 16, padding: 14, background: 'var(--tone-expired-bg)' }}
              >
                <div className="ds-h3" style={{ color: 'var(--tone-expired)' }}>This claim was not admitted</div>
                <div className="ds-small" style={{ marginTop: 4 }}>
                  Your broker can walk you through the insurer's reasoning and whether it is worth contesting.
                </div>
              </div>
            ) : (
              <div className="ds-scroll-x" style={{ marginTop: 18, paddingBottom: 4 }}>
                <div style={{ minWidth: 420 }}>
                  <Stepper steps={CLAIM_STEPS} current={claimStep(c.status)} />
                </div>
              </div>
            )}

            {docs.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <Ring pct={pct} tone={pct === 1 ? 'active' : 'renewal'} />
                  <div style={{ minWidth: 0 }}>
                    <div className="ds-h3">
                      {pct === 1 ? 'Everything is in — thank you' : `${done} of ${docs.length} documents in`}
                    </div>
                    <div className="ds-caption" style={{ marginTop: 3 }}>
                      {pct === 1
                        ? 'Nothing more to send. We will take it from here.'
                        : 'Tap a document once you have shared it with your broker — the claim moves ahead when everything is in.'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {docs.map((d) => (
                    <button
                      key={d.key}
                      className="ip-chip"
                      data-on={!!d.received}
                      disabled={locked}
                      onClick={() => tickDoc(c, d.key, !d.received)}
                    >
                      {d.received ? <Check size={15} /> : <Plus size={15} />} {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ===================== Support =====================

/** One request, read as a conversation: what you asked, what your broker said back. */
function SupportThread({ t }: { t: any }) {
  const resolved = t.status === 'RESOLVED';
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="ds-h3" style={{ flex: 1, minWidth: 150 }}>{t.subject}</div>
        {t.callback && (
          <span className="ip-minichip"><Phone size={12} /> Callback requested</span>
        )}
        <Badge tone={resolved ? 'active' : t.status === 'IN_PROGRESS' ? 'sales' : 'neutral'}>
          {humanStatus(t.status)}
        </Badge>
      </div>

      <div className="ip-thread">
        <div className="ip-bubble ip-bubble-me">
          <div className="ip-bubble-who">You · {day(t.createdAt)}</div>
          {t.detail ? t.detail : t.subject}
        </div>

        {t.reply ? (
          <div className="ip-bubble ip-bubble-them">
            <div className="ip-bubble-who">Your broker</div>
            {t.reply}
          </div>
        ) : (
          <div className="ip-bubble ip-bubble-them" style={{ color: 'var(--ink-3)' }}>
            <div className="ip-bubble-who">Your broker</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Clock3 size={14} />
              {resolved
                ? 'Closed without a written reply — your broker handled this directly.'
                : t.callback
                  ? 'We have your request and will call you back.'
                  : 'We have your request. A reply will appear here.'}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function SupportTab({ bump, onChanged }: { bump: number; onChanged: () => void }) {
  const { data: tickets, error } = useFetch<any[]>('/portal/me/insurance/support', bump);
  const [f, setF] = useState({ subject: '', detail: '', callback: false });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await portalApi('/portal/me/insurance/support', { method: 'POST', body: JSON.stringify(f) });
      toast.success(f.callback ? 'Got it — we will call you back' : 'Thanks — your request is with your broker');
      setF({ subject: '', detail: '', callback: false });
      onChanged();
    } catch { toast.error('Could not raise the ticket'); }
    finally { setBusy(false); }
  };

  return (
    <div className="ip-stack">
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <EntityIcon icon={LifeBuoy} tone="sales" size="lg" />
          <div>
            <div className="ds-h2">Your conversations</div>
            <div className="ds-caption" style={{ marginTop: 3 }}>A real person reads every one of these.</div>
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <EmptyState icon={LifeBuoy} title="We could not load your requests" body="Your message box is fine — this is just a hiccup loading it." compact />
        </Card>
      )}

      {!tickets && !error && <Skeleton rows={2} height={148} />}

      {tickets && tickets.length === 0 && (
        <Card>
          <EmptyState
            icon={MessageSquare}
            title="Nothing open with us"
            body="When you ask us something, the conversation and our reply will show up here."
            compact
          />
        </Card>
      )}

      {tickets && tickets.length > 0 && (
        <div className="ip-stack">
          {tickets.map((t) => <SupportThread key={t.id} t={t} />)}
        </div>
      )}

      {/* The composer. Each send opens a NEW request — there is no per-thread reply
          route for a customer, so it would be dishonest to look like one. */}
      <Card>
        <div className="ds-h3">Start a new request</div>
        <div className="ds-caption" style={{ marginTop: 3, marginBottom: 14 }}>
          This opens a fresh conversation rather than replying to one above.
        </div>

        <FormSection title="What can we do for you?">
          <Field label="What is it about" span={2} required>
            <input
              className="input input-lg"
              placeholder="e.g. Update my address, a question about my cover"
              value={f.subject}
              onChange={(e) => setF({ ...f, subject: e.target.value })}
            />
          </Field>
          <Field label="Anything else we should know" span={2} hint="Optional — but the more you tell us, the faster we can help.">
            <textarea
              className="input"
              style={{ minHeight: 96, resize: 'vertical' }}
              placeholder="Tell us a little more"
              value={f.detail}
              onChange={(e) => setF({ ...f, detail: e.target.value })}
            />
          </Field>
        </FormSection>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="ip-toggle"
            data-on={f.callback}
            aria-pressed={f.callback}
            onClick={() => setF({ ...f, callback: !f.callback })}
          >
            <Phone size={16} /> Request a callback
            {f.callback && <Check size={16} />}
          </button>
          <button
            className="ip-btn ip-btn-primary"
            style={{ marginLeft: 'auto', flex: '0 1 180px' }}
            onClick={submit}
            disabled={busy || !f.subject.trim()}
          >
            {busy ? <Loader2 size={16} className="ip-spin" /> : <Send size={16} />} Send
          </button>
        </div>
      </Card>
    </div>
  );
}

// ===================== Profile =====================

function ProfileTab({ bump }: { bump: number }) {
  const { data, error } = useFetch<any>('/portal/me/insurance/profile', bump);
  const [f, setF] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !f) {
      const p = data.profile ?? {};
      setF({ phone: data.phone ?? '', family: p.family ?? [], vehicles: p.vehicles ?? [], nominees: p.nominees ?? [] });
    }
  }, [data, f]);

  if (error) {
    return (
      <Card>
        <EmptyState icon={UserRound} title="We could not load your details" body="Try again in a moment — nothing has changed on your record." />
      </Card>
    );
  }
  if (!data || !f) return <Skeleton rows={3} height={150} />;

  const save = async () => {
    setBusy(true);
    try {
      await portalApi('/portal/me/insurance/profile', {
        method: 'PATCH',
        body: JSON.stringify({ phone: f.phone, profile: { family: f.family, vehicles: f.vehicles, nominees: f.nominees } }),
      });
      toast.success('Saved — thank you for keeping this current');
    } catch { toast.error('Could not save'); }
    finally { setBusy(false); }
  };

  const listEditor = (
    title: string,
    description: string,
    emptyBody: string,
    icon: any,
    key: 'family' | 'vehicles' | 'nominees',
    fields: { k: string; label: string; ph: string }[],
  ) => (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14, flexWrap: 'wrap' }}>
        <EntityIcon icon={icon} tone="info" size="lg" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h2">{title}</div>
          <div className="ds-caption" style={{ marginTop: 3 }}>{description}</div>
        </div>
        <button
          className="ip-btn ip-btn-quiet"
          onClick={() => setF({ ...f, [key]: [...f[key], Object.fromEntries(fields.map((x) => [x.k, '']))] })}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {f[key].length === 0 ? (
        <EmptyState icon={icon} title="Nothing here yet" body={emptyBody} compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {f[key].map((row: any, i: number) => (
            <div key={i} className="ip-editor-row">
              {fields.map((x) => (
                <Field key={x.k} label={x.label}>
                  <input
                    className="input"
                    placeholder={x.ph}
                    value={row[x.k] ?? ''}
                    onChange={(e) => setF({ ...f, [key]: f[key].map((r: any, j: number) => (j === i ? { ...r, [x.k]: e.target.value } : r)) })}
                  />
                </Field>
              ))}
              <button
                className="ip-iconbtn"
                aria-label={`Remove ${title.toLowerCase()} entry ${i + 1}`}
                onClick={() => setF({ ...f, [key]: f[key].filter((_: any, j: number) => j !== i) })}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="ip-stack">
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
          <EntityIcon icon={UserRound} tone="sales" size="lg" />
          <div>
            <div className="ds-h2">Your details</div>
            <div className="ds-caption" style={{ marginTop: 3 }}>Keeping this current makes claims and renewals painless.</div>
          </div>
        </div>
        <FormSection title="Contact">
          <Field label="Name" hint="Ask your broker to correct your legal name.">
            <input className="input" value={data.name} disabled />
          </Field>
          <Field label="Email">
            <input className="input" value={data.email ?? ''} disabled />
          </Field>
          <Field label="Phone">
            <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
        </FormSection>
      </Card>

      {listEditor(
        'Family members', 'Who else lives under your cover.',
        'Add the people you would want on a health or travel policy.',
        Users, 'family',
        [{ k: 'name', label: 'Name', ph: 'Full name' }, { k: 'relation', label: 'Relation', ph: 'e.g. Spouse' }, { k: 'dob', label: 'Date of birth', ph: 'DD/MM/YYYY' }],
      )}

      {listEditor(
        'Vehicles', 'So motor renewals reach you before they lapse.',
        'Add a car or bike and we will keep an eye on its renewal date.',
        Car, 'vehicles',
        [{ k: 'registration', label: 'Registration', ph: 'Registration no.' }, { k: 'make', label: 'Make & model', ph: 'e.g. Honda City' }, { k: 'year', label: 'Year', ph: 'e.g. 2021' }],
      )}

      {listEditor(
        'Nominees', 'Who a life claim should be paid to.',
        'Naming a nominee now saves your family a great deal later.',
        ShieldCheck, 'nominees',
        [{ k: 'name', label: 'Name', ph: 'Full name' }, { k: 'relation', label: 'Relation', ph: 'e.g. Spouse' }, { k: 'sharePct', label: 'Share %', ph: 'e.g. 100' }],
      )}

      <div style={{ display: 'flex' }}>
        <button className="ip-btn ip-btn-primary" style={{ flex: '1 1 auto', maxWidth: 260, marginLeft: 'auto' }} onClick={save} disabled={busy}>
          {busy ? <Loader2 size={16} className="ip-spin" /> : <Check size={16} />} Save my details
        </button>
      </div>
    </div>
  );
}
