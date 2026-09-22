'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Key, Copy, Trash2, Shield, RefreshCw, Send, Terminal, Play } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

export function DeveloperHub() {
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: '1', name: 'PMS Sync Production', keyPrefix: 'bmn_live_a1b2...', createdAt: new Date().toLocaleDateString() }
  ]);
  const [newKeyName, setNewKeyName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('https://hotel-webhook.example.com/callback');
  const [webhookLogs, setWebhookLogs] = useState<string[]>([
    '[2026-07-08 05:30:12] Sent reservation.created event to callback URL - 200 OK'
  ]);

  const handleGenerateKey = () => {
    if (!newKeyName) {
      toast.error('Key Name is required');
      return;
    }
    const newKey: ApiKey = {
      id: Math.random().toString(),
      name: newKeyName,
      keyPrefix: 'bmn_live_newKeyPrefix...',
      createdAt: new Date().toLocaleDateString(),
    };
    setKeys([...keys, newKey]);
    setNewKeyName('');
    toast.success('API Key generated successfully! Make sure to copy it now.');
  };

  const handleRevokeKey = (id: string) => {
    setKeys(keys.filter(k => k.id !== id));
    toast.success('API Key revoked.');
  };

  const triggerWebhookTest = () => {
    const log = `[${new Date().toLocaleTimeString()}] Tested event reservation.checked_in dispatched - 200 OK`;
    setWebhookLogs([log, ...webhookLogs]);
    toast.success('Test webhook dispatched successfully!');
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Developer Portal</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6 }}>Manage API keys, webhooks subscriptions, and test request parameters.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        {/* Left: API Key management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={18} style={{ color: 'var(--brand)' }} /> API Keys Manager
            </h3>

            {/* Key creation form */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Key Description (e.g. Booking.com sync)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13 }}
              />
              <button
                onClick={handleGenerateKey}
                style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Generate Key
              </button>
            </div>

            {/* Keys lists */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {keys.map(key => (
                <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--line-soft)', borderRadius: 10, background: 'var(--bg)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{key.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace', marginTop: 4 }}>Token: {key.keyPrefix}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => { navigator.clipboard.writeText('bmn_live_fullKeyMock'); toast.success('API Key copied to clipboard!'); }}
                      style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 6 }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 6 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook tester */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={18} style={{ color: 'var(--success)' }} /> Webhook Subscriptions
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13 }}
              />
              <button
                onClick={triggerWebhookTest}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                <Play size={12} /> Test Webhook
              </button>
            </div>
            {/* Logs console */}
            <div style={{ background: '#1c1c1e', color: '#30d158', borderRadius: 10, padding: 14, fontFamily: 'monospace', fontSize: 11, minHeight: 100, maxHeight: 150, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8e8e93', marginBottom: 8, borderBottom: '1px solid #2c2c2e', paddingBottom: 6 }}>
                <Terminal size={12} /> Webhook Callback console logs
              </div>
              {webhookLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: 4 }}>{log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: API Interactive Docs mock */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Interactive API Explorer</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DocEndpoint method="GET" path="/hotel/rooms" desc="Returns a list of all property rooms." />
              <DocEndpoint method="POST" path="/hotel-bookings" desc="Submit a guest reservation checkout." />
              <DocEndpoint method="POST" path="/pos/orders" desc="Create a restaurant ticket order." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocEndpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor = method === 'GET' ? 'var(--success)' : 'var(--brand)';
  return (
    <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 12, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: methodColor, padding: '2px 6px', borderRadius: 4 }}>{method}</span>
        <span style={{ fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>{path}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0 }}>{desc}</p>
    </div>
  );
}
