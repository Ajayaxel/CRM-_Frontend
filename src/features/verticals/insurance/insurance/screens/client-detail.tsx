'use client';

/**
 * Insurance → Client record page.
 *
 * The list drawer is the quick peek; this is the record. It follows the
 * master-detail shape the reference products use: an identity header, a
 * summary strip of the four numbers that describe the relationship, a linkable
 * tab rail, and a two-column body whose right rail keeps the at-a-glance facts
 * on screen no matter which tab is open.
 *
 * Every tab is backed by data the API actually returns — `GET /insurance/clients/:id`
 * (client360) and `GET /insurance/clients/:id/timeline`. Details are corrected
 * through `PATCH /insurance/clients/:id`: the phone and the email are what the
 * policy email and the passwordless portal sign-in are keyed on, so a typo at
 * first contact used to be permanent.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity, ArrowLeft, CalendarClock, Car, ChevronRight, Coins, FileText, FileWarning,
  Link2, Pencil, ShieldAlert, ShieldCheck, StickyNote, Users2, Wallet,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import {
  Avatar, Badge, Card, EmptyState, Skeleton, StatCard, Timeline,
  humanStatus, toneForClaimStatus, toneForPolicyStatus, useIsNarrow,
} from '../ui/kit';
import { DocumentsPanel } from '../ui/documents-panel';
import { KycChecklist } from '../ui/kyc-checklist';
import { ClientEditor } from '../ui/client-editor';
import { DeclarationHighlight, DeclarationsTab } from '../ui/declarations-panel';
import { declarationTypeForCategory } from '../ui/declaration-types';

// ============================================================ domain helpers

const TABS = ['Overview', 'Policies', 'Quotes', 'Claims', 'Declarations', 'Documents', 'Family', 'Vehicles', 'Timeline', 'Notes'] as const;
type Tab = (typeof TABS)[number];

/** Inside this window a policy stops being "current" and becomes work to do. */
const RENEWAL_WINDOW_DAYS = 45;

const isBusiness = (c: any) => String(c?.type ?? 'INDIVIDUAL').toUpperCase() === 'BUSINESS';
const typeLabel = (c: any) => (isBusiness(c) ? 'Business' : 'Individual');

const daysUntil = (d?: string | Date | null) =>
  d == null ? null : Math.ceil((+new Date(d) - Date.now()) / 86_400_000);

const fmtDate = (d?: string | Date | null) =>
  d == null ? '—' : new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

/** "panRef" / "address_ref" → "Pan ref" — KYC keys are a storage detail. */
const humanKey = (k: string) =>
  k.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const isOpenClaim = (c: any) => !['SETTLED', 'REJECTED'].includes(String(c?.status).toUpperCase());

// ============================================================ small building blocks

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span className="ds-list-row-meta" style={{ color: 'var(--ink)' }}>{value ?? '—'}</span>
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

/** A card that is entirely a link — the whole surface opens the record. */
function LinkCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <Card interactive>{children}</Card>
    </Link>
  );
}

// ============================================================ Screen

export function InsuranceClientDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const narrow = useIsNarrow(900);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const raw = params?.get('tab') ?? '';
  const tab: Tab = TABS.find((t) => t.toLowerCase() === raw.toLowerCase()) ?? 'Overview';

  // Same key the list drawer uses, so opening the record reuses a warm cache.
  const query = useQuery({
    queryKey: ['ins-client-360', id],
    queryFn: async () => (await api.get<any>(`/insurance/clients/${id}`)).data,
  });
  const { data, isLoading, isError, error } = query;

  // Overview shows a preview of the same feed the Timeline tab renders in full.
  const timeline = useQuery({
    queryKey: ['ins-client-timeline', id],
    enabled: tab === 'Overview' || tab === 'Timeline',
    retry: false,
    queryFn: async () => (await api.get<any[]>(`/insurance/clients/${id}/timeline`)).data,
  });

  /** PRESERVED from the list: the customer-portal activation link. */
  const invite = useMutation({
    mutationFn: async () => (await api.post<{ link: string }>(`/portal-accounts/ins-clients/${id}/invite`, {})).data,
    onSuccess: (d) => { setInviteLink(d.link); toast.success('Portal invite created'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const policies: any[] = data?.policies ?? [];
  // Which slots the Documents tab shows: RC and licence only once there
  // is a vehicle on the book. Quotes do not count — an unbought motor
  // quote is not a vehicle we insure.
  const policyCategories = policies.map((p) => p.category);
  const quotes: any[] = data?.quotes ?? [];
  // A declaration is raised against a quote whose CATEGORY calls for one —
  // health or motor — so the profile has to know whether there is one before it
  // can offer anything useful. A converted quote is excluded: its policy is
  // already written, which is too late to disclose. The category also decides
  // WHICH declaration, so it travels with the quote rather than being inferred
  // again further down.
  const healthQuotes = quotes
    .filter((q) => declarationTypeForCategory(q.category) && q.status !== 'CONVERTED')
    .map((q) => ({ id: q.id, reference: q.reference, category: q.category }));
  // Every policy already on the book came from a quote that is now converted,
  // so quote-only raising left the whole existing customer base unable to
  // declare anything at all. These are the fallback target.
  const healthPolicies = policies
    .filter((p) => declarationTypeForCategory(p.category))
    .map((p) => ({ id: p.id, policyNo: p.policyNo, productName: p.productName, category: p.category }));
  const claims: any[] = useMemo(
    () => policies
      .flatMap((p) => (p.claims ?? []).map((cl: any) => ({ ...cl, policy: p })))
      .sort((a, b) => +new Date(b.createdAt ?? b.incidentDate) - +new Date(a.createdAt ?? a.incidentDate)),
    [policies],
  );
  const family: any[] = Array.isArray(data?.profile?.family) ? data.profile.family : [];
  const vehicles: any[] = Array.isArray(data?.profile?.vehicles) ? data.profile.vehicles : [];
  const kyc: [string, any][] = Object.entries(data?.kyc ?? {}).filter(([, v]) => v != null && v !== '');

  const active = policies.filter((p) => String(p.status).toUpperCase() === 'ACTIVE');
  const totalCover = active.reduce((a, p) => a + (p.sumInsuredInr ?? 0), 0);
  const annualPremium = active.reduce((a, p) => a + (p.premiumInr ?? 0), 0);
  const openClaims = claims.filter(isOpenClaim);
  const nextRenewal = active
    .map((p) => p.endDate)
    .filter(Boolean)
    .sort((a, b) => +new Date(a) - +new Date(b))[0] as string | undefined;

  const counts: Partial<Record<Tab, number>> = {
    Policies: policies.length || undefined,
    Quotes: quotes.length || undefined,
    Claims: claims.length || undefined,
    Family: family.length || undefined,
  };

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
          title="We couldn't open this client"
          body={isError ? apiErrorMessage(error) : 'This client record no longer exists, or it belongs to another organisation.'}
        />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link href="/insurance/clients" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Back to clients
          </Link>
        </div>
      </Card>
    );
  }

  const identifiers = [typeLabel(data), data.phone, data.email].filter(Boolean).join(' · ');

  return (
    <div className="ds-stack" style={{ gap: 'var(--s-5)' }}>
      {/* ---------------------------------------------------- record header */}
      <div className="ds-stack" style={{ gap: 'var(--s-3)' }}>
        <div>
          <Link href="/insurance/clients" className="ds-viewall" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={14} /> All clients
          </Link>
        </div>

        <div className="ds-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar name={data.name} size={48} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ds-row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
              <h1 className="ds-h1">{data.name}</h1>
              <Badge tone={isBusiness(data) ? 'sales' : 'info'} dot={false}>{typeLabel(data)}</Badge>
            </div>
            <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
              {identifiers || 'No contact details on file'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <Pencil size={13} /> Edit details
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={invite.isPending}
              title="Create a customer-portal activation link"
              onClick={() => invite.mutate()}
            >
              <Link2 size={13} /> {invite.isPending ? 'Creating…' : 'Invite to portal'}
            </button>
          </div>
        </div>

        {inviteLink && (
          <Card tone="sales">
            <div className="ds-row" style={{ flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ds-h3">Portal activation link</div>
                <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                  Share it with {data.name} — it activates their self-service portal.
                </div>
              </div>
              <button
                className="btn-secondary btn-sm"
                onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copied'); }}
              >Copy link</button>
              <button className="btn-ghost btn-sm" onClick={() => setInviteLink(null)}>Dismiss</button>
            </div>
            <div
              className="ds-inset ds-small"
              style={{
                marginTop: 'var(--s-3)', padding: 'var(--s-2) var(--s-3)', fontFamily: 'var(--mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)',
              }}
            >{inviteLink}</div>
          </Card>
        )}
      </div>

      {editing && (
        <ClientEditor client={data} onClose={() => setEditing(false)} onSaved={() => { query.refetch(); timeline.refetch(); }} />
      )}

      {/* ---------------------------------------------------- summary strip */}
      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        <StatCard label="Active policies" value={active.length} icon={ShieldCheck} tone="active" />
        <StatCard label="Total cover" value={fmtOrgMoney(totalCover || null)} icon={Wallet} tone="info" />
        <StatCard label="Annual premium" value={fmtOrgMoney(annualPremium || null)} icon={Coins} tone="sales" />
        <StatCard label="Open claims" value={openClaims.length} icon={FileWarning} tone={openClaims.length ? 'claim' : 'neutral'} />
      </div>

      {/* ---------------------------------------------------- tab rail */}
      <nav className="ds-subnav" aria-label="Client record sections">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/insurance/clients/${id}?tab=${t.toLowerCase()}`}
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
          {tab === 'Overview' && <OverviewTab client={data} id={id} timeline={timeline} healthQuotes={healthQuotes} healthPolicies={healthPolicies} />}
          {tab === 'Policies' && <PoliciesTab policies={policies} />}
          {tab === 'Quotes' && <QuotesTab quotes={quotes} />}
          {tab === 'Claims' && <ClaimsTab claims={claims} />}
          {tab === 'Declarations' && (
            <DeclarationsTab
              clientId={id}
              healthQuotes={healthQuotes}
              healthPolicies={healthPolicies}
              onOpenQuotes={() => { window.location.href = `/insurance/clients/${id}?tab=quotes`; }}
            />
          )}
          {tab === 'Documents' && <DocumentsTab kyc={kyc} clientId={id} categories={policyCategories} />}
          {tab === 'Notes' && <NotesTab id={id} notes={data.notes} onSaved={() => query.refetch()} />}
          {tab === 'Timeline' && <TimelineTab query={timeline} />}
          {tab === 'Family' && <FamilyTab family={family} />}
          {tab === 'Vehicles' && <VehiclesTab vehicles={vehicles} />}
        </div>

        <aside className="ds-stack" style={{ minWidth: 0 }}>
          <Card>
            <SectionHeading>At a glance</SectionHeading>
            <InfoRow label="Client since" value={fmtDate(data.createdAt)} />
            <InfoRow label="Policies" value={`${policies.length} · ${active.length} active`} />
            <InfoRow label="Quotes" value={quotes.length} />
            <InfoRow label="Claims" value={`${claims.length} · ${openClaims.length} open`} />
            {vehicles.length > 0 && <InfoRow label="Vehicles on file" value={vehicles.length} />}
            <InfoRow label="KYC references" value={kyc.length || '—'} />
          </Card>

          {nextRenewal && (
            <Card tone={(daysUntil(nextRenewal) ?? 999) <= RENEWAL_WINDOW_DAYS ? 'renewal' : undefined}>
              <SectionHeading>Next renewal</SectionHeading>
              <div className="ds-row">
                <CalendarClock size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                <span className="ds-h3">{fmtDate(nextRenewal)}</span>
              </div>
              {(() => {
                const d = daysUntil(nextRenewal);
                if (d == null) return null;
                return (
                  <div style={{ marginTop: 'var(--s-3)' }}>
                    <Badge tone={d < 0 ? 'expired' : d <= RENEWAL_WINDOW_DAYS ? 'renewal' : 'neutral'}>
                      {d < 0 ? `expired ${Math.abs(d)}d ago` : d === 0 ? 'expires today' : `in ${d} day${d === 1 ? '' : 's'}`}
                    </Badge>
                  </div>
                );
              })()}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

// ============================================================ Tabs

function OverviewTab({
  client, id, timeline, healthQuotes, healthPolicies,
}: {
  client: any; id: string; timeline: { isLoading: boolean; isError: boolean; data?: any[] };
  healthQuotes: { id: string; reference?: string | null; category?: string | null }[];
  healthPolicies: { id: string; policyNo?: string | null; productName?: string | null; category?: string | null }[];
}) {
  const recent = (Array.isArray(timeline.data) ? timeline.data : []).slice(0, 5);

  return (
    <>
      {/* Only the highlights here. Sixteen medical questions would bury the
          four figures this screen exists for, and detail that specific should
          take a deliberate click rather than appear on a page somebody opened
          to check a phone number. */}
      <DeclarationHighlight clientId={id} healthQuotes={healthQuotes} healthPolicies={healthPolicies} />

      <Card>
        <SectionHeading>Contact</SectionHeading>
        <InfoRow label="Client type" value={typeLabel(client)} />
        <InfoRow label="Phone" value={client.phone} />
        <InfoRow label="Email" value={client.email} />
        <InfoRow label="Client since" value={fmtDate(client.createdAt)} />
        {client.leadId && <InfoRow label="Origin" value="Converted from a CRM lead" />}
      </Card>

      <Card>
        <SectionHeading
          action={
            <Link href={`/insurance/clients/${id}?tab=timeline`} className="ds-viewall" style={{ textDecoration: 'none' }}>
              View all <ChevronRight size={13} />
            </Link>
          }
        >Recent activity</SectionHeading>
        {timeline.isLoading ? (
          <Skeleton rows={3} height={46} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nothing has happened yet"
            body="Quotes, policy issues, renewals and claims land here as they happen."
            compact
          />
        ) : (
          <Timeline
            dense
            items={recent.map((it) => ({
              at: it.at ?? it.createdAt ?? new Date(),
              title: it.title ?? 'Activity',
              detail: it.detail ?? undefined,
              tone: it.tone,
            }))}
          />
        )}
      </Card>
    </>
  );
}

function PoliciesTab({ policies }: { policies: any[] }) {
  if (!policies.length) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="No policies yet"
          body="Issue one from a quote and it will appear here, on the book and in the renewal pipeline."
          compact
        />
      </Card>
    );
  }
  return (
    <>
      {policies.map((p) => {
        const days = daysUntil(p.endDate);
        const expiring = days != null && days >= 0 && days <= RENEWAL_WINDOW_DAYS;
        return (
          <LinkCard key={p.id} href={`/insurance/policies/${p.id}`}>
            <div className="ds-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ds-h3">{p.productName}</div>
                <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                  {[p.companyName, p.policyNo].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Badge tone={toneForPolicyStatus(p.status)}>{humanStatus(p.status)}</Badge>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--s-3)', marginTop: 'var(--s-4)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="ds-caption">Sum insured</div>
                <div className="ds-h1 ds-num" style={{ marginTop: 'var(--s-1)' }}>{fmtOrgMoney(p.sumInsuredInr)}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div className="ds-caption">Premium / yr</div>
                <div className="ds-small ds-num" style={{ fontWeight: 620, color: 'var(--ink)', marginTop: 'var(--s-1)' }}>
                  {fmtOrgMoney(p.premiumInr)}
                </div>
              </div>
            </div>

            <hr className="ds-divider" style={{ margin: 'var(--s-3) 0' }} />

            <div className="ds-row" style={{ flexWrap: 'wrap' }}>
              <span className="ds-caption">
                {days != null && days < 0 ? `Expired ${fmtDate(p.endDate)}` : `Cover to ${fmtDate(p.endDate)}`}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                {expiring && <Badge tone="renewal">expires in {days} {days === 1 ? 'day' : 'days'}</Badge>}
                <span className="ds-viewall">Open record <ChevronRight size={13} /></span>
              </span>
            </div>
          </LinkCard>
        );
      })}
    </>
  );
}

function QuotesTab({ quotes }: { quotes: any[] }) {
  if (!quotes.length) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="No quotes for this client"
          body="Build a comparison on the Quotes screen and the insurer lines will show up here."
          compact
        />
      </Card>
    );
  }
  return (
    <>
      {quotes.map((q) => {
        const lines: any[] = q.lines ?? [];
        const best = lines.length ? Math.min(...lines.map((l) => l.premiumInr ?? Infinity)) : null;
        return (
          <Card key={q.id}>
            <div className="ds-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ds-h3 ds-num">{q.reference}</div>
                <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                  {humanStatus(q.category)} · raised {fmtDate(q.createdAt)}
                </div>
              </div>
              <Badge tone={String(q.status).toUpperCase() === 'CONVERTED' ? 'active' : String(q.status).toUpperCase() === 'LOST' ? 'expired' : 'sales'}>
                {humanStatus(q.status)}
              </Badge>
            </div>
            <div style={{ marginTop: 'var(--s-4)' }}>
              <InfoRow label="Insurer lines compared" value={lines.length} />
              <InfoRow label="Lowest premium quoted" value={best != null && Number.isFinite(best) ? fmtOrgMoney(best) : '—'} />
              <InfoRow
                label="Recommended"
                value={lines.find((l) => l.recommended)?.companyName ?? 'Not marked yet'}
              />
            </div>
          </Card>
        );
      })}
    </>
  );
}

function ClaimsTab({ claims }: { claims: any[] }) {
  if (!claims.length) {
    return (
      <Card>
        <EmptyState
          icon={ShieldAlert}
          title="No claims"
          body="Nothing has been registered against this client's policies."
          compact
        />
      </Card>
    );
  }
  return (
    <>
      {claims.map((c) => (
        <Card key={c.id}>
          <div className="ds-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ds-h3 ds-num">{c.claimNo}</div>
              <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                {[c.policy?.policyNo, c.policy?.productName].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Badge tone={toneForClaimStatus(c.status)}>{humanStatus(c.status)}</Badge>
          </div>

          {c.description && <div className="ds-body" style={{ marginTop: 'var(--s-3)' }}>{c.description}</div>}

          <hr className="ds-divider" style={{ margin: 'var(--s-3) 0' }} />

          <div className="ds-row" style={{ flexWrap: 'wrap' }}>
            <span className="ds-caption">Incident {fmtDate(c.incidentDate)}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
              {c.settledInr != null && (
                <span className="ds-small ds-num ds-fg-active" style={{ fontWeight: 650 }}>
                  Settled {fmtOrgMoney(c.settledInr)}
                </span>
              )}
              {c.policy?.id && (
                <Link href={`/insurance/policies/${c.policy.id}`} className="ds-viewall" style={{ textDecoration: 'none' }}>
                  Policy <ChevronRight size={13} />
                </Link>
              )}
            </span>
          </div>
        </Card>
      ))}
    </>
  );
}

function DocumentsTab({
  kyc, clientId, categories,
}: {
  kyc: [string, any][];
  clientId: string;
  categories: (string | null | undefined)[];
}) {
  return (
    <>
      <Card>
        <KycChecklist clientId={clientId} categories={categories} />
      </Card>
      {kyc.length > 0 && (
        <Card>
          <SectionHeading>KYC on record</SectionHeading>
          {kyc.map(([k, v]) => <InfoRow key={k} label={humanKey(k)} value={String(v)} />)}
        </Card>
      )}
      <Card>
        <DocumentsPanel
          relatedType="INS_CLIENT"
          relatedId={clientId}
          title="Other files"
          unfiledOnly
        />
      </Card>
    </>
  );
}

function NotesTab({ id, notes, onSaved }: { id: string; notes?: string | null; onSaved: () => void }) {
  const [draft, setDraft] = useState(notes ?? '');
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: () => api.patch(`/insurance/clients/${id}`, { notes: draft }),
    onSuccess: () => { setDirty(false); toast.success('Notes saved'); onSaved(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Card>
      <SectionHeading>Notes</SectionHeading>
      <textarea
        className="input"
        rows={10}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
        placeholder="What the file should say about this client — cover preferences, who to call, what was agreed."
        style={{ resize: 'vertical', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
        <span className="ds-caption">{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button
          className="btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </Card>
  );
}

function TimelineTab({ query }: { query: { isLoading: boolean; isError: boolean; data?: any[] } }) {
  if (query.isLoading) return <Skeleton rows={5} height={54} />;
  const items = Array.isArray(query.data) ? query.data : [];
  if (query.isError || items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Activity}
          title="Nothing on the timeline yet"
          body="Quotes, policy issues, renewals, claims, commission receipts and emails sent to this client show up here as they happen."
          compact
        />
      </Card>
    );
  }
  return (
    <Card>
      <Timeline
        items={items.map((it) => ({
          at: it.at ?? it.createdAt ?? new Date(),
          title: it.title ?? 'Activity',
          detail: it.detail ?? undefined,
          tone: it.tone,
        }))}
      />
    </Card>
  );
}

function VehiclesTab({ vehicles }: { vehicles: any[] }) {
  if (!vehicles.length) {
    return (
      <Card>
        <EmptyState
          icon={Car}
          title="No vehicles recorded"
          body="Vehicles come from the client profile — the customer can add them from their portal, or they are captured when you quote motor cover."
          compact
        />
      </Card>
    );
  }
  return (
    <Card>
      <SectionHeading>Vehicles on the profile</SectionHeading>
      {vehicles.map((v, i) => (
        <div key={`${v.registration ?? 'vehicle'}-${i}`} className="ds-list-row">
          <Car size={16} style={{ color: 'var(--tone-sales)', flex: 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div className="ds-h3" style={{ letterSpacing: '0.04em' }}>{v.registration || 'Registration not recorded'}</div>
            <div className="ds-caption" style={{ marginTop: 2 }}>
              {[v.make, v.year].filter(Boolean).join(' · ') || 'Make and year not recorded'}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function FamilyTab({ family }: { family: any[] }) {
  if (!family.length) {
    return (
      <Card>
        <EmptyState
          icon={Users2}
          title="No family members recorded"
          body="Family comes from the client profile — it is captured when you quote health or life cover."
          compact
        />
      </Card>
    );
  }
  return (
    <Card>
      <SectionHeading>Family on the profile</SectionHeading>
      {family.map((m, i) => (
        <div key={`${m.name ?? 'member'}-${i}`} className="ds-list-row">
          <Avatar name={m.name ?? '?'} size={30} />
          <div style={{ minWidth: 0 }}>
            <div className="ds-h3">{m.name ?? 'Unnamed'}</div>
            <div className="ds-caption" style={{ marginTop: 2 }}>{m.relation ? humanKey(String(m.relation)) : 'Relation not recorded'}</div>
          </div>
          <span className="ds-list-row-meta">{m.dob ? fmtDate(m.dob) : '—'}</span>
        </div>
      ))}
    </Card>
  );
}
