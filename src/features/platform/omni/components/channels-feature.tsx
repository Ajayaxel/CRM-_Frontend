'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plug, CheckCircle2, Send, Copy, X } from 'lucide-react';
import { omniApi, CHANNEL_META, ChannelType } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

interface ChannelRow {
  id: string; type: ChannelType; name: string; connected: boolean; active: boolean;
  config: any; externalId?: string | null; _count?: { conversations: number };
}

const ALL_CHANNELS: ChannelType[] = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TELEGRAM', 'SMS', 'RCS', 'EMAIL', 'WEB_CHAT', 'VOICE'];
// Providers configured via a simple key/value creds modal (generic connect).
const GENERIC_CONNECT: Partial<Record<ChannelType, { label: string; fields: { key: string; label: string; placeholder?: string }[] }>> = {
  SMS: { label: 'Twilio SMS', fields: [{ key: 'accountSid', label: 'Account SID', placeholder: 'AC…' }, { key: 'authToken', label: 'Auth Token' }, { key: 'from', label: 'From number', placeholder: '+1…' }] },
  RCS: { label: 'Twilio RCS', fields: [{ key: 'accountSid', label: 'Account SID' }, { key: 'authToken', label: 'Auth Token' }, { key: 'from', label: 'RCS agent / number' }] },
  EMAIL: { label: 'SendGrid Email', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'SG.…' }, { key: 'from', label: 'From email', placeholder: 'hello@school.edu' }] },
  VOICE: { label: 'Voice / IVR', fields: [{ key: 'accountSid', label: 'Account SID' }, { key: 'authToken', label: 'Auth Token' }, { key: 'from', label: 'Caller ID' }] },
  TELEGRAM: { label: 'Telegram Bot', fields: [{ key: 'botToken', label: 'Bot Token' }] },
};
const SIM_PATH: Partial<Record<ChannelType, string>> = { WHATSAPP: 'whatsapp', INSTAGRAM: 'instagram', FACEBOOK: 'facebook' };

export function ChannelsFeature() {
  const qc = useQueryClient();
  const [connect, setConnect] = useState<ChannelRow | null>(null);
  const [simulate, setSimulate] = useState<ChannelRow | null>(null);

  const { data } = useQuery({
    queryKey: ['omni-channels'],
    queryFn: async () => (await omniApi.get<ChannelRow[]>('/channels')).data,
  });
  const create = useMutation({
    mutationFn: (type: ChannelType) => omniApi.post('/channels', { type, name: CHANNEL_META[type].label }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-channels'] }); toast.success('Channel added'); },
  });

  const existing = new Set((data ?? []).map((c) => c.type));

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Channels</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Connect WhatsApp, social and messaging channels to your unified inbox.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
        {(data ?? []).map((c) => (
          <div key={c.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{CHANNEL_META[c.type].icon}</span>
              {c.connected
                ? <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><CheckCircle2 size={12} style={{ marginRight: 3 }} /> Connected</span>
                : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Not connected</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{c._count?.conversations ?? 0} conversations</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {(c.type === 'WHATSAPP' || GENERIC_CONNECT[c.type]) && <button className="btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => setConnect(c)}><Plug size={13} /> {c.connected ? 'Reconfigure' : 'Connect'}</button>}
              {c.type !== 'WEB_CHAT' && <button className="btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => setSimulate(c)}><Send size={13} /> Simulate</button>}
              {c.type === 'WEB_CHAT' && <a className="btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} href="/widget-demo.html" target="_blank" rel="noreferrer">Open widget</a>}
            </div>
          </div>
        ))}

        {ALL_CHANNELS.filter((t) => !existing.has(t)).map((t) => (
          <button key={t} onClick={() => create.mutate(t)}
            style={{ ...card, padding: 18, cursor: 'pointer', textAlign: 'left', borderStyle: 'dashed', opacity: 0.75 }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>{CHANNEL_META[t].icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Add {CHANNEL_META[t].label}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Click to enable this channel</div>
          </button>
        ))}
      </div>

      {connect && (connect.type === 'WHATSAPP'
        ? <ConnectModal channel={connect} onClose={() => setConnect(null)} />
        : <GenericConnectModal channel={connect} onClose={() => setConnect(null)} />)}
      {simulate && <SimulateModal channel={simulate} onClose={() => setSimulate(null)} />}
    </div>
  );
}

function ConnectModal({ channel, onClose }: { channel: ChannelRow; onClose: () => void }) {
  const qc = useQueryClient();
  // The default used to be 'bmn-verify-' + the last six characters of the
  // channel id — and the channel id is right there in the callback URL below,
  // so the token was derivable from the one thing you hand to Meta. Random now.
  const [f, setF] = useState(() => ({
    phoneNumberId: '',
    accessToken: '',
    verifyToken: 'bmn-' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0')).join(''),
  }));
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/omni/webhooks/whatsapp/${channel.id}` : '';

  const save = useMutation({
    mutationFn: () => omniApi.patch(`/channels/${channel.id}/connect`, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-channels'] }); toast.success('WhatsApp connected'); onClose(); },
    onError: () => toast.error('Failed to connect'),
  });

  return (
    <Overlay onClose={onClose} title="Connect WhatsApp Business API">
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
        Add these in your Meta WhatsApp Cloud API app, then paste the credentials here.
      </div>
      <label className="label">Webhook Callback URL</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <code style={{ flex: 1, fontSize: 11.5, background: 'var(--surface-3)', padding: '9px 10px', borderRadius: 8, overflow: 'auto' }}>{webhookUrl}</code>
        <button className="btn-secondary" style={{ height: 36 }} onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied'); }}><Copy size={14} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label className="label">Phone Number ID</label><input className="input" value={f.phoneNumberId} onChange={(e) => setF({ ...f, phoneNumberId: e.target.value })} placeholder="1029384756" /></div>
        <div><label className="label">Access Token</label><input className="input" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} placeholder="EAA…" /></div>
        <div><label className="label">Verify Token</label><input className="input" value={f.verifyToken} onChange={(e) => setF({ ...f, verifyToken: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.phoneNumberId || !f.accessToken || save.isPending} onClick={() => save.mutate()}>Connect</button>
      </div>
    </Overlay>
  );
}

function SimulateModal({ channel, onClose }: { channel: ChannelRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ from: '91' + Math.floor(9000000000 + Math.random() * 999999999), name: 'Test Customer', text: 'Hi, what are the course fees?' });
  // WhatsApp/Instagram/Facebook have dedicated webhook controllers; the rest use the generic channel connector.
  const run = useMutation({
    mutationFn: () => {
      const dedicated = SIM_PATH[channel.type];
      const url = dedicated ? `/webhooks/${dedicated}/${channel.id}/simulate` : `/webhooks/channel/${channel.id}/simulate`;
      return omniApi.post(url, f);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-conversations'] }); toast.success('Inbound simulated — check the inbox'); onClose(); },
    onError: () => toast.error('Simulate failed (channel may not support it yet)'),
  });

  return (
    <Overlay onClose={onClose} title={`Simulate ${CHANNEL_META[channel.type].label} inbound`}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>Inject a fake inbound message to test the flow without a live provider.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label className="label">From (handle)</label><input className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">Message</label><textarea className="input" rows={3} style={{ resize: 'vertical' }} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={run.isPending} onClick={() => run.mutate()}><Send size={14} /> Send inbound</button>
      </div>
    </Overlay>
  );
}

function GenericConnectModal({ channel, onClose }: { channel: ChannelRow; onClose: () => void }) {
  const qc = useQueryClient();
  const spec = GENERIC_CONNECT[channel.type]!;
  const [f, setF] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => omniApi.patch(`/channels/${channel.id}/connect`, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-channels'] }); toast.success(`${spec.label} connected`); onClose(); },
    onError: () => toast.error('Failed to connect'),
  });

  return (
    <Overlay onClose={onClose} title={`Connect ${spec.label}`}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>Paste your provider credentials. Leave blank to run in simulated mode.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spec.fields.map((fl) => (
          <div key={fl.key}>
            <label className="label">{fl.label}</label>
            <input className="input" value={f[fl.key] ?? ''} placeholder={fl.placeholder} onChange={(e) => setF({ ...f, [fl.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Connect</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
