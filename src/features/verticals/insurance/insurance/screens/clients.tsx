'use client';

/**
 * Insurance → Clients.
 *
 * The old screen opened with a data-entry form, so the first thing a broker
 * saw was empty inputs rather than their own book. Here the page lands on
 * DATA: a searchable, filterable card grid. Creating a client is a deliberate
 * act behind a primary button, and every client opens a customer-360 drawer.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity, Car, FileText, Link2, Plus, Search, ShieldAlert, StickyNote, Users2,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import {
  Avatar, Badge, Card, Drawer, EmptyState, EntityIcon, Field, FormSection, Segmented, Skeleton,
  Timeline, Toolbar, humanStatus, toneForClaimStatus, toneForPolicyStatus,
} from '../ui/kit';
import { DocumentsPanel } from '../ui/documents-panel';
import { KycChecklist } from '../ui/kyc-checklist';

const TYPE_FILTERS = ['All', 'Individual', 'Business'];
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

// ============================================================ Screen

export function InsuranceClients() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  // ?new=1 opens the composer directly, so "Add client" from the command palette
  // and from a quick action lands ready to type — same convention as the other screens.
  const [addOpen, setAddOpen] = useState(() => params.get('new') === '1');
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<{ name: string; link: string } | null>(null);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const clientsQuery = useQuery({
    queryKey: ['ins-clients', q],
    queryFn: async () => (await api.get<any[]>('/insurance/clients', { params: q ? { q } : undefined })).data,
  });

  /** PRESERVED: creates a customer-portal activation link for this client. */
  const invite = useMutation({
    mutationFn: async (c: any) => (await api.post<{ link: string }>(`/portal-accounts/ins-clients/${c.id}/invite`, {})).data,
    onSuccess: (d, c: any) => { setInviteLink({ name: c.name, link: d.link }); toast.success('Portal invite created'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const clients = useMemo(() => {
    const all = clientsQuery.data ?? [];
    if (filter === 'All') return all;
    const want = filter === 'Business' ? 'BUSINESS' : 'INDIVIDUAL';
    return all.filter((c) => String(c.type ?? 'INDIVIDUAL').toUpperCase() === want);
  }, [clientsQuery.data, filter]);

  return (
    <div className="ds-stack">
      <Toolbar>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Search
            size={15}
            aria-hidden="true"
            style={{
              position: 'absolute', left: 'var(--s-3)', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-3)', pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 'var(--s-8)' }}
            placeholder="Search name, phone or email"
            aria-label="Search clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Segmented options={TYPE_FILTERS} value={filter} onChange={setFilter} />
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add client
          </button>
        </div>
      </Toolbar>

      {inviteLink && (
        <InviteRow link={inviteLink} onDismiss={() => setInviteLink(null)} />
      )}

      {clientsQuery.isLoading ? (
        <div className="ds-grid ds-grid-cards"><Skeleton rows={6} height={148} /></div>
      ) : clientsQuery.isError ? (
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Couldn't load your clients"
            body={apiErrorMessage(clientsQuery.error)}
            actionLabel="Try again"
            onAction={() => clientsQuery.refetch()}
          />
        </Card>
      ) : clients.length === 0 ? (
        <Card>
          {q || filter !== 'All' ? (
            <EmptyState
              icon={Search}
              title="Nothing matches that"
              body="Try a different name, phone number or email — or clear the filter."
            />
          ) : (
            <EmptyState
              icon={Users2}
              title="No clients yet — add your first"
              body="Clients are the spine of the book: policies, renewals and claims all hang off them."
              actionLabel="Add client"
              onAction={() => setAddOpen(true)}
            />
          )}
        </Card>
      ) : (
        <div className="ds-grid ds-grid-cards">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onOpen={() => setOpenId(c.id)}
              onInvite={() => invite.mutate(c)}
              inviting={invite.isPending}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <AddClientDrawer
          onClose={() => setAddOpen(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['ins-clients'] }); setAddOpen(false); }}
        />
      )}

      {openId && <Client360Drawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ============================================================ Portal invite

/** PRESERVED: the activation link the broker copies and sends to the customer. */
function InviteRow({ link, onDismiss }: { link: { name: string; link: string }; onDismiss: () => void }) {
  return (
    <Card tone="sales">
      <div className="ds-row" style={{ flexWrap: 'wrap' }}>
        <EntityIcon icon={Link2} tone="sales" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h3">Portal activation link for {link.name}</div>
          <div className="ds-caption" style={{ marginTop: 3 }}>Share it with the client — it activates their self-service portal.</div>
        </div>
        <button
          className="btn-secondary btn-sm"
          onClick={() => { navigator.clipboard.writeText(link.link); toast.success('Copied'); }}
        >Copy link</button>
        <button className="btn-ghost btn-sm" onClick={onDismiss}>Dismiss</button>
      </div>
      <div
        className="ds-inset ds-small"
        style={{
          marginTop: 'var(--s-3)', padding: 'var(--s-2) var(--s-3)', fontFamily: 'var(--mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)',
        }}
      >{link.link}</div>
    </Card>
  );
}

// ============================================================ Grid card

function ClientCard({
  client: c, onOpen, onInvite, inviting,
}: { client: any; onOpen: () => void; onInvite: () => void; inviting: boolean }) {
  const policies = c._count?.policies ?? 0;
  // The list endpoint doesn't aggregate cover yet; fmtOrgMoney renders "—" honestly.
  const cover = c.activeCoverInr ?? c.sumInsuredInr ?? null;
  const contact = [c.phone, c.email].filter(Boolean).join(' · ');

  return (
    <Card interactive onClick={onOpen}>
      <div className="ds-row" style={{ alignItems: 'flex-start' }}>
        <Avatar name={c.name} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          <div
            className="ds-caption"
            style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >{contact || 'No contact details yet'}</div>
        </div>
        <Badge tone={isBusiness(c) ? 'sales' : 'info'} dot={false}>{typeLabel(c)}</Badge>
      </div>

      <hr className="ds-divider" style={{ margin: 'var(--s-4) 0 var(--s-3)' }} />

      <div className="ds-row">
        <div>
          <div className="ds-caption">Policies</div>
          <div className="ds-small ds-num" style={{ fontWeight: 620, color: 'var(--ink)' }}>{policies}</div>
        </div>
        <div style={{ marginLeft: 'var(--s-5)' }}>
          <div className="ds-caption">Active cover</div>
          <div className="ds-small ds-num" style={{ fontWeight: 620, color: 'var(--ink)' }}>{fmtOrgMoney(cover)}</div>
        </div>
        <button
          className="btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
          disabled={inviting}
          title="Create a customer-portal activation link"
          onClick={(e) => { e.stopPropagation(); onInvite(); }}
        >Invite to portal</button>
      </div>
    </Card>
  );
}

// ============================================================ Create drawer

function AddClientDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: '', type: 'INDIVIDUAL', phone: '', email: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: () => api.post('/insurance/clients', {
      name: f.name.trim(),
      type: f.type,
      phone: f.phone.trim() || undefined,
      email: f.email.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Client added'); onCreated(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const valid = f.name.trim().length > 0;

  return (
    <Drawer open onClose={onClose} title="Add client" subtitle="Policies, renewals and claims will hang off this record." width={520}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (valid && !create.isPending) create.mutate(); }}
      >
        <FormSection title="Identity" description="How this client appears across the book.">
          <Field label="Full name" required span={2} hint="Person or registered business name.">
            <input className="input" autoFocus value={f.name} onChange={set('name')} placeholder="Aisha Rahman" />
          </Field>
          <Field label="Client type">
            <select className="input" value={f.type} onChange={set('type')}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Business</option>
            </select>
          </Field>
        </FormSection>

        <FormSection title="Contact" description="Used for renewal reminders and the portal invite.">
          <Field label="Phone">
            <input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="+971 50 000 0000" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" />
          </Field>
        </FormSection>

        <div
          style={{
            display: 'flex', gap: 'var(--s-2)', justifyContent: 'flex-end',
            borderTop: '1px solid var(--hairline)', paddingTop: 'var(--s-4)',
          }}
        >
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!valid || create.isPending}>
            {create.isPending ? 'Adding…' : 'Add client'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// ============================================================ Customer 360

const TABS = ['Overview', 'Policies', 'Vehicles', 'Claims', 'Documents', 'Notes', 'Timeline'];

function Client360Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [tab, setTab] = useState('Overview');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ins-client-360', id],
    queryFn: async () => (await api.get<any>(`/insurance/clients/${id}`)).data,
  });

  // Owned by another slice of the API; if it isn't there yet the tab degrades.
  const timeline = useQuery({
    queryKey: ['ins-client-timeline', id],
    enabled: tab === 'Timeline',
    retry: false,
    queryFn: async () => (await api.get<any[]>(`/insurance/clients/${id}/timeline`)).data,
  });

  const policies: any[] = data?.policies ?? [];
  // Which slots the Documents tab shows: RC and licence only once there
  // is a vehicle on the book. Quotes do not count — an unbought motor
  // quote is not a vehicle we insure.
  const policyCategories = policies.map((p) => p.category);
  const claims: any[] = useMemo(
    () => policies
      .flatMap((p) => (p.claims ?? []).map((cl: any) => ({ ...cl, policy: p })))
      .sort((a, b) => +new Date(b.createdAt ?? b.incidentDate) - +new Date(a.createdAt ?? a.incidentDate)),
    [policies],
  );
  const vehicles: any[] = Array.isArray(data?.profile?.vehicles) ? data.profile.vehicles : [];
  const kyc: [string, any][] = Object.entries(data?.kyc ?? {}).filter(([, v]) => v != null && v !== '');

  return (
    <Drawer
      open
      onClose={onClose}
      width={620}
      title={data?.name ?? 'Client'}
      subtitle={data ? [typeLabel(data), data.phone, data.email].filter(Boolean).join(' · ') : undefined}
      tabs={TABS}
      activeTab={tab}
      onTab={setTab}
      counts={{ Policies: policies.length || undefined, Claims: claims.length || undefined }}
      actions={
        <Link
          href={`/insurance/clients/${id}`}
          className="btn-secondary btn-sm"
          style={{ textDecoration: 'none', flex: 'none' }}
        >
          Open full profile
        </Link>
      }
    >
      {isLoading ? (
        <Skeleton rows={4} height={84} />
      ) : isError ? (
        <EmptyState icon={ShieldAlert} title="Couldn't load this client" body={apiErrorMessage(error)} />
      ) : (
        <>
          {tab === 'Overview' && <OverviewTab client={data} policies={policies} claims={claims} />}
          {tab === 'Policies' && <PoliciesTab policies={policies} />}
          {tab === 'Vehicles' && <VehiclesTab vehicles={vehicles} />}
          {tab === 'Claims' && <ClaimsTab claims={claims} />}
          {tab === 'Documents' && <DocumentsTab kyc={kyc} clientId={data.id} categories={policyCategories} />}
          {tab === 'Notes' && <NotesTab notes={data?.notes} />}
          {tab === 'Timeline' && <TimelineTab query={timeline} />}
        </>
      )}
    </Drawer>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-card ds-card-tight">
      <div className="ds-caption">{label}</div>
      <div className="ds-h1 ds-num" style={{ marginTop: 'var(--s-1)' }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span className="ds-list-row-meta" style={{ color: 'var(--ink)' }}>{value ?? '—'}</span>
    </div>
  );
}

function OverviewTab({ client, policies, claims }: { client: any; policies: any[]; claims: any[] }) {
  const active = policies.filter((p) => String(p.status).toUpperCase() === 'ACTIVE');
  const totalCover = active.reduce((a, p) => a + (p.sumInsuredInr ?? 0), 0);
  const annualPremium = active.reduce((a, p) => a + (p.premiumInr ?? 0), 0);
  const openClaims = claims.filter((c) => !['SETTLED', 'REJECTED'].includes(String(c.status).toUpperCase()));

  return (
    <div className="ds-stack">
      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(132px,1fr))' }}>
        <StatTile label="Active policies" value={active.length} />
        <StatTile label="Total cover" value={fmtOrgMoney(totalCover || null)} />
        <StatTile label="Annual premium" value={fmtOrgMoney(annualPremium || null)} />
        <StatTile label="Open claims" value={openClaims.length} />
      </div>

      <Card>
        <div className="ds-h3" style={{ marginBottom: 'var(--s-2)' }}>Contact</div>
        <InfoRow label="Type" value={typeLabel(client)} />
        <InfoRow label="Phone" value={client?.phone} />
        <InfoRow label="Email" value={client?.email} />
        <InfoRow label="Client since" value={fmtDate(client?.createdAt)} />
        <InfoRow label="Quotes" value={client?.quotes?.length ?? 0} />
      </Card>
    </div>
  );
}

function PoliciesTab({ policies }: { policies: any[] }) {
  if (!policies.length) {
    return <EmptyState icon={FileText} title="No policies yet" body="Issue one from a quote and it will appear here." compact />;
  }
  return (
    <div className="ds-stack">
      {policies.map((p) => {
        const days = daysUntil(p.endDate);
        const expiring = days != null && days >= 0 && days <= RENEWAL_WINDOW_DAYS;
        return (
          <Card key={p.id}>
            <div className="ds-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ds-h3">{p.productName}</div>
                <div className="ds-caption" style={{ marginTop: 3 }}>
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
                <div className="ds-caption">Premium</div>
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
              {expiring && (
                <span style={{ marginLeft: 'auto' }}>
                  <Badge tone="renewal">expires in {days} {days === 1 ? 'day' : 'days'}</Badge>
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function VehiclesTab({ vehicles }: { vehicles: any[] }) {
  if (!vehicles.length) {
    return (
      <EmptyState
        icon={Car}
        title="No vehicles on file"
        body="Vehicles come from the client profile — add them when you quote motor cover."
        compact
      />
    );
  }
  return (
    <div className="ds-stack">
      {vehicles.map((v, i) => (
        <Card key={v.registration ?? v.regNo ?? i}>
          <div className="ds-row">
            <EntityIcon icon={Car} tone="info" size="lg" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ds-h3">{v.registration ?? v.regNo ?? v.plate ?? 'Unregistered'}</div>
              <div className="ds-caption" style={{ marginTop: 3 }}>
                {[v.make, v.model].filter(Boolean).join(' ') || 'Make not recorded'}
              </div>
            </div>
            {v.year && <span className="ds-small ds-num" style={{ color: 'var(--ink-2)' }}>{v.year}</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ClaimsTab({ claims }: { claims: any[] }) {
  if (!claims.length) {
    return <EmptyState icon={ShieldAlert} title="No claims" body="Nothing has been registered against this client's policies." compact />;
  }
  return (
    <div className="ds-stack">
      {claims.map((c) => (
        <Card key={c.id}>
          <div className="ds-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ds-h3">{c.claimNo}</div>
              <div className="ds-caption" style={{ marginTop: 3 }}>
                {[c.policy?.policyNo, c.policy?.productName].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Badge tone={toneForClaimStatus(c.status)}>{humanStatus(c.status)}</Badge>
          </div>
          {c.description && <div className="ds-body" style={{ marginTop: 'var(--s-3)' }}>{c.description}</div>}
          <hr className="ds-divider" style={{ margin: 'var(--s-3) 0' }} />
          <div className="ds-row">
            <span className="ds-caption">Incident {fmtDate(c.incidentDate)}</span>
            {c.settledInr != null && (
              <span className="ds-small ds-num" style={{ marginLeft: 'auto', fontWeight: 620, color: 'var(--tone-active)' }}>
                Settled {fmtOrgMoney(c.settledInr)}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
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
    <div className="ds-stack">
      <Card>
        <KycChecklist clientId={clientId} categories={categories} />
      </Card>
      {kyc.length > 0 && (
        <Card>
          <div className="ds-h3" style={{ marginBottom: 'var(--s-2)' }}>KYC on record</div>
          {kyc.map(([k, v]) => <InfoRow key={k} label={humanKey(k)} value={String(v)} />)}
        </Card>
      )}
      {/* The KYC block above is a set of REFERENCE NUMBERS; the boxes are the
          files themselves. Both belong on the same tab — a PAN number on record
          and a scan of the PAN are different pieces of evidence. */}
      <Card>
        <DocumentsPanel
          relatedType="INS_CLIENT"
          relatedId={clientId}
          title="Other files"
          unfiledOnly
        />
      </Card>
    </div>
  );
}

function NotesTab({ notes }: { notes?: string | null }) {
  if (!notes) {
    return <EmptyState icon={StickyNote} title="No notes" body="Open the client record to write notes on this client." compact />;
  }
  return (
    <Card>
      <div className="ds-body" style={{ whiteSpace: 'pre-wrap' }}>{notes}</div>
      <hr className="ds-divider" style={{ margin: 'var(--s-4) 0 var(--s-3)' }} />
      <div className="ds-caption">Read-only in this drawer — open the client record to edit.</div>
    </Card>
  );
}

function TimelineTab({ query }: { query: { isLoading: boolean; isError: boolean; data?: any[] } }) {
  if (query.isLoading) return <Skeleton rows={4} height={54} />;
  const items = Array.isArray(query.data) ? query.data : [];
  if (query.isError || items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nothing on the timeline yet"
        body="Quotes, policy issues, renewals and claims will show up here as they happen."
        compact
      />
    );
  }
  return (
    <Timeline
      items={items.map((it) => ({
        at: it.at ?? it.createdAt ?? new Date(),
        title: it.title ?? it.label ?? 'Activity',
        detail: it.detail ?? it.description ?? undefined,
        tone: it.tone,
      }))}
    />
  );
}
