'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, Plus, X, Check, Ban, CheckCircle2, Copy, Search, Eye,
} from 'lucide-react';
import { platformApi, usePlatformAuth } from '@/features/platform/platform-client';
import { can } from '@/features/platform/capabilities';
import { apiErrorMessage } from '@/lib/api';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, boxShadow: 'var(--shadow-1)',
};
const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)',
};
/**
 * EVERY plan the schema has. The console listed three of the four.
 *
 * ENTERPRISE exists in the SubscriptionPlan enum and in PLAN_DEFAULTS at
 * ₹25,000, and three production tenants are on it — so the plan filter could
 * never find them, the create form could not provision one, and the drawer
 * showed three buttons with none of them selected. Pressing any of those
 * buttons moved a ₹25,000 tenant onto a cheaper plan with no way back through
 * the console. scripts/platform-console-offline.ts now reads the enum out of
 * schema.prisma and fails if this list falls behind it again.
 */
const PLANS = ['STARTER', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE'] as const;
const PAGE_SIZE = 25;
const PLAN_COLOR: Record<string, string> = { STARTER: 'var(--ink-2)', GROWTH: 'var(--gold)', PROFESSIONAL: 'var(--navy)', ENTERPRISE: 'var(--navy)' };

interface Institute {
  id: string; name: string; slug: string; email?: string; status: string; plan: string;
  subscriptionStatus: string; priceInr: number;
  trialEndsAt?: string | null; cancelledAt?: string | null;
  // Any OrgVertical key. It was typed as INSTITUTE | REAL_ESTATE | NONE — three
  // of the twenty-four the schema has — which is the same CRM-era assumption
  // that kept ERP and Practice tenants off this console.
  vertical?: string;
  crmEnabled?: boolean; erpEnabled?: boolean; practiceEnabled?: boolean; omniEnabled?: boolean;
  counts: { users: number; branches: number; courses: number; leads: number; students: number };
  onboarding: { percent: number; done: number; total: number; steps?: { key: string; label: string; done: boolean }[] };
  createdAt: string;
}

// Every vertical the schema actually has. The console offered two of them, so a
// solar, retail, insurance or car-rental client could not be onboarded here at
// all — you would create them as an "Institute" and fix it afterwards.
/**
 * PRODUCTS a tenant can hold. These are the four with a Subscription flag
 * behind them; PMS has no column — a hotel's entitlement is the vertical
 * itself — so it is not toggled here.
 */
const PRODUCTS = [
  { code: 'CRM', label: '🗂️ CRM' },
  { code: 'ERP', label: '📦 ERP' },
  { code: 'PRACTICE', label: '🩺 Practice' },
  { code: 'OMNI', label: '💬 Omni + AI' },
] as const;
type ProductCode = (typeof PRODUCTS)[number]['code'];

/**
 * The products a vertical implies.
 *
 * THE ENGINE IS INFERRED, NOT PICKED. An admin choosing "Restaurant" should not
 * also have to know that a restaurant is an ERP tenant, or that a clinic is a
 * PRACTICE one — that mapping is a fact about the platform, not a decision
 * about the client. Asking for both was how the console ended up offering CRM
 * and ERP side by side as if they competed.
 *
 * PMS (hotel) has no Subscription flag; its entitlement is the vertical itself,
 * so it contributes nothing to the product list and the server keeps the
 * vertical regardless.
 *
 * Omni is the one real CHOICE here: a shared inbox with channels and an AI
 * agent is orthogonal to the domain, and any vertical may or may not want it.
 */
function productsFor(vertical: string, omni: boolean): (ProductCode | 'PMS')[] {
  const driving = VERTICAL_META[vertical]?.product ?? null;
  // PMS sets no flag, but it must still be SENT: provisionTenant reads an empty
  // product list as a request for CRM, so a hotel sent with [] came back with
  // crmEnabled true.
  const domain: (ProductCode | 'PMS')[] = driving === null ? [] : [driving];
  return omni ? [...domain, 'OMNI'] : domain;
}
/** The engine label shown beside the vertical, so the inference is visible. */
function engineFor(vertical: string): string {
  const d = VERTICAL_META[vertical]?.product ?? null;
  if (d === null) return 'Omni-only — no domain modules';
  if (d === 'PMS') return 'Hotel PMS';
  return PRODUCTS.find((p) => p.code === d)?.label.replace(/^\S+\s/, '') ?? d;
}

/**
 * `product` is the vertical's DRIVING product and must match
 * `apps/api/src/common/verticals.ts`, which is the source of truth —
 * `platform-products-offline.ts` fails if the two disagree.
 *
 * It matters because the platform is not CRM-only: a restaurant is driven by
 * ERP and a clinic by PRACTICE. Without this the console could only offer CRM,
 * and unticking it moved the tenant to NONE, which hides the whole sidebar.
 */
const VERTICAL_META: Record<string, { label: string; icon: string; product: ProductCode | 'PMS' | null }> = {
  NONE: { label: 'Omni-only', icon: '💬', product: null },
  INSTITUTE: { label: 'Institute', icon: '🎓', product: 'CRM' },
  STUDY_ABROAD: { label: 'Study Abroad', icon: '✈️', product: 'CRM' },
  REAL_ESTATE: { label: 'Real Estate', icon: '🏢', product: 'CRM' },
  SOLAR: { label: 'Solar', icon: '☀️', product: 'CRM' },
  INSURANCE: { label: 'Insurance Broking', icon: '🛡️', product: 'CRM' },
  COWORKING: { label: 'Coworking Space', icon: '🪑', product: 'CRM' },
  POULTRY: { label: 'Poultry Farming', icon: '🐔', product: 'ERP' },
  RETAIL: { label: 'Retail', icon: '🛍️', product: 'ERP' },
  SUPERMARKET: { label: 'Supermarket', icon: '🧺', product: 'ERP' },
  ECOMMERCE: { label: 'E-commerce', icon: '📦', product: 'ERP' },
  RESTAURANT: { label: 'Restaurant', icon: '🍽️', product: 'ERP' },
  HOTEL: { label: 'Hotel', icon: '🏨', product: 'PMS' },
  TRAVEL: { label: 'Travel', icon: '🧳', product: 'CRM' },
  USED_CAR: { label: 'Used Cars', icon: '🚗', product: 'ERP' },
  CAR_RENTAL: { label: 'Car Rental', icon: '🔑', product: 'ERP' },
  CLINIC: { label: 'Clinic', icon: '🩺', product: 'PRACTICE' },
  DENTAL: { label: 'Dental', icon: '🦷', product: 'PRACTICE' },
  DERMATOLOGY: { label: 'Dermatology', icon: '🧴', product: 'PRACTICE' },
  OPTOMETRY: { label: 'Optometry', icon: '👓', product: 'PRACTICE' },
  DIAGNOSTIC_LAB: { label: 'Diagnostic Lab', icon: '🧪', product: 'PRACTICE' },
  PHARMACY: { label: 'Pharmacy', icon: '💊', product: 'ERP' },
  LEGAL: { label: 'Legal', icon: '⚖️', product: 'CRM' },
  CONSULTING: { label: 'Consulting', icon: '📊', product: 'CRM' },
  DIGITAL_AGENCY: { label: 'Digital Agency', icon: '🎨', product: 'CRM' },
};

// Country sets currency, tax regime and locale for the life of the tenant, and
// money formatting is org-aware everywhere. Picking it wrong at creation shows a
// Dubai client their revenue in rupees.
const COUNTRIES = [
  { code: 'IN', label: 'India', hint: 'INR · GST' },
  { code: 'AE', label: 'UAE', hint: 'AED · VAT' },
  { code: 'SA', label: 'Saudi Arabia', hint: 'SAR · VAT' },
  { code: 'US', label: 'United States', hint: 'USD · no tax regime' },
];

/**
 * Every product the tenant holds. It showed only CRM and Omni, so a restaurant
 * or a clinic looked like it had nothing — the row said "CRM" or said nothing
 * at all, for a tenant whose whole product IS ERP.
 */
function ProductBadges(p: { crm?: boolean; omni?: boolean; erp?: boolean; practice?: boolean }) {
  const held: Array<[boolean | undefined, string, boolean]> = [
    [p.crm, 'CRM', false], [p.erp, 'ERP', false], [p.practice, 'Practice', false], [p.omni, 'Omni', true],
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {held.filter(([on]) => on).map(([, label, brand]) => (
        <span key={label} className="badge"
          style={brand
            ? { background: 'var(--brand-bg,#eef1fb)', color: 'var(--navy)' }
            : { background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{label}</span>
      ))}
    </div>
  );
}

function inr(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

export default function PlatformConsole() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [billing, setBilling] = useState('');
  const [endedOnly, setEndedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const role = usePlatformAuth((s) => s.admin?.role);

  // `enabled` is the whole point. /stats is SUPER_ADMIN only, and this query
  // ran unconditionally — so every ONBOARDING and SUPPORT session opened the
  // console with a 403 in the network log and four KPI cards reading "—".
  const canStats = can(role, 'stats');
  const { data: stats } = useQuery({
    enabled: canStats,
    queryKey: ['pf-stats'],
    queryFn: async () => (await platformApi.get('/stats')).data as { total: number; active: number; suspended: number; byPlan: Record<string, number>; mrr: number },
  });
  // PAGE, STATUS AND PLAN, all of which the endpoint has always supported and
  // none of which the console used. It asked for `limit=50` and rendered
  // whatever came back — so the fifty-first organisation was invisible, with
  // nothing on screen admitting a cut-off had happened, and "show me the
  // suspended ones" was unanswerable from a page whose own KPI counts them.
  const { data: list } = useQuery({
    enabled: can(role, 'organizations.view'),
    queryKey: ['pf-institutes', search, status, planFilter, billing, endedOnly, page],
    queryFn: async () => {
      const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) q.set('search', search);
      if (status) q.set('status', status);
      if (planFilter) q.set('plan', planFilter);
      if (billing) q.set('subscriptionStatus', billing);
      if (endedOnly) q.set('trialEnded', 'true');
      return (await platformApi.get(`/institutes?${q}`)).data as {
        data: Institute[]; meta: { page: number; limit: number; total: number; totalPages: number };
      };
    },
  });
  const meta = list?.meta;

  const canCreate = can(role, 'organizations.create');
  /** Any filter change returns to the first page; page 3 of a narrower result is empty. */
  const refine = (fn: () => void) => { fn(); setPage(1); };
  const kpis = [
    { label: 'Organisations', value: stats?.total ?? '—' },
    { label: 'Active', value: stats?.active ?? '—' },
    { label: 'Suspended', value: stats?.suspended ?? '—' },
    { label: 'MRR', value: stats ? inr(stats.mrr) : '—' },
  ];

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          {/* The last of the console's single-vertical vocabulary. This list
              holds hotels, clinics, restaurants and brokers; naming them all
              after one vertical made the screen read as the wrong product. */}
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Organisations</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            {canCreate
              ? 'Provision, onboard and manage tenant organisations.'
              : 'Find an organisation and inspect its plan, products and onboarding state.'}
          </p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New organisation</button>
        )}
      </div>

      {canStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ ...card, padding: '16px 18px' }}>
              <div style={mono}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search organisations…"
            value={search} onChange={(e) => refine(() => setSearch(e.target.value))} />
        </div>
        <select className="input" style={{ maxWidth: 170 }} value={status}
          onChange={(e) => refine(() => setStatus(e.target.value))}>
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select className="input" style={{ maxWidth: 170 }} value={planFilter}
          onChange={(e) => refine(() => setPlanFilter(e.target.value))}>
          <option value="">Any plan</option>
          {PLANS.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
        </select>
        {/* ACCESS above, COMMERCIAL here. Two selects because they are two
            questions, and an operator asking "who is past due" is not asking
            "who is locked out". */}
        <select className="input" style={{ maxWidth: 170 }} value={billing}
          onChange={(e) => refine(() => { setBilling(e.target.value); setEndedOnly(false); })}>
          <option value="">Any billing</option>
          {BILLING.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={endedOnly}
            onChange={(e) => refine(() => { setEndedOnly(e.target.checked); setBilling(''); })} />
          Trial ended
        </label>
        {(search || status || planFilter || billing || endedOnly) && (
          <button className="btn-secondary" style={{ height: 38 }}
            onClick={() => refine(() => { setSearch(''); setStatus(''); setPlanFilter(''); setBilling(''); setEndedOnly(false); })}>
            Clear
          </button>
        )}
        {/* The count the list is a window onto. Saying it out loud is what
            stops a truncated page from reading as the whole book. */}
        {meta && (
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-3)' }}>
            {meta.total === 0 ? 'No matches'
              : `${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}
          </span>
        )}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr 1fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line-soft)', ...mono }}>
          <div>Organisation</div><div>Plan</div><div>Status</div><div>Onboarding</div><div style={{ textAlign: 'right' }}>Users</div>
        </div>
        {list?.data.map((o) => (
          <div key={o.id} onClick={() => setDetailId(o.id)} className="pf-row"
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr 1fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', flexShrink: 0 }}><Building2 size={17} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{o.email ?? o.slug}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span className="badge" style={{ background: 'var(--surface-2)', color: PLAN_COLOR[o.plan], alignSelf: 'flex-start' }}>{o.plan}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{VERTICAL_META[o.vertical ?? 'INSTITUTE']?.icon} {VERTICAL_META[o.vertical ?? 'INSTITUTE']?.label}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
              <ProductBadges crm={o.crmEnabled} erp={o.erpEnabled} practice={o.practiceEnabled} omni={o.omniEnabled} />
              <StatusPill status={o.status} />
              {/* The billing status was already in this payload and was never
                  drawn, so "who is still on a trial" could not be answered from
                  the list — on production that is 11 of 14 tenants. It is a
                  different question from the ACCESS status above, which is why
                  it gets its own quieter mark rather than sharing that pill. */}
              {/* Amber, never red: an ended trial is something to look at, not
                  a tenant that has been cut off. Red is reserved for the access
                  pill above, which is the only thing that stops anyone working. */}
              <span style={{ fontSize: 11, color: o.subscriptionStatus === 'ACTIVE' ? 'var(--ink-3)' : 'var(--gold)' }}>
                {o.subscriptionStatus === 'ACTIVE'
                  ? 'Billing active'
                  : billingLabel(o.subscriptionStatus)}
                {trialEnded(o) && o.trialEndsAt && ` · ended ${daysAgo(o.trialEndsAt)}d ago`}
              </span>
            </div>
            <div><Progress percent={o.onboarding.percent} /></div>
            <div style={{ textAlign: 'right', fontWeight: 600 }}>{o.counts.users}</div>
          </div>
        ))}
        {list?.data.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No organisations found.</div>}
      </div>

      {meta && meta.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, fontSize: 13 }}>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ color: 'var(--ink-3)' }}>Page {meta.page} of {meta.totalPages}</span>
          <button className="btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {createOpen && <CreateOrganisationModal onClose={() => setCreateOpen(false)} />}
      {detailId && <OrganisationDrawer id={detailId} onClose={() => setDetailId(null)} />}
      <style>{`.pf-row:hover{background:var(--surface-2);}`}</style>
    </div>
  );
}

/**
 * The five SubscriptionStatus values, in words.
 *
 * COMMERCIAL standing, which is not access. Nothing in the platform enforces
 * any of them — an organisation is reachable or not according to its own
 * status, and these five say what the business has recorded about the
 * relationship. The console must never let the two read as one thing.
 */
const BILLING = [
  { key: 'TRIALING', label: 'On trial', note: 'Evaluating. No commercial agreement yet.' },
  { key: 'ACTIVE', label: 'Active', note: 'A commercial relationship exists.' },
  { key: 'PAST_DUE', label: 'Past due', note: 'An invoice is outstanding. A flag for us, not a lever — access is unaffected.' },
  { key: 'CANCELLED', label: 'Cancelled', note: 'The customer ended the relationship. This does NOT close their workspace.' },
  { key: 'EXPIRED', label: 'Expired', note: 'The trial ended and nothing followed.' },
] as const;
function billingLabel(s: string) {
  return BILLING.find((b) => b.key === s)?.label ?? s;
}
/** A trial whose end date has passed. Still TRIALING — this is a fact about the
 *  date, and deliberately not a status. */
function trialEnded(o: { subscriptionStatus: string; trialEndsAt?: string | null }) {
  return o.subscriptionStatus === 'TRIALING' && !!o.trialEndsAt && new Date(o.trialEndsAt) < new Date();
}
function daysAgo(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return <span className="badge" style={{ background: active ? 'var(--success-bg)' : 'var(--danger-bg)', color: active ? 'var(--success)' : 'var(--danger)' }}>{active ? 'Active' : 'Suspended'}</span>;
}

function Progress({ percent }: { percent: number }) {
  const color = percent === 100 ? 'var(--success)' : percent >= 50 ? 'var(--gold)' : 'var(--navy)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', maxWidth: 90 }}>
        <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
    </div>
  );
}

function CreateOrganisationModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ organizationName: '', ownerFirstName: '', ownerLastName: '', ownerEmail: '', phone: '', plan: 'GROWTH', country: 'IN' });
  const [omni, setOmni] = useState(false);
  const [vertical, setVertical] = useState<string>('INSTITUTE');
  const [result, setResult] = useState<{ name: string; owner: { email: string }; tempPassword: string } | null>(null);
  // The vertical is kept by its DRIVING product, not by CRM. A restaurant is an
  // ERP tenant and a clinic a PRACTICE one; requiring CRM for either is what
  // made those verticals unreachable from this console.
  /**
   * Which verticals the chosen products can actually drive.
   *
   * Selecting ERP used to hide the vertical picker entirely, because the picker
   * was gated on the CURRENTLY SELECTED vertical still being valid — and it
   * defaults to Institute, which is CRM-driven. So the admin picked ERP and the
   * form said "Omni-only", with Restaurant still unreachable. The list follows
   * the products now, and the selection is corrected when it falls out of it.
   *
   * HOTEL is included whenever any domain product is held: PMS has no
   * Subscription flag, so its entitlement is the vertical itself.
   */
  const products = productsFor(vertical, omni);

  const create = useMutation({
    mutationFn: () => platformApi.post('/tenants', { ...form, products, vertical }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['pf-institutes'] }); qc.invalidateQueries({ queryKey: ['pf-stats'] }); setResult(r.data); toast.success('Organisation created'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const chip = (on: boolean): React.CSSProperties => ({ flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600, border: '1px solid ' + (on ? 'var(--navy)' : 'var(--line)'), background: on ? 'var(--brand-bg,#eef1fb)' : 'var(--surface)', color: on ? 'var(--navy)' : 'var(--ink-2)' });

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>New tenant</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Provision a client workspace + owner account.</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
      </div>

      {result ? (
        <div>
          <div style={{ background: 'var(--success-bg)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{result.name} is ready 🎉</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 4 }}>Owner: {result.owner.email}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 8 }}>Share this one-time temporary password:</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{ flex: 1, fontSize: 13, background: 'var(--surface)', padding: '8px 10px', borderRadius: 8 }}>{result.tempPassword}</code>
              <button className="btn-secondary" style={{ height: 36 }} onClick={() => { navigator.clipboard.writeText(result.tempPassword); toast.success('Copied'); }}><Copy size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Vertical</label>
            <select className="input" value={vertical} onChange={(e) => setVertical(e.target.value)}>
              {Object.entries(VERTICAL_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
              Drives the whole nav and vocabulary. Awkward to change once there is data.
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--surface-2)', padding: '9px 11px', borderRadius: 9 }}>
            Modules: <strong>{engineFor(vertical)}</strong>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
              Set by the vertical — a restaurant gets the commerce modules, a clinic the practice ones.
            </div>
          </div>
          <div>
            <label className="label">Add-on</label>
            <div style={chip(omni)} onClick={() => setOmni(!omni)}>💬 Omni + AI — shared inbox, channels, agent</div>
          </div>
          <div><label className="label">Workspace name</label><input className="input" value={form.organizationName} onChange={set('organizationName')} placeholder="e.g. Sunrise Coaching" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">Owner first name</label><input className="input" value={form.ownerFirstName} onChange={set('ownerFirstName')} /></div>
            <div><label className="label">Owner last name</label><input className="input" value={form.ownerLastName} onChange={set('ownerLastName')} /></div>
          </div>
          <div><label className="label">Owner email</label><input className="input" type="email" value={form.ownerEmail} onChange={set('ownerEmail')} placeholder="owner@example.com" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
            <div><label className="label">Plan</label>
              <select className="input" value={form.plan} onChange={set('plan')}>{PLANS.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</select>
            </div>
          </div>
          <div>
            <label className="label">Country</label>
            <select className="input" value={form.country} onChange={set('country')}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label} — {c.hint}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
              Sets currency, tax regime and date/number formatting for this tenant.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!form.organizationName.trim() || !form.ownerEmail.trim() || products.length === 0 || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create tenant'}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function OrganisationDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const role = usePlatformAuth((s) => s.admin?.role);
  // Four controls used to render for everyone — plan, vertical, Omni, suspend —
  // and only SUPER_ADMIN could press any of them. A button that 403s on click
  // is worse than an absent one: it tells the operator the action exists and
  // then blames them for trying it.
  const canPlan = can(role, 'organizations.plan');
  const canProducts = can(role, 'organizations.products');
  const canStatus = can(role, 'organizations.status');
  // Commercial standing rides with the other SUPER_ADMIN commercial controls.
  const canBilling = can(role, 'organizations.plan');
  const readOnly = !canPlan && !canProducts && !canStatus;
  const { data } = useQuery({
    queryKey: ['pf-institute', id],
    queryFn: async () => (await platformApi.get(`/institutes/${id}`)).data as any,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pf-institute', id] });
    qc.invalidateQueries({ queryKey: ['pf-institutes'] });
    qc.invalidateQueries({ queryKey: ['pf-stats'] });
  };
  const setPlan = useMutation({
    mutationFn: (plan: string) => platformApi.patch(`/institutes/${id}/plan`, { plan }),
    onSuccess: () => { invalidate(); toast.success('Plan updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const setStatus = useMutation({
    mutationFn: (status: string) => platformApi.patch(`/institutes/${id}/status`, { status }),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  // Whether the audit store exists here. The status field IS the record of a
  // commercial decision — unlike a suspension, whose effect is visible in the
  // product — so recording one on an environment with no audit table loses the
  // actor, the time and the reason, permanently and silently. Asked only for
  // the role that can actually record one.
  const { data: auditProbe } = useQuery({
    enabled: canBilling,
    queryKey: ['pf-audit-available'],
    queryFn: async () => (await platformApi.get('/audit?take=1')).data as { available?: boolean },
  });
  const auditMissing = auditProbe?.available === false;
  const [billingDraft, setBillingDraft] = useState<string | null>(null);
  const [billingReason, setBillingReason] = useState('');
  const setBilling = useMutation({
    mutationFn: (v: { status: string; reason?: string }) =>
      platformApi.patch(`/institutes/${id}/subscription-status`, v),
    onSuccess: () => {
      invalidate(); qc.invalidateQueries({ queryKey: ['pf-audit'] });
      setBillingDraft(null); setBillingReason('');
      toast.success('Billing status recorded');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const setProducts = useMutation({
    mutationFn: (body: { products: string[]; vertical?: string }) => platformApi.patch(`/institutes/${id}/products`, body),
    onSuccess: () => { invalidate(); toast.success('Products updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  /** What the tenant holds today, read from the four subscription flags. */
  /**
   * The engine follows the vertical; only Omni is a separate choice.
   *
   * Changing the vertical therefore changes the modules, which is why it warns.
   * Moving a tenant to "Omni-only" is the deliberate way to take the domain
   * modules away — no data is deleted either way.
   */
  const applyVertical = (nextVertical: string) => {
    setProducts.mutate({
      products: productsFor(nextVertical, !!data.omniEnabled),
      vertical: nextVertical,
    });
  };
  const applyOmni = (next: boolean) => {
    setProducts.mutate({
      products: productsFor(data.vertical ?? 'NONE', next),
      vertical: data.vertical ?? 'NONE',
    });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 440, maxWidth: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-24px 0 60px rgba(0,0,0,.14)', animation: 'slideIn .3s cubic-bezier(.2,.8,.2,1)', overflowY: 'auto' }}>
        {!data ? <div style={{ padding: 24, color: 'var(--ink-3)' }}>Loading…</div> : (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}><Building2 size={22} /></span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{data.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                    {data.owner
                      ? `${data.owner.firstName} ${data.owner.lastName ?? ''} · ${data.owner.email}`
                      : /* Not a cosmetic blank: an organisation with no Owner has
                           nobody holding subscription.manage and cannot manage
                           itself. Saying so beats quietly showing the slug. */
                      <span style={{ color: 'var(--danger)' }}>No Owner account · {data.slug}</span>}
                    {data.owner && data.owner.status !== 'ACTIVE' && (
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        {' '}· owner is {String(data.owner.status).toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
            </div>

            {/* Say it once, at the top, rather than leaving someone to work it
                out from the absence of buttons further down. */}
            {readOnly && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12.5, color: 'var(--ink-2)' }}>
                <Eye size={15} style={{ flexShrink: 0 }} /> Read-only. Your role can inspect this organisation but not change it.
              </div>
            )}

            {/* Status is a fact about the tenant, not a control — everyone who
                can open this needs to see it, including the roles that cannot
                change it. It was only ever legible from the button at the end. */}
            <div style={{ ...card, padding: '13px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={mono}>Status</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5 }}>
                  {data.status === 'ACTIVE'
                    ? 'Staff and portal sign-in are working.'
                    : 'Staff and portal access are blocked. No tenant data has been removed.'}
                </div>
              </div>
              <StatusPill status={data.status} />
            </div>

            {/* Onboarding checklist */}
            <div style={{ ...card, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={mono}>Onboarding</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: data.onboarding.percent === 100 ? 'var(--success)' : 'var(--gold)' }}>{data.onboarding.percent}%</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.onboarding.steps.map((s: any) => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: s.done ? 'var(--success)' : 'var(--surface-2)', color: '#fff' }}>
                      {s.done && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span style={{ fontSize: 13.5, color: s.done ? 'var(--ink)' : 'var(--ink-3)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Counts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              {[['Users', data.counts.users], ['Courses', data.counts.courses], ['Leads', data.counts.leads], ['Students', data.counts.students], ['Branches', data.counts.branches], ['Since', new Date(data.createdAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })]].map(([l, v]) => (
                <div key={l as string} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12 }}>
                  <div style={mono}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{v as any}</div>
                </div>
              ))}
            </div>

            {/* Vertical drives the modules; Omni is the one add-on.
                Shown to every role because it describes the tenant; only
                EDITABLE for the role the guard admits. */}
            <div style={{ ...card, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={mono}>Vertical &amp; modules</div>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{engineFor(data.vertical ?? 'NONE')}</span>
              </div>
              {canProducts ? (
                <>
                  <select className="input" value={data.vertical ?? 'NONE'} disabled={setProducts.isPending}
                    onChange={(e) => applyVertical(e.target.value)}>
                    {Object.entries(VERTICAL_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                    The vertical sets the modules. Changing it changes the nav and vocabulary; no data is deleted.
                  </div>
                  <button onClick={() => applyOmni(!data.omniEnabled)} disabled={setProducts.isPending}
                    style={{ width: '100%', marginTop: 10, height: 38, borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: '1px solid ' + (data.omniEnabled ? 'var(--navy)' : 'var(--line)'), background: data.omniEnabled ? 'var(--navy)' : 'var(--surface)', color: data.omniEnabled ? '#fff' : 'var(--ink-2)' }}>
                    💬 Omni + AI {data.omniEnabled ? '· on' : '· off'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {VERTICAL_META[data.vertical ?? 'NONE']?.icon} {VERTICAL_META[data.vertical ?? 'NONE']?.label ?? data.vertical}
                  </span>
                  <ProductBadges crm={data.crmEnabled} erp={data.erpEnabled} practice={data.practiceEnabled} omni={data.omniEnabled} />
                </div>
              )}
            </div>

            {/* Subscription facts.
                Every field here was already in the /institutes/:id response and
                none of it was rendered — so "is this tenant on a trial, and
                when does it end" was a question the console could not answer
                despite holding the answer. Read-only for every role, because
                it describes the tenant rather than changing it, and it is the
                first thing support is asked. Nothing is computed: these are
                the stored values. */}
            {data.subscription && (
              <div style={{ ...card, padding: 16, marginBottom: 16 }}>
                <div style={{ ...mono, marginBottom: 12 }}>Subscription</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <Fact label="Billing status" value={billingLabel(data.subscription.status)} />
                  <Fact label="Seats" value={String(data.subscription.seats)} />
                  <Fact label="Price" value={`₹${data.subscription.priceInr.toLocaleString('en-IN')}/mo`} />
                  {/* Only a TRIALING subscription has a trial end.
                      provisionTenant writes trialEndsAt for every tenant and
                      createInstitute then flips the status to ACTIVE without
                      clearing it, so an admin-provisioned tenant carries a date
                      that never meant anything — and this panel was announcing
                      it as "Trial ends" to an organisation that was never on a
                      trial. Read the status, not the leftover column. */}
                  <Fact
                    label={data.subscription.status === 'TRIALING' ? 'Trial ends' : 'Renews'}
                    value={date(data.subscription.status === 'TRIALING'
                      ? data.subscription.trialEndsAt
                      : data.subscription.currentPeriodEnd)}
                  />
                  <Fact label="Owner last signed in" value={date(data.owner?.lastLoginAt) === '—' ? 'Never' : date(data.owner?.lastLoginAt)} />
                  {/* Cancellation and suspension are separate facts and both are
                      shown when both are true. A tenant can be cancelled and
                      still working, or suspended and still paying. */}
                  {data.subscription.cancelledAt && (
                    <Fact label="Cancelled" value={date(data.subscription.cancelledAt)} />
                  )}
                </div>

                {data.subscription.status === 'TRIALING' && data.subscription.trialEndsAt
                  && new Date(data.subscription.trialEndsAt) < new Date() && (
                    <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                      This trial ended {Math.floor((Date.now() - new Date(data.subscription.trialEndsAt).getTime()) / 86400000)} days
                      ago and nothing has changed automatically. The workspace is still open — someone needs to decide what this relationship became.
                    </div>
                  )}

                {canBilling && (
                  <div style={{ marginTop: 14, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
                    <div style={{ ...mono, marginBottom: 8 }}>Record billing status</div>
                    {auditMissing && (
                      <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12, lineHeight: 1.55 }}>
                        <b>No audit trail on this environment.</b> The status will change, but
                        who changed it and why will not be kept &mdash; and for a commercial
                        decision that record is the only trace there is.
                      </div>
                    )}
                    {/* An inline form rather than a confirm dialog: the
                        consequence of the chosen state stays on screen while
                        the operator decides, instead of appearing in a box they
                        dismiss to get on with it. Cancelled is the one that
                        could be mistaken for closing a workspace, and it is
                        exactly the one they need to be reading when they
                        press the button. */}
                    <select
                      className="input"
                      value={billingDraft ?? data.subscription.status}
                      disabled={setBilling.isPending}
                      onChange={(e) => setBillingDraft(e.target.value)}>
                      {BILLING.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                    </select>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.55 }}>
                      {BILLING.find((b) => b.key === (billingDraft ?? data.subscription.status))?.note}
                    </div>
                    {billingDraft && billingDraft !== data.subscription.status && (
                      <>
                        <input
                          className="input"
                          style={{ marginTop: 10 }}
                          placeholder="Why? (optional — kept in the audit log)"
                          value={billingReason}
                          maxLength={300}
                          onChange={(e) => setBillingReason(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button className="btn-secondary" style={{ flex: 1 }}
                            onClick={() => { setBillingDraft(null); setBillingReason(''); }}>
                            Cancel
                          </button>
                          <button className="btn-primary" style={{ flex: 1 }} disabled={setBilling.isPending}
                            onClick={() => setBilling.mutate({ status: billingDraft, reason: billingReason || undefined })}>
                            {setBilling.isPending ? 'Recording…' : `Record as ${billingLabel(billingDraft)}`}
                          </button>
                        </div>
                      </>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
                      Commercial standing only. This does not change anyone's access &mdash;
                      suspending the organisation is the separate control above.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Plan */}
            <div style={{ ...card, padding: 16, marginBottom: 16 }}>
              <div style={{ ...mono, marginBottom: 10 }}>Plan</div>
              {canPlan ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {PLANS.map((p) => (
                    <button key={p} onClick={() => setPlan.mutate(p)} disabled={setPlan.isPending}
                      style={{ height: 38, borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1px solid var(--line)', background: data.plan === p ? 'var(--navy)' : 'var(--surface)', color: data.plan === p ? '#fff' : 'var(--ink-2)' }}>
                      {p[0] + p.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="badge" style={{ background: 'var(--surface-2)', color: PLAN_COLOR[data.plan] }}>{data.plan}</span>
              )}
            </div>

            {/* Suspension. Suspending blocks access; it does not remove
                anything, and the confirmation now says so — Step 4 enforces it
                across the staff workspace AND every portal, which is a bigger
                thing to do by accident than "its users will be locked out"
                suggested. */}
            {canStatus && (data.status === 'ACTIVE' ? (
              <button className="btn-secondary" style={{ width: '100%', color: 'var(--danger)' }}
                onClick={() => confirm(
                  `Suspend ${data.name}?\n\nEveryone in this organisation is signed out immediately — staff and student, guardian or customer portals alike — and new sign-ins are refused until it is reactivated.\n\nNo tenant data is changed or deleted.`,
                ) && setStatus.mutate('SUSPENDED')}>
                <Ban size={15} /> Suspend organisation
              </button>
            ) : (
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => setStatus.mutate('ACTIVE')}>
                <CheckCircle2 size={15} /> Reactivate organisation
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** A stored value, shown as it is. No derivation, no rounding, no invention. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/** An absent date is "—", never today's. */
function date(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 24, borderRadius: 18, maxHeight: '90vh', overflowY: 'auto' }}>{children}</div>
    </div>
  );
}
