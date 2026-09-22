'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Plug, RefreshCw, Store } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { retailApi } from '../retail-client';

/**
 * The integration console: connect the store, choose the catalogue master,
 * map Shopify locations to BMN stores, watch sync health, and work the
 * SKU-audit queue — nothing is ever silently mis-mapped.
 */
export function ShopifyFeature() {
  const qc = useQueryClient();
  const { data: st } = useQuery({ queryKey: ['shopify-status'], queryFn: retailApi.shopifyStatus, refetchInterval: 15000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['shopify-status'] }); qc.invalidateQueries({ queryKey: ['shopify-unmatched'] }); qc.invalidateQueries({ queryKey: ['shopify-locations'] }); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>Shopify</h1>
        <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>keep the storefront — BMN is the brain behind it</span>
      </div>

      {!st ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ConnectCard st={st} onChanged={refresh} />
          {st.connected && (
            <>
              <SyncCard st={st} onChanged={refresh} />
              <LocationsCard onChanged={refresh} />
              <UnmatchedCard onChanged={refresh} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectCard({ st, onChanged }: { st: any; onChanged: () => void }) {
  const [shop, setShop] = useState('');
  const connect = useMutation({
    mutationFn: async () => (await api.post<{ url: string }>('/integrations/shopify/connect', { shop })).data,
    onSuccess: ({ url }) => { window.open(url, '_blank'); toast.info('Approve the app in the Shopify window, then come back here.'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const setMaster = useMutation({
    mutationFn: async (catalogueMaster: string) => api.patch('/integrations/shopify/catalogue-master', { catalogueMaster }),
    onSuccess: () => { toast.success('Catalogue master updated'); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (st.connected) {
    return (
      <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <CheckCircle2 size={20} color="#1e874b" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{st.shopDomain}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Connected {st.installedAt ? new Date(st.installedAt).toLocaleDateString() : ''} · webhooks live · token encrypted at rest</div>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          Catalogue master:{' '}
          <select className="input" style={{ height: 30, fontSize: 12.5, width: 130, display: 'inline-block' }} value={st.catalogueMaster} onChange={(e) => setMaster.mutate(e.target.value)}>
            <option value="SHOPIFY">Shopify</option>
            <option value="BMN">BMN Connect</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, marginBottom: 6 }}><Plug size={17} /> Connect your Shopify store</div>
      <p style={{ color: 'var(--ink-2)', fontSize: 13.5, margin: '0 0 14px', maxWidth: 640 }}>
        Keep selling on Shopify — BMN Connect becomes the CRM, loyalty, POS and inventory brain behind it.
        Orders, customers and stock sync automatically in both directions, each field with exactly one master.
      </p>
      {!st.credentialsPresent && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(230,162,60,.1)', border: '1px solid rgba(230,162,60,.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
          <AlertTriangle size={15} color="#b8791f" style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <strong>Shopify app credentials are not configured.</strong> Set <code>SHOPIFY_API_KEY</code> and <code>SHOPIFY_API_SECRET</code> as
            environment variables on the API service (Railway dashboard → api → Variables). Create the app in the Shopify Partners
            dashboard with redirect URL <code>{'{API_URL}'}/api/public/shopify/callback</code>. Never paste keys into chat or code.
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, maxWidth: 520 }}>
        <input className="input" style={{ height: 40 }} placeholder="your-store.myshopify.com" value={shop} onChange={(e) => setShop(e.target.value)} />
        <button className="btn-primary" style={{ height: 40, whiteSpace: 'nowrap' }} disabled={!shop || !st.credentialsPresent || connect.isPending} onClick={() => connect.mutate()}>
          Connect store
        </button>
      </div>
    </div>
  );
}

function SyncCard({ st, onChanged }: { st: any; onChanged: () => void }) {
  const sync = useMutation({
    mutationFn: async () => api.post('/integrations/shopify/sync', {}),
    onSuccess: () => { toast.success('Import started — products, customers and recent orders'); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reconcile = useMutation({
    mutationFn: async () => api.post('/integrations/shopify/reconcile', {}),
    onSuccess: () => { toast.success('Reconcile started — diffing both sides and repairing drift'); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const q = st.queue ?? {};
  const stat = (label: string, value: number, bad?: boolean) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: bad && value > 0 ? '#c0392b' : undefined }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    </div>
  );
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>Sync health</div>
        <span style={{ flex: 1 }} />
        <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} disabled={sync.isPending} onClick={() => sync.mutate()}><RefreshCw size={13} /> Import from Shopify</button>
        <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} disabled={reconcile.isPending} onClick={() => reconcile.mutate()}>Reconcile now</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
        {stat('synced products', st.synced?.STYLE ?? 0)}
        {stat('synced variants', st.synced?.VARIANT ?? 0)}
        {stat('customers', st.synced?.CUSTOMER ?? 0)}
        {stat('orders', st.synced?.ORDER ?? 0)}
        {stat('queue pending', (q.pendingEvents ?? 0) + (q.pendingPushes ?? 0))}
        {stat('dead letters', (q.deadEvents ?? 0) + (q.deadPushes ?? 0), true)}
      </div>
      <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
        {st.lastImport && <>Last import: <strong>{st.lastImport.status}</strong>{st.lastImport.stats ? ` · ${Object.entries(st.lastImport.stats).map(([k, v]) => `${v} ${k}`).join(' · ')}` : ''}{st.lastImport.error ? ` — ${st.lastImport.error}` : ''}<br /></>}
        {st.lastReconcile ? <>Last reconcile: <strong>{st.lastReconcile.status}</strong> {st.lastReconcile.finishedAt ? new Date(st.lastReconcile.finishedAt).toLocaleString() : ''}{st.lastReconcile.stats ? ` · ${Object.entries(st.lastReconcile.stats).map(([k, v]) => `${v} ${k}`).join(' · ')}` : ''}</> : 'Nightly reconcile runs at 03:00 — missed webhooks self-heal.'}
      </div>
    </div>
  );
}

function LocationsCard({ onChanged }: { onChanged: () => void }) {
  const { data } = useQuery({ queryKey: ['shopify-locations'], queryFn: retailApi.locations });
  const map = useMutation({
    mutationFn: async (v: { shopifyLocationId: string; branchId: string }) => api.post('/integrations/shopify/locations/map', v),
    onSuccess: () => { toast.success('Location mapped'); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  if (!data) return null;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14.5, marginBottom: 10 }}><Store size={15} /> Locations ↔ stores</div>
      {data.locations.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No Shopify locations pulled yet — they arrive on connect or import.</div>}
      {data.locations.map((loc) => (
        <div key={loc.shopifyLocationId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5 }}>
          <div style={{ flex: 1 }}>{loc.name} <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>#{loc.shopifyLocationId}</span></div>
          <select
            className="input" style={{ height: 32, fontSize: 12.5, width: 200 }}
            value={loc.mappedBranch?.id ?? ''}
            onChange={(e) => e.target.value && map.mutate({ shopifyLocationId: loc.shopifyLocationId, branchId: e.target.value })}
          >
            <option value="">Map to store…</option>
            {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      ))}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>Online orders reserve and decrement stock at the mapped store; in-store sales push the new quantity back to that Shopify location.</div>
    </div>
  );
}

function UnmatchedCard({ onChanged }: { onChanged: () => void }) {
  const { data: rows } = useQuery({ queryKey: ['shopify-unmatched'], queryFn: retailApi.unmatched });
  const retry = useMutation({
    mutationFn: async (id: string) => (await api.post<{ resolved: boolean; reason?: string }>(`/integrations/shopify/unmatched/${id}/retry`, {})).data,
    onSuccess: (r) => { r.resolved ? toast.success('Matched and linked') : toast.error(`Still unmatched: ${r.reason}`); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  if (!rows) return null;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
        <AlertTriangle size={15} color={rows.length ? '#b8791f' : 'var(--ink-3)'} /> SKU audit
        <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--ink-3)' }}>· blank or unmapped SKUs are surfaced here, never guessed</span>
      </div>
      {rows.length === 0 && <div style={{ color: '#1e874b', fontSize: 13.5, marginTop: 6 }}>✓ Every Shopify variant is matched.</div>}
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5 }}>
          <div style={{ flex: 1 }}>
            <div>{r.styleTitle}{r.variantTitle ? <span style={{ color: 'var(--ink-3)' }}> · {r.variantTitle}</span> : ''}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>sku: {r.sku ?? '—'} · barcode: {r.barcode ?? '—'}</div>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 8px', borderRadius: 7, color: '#b8791f', background: 'rgba(230,162,60,.14)' }}>{r.reason.replace(/_/g, ' ')}</span>
          <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} disabled={retry.isPending} onClick={() => retry.mutate(r.id)}>Retry match</button>
        </div>
      ))}
    </div>
  );
}
