'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Blocks, Webhook, KeyRound, Plus, Trash2, X, Copy, Zap, CheckCircle2 } from 'lucide-react';
import { omniApi, OmniApiKey, OmniWebhook, IntegrationDirectory } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const CAT_ICON: Record<string, string> = { Automation: '⚡', Productivity: '📊', CRM: '🗂️', Payments: '💳', Developer: '🧩' };

export function IntegrationsFeature() {
  const [tab, setTab] = useState<'directory' | 'webhooks' | 'keys'>('directory');
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Integrations</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Connect BMN Connect to your stack via webhooks, a REST API, and no-code tools.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <Tab active={tab === 'directory'} onClick={() => setTab('directory')} icon={<Blocks size={15} />}>Directory</Tab>
        <Tab active={tab === 'webhooks'} onClick={() => setTab('webhooks')} icon={<Webhook size={15} />}>Webhooks</Tab>
        <Tab active={tab === 'keys'} onClick={() => setTab('keys')} icon={<KeyRound size={15} />}>API Keys</Tab>
      </div>
      {tab === 'directory' && <Directory onManage={() => setTab('webhooks')} />}
      {tab === 'webhooks' && <Webhooks />}
      {tab === 'keys' && <ApiKeys />}
    </div>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
      cursor: 'pointer', border: '1px solid ' + (active ? 'transparent' : 'var(--line-soft)'),
      background: active ? 'var(--brand,#132376)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)',
    }}>{icon}{children}</button>
  );
}

function Directory({ onManage }: { onManage: () => void }) {
  const { data } = useQuery({ queryKey: ['omni-int-directory'], queryFn: async () => (await omniApi.get<IntegrationDirectory>('/integrations/directory')).data });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
      {(data?.integrations ?? []).map((it) => (
        <div key={it.key} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{CAT_ICON[it.category] ?? '🔌'}</div>
            <div><div style={{ fontWeight: 700, fontSize: 14.5 }}>{it.name}</div><span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{it.category}</span></div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>{it.desc}</div>
          <button className="btn-secondary" style={{ marginTop: 12, height: 34, fontSize: 12.5 }} onClick={onManage}>
            {it.via === 'webhook' ? <><Webhook size={13} /> Connect via webhook</> : <><KeyRound size={13} /> Connect via API</>}
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Webhooks ----------------
function Webhooks() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['omni-webhooks'], queryFn: async () => (await omniApi.get<OmniWebhook[]>('/integrations/webhooks')).data });
  const del = useMutation({ mutationFn: (id: string) => omniApi.delete(`/integrations/webhooks/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-webhooks'] }); toast.success('Webhook deleted'); } });
  const test = useMutation({
    mutationFn: (id: string) => omniApi.post(`/integrations/webhooks/${id}/test`).then((r) => r.data),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['omni-webhooks'] }); toast.success(`Test sent — HTTP ${r.lastStatus}`); },
    onError: () => toast.error('Test failed'),
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New webhook</button>
      </div>
      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Webhook size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No webhooks yet. Register a URL to receive real-time events.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((w) => (
          <div key={w.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <code style={{ fontSize: 12.5, fontWeight: 600 }}>{w.url}</code>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                  {w.events.length ? w.events.map((e) => <span key={e} className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{e}</span>) : <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>all events</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>
                  {w.deliveries} deliveries {w.lastStatus != null && <>· last HTTP <b style={{ color: w.lastStatus >= 200 && w.lastStatus < 300 ? 'var(--success)' : 'var(--danger,#c0392b)' }}>{w.lastStatus}</b></>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} disabled={test.isPending} onClick={() => test.mutate(w.id)}><Zap size={13} /> Test</button>
                <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => del.mutate(w.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {compose && <WebhookModal onClose={() => setCompose(false)} />}
    </div>
  );
}

function WebhookModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: dir } = useQuery({ queryKey: ['omni-int-directory'], queryFn: async () => (await omniApi.get<IntegrationDirectory>('/integrations/directory')).data });
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const toggle = (e: string) => setEvents((s) => s.includes(e) ? s.filter((x) => x !== e) : [...s, e]);

  const create = useMutation({
    mutationFn: () => omniApi.post('/integrations/webhooks', { url, events }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-webhooks'] }); toast.success('Webhook added'); onClose(); },
    onError: () => toast.error('Failed to add webhook'),
  });

  return (
    <Overlay onClose={onClose} title="New webhook">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Endpoint URL</label><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/…" /></div>
        <div>
          <label className="label">Events (none selected = all)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(dir?.events ?? []).map((e) => (
              <label key={e} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={events.includes(e)} onChange={() => toggle(e)} /> <code>{e}</code>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!url || create.isPending} onClick={() => create.mutate()}>Add webhook</button>
      </div>
    </Overlay>
  );
}

// ---------------- API Keys ----------------
function ApiKeys() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['omni-keys'], queryFn: async () => (await omniApi.get<OmniApiKey[]>('/integrations/keys')).data });

  const create = useMutation({
    mutationFn: () => omniApi.post<OmniApiKey>('/integrations/keys', { name }).then((r) => r.data),
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['omni-keys'] }); setRevealed(k.key); setName(''); },
  });
  const revoke = useMutation({ mutationFn: (id: string) => omniApi.delete(`/integrations/keys/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-keys'] }); toast.success('Key revoked'); } });

  return (
    <div>
      <div style={{ ...card, padding: 16, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><label className="label">Create a new API key</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Zapier)" /></div>
        <button className="btn-primary" disabled={!name || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Generate</button>
      </div>

      {revealed && (
        <div style={{ ...card, padding: 16, marginBottom: 14, borderColor: 'var(--brand,#132376)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 8 }}><CheckCircle2 size={13} style={{ color: 'var(--success)', verticalAlign: -2, marginRight: 4 }} /> Copy your key now — it won't be shown again.</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <code style={{ flex: 1, fontSize: 13, background: 'var(--surface-3)', padding: '10px 12px', borderRadius: 8 }}>{revealed}</code>
            <button className="btn-secondary" style={{ height: 40 }} onClick={() => { navigator.clipboard.writeText(revealed); toast.success('Copied'); }}><Copy size={14} /></button>
            <button className="btn-secondary" style={{ height: 40 }} onClick={() => setRevealed(null)}><X size={14} /></button>
          </div>
        </div>
      )}

      {(data ?? []).length === 0 && !revealed && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <KeyRound size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No API keys yet. Generate one to use the REST API.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((k) => (
          <div key={k.id} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{k.name}</div>
              <code style={{ fontSize: 12, color: 'var(--ink-3)' }}>{k.key}</code>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 10 }}>{k.lastUsedAt ? 'used recently' : 'never used'}</span>
            </div>
            <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => revoke.mutate(k.id)}><Trash2 size={13} /> Revoke</button>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 16, marginTop: 14, fontSize: 12.5, color: 'var(--ink-2)' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Quick start</div>
        <code style={{ display: 'block', background: 'var(--surface-3)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          curl {typeof window !== 'undefined' ? window.location.origin : ''}/omni/api/v1/contacts \{'\n'}  -H &quot;X-API-Key: YOUR_KEY&quot;
        </code>
      </div>
    </div>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
