'use client';

/**
 * Insurance → Insurer record page.
 *
 * Same master-detail idiom as the client and claim records: an identity header,
 * a summary strip of the four numbers that describe the relationship, a linkable
 * `?tab=` rail and a two-column body whose right rail keeps the facts on screen.
 *
 * Backed by `GET /insurance/companies/:id`, which returns the insurer, its
 * product catalogue enriched with what was actually written on each product,
 * and its slice of the same per-insurer numbers the Companies report shows —
 * one calculation, so the table and this page can never disagree.
 *
 * Contacts is deliberately thin: the schema stores exactly one contact name,
 * phone and email on InsuranceCompany. The tab says so rather than drawing an
 * empty contacts table that implies a feature nobody built.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  AlertTriangle, ArrowLeft, Building2, Check, ChevronRight, Coins, FileText,
  Mail, Package, Percent, Phone, ShieldAlert, ShieldCheck, User2, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import {
  Badge, BarList, Card, DataTable, EmptyState, EntityIcon, Skeleton, StatCard,
  humanStatus, toneForPolicyStatus, useIsNarrow,
} from '../ui/kit';
import type { DataTableColumn, Tone } from '../ui/kit';
import type { CompanyPerformanceRow } from './analytics';

const money = (n?: number | null) => fmtOrgMoney(n);
const pct = (n?: number | null) => (n === null || n === undefined ? '—' : `${n}%`);
const count = (n: number) => n.toLocaleString();
const sharePct = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100));

const fmtDate = (d?: string | Date | null) =>
  d == null ? '—' : new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

const TABS = ['Overview', 'Products', 'Performance', 'Contacts'] as const;
type Tab = (typeof TABS)[number];

interface InsurerProductRow {
  id: string;
  name: string;
  category: string | null;
  commissionRatePct: number | null;
  execRatePct: number | null;
  active: boolean;
  inCatalogue: boolean;
  policies: number;
  premiumInr: number;
}

interface InsurerDetail {
  id: string;
  name: string;
  code?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  branch?: string | null;
  active: boolean;
  createdAt: string;
  products: InsurerProductRow[];
  performance: CompanyPerformanceRow;
  shareOfBook: { premiumPct: number | null; policiesPct: number | null };
  recentPolicies: {
    id: string; policyNo: string; productName: string; category: string;
    premiumInr: number; sumInsuredInr: number; status: string;
    startDate: string; endDate: string; client: { id: string; name: string } | null;
  }[];
}

/* ------------------------------------------------------------ small pieces */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span className="ds-list-row-meta" style={{ color: 'var(--ink)' }}>{value ?? '—'}</span>
    </div>
  );
}

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 'var(--s-3)' }}>
      <h2 className="ds-h2">{children}</h2>
      {sub && <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>{sub}</div>}
    </div>
  );
}

/** Same contract as the reports screen: a breakdown states what it adds up to. */
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

/* ------------------------------------------------------------ screen */

export function InsuranceInsurerDetail({ id }: { id: string }) {
  // The insurer master was create-only: a name mistyped when the panel was set
  // up stayed on every policy card for good, and there was no way to take an
  // insurer off new business without deleting the history with them.
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState({ name: '', code: '', contactName: '', phone: '', email: '', branch: '' });

  const params = useSearchParams();
  const narrow = useIsNarrow(900);

  const raw = params?.get('tab') ?? '';
  const tab: Tab = TABS.find((t) => t.toLowerCase() === raw.toLowerCase()) ?? 'Overview';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ins-company', id],
    queryFn: async () => (await api.get<InsurerDetail>(`/insurance/companies/${id}`)).data,
  });

  const qc = useQueryClient();
  const saveInsurer = useMutation({
    mutationFn: (patch: any) => api.patch(`/insurance/companies/${id}`, patch),
    onSuccess: () => {
      toast.success('Insurer updated');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['ins-insurer', id] });
      qc.invalidateQueries({ queryKey: ['ins-companies'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) {
    return (
      <div className="ds-stack" style={{ gap: 'var(--s-5)' }}>
        <Skeleton rows={1} height={72} />
        <Skeleton rows={1} height={104} />
        <Skeleton rows={3} height={92} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <EmptyState
          icon={ShieldAlert}
          title="We couldn't open this insurer"
          body={isError ? apiErrorMessage(error) : 'This insurer no longer exists, or it belongs to another organisation.'}
        />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link href="/insurance/insurers" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Back to insurers
          </Link>
        </div>
      </Card>
    );
  }

  const p = data.performance;
  const products = data.products ?? [];
  const counts: Partial<Record<Tab, number>> = { Products: products.length || undefined };
  const identifiers = [data.code, data.branch].filter(Boolean).join(' · ');

  return (
    <div className="ds-stack" style={{ gap: 'var(--s-5)' }}>
      {/* ---------------------------------------------------- record header */}
      <div className="ds-stack" style={{ gap: 'var(--s-3)' }}>
        <div>
          <Link href="/insurance/insurers" className="ds-viewall" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={14} /> All insurers
          </Link>
        </div>

        <div className="ds-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <EntityIcon icon={Building2} tone="info" size="lg" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ds-row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
              <h1 className="ds-h1">{data.name}</h1>
              <Badge tone={data.active ? 'active' : 'neutral'}>{data.active ? 'On the panel' : 'Inactive'}</Badge>
            </div>
            <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
              {identifiers || 'No insurer code or branch on file'} · on the panel since {fmtDate(data.createdAt)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary btn-sm"
              onClick={() => {
                setEditing(true);
                setEf({
                  name: data.name ?? '', code: data.code ?? '', contactName: (data as any).contactName ?? '',
                  phone: (data as any).phone ?? '', email: (data as any).email ?? '', branch: data.branch ?? '',
                });
              }}
            >
              <Pencil size={13} /> Edit insurer
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={saveInsurer.isPending}
              title={data.active ? 'Stop offering this insurer on new business' : 'Put this insurer back on the panel'}
              onClick={() => saveInsurer.mutate({ active: !data.active })}
            >
              {data.active ? 'Take off the panel' : 'Put back on the panel'}
            </button>
            <Link
              href="/insurance/reports?view=companies"
              className="btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Compare insurers <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {editing && (
        <Card>
          <div className="ds-h3" style={{ marginBottom: 'var(--s-3)' }}>Edit insurer</div>
          <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'var(--s-3)' }}>
            <div><label className="label">Name</label><input className="input" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} /></div>
            <div><label className="label">Insurer code</label><input className="input" value={ef.code} onChange={(e) => setEf({ ...ef, code: e.target.value })} /></div>
            <div><label className="label">Branch</label><input className="input" value={ef.branch} onChange={(e) => setEf({ ...ef, branch: e.target.value })} /></div>
            <div><label className="label">Contact name</label><input className="input" value={ef.contactName} onChange={(e) => setEf({ ...ef, contactName: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)', justifyContent: 'flex-end', marginTop: 'var(--s-3)' }}>
            <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn-primary btn-sm" disabled={saveInsurer.isPending || !ef.name.trim()} onClick={() => saveInsurer.mutate(ef)}>
              {saveInsurer.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------- summary strip */}
      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        <StatCard label="Policies placed" value={count(p.policies)} icon={FileText} tone="neutral"
          deltaLabel={data.shareOfBook.policiesPct != null ? `${data.shareOfBook.policiesPct}% of the book` : undefined} />
        <StatCard label="Premium written" value={money(p.premiumInr)} icon={ShieldCheck} tone="info"
          deltaLabel={data.shareOfBook.premiumPct != null ? `${data.shareOfBook.premiumPct}% of GWP` : undefined} />
        <StatCard label="Brokerage earned" value={money(p.brokerageInr)} icon={Wallet} tone="sales" />
        <StatCard label="Realisation" value={pct(p.realisationPct)} icon={Percent} tone="active"
          deltaLabel="received ÷ (received + pending)" />
      </div>

      {/* ---------------------------------------------------- tab rail */}
      <nav className="ds-subnav" aria-label="Insurer record sections">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/insurance/insurers/${id}?tab=${t.toLowerCase()}`}
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
          {tab === 'Overview' && <OverviewTab data={data} />}
          {tab === 'Products' && <ProductsTab data={data} />}
          {tab === 'Performance' && <PerformanceTab data={data} />}
          {tab === 'Contacts' && <ContactsTab data={data} />}
        </div>

        <aside className="ds-stack" style={{ minWidth: 0 }}>
          <Card>
            <SectionHeading>At a glance</SectionHeading>
            <InfoRow label="Insurer code" value={data.code || '—'} />
            <InfoRow label="Branch" value={data.branch || '—'} />
            <InfoRow label="Products" value={count(products.length)} />
            <InfoRow label="Policies" value={count(p.policies)} />
            <InfoRow label="Claims" value={count(p.claims)} />
            <InfoRow label="On the panel since" value={fmtDate(data.createdAt)} />
          </Card>

          <Card>
            <SectionHeading>Commission position</SectionHeading>
            <InfoRow label="Earned" value={money(p.brokerageInr)} />
            <InfoRow label="Received" value={money(p.commissionReceivedInr)} />
            <InfoRow label="Pending" value={money(p.commissionPendingInr)} />
            <InfoRow label="Realisation" value={pct(p.realisationPct)} />
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tabs */

function OverviewTab({ data }: { data: InsurerDetail }) {
  const p = data.performance;
  const recent = data.recentPolicies ?? [];

  return (
    <>
      <Card>
        <SectionHeading sub="What this relationship is worth, on the same definitions the Companies report uses.">
          Position
        </SectionHeading>
        <InfoRow label="Premium written" value={money(p.premiumInr)} />
        <InfoRow label="Share of gross written premium" value={pct(data.shareOfBook.premiumPct)} />
        <InfoRow label="Policies placed" value={`${count(p.policies)} · ${pct(data.shareOfBook.policiesPct)} of the book`} />
        <InfoRow label="Claims registered" value={count(p.claims)} />
        <InfoRow label="Claims settled" value={money(p.claimsSettledInr)} />
        <InfoRow label="Claims ratio" value={pct(p.claimsRatioPct)} />
      </Card>

      <Card>
        <SectionHeading sub="The most recent policies placed with this insurer.">Recent business</SectionHeading>
        {recent.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            title="No business placed yet"
            body="Issue a policy on one of this insurer's products and it will appear here."
          />
        ) : (
          <div className="ds-stack" style={{ gap: 0 }}>
            {recent.slice(0, 8).map((r) => (
              <Link
                key={r.id}
                href={`/insurance/policies/${r.id}`}
                className="ds-list-row"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.client?.name ?? 'Client removed'}
                  </div>
                  <div className="ds-caption">{[r.policyNo, r.productName].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flex: 'none' }}>
                  <span className="ds-h3 ds-num">{money(r.premiumInr)}</span>
                  <Badge tone={toneForPolicyStatus(r.status)}>{humanStatus(r.status)}</Badge>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function ProductsTab({ data }: { data: InsurerDetail }) {
  const products = data.products ?? [];
  const p = data.performance;

  if (products.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Package}
          title="No products for this insurer"
          body="Add one from the Insurers screen — products carry the commission rate and the executive share the console accrues on."
        />
      </Card>
    );
  }

  const columns: DataTableColumn<InsurerProductRow>[] = [
    {
      key: 'name', header: 'Product', sortable: true,
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 620, color: 'var(--ink)' }}>{r.name}</span>
          {!r.inCatalogue && <Badge tone="neutral" dot={false}>retired</Badge>}
          {r.inCatalogue && !r.active && <Badge tone="neutral" dot={false}>inactive</Badge>}
        </span>
      ),
    },
    { key: 'category', header: 'Category', sortable: true, render: (r) => (r.category ? humanStatus(r.category) : '—') },
    {
      key: 'commissionRatePct', header: 'Commission', align: 'right', sortable: true,
      render: (r) => <span className="ds-num">{pct(r.commissionRatePct)}</span>,
    },
    {
      key: 'execRatePct', header: 'Exec share', align: 'right', sortable: true,
      render: (r) => <span className="ds-num">{pct(r.execRatePct)}</span>,
    },
    { key: 'policies', header: 'Policies', align: 'right', sortable: true, render: (r) => <span className="ds-num">{count(r.policies)}</span> },
    { key: 'premiumInr', header: 'Premium', align: 'right', sortable: true, render: (r) => <span className="ds-num">{money(r.premiumInr)}</span> },
  ];

  return (
    <>
      <Card>
        <SectionHeading sub="The catalogue, and what has actually been written on each product.">
          Products
        </SectionHeading>
        <DataTable rows={products} columns={columns} rowKey={(r) => r.id} />
        <TieBack parts={products.map((r) => r.premiumInr)} total={p.premiumInr} headline="premium written with this insurer"
          note="a policy is written on exactly one product" />
        {products.some((r) => !r.inCatalogue) && (
          <div className="ds-caption" style={{ marginTop: 'var(--s-2)' }}>
            A “retired” row is a product that policies still reference but the catalogue no longer holds. It is kept
            visible so the premium split stays whole.
          </div>
        )}
      </Card>

      <Card>
        <SectionHeading sub="Share of this insurer's premium by product.">Premium mix</SectionHeading>
        <BarList
          format={money}
          items={products
            .filter((r) => r.premiumInr > 0)
            .map((r) => ({
              label: r.name,
              value: r.premiumInr,
              tone: 'info' as Tone,
              meta: pct(sharePct(r.premiumInr, p.premiumInr)),
            }))}
        />
        {products.every((r) => r.premiumInr === 0) && (
          <EmptyState compact icon={Package} title="Nothing written on these products yet" />
        )}
      </Card>
    </>
  );
}

function PerformanceTab({ data }: { data: InsurerDetail }) {
  const p = data.performance;
  const settledOrOwed = p.commissionReceivedInr + p.commissionPendingInr;

  return (
    <>
      <Card>
        <SectionHeading sub="What has been collected against what this insurer still owes.">
          Commission realisation
        </SectionHeading>
        {settledOrOwed === 0 ? (
          <EmptyState
            compact
            icon={Coins}
            title="No commission booked yet"
            body="Realisation reads “—” rather than 0% — there is nothing in the denominator to take a share of."
          />
        ) : (
          <>
            <BarList
              format={money}
              items={[
                { label: 'Received', value: p.commissionReceivedInr, tone: 'active', meta: pct(sharePct(p.commissionReceivedInr, settledOrOwed)) },
                { label: 'Pending', value: p.commissionPendingInr, tone: 'renewal', meta: pct(sharePct(p.commissionPendingInr, settledOrOwed)) },
              ]}
            />
            <TieBack parts={[p.commissionReceivedInr, p.commissionPendingInr]} total={settledOrOwed}
              headline="commission booked" note={`realisation ${pct(p.realisationPct)}`} />
          </>
        )}
      </Card>

      <Card>
        <SectionHeading sub="What this insurer has paid out against what it has been given to underwrite.">
          Claims experience
        </SectionHeading>
        <InfoRow label="Claims registered" value={count(p.claims)} />
        <InfoRow label="Settled value" value={money(p.claimsSettledInr)} />
        <InfoRow label="Premium written" value={money(p.premiumInr)} />
        <InfoRow label="Claims ratio" value={pct(p.claimsRatioPct)} />
        <div className="ds-caption" style={{ marginTop: 'var(--s-4)' }}>
          {p.claimsRatioPct === null
            ? 'No premium has been written with this insurer, so there is no ratio to state.'
            : 'Claims ratio is settled value ÷ premium written. Only claims marked SETTLED carry a value; open files are counted but valued at nothing until they close.'}
        </div>
      </Card>

      <Card>
        <SectionHeading sub="How much of the book sits with this insurer.">Share of the book</SectionHeading>
        <InfoRow label="Share of gross written premium" value={pct(data.shareOfBook.premiumPct)} />
        <InfoRow label="Share of policies" value={pct(data.shareOfBook.policiesPct)} />
        <div className="ds-caption" style={{ marginTop: 'var(--s-4)' }}>
          Both shares are this insurer's slice of the totals on{' '}
          <Link href="/insurance/reports?view=companies" style={{ color: 'var(--tone-sales)' }}>
            the Companies report
          </Link>
          , where every insurer's premium adds up to gross written premium.
        </div>
      </Card>
    </>
  );
}

function ContactsTab({ data }: { data: InsurerDetail }) {
  const has = Boolean(data.contactName || data.phone || data.email);

  return (
    <>
      <Card>
        <SectionHeading sub="The one contact the record holds.">Relationship contact</SectionHeading>
        {has ? (
          <div className="ds-stack" style={{ gap: 0 }}>
            <div className="ds-list-row">
              <EntityIcon icon={User2} tone="info" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ds-h3">{data.contactName || 'Name not recorded'}</div>
                <div className="ds-caption">{data.branch ? `${data.branch} branch` : 'Branch not recorded'}</div>
              </div>
            </div>
            {data.phone && (
              <div className="ds-list-row">
                <Phone size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                <a href={`tel:${data.phone}`} style={{ color: 'var(--ink)' }}>{data.phone}</a>
              </div>
            )}
            {data.email && (
              <div className="ds-list-row">
                <Mail size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                <a href={`mailto:${data.email}`} style={{ color: 'var(--ink)' }}>{data.email}</a>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            compact
            icon={User2}
            title="No contact on file"
            body="Add the relationship manager's name and phone when you edit the insurer."
          />
        )}
      </Card>

      <Card>
        <SectionHeading>What is not stored yet</SectionHeading>
        <div className="ds-body">
          An insurer record holds exactly one contact name, one phone number and one email address. Multiple contacts,
          branch offices and a separate claims desk are not stored anywhere in the schema, so there is nothing to show
          for them — and an empty table here would imply a feature that does not exist. Keep the second contact in the
          notes on the policy or the claim until the record grows a contacts table.
        </div>
      </Card>
    </>
  );
}
